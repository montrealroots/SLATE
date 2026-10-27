import { Refusal, inspectPayload, requireForwardProgress, requireSlot, type Inspected } from './guard.ts';

/**
 * The three backend functions the server store calls (KEEP entry 1), written against the slice of the Base44 SDK they
 * use, so they run the same in a test as on the server: `loadUniverse` (no place: what all three hold; a place: the
 * life there), `saveUniverse` (a write, or with `restore` the copy brought back), and `clearSlot` (a life let go,
 * kept as the copy). The server's row-level security scopes every row to the signed-in player, so naming another
 * player's place reaches nothing. Each answers `{ ok: true, ... }` or `{ ok: false, status, error }`, the error a line
 * of the app's catalog.
 */

/** One place's row: the life, what the slots screen reads of it, and the copy kept before the last write. */
export interface Row {
  id: string;
  slot: number;
  life_id: string;
  payload: string;
  schema_version: number;
  app_version: string;
  world_now: number;
  playtime_seconds: number;
  card: Record<string, string>;
  payload_bytes: number;
  backup_payload: string;
  backup_card: Record<string, string> | null;
}

/** A write already made, by the key the browser sent with it, so a retry lands once. */
export interface Receipt {
  id: string;
  life_id: string;
  idempotency_key: string;
  result: Record<string, unknown>;
}

export interface Entity<T> {
  filter(query: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
}

export interface ServerClient {
  auth: { me(): Promise<{ id: string } | null> };
  entities: { SlateSave: Entity<Row>; SlateCommandReceipt: Entity<Receipt> };
}

export interface Answer {
  status: number;
  body: { ok: true; [k: string]: unknown } | { ok: false; status: number; error: string };
}

const ok = (body: Record<string, unknown>): Answer => ({ status: 200, body: { ok: true, ...body } });

/** Signs the caller in, runs the function, and turns a refusal (or anything unforeseen) into its answer. */
async function answer(client: ServerClient, run: () => Promise<Answer>): Promise<Answer> {
  try {
    if ((await client.auth.me()) === null) throw new Refusal('server.signed-out', 401);
    return await run();
  } catch (e) {
    const [line, status] = e instanceof Refusal ? [e.line, e.status] : ['server.failed', 500];
    return { status, body: { ok: false, status, error: line } };
  }
}

/** The request's fields; anything but an object has none of the ones asked for, so reads as an empty request. */
const bodyOf = (body: unknown) => (body ?? {}) as Record<string, unknown>;

/** The row a checked life is kept as. */
const rowOf = (slot: number, payload: string, i: Inspected): Omit<Row, 'id' | 'backup_payload' | 'backup_card'> => ({
  slot,
  life_id: i.lifeId,
  payload,
  schema_version: i.schemaVersion,
  app_version: i.appVersion,
  world_now: i.worldNow,
  playtime_seconds: i.playtimeSeconds,
  card: i.card,
  payload_bytes: i.bytes,
});

export function loadUniverse(client: ServerClient, raw: unknown): Promise<Answer> {
  return answer(client, async () => {
    const body = bodyOf(raw);
    if (body['slot'] === undefined) {
      const rows = await client.entities.SlateSave.filter({});
      return ok({
        slots: [1, 2, 3].map((slot) => {
          const row = rows.find((r) => r.slot === slot);
          const copy = row?.backup_payload ? { hasBackup: true, backupCard: row.backup_card ?? {} } : { hasBackup: false };
          if (row === undefined || row.payload === '') return { slot, occupied: false, ...copy };
          return {
            slot,
            occupied: true,
            ...copy,
            meta: { id: row.life_id, slot, schemaVersion: row.schema_version, appVersion: row.app_version, playtimeSeconds: row.playtime_seconds, card: row.card },
            bytes: row.payload_bytes,
          };
        }),
      });
    }
    const slot = requireSlot(body['slot']);
    const [row] = await client.entities.SlateSave.filter({ slot });
    return ok({ slot, payload: row?.payload || null });
  });
}

export function saveUniverse(client: ServerClient, raw: unknown): Promise<Answer> {
  return answer(client, async () => {
    const body = bodyOf(raw);
    const slot = requireSlot(body['slot']);
    const saves = client.entities.SlateSave;
    const [existing] = await saves.filter({ slot });

    // Bringing back the copy swaps it and the life, so bringing it back can itself be undone.
    if (body['restore'] === true) {
      if (!existing?.backup_payload) throw new Refusal('server.no-copy', 404);
      const restored = inspectPayload(existing.backup_payload, slot);
      await saves.update(existing.id, { ...rowOf(slot, existing.backup_payload, restored), backup_payload: existing.payload, backup_card: existing.payload === '' ? null : existing.card });
      return ok({ slot, payload: existing.backup_payload });
    }

    const incoming = inspectPayload(body['payload'], slot);
    const key = typeof body['idempotencyKey'] === 'string' && body['idempotencyKey'] !== '' ? body['idempotencyKey'] : undefined;
    if (key !== undefined) {
      const [receipt] = await client.entities.SlateCommandReceipt.filter({ life_id: incoming.lifeId, idempotency_key: key });
      if (receipt !== undefined) return ok({ replayed: true, ...receipt.result });
    }
    requireForwardProgress(existing, incoming);
    const row = rowOf(slot, body['payload'] as string, incoming);
    // What was there is kept as the copy, so a bad write can always be undone; a place already let go keeps its copy.
    if (existing === undefined) await saves.create({ ...row, backup_payload: '', backup_card: null });
    else if (existing.payload === '') await saves.update(existing.id, row);
    else await saves.update(existing.id, { ...row, backup_payload: existing.payload, backup_card: existing.card });
    const result = { slot, bytes: incoming.bytes };
    if (key !== undefined) await client.entities.SlateCommandReceipt.create({ life_id: incoming.lifeId, idempotency_key: key, result });
    return ok(result);
  });
}

/**
 * Letting a life go isn't destroying it: it's moved aside as the copy, and the place is released (its life, its clock
 * and its playtime cleared) so the next life started there isn't refused for being behind the one let go.
 */
export function clearSlot(client: ServerClient, raw: unknown): Promise<Answer> {
  return answer(client, async () => {
    const slot = requireSlot(bodyOf(raw)['slot']);
    const [row] = await client.entities.SlateSave.filter({ slot });
    if (row === undefined || row.payload === '') return ok({ slot, cleared: false });
    await client.entities.SlateSave.update(row.id, { backup_payload: row.payload, backup_card: row.card, payload: '', life_id: '', world_now: 0, playtime_seconds: 0, payload_bytes: 0, card: {} });
    return ok({ slot, cleared: true });
  });
}
