/**
 * The server's checks on a life it's asked to keep (KEEP entry 1). They run where the player can't reach them, so the
 * browser is never the authority on what a kept life may be, and they check only what can be checked cheaply and
 * without the simulation: the shape, the size, the version, the place it was sent to, and that time hasn't gone
 * backwards. They aren't a re-simulation: they stop a damaged or stale write landing, and a retry landing twice.
 *
 * The server runs this file on its own, apart from the app, so it imports nothing from it: the version it reads is
 * pinned here a second time, and a test holds it equal to the app's (SCHEMA_VERSION in ../version.ts).
 */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** A life larger than this is refused rather than cut short. */
export const MAX_PAYLOAD_BYTES = 24 * 1024 * 1024;

/** A refusal: the line of the app's catalog the player is shown, and the HTTP status it goes with. */
export class Refusal extends Error {
  constructor(
    readonly line: string,
    readonly status: number,
  ) {
    super(line);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One of the three places a life can be kept, as a whole number. */
export function requireSlot(value: unknown): number {
  // includes() tells a number from its text: "1" is no place.
  if (![1, 2, 3].includes(value as number)) throw new Refusal('server.bad-request', 400);
  return value as number;
}

export interface Inspected {
  lifeId: string;
  schemaVersion: number;
  appVersion: string;
  slot: number;
  /** The moment the life has reached. */
  worldNow: number;
  playtimeSeconds: number;
  card: Record<string, string>;
  /** Its size as sent, in UTF-8 bytes. */
  bytes: number;
}

/** A kept life's text, read and checked, for the place it was sent to. */
export function inspectPayload(payload: unknown, slot: number): Inspected {
  if (typeof payload !== 'string' || payload === '') throw new Refusal('server.bad-request', 400);
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > MAX_PAYLOAD_BYTES) throw new Refusal('server.too-big', 413);
  let kept: unknown;
  try {
    kept = JSON.parse(payload);
  } catch {
    // Text that isn't JSON is no life: it's refused below, as damaged.
  }
  const meta = isRecord(kept) ? kept['meta'] : undefined;
  const life = isRecord(kept) ? kept['life'] : undefined;
  const frame = isRecord(life) ? life['frame'] : undefined;
  const ok =
    isRecord(meta) &&
    typeof meta['id'] === 'string' &&
    meta['id'] !== '' &&
    Number.isSafeInteger(meta['schemaVersion']) &&
    typeof meta['appVersion'] === 'string' &&
    Number.isFinite(meta['playtimeSeconds']) &&
    isRecord(meta['card']) &&
    Object.values(meta['card']).every((v) => typeof v === 'string') &&
    isRecord(frame) &&
    Number.isSafeInteger(frame['now']);
  if (!ok) throw new Refusal('server.damaged', 400);
  const m = meta as Record<string, unknown>;
  if ((m['schemaVersion'] as number) > SUPPORTED_SCHEMA_VERSION) throw new Refusal('server.newer', 409);
  if (m['slot'] !== slot) throw new Refusal('server.bad-request', 400);
  return {
    lifeId: m['id'] as string,
    schemaVersion: m['schemaVersion'] as number,
    appVersion: m['appVersion'] as string,
    slot,
    worldNow: (frame as Record<string, unknown>)['now'] as number,
    playtimeSeconds: m['playtimeSeconds'] as number,
    card: m['card'] as Record<string, string>,
    bytes,
  };
}

/** What the server keeps of the life a place holds now, to check a new write against. */
export interface Held {
  life_id: string;
  world_now: number;
  playtime_seconds: number;
}

/**
 * A life doesn't travel backwards: its clock only runs forward and its playtime only grows, so a write that says
 * otherwise is a stale tab finishing late or a replayed request, and it doesn't overwrite newer progress. A place that
 * holds another life is let go of before a new one starts there. (Playtime is allowed a second's rounding.)
 */
export function requireForwardProgress(held: Held | undefined, incoming: Inspected): void {
  if (held === undefined || held.life_id === '') return;
  if (held.life_id !== incoming.lifeId) throw new Refusal('server.other-life', 409);
  if (incoming.worldNow < held.world_now || incoming.playtimeSeconds + 1 < held.playtime_seconds) throw new Refusal('server.behind', 409);
}
