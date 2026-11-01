import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor } from '../../../src/core/money/money.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { ATTRIBUTES, ATTRIBUTES_START, broadOf, chooseAttributes, componentValues, DAILY, skillOf, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  ACTING_START,
  ACTRA,
  ACTRA_FEW_LINES,
  auditionForPart,
  auditionOf,
  auditionSkill,
  BOOKING,
  bookingChance,
  CRAFT,
  credit,
  dateOf,
  daysWorked,
  demands,
  MEDIUM,
  PACT,
  PACT_FLOOR,
  partOf,
  partSkill,
  pay,
  playPart,
  rateAt,
  ROOM,
  SAG,
  SAG_TIERS,
  scaleOf,
  STAGE,
  TAPED,
  UK_THEATRE,
  WEEK_DAYS,
  type ActingSlice,
  type Audition,
  type Part,
  MODEL_LINE,
} from '../../../src/person/acting/acting.ts';
import { spread } from '../../../src/person/work/work.ts';
import { t } from '../../../src/core/text/text.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

type Acting = { attributes: AttributesSlice; acting: ActingSlice };
const SEED = '0123456789abcdef';
const OTHER = 'fedcba9876543210';
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
const AUGUST = day(2026, 8, 1);
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const grown = (from: number, days: number) => 100 - (100 - from) * (1 - DAILY) ** days;
const usd = (n: string) => fromMajor('USD', n);
const gbp = (n: string) => fromMajor('GBP', n);
const cad = (n: string) => fromMajor('CAD', n);

/** Levels by broad attribute over one level for all. */
const made = (all: number, each: Record<string, number> = {}, seed = SEED, now = AUGUST): Life<Acting> =>
  dispatch(begin(seed, now, { attributes: structuredClone(ATTRIBUTES_START), acting: structuredClone(ACTING_START) }), chooseAttributes, { role: 'actor', all, each });
const part = (p: Partial<Part> = {}): Part => ({ agreement: 'sag-aftra', budget: 5_000_000, seats: 0, lines: 20, term: 'day', length: 3, rehearsal: 0, asks: [], ...p });
const v = (l: Life<Acting>) => componentValues(l.slices.attributes, 'actor');
const held = (l: Life<Acting>) => l.slices.attributes['actor'] as Record<string, number>;
const auditions = (l: Life<Acting>) => l.slices.acting.auditions;
const withAuditions = (l: Life<Acting>, list: Audition[]): Life<Acting> => ({ ...l, slices: { ...l.slices, acting: { auditions: list } } });
const booked = (p: Part, id = 1, quality: number | null = null): Audition => ({ id, at: 0, part: p, taped: true, score: 50, booked: true, work: quality === null ? null : { at: 0, quality, pay: null } });
const broadIds = ATTRIBUTES.actor.map((a) => a.id);

describe('a part', () => {
  it('asks the craft every role uses, its medium, its lines, and what else it calls for', () => {
    expect(CRAFT).toEqual(['acting-techniques', 'understanding-character-and-situation', 'text-analysis', 'own-interpretation', 'research-roles', 'study-roles-from-scripts', 'ability-to-take-direction', 'konzentrationsf-higkeit']);
    expect(MEDIUM).toEqual({ screen: ['acting-for-the-camera'], stage: ['appropriation-d-espace-sc-nique', 'speaking'] });
    expect(STAGE).toEqual(['uk-theatre']);
    expect(demands(part())).toEqual([...CRAFT, 'memorise-lines', 'acting-for-the-camera']);
    expect(demands(part({ lines: 0 }))).toEqual([...CRAFT, 'acting-for-the-camera']);
    expect(demands(part({ lines: 1 }))).toContain('memorise-lines');
    expect(demands(part({ agreement: 'uk-theatre', term: 'week', asks: ['singing', 'speaking', 'dance'] }))).toEqual([...CRAFT, 'memorise-lines', 'appropriation-d-espace-sc-nique', 'speaking', 'singing', 'dance']);
    expect(() => demands(part({ asks: ['juggling'] }))).toThrow('actor has no component juggling');
  });

  it('is played as well as the actor is in each component it asks, equally', () => {
    const w = v(made(50, { acting: 90, voice: 10, physicality: 70 }));
    const p = part({ asks: ['singing', 'dance'] });
    expect(partSkill(w, p)).toBeCloseTo(mean(demands(p).map((id) => skillOf(w, 'actor', id))), 10);
    expect(partSkill(w, p)).not.toBeCloseTo(partSkill(w, part()), 3);
  });

  it('reads every one of the actor\'s broad attributes, through the audition or the part', () => {
    expect(broadIds).toEqual(['acting', 'memorization', 'voice', 'physicality', 'camera', 'direction', 'auditioning']);
    const p = part({ asks: ['singing', 'dance'] });
    for (const id of broadIds) expect(auditionSkill(v(made(50, { [id]: 90 })), p, true), id).toBeGreaterThan(auditionSkill(v(made(50, { [id]: 20 })), p, true));
    for (const id of broadIds) expect(partSkill(v(made(50, { [id]: 90 })), p), id).toBeGreaterThan(partSkill(v(made(50, { [id]: 20 })), p));
  });

  it('is held to what an engagement can be', () => {
    expect(partOf(part())).toEqual(part());
    expect(() => partOf(part({ agreement: 'wga' as 'actra' }))).toThrow("there's no agreement wga");
    expect(() => partOf(part({ term: 'month' as 'day' }))).toThrow("there's no term month");
    expect(() => partOf(part({ budget: -1 }))).toThrow('the budget must be a whole number of at least 0 (-1)');
    expect(() => partOf(part({ budget: 1.5 }))).toThrow(RangeError);
    expect(() => partOf(part({ seats: -1 }))).toThrow('the seats must be a whole number of at least 0 (-1)');
    expect(() => partOf(part({ lines: -1 }))).toThrow('the lines must be a whole number of at least 0 (-1)');
    expect(() => partOf(part({ length: 0 }))).toThrow('the length must be a whole number of at least 1 (0)');
    expect(() => partOf(part({ rehearsal: -1 }))).toThrow('the rehearsal must be a whole number of at least 0 (-1)');
    expect(partOf(part({ budget: 0, lines: 0, length: 1 })).length).toBe(1);
    expect(() => partOf(part({ agreement: 'uk-theatre', term: 'day' }))).toThrow('a stage engagement is by the week');
    expect(() => partOf(part({ rehearsal: 1 }))).toThrow("rehearsal weeks are a stage engagement's");
    expect(partOf(part({ agreement: 'uk-theatre', term: 'week', rehearsal: 3 })).rehearsal).toBe(3);
    expect(() => partOf(part({ budget: 300_000, term: 'week' }))).toThrow("there's no week minimum for that part");
    expect(() => partOf(part({ agreement: 'actra', lines: 5, term: 'week' }))).toThrow("there's no week minimum for that part");
    expect(partOf(part({ budget: 20_000, term: 'week' })).term).toBe('week');
    expect(() => partOf(part({ asks: ['juggling'] }))).toThrow('actor has no component juggling');
  });
});

describe("a part's pay", () => {
  it('writes dates as the tables do, and counts the days worked: five to a week', () => {
    expect(dateOf(day(2026, 7, 1))).toBe('2026-07-01');
    expect(dateOf(day(2026, 12, 31) + SECONDS_PER_DAY - 1)).toBe('2026-12-31');
    expect(WEEK_DAYS).toBe(5);
    expect(daysWorked(part({ length: 4 }))).toBe(4);
    expect(daysWorked(part({ term: 'week', length: 4 }))).toBe(20);
    expect(daysWorked(part({ agreement: 'uk-theatre', term: 'week', length: 6, rehearsal: 3 }))).toBe(45);
  });

  it("is SAG-AFTRA's day or week minimum for the date, refused before the tables, the last kept after", () => {
    expect(SAG.basic.day.map((s) => s[1])).toEqual(['1246', '1283', '1321', '1361', '1402']);
    expect(SAG.basic.week.map((s) => s[1])).toEqual(['4326', '4456', '4590', '4728', '4870']);
    expect(SAG.basic.day.map((s) => s[0])).toEqual(['2025-07-01', '2026-07-01', '2027-07-01', '2028-07-01', '2029-07-01']);
    expect(pay(part({ length: 3 }), '2026-06-30')).toEqual(usd('3738'));
    expect(pay(part({ length: 3 }), '2026-07-01')).toEqual(usd('3849'));
    expect(pay(part({ term: 'week', length: 2 }), '2025-07-01')).toEqual(usd('8652'));
    expect(pay(part({ term: 'week', length: 1 }), '2029-07-01')).toEqual(usd('4870'));
    expect(pay(part({ length: 1 }), '2031-03-01')).toEqual(usd('1402'));
    expect(() => pay(part(), '2025-06-30')).toThrow('no minimum is known before 2025-07-01');
    expect(rateAt('USD', SAG.basic.day, '2028-06-30')).toEqual(usd('1321'));
  });

  it("follows SAG-AFTRA's tiers by the budget: none set to $20,000, then Ultra Low, Moderate Low, Low and the basic agreement", () => {
    expect(SAG_TIERS).toEqual({ micro: 20_000, ultra: 300_000, moderate: 700_000, low: 2_000_000 });
    expect(SAG.ultra).toEqual({ currency: 'USD', day: [['2026-07-01', '257'], ['2027-07-01', '264'], ['2028-07-01', '272'], ['2029-07-01', '280']] });
    expect(SAG.moderate.day.map((s) => s[1])).toEqual(['449', '462', '476', '491']);
    expect(SAG.moderate.week.map((s) => s[1])).toEqual(['1560', '1607', '1655', '1705']);
    expect(SAG.low.day.map((s) => s[1])).toEqual(['834', '859', '885', '911']);
    expect(SAG.low.week.map((s) => s[1])).toEqual(['2896', '2984', '3073', '3166']);
    const at = (budget: number, term: 'day' | 'week' = 'day') => pay(part({ budget, term, length: 1 }), '2026-07-01');
    expect(at(0)).toBeNull();
    expect(at(20_000)).toBeNull();
    expect(at(20_001)).toEqual(usd('257'));
    expect(at(300_000)).toEqual(usd('257'));
    expect(at(300_001)).toEqual(usd('449'));
    expect(at(700_000, 'week')).toEqual(usd('1560'));
    expect(at(700_001)).toEqual(usd('834'));
    expect(at(2_000_000, 'week')).toEqual(usd('2896'));
    expect(at(2_000_001)).toEqual(usd('1283'));
    expect(scaleOf(part({ budget: 2_000_001 }))).toBe(SAG.basic);
    expect(() => pay(part({ budget: 500_000 }), '2026-06-30')).toThrow('no minimum is known before 2026-07-01');
    expect(pay(part({ budget: 500_000, length: 2 }), '2029-07-01')).toEqual(usd('982'));
    expect(() => pay(part({ budget: 100_000, term: 'week' }), '2026-07-01')).toThrow("there's no week minimum for that part");
  });

  it("is Pact/Equity's for a UK feature of £3 million and over, refused under it", () => {
    expect(PACT_FLOOR).toBe(3_000_000);
    expect(PACT.day).toEqual([['2020-04-06', '144'], ['2021-04-06', '147'], ['2022-04-06', '150'], ['2023-04-06', '156'], ['2024-04-06', '161']]);
    expect(PACT.week.map((s) => s[1])).toEqual(['576', '588', '600', '624', '644']);
    const p = (q: Partial<Part>) => part({ agreement: 'pact-equity', budget: 3_000_000, ...q });
    expect(pay(p({ length: 2 }), '2024-04-05')).toEqual(gbp('312'));
    expect(pay(p({ length: 2 }), '2024-04-06')).toEqual(gbp('322'));
    expect(pay(p({ term: 'week', length: 1 }), '2020-04-06')).toEqual(gbp('576'));
    expect(() => pay(p({}), '2020-04-05')).toThrow('no minimum is known before 2020-04-06');
    expect(() => partOf(p({ budget: 2_999_999 }))).toThrow("the minimums for a UK film under £3 million aren't known");
  });

  it("is UK Theatre's commercial week by the venue's seats, rehearsal weeks at the rehearsal rate", () => {
    expect(UK_THEATRE.map((t) => [t.seats, t.rehearsal, t.week])).toEqual([
      [0, [['2025-03-31', '525.03']], [['2025-03-31', '561.66']]],
      [250, [['2025-03-31', '531.69']], [['2025-03-31', '561.93']]],
      [500, [['2025-03-31', '545.58']], [['2025-03-31', '569.14']]],
      [1500, [['2025-03-31', '551.57']], [['2025-03-31', '590.33']]],
    ]);
    const stage = (seats: number, rehearsal = 0, length = 1) => pay(part({ agreement: 'uk-theatre', term: 'week', seats, rehearsal, length }), '2025-03-31');
    expect(stage(0)).toEqual(gbp('561.66'));
    expect(stage(249)).toEqual(gbp('561.66'));
    expect(stage(250)).toEqual(gbp('561.93'));
    expect(stage(499)).toEqual(gbp('561.93'));
    expect(stage(500)).toEqual(gbp('569.14'));
    expect(stage(1499)).toEqual(gbp('569.14'));
    expect(stage(1500)).toEqual(gbp('590.33'));
    expect(stage(1500, 4, 10)).toEqual(gbp(String((4 * 55157 + 10 * 59033) / 100)));
    expect(stage(100, 2, 3)).toEqual(gbp('2735.04'));
    expect(() => pay(part({ agreement: 'uk-theatre', term: 'week' }), '2025-03-30')).toThrow('no minimum is known before 2025-03-31');
  });

  it("is ACTRA's principal by the day or week, a part of five lines or fewer by the day", () => {
    expect(ACTRA_FEW_LINES).toBe(5);
    expect(ACTRA.principal.day).toEqual([['2025-01-26', '935.25'], ['2026-01-01', '972.75'], ['2027-01-01', '1006.75']]);
    expect(ACTRA.principal.week.map((s) => s[1])).toEqual(['3974.50', '4133.50', '4278.25']);
    expect(ACTRA.few.day.map((s) => s[1])).toEqual(['631.25', '656.50', '679.50']);
    const p = (q: Partial<Part>) => part({ agreement: 'actra', length: 1, ...q });
    expect(pay(p({ lines: 5 }), '2025-12-31')).toEqual(cad('631.25'));
    expect(pay(p({ lines: 6 }), '2026-01-01')).toEqual(cad('972.75'));
    expect(pay(p({ lines: 0, length: 2 }), '2027-01-01')).toEqual(cad('1359'));
    expect(pay(p({ term: 'week', length: 2 }), '2025-01-26')).toEqual(cad('7949'));
    expect(() => pay(p({}), '2025-01-25')).toThrow('no minimum is known before 2025-01-26');
  });
});

describe('an audition', () => {
  it('is taped or held in the room, scored and booked exactly as the draws and the actor give it', () => {
    expect(TAPED).toBe(0.92);
    expect(ROOM).toEqual(['prepare-for-and-go-to-auditions', 'audition-technique']);
    for (const [i, all] of [0, 37, 100, 64, 12, 88].entries()) {
      const seed = (i + 1).toString(16).padStart(16, '0');
      const base = made(all, { camera: 100 - all }, seed);
      const w = v(base);
      const p = part({ asks: ['singing'] });
      const l = dispatch(base, auditionForPart, p);
      const d = draws(seedFromText(seed), 'acting.work', 'audition', 1);
      const taped = d.float() < 0.92;
      const k = auditionSkill(w, p, taped);
      const score = clamp(k + spread(k) * (2 * d.float() - 1));
      expect(auditions(l), seed).toEqual([{ id: 1, at: AUGUST, part: p, taped, score, booked: d.float() < bookingChance(score, 0), work: null }]);
    }
  });

  it('shows the scene three fifths and the audition craft two, a self-tape reading Camera too', () => {
    const w = v(made(50, { auditioning: 90, camera: 10 }));
    const p = part();
    const of = (id: string) => skillOf(w, 'actor', id);
    expect(auditionSkill(w, p, false)).toBeCloseTo(0.6 * partSkill(w, p) + 0.4 * mean([of('prepare-for-and-go-to-auditions'), of('audition-technique')]), 10);
    expect(auditionSkill(w, p, true)).toBeCloseTo(0.6 * partSkill(w, p) + 0.4 * mean([of('prepare-for-and-go-to-auditions'), of('audition-technique'), of('self-taping')]), 10);
  });

  it('books 1 in 50 at the weakest to 3 in 10 at the best, up to half again for the best work seen', () => {
    expect(BOOKING).toEqual({ floor: 0.02, top: 0.3, credit: 0.5 });
    expect(bookingChance(0, 0)).toBeCloseTo(0.02, 12);
    expect(bookingChance(100, 0)).toBeCloseTo(0.3, 12);
    expect(bookingChance(50, 0)).toBeCloseTo(0.09, 12);
    expect(bookingChance(100, 100)).toBeCloseTo(0.45, 12);
    expect(bookingChance(50, 40)).toBeCloseTo(0.09 * 1.2, 12);
  });

  it('weighs the best work casting has seen, none counting where a part is not yet played', () => {
    expect(credit(ACTING_START)).toBe(0);
    const p = part();
    expect(credit({ auditions: [booked(p, 1, 40), booked(p, 2), booked(p, 3, 75), { ...booked(p, 4), booked: false }] })).toBe(75);
    expect(credit({ auditions: [booked(p, 1)] })).toBe(0);
    const base = withAuditions(made(55), [booked(p, 1, 90), booked(p, 2)]);
    const l = dispatch(base, auditionForPart, p);
    const d = draws(seedFromText(SEED), 'acting.work', 'audition', 3);
    const taped = d.float() < 0.92;
    const k = auditionSkill(v(base), p, taped);
    const score = clamp(k + spread(k) * (2 * d.float() - 1));
    expect(auditions(l)[2]?.booked).toBe(d.float() < bookingChance(score, 90));
  });

  it('teaches what it used, for a day: the part, the audition craft, and on tape Camera', () => {
    const base = made(50);
    const l = dispatch(base, auditionForPart, part());
    const after = held(l);
    for (const id of ['acting', 'memorization', 'camera', 'direction', 'auditioning']) expect(after[id], id).toBeCloseTo(grown(50, 1), 10);
    for (const id of ['voice', 'physicality']) expect(after[id], id).toBe(50);
    const onStage = dispatch(base, auditionForPart, part({ agreement: 'uk-theatre', term: 'week', lines: 0 }));
    const stage = held(onStage);
    expect(stage['voice']).toBeCloseTo(grown(50, 1), 10);
    expect(stage['physicality']).toBeCloseTo(grown(50, 1), 10);
    // A stage part asks nothing of the camera: only a self-tape teaches it.
    expect(auditions(onStage)[0]?.taped).toBe(true);
    expect(stage['camera']).toBeCloseTo(grown(50, 1), 10);
    const inTheRoom = Array.from({ length: 200 }, (_, i) => made(50, {}, (i + 1).toString(16).padStart(16, '0'))).map((l) => dispatch(l, auditionForPart, part({ agreement: 'uk-theatre', term: 'week', lines: 0 }))).find((l) => auditions(l)[0]?.taped === false) as Life<Acting>;
    expect(held(inTheRoom)['camera']).toBe(50);
  });

  it('is self-taped about 92% of the time, books near three in ten at the top, seldom near the bottom', () => {
    const run = (all: number, n: number) => {
      let l = made(all);
      for (let i = 0; i < n; i += 1) l = dispatch(l, auditionForPart, part());
      return auditions(l);
    };
    const top = run(100, 300);
    expect(top.filter((a) => a.taped).length / 300).toBeGreaterThan(0.88);
    expect(top.filter((a) => a.taped).length / 300).toBeLessThan(0.96);
    for (const a of top) expect(a.score).toBeGreaterThanOrEqual(97);
    expect(top.filter((a) => a.booked).length / 300).toBeGreaterThan(0.22);
    expect(top.filter((a) => a.booked).length / 300).toBeLessThan(0.36);
    expect(run(10, 300).filter((a) => a.booked).length / 300).toBeLessThan(0.07);
  });

  it('is refused for a part that cannot be, or before the attributes are chosen', () => {
    expect(() => dispatch(made(50), auditionForPart, part({ length: 0 }))).toThrow(RangeError);
    const bare = begin(SEED, AUGUST, { attributes: structuredClone(ATTRIBUTES_START), acting: structuredClone(ACTING_START) });
    expect(() => dispatch(bare, auditionForPart, part())).toThrow("the actor's attributes haven't been chosen");
    expect(() => auditionOf(ACTING_START, 1)).toThrow("there's no audition 1");
  });

  it('is the same for the same life and differs for another', () => {
    const many = (seed: string) => {
      let l = made(50, {}, seed);
      for (let i = 0; i < 8; i += 1) l = dispatch(l, auditionForPart, part());
      return auditions(l).map((a) => [a.taped, a.score, a.booked]);
    };
    expect(many(SEED)).toEqual(many(SEED));
    expect(many(OTHER)).not.toEqual(many(SEED));
  });

  it('acting.audition: a better auditioner books more parts', () => {
    const bookings = (n: number) => {
      let l = made(50, { auditioning: n, acting: n });
      for (let i = 0; i < 60; i += 1) l = dispatch(l, auditionForPart, part());
      return auditions(l).filter((a) => a.booked).length;
    };
    falsifyAny({ feature: 'acting.audition', claim: 'bites', says: 'an actor at 100 in Acting and Auditioning books more of 60 auditions than one at 10', base: 10, twin: 100, outcome: bookings });
  });
});

describe('playing a part', () => {
  it('plays it as the actor is in what it asks, within the spread, and pays the minimum for the day it starts', () => {
    for (const [i, all] of [0, 41, 100, 73].entries()) {
      const seed = (i + 7).toString(16).padStart(16, '0');
      const p = part({ asks: ['dance'], length: 2 });
      const base = withAuditions(made(all, { physicality: 100 - all }, seed), [booked(p)]);
      const k = partSkill(v(base), p);
      const l = dispatch(base, playPart, { audition: 1 });
      const quality = clamp(k + spread(k) * (2 * draws(seedFromText(seed), 'acting.work', 'perform', 1).float() - 1));
      expect(auditions(l)[0]?.work, seed).toEqual({ at: AUGUST, quality, pay: usd('2566') });
      for (const id of broadIds) expect(held(l)[id], id).toBeCloseTo(id === 'voice' || id === 'auditioning' ? (held(base)[id] as number) : grown(held(base)[id] as number, 2), 10);
    }
  });

  it('works a weekly or stage engagement five days a week, rehearsals too, and pays nothing where no minimum is set', () => {
    const p = part({ agreement: 'uk-theatre', term: 'week', seats: 600, rehearsal: 2, length: 4 });
    const base = withAuditions(made(40, {}, SEED, day(2025, 9, 1)), [booked(p), booked(part({ budget: 15_000 }), 2)]);
    const l = dispatch(dispatch(base, playPart, { audition: 1 }), playPart, { audition: 2 });
    expect(auditions(l)[0]?.work?.pay).toEqual(gbp(String((2 * 54558 + 4 * 56914) / 100)));
    expect(auditions(l)[1]?.work?.pay).toBeNull();
    expect(held(dispatch(base, playPart, { audition: 1 }))['voice']).toBeCloseTo(grown(40, 30), 10);
  });

  it('comes out at the top from an actor at 100 throughout, near 50 from one at 50, poor from one at 10', () => {
    const played = (all: number, seed: string) => auditions(dispatch(withAuditions(made(all, {}, seed), [booked(part())]), playPart, { audition: 1 }))[0]?.work?.quality as number;
    const seeds = Array.from({ length: 30 }, (_, i) => (i + 1).toString(16).padStart(16, '0'));
    for (const s of seeds) expect(played(100, s)).toBeGreaterThanOrEqual(97);
    for (const s of seeds) expect(Math.abs(played(50, s) - 50)).toBeLessThanOrEqual(spread(50));
    for (const s of seeds) expect(played(10, s)).toBeLessThanOrEqual(10 + spread(10));
  });

  it('is refused where the audition did not book, where the part is played, or where there is no such audition', () => {
    const p = part();
    const base = withAuditions(made(50), [{ ...booked(p), booked: false }, booked(p, 2, 60)]);
    expect(() => dispatch(base, playPart, { audition: 1 })).toThrow("audition 1 didn't book the part");
    expect(() => dispatch(base, playPart, { audition: 2 })).toThrow('the part from audition 2 is played');
    expect(() => dispatch(base, playPart, { audition: 3 })).toThrow("there's no audition 3");
    const early = withAuditions(made(50, {}, SEED, day(2025, 6, 30)), [booked(p)]);
    expect(() => dispatch(early, playPart, { audition: 1 })).toThrow('no minimum is known before 2025-07-01');
  });

  it('finds the audition asked for among several, and an audition booked leads to a part played', () => {
    let l = made(100);
    for (let i = 0; i < 12; i += 1) l = dispatch(l, auditionForPart, part());
    const first = auditions(l).find((a) => a.booked) as Audition;
    expect(first).toBeDefined();
    const after = dispatch(l, playPart, { audition: first.id });
    expect(auditionOf(after.slices.acting, first.id).work?.pay).toEqual(usd('3849'));
    expect(auditions(after).filter((a) => a.work !== null).map((a) => a.id)).toEqual([first.id]);
  });

  it('acting.perform: a better actor plays the part better', () => {
    falsifyAny({ feature: 'acting.perform', claim: 'bites', says: 'an actor at 90 in Acting plays a part better than one at 30', base: 30, twin: 90, outcome: (n) => auditions(dispatch(withAuditions(made(50, { acting: n }), [booked(part())]), playPart, { audition: 1 }))[0]?.work?.quality });
  });

  it("tells the player its own figures are the game's", () => {
    expect(MODEL_LINE).toBe('acting.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own reckoning");
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('acting.'))).toEqual([
      { id: 'acting.audition', reads: [], writes: ['attributes', 'acting'] },
      { id: 'acting.perform', reads: [], writes: ['attributes', 'acting'] },
    ]);
    expect(ACTING_START).toEqual({ auditions: [] });
    expect(broadOf('actor', 'acting-for-the-camera').id).toBe('camera');
  });
});
