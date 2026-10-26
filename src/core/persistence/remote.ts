import { isLine } from '../text/text.ts';
import { PersistenceError, SLOTS, decode, encode, type Kept, type Meta, type Slot, type SlotInfo, type Store } from './contract.ts';
import { DeviceStore } from './local.ts';

/**
 * Lives kept on the server (KEEP entry 1), through its three backend functions, where the server checks each write
 * (server/guard.ts). Every write and every letting-go is mirrored on this device too, so a dropped connection never
 * costs the player what they played; the server stays the authority on what a life holds.
 */

/** The slice of the Base44 SDK this store uses: a backend function called by name. */
export interface Functions {
  /** Resolves with the function's answer on `data`; throws on any status but 2xx, with the answer on `response.data`. */
  invoke(name: string, payload: Record<string, unknown>): Promise<{ data?: Reply }>;
}

export interface Reply {
  ok: boolean;
  status?: number;
  error?: string;
  payload?: string | null;
  slots?: { slot: number; occupied: boolean; hasBackup: boolean; backupCard?: Record<string, string>; meta?: Meta; bytes?: number }[];
}

/** Worth trying again: a conflict, a limit or a server fault may pass; a refusal the server meant won't. */
export const isRetryable = (status: number | undefined): boolean => status === undefined || status >= 500 || status === 409 || status === 429;

export class ServerStore implements Store {
  readonly where = 'server';

  constructor(
    private readonly fn: Functions,
    private readonly mirror: Store = new DeviceStore(),
  ) {}

  /** Calls a function and returns what it said; a refusal the server explained reaches the player in its own line. */
  private async call(name: string, payload: Record<string, unknown>): Promise<Reply> {
    let reply: Reply | undefined;
    try {
      reply = (await this.fn.invoke(name, payload)).data;
    } catch (e) {
      const response = (e as { response?: { status?: number; data?: Reply } } | undefined)?.response;
      if (response?.data?.error === undefined) throw new PersistenceError('server.unreachable', true);
      // An answer with an error came back: what the server said, and the status it said it with.
      const { status, data } = response as { status?: number; data: Reply };
      throw new PersistenceError(isLine(data.error) ? data.error : 'server.refused', isRetryable(data.status ?? status));
    }
    if (reply === undefined) throw new PersistenceError('server.no-answer', true);
    if (!reply.ok) throw new PersistenceError(isLine(reply.error) ? reply.error : 'server.refused', isRetryable(reply.status));
    return reply;
  }

  async listSlots(): Promise<SlotInfo[]> {
    const reply = await this.call('loadUniverse', {});
    return SLOTS.map((slot) => {
      const row = reply.slots?.find((s) => s.slot === slot);
      const copy = row?.hasBackup === true ? { hasBackup: true, backupCard: row.backupCard ?? {} } : { hasBackup: false };
      if (row?.occupied !== true || row.meta === undefined) return { slot, occupied: false, ...copy };
      return { slot, occupied: true, meta: row.meta, ...copy, ...(row.bytes === undefined ? {} : { bytes: row.bytes }) };
    });
  }

  async load(slot: Slot): Promise<Kept | null> {
    const reply = await this.call('loadUniverse', { slot });
    return typeof reply.payload === 'string' ? decode(reply.payload) : null;
  }

  async save(kept: Kept): Promise<void> {
    const { meta } = kept;
    // The key is the life and the moment it reached, so a retry after a dropped connection writes once.
    const idempotencyKey = `${meta.id}:${kept.life.frame.now}:${Math.round(meta.playtimeSeconds)}:${meta.schemaVersion}`;
    try {
      await this.call('saveUniverse', { slot: meta.slot, payload: encode(kept), idempotencyKey });
    } finally {
      await this.mirror.save(kept).catch(() => undefined);
    }
  }

  async remove(slot: Slot): Promise<void> {
    await this.call('clearSlot', { slot });
    await this.mirror.remove(slot).catch(() => undefined);
  }

  /** The server swaps its copy and the life, and answers with the life brought back. */
  async restoreBackup(slot: Slot): Promise<Kept | null> {
    const reply = await this.call('saveUniverse', { slot, restore: true });
    if (typeof reply.payload !== 'string') return null;
    const kept = decode(reply.payload);
    await this.mirror.save(kept).catch(() => undefined);
    return kept;
  }
}

/** The server where the deployment injects its client, this device otherwise (how SLATE is developed and tested). */
export function resolveStore(injected: unknown = (globalThis as { base44?: unknown }).base44): Store {
  const fn = (injected as { functions?: Partial<Functions> } | undefined)?.functions;
  return typeof fn?.invoke === 'function' ? new ServerStore(fn as Functions) : new DeviceStore();
}
