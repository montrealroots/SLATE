import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Research } from '../../tools/person/markets/compile.ts';
import {
  agreementOf,
  BANDED,
  BLOCKED,
  blockedItems,
  cutTo,
  daysOf,
  edged,
  EDGED,
  FACT,
  feeOf,
  FORMS,
  ITEMS,
  KEPT,
  marketOf,
  numbers,
  OUTPUT,
  PERIODS,
  periodOf,
  PERS,
  PHASES,
  PREFIX,
  PRICED,
  READINGS,
  readMarkets,
  readResearch,
  SAYING,
  serialize,
  shortOf,
  SOURCES,
  TIERS,
  tiersOf,
  UNKNOWING,
  unknownOf,
  WEEK,
  type Evidence,
} from '../../tools/person/markets-director/compile.ts';
import { COUNTRIES, COVERAGE, coverageOf, DGA, HOME, HOME_TESTS, marketsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/person/markets-director/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const RESEARCH: Research = {
  country: 'XX',
  figures: [
    { item: 'agreement', value: { name: 'The Accord', runs: { from: '2026-01-01' }, currency: 'NOK' } },
    { item: 'fees', value: { currency: 'EUR', from: '2026-01-01', since: '2025-04', week: 100.5, day: { lead: 80 }, share: 0.03, whole: 1, floor: 3500, cut: 'up to 25%', short: '1-5 days: +10%', month: 'monthly rate / 21.67', tiers: [800000, '1,500,000', '2.5M', '900K'], zero: 0, text: '12', minutes: 15, rate: 0.0275, nested: { text: 'x' }, note: 'x2026-01-01x', odd: 'a month of 0 or -21 days' } },
    { item: 'none', value: { agreement: null } },
    { item: 'periods', value: { weeks: 8, series: '1 + up to 1', seven: 7 } },
    { item: 'cut', value: { weeks: 4 } },
    { item: 'union', value: { fee: 5 } },
    { item: 'agreement', value: { collectiveAgreement: null, setsFees: false, present: 'yes', zero: 0 } },
    { item: 'fees', value: { a: 5 } },
    { item: 'rates', value: { floor: { currency: 'EUR', day: 72.4, from: '2026-07-01' }, kv: 'freie Vereinbarung (none)', kvOther: 'freie Vereinbarung', agreement: null } },
    { item: 'rules', value: { minimumFee: null } },
  ],
  blockers: [{ item: 'fees' }, { item: 'periods' }, { item: 'fees' }],
};
const E: Evidence = { research: RESEARCH, own: null, currency: 'EUR', forms: ['feature', 'hour'] };
const fee = (x: Record<string, unknown>, e: Evidence = E) => feeOf(e, { form: 'feature', per: 'week', fig: 1, steps: [{ from: '2026-01-01', path: ['week'] }], ...x });
const BASE = { form: 'feature', per: 'week', phases: ['prep', 'shoot', 'cut'], when: {}, band: null, floor: null, first: null, steps: [['2026-01-01', '100.5']] };

const lay = () => {
  const root = mkdtempSync(join(tmpdir(), 'markets-director-'));
  const put = (path: string, body: unknown) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
  };
  return { root, put };
};
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const reading = (id: string) => ({ agreements: { [id]: { forms: ['feature'], none: { fig: 2 } } } });

describe("the director's markets compile", () => {
  it('reads its places, the forms, pays, stages, tiers and periods it knows', () => {
    expect([SOURCES, PREFIX, READINGS, OUTPUT, FACT, BLOCKED, KEPT, WEEK]).toEqual(['research/sources/person/markets', 'director-', 'tools/person/markets-director/readings.json', 'src/person/directing/markets.json', 'person.markets.director.', 'person.markets.director.blocked.', 'dga', 5]);
    expect([FORMS, PERS, BANDED, PHASES, TIERS, EDGED, PERIODS, ITEMS, UNKNOWING, PRICED, SAYING]).toEqual([
      ['feature', 'hour', 'half-hour'],
      ['job', 'share', 'minute', 'day', 'half-day', 'week', 'month', 'hour'],
      ['minute', 'day', 'half-day'],
      ['prep', 'shoot', 'cut'],
      ['budget', 'years', 'minutes', 'days'],
      ['budget', 'minutes'],
      ['prep-shoot', 'cut', 'prep'],
      ['agreement', 'fees', 'periods', 'union', 'language', 'none', 'terms'],
      ['agreement', 'fees', 'union', 'none', 'terms'],
      ['fees', 'agreement', 'periods', 'rates'],
      ['none', 'agreement', 'fees', 'union', 'rules', 'rates'],
    ]);
  });

  it("finds a tier's edges where the research writes them: as digits, with commas, in millions or thousands, or the number beside", () => {
    expect([...numbers('{"a":800000,"b":"1,500,000","c":"2.5M","d":"900K","e":"x12y","f":0.03}')]).toEqual([800000, 1500000, 2500000, 900000, 12, 0.03]);
    expect([...numbers('"1,23"')]).toEqual([1, 23]);
    const w = new Set([800000, 1500000]);
    expect([edged([0, null], w), edged([800000, null], w), edged([800001, null], w), edged([0, 799999], w), edged([0, 800000], w), edged([800000, 1499999], w)]).toEqual([true, true, true, true, true, true]);
    expect([edged([5, null], w), edged([800002, null], w), edged([0, 799998], w), edged([0, 800001], w), edged([800000, 1499998], w)]).toEqual([false, false, false, false, false]);
    expect(tiersOf(undefined, w)).toEqual({});
    expect(tiersOf({ budget: [0, 799999], years: [3, 5], days: [0, 104], minutes: [800000, null] }, w)).toEqual({ budget: [0, 799999], years: [3, 5], days: [0, 104], minutes: [800000, null] });
    expect(() => tiersOf({ budget: [1, 2] }, w)).toThrow("the research doesn't write the budget tier [1,2]");
    expect(() => tiersOf({ minutes: [15, null] }, w)).toThrow("the research doesn't write the minutes tier [15,null]");
    expect(() => tiersOf({ age: [1, 2] }, w)).toThrow("a tier turns on age, which the game doesn't read");
    expect(() => tiersOf({ years: [3, 1] }, w)).toThrow('a tier runs from');
    expect(() => tiersOf([1], w)).toThrow('a tier is not an object');
  });

  it("reads a first job's cut, a short engagement's more and a period's days from the research's words", () => {
    expect([cutTo('up to 25%'), cutTo('reductions: up to 10% first time'), cutTo('up to 5%')]).toEqual(['0.75', '0.9', '0.95']);
    for (const x of ['25%', 'up to 100%', undefined]) expect(() => cutTo(x), String(x)).toThrow(`${String(x)} isn't a cut of a fee`);
    expect(shortOf('1-5 days: +10%')).toEqual({ upTo: 5, share: '0.1' });
    expect(shortOf('1-12 days: +5%')).toEqual({ upTo: 12, share: '0.05' });
    for (const x of ['2-5 days: +10%', '1-5 days: +10% more', 'x1-5 days: +10%', '1-5 days: 10%']) expect(() => shortOf(x), x).toThrow(`${x} isn't a short engagement's pay`);
    expect([daysOf(8, 'week'), daysOf(18, 'day'), daysOf('1 + up to 1', 'day'), daysOf('4', 'day'), daysOf('12', 'day'), daysOf('1 + up to 12', 'day')]).toEqual([40, 18, 2, 4, 12, 13]);
    expect(() => daysOf(8, 'month')).toThrow('a period is in weeks or days, not month');
    for (const v of [0, 1.5, -2, '1 + up to 1', null]) expect(() => daysOf(v, 'week'), String(v)).toThrow(`a period of ${JSON.stringify(v)} isn't whole weeks`);
    for (const v of ['1 + 2', 'x4', '4x', ' 4', 'four', 0, 1.5, -2]) expect(() => daysOf(v, 'day'), String(v)).toThrow(`a period of ${JSON.stringify(v)} isn't whole days`);
  });

  it('reads a fee at its places in the research, its date and currency standing in it or in its agreement\'s figure', () => {
    expect(fee({})).toEqual(BASE);
    expect(fee({ per: 'day', phases: ['shoot'], band: [14, null], when: { budget: [800000, null] }, steps: [{ from: '2025-04-01', path: ['day', 'lead'] }, { from: '2026-01-01', path: ['week'] }] })).toEqual({ ...BASE, per: 'day', phases: ['shoot'], band: [14, null], when: { budget: [800000, null] }, steps: [['2025-04-01', '80'], ['2026-01-01', '100.5']] });
    expect(fee({ per: 'share', when: { budget: [0, 799999] }, floor: ['floor'], first: ['cut'], steps: [{ from: '2026-01-01', path: ['share'] }] })).toEqual({ ...BASE, per: 'share', phases: [], when: { budget: [0, 799999] }, floor: '3500', first: '0.75', steps: [['2026-01-01', '0.03']] });
    expect(() => fee({ per: 'share', when: { minutes: [0, 15] }, steps: [{ from: '2026-01-01', path: ['share'] }] })).toThrow('a fee by the share holds in a tier of the budget');
    expect(() => fee({ per: 'minute', when: { budget: [0, 799999] } })).toThrow('a fee by the minute holds in a tier of the minutes');
    for (const per of ['job', 'minute']) expect(fee({ per, when: { minutes: [0, 15] } }).phases, per).toEqual([]);
    expect(fee({ per: 'minute', when: { minutes: [15, null] }, band: [61, null] }).band).toEqual([61, null]);
    expect(fee({ per: 'half-day', band: [4, null] }).band).toEqual([4, null]);
    expect(fee({ form: 'hour', per: 'hour' })).toMatchObject({ form: 'hour', per: 'hour' });
    expect(fee({ fig: 3 }, { ...E, research: { ...RESEARCH, figures: [...RESEARCH.figures.slice(0, 3), { item: 'periods', value: { currency: 'EUR', from: '2026-01-01', week: 1 } }] } }).steps).toEqual([['2026-01-01', '1']]);
    // The agreement's own figure dates and prices a fee whose figure doesn't.
    expect(fee({ fig: 7, steps: [{ from: '2026-01-01', path: ['a'] }] }, { ...E, currency: 'NOK', own: RESEARCH.figures[0] as never }).steps).toEqual([['2026-01-01', '5']]);
    expect(() => fee({ fig: 7, steps: [{ from: '2026-01-01', path: ['a'] }] }, { ...E, currency: 'NOK' })).toThrow("XX's figure 7 doesn't name NOK");
    expect(() => fee({ fig: 7, steps: [{ from: '2026-01-01', path: ['a'] }] }, { ...E, currency: 'EUR', own: RESEARCH.figures[0] as never })).toThrow("XX's figure 7 doesn't name EUR");
    expect(() => fee({ fig: 7, steps: [{ from: '2026-02-01', path: ['a'] }] }, { ...E, currency: 'NOK', own: RESEARCH.figures[0] as never })).toThrow("XX's figure 7 doesn't date a fee from 2026-02-01");
    expect(() => fee({ note: 1 })).toThrow("a fee names note, which the game doesn't read");
    for (const x of ['x', null, []]) expect(() => feeOf(E, x), JSON.stringify(x)).toThrow('a fee is not an object');
    for (const fig of [2, 5, 9, 11]) expect(() => fee({ fig }), String(fig)).toThrow(`XX's figure ${fig} isn't one of its fees or agreement or periods or rates`);
    // A statute's floor of a director's pay (rates) is read as a fee where the research gives it as theirs.
    expect(fee({ fig: 8, per: 'day', steps: [{ from: '2026-07-01', path: ['floor', 'day'] }] })).toEqual({ ...BASE, per: 'day', steps: [['2026-07-01', '72.4']] });
    expect(() => fee({ form: 'half-hour' })).toThrow("a fee's form half-hour isn't its agreement's");
    expect(() => fee({ per: 'year' })).toThrow("a fee is paid by year, which the game doesn't pay by");
    expect(() => fee({ phases: [] })).toThrow("a fee by the week pays some of the engagement's days");
    expect(() => fee({ phases: ['launch'] })).toThrow("a fee by the week pays some of the engagement's days");
    expect(() => fee({ phases: ['shoot', 'launch'] })).toThrow("a fee by the week pays some of the engagement's days");
    expect(() => fee({ phases: 'shoot' })).toThrow("a fee by the week pays some of the engagement's days");
    expect(() => fee({ per: 'job', phases: ['shoot'] })).toThrow("a fee by the job pays none of the engagement's days");
    expect(() => fee({ per: 'share', phases: 'shoot', steps: [{ from: '2026-01-01', path: ['share'] }] })).toThrow("a fee by the share pays none of the engagement's days");
    for (const per of ['week', 'job', 'month', 'hour', 'share']) expect(() => fee({ per, band: [1, 2], steps: [{ from: '2026-01-01', path: [per === 'share' ? 'share' : 'week'] }] }), per).toThrow(`a fee by the ${per} pays every unit`);
    expect(() => fee({ per: 'day', band: [2, 1] })).toThrow('a tier runs from');
    for (const path of [['zero'], ['text'], ['day'], ['nested', 'text']]) expect(() => fee({ steps: [{ from: '2026-01-01', path }] }), path.join()).toThrow(`XX's figure 1 has no amount at ${path.join('.')}`);
    for (const path of [['week'], ['whole'], ['zero']]) expect(() => fee({ per: 'share', when: { budget: [0, null] }, steps: [{ from: '2026-01-01', path }] }), path.join()).toThrow(`XX's figure 1 has no share at ${path.join('.')}`);
    expect(() => fee({ steps: [{ from: '2026-01-01', path: ['rate'] }] })).toThrow('EUR has 2 decimal places');
    expect(() => fee({ floor: ['floor'] })).toThrow('only a share has a floor');
    expect(() => fee({ per: 'share', when: { budget: [0, null] }, floor: ['rate'], steps: [{ from: '2026-01-01', path: ['share'] }] })).toThrow('EUR has 2 decimal places');
    expect(() => fee({ first: ['week'] })).toThrow("100.5 isn't a cut of a fee");
    expect(() => fee({}, { ...E, currency: 'SEK' })).toThrow("XX's figure 1 doesn't name SEK");
    for (const steps of [[], undefined, 'x']) expect(() => fee({ steps }), JSON.stringify(steps)).toThrow('a fee has no steps');
    expect(() => fee({ steps: ['x'] })).toThrow('a step is not an object');
    for (const from of ['2026-1-01', 'x2026-01-01', '2026-01-01x', '2027-01-01', '2025-04-02']) expect(() => fee({ steps: [{ from, path: ['week'] }] }), from).toThrow(`XX's figure 1 doesn't date a fee from ${from}`);
    for (const order of [['2026-01-01', '2025-04-01'], ['2026-01-01', '2026-01-01']]) expect(() => fee({ steps: order.map((from) => ({ from, path: ['week'] })) }), order.join()).toThrow("a fee's steps run by date");
    expect(() => fee({ when: { budget: [7, null] } })).toThrow("the research doesn't write the budget tier [7,null]");
  });

  it('reads a period of the prep and shoot or the cut, in weeks of five days or in days', () => {
    const period = (x: Record<string, unknown>) => periodOf(E, { form: 'feature', part: 'prep-shoot', fig: 3, path: ['weeks'], unit: 'week', ...x });
    expect(period({})).toEqual({ form: 'feature', part: 'prep-shoot', when: {}, days: 40 });
    expect(period({ form: 'hour', part: 'cut', fig: 4, unit: 'day', when: { budget: [0, 3] } })).toEqual({ form: 'hour', part: 'cut', when: { budget: [0, 3] }, days: 4 });
    expect(period({ fig: 1, path: ['minutes'], unit: 'day', when: { budget: [800000, null] } }).days).toBe(15);
    expect(period({ path: ['series'], unit: 'day' }).days).toBe(2);
    expect(() => period({ note: 1 })).toThrow("a period names note, which the game doesn't read");
    expect(() => periodOf(E, 'x')).toThrow('a period is not an object');
    expect(() => period({ fig: 2 })).toThrow("XX's figure 2 isn't one of its fees or periods or cut");
    expect(() => period({ form: 'half-hour' })).toThrow("a period's form half-hour isn't its agreement's");
    expect(period({ part: 'prep', unit: 'day', path: ['seven'] })).toEqual({ form: 'feature', part: 'prep', when: {}, days: 7 });
    expect(() => period({ part: 'shoot' })).toThrow('a period is the prep and shoot, the cut or the prep, not shoot');
    expect(() => period({ unit: 'month' })).toThrow('a period is in weeks or days, not month');
    expect(() => period({ path: ['none'] })).toThrow('has nothing at none');
    expect(() => period({ when: { budget: [1, 2] } })).toThrow("the research doesn't write the budget tier [1,2]");
  });

  it('reads an agreement: its pay left to negotiation, its terms unknown, or its fees, periods, month and short engagements', () => {
    const one = { form: 'feature', per: 'week', fig: 1, steps: [{ from: '2026-01-01', path: ['week'] }] };
    const bare = { country: 'XX', forms: ['feature'], currency: null, month: null, short: null, fees: [], periods: [] };
    expect(agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 2 } })).toEqual({ ...bare, none: true });
    expect(agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 6, path: ['collectiveAgreement'] } })).toEqual({ ...bare, none: true });
    expect(agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 6, path: ['setsFees'] } }).none).toBe(true);
    expect(agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 2, path: ['agreement'] } }).none).toBe(true);
    for (const path of [['present'], ['zero']]) expect(() => agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 6, path } }), path[0]).toThrow("XX's figure 6 doesn't say nothing sets the pay");
    expect(() => agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 6 } })).toThrow("XX's figure 6 isn't one of its none");
    expect(() => agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 4, path: ['weeks'] } })).toThrow("XX's figure 4 isn't one of its none or agreement or fees or union or rules or rates");
    // A guild's, a law's or a floor's figure may say it: no minimum at its place, or a fee left free in the research's own word.
    for (const [fig, path] of [[7, ['a']], [1, ['zero']], [8, ['kvOther']], [8, ['floor']]] as const) expect(() => agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig, path } }), path.join()).toThrow(`XX's figure ${fig} doesn't say nothing sets the pay`);
    for (const [fig, path] of [[8, ['kv']], [8, ['agreement']], [9, ['minimumFee']]] as const) expect(agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig, path } }).none, path.join()).toBe(true);
    expect(() => agreementOf('a', RESEARCH, { forms: ['feature'], none: { fig: 5, path: ['fee'] } })).toThrow("XX's figure 5 doesn't say nothing sets the pay");
    expect(() => agreementOf('a', RESEARCH, { forms: ['feature'], none: 2 })).toThrow('none is not an object');
    expect(agreementOf('a', RESEARCH, { forms: ['feature', 'hour'], unknown: true })).toEqual({ ...bare, forms: ['feature', 'hour'], none: false });
    for (const item of ['agreement', 'union', 'none']) expect(agreementOf('a', { ...RESEARCH, blockers: [{ item: 'periods' }, { item }] }, { forms: ['hour'], unknown: true }).none, item).toBe(false);
    expect(() => agreementOf('a', { ...RESEARCH, blockers: [{ item: 'periods' }, { item: 'language' }] }, { forms: ['hour'], unknown: true })).toThrow("XX's research holds no blocker for a's terms");
    expect(() => agreementOf('a', RESEARCH, { forms: ['hour'], unknown: 'yes' })).toThrow("XX's research holds no blocker for a's terms");
    for (const forms of [[], ['short'], ['feature', 'short'], ['feature', 'feature'], 'feature', undefined]) expect(() => agreementOf('a', RESEARCH, { forms, unknown: true }), JSON.stringify(forms)).toThrow('a covers features, hours or half-hours');
    expect(() => agreementOf('a', RESEARCH, 'x')).toThrow('the reading of a is not an object');
    expect(() => agreementOf('a', RESEARCH, { forms: ['hour'], unknown: true, note: 1 })).toThrow("the reading of a names note, which the game doesn't read");
    const set = { forms: ['feature', 'hour'], currency: 'EUR', fees: [one] };
    expect(agreementOf('a', RESEARCH, set)).toEqual({ country: 'XX', forms: ['feature', 'hour'], currency: 'EUR', none: false, month: null, short: null, fees: [BASE], periods: [] });
    expect(agreementOf('a', RESEARCH, { ...set, periods: [{ form: 'hour', part: 'cut', fig: 4, path: ['weeks'], unit: 'day' }] }).periods).toEqual([{ form: 'hour', part: 'cut', when: {}, days: 4 }]);
    const prep = { form: 'hour', part: 'prep', fig: 3, path: ['seven'], unit: 'day' };
    expect(agreementOf('a', RESEARCH, { ...set, periods: [prep, { ...prep, form: 'feature', part: 'prep-shoot' }] }).periods.map((p) => p.part)).toEqual(['prep', 'prep-shoot']);
    expect(() => agreementOf('a', RESEARCH, { ...set, periods: [{ ...prep, form: 'feature' }, { ...prep, form: 'hour', part: 'prep-shoot' }, { ...prep, form: 'hour' }] })).toThrow("a guarantees a hour's prep both alone and with its shoot");
    expect(() => agreementOf('a', RESEARCH, { ...set, periods: [{ ...prep, form: 'feature', part: 'prep-shoot' }, { ...prep, form: 'feature' }] })).toThrow("a guarantees a feature's prep both alone and with its shoot");
    expect(agreementOf('a', RESEARCH, { ...set, month: { fig: 1, path: ['month'], days: 21.67 }, short: { fig: 1, path: ['short'] } })).toMatchObject({ month: 21.67, short: { upTo: 5, share: '0.1' } });
    expect(agreementOf('a', RESEARCH, { ...set, month: { fig: 1, path: ['month'], days: 21 } }).month).toBe(21);
    for (const m of [{ fig: 1, path: ['month'], days: 22 }, { fig: 1, path: ['month'], days: '21' }, { fig: 1, path: ['odd'], days: 0 }, { fig: 1, path: ['odd'], days: -21 }]) expect(() => agreementOf('a', RESEARCH, { ...set, month: m }), JSON.stringify(m)).toThrow(`XX's figure 1 doesn't make a month ${String(m.days)} days`);
    expect(() => agreementOf('a', RESEARCH, { ...set, month: { fig: 2, path: ['agreement'], days: 1 } })).toThrow("XX's figure 2 isn't one of its fees or agreement");
    expect(() => agreementOf('a', RESEARCH, { ...set, month: 21 })).toThrow('a month is not an object');
    expect(() => agreementOf('a', RESEARCH, { ...set, short: { fig: 1, path: ['month'] } })).toThrow("monthly rate / 21.67 isn't a short engagement's pay");
    expect(() => agreementOf('a', RESEARCH, { ...set, short: { fig: 2, path: ['agreement'] } })).toThrow("XX's figure 2 isn't one of its fees or agreement");
    expect(() => agreementOf('a', RESEARCH, { ...set, short: 5 })).toThrow('a short engagement is not an object');
    expect(agreementOf('a', RESEARCH, { ...set, fig: 0 }).fees).toEqual([BASE]);
    expect(() => agreementOf('a', RESEARCH, { ...set, fig: 2 })).toThrow("XX's figure 2 isn't one of its agreement or fees");
    expect(agreementOf('a', RESEARCH, { ...set, fig: 1 }).fees).toEqual([BASE]);
    expect(() => agreementOf('a', RESEARCH, { ...set, currency: 'EURO' })).toThrow("a pays in EURO, which isn't a currency");
    for (const fees of [[], undefined, 'x']) expect(() => agreementOf('a', RESEARCH, { ...set, fees }), JSON.stringify(fees)).toThrow('a sets no fees');
  });

  it("reads a market: its agreements, one at least, and what isn't known", () => {
    expect(unknownOf(RESEARCH.blockers)).toEqual(['fees', 'periods']);
    expect(unknownOf([])).toEqual([]);
    expect(() => unknownOf([{ item: 'pay' }])).toThrow("a blocker names pay, which isn't a fact the research seeks");
    expect(marketOf(RESEARCH, { agreements: { 'xx-none': { forms: ['feature'], none: { fig: 2 } }, 'xx-tv': { forms: ['hour'], unknown: true } } })).toEqual({
      market: { agreements: ['xx-none', 'xx-tv'], unknown: ['fees', 'periods'] },
      agreements: { 'xx-none': { country: 'XX', forms: ['feature'], currency: null, none: true, month: null, short: null, fees: [], periods: [] }, 'xx-tv': { country: 'XX', forms: ['hour'], currency: null, none: false, month: null, short: null, fees: [], periods: [] } },
    });
    expect(() => marketOf(RESEARCH, { agreements: {} })).toThrow('XX has no agreements');
    // A territory whose research says a director's work there follows its sovereign's terms takes the sovereign's market as compiled.
    const sovereign = marketOf({ ...RESEARCH, country: 'SV' }, { agreements: { 'sv-a': { forms: ['feature'], none: { fig: 2 } }, 'sv-b': { forms: ['hour'], unknown: true } } });
    const done = { markets: { SV: sovereign.market }, agreements: sovereign.agreements };
    const territory = (follows: unknown, figures: Research['figures'] = [{ item: 'follows', value: { follows: 'SV' } }], blockers: { item: string }[] = [{ item: 'none' }, { item: 'fees' }]) => marketOf({ country: 'TT', figures, blockers }, { follows }, done);
    expect(territory({ fig: 0, market: 'SV' })).toEqual({
      market: { agreements: ['tt-sv-a', 'tt-sv-b'], unknown: ['none', 'fees', 'periods'] },
      agreements: { 'tt-sv-a': { ...sovereign.agreements['sv-a'], country: 'TT' }, 'tt-sv-b': { ...sovereign.agreements['sv-b'], country: 'TT' } },
    });
    expect(territory({ fig: 0, market: 'SV' }, [{ item: 'none', value: { follows: 'SV' } }], []).market).toEqual({ agreements: ['tt-sv-a', 'tt-sv-b'], unknown: ['fees', 'periods'] });
    expect(() => territory({ fig: 0, market: 'XX' }, [{ item: 'follows', value: { follows: 'XX' } }])).toThrow("XX isn't a market to follow");
    expect(() => territory({ fig: 0, market: 'toString' }, [{ item: 'follows', value: { follows: 'toString' } }])).toThrow("toString isn't a market to follow");
    expect(() => territory({ fig: 0, market: 'SV' }, [{ item: 'follows', value: { follows: 'FR' } }])).toThrow("TT's figure 0 doesn't say a director's work there follows SV's terms");
    expect(() => territory({ fig: 0, market: 'SV' }, [{ item: 'union', value: { follows: 'SV' } }])).toThrow("TT's figure 0 isn't one of its follows or none");
    expect(() => territory({ fig: 0, market: 'SV' }, [{ item: 'none', value: 'SV' }])).toThrow('a figure is not an object');
    expect(() => territory(5)).toThrow('what a market follows is not an object');
    expect(() => marketOf({ country: 'TT', figures: [{ item: 'follows', value: { follows: 'SV' } }], blockers: [] }, { follows: { fig: 0, market: 'SV' } })).toThrow("SV isn't a market to follow");
    expect(() => marketOf(RESEARCH, { follows: { fig: 0, market: 'SV' }, agreements: {} }, done)).toThrow("the reading of XX names agreements, which the game doesn't read");
    expect(() => marketOf(RESEARCH, { agreements: [] })).toThrow('the agreements is not an object');
    expect(() => marketOf(RESEARCH, { agreements: {}, zone: 'x' })).toThrow("the reading of XX names zone, which the game doesn't read");
    expect(() => marketOf(RESEARCH, 'x')).toThrow('the reading of XX is not an object');
  });

  it('reads each market as the register cites it, and refuses a file or a reading without the other', () => {
    const { root, put } = lay();
    const file = (cc: string, blockers: { item: string }[] = []) => JSON.stringify({ ...RESEARCH, country: cc, blockers });
    const aa = file('AA');
    const bb = file('BB', [{ item: 'fees' }]);
    put(`${SOURCES}/${PREFIX}AA.json`, aa);
    put(`${SOURCES}/${PREFIX}BB.json`, bb);
    put(`${SOURCES}/AA.json`, 'the actor\'s');
    put(`${SOURCES}/${PREFIX}notes.txt`, 'not research');
    const cite = (cc: string, text: string) => ({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/${PREFIX}${cc}.json`, sha256: sha(text) } });
    const all = [cite('AA', aa), cite('BB', bb), { fact: `${BLOCKED}BB` }];
    put('research/register.json', { entries: all });
    put(READINGS, { AA: reading('aa'), BB: reading('bb') });
    const out = readMarkets(root);
    expect(out.markets).toEqual({ AA: { agreements: ['aa'], unknown: [] }, BB: { agreements: ['bb'], unknown: ['fees'] } });
    expect(Object.keys(out.agreements)).toEqual(['aa', 'bb']);
    expect(out.agreements['bb']).toMatchObject({ country: 'BB', none: true });
    expect(serialize(out)).toBe(`${JSON.stringify(out, null, 1)}\n`);
    expect(readResearch(root, { entries: all as never }, 'BB')).toEqual({ research: JSON.parse(bb), blocked: true });
    expect(readResearch(root, { entries: all as never }, 'AA').blocked).toBe(false);
    expect(readResearch(root, { entries: [cite('AA', aa), { fact: 'person.markets.blocked.AA' }] as never }, 'AA').blocked).toBe(false);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), value: { file: `${SOURCES}/AA.json`, sha256: sha(aa) } }] as never }, 'AA')).toThrow(`${SOURCES}/${PREFIX}AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ fact: `${FACT}AA` }] as never }, 'AA')).toThrow(`${SOURCES}/${PREFIX}AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), fact: 'person.markets.AA' }] as never }, 'AA')).toThrow(`${SOURCES}/${PREFIX}AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [cite('AA', bb)] as never }, 'AA')).toThrow(`${SOURCES}/${PREFIX}AA.json isn't the file the register cites`);
    put(`${SOURCES}/${PREFIX}CC.json`, aa);
    expect(() => readResearch(root, { entries: [cite('CC', aa)] as never }, 'CC')).toThrow(`${SOURCES}/${PREFIX}CC.json is AA's`);
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/${PREFIX}CC.json has no reading`);
    put(READINGS, { AA: reading('aa'), BB: reading('bb'), CC: reading('cc'), DD: reading('dd') });
    expect(() => readMarkets(root)).toThrow('DD has a reading and no research');
    put(READINGS, { AA: reading('aa'), BB: reading('bb'), CC: reading('cc') });
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/${PREFIX}CC.json isn't cited by the register`);
  });

  it('reads a market the research found nothing of from its blocker in the register alone, the file beside it unread', () => {
    const entry = (results: (string | undefined)[]) => ({ fact: `${BLOCKED}AA`, attempts: results.map((result) => (result === undefined ? {} : { result })) });
    expect(blockedItems(entry(['not found: fees', 'not found: fees, terms', 'not found: none']))).toEqual([{ item: 'fees' }, { item: 'terms' }, { item: 'none' }]);
    for (const r of ['found: fees', 'not found:', 'not found: ', 'x not found: fees', 'not found: fees\nand more', undefined]) expect(() => blockedItems(entry([r])), String(r)).toThrow(`${BLOCKED}AA has an attempt whose result names nothing not found`);
    for (const e of [entry([]), { fact: `${BLOCKED}AA` }]) expect(() => blockedItems(e)).toThrow(`${BLOCKED}AA names nothing not found`);
    const { root, put } = lay();
    put(`${SOURCES}/${PREFIX}AA.json`, 'not read');
    const blocker = entry(['not found: fees', 'not found: terms']);
    expect(readResearch(root, { entries: [blocker] }, 'AA')).toEqual({ research: { country: 'AA', figures: [], blockers: [{ item: 'fees' }, { item: 'terms' }] }, blocked: true });
    // A found entry that names another file is no citation of this one, and the blocker doesn't stand in for it.
    expect(() => readResearch(root, { entries: [blocker, { fact: `${FACT}AA`, value: { file: 'elsewhere.json', sha256: sha('x') } }] }, 'AA')).toThrow(`${SOURCES}/${PREFIX}AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ fact: `${BLOCKED}BB`, attempts: [{ result: 'not found: fees' }] }] }, 'AA')).toThrow(`${SOURCES}/${PREFIX}AA.json isn't cited by the register`);
    put('research/register.json', { entries: [blocker] });
    put(READINGS, { AA: { agreements: { 'aa-screen': { forms: ['feature'], unknown: true } } } });
    expect(readMarkets(root).markets).toEqual({ AA: { agreements: ['aa-screen'], unknown: ['fees', 'terms'] } });
  });

  it('reads a territory after the sovereign it follows, whatever their order, its blockers its own, the markets kept in the countries\' order', () => {
    const { root, put } = lay();
    const entries: unknown[] = [];
    const file = (cc: string, research: Research) => {
      const text = JSON.stringify(research);
      put(`${SOURCES}/${PREFIX}${cc}.json`, text);
      entries.push({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/${PREFIX}${cc}.json`, sha256: sha(text) } });
    };
    file('AA', { country: 'AA', figures: [{ item: 'none', value: { follows: 'BB' } }], blockers: [] });
    file('BB', { ...RESEARCH, country: 'BB' });
    file('CC', { ...RESEARCH, country: 'CC', blockers: [] });
    entries.push({ fact: `${BLOCKED}BB` });
    put('research/register.json', { entries });
    put(READINGS, { AA: { follows: { fig: 0, market: 'BB' } }, BB: reading('bb'), CC: reading('cc') });
    const out = readMarkets(root);
    expect(Object.keys(out.markets)).toEqual(['AA', 'BB', 'CC']);
    expect(out.markets['AA']).toEqual({ agreements: ['aa-bb'], unknown: ['fees', 'periods'] });
    expect(out.agreements['aa-bb']).toMatchObject({ country: 'AA', none: true });
    // A territory follows only a market read on its own, even one read before it.
    entries.length = 0;
    file('AA', { country: 'AA', figures: [{ item: 'none', value: { follows: 'CC' } }], blockers: [] });
    file('BB', { country: 'BB', figures: [{ item: 'none', value: { follows: 'AA' } }], blockers: [] });
    file('CC', { ...RESEARCH, country: 'CC', blockers: [] });
    put('research/register.json', { entries });
    put(READINGS, { AA: { follows: { fig: 0, market: 'CC' } }, BB: { follows: { fig: 0, market: 'AA' } }, CC: reading('cc') });
    expect(() => readMarkets(root)).toThrow("AA isn't a market to follow");
    put(READINGS, { AA: 5, BB: reading('bb'), CC: reading('cc') });
    expect(() => readMarkets(root)).toThrow('the reading of AA is not an object');
  });

  it('refuses a market whose blockers the register and the research hold apart, or an id taken', () => {
    const { root, put } = lay();
    const set = (files: Record<string, { item: string }[]>, blocked: string[], readings: Record<string, string>) => {
      const entries: unknown[] = blocked.map((cc) => ({ fact: `${BLOCKED}${cc}` }));
      for (const [cc, blockers] of Object.entries(files)) {
        const text = JSON.stringify({ ...RESEARCH, country: cc, blockers });
        put(`${SOURCES}/${PREFIX}${cc}.json`, text);
        entries.push({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/${PREFIX}${cc}.json`, sha256: sha(text) } });
      }
      put('research/register.json', { entries });
      put(READINGS, Object.fromEntries(Object.entries(readings).map(([cc, id]) => [cc, reading(id)])));
    };
    set({ AA: [] }, ['AA'], { AA: 'aa' });
    expect(() => readMarkets(root)).toThrow("the register holds AA's blockers, which its research doesn't");
    set({ AA: [{ item: 'fees' }] }, [], { AA: 'aa' });
    expect(() => readMarkets(root)).toThrow("AA's research has blockers the register doesn't hold");
    set({ AA: [] }, [], { AA: 'dga' });
    expect(() => readMarkets(root)).toThrow("dga is another agreement's id");
    set({ AA: [], BB: [] }, [], { AA: 'xx', BB: 'xx' });
    expect(() => readMarkets(root)).toThrow("xx is another agreement's id");
    set({ AA: [], BB: [] }, [], { AA: 'aa', BB: 'bb' });
    expect(Object.keys(readMarkets(root).agreements)).toEqual(['aa', 'bb']);
  });

  it('reads no markets where the research has none', () => {
    const { root, put } = lay();
    put('research/register.json', { entries: [] });
    put(READINGS, {});
    expect(readMarkets(root)).toEqual({ markets: {}, agreements: {} });
    put(READINGS, []);
    expect(() => readMarkets(root)).toThrow('the readings is not an object');
  });

  it("compiles every market the director's engine reads", () => {
    expect(readMarkets(ROOT)).toEqual(JSON.parse(readFileSync(join(ROOT, OUTPUT), 'utf8')));
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readMarkets(ROOT)));
  });
});

describe("the director's markets coverage", () => {
  it('is the DGA in the US, blocked where the register holds a blocker, researched where it cites the research alone, pending where neither or where no market is compiled', () => {
    const facts = new Map([
      ['person.markets.director.AA', 'R-1'],
      ['person.markets.director.BB', 'R-2'],
      ['person.markets.director.blocked.BB', 'R-3'],
      ['person.markets.director.blocked.CC', 'R-4'],
      ['person.markets.DD', 'R-5'],
      ['person.markets.director.EE', 'R-6'],
      ['person.markets.director.blocked.FF', 'R-7'],
      [DGA, 'R-8'],
    ]);
    const one = { agreements: ['x'], unknown: [] };
    const markets = { AA: one, BB: one, CC: one, DD: one } as never;
    const rows = marketsCoverage(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'US'], markets, facts);
    expect(rows).toEqual([
      { key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'BB', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'CC', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'DD', status: 'pending' },
      { key: 'EE', status: 'pending' },
      { key: 'FF', status: 'pending' },
      { key: 'GG', status: 'pending' },
      { key: 'US', status: 'researched', register: ['R-8'], tests: HOME_TESTS },
    ]);
    expect(marketsCoverage(['US'], {}, new Map())).toEqual([{ key: 'US', status: 'pending' }]);
    expect([HOME, DGA, COUNTRIES]).toEqual(['US', 'person.work.director.calibration', 'src/world/gazetteer/countries.json']);
    expect(TESTS).toEqual(["tests/person/directing/markets.test.ts::the director's markets > are each country's own, every fee and period as the research gives it", "tests/person/directing/markets.test.ts::a film in a market > is paid its agreement's minimum, by form, tier, date and the days it works"]);
    expect(TOLD).toBe("tests/person/directing/markets.test.ts::a film in a market > tells the player what of a market isn't known");
    expect(HOME_TESTS).toEqual(["tests/person/directing/directing.test.ts::the DGA terms > set a feature by its budget: pay, prep and the Director's Cut at every level's edge", "tests/person/directing/directing.test.ts::the DGA terms > set an episode by the show: the network program rate, the guaranteed prep and shoot, the episode's cut"]);
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'person.directing', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is built from the map, the compiled markets and the register', () => {
    const { root, put } = lay();
    put(OUTPUT, { markets: { AA: { agreements: ['a'] }, BB: { agreements: ['b'] } }, agreements: {} });
    put(COUNTRIES, { AA: {}, BB: {}, US: {} });
    put('research/register.json', { entries: [{ id: 'R-1', fact: 'person.markets.director.AA' }, { id: 'R-2', fact: 'person.markets.director.blocked.BB' }, { id: 'R-3', fact: DGA }] });
    expect(COVERAGE).toBe('coverage/markets-director-countries.json');
    expect(coverageOf(root)).toBe(serializeCoverage([{ key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS }, { key: 'BB', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] }, { key: 'US', status: 'researched', register: ['R-3'], tests: HOME_TESTS }]));
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
