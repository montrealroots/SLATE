import { ACTING_START, type ActingSlice } from '../../../src/person/acting/acting.ts';
import { DIRECTING_START, type DirectingSlice } from '../../../src/person/directing/directing.ts';
import type { IdentitySlice } from '../../../src/person/identity/identity.ts';
import type { PermitsSlice } from '../../../src/person/permits/permits.ts';
import { permitsEverywhere } from '../../support/permits.ts';
import { identity } from '../../support/person.ts';
import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, pass, type Life } from '../../../src/core/frame/frame.ts';
import { money, type Money } from '../../../src/core/money/money.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { addMonths } from '../../../src/core/time/dates.ts';
import { ATTRIBUTES, ATTRIBUTES_START, chooseAttributes, componentValues, DAILY, skillOf, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  applyToFunder,
  BFI,
  C,
  CREDIT,
  creditOn,
  crewSkill,
  eye,
  factor,
  FEE_SHARE,
  financed,
  leadSkill,
  MARKET,
  MODEL,
  MONTHS_LEFT,
  OPTION_FEE,
  OPTION_MONTHS,
  optionMaterial,
  PGA,
  pitchSkill,
  planProject,
  planSkill,
  PRODUCER_SHARE,
  PRODUCING_START,
  projectOf,
  raised,
  raiseMoney,
  rateFor,
  record,
  RECOUP,
  RELEASE,
  releaseFilm,
  renewOption,
  sellSkill,
  shootProject,
  target,
  team,
  ZONE,
  type Project,
  type ProducingSlice,
  MODEL_LINE,
} from '../../../src/person/producing/producing.ts';
import { FEATURE_SHOOT } from '../../../src/person/directing/directing.ts';
import { boxOfficeFactor, type GenresSlice } from '../../../src/person/genres/genres.ts';
import { spread } from '../../../src/person/work/work.ts';
import { t } from '../../../src/core/text/text.ts';
import { falsifyAny } from '../../support/falsify-core.ts';
import { ACCOUNT, minorIn, purse } from '../../support/purse.ts';
import { exchangeOn } from '../../../src/money/rates/rates.ts';

type Producing = { attributes: AttributesSlice; producing: ProducingSlice; genres: GenresSlice; identity: IdentitySlice; acting: ActingSlice; directing: DirectingSlice; permits: PermitsSlice } & ReturnType<typeof purse>;
/** The genres the producer loves in these tests, and the one their material is in. */
const LOVED = { loved: ['action', 'documentary', 'family'] };
const GENRE = 'action';
type Broad = 'development' | 'financing' | 'production' | 'leadership' | 'dealmaking' | 'marketing';
const SEED = '0123456789abcdef';
const OTHER = 'fedcba9876543210';
const T0 = daysFromCivil(2026, 11, 1) * SECONDS_PER_DAY;
const BROAD: Broad[] = ['development', 'financing', 'production', 'leadership', 'dealmaking', 'marketing'];
/** Every broad attribute at its own level, so each weight shows in a sum. */
const SPREAD_OUT: Record<Broad, number> = { development: 10, financing: 20, production: 30, leadership: 40, dealmaking: 50, marketing: 60 };
const dr = (seed: string, ...keys: (string | number)[]) => draws(seedFromText(seed), 'producing.work', ...keys);
const u = (x: { float(): number }) => 2 * x.float() - 1;
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const grown = (from: number, days: number) => 100 - (100 - from) * (1 - DAILY) ** days;
const gbp = (pounds: number) => money('GBP', Math.round(pounds * 100));

const made = (all: number, each: Partial<Record<Broad, number>> = {}, seed = SEED, at = T0): Life<Producing> =>
  dispatch(begin(seed, at, { attributes: structuredClone(ATTRIBUTES_START), producing: structuredClone(PRODUCING_START), genres: structuredClone(LOVED), identity: identity(), acting: structuredClone(ACTING_START), directing: structuredClone(DIRECTING_START), permits: permitsEverywhere(), ...purse() }), chooseAttributes, { role: 'producer', all, each });
const v = (l: Life<Producing>) => componentValues(l.slices.attributes, 'producer');
const held = (l: Life<Producing>) => l.slices.attributes['producer'] as Record<string, number>;
const of = (w: Record<string, number>, id: string) => skillOf(w, 'producer', id);
const project = (l: Life<Producing>, id = 1) => projectOf(l.slices.producing, id);
const at = (l: Life<Producing>, to: number) => pass(l, to).life;
/** A life with its producing slice changed by hand. */
const edit = (l: Life<Producing>, f: (s: ProducingSlice) => void): Life<Producing> => {
  const producing = structuredClone(l.slices.producing);
  f(producing);
  return { ...l, slices: { ...l.slices, producing } };
};
const optioned = (all: number, each: Partial<Record<Broad, number>> = {}, days = 30, seed = SEED) => dispatch(made(all, each, seed), optionMaterial, { account: ACCOUNT, days, genre: GENRE });
const planned = (l: Life<Producing>, budget = '2000000', id = l.slices.producing.projects.length) => dispatch(l, planProject, { project: id, budget });
/** Financed by hand: equity closing what the project still needs. */
const funded = (l: Life<Producing>, id = l.slices.producing.projects.length) =>
  edit(l, (s) => {
    const p = projectOf(s, id);
    p.raised['equity'] = money('GBP', target(p) - raised(p));
  });
const shot = (l: Life<Producing>, id = l.slices.producing.projects.length) => dispatch(funded(l, id), shootProject, { project: id, account: ACCOUNT });
/** A film taken to the shoot: optioned, planned and financed. */
const film = (l: Life<Producing>, budget = '2000000') => shot(planned(dispatch(l, optionMaterial, { account: ACCOUNT, days: 10, genre: GENRE }), budget));

/** The script optioned, as the producer's eye picks it from a day's reading each. */
function picked(eyeLevel: number, days: number, id: number, when = T0, seed = SEED): number {
  const off = 100 * (1 - eyeLevel / 100);
  const d = dr(seed, 'option', id, when);
  let best = { worth: 0, judged: -Infinity };
  for (let i = 0; i < days; i += 1) {
    const worth = 100 * d.float();
    const judged = worth + 2 * off * d.float();
    if (judged > best.judged) best = { worth, judged };
  }
  return best.worth;
}

describe('optioning material', () => {
  it("reads a script a day and options the one the eye judges best, on the WGA's terms", () => {
    expect(OPTION_MONTHS).toBe(18);
    expect(OPTION_FEE).toEqual({ currency: 'USD', minor: 922_680 });
    for (const days of [1, 5, 30]) {
      const l = optioned(60, { development: 70 }, days);
      const e = eye(v(made(60, { development: 70 })));
      expect(project(l), String(days)).toEqual({ id: 1, optioned: T0, genre: GENRE, market: 'GB', expires: addMonths(ZONE, T0, 18), options: [OPTION_FEE], material: picked(e, days, 1), plan: null, applied: false, raised: {}, shot: null, release: null });
      expect(held(l)['development']).toBeCloseTo(grown(70, days), 10);
      expect(held(l)['financing']).toBe(60);
    }
    expect(addMonths(ZONE, T0, 18)).toBe(daysFromCivil(2028, 5, 1) * SECONDS_PER_DAY - 3600);
  });

  it('judges with the eye of choosing the material: blind at 0, true at 100', () => {
    const w = v(made(50, { development: 80, leadership: 20 }));
    expect(eye(w)).toBe(of(w, C.select));
    const worths = (() => {
      const d = dr(SEED, 'option', 1, T0);
      return Array.from({ length: 40 }, () => {
        const x = 100 * d.float();
        d.float();
        return x;
      });
    })();
    expect(project(optioned(100, {}, 40)).material).toBe(Math.max(...worths));
    expect(project(optioned(0, {}, 40)).material).toBe(picked(0, 40, 1));
    expect(project(optioned(0, {}, 40)).material).not.toBe(Math.max(...worths));
  });

  it('numbers each project and is refused for days that are not whole', () => {
    const two = dispatch(optioned(50), optionMaterial, { account: ACCOUNT, days: 3, genre: GENRE });
    expect(project(two, 2).material).toBe(picked(eye(v(two)), 3, 2));
    expect(two.slices.producing.projects.map((p) => p.id)).toEqual([1, 2]);
    let ones = made(30);
    for (let i = 0; i < 12; i += 1) ones = dispatch(ones, optionMaterial, { account: ACCOUNT, days: 1, genre: GENRE });
    expect(ones.slices.producing.projects.map((p) => p.material)).toEqual(Array.from({ length: 12 }, (_, i) => picked(eye(v(made(30))), 1, i + 1)));
    expect(() => project(two, 3)).toThrow("there's no project 3");
    expect(() => dispatch(made(50), optionMaterial, { account: ACCOUNT, days: 0, genre: GENRE })).toThrow('the days given are a whole number of at least 1 (0)');
    const broke = made(50);
    expect(() => dispatch({ ...broke, slices: { ...broke.slices, ...purse('USD', 922_679) } }, optionMaterial, { account: ACCOUNT, days: 1, genre: GENRE })).toThrow("everyday:1 can't cover an option");
    expect(minorIn(optioned(50).slices.ledger, ACCOUNT)).toBe(100_000_000 - 922_680);
    expect(() => dispatch(made(50), optionMaterial, { account: ACCOUNT, days: 1.5, genre: GENRE })).toThrow(RangeError);
    expect(() => dispatch(made(50), optionMaterial, { account: ACCOUNT, days: 3, genre: 'western' })).toThrow("Western isn't a genre the person loves");
  });

  it('producing.option: a better eye options a better script', () => {
    const total = (n: number) => {
      let l = made(50, { development: n });
      for (let i = 0; i < 12; i += 1) l = dispatch(l, optionMaterial, { account: ACCOUNT, days: 5, genre: GENRE });
      return l.slices.producing.projects.reduce((t, p) => t + p.material, 0);
    };
    falsifyAny({ feature: 'producing.option', claim: 'bites', says: 'a producer at 100 in Development options better scripts, a dozen from five days of reading each, than one at 0', base: 0, twin: 100, outcome: total });
  });
});

describe('renewing an option', () => {
  it('adds 18 months from when it would lapse, at another 10%, while it runs', () => {
    const l = optioned(50);
    const expires = project(l).expires;
    const renewed = dispatch(at(l, expires), renewOption, { project: 1, account: ACCOUNT });
    expect(project(renewed).expires).toBe(addMonths(ZONE, expires, 18));
    expect(project(renewed).options).toEqual([OPTION_FEE, OPTION_FEE]);
    // Each payment from the account named, to the material's owner.
    expect([minorIn(renewed.slices.ledger, ACCOUNT), minorIn(renewed.slices.ledger, 'world:rights holder:USD')]).toEqual([100_000_000 - 2 * 922_680, 2 * 922_680]);
    const short = { ...l, slices: { ...l.slices, ...purse('USD', 0) } };
    expect(() => dispatch(at(short, expires), renewOption, { project: 1, account: ACCOUNT })).toThrow('everyday:1 can\'t cover an option renewed');
    expect(renewed.slices.attributes).toEqual(l.slices.attributes);
    expect(() => dispatch(at(l, expires + 1), renewOption, { project: 1, account: ACCOUNT })).toThrow("project 1's option has lapsed");
    expect(() => dispatch(film(made(50)), renewOption, { project: 1, account: ACCOUNT })).toThrow("project 1's rights are bought");
    expect(() => dispatch(l, renewOption, { project: 2, account: ACCOUNT })).toThrow("there's no project 2");
  });

  it('producing.renew: a renewed option runs longer', () => {
    falsifyAny({ feature: 'producing.renew', claim: 'bites', says: 'an option renewed once runs 18 months past one never renewed', base: 0, twin: 1, outcome: (n) => project(n === 0 ? optioned(50) : dispatch(optioned(50), renewOption, { project: 1, account: ACCOUNT })).expires });
  });
});

describe('budgeting and scheduling', () => {
  it("schedules the days the script needs, around the CNC's 32, nearer the need with a better plan", () => {
    expect(FEATURE_SHOOT).toBe(32);
    expect(MODEL).toEqual({ misjudged: 100, planned: 0.3, need: 0.25, falter: 0.5, daily: 1 / 30, record: 0.1 });
    for (const [seed, level] of [[SEED, 0], [SEED, 40], [OTHER, 75], [OTHER, 100]] as const) {
      const l = planned(optioned(50, { production: level, financing: 100 - level }, 5, seed));
      const d = dr(seed, 'plan', 1);
      const needed = Math.round(32 * (1 + 0.25 * u(d)));
      const k = planSkill(v(optioned(50, { production: level, financing: 100 - level }, 5, seed)));
      expect(project(l).plan, `${seed} ${level}`).toMatchObject({ needed, scheduled: Math.round(needed * (1 + 0.3 * (1 - k / 100) * u(d))) });
    }
    const top = project(planned(optioned(100))).plan;
    expect(top?.scheduled).toBe(top?.needed);
    const w = v(made(50, SPREAD_OUT));
    expect(planSkill(w)).toBeCloseTo(0.5 * of(w, C.plan) + 0.5 * of(w, C.costs), 12);
  });

  it("carries the producer's fee at the BFI's 7.5% of direct costs, and the UK's credit", () => {
    expect(FEE_SHARE).toBe(0.075);
    const l = planned(optioned(50), '2150000');
    expect(project(l).plan).toMatchObject({ budget: gbp(2_150_000), fee: gbp(150_000), credit: gbp(2_150_000 * 0.8 * 0.53) });
    expect(project(planned(optioned(50), '1000000.01')).plan?.fee).toEqual(money('GBP', Math.round((100_000_001 * 0.075) / 1.075)));
    expect(held(l)['production']).toBeCloseTo(grown(50, 1), 10);
    expect(held(l)['financing']).toBeCloseTo(grown(50, 1), 10);
    expect(held(l)['development']).toBeCloseTo(grown(50, 30), 10);
  });

  it("credits 53% of 80% to £15m (the IFTC, at most £6.36m) and 34% of 80% above (the AVEC)", () => {
    expect(CREDIT).toEqual({ core: 0.8, independent: 0.53, ceiling: 15_000_000, film: 0.34 });
    expect(creditOn(gbp(2_000_000))).toEqual(gbp(848_000));
    expect(creditOn(gbp(15_000_000))).toEqual(gbp(6_360_000));
    expect(creditOn(money('GBP', 1_500_000_001))).toEqual(money('GBP', 408_000_000));
    expect(creditOn(gbp(20_000_000))).toEqual(gbp(5_440_000));
  });

  it('is refused twice, under £1, or for an amount that is not one', () => {
    const l = planned(optioned(50));
    expect(() => planned(l)).toThrow('project 1 is planned');
    expect(() => planned(optioned(50), '0.99')).toThrow('a budget is at least 1 GBP (0.99)');
    expect(() => planned(optioned(50), '-5')).toThrow('a budget is at least 1 GBP (-5)');
    expect(project(planned(optioned(50), '1')).plan?.budget).toEqual(gbp(1));
    expect(() => planned(optioned(50), 'lots')).toThrow('"lots" is not an amount');
    expect(() => planned(optioned(50), '2', 4)).toThrow("there's no project 4");
  });

  it('producing.plan: a better plan schedules nearer the need', () => {
    const gap = (n: number) => {
      let l = made(50, { production: n, financing: n });
      for (let i = 0; i < 12; i += 1) l = planned(dispatch(l, optionMaterial, { account: ACCOUNT, days: 1, genre: GENRE }));
      return l.slices.producing.projects.reduce((t, p) => t + Math.abs((p.plan?.scheduled ?? 0) - (p.plan?.needed ?? 0)), 0);
    };
    falsifyAny({ feature: 'producing.plan', claim: 'bites', says: 'a producer at 0 in Production and Financing schedules a dozen projects off their need; one at 100 schedules each to it', base: 0, twin: 100, outcome: gap });
  });
});

describe('financing', () => {
  it('takes a project by its script, the pitch and the record of films released in the PGA\'s seven years', () => {
    expect(PGA).toEqual({ features: 2, years: 7 });
    const w = v(made(50, SPREAD_OUT));
    expect(pitchSkill(w)).toBeCloseTo(0.3 * of(w, C.pitch) + 0.2 * of(w, C.arrange) + 0.1 * of(w, C.adequacy) + 0.2 * of(w, C.network) + 0.1 * of(w, C.communicator) + 0.1 * of(w, 'negotiation'), 12);
    const l = optioned(50, SPREAD_OUT);
    const p = project(l);
    expect(factor(l.slices.producing, w, p, T0)).toBeCloseTo(0.5 + (0.5 * p.material + 0.5 * pitchSkill(w)) / 100, 12);
    const since = addMonths(ZONE, T0, -84);
    const released = (when: number, cinema = true): Project => ({ ...p, release: { at: when, cinema, doubled: false } });
    const s = (...ps: Project[]): ProducingSlice => ({ projects: [p, ...ps] });
    expect(record(s(released(since)), T0)).toBe(1);
    expect(record(s(released(since - 1)), T0)).toBe(0);
    expect(record(s(released(T0, false)), T0)).toBe(0);
    expect(record(s(released(T0), released(T0 - 10)), T0)).toBe(2);
    expect(factor(s(released(T0)), w, p, T0)).toBeCloseTo(0.6 + (0.5 * p.material + 0.5 * pitchSkill(w)) / 100, 12);
    expect(factor(s(released(T0), released(T0), released(T0)), w, p, T0)).toBeCloseTo(0.7 + (0.5 * p.material + 0.5 * pitchSkill(w)) / 100, 12);
  });

  it("asks the BFI once: a yes at its 13% as the package sells it, an award of 22% of the budget up to £1.25m", () => {
    expect(BFI).toEqual({ rate: 0.13, share: 0.22, most: 1_250_000 });
    let l = made(90);
    const budgets = ['2000000', '10000000'];
    for (let i = 0; i < 40; i += 1) l = planned(dispatch(l, optionMaterial, { account: ACCOUNT, days: 5, genre: GENRE }), budgets[i % 2]);
    const awards: (number | undefined)[] = [];
    for (let id = 1; id <= 40; id += 1) {
      const p = project(l, id);
      const yes = dr(SEED, 'apply', id).float() < 0.13 * factor(l.slices.producing, v(l), p, T0);
      l = dispatch(l, applyToFunder, { project: id });
      expect(project(l, id).applied).toBe(true);
      expect(project(l, id).raised['bfi'], String(id)).toEqual(yes ? gbp(id % 2 === 1 ? 440_000 : 1_250_000) : undefined);
      awards.push(project(l, id).raised['bfi']?.minor);
    }
    expect(awards).toContain(44_000_000);
    expect(awards).toContain(125_000_000);
    expect(held(l)['development']).toBeGreaterThan(grown(90, 200));
    expect(held(dispatch(planned(optioned(50)), applyToFunder, { project: 1 }))['dealmaking']).toBeCloseTo(grown(50, 1), 10);
  });

  it('is refused twice, before a budget, with under ten months on the option, or once financed', () => {
    const l = planned(optioned(50));
    const expires = project(l).expires;
    expect(MONTHS_LEFT).toBe(10);
    expect(() => dispatch(dispatch(l, applyToFunder, { project: 1 }), applyToFunder, { project: 1 })).toThrow('project 1 has applied');
    expect(() => dispatch(optioned(50), applyToFunder, { project: 1 })).toThrow('project 1 has no budget');
    const tenLeft = addMonths(ZONE, T0, 8);
    expect(addMonths(ZONE, tenLeft, 10)).toBe(expires);
    expect(project(dispatch(at(l, tenLeft), applyToFunder, { project: 1 })).applied).toBe(true);
    expect(() => dispatch(at(l, tenLeft + 1), applyToFunder, { project: 1 })).toThrow("project 1's option has under 10 months left");
    expect(() => dispatch(funded(l), applyToFunder, { project: 1 })).toThrow('project 1 is financed');
  });

  it("is financed when the sources close all but the producer's own 18%: the credit, the BFI, broadcasters, pre-sales, equity", () => {
    expect(MARKET).toEqual({ broadcaster: 0.18, 'pre-sales': 0.14, equity: null });
    expect(PRODUCER_SHARE).toBe(0.18);
    const p = project(planned(optioned(50)));
    expect(target(p)).toBe(164_000_000);
    expect(raised(p)).toBe(84_800_000);
    expect(financed(p)).toBe(false);
    const with_ = (r: Record<string, number>) => ({ ...p, raised: Object.fromEntries(Object.entries(r).map(([k, n]) => [k, money('GBP', n)])) });
    expect(raised(with_({ bfi: 44_000_000, broadcaster: 36_000_000 }))).toBe(164_800_000);
    expect(financed(with_({ equity: 79_200_000 }))).toBe(true);
    expect(financed(with_({ equity: 79_199_999 }))).toBe(false);
    expect(() => raised(project(optioned(50)))).toThrow('project 1 has no budget');
  });

  it('raises the rest from the market, a source a day at a time as the package sells it, until financed', () => {
    const replay = (l: Life<Producing>, days: number) => {
      const p = project(l);
      const budget = p.plan?.budget.minor ?? 0;
      const t = budget - Math.round(budget * 0.18);
      const got: Record<string, number> = Object.fromEntries(Object.entries(p.raised).map(([k, m]) => [k, m.minor]));
      const sum = () => (p.plan?.credit?.minor ?? 0) + Object.values(got).reduce((a, b) => a + b, 0);
      const chance = (1 / 30) * factor(l.slices.producing, v(l), p, l.frame.now);
      const d = dr(SEED, 'raise', p.id, l.frame.now);
      for (let i = 0; i < days && sum() < t; i += 1) {
        if (d.float() >= chance) continue;
        const next = (['broadcaster', 'pre-sales', 'equity'] as const).find((k) => !(k in got)) as string;
        got[next] = next === 'equity' ? t - sum() : Math.round(budget * (next === 'broadcaster' ? 0.18 : 0.14));
      }
      return Object.fromEntries(Object.entries(got).map(([k, n]) => [k, money('GBP', n)]));
    };
    const base = planned(optioned(80));
    const withBfi = edit(base, (s) => {
      projectOf(s, 1).raised['bfi'] = gbp(440_000);
    });
    const seen = new Set<string>();
    for (const l of [base, withBfi]) {
      for (let days = 1; days <= 150; days += 1) {
        const after = project(dispatch(l, raiseMoney, { project: 1, days }));
        expect(after.raised, String(days)).toEqual(replay(l, days));
        seen.add(Object.keys(after.raised).join());
      }
    }
    expect(seen).toContain('broadcaster,pre-sales,equity');
    expect(seen).toContain('bfi,broadcaster');
    expect(project(dispatch(base, raiseMoney, { project: 1, days: 400 })).raised['equity']).toEqual(money('GBP', 164_000_000 - 84_800_000 - 36_000_000 - 28_000_000));
    const after = dispatch(base, raiseMoney, { project: 1, days: 9 });
    expect(held(after)['financing']).toBeCloseTo(grown(held(base)['financing'] as number, 9), 10);
    expect(held(after)['dealmaking']).toBeCloseTo(grown(held(base)['dealmaking'] as number, 9), 10);
    expect(() => dispatch(funded(base), raiseMoney, { project: 1, days: 3 })).toThrow('project 1 is financed');
    expect(() => dispatch(at(base, project(base).expires + 1), raiseMoney, { project: 1, days: 3 })).toThrow("project 1's option has lapsed");
    expect(() => dispatch(base, raiseMoney, { project: 1, days: 0 })).toThrow(RangeError);
  });

  it('producing.apply: a better package is funded more often', () => {
    const yeses = (n: number) => {
      let l = made(50, { dealmaking: n, development: n });
      for (let i = 0; i < 40; i += 1) l = planned(dispatch(l, optionMaterial, { account: ACCOUNT, days: 5, genre: GENRE }));
      for (let id = 1; id <= 40; id += 1) l = dispatch(l, applyToFunder, { project: id });
      return l.slices.producing.projects.filter((p) => 'bfi' in p.raised).length;
    };
    falsifyAny({ feature: 'producing.apply', claim: 'bites', says: 'a producer at 100 in Dealmaking and Development is funded by the BFI on more of 40 projects than one at 0', base: 0, twin: 100, outcome: yeses });
  });

  it('producing.raise: a better financier closes more of the market in a season', () => {
    const closed = (n: number) => {
      let l = made(50, { financing: n, dealmaking: n });
      for (let i = 0; i < 12; i += 1) l = planned(dispatch(l, optionMaterial, { account: ACCOUNT, days: 1, genre: GENRE }));
      for (let id = 1; id <= 12; id += 1) l = dispatch(l, raiseMoney, { project: id, days: 60 });
      return l.slices.producing.projects.reduce((t, p) => t + Object.keys(p.raised).length, 0);
    };
    falsifyAny({ feature: 'producing.raise', claim: 'bites', says: 'a producer at 100 in Financing and Dealmaking closes more sources on a dozen projects in 60 days each than one at 0', base: 0, twin: 100, outcome: closed });
  });
});

describe('the shoot', () => {
  it("slips where the team falters, the days past the schedule at the budget's day rate, taken from the fee first", () => {
    const w = v(made(50, SPREAD_OUT));
    expect(crewSkill(w)).toBeCloseTo(0.4 * of(w, C.hire) + 0.2 * of(w, 'coordination') + 0.2 * of(w, 'time-management') + 0.2 * of(w, 'attention-to-detail'), 12);
    expect(leadSkill(w)).toBeCloseTo(0.4 * of(w, C.lead) + 0.2 * of(w, 'stress-tolerance') + 0.2 * of(w, 'complex-problem-solving') + 0.2 * of(w, 'adaptability'), 12);
    expect(team(w)).toBeCloseTo((crewSkill(w) + leadSkill(w)) / 2, 12);
    for (const [all, scheduled] of [[20, 30], [60, 30], [100, 40], [35, 2], [100, 20]] as const) {
      const ready = funded(edit(planned(optioned(all, { leadership: 100 - all })), (s) => {
        const plan = projectOf(s, 1).plan;
        if (plan !== null) plan.scheduled = scheduled;
      }));
      const p = project(ready);
      const k = team(v(ready));
      const d = dr(SEED, 'shoot', 1);
      const days = Math.ceil((p.plan?.needed ?? 0) * (1 + 0.5 * (1 - k / 100) * d.float()));
      const overrun = (Math.max(0, days - scheduled) * 200_000_000) / scheduled;
      const quality = clamp(0.5 * p.material + 0.5 * k + spread(k) * u(d));
      const l = dispatch(ready, shootProject, { project: 1, account: ACCOUNT });
      const fee = p.plan?.fee?.minor ?? 0;
      expect(project(l).shot, `${all} ${scheduled}`).toEqual({ at: T0, days, overrun: money('GBP', Math.round(overrun)), fee: money('GBP', Math.round(Math.max(0, fee - overrun))), quality });
      expect(held(l)['production']).toBeCloseTo(grown(held(ready)['production'] as number, days), 10);
      expect(held(l)['leadership']).toBeCloseTo(grown(held(ready)['leadership'] as number, days), 10);
    }
    const top = project(shot(planned(optioned(100))));
    expect(top.shot?.days).toBe(top.plan?.needed);
    expect(top.shot?.overrun).toEqual(gbp(0));
    expect(top.shot?.fee).toEqual(top.plan?.fee);
    // The fee is paid into the account named, carried from pounds at the day's rate: a US producer in the UK has nothing withheld.
    const paid = shot(planned(optioned(100)));
    const pounds = top.shot?.fee as Money;
    expect(paid.slices.tax.paid.map((x) => [x.what, x.work, x.country, x.gross, x.tax, x.social])).toEqual([["producer's fee", 'producer', 'GB', pounds.minor, 0, 0]]);
    expect(minorIn(paid.slices.ledger, 'world:production:GBP')).toBe(-pounds.minor);
    expect(minorIn(paid.slices.ledger, ACCOUNT)).toBe(100_000_000 - 922_680 + (exchangeOn(pounds, 'USD', '2026-11-01')?.money.minor as number));
  });

  it('is refused before it is financed or once the option lapses', () => {
    const l = planned(optioned(50));
    expect(() => dispatch(l, shootProject, { project: 1, account: ACCOUNT })).toThrow("project 1 isn't financed");
    expect(() => dispatch(optioned(50), shootProject, { project: 1, account: ACCOUNT })).toThrow('project 1 has no budget');
    expect(() => dispatch(at(funded(l), project(l).expires + 1), shootProject, { project: 1, account: ACCOUNT })).toThrow("project 1's option has lapsed");
    expect(project(dispatch(at(funded(l), project(l).expires), shootProject, { project: 1, account: ACCOUNT })).shot).not.toBeNull();
  });

  it('producing.shoot: a better team keeps the shoot to its days', () => {
    falsifyAny({ feature: 'producing.shoot', claim: 'bites', says: 'a producer at 0 in Leadership and Production takes more days to shoot the same script than one at 100', base: 0, twin: 100, outcome: (n) => project(shot(planned(optioned(50, { leadership: n, production: n })))).shot?.days });
  });
});

describe('the release', () => {
  it("is at the BFI's rates by budget: a cinema release 11.6% under £0.5m to 83.3% above £10m, twice the budget back 3.3% to 14.8%", () => {
    expect(RELEASE).toEqual([[500_000, 0.116], [2_000_000, 0.379], [5_000_000, 0.592], [10_000_000, 0.714], [Infinity, 0.833]]);
    expect(RECOUP).toEqual([[500_000, 0.033], [2_000_000, 0.049], [5_000_000, 0.087], [Infinity, 0.148]]);
    expect(rateFor(RELEASE, money('GBP', 49_999_999))).toBe(0.116);
    expect(rateFor(RELEASE, gbp(500_000))).toBe(0.379);
    expect(rateFor(RELEASE, gbp(2_000_000))).toBe(0.592);
    expect(rateFor(RELEASE, gbp(5_000_000))).toBe(0.714);
    expect(rateFor(RELEASE, gbp(10_000_000))).toBe(0.833);
    expect(rateFor(RECOUP, money('GBP', 499_999_999))).toBe(0.087);
    expect(rateFor(RECOUP, gbp(5_000_000))).toBe(0.148);
    const w = v(made(50, SPREAD_OUT));
    expect(sellSkill(w, 40)).toBeCloseTo(0.5 * 40 + 0.5 * (0.7 * of(w, C.marketing) + 0.3 * of(w, 'communications-and-media')), 12);
  });

  it('releases as the film and its campaign sell it, and teaches Marketing', () => {
    let l = made(70);
    for (let i = 0; i < 40; i += 1) l = film(l, i % 2 === 0 ? '20000000' : '300000');
    const seen = new Set<string>();
    for (let id = 1; id <= 40; id += 1) {
      const p = project(l, id);
      const f = 0.5 + sellSkill(v(l), p.shot?.quality ?? 0) / 100;
      const d = dr(SEED, 'release', id);
      const big = id % 2 === 1;
      const cinema = d.float() < (big ? 0.833 : 0.116) * f;
      const doubled = cinema && d.float() < (big ? 0.148 : 0.033) * f * boxOfficeFactor(GENRE);
      const before = held(l)['marketing'] as number;
      l = dispatch(l, releaseFilm, { project: id });
      expect(project(l, id).release, String(id)).toEqual({ at: T0, cinema, doubled });
      expect(held(l)['marketing']).toBeCloseTo(grown(before, 1), 10);
      seen.add(`${cinema} ${doubled}`);
    }
    expect(seen).toEqual(new Set(['true true', 'true false', 'false false']));
  });

  it('is refused before the shoot, or twice', () => {
    const l = planned(optioned(50));
    expect(() => dispatch(l, releaseFilm, { project: 1 })).toThrow("project 1 isn't shot");
    const once = dispatch(film(made(50)), releaseFilm, { project: 1 });
    expect(() => dispatch(once, releaseFilm, { project: 1 })).toThrow('project 1 is released');
  });

  it('counts toward how financiers take the next project', () => {
    let l = made(100);
    for (let i = 0; i < 6; i += 1) l = dispatch(film(l, '20000000'), releaseFilm, { project: i + 1 });
    const n = l.slices.producing.projects.filter((p) => p.release?.cinema === true).length;
    expect(n).toBeGreaterThanOrEqual(2);
    const next = dispatch(l, optionMaterial, { account: ACCOUNT, days: 5, genre: GENRE });
    const p = project(next, 7);
    expect(factor(next.slices.producing, v(next), p, T0)).toBeCloseTo(0.7 + (0.5 * p.material + 0.5 * pitchSkill(v(next))) / 100, 12);
  });

  it('producing.release: a better campaign gets more films into cinemas', () => {
    const released = (n: number) => {
      let l = made(50, { marketing: n });
      for (let i = 0; i < 20; i += 1) l = dispatch(film(l, '1000000'), releaseFilm, { project: i + 1 });
      return l.slices.producing.projects.filter((p) => p.release?.cinema === true).length;
    };
    falsifyAny({ feature: 'producing.release', claim: 'bites', says: 'a producer at 100 in Marketing gets more of 20 films a cinema release than one at 0', base: 0, twin: 100, outcome: released });
  });
});

describe('the producer', () => {
  it('reads each of the six broad attributes through its components', () => {
    expect(ATTRIBUTES.producer.map((a) => a.id)).toEqual(BROAD);
    const of_ = (broad: Broad, n: number) => v(made(50, { [broad]: n }));
    expect(eye(of_('development', 90))).toBeGreaterThan(eye(of_('development', 10)));
    expect(planSkill(of_('financing', 90))).toBeGreaterThan(planSkill(of_('financing', 10)));
    expect(planSkill(of_('production', 90))).toBeGreaterThan(planSkill(of_('production', 10)));
    expect(team(of_('leadership', 90))).toBeGreaterThan(team(of_('leadership', 10)));
    expect(pitchSkill(of_('dealmaking', 90))).toBeGreaterThan(pitchSkill(of_('dealmaking', 10)));
    expect(sellSkill(of_('marketing', 90), 50)).toBeGreaterThan(sellSkill(of_('marketing', 10), 50));
  });

  it('at 100 throughout gets the top of what is real; at 50 the trade\'s own rates; at 10 worse', () => {
    const go = (all: number) => {
      const l = film(made(all), '3000000');
      const p = project(l);
      return { material: p.material, over: (p.shot?.days ?? 0) - (p.plan?.needed ?? 0), quality: p.shot?.quality ?? 0, f: 0.5 + sellSkill(v(l), p.shot?.quality ?? 0) / 100 };
    };
    const [top, mid, low] = [go(100), go(50), go(10)];
    expect(top.material).toBeGreaterThan(90);
    expect(top.over).toBe(0);
    expect(top.quality).toBeGreaterThan(90);
    expect(top.f).toBeGreaterThan(1.4);
    expect(Math.abs(mid.f - 1)).toBeLessThan(0.15);
    expect(low.f).toBeLessThan(mid.f);
    expect(low.quality).toBeLessThan(mid.quality);
    expect(mid.quality).toBeLessThan(top.quality);
  });

  it('is the same for the same life and differs for another', () => {
    const run = (seed: string) => {
      let l = planned(optioned(50, {}, 30, seed));
      l = dispatch(l, applyToFunder, { project: 1 });
      l = dispatch(l, raiseMoney, { project: 1, days: 200 });
      l = dispatch(l, shootProject, { project: 1, account: ACCOUNT });
      return project(dispatch(l, releaseFilm, { project: 1 }));
    };
    expect(run(SEED)).toEqual(run(SEED));
    expect(run(OTHER)).not.toEqual(run(SEED));
    expect(project(optioned(50, {}, 30, OTHER)).material).not.toBe(project(optioned(50)).material);
  });

  it("tells the player its own figures are the game's", () => {
    expect(MODEL_LINE).toBe('producing.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own reckoning");
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(PRODUCING_START).toEqual({ projects: [] });
    expect(commandIndex().filter((x) => x.id.startsWith('producing.'))).toEqual([
      { id: 'producing.option', reads: ['genres'], writes: ['attributes', 'producing', 'accounts', 'ledger'] },
      { id: 'producing.renew', reads: [], writes: ['producing', 'accounts', 'ledger'] },
      { id: 'producing.plan', reads: [], writes: ['attributes', 'producing'] },
      { id: 'producing.apply', reads: [], writes: ['attributes', 'producing'] },
      { id: 'producing.raise', reads: [], writes: ['attributes', 'producing'] },
      { id: 'producing.shoot', reads: ['identity', 'acting', 'directing', 'permits'], writes: ['attributes', 'producing', 'accounts', 'ledger', 'tax', 'schedule'] },
      { id: 'producing.release', reads: [], writes: ['attributes', 'producing'] },
    ]);
    const bare = begin(SEED, T0, { attributes: structuredClone(ATTRIBUTES_START), producing: structuredClone(PRODUCING_START), genres: structuredClone(LOVED), identity: identity(), acting: structuredClone(ACTING_START), directing: structuredClone(DIRECTING_START), permits: permitsEverywhere(), ...purse() });
    expect(() => dispatch(bare, optionMaterial, { account: ACCOUNT, days: 3, genre: GENRE })).toThrow("the producer's attributes haven't been chosen");
  });
});
