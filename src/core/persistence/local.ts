import { PersistenceError, SLOTS, decode, encode, type Kept, type Slot, type SlotInfo, type Store } from './contract.ts';

/**
 * Lives kept on this device (KEEP entry 1): in IndexedDB where the browser has it, in local storage where it doesn't
 * (which a browser holds to about five million characters an origin). Every life is gzipped before it's kept, and
 * every write keeps a copy of what was there first, then writes the life's own key last and whole, so a failed write
 * leaves it as it was.
 *
 * The keys and the database are this build's own (`slate.life.N`, `slate.copy.N`, database `slate-lives`): the first
 * SLATE's saves, under `slate.save.N` in database `slate`, are of another model of the world, so this build doesn't
 * read them, and doesn't touch them.
 */
const LIFE = (slot: Slot) => `slate.life.${slot}`;
const COPY = (slot: Slot) => `slate.copy.${slot}`;

/** The mark of a gzipped life; not valid JSON, so it can't be taken for a plain one. */
export const PACKED = 'slate.gz1:';

function canPack(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // Stryker disable next-line EqualityOperator: one more pass reads an empty chunk, which adds nothing.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** A life's text gzipped and marked, or as it is where the browser can't compress. */
export async function pack(json: string): Promise<string> {
  if (!canPack()) return json;
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return PACKED + toBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** A kept text back to the life's own. */
export async function unpack(raw: string): Promise<string> {
  if (!raw.startsWith(PACKED)) return raw;
  if (!canPack()) throw new PersistenceError('life.compressed', false);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64(raw.slice(PACKED.length));
    return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  } catch {
    throw new PersistenceError('life.damaged', false);
  }
}

/** Where kept text lives: a key and its text. */
export interface KeyStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Local storage, as a key store. */
export function storageStore(storage: () => Storage | undefined = () => globalThis.localStorage): KeyStore {
  const get = () => {
    const s = storage();
    if (s === undefined) throw new PersistenceError('life.no-storage', false);
    return s;
  };
  return {
    getItem: async (key) => get().getItem(key),
    setItem: async (key, value) => get().setItem(key, value),
    removeItem: async (key) => get().removeItem(key),
  };
}

export const DB_NAME = 'slate-lives';
const DB_STORE = 'lives';

/** IndexedDB, as a key store: one database, one object store, a transaction a request. */
export function indexedStore(factory: IDBFactory): KeyStore {
  let db: Promise<IDBDatabase> | undefined;
  const open = () => {
    db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        // A database that wouldn't open is tried again next time.
        db = undefined;
        reject(req.error);
      };
    });
    return db;
  };
  const request = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
    const d = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = d.transaction(DB_STORE, mode);
      const req = run(tx.objectStore(DB_STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error ?? req.error);
      tx.onabort = () => reject(tx.error ?? req.error);
    });
  };
  return {
    getItem: async (key) => (await request<string | undefined>('readonly', (st) => st.get(key))) ?? null,
    setItem: async (key, value) => void (await request('readwrite', (st) => st.put(value, key))),
    removeItem: async (key) => void (await request('readwrite', (st) => st.delete(key))),
  };
}

/** IndexedDB where the browser has it, local storage where it doesn't. */
export function deviceStore(factory: IDBFactory | undefined = globalThis.indexedDB): KeyStore {
  return factory === undefined ? storageStore() : indexedStore(factory);
}

const FULL = (e: unknown) => e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

export class DeviceStore implements Store {
  readonly where = 'device';

  constructor(private readonly keys: KeyStore = deviceStore()) {}

  /** The kept life's text, or null; a store that can't be read says so in the player's terms. */
  private async read(key: string): Promise<string | null> {
    try {
      return await this.keys.getItem(key);
    } catch (e) {
      if (e instanceof PersistenceError) throw e;
      throw new PersistenceError('life.storage-unreadable', true);
    }
  }

  /** The kept life a text holds, or null when there's none or it can't be read. */
  private async readable(raw: string | null): Promise<Kept | null> {
    // Stryker disable next-line ConditionalExpression: without it, no text fails to unpack and is caught as unreadable, the same answer.
    if (raw === null) return null;
    try {
      return decode(await unpack(raw));
    } catch {
      return null;
    }
  }

  /** The copy, if it can be read: a copy that can't is no copy, so nothing offers to bring it back. */
  private async readCopy(slot: Slot): Promise<Kept | null> {
    return this.readable(await this.read(COPY(slot)));
  }

  async listSlots(): Promise<SlotInfo[]> {
    const out: SlotInfo[] = [];
    for (const slot of SLOTS) {
      let raw: string | null;
      let copy: Kept | null;
      try {
        raw = await this.read(LIFE(slot));
        copy = await this.readCopy(slot);
      } catch (e) {
        out.push({ slot, occupied: false, hasBackup: false, error: (e as PersistenceError).line });
        continue;
      }
      const backup = copy === null ? { hasBackup: false } : { hasBackup: true, backupCard: copy.meta.card };
      if (raw === null) {
        out.push({ slot, occupied: false, ...backup });
        continue;
      }
      const bytes = new TextEncoder().encode(raw).length;
      try {
        out.push({ slot, occupied: true, meta: decode(await unpack(raw)).meta, ...backup, bytes });
      } catch (e) {
        out.push({ slot, occupied: true, ...backup, bytes, error: (e as PersistenceError).line });
      }
    }
    return out;
  }

  async load(slot: Slot): Promise<Kept | null> {
    const raw = await this.read(LIFE(slot));
    return raw === null ? null : decode(await unpack(raw));
  }

  async save(kept: Kept): Promise<void> {
    const slot = kept.meta.slot;
    const previous = await this.read(LIFE(slot));
    const next = await pack(encode(kept));
    try {
      // Only a life that can be read becomes the copy: a damaged one never takes a good copy's place.
      if ((await this.readable(previous)) !== null) await this.keys.setItem(COPY(slot), previous as string);
      await this.keys.setItem(LIFE(slot), next);
    } catch (e) {
      throw new PersistenceError(FULL(e) ? 'life.device-full' : 'life.device-refused', true);
    }
  }

  /** Letting a life go keeps it as the copy, unless it can't be read: then a good copy is never written over. */
  async remove(slot: Slot): Promise<void> {
    const existing = await this.read(LIFE(slot));
    if ((await this.readable(existing)) !== null) await this.keys.setItem(COPY(slot), existing as string);
    await this.keys.removeItem(LIFE(slot));
  }

  /** The copy written back as the life (the life it replaces becoming the copy), and opened. */
  async restoreBackup(slot: Slot): Promise<Kept | null> {
    const raw = await this.read(COPY(slot));
    if (raw === null) return null;
    const kept = decode(await unpack(raw));
    await this.save(kept);
    return kept;
  }
}
