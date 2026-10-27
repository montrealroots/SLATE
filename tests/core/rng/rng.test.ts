import { describe, expect, it } from 'vitest';
import { draws, fnv1a64, newSeed, seedFromText, seedToText, splitmix64, type Decider } from '../../../src/core/rng/rng.ts';

const MASK = (1n << 64n) - 1n;
/** A decider name for the engine's own tests; the registry holds the game's. */
const d = (name: string) => name as Decider;

/**
 * SplitMix64 against the reference: the 50 outputs rand_xoshiro's test records "produced with the reference
 * implementation" from state 1477776061723855037 (register R-0024).
 */
const REFERENCE = [
  1985237415132408290n, 2979275885539914483n, 13511426838097143398n, 8488337342461049707n, 15141737807933549159n, 17093170987380407015n,
  16389528042912955399n, 13177319091862933652n, 10841969400225389492n, 17094824097954834098n, 3336622647361835228n, 9678412372263018368n,
  11111587619974030187n, 7882215801036322410n, 5709234165213761869n, 7799681907651786826n, 4616320717312661886n, 4251077652075509767n,
  7836757050122171900n, 5054003328188417616n, 12919285918354108358n, 16477564761813870717n, 5124667218451240549n, 18099554314556827626n,
  7603784838804469118n, 6358551455431362471n, 3037176434532249502n, 3217550417701719149n, 9958699920490216947n, 5965803675992506258n,
  12000828378049868312n, 12720568162811471118n, 245696019213873792n, 8351371993958923852n, 14378754021282935786n, 5655432093647472106n,
  5508031680350692005n, 8515198786865082103n, 6287793597487164412n, 14963046237722101617n, 3630795823534910476n, 8422285279403485710n,
  10554287778700714153n, 10871906555720704584n, 8659066966120258468n, 9420238805069527062n, 10338115333623340156n, 13514802760105037173n,
  14635952304031724449n, 15419692541594102413n,
];

/** SplitMix64's output function undone (xorshifts and odd multiplications are invertible), to build a chosen draw. */
function unmix(z: bigint): bigint {
  const inverse = (a: bigint) => {
    let x = a;
    for (let i = 0; i < 6; i += 1) x = (x * (2n - a * x)) & MASK;
    return x;
  };
  const unshift = (v: bigint, s: bigint) => {
    let x = v;
    for (let i = 0; i < 64; i += Number(s)) x = v ^ (x >> s);
    return x & MASK;
  };
  let x = unshift(z, 31n);
  x = unshift((x * inverse(0x94d049bb133111ebn)) & MASK, 27n);
  x = unshift((x * inverse(0xbf58476d1ce4e5b9n)) & MASK, 30n);
  return (x - 0x9e3779b97f4a7c15n) & MASK;
}

describe('the generator and the hash, against their references', () => {
  it('splitmix64: the 50 reference outputs', () => {
    let state = 1477776061723855037n;
    const out: bigint[] = [];
    for (let i = 0; i < 50; i += 1) {
      const step = splitmix64(state);
      state = step.state;
      out.push(step.value);
    }
    expect(out).toEqual(REFERENCE);
    expect(splitmix64(MASK).state).toBe(0x9e3779b97f4a7c14n);
  });
  it('fnv1a64: RFC 9923\'s test strings', () => {
    const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
    expect(['', 'a', 'foobar', 'Hello!\x01\xFF\xED'].map((s) => fnv1a64(bytes(s)).toString(16))).toEqual(['cbf29ce484222325', 'af63dc4c8601ec8c', '85944171f73967e8', 'bd51ea7094ee6fa1']);
  });
  it('undoes the mix, so a chosen output can be built', () => {
    for (const z of [0n, 1n, MASK, 0x0123456789abcdefn]) expect(splitmix64(unmix(z)).value).toBe(z);
  });
});

describe('keyed streams', () => {
  const seed = 0x0123456789abcdefn;
  it('give the same draws for the same seed, decider and keys, and others otherwise', () => {
    const take = (s: bigint, name: string, ...keys: (string | number)[]) => {
      const r = draws(s, d(name), ...keys);
      return [r.u64(), r.u64(), r.u64()];
    };
    expect(take(seed, 'weather.day', 'Paris', 20_000)).toEqual(take(seed, 'weather.day', 'Paris', 20_000));
    const base = take(seed, 'weather.day', 'Paris', 20_000);
    for (const other of [take(seed + 1n, 'weather.day', 'Paris', 20_000), take(seed, 'weather.night', 'Paris', 20_000), take(seed, 'weather.day', 'Lyon', 20_000), take(seed, 'weather.day', 'Paris', 20_001), take(seed, 'weather.day', 'Paris'), take(seed, 'weather.day', 'Paris20000')]) {
      expect(other).not.toEqual(base);
    }
    // The first draw is the generator's step from the seed XOR the key's hash.
    const key = new TextEncoder().encode('weather.day\u001fParis\u001f20000');
    expect(base[0]).toBe(splitmix64(seed ^ fnv1a64(key)).value);
  });
  it('refuse a seed that isn\'t 64 bits, and a key that holds the separator', () => {
    expect(() => draws(-1n, d('x'))).toThrow('a seed is 64 bits');
    expect(() => draws(MASK + 1n, d('x'))).toThrow('a seed is 64 bits');
    expect(() => draws(MASK, d('x')).u64()).not.toThrow();
    expect(() => draws(0n, d('x'))).not.toThrow();
    expect(() => draws(seed, d('a\u001fb'))).toThrow('a decider or key contains the separator');
    expect(() => draws(seed, d('a'), 'b\u001f')).toThrow('a decider or key contains the separator');
  });
  it('make a float in [0, 1) from the top 53 bits', () => {
    const at = (z: bigint) => draws(unmix(z) ^ fnv1a64(new TextEncoder().encode('f')), d('f')).float();
    expect(at(0n)).toBe(0);
    expect(at(MASK)).toBe(1 - 2 ** -53);
    expect(at(1n << 63n)).toBe(0.5);
    expect(at((1n << 11n) - 1n)).toBe(0);
  });
  it('draw a whole number below n without bias, drawing again above the last whole multiple', () => {
    const key = (k: string) => fnv1a64(new TextEncoder().encode(k));
    // The first draw is 2^64 - 1, the one value at or above the last multiple of 3: it is drawn again.
    const r = draws(unmix(MASK) ^ key('b'), d('b'));
    const again = draws(unmix(MASK) ^ key('b'), d('b'));
    again.u64();
    expect(r.below(3)).toBe(Number(again.u64() % 3n));
    // Just under the limit, it's kept.
    expect(draws(unmix(MASK - 1n) ^ key('b'), d('b')).below(3)).toBe(Number((MASK - 1n) % 3n));
    expect(draws(unmix(10n) ^ key('b'), d('b')).below(4)).toBe(2);
    const counts = [0, 0, 0, 0, 0, 0];
    const s = draws(seed, d('die'));
    for (let i = 0; i < 60_000; i += 1) (counts[s.below(6)] as number) += 1;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
    for (const bad of [0, -1, 1.5, 2 ** 53]) expect(() => draws(seed, d('x')).below(bad)).toThrow(`below needs a whole number of at least 1 (${bad})`);
    expect(draws(seed, d('x')).below(1)).toBe(0);
  });
  it('pick each item as often', () => {
    const s = draws(seed, d('pick'));
    const seen = new Map<string, number>();
    for (let i = 0; i < 30_000; i += 1) {
      const p = s.pick(['a', 'b', 'c']);
      seen.set(p, (seen.get(p) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['a', 'b', 'c']);
    for (const c of seen.values()) expect(Math.abs(c - 10_000)).toBeLessThan(400);
    expect(() => s.pick([])).toThrow('nothing to pick from');
    expect(draws(unmix(5n) ^ fnv1a64(new TextEncoder().encode('p')), d('p')).pick(['x', 'y', 'z'])).toBe('z');
  });
});

describe('seeds', () => {
  it('come from the platform\'s cryptographic source, 64 bits from two words', () => {
    expect(newSeed((w) => w.set([0x01234567, 0x89abcdef]))).toBe(0x0123456789abcdefn);
    expect(newSeed((w) => w.set([0xffffffff, 0xffffffff]))).toBe(MASK);
    const a = newSeed();
    const b = newSeed();
    expect(a).not.toBe(b);
    expect(a >= 0n && a <= MASK).toBe(true);
  });
  it('are kept as sixteen hex digits, and read back', () => {
    expect(seedToText(0x0123456789abcdefn)).toBe('0123456789abcdef');
    expect(seedToText(1n)).toBe('0000000000000001');
    expect(seedFromText('0123456789abcdef')).toBe(0x0123456789abcdefn);
    for (const bad of ['123', '0123456789ABCDEF', 'x123456789abcdef', '0123456789abcdef0']) expect(() => seedFromText(bad)).toThrow(`not a seed: "${bad}"`);
  });
});
