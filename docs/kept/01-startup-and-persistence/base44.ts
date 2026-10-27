/**
 * SLATE — Base44 persistence.
 *
 * Critical state is written through Base44 entities so the server, not the
 * browser, is the authority on what a save contains. The adapter degrades to
 * local storage when the SDK is not present, so development and offline play
 * still work.
 *
 * Row-level security is expressed in the entity schemas under /entities. This
 * adapter always scopes reads and writes by the authenticated user and by slot,
 * which is what keeps one player's universe out of another's.
 */

import type { SaveUniverse } from '../domain/model';
import { deserialise, serialise, PersistenceError, type SaveAdapter, type SaveSlotInfo, type Slot } from './adapter';
import { LocalSaveAdapter } from './local';

/** The shape SLATE needs from the Base44 SDK. Kept minimal on purpose. */
interface Base44Entity<T> {
  filter(query: Record<string, unknown>): Promise<T[]>;
  create(data: Record<string, unknown>): Promise<T>;
  update(id: string, data: Record<string, unknown>): Promise<T>;
  delete(id: string): Promise<void>;
}

/**
 * Backend functions are called by name through `invoke`, not as properties.
 * It resolves with the raw HTTP response — the function's JSON is on `.data` —
 * and it throws on any non-2xx, with the body on `error.response.data`.
 */
interface Base44Functions {
  invoke(name: string, payload?: Record<string, unknown>): Promise<{ data?: FunctionReply }>;
}

export interface FunctionReply {
  ok: boolean;
  error?: string;
  status?: number;
  payload?: string | null;
  saveId?: string;
  schemaVersion?: number;
  backupAvailable?: boolean;
  cleared?: boolean;
  recoverable?: boolean;
  slots?: {
    slot: number; occupied: boolean; hasBackup: boolean; saveId?: string;
    schemaVersion?: number; characterName?: string; careerLabel?: string;
    locationLabel?: string; worldDateLabel?: string; netWorthLabel?: string;
    playtimeSeconds?: number; bytes?: number; backupDateLabel?: string;
  }[];
}

export interface Base44Client {
  entities: {
    SlateSave: Base44Entity<SaveRecord>;
  };
  auth?: { me(): Promise<{ id: string; email?: string }> };
  functions?: Base44Functions;
}

interface SaveRecord {
  id: string;
  slot: number;
  /** The serialised universe. */
  payload: string;
  schema_version: number;
  character_name: string;
  career_label: string;
  location_label: string;
  world_date_label: string;
  net_worth_label: string;
  playtime_seconds: number;
  app_version: string;
  updated_at?: string;
  backup_payload?: string;
  backup_world_date_label?: string;
}

/**
 * Whether a failure is worth trying again. A refusal the server made on
 * purpose — a bad slot, a save from a newer build — will be refused again;
 * a conflict or a server fault may not be.
 */
function isRetryable(status: number | undefined): boolean {
  return status === undefined || status >= 500 || status === 409 || status === 429;
}

export class Base44SaveAdapter implements SaveAdapter {
  readonly name = 'Base44';
  readonly serverAuthoritative = true;
  private fallback = new LocalSaveAdapter();

  constructor(private client: Base44Client | null) {}

  private get entity(): Base44Entity<SaveRecord> | null {
    return this.client?.entities?.SlateSave ?? null;
  }

  /**
   * The backend functions, when this deployment has them. They are preferred
   * over writing entities directly, because they are where the server checks
   * that a save balances, belongs to this player, and has not gone backwards.
   * Writing the entity straight from the browser skips all of that.
   */
  private get fn(): Base44Functions | null {
    return typeof this.client?.functions?.invoke === 'function' ? this.client.functions : null;
  }

  /**
   * Calls a backend function and returns what it actually said.
   *
   * Two things about `invoke` shape this: the JSON lives on `.data` rather
   * than at the top level, and a non-2xx reply arrives as a thrown error with
   * the body on `error.response.data`. A refusal the server explained is worth
   * far more to the player than 'request failed', so it is dug out either way.
   */
  private async call(name: string, payload: Record<string, unknown>, what: string): Promise<FunctionReply> {
    const fn = this.fn;
    // `what` is what SLATE was doing, said in the middle of a sentence ("while saving"), and at its start where it's the
    // subject (from 2026-10-19, brief 15: until then "Loading that save couldn’t reach the server", the act as the one
    // reaching).
    const What = what.replace(/^./, (c) => c.toUpperCase());
    if (!fn) throw new PersistenceError(`${What} isn’t possible here, because this version of SLATE has no server to save to.`, true);

    let reply: FunctionReply | undefined;
    try {
      reply = (await fn.invoke(name, payload))?.data;
    } catch (error) {
      const thrown = error as { response?: { data?: FunctionReply; status?: number }; message?: string };
      const body = thrown.response?.data;
      if (body?.error) {
        throw new PersistenceError(body.error, isRetryable(body.status ?? thrown.response?.status));
      }
      console.error(error);
      throw new PersistenceError(`SLATE couldn’t reach the server while ${what}. Check your connection, then try again.`, true);
    }

    if (!reply) throw new PersistenceError(`SLATE got no answer from the server while ${what}. Try again in a moment.`, true);
    if (!reply.ok) throw new PersistenceError(reply.error ?? `${What} didn’t go through: the server turned it down without saying why. Try again in a moment.`, isRetryable(reply.status));
    return reply;
  }

  async listSlots(): Promise<SaveSlotInfo[]> {
    if (this.fn) {
      const reply = await this.call('loadUniverse', {}, 'reading your saves');
      return ([1, 2, 3] as Slot[]).map((slot) => {
        const row = reply.slots?.find((s) => s.slot === slot);
        if (!row?.occupied) {
          return {
            slot, occupied: false,
            hasBackup: Boolean(row?.hasBackup),
            backupDateLabel: row?.backupDateLabel || undefined,
          };
        }
        return {
          slot,
          occupied: true,
          hasBackup: row.hasBackup,
          backupDateLabel: row.backupDateLabel || undefined,
          bytes: row.bytes,
          meta: {
            id: row.saveId ?? '',
            slot,
            schemaVersion: row.schemaVersion ?? 0,
            characterName: row.characterName ?? '',
            careerLabel: row.careerLabel ?? '',
            locationLabel: row.locationLabel ?? '',
            worldDateLabel: row.worldDateLabel ?? '',
            netWorthLabel: row.netWorthLabel ?? '',
            playtimeSeconds: row.playtimeSeconds ?? 0,
          } as SaveSlotInfo['meta'],
        };
      });
    }

    const entity = this.entity;
    if (!entity) return this.fallback.listSlots();

    let records: SaveRecord[] = [];
    try {
      records = await entity.filter({});
    } catch (error) {
      // A network failure must not look like an empty save file.
      console.error(error);
      throw new PersistenceError('Your saves couldn’t be reached. They aren’t lost: check your connection, then try again.', true);
    }

    return ([1, 2, 3] as Slot[]).map((slot) => {
      const record = records.find((r) => r.slot === slot);
      if (!record) return { slot, occupied: false, hasBackup: false };
      const hasBackup = Boolean(record.backup_payload);
      const backupDateLabel = record.backup_world_date_label || undefined;
      try {
        const universe = deserialise(record.payload);
        return {
          slot, occupied: true, meta: universe.meta,
          hasBackup, backupDateLabel,
          bytes: record.payload.length,
        };
      } catch (error) {
        return {
          slot, occupied: true, hasBackup, backupDateLabel,
          error: (error as Error).message,
        };
      }
    });
  }

  async load(slot: Slot): Promise<SaveUniverse | null> {
    if (this.fn) {
      const reply = await this.call('loadUniverse', { slot }, 'opening that save');
      return reply.payload ? deserialise(reply.payload) : null;
    }

    const entity = this.entity;
    if (!entity) return this.fallback.load(slot);
    const [record] = await entity.filter({ slot });
    if (!record) return null;
    return deserialise(record.payload);
  }

  async save(universe: SaveUniverse): Promise<void> {
    const slot = universe.meta.slot;
    const payload = serialise(universe);

    if (this.fn) {
      try {
        // The key is the save and the moment it reached, so a retry after a
        // dropped connection writes once rather than twice.
        await this.call('saveUniverse', {
          slot,
          payload,
          // The schema is in the key because bringing a save forward moves
          // neither its clock nor its playtime, and without it the write-back
          // after a migration was taken for a retry of the last write and
          // dropped, so the server kept the old save.
          idempotencyKey: `${universe.meta.id}:${universe.now}:${Math.round(universe.meta.playtimeSeconds)}:${universe.meta.schemaVersion}`,
        }, 'saving');
        await this.fallback.save(universe).catch(() => undefined);
        return;
      } catch (error) {
        await this.fallback.save(universe).catch(() => undefined);
        throw error;
      }
    }

    const entity = this.entity;
    if (!entity) return this.fallback.save(universe);

    const data: Record<string, unknown> = {
      slot,
      payload,
      schema_version: universe.meta.schemaVersion,
      character_name: universe.meta.characterName,
      career_label: universe.meta.careerLabel,
      location_label: universe.meta.locationLabel,
      world_date_label: universe.meta.worldDateLabel,
      net_worth_label: universe.meta.netWorthLabel,
      playtime_seconds: Math.round(universe.meta.playtimeSeconds),
      app_version: universe.meta.appVersion,
    };

    try {
      const [existing] = await entity.filter({ slot });
      if (existing) {
        // Keep the prior payload as a server-side backup before overwriting.
        await entity.update(existing.id, {
          ...data,
          backup_payload: existing.payload,
          backup_world_date_label: existing.world_date_label ?? '',
        });
      } else {
        await entity.create(data);
      }
      // Mirror locally so a connection drop never costs the player progress.
      await this.fallback.save(universe).catch(() => undefined);
    } catch (error) {
      // Local mirror is the recovery path, so say so honestly.
      await this.fallback.save(universe).catch(() => undefined);
      // The next save writes the whole save to the server again, so it catches up then.
      console.error(error);
      throw new PersistenceError('The save couldn’t reach the server. A copy is kept on this device, and the next save tries the server again.', true);
    }
  }

  async remove(slot: Slot): Promise<void> {
    if (this.fn) {
      await this.call('clearSlot', { slot }, 'deleting that slot');
      await this.fallback.remove(slot).catch(() => undefined);
      return;
    }

    const entity = this.entity;
    if (!entity) return this.fallback.remove(slot);
    const [existing] = await entity.filter({ slot });
    if (existing) {
      // Keep the payload as a backup rather than destroying it outright.
      await entity.update(existing.id, {
        backup_payload: existing.payload,
        backup_world_date_label: existing.world_date_label ?? '',
        payload: '',
      });
    }
    await this.fallback.remove(slot).catch(() => undefined);
  }

  async backup(slot: Slot): Promise<boolean> {
    const entity = this.entity;
    if (!entity) return this.fallback.backup(slot);
    const [existing] = await entity.filter({ slot });
    if (!existing?.payload) return false;
    await entity.update(existing.id, {
      backup_payload: existing.payload,
      backup_world_date_label: existing.world_date_label ?? '',
    });
    return true;
  }

  async restoreBackup(slot: Slot): Promise<SaveUniverse | null> {
    const entity = this.entity;
    if (!entity) return this.fallback.restoreBackup(slot);
    const [existing] = await entity.filter({ slot });
    if (!existing?.backup_payload) return null;
    const universe = deserialise(existing.backup_payload);
    // The server swaps its own backup and save (from 2026-10-05). Until then this re-sent the backup as an ordinary
    // write, which the server replayed or refused for its older clock, so a restore never took on Base44.
    if (this.fn) {
      await this.call('saveUniverse', { slot, restore: true }, 'restoring the backup');
      await this.fallback.save(universe).catch(() => undefined);
      return universe;
    }
    await this.save(universe);
    return universe;
  }
}

/**
 * Picks the right adapter. Base44 injects its client on the window; when it is
 * absent SLATE runs entirely locally, which is how it is developed and tested.
 */
export async function resolveAdapter(): Promise<SaveAdapter> {
  const injected = (globalThis as unknown as { base44?: Base44Client }).base44;
  if (typeof injected?.functions?.invoke === 'function' || injected?.entities?.SlateSave) {
    return new Base44SaveAdapter(injected);
  }
  return new LocalSaveAdapter();
}
