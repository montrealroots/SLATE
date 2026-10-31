import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersistenceError, decode, encode, isNewer } from '../../../src/core/persistence/contract.ts';
import { DB_NAME, DeviceStore, PACKED, deviceStore, indexedStore, pack, storageStore, unpack, type KeyStore } from '../../../src/core/persistence/local.ts';
import { SUPPORTED_SCHEMA_VERSION } from '../../../src/core/persistence/server/guard.ts';
import { APP_VERSION, SCHEMA_VERSION } from '../../../src/core/persistence/version.ts';
import { MemoryStorage, T0, kept } from './support.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The line a promise is refused with. */
async function refusal(p: Promise<unknown>): Promise<[string, boolean]> {
  try {
    await p;
  } catch (e) {
    if (e instanceof PersistenceError) return [e.line, e.recoverable];
    throw e;
  }
  throw new Error('it was not refused');
}
const refusedSync = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return (e as PersistenceError).line;
  }
  return 'not refused';
};

describe('the versions', () => {
  it('are pinned twice, apart, and agree; the build\'s is the package\'s', () => {
    expect(SCHEMA_VERSION).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(APP_VERSION).toBe(JSON.parse(readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8')).version);
  });
});

describe('a kept life\'s text', () => {
  it('reads back as it was written', () => {
    const k = kept(1);
    expect(decode(encode(k))).toEqual(k);
  });
  it('says the file is damaged, or not a SLATE life, never the parser\'s words', () => {
    expect(refusedSync(() => decode('{"meta":'))).toBe('life.damaged');
    const good = JSON.parse(encode(kept(2))) as Record<string, Record<string, unknown>>;
    const bad: unknown[] = [null, 3, [], {}, { meta: good['meta'] }, { life: good['life'] }];
    const meta = good['meta'] as Record<string, unknown>;
    for (const [k, v] of [['card', { name: 'x', age: 3 }], ['id', ''], ['id', 1], ['slot', 4], ['slot', '1'], ['schemaVersion', 0], ['schemaVersion', 1.5], ['appVersion', 1], ['playtimeSeconds', '1'], ['card', []], ['card', { name: 1 }], ['card', null]] as const) {
      bad.push({ ...good, meta: { ...meta, [k]: v } });
    }
    bad.push({ ...good, meta: [] }, { ...good, life: [] }, { ...good, life: { slices: {} } }, { ...good, life: { frame: {}, slices: [] } }, { ...good, life: { frame: [], slices: {} } });
    for (const b of bad) expect(refusedSync(() => decode(JSON.stringify(b)))).toBe('life.not-slate');
    expect(decode(JSON.stringify({ ...good, meta: { ...meta, card: {} } })).meta.card).toEqual({});
  });
  it('knows a life from a newer build', () => {
    expect(isNewer(kept(1).meta)).toBe(false);
    expect(isNewer(kept(1, { schemaVersion: SCHEMA_VERSION + 1 }).meta)).toBe(true);
  });
});

describe('packing', () => {
  it('gzips a life and marks it, and reads it back', async () => {
    const json = encode(kept(1));
    const packed = await pack(json);
    expect(packed.startsWith(PACKED)).toBe(true);
    expect(PACKED).toBe('slate.gz1:');
    expect(await unpack(packed)).toBe(json);
    const big = JSON.stringify({ text: 'a long life '.repeat(20_000) });
    const packedBig = await pack(big);
    expect(packedBig.length).toBeLessThan(big.length / 10);
    expect(await unpack(packedBig)).toBe(big);
  });
  it('reads a plain life as it is, and says a damaged packed one is damaged', async () => {
    expect(await unpack('{"a":1}')).toBe('{"a":1}');
    expect(await refusal(unpack(`${PACKED}not base64!`))).toEqual(['life.damaged', false]);
    expect(await refusal(unpack(`${PACKED}${btoa('not gzip')}`))).toEqual(['life.damaged', false]);
  });
  it('without compression in the browser, keeps it plain, and says a packed one can\'t be opened', async () => {
    const packed = await pack('{"a":1}');
    for (const name of ['CompressionStream', 'DecompressionStream']) {
      vi.stubGlobal(name, undefined);
      expect(await pack('{"a":1}')).toBe('{"a":1}');
      expect(await refusal(unpack(packed))).toEqual(['life.compressed', false]);
      vi.unstubAllGlobals();
    }
  });
});

describe('the key stores', () => {
  it('local storage: reads, writes and removes, and says when there is none', async () => {
    const mem = new MemoryStorage();
    const s = storageStore(() => mem);
    expect(await s.getItem('k')).toBeNull();
    await s.setItem('k', 'v');
    expect(await s.getItem('k')).toBe('v');
    await s.removeItem('k');
    expect(mem.map.size).toBe(0);
    const none = storageStore(() => undefined);
    for (const p of [none.getItem('k'), none.setItem('k', 'v'), none.removeItem('k')]) expect(await refusal(p)).toEqual(['life.no-storage', false]);
    vi.stubGlobal('localStorage', mem);
    await storageStore().setItem('g', '1');
    expect(mem.map.get('g')).toBe('1');
  });
  it('IndexedDB: reads, writes and removes, in this build\'s own database', async () => {
    const factory = new IDBFactory();
    const s = indexedStore(factory);
    expect(await s.getItem('k')).toBeNull();
    await s.setItem('k', 'v');
    expect(await s.getItem('k')).toBe('v');
    await s.setItem('k', 'w');
    expect(await indexedStore(factory).getItem('k')).toBe('w');
    await s.removeItem('k');
    expect(await s.getItem('k')).toBeNull();
    expect((await factory.databases()).map((d) => d.name)).toEqual([DB_NAME]);
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = factory.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
    });
    expect([...db.objectStoreNames]).toEqual(['lives']);
    db.close();
    expect(DB_NAME).toBe('slate-lives');
  });
  it('IndexedDB: a database that won\'t open is tried again', async () => {
    const real = new IDBFactory();
    let fail = true;
    const flaky = {
      open: (name: string, version: number) => {
        if (!fail) return real.open(name, version);
        fail = false;
        const req = { error: new DOMException('no', 'UnknownError') } as unknown as IDBOpenDBRequest;
        queueMicrotask(() => (req.onerror as () => void)());
        return req;
      },
    } as unknown as IDBFactory;
    const s = indexedStore(flaky);
    await expect(s.getItem('k')).rejects.toThrow('no');
    expect(await s.getItem('k')).toBeNull();
  });
  it('IndexedDB: a transaction that fails or is aborted rejects with its error', async () => {
    const make = (event: 'onerror' | 'onabort', txError: DOMException | null) => {
      const req = { error: new DOMException('req', 'DataError'), result: undefined } as unknown as IDBRequest;
      const tx = { error: txError, objectStore: () => ({ get: () => req, put: () => req, delete: () => req }) } as unknown as IDBTransaction;
      const db = { transaction: () => tx } as unknown as IDBDatabase;
      const open = { result: db } as unknown as IDBOpenDBRequest;
      const factory = { open: () => (queueMicrotask(() => (open.onsuccess as () => void)()), open) } as unknown as IDBFactory;
      const s = indexedStore(factory);
      return { s, fire: () => queueMicrotask(() => (tx[event] as () => void)()) };
    };
    for (const event of ['onerror', 'onabort'] as const) {
      const a = make(event, new DOMException('tx', 'AbortError'));
      const p = a.s.setItem('k', 'v');
      await Promise.resolve();
      a.fire();
      await expect(p).rejects.toThrow('tx');
      const b = make(event, null);
      const q = b.s.getItem('k');
      await Promise.resolve();
      b.fire();
      await expect(q).rejects.toThrow('req');
    }
  });
  it('the device\'s: local storage from the first time IndexedDB won\'t open, and only then', async () => {
    const real = new IDBFactory();
    let fails = 1;
    const flaky = {
      open: (name: string, version: number) => {
        if (fails === 0) return real.open(name, version);
        fails -= 1;
        const req = { error: new DOMException('no', 'UnknownError') } as unknown as IDBOpenDBRequest;
        queueMicrotask(() => (req.onerror as () => void)());
        return req;
      },
    } as unknown as IDBFactory;
    const mem = new MemoryStorage();
    const s = deviceStore(flaky, storageStore(() => mem));
    await s.setItem('k', 'v');
    // IndexedDB would open now, but this session stays where its lives went.
    await s.setItem('j', 'w');
    expect([mem.map.get('k'), mem.map.get('j'), await s.getItem('k')]).toEqual(['v', 'w', 'v']);
    await s.removeItem('k');
    expect(mem.map.has('k')).toBe(false);
    expect(await indexedStore(real).getItem('j')).toBeNull();
    // One that throws as it's asked refuses every time, and the device keeps its lives in local storage.
    const thrown = { open: () => { throw new DOMException('origin', 'SecurityError'); } } as unknown as IDBFactory;
    await expect(indexedStore(thrown).getItem('k')).rejects.toThrow('SecurityError: origin');
    const store = indexedStore(thrown);
    for (let i = 0; i < 2; i += 1) await expect(store.getItem('k')).rejects.toThrow('origin');
    await deviceStore(thrown, storageStore(() => mem)).setItem('t', '1');
    expect(mem.map.get('t')).toBe('1');
    // A request that fails once it's open isn't a database that won't open: it's refused, not sent elsewhere.
    const tx = { error: new DOMException('tx', 'AbortError'), objectStore: () => ({ put: () => ({}) }) } as unknown as IDBTransaction;
    const open = { result: { transaction: () => tx } } as unknown as IDBOpenDBRequest;
    const failing = { open: () => (queueMicrotask(() => (open.onsuccess as () => void)()), open) } as unknown as IDBFactory;
    const p = deviceStore(failing, storageStore(() => mem)).setItem('x', '1');
    await Promise.resolve();
    await Promise.resolve();
    queueMicrotask(() => (tx.onerror as () => void)());
    await expect(p).rejects.toThrow('tx');
    expect(mem.map.has('x')).toBe(false);
  });
  it('the device\'s: a life kept in local storage while IndexedDB wouldn\'t open is found once it does', async () => {
    const factory = new IDBFactory();
    const mem = new MemoryStorage();
    mem.map.set('k', 'from before');
    const s = deviceStore(factory, storageStore(() => mem));
    expect(await s.getItem('k')).toBe('from before');
    await s.setItem('k', 'now');
    expect(await s.getItem('k')).toBe('now');
    await s.removeItem('k');
    expect([await s.getItem('k'), mem.map.has('k')]).toEqual([null, false]);
    // Without local storage beside it, there's nothing there to find, and nothing to let go.
    const alone = deviceStore(factory, storageStore(() => undefined));
    await alone.setItem('a', '1');
    expect([await alone.getItem('a'), await alone.getItem('b')]).toEqual(['1', null]);
    await alone.removeItem('a');
    expect(await alone.getItem('a')).toBeNull();
  });
  it('the device\'s: IndexedDB where there is one, local storage otherwise', async () => {
    const factory = new IDBFactory();
    await deviceStore(factory).setItem('k', 'v');
    expect(await indexedStore(factory).getItem('k')).toBe('v');
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    await deviceStore(undefined).setItem('k', 'm');
    expect(mem.map.get('k')).toBe('m');
    vi.stubGlobal('indexedDB', factory);
    await deviceStore().setItem('d', '1');
    expect(await indexedStore(factory).getItem('d')).toBe('1');
  });
});

describe('lives kept on this device', () => {
  const setup = () => {
    const mem = new MemoryStorage();
    return { mem, store: new DeviceStore(storageStore(() => mem)) };
  };
  it('start with three empty places and no copies', async () => {
    const { store } = setup();
    expect(store.where).toBe('device');
    expect(await store.listSlots()).toEqual([1, 2, 3].map((slot) => ({ slot, occupied: false, hasBackup: false })));
    expect(await store.load(1)).toBeNull();
    expect(await store.restoreBackup(1)).toBeNull();
  });
  it('keep a life packed under its own key, and say what it holds without opening it', async () => {
    const { mem, store } = setup();
    const a = kept(2, { name: 'Zoë' });
    await store.save(a);
    const raw = mem.map.get('slate.life.2') as string;
    expect(raw.startsWith(PACKED)).toBe(true);
    expect(await store.load(2)).toEqual(a);
    const list = await store.listSlots();
    expect(list[1]).toEqual({ slot: 2, occupied: true, meta: a.meta, hasBackup: false, bytes: new TextEncoder().encode(raw).length });
    expect([list[0]?.occupied, list[2]?.occupied]).toEqual([false, false]);
  });
  it('keep a copy of what was there before each write', async () => {
    const { mem, store } = setup();
    await store.save(kept(1, { name: 'First' }));
    const first = mem.map.get('slate.life.1');
    await store.save(kept(1, { name: 'Second', now: T0 + 60 }));
    expect(mem.map.get('slate.copy.1')).toBe(first);
    // A damaged life is never made the copy.
    mem.map.set('slate.life.1', '{broken');
    await store.save(kept(1, { name: 'Third', now: T0 + 120 }));
    expect(mem.map.get('slate.copy.1')).toBe(first);
    expect((await store.listSlots())[0]).toMatchObject({ occupied: true, hasBackup: true, backupCard: { name: 'First' } });
  });
  it('leave the place as it was when a write fails, and say why', async () => {
    const { mem, store } = setup();
    await store.save(kept(1, { name: 'Kept' }));
    const before = new Map(mem.map);
    mem.quota = 10;
    expect(await refusal(store.save(kept(1, { name: 'Lost' })))).toEqual(['life.device-full', true]);
    expect(mem.map).toEqual(before);
    mem.quota = Infinity;
    const keys: KeyStore = { getItem: async (k) => mem.getItem(k), setItem: async () => { throw new Error('disk'); }, removeItem: async () => undefined };
    expect(await refusal(new DeviceStore(keys).save(kept(1)))).toEqual(['life.device-refused', true]);
    const firefox: KeyStore = { ...keys, setItem: async () => { throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED'); } };
    expect(await refusal(new DeviceStore(firefox).save(kept(1)))).toEqual(['life.device-full', true]);
    const other: KeyStore = { ...keys, setItem: async () => { throw new DOMException('x', 'InvalidStateError'); } };
    expect(await refusal(new DeviceStore(other).save(kept(1)))).toEqual(['life.device-refused', true]);
    expect((await store.load(1))?.meta.card).toEqual({ name: 'Kept' });
  });
  it('say when the storage itself can\'t be read', async () => {
    const { mem, store } = setup();
    mem.broken = true;
    expect(await store.listSlots()).toEqual([1, 2, 3].map((slot) => ({ slot, occupied: false, hasBackup: false, error: 'life.storage-unreadable' })));
    expect(await refusal(store.load(1))).toEqual(['life.storage-unreadable', true]);
    const none = new DeviceStore(storageStore(() => undefined));
    expect((await none.listSlots())[0]).toEqual({ slot: 1, occupied: false, hasBackup: false, error: 'life.no-storage' });
    // The copy failing to read is the storage failing too.
    const copyFails: KeyStore = { getItem: async (k) => { if (k.includes('copy')) throw new Error('x'); return null; }, setItem: async () => undefined, removeItem: async () => undefined };
    expect((await new DeviceStore(copyFails).listSlots())[0]).toEqual({ slot: 1, occupied: false, hasBackup: false, error: 'life.storage-unreadable' });
  });
  it('say a life that can\'t be read can\'t, and offer only a copy that can', async () => {
    const { mem, store } = setup();
    mem.map.set('slate.life.1', '{broken');
    mem.map.set('slate.life.2', '{"meta":{}}');
    mem.map.set('slate.copy.2', '{broken');
    mem.map.set('slate.copy.3', '{broken');
    await store.save(kept(1, { name: 'Copy' }));
    const list = await store.listSlots();
    expect(list[0]).toEqual({ slot: 1, occupied: true, meta: kept(1, { name: 'Copy' }).meta, hasBackup: false, bytes: expect.any(Number) as number });
    await store.save(kept(1, { name: 'Now', now: T0 + 1 }));
    mem.map.set('slate.life.1', '{broken');
    expect((await store.listSlots())[0]).toEqual({ slot: 1, occupied: true, hasBackup: true, backupCard: { name: 'Copy' }, bytes: 7, error: 'life.damaged' });
    expect(list[1]).toEqual({ slot: 2, occupied: true, hasBackup: false, bytes: 11, error: 'life.not-slate' });
    expect(list[2]).toEqual({ slot: 3, occupied: false, hasBackup: false });
    expect(await refusal(store.load(2))).toEqual(['life.not-slate', false]);
  });
  it('let a life go keeping it as the copy, but never write a damaged one over a good copy', async () => {
    const { mem, store } = setup();
    await store.save(kept(1, { name: 'Gone' }));
    const life = mem.map.get('slate.life.1');
    await store.remove(1);
    expect(mem.map.has('slate.life.1')).toBe(false);
    expect(mem.map.get('slate.copy.1')).toBe(life);
    mem.map.set('slate.life.1', '{broken');
    await store.remove(1);
    expect(mem.map.get('slate.copy.1')).toBe(life);
    expect(mem.map.has('slate.life.1')).toBe(false);
    await store.remove(2);
    expect(mem.map.size).toBe(1);
  });
  it('let a life go on a full device, its copy written into the room it left, or the copy before kept', async () => {
    const { mem, store } = setup();
    await store.save(kept(1, { name: 'Old' }));
    await store.save(kept(1, { name: 'Gone, with a name the copy before it lacks', now: T0 + 1 }));
    const [life, before] = [mem.map.get('slate.life.1') as string, mem.map.get('slate.copy.1') as string];
    expect(life.length).toBeGreaterThan(before.length);
    // Full: the life and its copy fill the device, and there's no room for a second copy of it.
    mem.capacity = life.length + before.length;
    await store.remove(1);
    expect([mem.map.has('slate.life.1'), mem.map.get('slate.copy.1')]).toEqual([false, life]);
    // Where even the room it leaves won't hold it, the life still goes, and the copy from before stays.
    mem.map.set('slate.life.1', life);
    mem.map.set('slate.copy.1', before);
    mem.capacity = life.length + before.length + 1;
    mem.quota = life.length - 1;
    await store.remove(1);
    expect([mem.map.has('slate.life.1'), mem.map.get('slate.copy.1')]).toEqual([false, before]);
    expect((await store.listSlots())[0]).toMatchObject({ occupied: false, hasBackup: true, backupCard: { name: 'Old' } });
    // Any other refusal leaves the life where it was, and says so.
    mem.map.set('slate.life.1', life);
    const refusing: KeyStore = { getItem: async (k) => mem.getItem(k), setItem: async () => { throw new DOMException('x', 'InvalidStateError'); }, removeItem: async (k) => mem.removeItem(k) };
    expect(await refusal(new DeviceStore(refusing).remove(1))).toEqual(['life.device-refused', true]);
    expect(mem.map.get('slate.life.1')).toBe(life);
    const stuck: KeyStore = { ...refusing, setItem: async (k, v) => mem.setItem(k, v), removeItem: async () => { throw new Error('disk'); } };
    mem.quota = Infinity;
    expect(await refusal(new DeviceStore(stuck).remove(1))).toEqual(['life.device-refused', true]);
    expect(mem.map.get('slate.life.1')).toBe(life);
  });
  it('bring the copy back as the life, the life it replaces becoming the copy', async () => {
    const { mem, store } = setup();
    await store.save(kept(3, { name: 'Old' }));
    await store.save(kept(3, { name: 'New', now: T0 + 1 }));
    const back = await store.restoreBackup(3);
    expect(back?.meta.card).toEqual({ name: 'Old' });
    expect((await store.load(3))?.meta.card).toEqual({ name: 'Old' });
    expect((await store.listSlots())[2]?.backupCard).toEqual({ name: 'New' });
    mem.map.set('slate.copy.3', '{broken');
    expect(await refusal(store.restoreBackup(3))).toEqual(['life.damaged', false]);
  });
  it('keep this build\'s lives apart from the first SLATE\'s saves', async () => {
    const { mem, store } = setup();
    mem.map.set('slate.save.1', 'the first SLATE');
    mem.map.set('slate.backup.1', 'the first SLATE');
    expect((await store.listSlots())[0]).toEqual({ slot: 1, occupied: false, hasBackup: false });
    await store.save(kept(1));
    await store.remove(1);
    expect([mem.map.get('slate.save.1'), mem.map.get('slate.backup.1')]).toEqual(['the first SLATE', 'the first SLATE']);
  });
  it('use the device\'s own store when given none', async () => {
    const factory = new IDBFactory();
    vi.stubGlobal('indexedDB', factory);
    await new DeviceStore().save(kept(1));
    expect((await indexedStore(factory).getItem('slate.life.1'))?.startsWith(PACKED)).toBe(true);
  });
});
