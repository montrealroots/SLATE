import { describe, expect, it, vi } from 'vitest';
import { PersistenceError, encode, type Kept } from '../../../src/core/persistence/contract.ts';
import { DeviceStore, storageStore } from '../../../src/core/persistence/local.ts';
import { ServerStore, isRetryable, resolveStore, type Functions, type Reply } from '../../../src/core/persistence/remote.ts';
import { clearSlot, loadUniverse, saveUniverse, type Answer, type Entity, type Receipt, type Row, type ServerClient } from '../../../src/core/persistence/server/functions.ts';
import { MAX_PAYLOAD_BYTES, Refusal, SUPPORTED_SCHEMA_VERSION, inspectPayload, requireForwardProgress, requireSlot } from '../../../src/core/persistence/server/guard.ts';
import { MemoryStorage, T0, kept } from './support.ts';

/** An entity in memory, as Base44 keeps one: rows with ids, filtered by equal fields. */
function entity<T extends { id: string }>(): Entity<T> & { rows: T[] } {
  const rows: T[] = [];
  let next = 0;
  return {
    rows,
    // A query goes to Base44 as JSON, so a field left undefined is no field at all.
    filter: async (query) => {
      const q = JSON.parse(JSON.stringify(query)) as Record<string, unknown>;
      return rows.filter((r) => Object.entries(q).every(([k, v]) => (r as Record<string, unknown>)[k] === v)).map((r) => structuredClone(r));
    },
    create: async (data) => {
      next += 1;
      const row = { ...structuredClone(data), id: `r${next}` } as T;
      rows.push(row);
      return structuredClone(row);
    },
    update: async (id, data) => {
      const row = rows.find((r) => r.id === id) as T;
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  };
}

function server(signedIn = true) {
  const saves = entity<Row>();
  const receipts = entity<Receipt>();
  const client: ServerClient = { auth: { me: async () => (signedIn ? { id: 'player' } : null) }, entities: { SlateSave: saves, SlateCommandReceipt: receipts } };
  const handlers: Record<string, (c: ServerClient, b: unknown) => Promise<Answer>> = { loadUniverse, saveUniverse, clearSlot };
  /** The SDK's invoke: the answer on `data`, or thrown with it on `response` for any status but 2xx. */
  const fn: Functions = {
    invoke: async (name, payload) => {
      const a = await (handlers[name] as (c: ServerClient, b: unknown) => Promise<Answer>)(client, structuredClone(payload));
      if (a.status !== 200) throw Object.assign(new Error(`status ${a.status}`), { response: { status: a.status, data: a.body } });
      return { data: a.body as Reply };
    },
  };
  const mem = new MemoryStorage();
  const mirror = new DeviceStore(storageStore(() => mem));
  return { client, saves, receipts, fn, mem, mirror, store: new ServerStore(fn, mirror) };
}

async function refusal(p: Promise<unknown>): Promise<[string, boolean]> {
  try {
    await p;
  } catch (e) {
    if (e instanceof PersistenceError) return [e.line, e.recoverable];
    throw e;
  }
  throw new Error('it was not refused');
}
const refused = (f: () => unknown): [string, number] => {
  try {
    f();
  } catch (e) {
    return [(e as Refusal).line, (e as Refusal).status];
  }
  return ['not refused', 0];
};

describe('the server\'s checks', () => {
  it('take one of the three places, as a number', () => {
    expect([1, 2, 3].map(requireSlot)).toEqual([1, 2, 3]);
    for (const bad of [0, 4, '1', 1.5, undefined, null]) expect(refused(() => requireSlot(bad))).toEqual(['server.bad-request', 400]);
  });
  it('read a life\'s size, shape, version and place before keeping it', () => {
    const text = encode(kept(2, { now: T0 + 5, playtime: 90, name: 'Zoë' }));
    expect(inspectPayload(text, 2)).toEqual({ lifeId: 'life-a', schemaVersion: 1, appVersion: '0.1.0', slot: 2, worldNow: T0 + 5, playtimeSeconds: 90, card: { name: 'Zoë' }, bytes: new TextEncoder().encode(text).length });
    expect(new TextEncoder().encode(text).length).toBeGreaterThan(text.length);
    for (const bad of [undefined, 3, '']) expect(refused(() => inspectPayload(bad, 1))).toEqual(['server.bad-request', 400]);
    expect(refused(() => inspectPayload(encode(kept(2)), 1))).toEqual(['server.bad-request', 400]);
    expect(refused(() => inspectPayload('{x', 1))).toEqual(['server.damaged', 400]);
    expect(MAX_PAYLOAD_BYTES).toBe(24 * 1024 * 1024);
    expect(refused(() => inspectPayload(`"${'é'.repeat(MAX_PAYLOAD_BYTES / 2)}"`, 1))).toEqual(['server.too-big', 413]);
    const at = `"${'a'.repeat(MAX_PAYLOAD_BYTES - 2)}"`;
    expect(refused(() => inspectPayload(at, 1))).toEqual(['server.damaged', 400]);
    const good = JSON.parse(encode(kept(1))) as { meta: Record<string, unknown>; life: { frame: Record<string, unknown> } };
    const variants: unknown[] = [null, [], {}, { meta: good.meta }, { ...good, meta: [] }, { ...good, life: [] }, { ...good, life: { frame: [] } }, { ...good, life: { frame: { ...good.life.frame, now: 1.5 } } }];
    for (const [k, v] of [['id', ''], ['id', 3], ['schemaVersion', 1.5], ['schemaVersion', '1'], ['appVersion', 1], ['playtimeSeconds', Infinity], ['playtimeSeconds', '1'], ['card', null], ['card', []], ['card', { a: 1 }], ['card', { a: 'x', b: 1 }]] as const) {
      variants.push({ ...good, meta: { ...good.meta, [k]: v } });
    }
    for (const v of variants) expect(refused(() => inspectPayload(JSON.stringify(v), 1))).toEqual(['server.damaged', 400]);
    expect(SUPPORTED_SCHEMA_VERSION).toBe(1);
    expect(refused(() => inspectPayload(encode(kept(1, { schemaVersion: 2 })), 1))).toEqual(['server.newer', 409]);
  });
  it('let a life go forward only, and only in a place that holds it or nothing', () => {
    const at = (now: number, playtime: number, id = 'life-a') => inspectPayload(encode(kept(1, { id, now, playtime })), 1);
    const held = { life_id: 'life-a', world_now: T0 + 100, playtime_seconds: 100 };
    expect(() => requireForwardProgress(undefined, at(T0, 0))).not.toThrow();
    expect(() => requireForwardProgress({ ...held, life_id: '' }, at(T0, 0, 'life-b'))).not.toThrow();
    expect(() => requireForwardProgress(held, at(T0 + 100, 99))).not.toThrow();
    expect(refused(() => requireForwardProgress(held, at(T0 + 100, 100, 'life-b')))).toEqual(['server.other-life', 409]);
    expect(refused(() => requireForwardProgress(held, at(T0 + 99, 200)))).toEqual(['server.behind', 409]);
    expect(refused(() => requireForwardProgress(held, at(T0 + 200, 98.9)))).toEqual(['server.behind', 409]);
  });
});

describe('the backend functions', () => {
  it('answer only a player who is signed in', async () => {
    const { client } = server(false);
    for (const f of [loadUniverse, saveUniverse, clearSlot]) expect(await f(client, {})).toEqual({ status: 401, body: { ok: false, status: 401, error: 'server.signed-out' } });
  });
  it('say they couldn\'t finish when something unforeseen fails', async () => {
    const { client, saves } = server();
    saves.filter = () => Promise.reject(new Error('database down'));
    expect(await loadUniverse(client, {})).toEqual({ status: 500, body: { ok: false, status: 500, error: 'server.failed' } });
  });
  it('keep a life, then say what each place holds, and give it back', async () => {
    const { client } = server();
    const k = kept(2, { name: 'Zoë' });
    const payload = encode(k);
    expect(await saveUniverse(client, { slot: 2, payload })).toEqual({ status: 200, body: { ok: true, slot: 2, bytes: new TextEncoder().encode(payload).length } });
    const list = await loadUniverse(client, null);
    expect(list.body).toEqual({ ok: true, slots: [
      { slot: 1, occupied: false, hasBackup: false },
      { slot: 2, occupied: true, hasBackup: false, meta: k.meta, bytes: new TextEncoder().encode(payload).length },
      { slot: 3, occupied: false, hasBackup: false },
    ] });
    expect((await loadUniverse(client, { slot: 2 })).body).toEqual({ ok: true, slot: 2, payload });
    expect((await loadUniverse(client, { slot: 1 })).body).toEqual({ ok: true, slot: 1, payload: null });
    expect((await loadUniverse(client, { slot: 9 })).body).toEqual({ ok: false, status: 400, error: 'server.bad-request' });
    expect((await saveUniverse(client, 'nonsense')).body).toEqual({ ok: false, status: 400, error: 'server.bad-request' });
  });
  it('keep what was there as the copy, and bring the copy back by swapping the two', async () => {
    const { client, saves } = server();
    await saveUniverse(client, { slot: 1, payload: encode(kept(1, { name: 'One' })) });
    await saveUniverse(client, { slot: 1, payload: encode(kept(1, { name: 'Two', now: T0 + 1 })) });
    expect(saves.rows[0]).toMatchObject({ card: { name: 'Two' }, backup_card: { name: 'One' }, world_now: T0 + 1 });
    const back = await saveUniverse(client, { slot: 1, restore: true });
    expect(back.body).toEqual({ ok: true, slot: 1, payload: encode(kept(1, { name: 'One' })) });
    expect(saves.rows[0]).toMatchObject({ card: { name: 'One' }, backup_card: { name: 'Two' }, world_now: T0 });
    await saveUniverse(client, { slot: 1, restore: true });
    expect(saves.rows[0]).toMatchObject({ card: { name: 'Two' }, backup_card: { name: 'One' } });
    expect((await saveUniverse(client, { slot: 2, restore: true })).body).toEqual({ ok: false, status: 404, error: 'server.no-copy' });
    await saveUniverse(client, { slot: 3, payload: encode(kept(3)) });
    expect((await saveUniverse(client, { slot: 3, restore: true })).body).toEqual({ ok: false, status: 404, error: 'server.no-copy' });
  });
  it('write a retried request once', async () => {
    const { client, saves, receipts } = server();
    const body = { slot: 1, payload: encode(kept(1)), idempotencyKey: 'life-a:1' };
    const first = await saveUniverse(client, body);
    saves.rows[0] = { ...(saves.rows[0] as Row), card: { name: 'Changed since' } };
    expect((await saveUniverse(client, body)).body).toEqual({ ...first.body, replayed: true });
    expect(saves.rows[0]?.card).toEqual({ name: 'Changed since' });
    expect(receipts.rows).toHaveLength(1);
    // With no key, or an empty one, each write is its own.
    await saveUniverse(client, { ...body, idempotencyKey: '' });
    await saveUniverse(client, { slot: 1, payload: body.payload, idempotencyKey: 7 });
    expect(receipts.rows).toHaveLength(1);
    expect(saves.rows[0]?.card).toEqual({ name: 'Ada' });
    // A key is the life's own: another life's same key is another write.
    await clearSlot(client, { slot: 1 });
    expect((await saveUniverse(client, { ...body, payload: encode(kept(1, { id: 'life-b' })) })).body).toEqual({ ok: true, slot: 1, bytes: expect.any(Number) as number });
  });
  it('refuse a stale write, and another life where one is kept', async () => {
    const { client } = server();
    await saveUniverse(client, { slot: 1, payload: encode(kept(1, { now: T0 + 10 })) });
    expect((await saveUniverse(client, { slot: 1, payload: encode(kept(1, { now: T0 })) })).body).toEqual({ ok: false, status: 409, error: 'server.behind' });
    expect((await saveUniverse(client, { slot: 1, payload: encode(kept(1, { id: 'life-b', now: T0 + 20 })) })).body).toEqual({ ok: false, status: 409, error: 'server.other-life' });
  });
  it('let a life go as the copy, freeing its place for a new one', async () => {
    const { client, saves } = server();
    expect((await clearSlot(client, { slot: 1 })).body).toEqual({ ok: true, slot: 1, cleared: false });
    await saveUniverse(client, { slot: 1, payload: encode(kept(1, { name: 'Gone', now: T0 + 50, playtime: 500 })) });
    expect((await clearSlot(client, { slot: 1 })).body).toEqual({ ok: true, slot: 1, cleared: true });
    expect(saves.rows[0]).toMatchObject({ payload: '', life_id: '', world_now: 0, playtime_seconds: 0, payload_bytes: 0, card: {}, backup_card: { name: 'Gone' } });
    expect((await clearSlot(client, { slot: 1 })).body).toEqual({ ok: true, slot: 1, cleared: false });
    expect(((await loadUniverse(client, {})).body as unknown as { slots: unknown[] }).slots[0]).toEqual({ slot: 1, occupied: false, hasBackup: true, backupCard: { name: 'Gone' } });
    expect((await loadUniverse(client, { slot: 1 })).body).toEqual({ ok: true, slot: 1, payload: null });
    // A new life starts there, earlier and newer to the server alike, and the copy of the one let go stays.
    await saveUniverse(client, { slot: 1, payload: encode(kept(1, { id: 'life-b', name: 'New', playtime: 1 })) });
    expect(saves.rows[0]).toMatchObject({ life_id: 'life-b', card: { name: 'New' }, backup_card: { name: 'Gone' } });
    // Bringing the copy back over an empty place leaves no copy behind.
    await clearSlot(client, { slot: 1 });
    await saveUniverse(client, { slot: 1, restore: true });
    expect(saves.rows[0]).toMatchObject({ life_id: 'life-b', backup_payload: '', backup_card: null });
    expect(((await loadUniverse(client, {})).body as unknown as { slots: unknown[] }).slots[0]).toMatchObject({ occupied: true, hasBackup: false });
    expect((await clearSlot(client, { slot: 'x' })).body).toEqual({ ok: false, status: 400, error: 'server.bad-request' });
    // Each place is let go of alone.
    await saveUniverse(client, { slot: 2, payload: encode(kept(2, { id: 'life-c', name: 'Two' })) });
    await clearSlot(client, { slot: 2 });
    expect(saves.rows.map((r) => [r.slot, r.life_id])).toEqual([[1, 'life-b'], [2, '']]);
  });
  it('list a copy with no card of its own as a copy still', async () => {
    const { client, saves } = server();
    await saveUniverse(client, { slot: 1, payload: encode(kept(1)) });
    saves.rows[0] = { ...(saves.rows[0] as Row), backup_payload: encode(kept(1)), backup_card: null };
    expect(((await loadUniverse(client, {})).body as unknown as { slots: unknown[] }).slots[0]).toMatchObject({ hasBackup: true, backupCard: {} });
  });
});

describe('lives kept on the server', () => {
  it('are listed, opened, kept, let go of and brought back through the functions, mirrored on the device', async () => {
    const { store, mirror, mem } = server();
    expect(store.where).toBe('server');
    expect(await store.listSlots()).toEqual([1, 2, 3].map((slot) => ({ slot, occupied: false, hasBackup: false })));
    const one = kept(1, { name: 'One' });
    await store.save(one);
    await store.save(kept(1, { name: 'Two', now: T0 + 1 }));
    expect(await store.load(1)).toEqual(kept(1, { name: 'Two', now: T0 + 1 }));
    expect(await store.load(2)).toBeNull();
    expect((await store.listSlots())[0]).toEqual({ slot: 1, occupied: true, meta: kept(1, { name: 'Two' }).meta, hasBackup: true, backupCard: { name: 'One' }, bytes: expect.any(Number) as number });
    expect((await mirror.load(1))?.meta.card).toEqual({ name: 'Two' });
    expect(await store.restoreBackup(1)).toEqual(one);
    expect((await mirror.load(1))?.meta.card).toEqual({ name: 'One' });
    await store.remove(1);
    expect(mem.map.has('slate.life.1')).toBe(false);
    expect((await store.listSlots())[0]).toEqual({ slot: 1, occupied: false, hasBackup: true, backupCard: { name: 'One' } });
  });
  it('keep the device\'s mirror even when the server refuses, and say the server\'s own reason', async () => {
    const { store, mirror } = server();
    await store.save(kept(1, { now: T0 + 10 }));
    expect(await refusal(store.save(kept(1, { now: T0, name: 'Stale' })))).toEqual(['server.behind', true]);
    expect((await mirror.load(1))?.meta.card).toEqual({ name: 'Stale' });
    expect(await refusal(store.restoreBackup(2))).toEqual(['server.no-copy', false]);
    const out = server(false);
    expect(await refusal(out.store.listSlots())).toEqual(['server.signed-out', false]);
  });
  it('a mirror that fails doesn\'t fail the write', async () => {
    const { fn } = server();
    const failing = { where: 'device', listSlots: vi.fn(), load: vi.fn(), save: () => Promise.reject(new Error('x')), remove: () => Promise.reject(new Error('x')), restoreBackup: vi.fn() } as unknown as DeviceStore;
    const store = new ServerStore(fn, failing);
    await store.save(kept(1));
    await store.save(kept(1, { now: T0 + 1 }));
    await expect(store.restoreBackup(1)).resolves.toEqual(kept(1));
    await expect(store.remove(1)).resolves.toBeUndefined();
  });
  it('say plainly when the server can\'t be reached, doesn\'t answer, or turns something down', async () => {
    const via = (invoke: Functions['invoke']) => new ServerStore({ invoke }, new DeviceStore(storageStore(() => new MemoryStorage())));
    expect(await refusal(via(() => Promise.reject(new Error('offline'))).listSlots())).toEqual(['server.unreachable', true]);
    expect(await refusal(via(() => Promise.reject(undefined)).listSlots())).toEqual(['server.unreachable', true]);
    expect(await refusal(via(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 500 } }))).listSlots())).toEqual(['server.unreachable', true]);
    expect(await refusal(via(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 400, data: { ok: false, error: 'something else' } } }))).listSlots())).toEqual(['server.refused', false]);
    expect(await refusal(via(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 503, data: { ok: false, error: 'server.failed' } } }))).listSlots())).toEqual(['server.failed', true]);
    expect(await refusal(via(() => Promise.reject(Object.assign(new Error('x'), { response: { status: 503, data: { ok: false, status: 400, error: 'server.failed' } } }))).listSlots())).toEqual(['server.failed', false]);
    expect(await refusal(via(async () => ({})).listSlots())).toEqual(['server.no-answer', true]);
    expect(await refusal(via(async () => ({ data: { ok: false } })).listSlots())).toEqual(['server.refused', true]);
    expect(await refusal(via(async () => ({ data: { ok: false, status: 404, error: 'nonsense' } })).listSlots())).toEqual(['server.refused', false]);
    expect(await refusal(via(async () => ({ data: { ok: false, status: 409, error: 'server.behind' } })).listSlots())).toEqual(['server.behind', true]);
    expect(await via(async () => ({ data: { ok: true } })).listSlots()).toEqual([1, 2, 3].map((slot) => ({ slot, occupied: false, hasBackup: false })));
    expect(await via(async () => ({ data: { ok: true, slots: [{ slot: 1, occupied: true, hasBackup: true }] } })).listSlots()).toEqual([{ slot: 1, occupied: false, hasBackup: true, backupCard: {} }, { slot: 2, occupied: false, hasBackup: false }, { slot: 3, occupied: false, hasBackup: false }]);
    const k: Kept = kept(2);
    expect((await via(async () => ({ data: { ok: true, slots: [{ slot: 2, occupied: true, hasBackup: false, meta: k.meta }] } })).listSlots())[1]).toStrictEqual({ slot: 2, occupied: true, meta: k.meta, hasBackup: false });
    expect(await via(async () => ({ data: { ok: true, payload: null } })).restoreBackup(1)).toBeNull();
  });
  it('sends each write with a key made of the life and the moment it reached', async () => {
    const sent: Record<string, unknown>[] = [];
    const store = new ServerStore({ invoke: async (_n, p) => (sent.push(p), { data: { ok: true } }) }, new DeviceStore(storageStore(() => new MemoryStorage())));
    await store.save(kept(3, { now: T0 + 7, playtime: 12.6 }));
    expect(sent[0]).toEqual({ slot: 3, payload: encode(kept(3, { now: T0 + 7, playtime: 12.6 })), idempotencyKey: `life-a:${T0 + 7}:13:1` });
  });
  it('a failure is retried only where it may pass', () => {
    expect([undefined, 500, 503, 409, 429].every(isRetryable)).toBe(true);
    expect([400, 401, 404, 413, 499].some(isRetryable)).toBe(false);
  });
});

describe('where lives are kept', () => {
  it('on the server where the deployment injects its client, on this device otherwise', () => {
    expect(resolveStore({ functions: { invoke: async () => ({}) } }).where).toBe('server');
    for (const none of [undefined, null, {}, { functions: {} }, { functions: { invoke: 'x' } }]) expect(resolveStore(none).where).toBe('device');
    vi.stubGlobal('base44', { functions: { invoke: async () => ({}) } });
    expect(resolveStore().where).toBe('server');
    vi.unstubAllGlobals();
    expect(resolveStore().where).toBe('device');
  });
});
