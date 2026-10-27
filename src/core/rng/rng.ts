import deciders from './deciders.json';

/**
 * Deterministic randomness. Every draw comes from a stream keyed by the life's seed and a named decider (with whatever
 * keys the draw needs, such as a place and a day), so the same life draws the same weather on the same day however it
 * got there, and a test can replay any draw. The generator is SplitMix64 (Sebastiano Vigna's reference, splitmix.c;
 * register R-0024), and a stream's key is hashed with FNV-1a 64 (RFC 9923; register R-0025).
 */

const MASK = (1n << 64n) - 1n;

/** A named decider: one registered in deciders.json, where its reader is said. */
export type Decider = keyof typeof deciders;

/** One SplitMix64 step: the next state and the output (splitmix.c's next()). */
export function splitmix64(state: bigint): { state: bigint; value: bigint } {
  const x = (state + 0x9e3779b97f4a7c15n) & MASK;
  let z = x;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
  return { state: x, value: z ^ (z >> 31n) };
}

/** FNV-1a, 64 bits, over bytes (RFC 9923 §2: XOR the octet, then multiply by the prime). */
export function fnv1a64(bytes: Uint8Array): bigint {
  let hash = 0xcbf29ce484222325n;
  for (const b of bytes) hash = ((hash ^ BigInt(b)) * 0x100000001b3n) & MASK;
  return hash;
}

export interface Draws {
  /** The next 64 random bits. */
  u64(): bigint;
  /** A number in [0, 1), from the top 53 bits. */
  float(): number;
  /** A whole number in [0, n), without bias (draws above the last whole multiple of n are drawn again). */
  below(n: number): number;
  /** One of the items, each as likely. */
  pick<T>(items: readonly T[]): T;
}

/** The unit separator between a stream's key parts, which no name or key contains. */
const SEPARATOR = '\u001f';

/** A stream of draws for a decider and its keys, from the life's seed. */
export function draws(seed: bigint, decider: Decider, ...keys: readonly (string | number)[]): Draws {
  if (seed < 0n || seed > MASK) throw new RangeError('a seed is 64 bits');
  const key = [decider, ...keys.map(String)];
  if (key.some((k) => k.includes(SEPARATOR))) throw new RangeError('a decider or key contains the separator');
  let state = seed ^ fnv1a64(new TextEncoder().encode(key.join(SEPARATOR)));
  const u64 = () => {
    const step = splitmix64(state);
    state = step.state;
    return step.value;
  };
  const below = (n: number) => {
    if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`below needs a whole number of at least 1 (${n})`);
    const span = BigInt(n);
    const limit = (MASK + 1n) - ((MASK + 1n) % span);
    for (;;) {
      const v = u64();
      if (v < limit) return Number(v % span);
    }
  };
  return {
    u64,
    float: () => Number(u64() >> 11n) / 2 ** 53,
    below,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('nothing to pick from');
      return items[below(items.length)] as T;
    },
  };
}

/** A new life's seed: 64 bits from the platform's cryptographic source, the one draw that isn't replayable. */
export function newSeed(fill: (words: Uint32Array<ArrayBuffer>) => void = (w) => void globalThis.crypto.getRandomValues(w)): bigint {
  const words = new Uint32Array(new ArrayBuffer(8));
  fill(words);
  return (BigInt(words[0] as number) << 32n) | BigInt(words[1] as number);
}

/** A seed as a save keeps it: sixteen hex digits. */
export const seedToText = (seed: bigint) => seed.toString(16).padStart(16, '0');

export function seedFromText(text: string): bigint {
  if (!/^[0-9a-f]{16}$/.test(text)) throw new RangeError(`not a seed: "${text}"`);
  return BigInt(`0x${text}`);
}
