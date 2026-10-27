import type { Life } from '../frame/frame.ts';
import type { LineId } from '../text/text.ts';
import { SCHEMA_VERSION } from './version.ts';

/**
 * Where lives are kept, as one contract (KEEP entry 1): the simulation hands a kept life to a store and gets one back,
 * and never knows whether the store is this device or the server.
 */
export type Slot = 1 | 2 | 3;
export const SLOTS: readonly Slot[] = [1, 2, 3];

/**
 * What the slots screen reads of a kept life without opening it. `card` is the life's own words for its card (its
 * name, where it is, the day, its worth), written by the layers that know them each time the life is kept.
 */
export interface Meta {
  /** The life's own id, the same every time it's kept. */
  id: string;
  slot: Slot;
  schemaVersion: number;
  /** The build that kept it. */
  appVersion: string;
  playtimeSeconds: number;
  card: Record<string, string>;
}

export interface Kept {
  meta: Meta;
  life: Life;
}

export interface SlotInfo {
  slot: Slot;
  occupied: boolean;
  meta?: Meta;
  /** Why the life there can't be read, as a line the player is shown. */
  error?: LineId;
  /** Only a copy that can be read is a copy. */
  hasBackup: boolean;
  /** The card of the copy, so the player knows how far back it goes. */
  backupCard?: Record<string, string>;
  /** The size it's kept at, in bytes. */
  bytes?: number;
}

export interface Store {
  /** Where the lives are: on this device, or on the server, which checks each one. */
  readonly where: 'device' | 'server';
  listSlots(): Promise<SlotInfo[]>;
  load(slot: Slot): Promise<Kept | null>;
  save(kept: Kept): Promise<void>;
  remove(slot: Slot): Promise<void>;
  restoreBackup(slot: Slot): Promise<Kept | null>;
}

/** A failure the player is told about, in a line of the catalog; `recoverable` when trying again may work. */
export class PersistenceError extends Error {
  constructor(
    readonly line: LineId,
    readonly recoverable: boolean,
  ) {
    super(line);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const encode = (kept: Kept): string => JSON.stringify(kept);

/**
 * A kept life read back. What the player hears about a file that won't read doesn't depend on which byte broke it, so
 * the parser's own words never reach them: the file is damaged, or it isn't a SLATE life.
 */
export function decode(raw: string): Kept {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PersistenceError('life.damaged', false);
  }
  const meta = isRecord(parsed) ? parsed['meta'] : undefined;
  const life = isRecord(parsed) ? parsed['life'] : undefined;
  const ok =
    isRecord(meta) &&
    typeof meta['id'] === 'string' &&
    meta['id'] !== '' &&
    SLOTS.includes(meta['slot'] as Slot) &&
    Number.isSafeInteger(meta['schemaVersion']) &&
    (meta['schemaVersion'] as number) >= 1 &&
    typeof meta['appVersion'] === 'string' &&
    typeof meta['playtimeSeconds'] === 'number' &&
    isRecord(meta['card']) &&
    Object.values(meta['card']).every((v) => typeof v === 'string') &&
    isRecord(life) &&
    isRecord(life['frame']) &&
    isRecord(life['slices']);
  if (!ok) throw new PersistenceError('life.not-slate', false);
  return parsed as Kept;
}

/**
 * Whether a kept life is from a newer build, which won't open it (so it stays safe). The first shape is the only one so
 * far, so nothing is older; bringing an older life forward arrives with the second.
 */
export const isNewer = (meta: Meta): boolean => meta.schemaVersion > SCHEMA_VERSION;
