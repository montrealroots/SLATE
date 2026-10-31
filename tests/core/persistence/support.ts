import { begin } from '../../../src/core/frame/frame.ts';
import type { Kept, Slot } from '../../../src/core/persistence/contract.ts';
import { SCHEMA_VERSION } from '../../../src/core/persistence/version.ts';

export const SEED = '0123456789abcdef';
export const T0 = 1_800_000_000;

/** A kept life for a place, at a moment, with a card naming it. */
export function kept(slot: Slot, over: { id?: string; now?: number; playtime?: number; name?: string; schemaVersion?: number } = {}): Kept {
  return {
    meta: { id: over.id ?? 'life-a', slot, schemaVersion: over.schemaVersion ?? SCHEMA_VERSION, appVersion: '0.1.0', playtimeSeconds: over.playtime ?? 60, card: { name: over.name ?? 'Ada' } },
    life: begin(SEED, over.now ?? T0, { person: { name: over.name ?? 'Ada' } }),
  };
}

/**
 * Local storage in memory, with a quota a test can set (on one value, or on all of them together, as a browser holds an
 * origin's), and a switch that makes it fail.
 */
export class MemoryStorage implements Storage {
  readonly map = new Map<string, string>();
  quota = Infinity;
  capacity = Infinity;
  broken = false;
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key: string) {
    if (this.broken) throw new Error('storage failed');
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.broken) throw new Error('storage failed');
    const used = [...this.map].reduce((n, [k, v]) => n + (k === key ? 0 : v.length), 0);
    if (value.length > this.quota || used + value.length > this.capacity) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}
