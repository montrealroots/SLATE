/**
 * SLATE — Persistence.
 *
 * The engine does not care where a save lives. It hands a plain universe object
 * to an adapter and gets one back. That is what lets SLATE run standalone in a
 * browser and server-authoritatively on Base44 without the simulation knowing.
 */

import type { SaveMeta, SaveUniverse } from '../domain/model';

export type Slot = 1 | 2 | 3;

export interface SaveSlotInfo {
  slot: Slot;
  occupied: boolean;
  meta?: SaveMeta;
  /** Set when the stored save could not be read. */
  error?: string;
  hasBackup: boolean;
  /**
   * The world date the backup sits at, when it is known. Restoring is a step
   * backwards, and a player cannot weigh it without knowing how far back.
   */
  backupDateLabel?: string;
  /** Approximate stored size in bytes. */
  bytes?: number;
}

export interface SaveAdapter {
  readonly name: string;
  /** True when writes are authoritative on a server rather than the client. */
  readonly serverAuthoritative: boolean;
  listSlots(): Promise<SaveSlotInfo[]>;
  load(slot: Slot): Promise<SaveUniverse | null>;
  save(universe: SaveUniverse): Promise<void>;
  remove(slot: Slot): Promise<void>;
  backup(slot: Slot): Promise<boolean>;
  restoreBackup(slot: Slot): Promise<SaveUniverse | null>;
}

export class PersistenceError extends Error {
  constructor(message: string, readonly recoverable: boolean) {
    super(message);
    this.name = 'PersistenceError';
  }
}

/** Serialises without throwing on unexpected cycles. */
export function serialise(universe: SaveUniverse): string {
  return JSON.stringify(universe);
}

export function deserialise(raw: string): SaveUniverse {
  // JSON.parse's own message is a parser's message — "Unexpected token 'h', ...
  // is not valid JSON" — and it used to reach the player through the slot
  // card. What they can do about a corrupt save does not depend on which byte
  // broke it, so they are told the thing that is true and actionable instead.
  let parsed: SaveUniverse;
  try {
    parsed = JSON.parse(raw) as SaveUniverse;
  } catch {
    throw new PersistenceError('That save file is damaged and can’t be read.', false);
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.meta) {
    throw new PersistenceError('That file isn’t a SLATE save.', false);
  }
  return parsed;
}
