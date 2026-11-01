import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  at,
  BLOCKED,
  boundOf,
  CALIBRATED,
  CALIBRATION,
  cited,
  creditOf,
  FACT,
  figureOf,
  fundOf,
  ITEMS,
  KEPT,
  marketOf,
  meet,
  numbersIn,
  OUTPUT,
  rangeOf,
  rateOf,
  READINGS,
  readMarkets,
  readResearch,
  releaseOf,
  serialize,
  SOURCES,
  stands,
  tierOf,
  tiersOf,
  unknownOf,
  valueOf,
  written,
  type Research,
  type Sources,
  type Tier,
} from '../../tools/person/markets-producer/compile.ts';
import { COVERAGE, coverageOf, marketsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/person/markets-producer/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const OWN = {
  country: 'XX',
  figures: [
    { item: 'fund', value: { share: 0.4, most: 1_000_000, rate: 0.25, applied: 8, funded: 2, half: 2.5, one: 1, flag: true, text: '9', zero: 0, neg: -1, big: 1.5, fine: 1.234, low: 500_000, flat: [{ fee: 15_000 }], nested: { n: 7 } }, finding: 'EUR: up to 1.5m, from 2 million, 3bn, 4 billion, 750,000, 40% of it, 0.5m, 1,750, 9,9991, 2,250' },
    { item: 'fund', value: { rate: 0.3, most: 20 } },
    { item: 'incentive', value: { rebate: false, yes: true, zero: 0 } },
  ],
  blockers: [{ item: 'fund' }, { item: 'union' }, { item: 'fund' }],
} as Research;
const CAL = { country: 'calibration', figures: [{ item: 'financing', value: { cap: 0.49, most: 500_000, unit: 'CAD', rate: 0.111, rebate: false } }], blockers: [] } as Research;
const S: Sources = { country: 'XX', own: OWN, calibration: CAL };
const R = { s: S, currency: 'EUR' as const, fig: OWN.figures[0] ?? null };
const BARE = { s: S, currency: 'EUR' as const, fig: null };
const tier = (over: Record<string, unknown>) => tierOf(S, 'EUR', { fig: 0, budget: [0, null], ...over });
const T = (over: Partial<Tier> = {}): Tier => ({ budget: [0, null], bands: [{ from: 0, to: null, rate: 0.4 }], base: 1, net: false, most: null, sum: null, ...over });

describe("the producer's markets compile", () => {
  it('reads a figure of the market or the calibration, and a place in it', () => {
    expect([SOURCES, CALIBRATION, READINGS, OUTPUT, FACT, BLOCKED, CALIBRATED, KEPT]).toEqual([
      'research/sources/person/markets',
      'research/sources/person/work/producer-calibration.json',
      'tools/person/markets-producer/readings.json',
      'src/person/producing/markets.json',
      'person.markets.producer.',
      'person.markets.producer.blocked.',
      'person.work.producer.calibration',
      'GB',
    ]);
    expect(ITEMS).toEqual(['fund', 'incentive', 'feecap', 'outcomes', 'market', 'union', 'language']);
    expect(figureOf(S, { fig: 1 })).toBe(OWN.figures[1]);
    expect(figureOf(S, { fig: 0, in: 'calibration' })).toBe(CAL.figures[0]);
    expect(() => figureOf(S, { fig: 0, in: 'register' })).toThrow("a figure is the market's own or the calibration's, not register's");
    expect(() => figureOf(S, { fig: 3 })).toThrow('XX has no figure 3');
    expect(() => figureOf(S, { fig: '0' })).toThrow('XX has no figure 0');
    expect(() => figureOf(S, {})).toThrow('XX has no figure undefined');
    expect(() => figureOf(S, { fig: 1, in: 'calibration' })).toThrow('XX has no calibration figure 1');
    expect(at({ a: [{ b: 7 }] }, ['a', 0, 'b'])).toBe(7);
    expect(at({ a: 1 }, [])).toEqual({ a: 1 });
    for (const path of [['b'], ['a', 'c'], ['a', 'x', 'y']]) expect(() => at({ a: { x: null } }, path), path.join()).toThrow(`has nothing at ${path.join('.')}`);
    expect(() => at({ a: 'text' }, ['a', 'length'])).toThrow('has nothing at a.length');
  });

  it("finds a number standing in a figure: in its value, or in its words, a bound one unit off", () => {
    expect(numbersIn({ a: 1, b: [2, { c: 3 }], d: 'x', e: null, f: true })).toEqual([1, 2, 3]);
    expect(numbersIn(4)).toEqual([4]);
    expect(numbersIn('4')).toEqual([]);
    expect(numbersIn(null)).toEqual([]);
    expect(written(1_500_000)).toEqual(['1,500,000', '1.5m', '1.5 million', '0.0015bn', '0.0015 billion', '150000000%']);
    expect(written(0.075)).toContain('7.5%');
    const f = OWN.figures[0] as Research['figures'][number];
    expect(stands(f, 0, 2, false)).toBe(true);
    expect(stands({ item: 'x', value: {} } as never, 0, 2, false)).toBe(true);
    for (const n of [0.4, 1_000_000, 15_000, 7, 1_500_000, 2_000_000, 3e9, 4e9, 750_000, 1750, 500_000]) expect(stands(f, n, 2, false), String(n)).toBe(true);
    expect(stands(f, 0.4, 4, false)).toBe(true);
    // 40% stands for a rate of 0.4, in words as in the value; 0.5m isn't 5m, 1,750 isn't 750 nor 175, 3bn isn't 3, 4 billion isn't 4, 750,000 isn't 750, 9,9991 isn't 9,999, 2,250 isn't 250.
    expect(stands({ item: 'x', value: {}, finding: 'up to 40% of it' } as never, 0.4, 4, false)).toBe(true);
    for (const n of [5_000_000, 750, 175, 9999, 250, 3, 4, 5]) expect(stands(f, n, 2, false), String(n)).toBe(false);
    expect(stands({ item: 'x', value: {}, finding: '1x5m' } as never, 1_500_000, 2, false)).toBe(false);
    expect([stands({ item: 'x', value: {}, finding: '1.5m' } as never, 1, 0, false), stands({ item: 'x', value: {}, finding: 'a 1 m' } as never, 1, 0, false), stands({ item: 'x', value: {}, finding: '1 mark' } as never, 1, 0, false)]).toEqual([false, false, true]);
    // A bound one minor unit under or over a figure stands; a value doesn't, nor two units off.
    expect([stands(f, 999_999.99, 2, true), stands(f, 1_000_000.01, 2, true), stands(f, 999_999.99, 2, false), stands(f, 999_999.98, 2, true)]).toEqual([true, true, false, false]);
    expect([stands(f, 1_499_999, 0, true), stands(f, 1_500_001, 0, true), stands(f, 1_499_998, 0, true)]).toEqual([true, true, false]);
  });

  it('reads a value at its place, or written in the reading where it stands, as a rate or an amount', () => {
    expect(valueOf(R, ['share'], 'rate', 'share')).toBe(0.4);
    expect(valueOf(R, ['zero'], 'rate', 'share')).toBe(0);
    expect(valueOf(R, { fig: 0, in: 'calibration', path: ['cap'] }, 'rate', 'share')).toBe(0.49);
    expect(valueOf(R, 0.4, 'rate', 'share')).toBe(0.4);
    expect(valueOf(R, ['most'], 'amount', 'most')).toBe(1_000_000);
    expect(valueOf(R, 1_500_000, 'amount', 'most')).toBe(1_500_000);
    expect(valueOf(R, ['nested', 'n'], 'amount', 'most')).toBe(7);
    expect(valueOf({ ...R, currency: 'CAD' }, { fig: 0, in: 'calibration', path: ['most'] }, 'amount', 'most')).toBe(500_000);
    expect(() => valueOf(R, 0.41, 'rate', 'share')).toThrow("XX's share 0.41 doesn't stand in its figure");
    expect(() => valueOf(R, 1_000_000.01, 'amount', 'most')).toThrow("XX's most 1000000.01 doesn't stand in its figure");
    expect(() => valueOf(BARE, 0.4, 'rate', 'share')).toThrow("XX's share names no figure");
    expect(() => valueOf(BARE, ['share'], 'rate', 'share')).toThrow("XX's share names no figure");
    expect(() => valueOf(R, 'share', 'rate', 'share')).toThrow("XX's share is not an object");
    expect(() => valueOf(R, null, 'rate', 'share')).toThrow("XX's share is not an object");
    expect(valueOf(R, ['one'], 'rate', 'share')).toBe(1);
    // A written amount stands to the currency's cents, so one finer is refused as the currency's, not as missing.
    expect(() => valueOf(R, 0.403, 'amount', 'most')).toThrow('EUR has 2 decimal places');
    expect(() => valueOf(R, { fig: 0, path: ['share'], at: 1 }, 'rate', 'share')).toThrow("XX's share names at, which the game doesn't read");
    for (const path of [['text'], ['flat'], ['nested']]) expect(() => valueOf(R, path, 'rate', 'share'), path.join()).toThrow("XX's share isn't a number");
    for (const path of [['neg'], ['big']]) expect(() => valueOf(R, path, 'rate', 'share'), path.join()).toThrow(`XX's share ${String(at(OWN.figures[0]?.value, path))} isn't a rate`);
    expect(valueOf(R, ['big'], 'amount', 'most')).toBe(1.5);
    expect(valueOf(R, { fig: 2, path: ['zero'] }, 'rate', 'share')).toBe(0);
    for (const path of [['zero'], ['neg']]) expect(() => valueOf(R, path, 'amount', 'most'), path.join()).toThrow(`XX's most ${String(at(OWN.figures[0]?.value, path))} isn't an amount`);
    expect(() => valueOf(R, ['fine'], 'amount', 'most')).toThrow('EUR has 2 decimal places');
    expect(() => valueOf(R, { fig: 1, path: ['most'] }, 'amount', 'most')).toThrow("XX's most stands in a figure that doesn't name EUR");
    expect(valueOf(R, { fig: 1, path: ['rate'] }, 'rate', 'share')).toBe(0.3);
    expect(() => valueOf({ ...R, currency: 'JPY' }, ['half'], 'amount', 'most')).toThrow('JPY has 0 decimal places');
  });

  it('reads the bounds of a range of budgets, each standing in its figure', () => {
    expect(boundOf(R, 0, 'budget')).toBe(0);
    expect(boundOf(BARE, 0, 'budget')).toBe(0);
    expect(boundOf(R, 499_999.99, 'budget')).toBe(499_999.99);
    for (const v of [-1, '5', null, Number.NaN]) expect(() => boundOf(R, v, 'budget'), String(v)).toThrow(`XX's budget ${String(v)} isn't a bound`);
    expect(() => boundOf(R, 0.001, 'budget')).toThrow('EUR has 2 decimal places');
    expect(() => boundOf(BARE, 500_000, 'budget')).toThrow("XX's budget names no figure");
    expect(() => boundOf(R, 600_000, 'budget')).toThrow("XX's budget 600000 doesn't stand in its figure");
    expect(() => boundOf({ ...R, fig: OWN.figures[1] ?? null }, 20, 'budget')).toThrow("XX's budget stands in a figure that doesn't name EUR");
    expect(rangeOf(R, [0, null])).toEqual([0, null]);
    expect(rangeOf(BARE, [0, null])).toEqual([0, null]);
    expect(rangeOf(R, [500_000, 500_000])).toEqual([500_000, 500_000]);
    expect(rangeOf(BARE, { fig: 0, range: [500_000, 1_000_000] })).toEqual([500_000, 1_000_000]);
    expect(rangeOf({ ...R, currency: 'CAD' }, { fig: 0, in: 'calibration', range: [0, 499_999.99] })).toEqual([0, 499_999.99]);
    expect(() => rangeOf(R, { fig: 0, range: [0, null], at: 2 })).toThrow("XX's budget names at, which the game doesn't read");
    expect(() => rangeOf(R, 'x')).toThrow("XX's budget is not an object");
    for (const v of [[0], [0, 1, 2], { fig: 0 }]) expect(() => rangeOf(R, v), JSON.stringify(v)).toThrow("XX's budget is a pair");
    expect(() => rangeOf(R, [1_000_000, 500_000])).toThrow("XX's budget runs from 1000000 down to 500000");
    expect(() => rangeOf(R, [600_000, null])).toThrow("XX's budget 600000 doesn't stand in its figure");
    expect(() => rangeOf(R, [0, 600_000])).toThrow("XX's budget 600000 doesn't stand in its figure");
  });

  it('reads a tier: a sum, or a share or bands of the share counted, at most so much', () => {
    expect(tier({ sum: ['flat', 0, 'fee'] })).toEqual(T({ bands: [], sum: 15_000 }));
    for (const k of ['share', 'bands', 'base', 'most']) expect(() => tier({ sum: ['flat', 0, 'fee'], [k]: ['share'] }), k).toThrow("XX's tier is a sum or a share, not both");
    expect(() => tier({ sum: ['flat', 0, 'fee'], net: true })).toThrow("XX's tier is a sum or a share, not both");
    expect(tier({ sum: ['flat', 0, 'fee'], net: false }).sum).toBe(15_000);
    expect(tier({ share: ['share'] })).toEqual(T());
    expect(tier({ share: ['share'], most: ['most'], base: { fig: 0, in: 'calibration', path: ['cap'] }, budget: [500_000, null] })).toEqual(T({ budget: [500_000, null], base: 0.49, most: 1_000_000 }));
    expect(tier({ share: ['share'], net: true })).toEqual(T({ net: true }));
    expect(() => tier({ share: ['share'], bands: [] })).toThrow("XX's tier is a share or bands, not both");
    const two = [{ from: 0, to: 1_500_000, rate: ['share'] }, { from: 1_500_000, to: null, rate: { fig: 2, path: ['zero'] } }];
    expect(tier({ bands: two }).bands).toEqual([{ from: 0, to: 1_500_000, rate: 0.4 }, { from: 1_500_000, to: null, rate: 0 }]);
    expect(tier({ bands: [two[0], { from: 1_500_000, to: 2_000_000, rate: ['share'] }, { from: 2_000_000, to: null, rate: ['share'] }] }).bands.map((b) => b.to)).toEqual([1_500_000, 2_000_000, null]);
    for (const bands of [[], [two[0]], 'x']) expect(() => tier({ bands }), JSON.stringify(bands)).toThrow("XX's bands are two or more");
    expect(() => tier({ bands: [two[0], 'x'] })).toThrow("XX's band is not an object");
    expect(() => tier({ bands: [two[0], { ...two[1], at: 1 }] })).toThrow("XX's band names at, which the game doesn't read");
    const runs = "XX's bands run from nought, each from where the last ends";
    expect(() => tier({ bands: [{ ...two[0], from: 500_000 }, two[1]] })).toThrow(runs);
    expect(() => tier({ bands: [two[0], { ...two[1], from: 2_000_000 }] })).toThrow(runs);
    expect(() => tier({ bands: [two[0], { ...two[1], to: 1_500_000 }] })).toThrow(runs);
    expect(() => tier({ bands: [{ ...two[0], to: 0 }, { ...two[1], from: 0 }] })).toThrow(runs);
    expect(() => tier({ bands: [{ ...two[0], to: null }, two[1]] })).toThrow(runs);
    expect(() => tier({ bands: [two[0], { ...two[1], from: null }] })).toThrow("XX's band null isn't a bound");
    expect(() => tier({})).toThrow("XX's tier gives nothing");
    // Each value is read as what it is.
    expect(() => tier({ sum: ['zero'] })).toThrow("XX's sum 0 isn't an amount");
    expect(() => tier({ share: ['big'] })).toThrow("XX's share 1.5 isn't a rate");
    expect(() => tier({ share: ['share'], most: ['zero'] })).toThrow("XX's most 0 isn't an amount");
    expect(() => tier({ share: ['share'], base: ['big'] })).toThrow("XX's base 1.5 isn't a rate");
    expect(() => tier({ bands: [two[0], { ...two[1], rate: ['big'] }] })).toThrow("XX's band rate 1.5 isn't a rate");
    expect(() => tier({ bands: [{ ...two[0], to: 600_000 }, { ...two[1], from: 600_000 }] })).toThrow("XX's band 600000 doesn't stand in its figure");
    expect(tierOf(S, 'EUR', { budget: [0, null] }, true)).toEqual(T({ bands: [] }));
    expect(tierOf(S, 'EUR', { fig: 0, budget: [0, 1_000_000], most: ['most'] }, true)).toEqual(T({ budget: [0, 1_000_000], bands: [], most: 1_000_000 }));
    expect(() => tierOf(S, 'EUR', { fig: 0, budget: [0, null], net: true }, true)).toThrow("XX's tier is counted net of one share");
    expect(() => tier({ bands: two, net: true })).toThrow("XX's tier is counted net of one share");
    expect(() => tier({ share: ['share'], ratio: 1 })).toThrow("XX's tier names ratio, which the game doesn't read");
    expect(() => tierOf(S, 'EUR', 'x')).toThrow("XX's tier is not an object");
    expect(() => tierOf(S, 'EUR', { fig: 0, in: 'x', budget: [0, null], share: ['share'] })).toThrow("not x's");
  });

  it('reads a term as tiers by budget, none meeting another, in order', () => {
    expect(meet([0, 10], [10, null])).toBe(true);
    expect(meet([0, 9.99], [10, null])).toBe(false);
    expect(meet([10, null], [0, 9.99])).toBe(false);
    expect(meet([10, 20], [0, null])).toBe(true);
    expect(meet([0, null], [5, 5])).toBe(true);
    expect(meet([10, null], [0, 10])).toBe(true);
    const low = { fig: 0, budget: [0, 499_999.99], share: ['share'] };
    const high = { fig: 0, budget: [500_000, null], share: ['share'] };
    expect(tiersOf(S, 'EUR', [high, low], 'fee').map((x) => x.budget)).toEqual([[0, 499_999.99], [500_000, null]]);
    expect(() => tiersOf(S, 'EUR', [high, { ...low, budget: [0, 500_000] }], 'fee')).toThrow("XX's fee has two tiers for one budget");
    expect(() => tiersOf(S, 'EUR', 'x', 'fee')).toThrow("XX's fee is a list of tiers");
    expect(tiersOf(S, 'EUR', [], 'fee')).toEqual([]);
    expect(tiersOf(S, 'EUR', [{ budget: [0, null] }], 'fund', true)).toEqual([T({ bands: [] })]);
    expect(() => tiersOf(S, 'EUR', [{ budget: [0, null] }], 'fund')).toThrow("XX's tier gives nothing");
  });

  it('reads how often a fund says yes, and the fund, the incentive and the release', () => {
    expect(rateOf(S, { fig: 0, path: ['rate'] })).toBe(0.25);
    expect(rateOf(S, { fig: 0, in: 'calibration', path: ['rate'] })).toBe(0.111);
    expect(rateOf(S, { fig: 0, of: [['funded'], ['applied']] })).toBe(0.25);
    expect(rateOf(S, { fig: 0, of: [['funded'], ['funded']] })).toBe(1);
    for (const path of [['zero'], ['big'], ['text'], ['flag']]) expect(() => rateOf(S, { fig: 0, path }), path.join()).toThrow("XX's rate isn't a chance");
    expect(rateOf({ ...S, own: { ...OWN, figures: [{ item: 'fund', value: { one: 1 } }] } }, { fig: 0, path: ['one'] })).toBe(1);
    for (const of of [[['funded']], 'x', [['funded'], ['applied'], ['applied']]]) expect(() => rateOf(S, { fig: 0, of }), JSON.stringify(of)).toThrow("XX's rate is so many of so many");
    expect(() => rateOf(S, { fig: 0, of: [['funded'], ['applied']], path: ['rate'] })).toThrow("XX's rate is so many of so many");
    for (const of of [[['zero'], ['applied']], [['applied'], ['funded']], [['half'], ['applied']], [['funded'], ['half']], [['funded'], ['text']], [['text'], ['applied']]]) expect(() => rateOf(S, { fig: 0, of }), JSON.stringify(of)).toThrow("XX's rate isn't so many of so many");
    expect(() => rateOf(S, { fig: 0, path: ['rate'], at: 1 })).toThrow("XX's rate names at, which the game doesn't read");
    expect(() => rateOf(S, 'x')).toThrow("XX's rate is not an object");

    const fund = { rate: { fig: 0, path: ['rate'] }, tiers: [{ fig: 0, budget: [0, null], share: ['share'] }] };
    expect(fundOf(S, 'EUR', null, [])).toBeNull();
    expect(fundOf(S, 'EUR', fund, [])).toEqual({ rate: 0.25, tiers: [T()] });
    expect(fundOf(S, 'EUR', { ...fund, tiers: [{ budget: [0, null] }] }, [T()])).toEqual({ rate: 0.25, tiers: [T({ bands: [] })] });
    expect(() => fundOf(S, 'EUR', { ...fund, tiers: [{ budget: [0, null] }] }, [])).toThrow("XX's tier gives nothing");
    expect(() => fundOf(S, 'EUR', { ...fund, cap: 1 }, [])).toThrow("XX's fund names cap, which the game doesn't read");
    expect(() => fundOf(S, 'EUR', 'x', [])).toThrow("XX's fund is not an object");
    expect(() => fundOf(S, 'EUR', { ...fund, tiers: 'x' }, [])).toThrow("XX's fund is a list of tiers");

    expect(creditOf(S, 'EUR', null)).toBeNull();
    expect(creditOf(S, 'EUR', [{ fig: 0, budget: [500_000, null], share: ['share'] }])).toEqual([T({ budget: [500_000, null] })]);
    expect(creditOf(S, 'EUR', { none: { fig: 2, path: ['rebate'] } })).toEqual([]);
    expect(creditOf(S, 'EUR', { none: { fig: 0, in: 'calibration', path: ['rebate'] } })).toEqual([]);
    expect(() => creditOf(S, 'EUR', [{ fig: 0, budget: [0, null], share: ['share'] }, { fig: 0, budget: [0, null], share: ['share'] }])).toThrow("XX's incentive has two tiers for one budget");
    for (const path of [['yes'], ['zero']]) expect(() => creditOf(S, 'EUR', { none: { fig: 2, path } }), path.join()).toThrow("XX's research doesn't say it has no incentive");
    expect(() => creditOf(S, 'EUR', { none: { fig: 2, path: ['rebate'] }, rate: 1 })).toThrow("XX's incentive names rate, which the game doesn't read");
    expect(() => creditOf(S, 'EUR', { none: { fig: 2, path: ['rebate'], at: 1 } })).toThrow("XX's none names at, which the game doesn't read");
    expect(() => creditOf(S, 'EUR', { none: 2 })).toThrow("XX's none is not an object");
    expect(() => creditOf(S, 'EUR', 'x')).toThrow("XX's incentive is not an object");

    const half = { fig: 0, budget: [0, 499_999.99], rate: ['share'] };
    const rest = { fig: 0, budget: [500_000, null], rate: { fig: 1, path: ['rate'] } };
    expect(releaseOf(S, 'EUR', null)).toBeNull();
    expect(releaseOf(S, 'EUR', [rest, half])).toEqual([{ budget: [0, 499_999.99], rate: 0.4 }, { budget: [500_000, null], rate: 0.3 }]);
    expect(() => releaseOf(S, 'EUR', [rest, { ...half, budget: [0, 500_000] }])).toThrow("XX's release has two tiers for one budget");
    for (const r of [[], 'x']) expect(() => releaseOf(S, 'EUR', r), JSON.stringify(r)).toThrow("XX's release is a list of tiers");
    expect(() => releaseOf(S, 'EUR', [{ ...half, most: 1 }])).toThrow("XX's release names most, which the game doesn't read");
    expect(() => releaseOf(S, 'EUR', ['x'])).toThrow("XX's release is not an object");
    expect(releaseOf(S, 'EUR', [{ fig: 0, in: 'calibration', budget: [0, null], rate: ['cap'] }])).toEqual([{ budget: [0, null], rate: 0.49 }]);
    expect(() => releaseOf(S, 'EUR', [{ ...half, rate: ['big'] }])).toThrow("XX's release rate 1.5 isn't a rate");
    expect(() => releaseOf(S, 'EUR', [{ budget: [0, null], rate: ['share'] }])).toThrow('XX has no figure undefined');
  });

  it("reads a market: its currency, its terms and what isn't known", () => {
    expect(unknownOf(OWN.blockers)).toEqual(['fund', 'union']);
    expect(unknownOf([])).toEqual([]);
    expect(() => unknownOf([{ item: 'pay' }])).toThrow("a blocker names pay, which isn't a fact the research seeks");
    const reading = {
      currency: 'EUR',
      fund: { rate: { fig: 0, path: ['rate'] }, tiers: [{ budget: [0, null] }] },
      aid: [{ fig: 0, budget: [0, null], share: ['share'] }],
      credit: { none: { fig: 2, path: ['rebate'] } },
      fees: [[{ fig: 0, budget: [0, null], share: ['share'] }], []],
      release: [{ fig: 0, budget: [0, null], rate: ['share'] }],
    };
    expect(marketOf(S, reading)).toEqual({ currency: 'EUR', fund: { rate: 0.25, tiers: [T({ bands: [] })] }, aid: [T()], credit: [], fees: [[T()], []], release: [{ budget: [0, null], rate: 0.4 }], unknown: ['fund', 'union'] });
    expect(marketOf(S, { currency: 'EUR' })).toEqual({ currency: 'EUR', fund: null, aid: [], credit: null, fees: [], release: null, unknown: ['fund', 'union'] });
    expect(() => marketOf(S, { ...reading, fund: null })).toThrow("XX's cap on public aid holds no fund");
    expect(marketOf(S, { ...reading, fund: null, aid: [] }).fund).toBeNull();
    expect(() => marketOf(S, { ...reading, aid: [] })).toThrow("XX's tier gives nothing");
    expect(() => marketOf(S, { ...reading, fees: 'x' })).toThrow("XX's fees are a list");
    expect(() => marketOf(S, { ...reading, fees: ['x'] })).toThrow("XX's fee is a list of tiers");
    expect(() => marketOf(S, { ...reading, aid: 'x' })).toThrow("XX's aid is a list of tiers");
    expect(() => marketOf(S, { ...reading, currency: 'EURO' })).toThrow("XX pays in EURO, which isn't a currency");
    expect(() => marketOf(S, { currency: 'EUR', zone: 'Europe/Paris' })).toThrow("the reading of XX names zone, which the game doesn't read");
    expect(() => marketOf(S, 'x')).toThrow('the reading of XX is not an object');
  });

  it('reads each market as the register cites it, with the calibration, and refuses a file or a reading without the other', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-producer-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
    };
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    const file = (cc: string, blockers: { item: string }[] = []) => JSON.stringify({ ...OWN, country: cc, blockers });
    const reading = { currency: 'CAD', fund: { rate: { fig: 0, in: 'calibration', path: ['rate'] }, tiers: [{ fig: 0, in: 'calibration', budget: [0, null], share: ['cap'], most: ['most'] }] } };
    const cal = JSON.stringify(CAL);
    const aa = file('AA');
    const bb = file('BB', [{ item: 'fund' }]);
    put(CALIBRATION, cal);
    put(`${SOURCES}/producer-AA.json`, aa);
    put(`${SOURCES}/producer-BB.json`, bb);
    // The actor's markets, and anything else, aren't the producer's.
    put(`${SOURCES}/AA.json`, 'not the producer\'s');
    put(`${SOURCES}/director-AA.json`, 'not the producer\'s');
    put(`${SOURCES}/producer-notes.json`, 'not a market');
    put(`${SOURCES}/producer-ZZ.json.bak`, 'not a market');
    put(`${SOURCES}/xproducer-ZZ.json`, 'not a market');
    const cite = (cc: string, text: string) => ({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/producer-${cc}.json`, sha256: sha(text) } });
    const calibrated = { fact: CALIBRATED, value: { file: CALIBRATION, sha256: sha(cal) } };
    const all = [calibrated, cite('AA', aa), cite('BB', bb), { fact: `${BLOCKED}BB` }];
    put('research/register.json', { entries: all });
    put(READINGS, { AA: reading, BB: { currency: 'EUR' } });
    const out = readMarkets(root);
    expect(Object.keys(out)).toEqual(['AA', 'BB']);
    expect(out['AA']).toEqual({ currency: 'CAD', fund: { rate: 0.111, tiers: [T({ bands: [{ from: 0, to: null, rate: 0.49 }], most: 500_000 })] }, aid: [], credit: null, fees: [], release: null, unknown: [] });
    expect(out['BB']?.unknown).toEqual(['fund']);
    expect(serialize(out)).toBe(`${JSON.stringify(out, null, 1)}\n`);
    expect(cited(root, { entries: all as never }, CALIBRATED, CALIBRATION)).toEqual(CAL);
    expect(readResearch(root, { entries: all as never }, 'BB')).toEqual({ research: JSON.parse(bb), blocked: true });
    expect(readResearch(root, { entries: all as never }, 'AA').blocked).toBe(false);
    expect(readResearch(root, { entries: [cite('AA', aa), { fact: 'person.markets.producex.blocked.AA' }] as never }, 'AA').blocked).toBe(false);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), value: { file: `${SOURCES}/producer-BB.json`, sha256: sha(aa) } }] as never }, 'AA')).toThrow(`${SOURCES}/producer-AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ fact: `${FACT}AA` }] as never }, 'AA')).toThrow(`${SOURCES}/producer-AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), fact: `${FACT}BB` }] as never }, 'AA')).toThrow(`${SOURCES}/producer-AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [cite('AA', bb)] as never }, 'AA')).toThrow(`${SOURCES}/producer-AA.json isn't the file the register cites`);
    put(`${SOURCES}/producer-CC.json`, aa);
    expect(() => readResearch(root, { entries: [cite('CC', aa)] as never }, 'CC')).toThrow(`${SOURCES}/producer-CC.json is AA's`);
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/producer-CC.json has no reading`);
    put(READINGS, { AA: reading, BB: { currency: 'EUR' }, CC: reading, DD: reading });
    expect(() => readMarkets(root)).toThrow('DD has a reading and no research');
    put(READINGS, { AA: reading, BB: { currency: 'EUR' }, CC: reading });
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/producer-CC.json isn't cited by the register`);
    put('research/register.json', { entries: all.slice(1) });
    expect(() => readMarkets(root)).toThrow(`${CALIBRATION} isn't cited by the register`);
  });

  it("refuses a market whose blockers the register and the research hold apart, or the UK's", () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-producer-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
    };
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    const cal = JSON.stringify(CAL);
    put(CALIBRATION, cal);
    const set = (files: Record<string, { item: string }[]>, blocked: string[]) => {
      const entries: unknown[] = [{ fact: CALIBRATED, value: { file: CALIBRATION, sha256: sha(cal) } }, ...blocked.map((cc) => ({ fact: `${BLOCKED}${cc}` }))];
      for (const [cc, blockers] of Object.entries(files)) {
        const text = JSON.stringify({ ...OWN, country: cc, blockers });
        put(`${SOURCES}/producer-${cc}.json`, text);
        entries.push({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/producer-${cc}.json`, sha256: sha(text) } });
      }
      put('research/register.json', { entries });
      put(READINGS, Object.fromEntries(Object.keys(files).map((cc) => [cc, { currency: 'EUR' }])));
    };
    set({ AA: [] }, ['AA']);
    expect(() => readMarkets(root)).toThrow("the register holds AA's blockers, which its research doesn't");
    set({ AA: [{ item: 'fund' }] }, []);
    expect(() => readMarkets(root)).toThrow("AA's research has blockers the register doesn't hold");
    set({ AA: [{ item: 'fund' }] }, ['AA']);
    expect(Object.keys(readMarkets(root))).toEqual(['AA']);
    set({ AA: [{ item: 'fund' }], GB: [] }, ['AA']);
    expect(() => readMarkets(root)).toThrow('GB is the market the engine keeps itself');
  });

  it('reads no markets where the research has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-producer-'));
    const put = (path: string, body: string) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), body);
    };
    const cal = JSON.stringify(CAL);
    put(CALIBRATION, cal);
    put('research/register.json', JSON.stringify({ entries: [{ fact: CALIBRATED, value: { file: CALIBRATION, sha256: createHash('sha256').update(cal).digest('hex') } }] }));
    put(READINGS, '{}');
    expect(readMarkets(root)).toEqual({});
    put(READINGS, '[]');
    expect(() => readMarkets(root)).toThrow('the readings is not an object');
  });

  it("compiles the twenty markets the producer's engine reads", () => {
    const markets = readMarkets(ROOT);
    expect(Object.keys(markets)).toEqual(['AU', 'BR', 'CA', 'DE', 'DK', 'ES', 'FR', 'IE', 'IN', 'IT', 'JP', 'KR', 'MX', 'NG', 'NL', 'NO', 'NZ', 'SE', 'US', 'ZA']);
    expect(markets).toEqual(JSON.parse(readFileSync(join(ROOT, OUTPUT), 'utf8')));
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readMarkets(ROOT)));
  });
});

describe("the producer's markets coverage", () => {
  it('is blocked where the register holds a blocker, researched where it cites the research alone, pending where neither', () => {
    const facts = new Map([
      ['person.markets.producer.AA', 'R-1'],
      ['person.markets.producer.BB', 'R-2'],
      ['person.markets.producer.blocked.BB', 'R-3'],
      ['person.markets.producer.blocked.CC', 'R-4'],
    ]);
    const rows = marketsCoverage(['AA', 'BB', 'CC', 'DD'], facts);
    expect(rows).toEqual([
      { key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'BB', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'CC', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'DD', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/person/producing/markets.test.ts::the markets > are each country's own, every term as the research gives it", "tests/person/producing/markets.test.ts::a market's project > is planned, funded and released on its market's terms"]);
    expect(TOLD).toBe("tests/person/producing/markets.test.ts::a market's project > tells the player what of a market isn't known");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'person.producing', axis: 'market', universe: { keys: ['AA', 'BB'] }, rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is built from the compiled markets and the register', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-producer-cov-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(body));
    };
    put(OUTPUT, { AA: {}, BB: {} });
    put('research/register.json', { entries: [{ id: 'R-1', fact: 'person.markets.producer.AA' }, { id: 'R-2', fact: 'person.markets.producer.blocked.BB' }] });
    expect(COVERAGE).toBe('coverage/markets-producer-countries.json');
    expect(coverageOf(root)).toBe(serializeCoverage([{ key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS }, { key: 'BB', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] }]));
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
