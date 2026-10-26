/**
 * SLATE — Browser-local persistence.
 *
 * Used standalone and as the offline fallback. Every write makes a backup of
 * the previous state first, so a failed write or a corrupt save always has
 * something to recover from.
 *
 * Saves are kept in IndexedDB where the browser has it, and in local storage
 * where it doesn't. Until 2026-09-28 they were kept in local storage alone,
 * which a browser holds to about five million characters an origin: a life
 * played to eighty packs to about 1.4 million, twice that with its backup, so
 * a second long life in another slot could no longer be saved. A save still
 * in local storage is moved across the first time it's read.
 */

import type { SaveUniverse } from '../domain/model';
import { deserialise, serialise, PersistenceError, type SaveAdapter, type SaveSlotInfo, type Slot } from './adapter';

const KEY = (slot: Slot) => `slate.save.${slot}`;
const BACKUP_KEY = (slot: Slot) => `slate.backup.${slot}`;

/**
 * A save is gzipped before it's stored, because a universe that has run for
 * a year is several megabytes of JSON. The packed form is marked so an older,
 * plain save still loads; the marker is not valid JSON, so the two cannot be
 * confused.
 */
const PACKED = 'slate.gz1:';

function canPack(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pack(json: string): Promise<string> {
  if (!canPack()) return json;
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return PACKED + toBase64(bytes);
}

async function unpack(raw: string): Promise<string> {
  if (!raw.startsWith(PACKED)) return raw;
  if (!canPack()) throw new PersistenceError('This save is compressed, and this browser can’t open it. Open SLATE in an up-to-date browser.', false);
  const bytes = fromBase64(raw.slice(PACKED.length));
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Where saves are kept: a key and its text. */
export interface SaveStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function localStore(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new PersistenceError('This browser has no storage SLATE can use, so saves can’t be kept here. Check that this site is allowed to store data.', false);
  }
  return localStorage;
}

/** Local storage, as a save store. */
export const LOCAL_STORE: SaveStore = {
  getItem: async (key) => localStore().getItem(key),
  setItem: async (key, value) => localStore().setItem(key, value),
  removeItem: async (key) => localStore().removeItem(key),
};

const DB_NAME = 'slate';
const DB_STORE = 'saves';
let db: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(DB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { db = undefined; reject(req.error); };
  });
  return db;
}

function request<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then((d) => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(DB_STORE, mode);
    const req = run(tx.objectStore(DB_STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? req.error);
  }));
}

/** IndexedDB, as a save store. */
export const INDEXED_STORE: SaveStore = {
  getItem: async (key) => (await request<string | undefined>('readonly', (st) => st.get(key))) ?? null,
  setItem: async (key, value) => { await request('readwrite', (st) => st.put(value, key)); },
  removeItem: async (key) => { await request('readwrite', (st) => st.delete(key)); },
};

/** A store that keeps saves in `primary`, and moves any still in `legacy` across the first time they're read. */
export function movingStore(primary: SaveStore, legacy: SaveStore): SaveStore {
  return {
    async getItem(key) {
      const found = await primary.getItem(key);
      if (found !== null) return found;
      let old: string | null = null;
      try { old = await legacy.getItem(key); } catch { return null; }
      if (old === null) return null;
      await primary.setItem(key, old);
      await legacy.removeItem(key).catch(() => {});
      return old;
    },
    setItem: (key, value) => primary.setItem(key, value),
    async removeItem(key) {
      await primary.removeItem(key);
      await legacy.removeItem(key).catch(() => {});
    },
  };
}

function defaultStore(): SaveStore {
  return typeof indexedDB !== 'undefined' ? movingStore(INDEXED_STORE, LOCAL_STORE) : LOCAL_STORE;
}

export class LocalSaveAdapter implements SaveAdapter {
  readonly name = 'This Device';
  readonly serverAuthoritative = false;

  constructor(private readonly store: SaveStore = defaultStore()) {}

  async listSlots(): Promise<SaveSlotInfo[]> {
    const slots: SaveSlotInfo[] = [];
    for (const slot of [1, 2, 3] as Slot[]) {
      let raw: string | null;
      try {
        raw = await this.store.getItem(KEY(slot));
      } catch {
        slots.push({ slot, occupied: false, hasBackup: false, error: 'This device’s storage couldn’t be read just now. Reload SLATE to try again.' });
        continue;
      }
      // A backup is only a backup if it can be read. Advertising one that
      // cannot puts a button on the card that fails when it is pressed.
      const backup = await this.readBackup(slot);
      const hasBackup = backup !== null;
      const backupDateLabel = backup?.meta.worldDateLabel || undefined;
      if (!raw) {
        slots.push({ slot, occupied: false, hasBackup, backupDateLabel });
        continue;
      }
      try {
        const universe = deserialise(await unpack(raw));
        slots.push({ slot, occupied: true, meta: universe.meta, hasBackup, backupDateLabel, bytes: raw.length });
      } catch (error) {
        slots.push({
          slot, occupied: true, hasBackup, backupDateLabel, bytes: raw.length,
          error: (error as Error).message,
        });
      }
    }
    return slots;
  }

  async load(slot: Slot): Promise<SaveUniverse | null> {
    const raw = await this.store.getItem(KEY(slot));
    if (!raw) return null;
    return deserialise(await unpack(raw));
  }

  async save(universe: SaveUniverse): Promise<void> {
    const slot = universe.meta.slot;
    const previous = await this.store.getItem(KEY(slot));
    const next = await pack(serialise(universe));

    try {
      // Back up what is already there before overwriting it.
      if (previous) {
        await this.store.setItem(BACKUP_KEY(slot), previous);
      }
      await this.store.setItem(KEY(slot), next);
    } catch (error) {
      // The slot's own key is written last and whole, so a failure leaves it as it was (from 2026-10-17, brief 14, the
      // words say so; until then the second said `The save couldn’t be written: <the storage's own message>`).
      const full = (error as Error).name === 'QuotaExceededError';
      if (!full) console.error(error);
      throw new PersistenceError(full
        ? 'There isn’t enough storage space on this device to save, so nothing in the slot changed. Free some space, or delete a save you no longer want, then try again.'
        : 'SLATE couldn’t save to this device, so nothing in the slot changed. Try again in a moment.', true);
    }
  }

  async remove(slot: Slot): Promise<void> {
    const existing = await this.store.getItem(KEY(slot));
    // Deleting keeps a backup, so an accidental delete is recoverable. A save
    // that cannot be read is not worth keeping and must never be written over
    // a backup that can: deleting a corrupt slot is exactly when the older
    // copy is the only thing left.
    if (existing && await this.readable(existing)) {
      await this.store.setItem(BACKUP_KEY(slot), existing);
    }
    await this.store.removeItem(KEY(slot));
  }

  private async readable(raw: string): Promise<boolean> {
    try {
      deserialise(await unpack(raw));
      return true;
    } catch {
      return false;
    }
  }

  private async readBackup(slot: Slot): Promise<SaveUniverse | null> {
    const raw = await this.store.getItem(BACKUP_KEY(slot));
    if (!raw) return null;
    try {
      return deserialise(await unpack(raw));
    } catch {
      return null;
    }
  }

  async backup(slot: Slot): Promise<boolean> {
    const raw = await this.store.getItem(KEY(slot));
    if (!raw) return false;
    await this.store.setItem(BACKUP_KEY(slot), raw);
    return true;
  }

  async restoreBackup(slot: Slot): Promise<SaveUniverse | null> {
    const raw = await this.store.getItem(BACKUP_KEY(slot));
    if (!raw) return null;
    const universe = deserialise(await unpack(raw));
    await this.save(universe);
    return universe;
  }
}
