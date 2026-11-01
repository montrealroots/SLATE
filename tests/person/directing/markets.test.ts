import { describe, expect, it } from 'vitest';
import { begin, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor, type CurrencyCode } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { t } from '../../../src/core/text/text.ts';
import { ATTRIBUTES_START, chooseAttributes, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  aboutMarket,
  AGREEMENTS,
  DIRECTING_START,
  engagement,
  experience,
  feePays,
  filmOf,
  HOURS,
  MARKETS,
  marketFee,
  MISSING,
  prepFilm,
  stepAt,
  UNKEPT_LINE,
  within,
  type DirectingSlice,
  type Fee,
  type Film,
  type Job,
  type MarketAgreement,
  type PrepArgs,
} from '../../../src/person/directing/directing.ts';
import type { IdentitySlice } from '../../../src/person/identity/identity.ts';
import { identity } from '../../support/person.ts';

type D = { attributes: AttributesSlice; directing: DirectingSlice; identity: IdentitySlice };
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
const NOW = day(2026, 7, 1);
const made = (now = NOW, directing: DirectingSlice = DIRECTING_START): Life<D> =>
  dispatch(begin('0123456789abcdef', now, { attributes: structuredClone(ATTRIBUTES_START), directing: structuredClone(directing), identity: identity() }), chooseAttributes, { role: 'director', all: 50, each: {} });
const job = (args: PrepArgs, now = NOW, directing: DirectingSlice = DIRECTING_START): Film => {
  const l = dispatch(made(now, directing), prepFilm, args);
  return filmOf(l.slices.directing, l.slices.directing.films.length);
};
const fee = (args: PrepArgs, now = NOW, directing?: DirectingSlice) => job(args, now, directing).fee;
const m = (c: CurrencyCode, n: string) => fromMajor(c, n);
/** An earlier job, so the director has years in the work and this one isn't the first. */
const before = (started: number): DirectingSlice => ({ films: [{ ...job({ form: 'hour' }), started }], second: null });

const f = (x: Fee) => [x.form, x.per, x.phases.join('+'), JSON.stringify(x.when), x.band === null ? '' : x.band.join('-'), x.floor ?? '', x.first ?? '', x.steps.map((s) => s.join(' ')).join(' | ')].join(' ');
/** Every fee as the research gives it (each country's file, read 2026-11-01): form, pay, stages, tiers, band, floor, first-job cut, steps. */
const EXPECTED: Record<string, string[]> = {
  'au-award': ['feature week prep+shoot+cut {}    2026-07-01 1619.3', 'hour week prep+shoot+cut {}    2026-07-01 1548.8', 'half-hour week prep+shoot+cut {}    2026-07-01 1548.8'],
  'br-sp': ['feature week prep+shoot+cut {}    2025-05-01 5471.8', 'hour week prep+shoot+cut {}    2025-05-01 7622.12', 'half-hour week prep+shoot+cut {}    2025-05-01 7622.12'],
  'dgc-qc': [
    ...[
      [10879238, null, 191445, 172304],
      [9791314, 10879237, 169109, 152201],
      [8703390, 9791313, 149965, 134970],
      [7615467, 8703389, 138797, 124921],
      [6527543, 7615466, 124441, 111995],
      [5439618, 6527542, 105296, 94767],
      [4351695, 5439617, 79768, 71793],
      [3263771, 4351694, 60625, 54562],
      [2719809, 3263770, 52648, 47382],
      [2175847, 2719808, 43075, 38768],
    ].flatMap(([lo, hi, base, use]) => [`feature job  {"budget":[${lo},${hi}]}    2024-12-01 ${base}`, `feature job  {"budget":[${lo},${hi}]}    2024-12-01 ${use}`]),
    'feature share  {"budget":[1631885,2175846]}    2024-12-01 0.03',
    'feature share  {"budget":[0,1631884]}    2024-12-01 0.0275',
    ...[
      [1087924, null, 14768, 16244],
      [788744, 1087923, 11681, 12848],
      [543962, 788743, 9815, 10798],
    ].flatMap(([lo, hi, base, use]) => [`half-hour job  {"budget":[${lo},${hi}]}    2024-12-01 ${base}`, `half-hour job  {"budget":[${lo},${hi}]}    2024-12-01 ${use}`]),
    'half-hour share  {"budget":[380773,543961]}    2024-12-01 0.03',
    'half-hour share  {"budget":[0,380772]}    2024-12-01 0.0275',
    ...[
      [1414301, null, 24249, 26675],
      [1196716, 1414300, 20208, 22229],
    ].flatMap(([lo, hi, base, use]) => [`hour job  {"budget":[${lo},${hi}]}    2024-12-01 ${base}`, `hour job  {"budget":[${lo},${hi}]}    2024-12-01 ${use}`]),
    'hour share  {"budget":[598358,1196715]}    2024-12-01 0.03',
    'hour share  {"budget":[0,598357]}    2024-12-01 0.0275',
  ],
  arrq: ['hour', 'half-hour'].flatMap((x) => [`${x} day shoot {}    2023-05-28 2323.75`, `${x} day cut {}    2023-05-28 1179`, `${x} half-day prep {} 4-   2023-05-28 320.25`]),
  nfb: ['feature share  {"budget":[0,1000000]}  3500  2022-01-31 0.1', 'feature share  {"budget":[1000001,null]}  100000  2022-01-31 0.1'],
  'bvr-cinema': [
    [0, 799999, 27500],
    [800000, 999999, 33500],
    [1000000, 1199999, 38500],
    [1200000, 1499999, 47500],
    [1500000, 1999999, 57500],
    [2000000, 2999999, 62500],
    [3000000, 3999999, 85000],
    [4000000, 5999999, 105000],
    [6000000, 7999999, 130000],
    [8000000, null, 160000],
  ].map(([lo, hi, a]) => `feature job  {"budget":[${lo},${hi}]}    2022-09-21 ${a}`),
  'netflix-de': [
    'hour job  {"budget":[1350001,1800000]}    2025-07-01 37000',
    'hour job  {"budget":[1800001,2700000]}    2025-07-01 42000',
    'hour job  {"budget":[2700001,3600000]}    2025-07-01 46000',
    'hour job  {"budget":[3600001,null]}    2025-07-01 50000',
    'hour day shoot {"budget":[1350001,2700000]} 14-   2025-07-01 2000',
    'hour day shoot {"budget":[2700001,null]} 16-   2025-07-01 2500',
  ],
  'idcc-3097': ['feature week prep+shoot+cut {"days":[0,104]}    2024-03-01 3015.27', 'feature month prep+shoot+cut {"days":[105,null]}    2024-03-01 8563.37'],
  'nl-fair-pay': ['feature', 'hour', 'half-hour'].map((x) => `${x} hour prep+shoot+cut {}    2025-01-01 50.24`),
  'virke-feature': [
    ['[0,2]', '4789 | 2025-06-01 5000', '3534 | 2025-06-01 3689'],
    ['[3,5]', '5404 | 2025-06-01 5642', '3589 | 2025-06-01 3747'],
    ['[6,9]', '6080 | 2025-06-01 6348', '4042 | 2025-06-01 4220'],
    ['[10,null]', '7053 | 2025-06-01 7363', '4685 | 2025-06-01 4891'],
  ].flatMap(([y, shoot, other]) => [`feature day shoot {"years":${y}}    2024-06-01 ${shoot}`, `feature day prep+cut {"years":${y}}    2024-06-01 ${other}`]),
  'virke-tv': ['hour', 'half-hour'].flatMap((x) =>
    [
      ['[0,2]', 104032, 76750],
      ['[3,5]', 117395, 77967],
      ['[6,9]', 132075, 87804],
      ['[10,null]', 153196, 101750],
    ].flatMap(([y, shoot, other]) => [`${x} month shoot {"years":${y}}    2025-06-01 ${shoot}`, `${x} month prep+cut {"years":${y}}    2025-06-01 ${other}`]),
  ),
  medieforetagen: ['feature', 'hour', 'half-hour'].flatMap((x) => [
    `${x} minute  {"minutes":[15,73]}   0.75 2025-06-01 2113 | 2026-06-01 2177`,
    `${x} job  {"minutes":[74,null]}   0.75 2025-06-01 153837 | 2026-06-01 158453`,
    `${x} month prep+shoot+cut {"minutes":[15,null]}    2025-06-01 31147 | 2026-06-01 32082`,
  ]),
  svt: ['hour', 'half-hour'].flatMap((x) => [`${x} minute  {"minutes":[15,null]} 1-60  0.75 2024-12-23 2134`, `${x} minute  {"minutes":[15,null]} 61-  0.75 2024-12-23 543`, `${x} month prep+shoot+cut {"minutes":[15,null]}    2024-12-23 31326`]),
};

describe("the director's markets", () => {
  it("are each country's own, every fee and period as the research gives it", () => {
    expect(Object.keys(MARKETS)).toEqual(['AU', 'BR', 'CA', 'DE', 'DK', 'ES', 'FR', 'GB', 'IE', 'IN', 'IT', 'JP', 'KR', 'MX', 'NG', 'NL', 'NO', 'NZ', 'SE', 'ZA']);
    expect(Object.fromEntries(Object.entries(MARKETS).map(([cc, x]) => [cc, x.agreements]))).toEqual({
      AU: ['au-award'], BR: ['br-sp', 'br-rj'], CA: ['cmpa-dgc', 'dgc-bc', 'dgc-qc', 'arrq', 'nfb'], DE: ['bvr-cinema', 'netflix-de'], DK: ['dk-feature', 'dr'], ES: ['es-screen'], FR: ['idcc-3097', 'idcc-2642'], GB: ['gb-feature', 'pact-duk'], IE: ['ie-screen'], IN: ['in-screen'], IT: ['it-screen'], JP: ['dgj-eiren'], KR: ['kr-screen'], MX: ['mx-screen'], NG: ['ng-screen'], NL: ['nl-fair-pay', 'nl-none'], NO: ['virke-feature', 'virke-tv'], NZ: ['nz-screen'], SE: ['medieforetagen', 'svt'], ZA: ['za-screen'],
    });
    const fees = Object.fromEntries(Object.entries(AGREEMENTS).filter(([, a]) => a.fees.length > 0).map(([id, a]) => [id, a.fees.map(f)]));
    expect(fees).toEqual(EXPECTED);
    // Where the research says no agreement sets a director's pay, it is left to negotiation; where it couldn't find the terms, they're unknown.
    const bare = Object.entries(AGREEMENTS).filter(([, a]) => a.fees.length === 0);
    expect(bare.filter(([, a]) => a.none).map(([id]) => id)).toEqual(['dk-feature', 'es-screen', 'gb-feature', 'ie-screen', 'it-screen', 'nl-none', 'nz-screen', 'za-screen']);
    expect(bare.filter(([, a]) => !a.none).map(([id]) => id)).toEqual(['br-rj', 'cmpa-dgc', 'dgc-bc', 'dr', 'idcc-2642', 'pact-duk', 'in-screen', 'dgj-eiren', 'kr-screen', 'mx-screen', 'ng-screen']);
    for (const [id, a] of bare) expect([a.currency, a.month, a.short, a.periods], id).toEqual([null, null, null, []]);
    expect(Object.entries(AGREEMENTS).map(([id, a]) => [id, a.country, a.currency ?? '-', a.forms.join('/')].join(' ')).filter((x) => !x.includes(' - '))).toEqual([
      'au-award AU AUD feature/hour/half-hour', 'br-sp BR BRL feature/hour/half-hour', 'dgc-qc CA CAD feature/hour/half-hour', 'arrq CA CAD hour/half-hour', 'nfb CA CAD feature', 'bvr-cinema DE EUR feature', 'netflix-de DE EUR hour', 'idcc-3097 FR EUR feature', 'nl-fair-pay NL EUR feature/hour/half-hour', 'virke-feature NO NOK feature', 'virke-tv NO NOK hour/half-hour', 'medieforetagen SE SEK feature/hour/half-hour', 'svt SE SEK hour/half-hour',
    ]);
    expect(Object.entries(AGREEMENTS).filter(([, a]) => a.month !== null || a.short !== null).map(([id, a]) => [id, a.month, a.short])).toEqual([['virke-tv', 21.67, { upTo: 5, share: '0.1' }], ['medieforetagen', 21, null]]);
    // The DGC Quebec/AQPM agreement's guaranteed prep and shoot (its weeks, five days each) and Director's Cut.
    const qc = AGREEMENTS['dgc-qc'] as MarketAgreement;
    expect(qc.periods.map((p) => [p.form, p.part, JSON.stringify(p.when), p.days].join(' '))).toEqual([
      ...[[10879238, null, 80], [9791314, 10879237, 75], [8703390, 9791313, 75], [7615467, 8703389, 70], [6527543, 7615466, 70], [5439618, 6527542, 60], [4351695, 5439617, 60], [3263771, 4351694, 50], [2719809, 3263770, 50], [2175847, 2719808, 50], [1631885, 2175846, 40], [0, 1631884, 40]].map(([lo, hi, d]) => `feature prep-shoot {"budget":[${lo},${hi}]} ${d}`),
      'feature cut {"budget":[0,1000000]} 20', 'feature cut {"budget":[1000001,2000000]} 30', 'feature cut {"budget":[2000001,null]} 40',
      'half-hour prep-shoot {} 10', 'hour prep-shoot {} 18', 'half-hour cut {} 2', 'hour cut {} 2',
    ]);
    expect(Object.entries(AGREEMENTS).filter(([, a]) => a.periods.length > 0).map(([id]) => id)).toEqual(['dgc-qc']);
    expect(Object.fromEntries(Object.entries(MARKETS).map(([cc, x]) => [cc, x.unknown]))).toEqual({
      AU: [], BR: ['periods', 'agreement'], CA: ['fees', 'union'], DE: ['periods'], DK: ['fees', 'agreement'], ES: ['periods', 'fees'], FR: ['fees', 'periods'], GB: ['fees', 'periods', 'union'], IE: ['periods'], IN: ['fees', 'periods'], IT: ['fees', 'periods'], JP: ['fees', 'periods', 'language'], KR: ['fees', 'periods'], MX: ['union', 'fees', 'periods'], NG: ['none', 'union'], NL: ['fees', 'periods'], NO: ['fees'], NZ: ['periods'], SE: ['fees'], ZA: ['union'],
    });
  });
});

describe('a film in a market', () => {
  it("is paid its agreement's minimum, by form, tier, date and the days it works", () => {
    // Australia's award: Level 10 for a feature, Level 9 for a series, by the week of five days.
    expect(fee({ form: 'feature', country: 'AU', prep: 10, shoot: 30, cut: 20 })).toEqual(m('AUD', '19431.60'));
    expect(fee({ form: 'hour', country: 'AU', prep: 5, shoot: 8, cut: 4 })).toEqual(m('AUD', '5265.92'));
    expect(fee({ form: 'half-hour', country: 'AU', prep: 5, shoot: 8, cut: 4 })).toEqual(m('AUD', '5265.92'));
    expect(() => job({ form: 'feature', country: 'AU', prep: 10, shoot: 30, cut: 20 }, day(2026, 6, 30))).toThrow('no minimum is known before 2026-07-01');
    // São Paulo's SINDCINE-SIAESP floors.
    expect(fee({ form: 'feature', country: 'BR', agreement: 'br-sp', prep: 5, shoot: 15, cut: 5 })).toEqual(m('BRL', '27359.00'));
    expect(fee({ form: 'half-hour', country: 'BR', agreement: 'br-sp', prep: 2, shoot: 3, cut: 2 })).toEqual(m('BRL', '10670.97'));
    // DGC Quebec/AQPM: base and use fees by the budget's tier, a share below; every tier's edge.
    const qc = (form: PrepArgs['form'], budget: number, shoot = 8) => fee({ form, country: 'CA', agreement: 'dgc-qc', budget, shoot });
    expect(qc('feature', 10_879_238)).toEqual(m('CAD', '363749'));
    expect(qc('feature', 10_879_237)).toEqual(m('CAD', '321310'));
    expect(qc('feature', 2_175_847)).toEqual(m('CAD', '81843'));
    expect(qc('feature', 2_175_846)).toEqual(m('CAD', '65275.38'));
    expect(qc('feature', 1_631_885)).toEqual(m('CAD', '48956.55'));
    expect(qc('feature', 1_631_884)).toEqual(m('CAD', '44876.81'));
    expect(qc('feature', 1_000_001)).toEqual(m('CAD', '27500.03'));
    expect(qc('hour', 1_414_301)).toEqual(m('CAD', '50924'));
    expect(qc('hour', 1_414_300)).toEqual(m('CAD', '42437'));
    expect(qc('hour', 1_196_716)).toEqual(m('CAD', '42437'));
    expect(qc('hour', 1_196_715)).toEqual(m('CAD', '35901.45'));
    expect(qc('hour', 598_357)).toEqual(m('CAD', '16454.82'));
    expect(qc('half-hour', 1_087_924, 4)).toEqual(m('CAD', '31012'));
    expect(qc('half-hour', 1_087_923, 4)).toEqual(m('CAD', '24529'));
    expect(qc('half-hour', 788_743, 4)).toEqual(m('CAD', '20613'));
    expect(qc('half-hour', 543_961, 4)).toEqual(m('CAD', '16318.83'));
    expect(qc('half-hour', 380_772, 4)).toEqual(m('CAD', '10471.23'));
    // ARRQ-AQPM television: each recording day, each post day, each prep half-day past the three included.
    const arrq = (prep: number) => fee({ form: 'hour', country: 'CA', agreement: 'arrq', prep, shoot: 4, cut: 2 });
    expect(arrq(3)).toEqual(m('CAD', '12613.75'));
    expect(arrq(2)).toEqual(m('CAD', '11973.25'));
    expect(arrq(1)).toEqual(m('CAD', '11653'));
    // The National Film Board: a tenth of the budget, at least C$3,500, and C$100,000 over C$1 million.
    const nfb = (budget: number) => fee({ form: 'feature', country: 'CA', agreement: 'nfb', budget, prep: 10, shoot: 20, cut: 10 });
    expect([nfb(30_000), nfb(35_000), nfb(40_000), nfb(1_000_000), nfb(1_000_001), nfb(2_000_000)]).toEqual([m('CAD', '3500'), m('CAD', '3500'), m('CAD', '4000'), m('CAD', '100000'), m('CAD', '100000.10'), m('CAD', '200000')]);
    // The BVR's cinema rule, by the budget's tier.
    const bvr = (budget: number) => fee({ form: 'feature', country: 'DE', agreement: 'bvr-cinema', budget, prep: 20, shoot: 30, cut: 30 });
    expect([799_999, 800_000, 7_999_999, 8_000_000].map(bvr)).toEqual(['27500', '33500', '130000', '160000'].map((x) => m('EUR', x)));
    // Netflix's rule: none below €1.35 million an episode; the shoot days it includes, each one past them paid.
    const nfx = (budget: number, shoot: number) => fee({ form: 'hour', country: 'DE', budget, prep: 10, shoot, cut: 5 });
    expect(nfx(1_350_000, 20)).toBeNull();
    expect([nfx(1_350_001, 13), nfx(1_350_001, 14), nfx(1_800_001, 15), nfx(2_700_000, 14), nfx(2_700_001, 15), nfx(2_700_001, 16), nfx(3_600_001, 20)]).toEqual(['37000', '39000', '46000', '44000', '46000', '48500', '62500'].map((x) => m('EUR', x)));
    // France's film production agreement: by the week under five months, by the month from five (21 days each).
    expect(fee({ form: 'feature', country: 'FR', prep: 34, shoot: 40, cut: 30 })).toEqual(m('EUR', '62717.62'));
    expect(fee({ form: 'feature', country: 'FR', prep: 35, shoot: 40, cut: 30 })).toEqual(m('EUR', '42816.85'));
    // The Dutch fair-pay start rate, level J, by the hour of an eight-hour day.
    expect(HOURS).toBe(8);
    expect(fee({ form: 'feature', country: 'NL', agreement: 'nl-fair-pay', prep: 3, shoot: 5, cut: 2 })).toEqual(m('EUR', '4019.20'));
    // Virke's feature agreement: a shooting day and a day of prep or post, by the director's years, at the rate in force.
    const feature = (now: number, directing?: DirectingSlice) => fee({ form: 'feature', country: 'NO', prep: 10, shoot: 20, cut: 10 }, now, directing);
    expect(feature(NOW)).toEqual(m('NOK', '173780'));
    expect(feature(day(2025, 5, 31))).toEqual(m('NOK', '166460'));
    expect(() => feature(day(2024, 5, 31))).toThrow('no minimum is known before 2024-06-01');
    const years = (y: number) => feature(NOW, before(day(2026 - y, 7, 1)));
    expect([years(2), years(3), years(5), years(6), years(9), years(10)]).toEqual(['173780', '187780', '187780', '211360', '211360', '245080'].map((x) => m('NOK', x)));
    // Virke's TV drama agreement: by the month of 21.67 days, a tenth more for an engagement of five days or fewer.
    expect(fee({ form: 'hour', country: 'NO', prep: 3, shoot: 10, cut: 7 })).toEqual(m('NOK', '83425.01'));
    expect(fee({ form: 'half-hour', country: 'NO', prep: 1, shoot: 3, cut: 1 })).toEqual(m('NOK', '23634.32'));
    expect(fee({ form: 'half-hour', country: 'NO', prep: 2, shoot: 3, cut: 1 })).toEqual(m('NOK', '25027.51'));
    // Medieföretagen: by the minute to 73, the cap above, and the month of 21 days; a quarter less on a first job.
    const se = (minutes: number, directing: DirectingSlice = before(day(2025, 1, 1)), now = NOW) => fee({ form: 'feature', country: 'SE', agreement: 'medieforetagen', minutes, prep: 10, shoot: 10, cut: 10 }, now, directing);
    expect(se(14)).toBeNull();
    expect([se(15), se(73), se(74), se(120)]).toEqual(['78486.43', '204752.43', '204284.43', '204284.43'].map((x) => m('SEK', x)));
    expect(se(90, DIRECTING_START)).toEqual(m('SEK', '164671.18'));
    expect(se(90, before(day(2025, 1, 1)), day(2026, 5, 31))).toEqual(m('SEK', '198332.71'));
    // SVT: each of the first 60 minutes, less from the 61st, and the month.
    const svt = (minutes: number, directing: DirectingSlice = before(day(2025, 1, 1))) => fee({ form: 'hour', country: 'SE', agreement: 'svt', minutes, prep: 10, shoot: 10, cut: 10 }, NOW, directing);
    expect([svt(14), svt(60), svt(61), svt(15, DIRECTING_START)]).toEqual([null, m('SEK', '172791.43'), m('SEK', '173334.43'), m('SEK', '68758.93')]);
    // Where nothing sets the pay, or the game doesn't know what does, there is no minimum.
    for (const cc of ['ES', 'IE', 'IT', 'NZ', 'ZA', 'IN', 'JP', 'KR', 'MX', 'NG']) expect(fee({ form: 'feature', country: cc, prep: 10, shoot: 20, cut: 10 }), cc).toBeNull();
    expect(fee({ form: 'feature', country: 'GB', prep: 10, shoot: 20, cut: 10 })).toBeNull();
    expect(fee({ form: 'hour', country: 'DK', prep: 10, shoot: 8, cut: 4 })).toBeNull();
    expect(fee({ form: 'feature', country: 'CA', agreement: 'cmpa-dgc', prep: 10, shoot: 20, cut: 10 })).toBeNull();
  });

  it('takes the periods its agreement guarantees, or the contract gives where it guarantees none', () => {
    expect(job({ form: 'feature', country: 'CA', agreement: 'dgc-qc', budget: 10_879_238, shoot: 32 })).toMatchObject({ country: 'CA', agreement: 'dgc-qc', budget: 10_879_238, minutes: null, prepDays: 48, shootDays: 32, cutDays: 40 });
    expect(job({ form: 'feature', country: 'CA', agreement: 'dgc-qc', budget: 1_000_000, shoot: 40 })).toMatchObject({ prepDays: 0, cutDays: 20 });
    expect(job({ form: 'feature', country: 'CA', agreement: 'dgc-qc', budget: 2_000_000, shoot: 30 })).toMatchObject({ prepDays: 10, cutDays: 30 });
    expect(job({ form: 'hour', country: 'CA', agreement: 'dgc-qc', budget: 1_414_301, shoot: 8 })).toMatchObject({ prepDays: 10, cutDays: 2 });
    expect(job({ form: 'half-hour', country: 'CA', agreement: 'dgc-qc', budget: 1, shoot: 4 })).toMatchObject({ prepDays: 6, cutDays: 2 });
    expect(job({ form: 'feature', country: 'NO', prep: 12, shoot: 25, cut: 30 })).toMatchObject({ country: 'NO', agreement: 'virke-feature', budget: null, minutes: null, prepDays: 12, shootDays: 25, cutDays: 30 });
    expect(job({ form: 'hour', country: 'SE', agreement: 'svt', minutes: 58, prep: 1, shoot: 2, cut: 3 })).toMatchObject({ minutes: 58, prepDays: 1, shootDays: 2, cutDays: 3 });
    expect(job({ form: 'hour' })).toMatchObject({ country: 'US', agreement: 'dga', minutes: null });
    expect(job({ form: 'hour', country: 'US' })).toMatchObject({ country: 'US', agreement: 'dga' });
    // A job abroad is engaged for its prep, shoot and cut, in the market's country.
    expect(engagement(job({ form: 'feature', country: 'NO', prep: 12, shoot: 25, cut: 30 }))).toEqual({ country: 'NO', days: 67 });
    expect(engagement(job({ form: 'hour' }))).toEqual({ country: 'US', days: 19 });
  });

  it('is refused where the market, its agreement or its terms say otherwise', () => {
    const go = (a: Record<string, unknown>) => () => job(Object.fromEntries(Object.entries({ form: 'feature', prep: 10, shoot: 20, cut: 10, ...a }).filter(([, v]) => v !== undefined)) as PrepArgs);
    expect(go({ country: 'XX' })).toThrow("there's no market XX");
    expect(go({ country: 'toString' })).toThrow("there's no market toString");
    expect(go({ country: 'DE', form: 'half-hour', budget: 1 })).toThrow('no agreement the game knows covers a half-hour in DE');
    expect(go({ country: 'CA' })).toThrow('a feature in CA names its agreement: cmpa-dgc, dgc-bc, dgc-qc, nfb');
    expect(go({ country: 'CA', agreement: 'arrq' })).toThrow("arrq doesn't cover a feature in CA");
    expect(go({ country: 'CA', agreement: 'au-award' })).toThrow("au-award doesn't cover a feature in CA");
    expect(go({ form: 'pilot' as never, country: 'AU' })).toThrow("there's no form pilot");
    expect(go({ country: 'AU', budget: 1 })).toThrow("au-award doesn't read a feature's budget");
    expect(go({ country: 'AU', minutes: 90 })).toThrow("au-award doesn't read a feature's running time");
    expect(go({ country: 'DE' })).toThrow('the budget is a whole number of at least 1 (undefined)');
    expect(go({ country: 'DE', budget: 0 })).toThrow('the budget is a whole number of at least 1 (0)');
    expect(go({ country: 'SE', agreement: 'medieforetagen' })).toThrow('the running time is a whole number of at least 1 (undefined)');
    expect(go({ country: 'AU', shoot: 0 })).toThrow('the shooting days is a whole number of at least 1 (0)');
    expect(go({ country: 'AU', prep: undefined })).toThrow('the prep days is a whole number of at least 1 (undefined)');
    expect(go({ country: 'AU', cut: 1.5 })).toThrow('the cut days is a whole number of at least 1 (1.5)');
    const qc = { country: 'CA', agreement: 'dgc-qc', budget: 1_000_000, prep: undefined, cut: undefined };
    expect(go({ ...qc, prep: 5 })).toThrow("dgc-qc guarantees a feature's prep");
    expect(go({ ...qc, cut: 5 })).toThrow("dgc-qc guarantees a feature's cut");
    expect(go({ ...qc, shoot: 41 })).toThrow('dgc-qc guarantees a feature 40 days of prep and shoot, fewer than its shoot');
    expect(go({ ...qc, shoot: 40 })).not.toThrow();
    // In the US the DGA sets all of it.
    for (const k of ['agreement', 'prep', 'cut', 'minutes'] as const) expect(() => job({ form: 'hour', [k]: k === 'agreement' ? 'dga' : 5 }), k).toThrow("the DGA sets a US job's agreement, prep and cut, and reads no running time");
  });

  it("reads the director's whole years in the work since the first film, and whether this is the first", () => {
    expect(experience(DIRECTING_START, NOW)).toBe(0);
    const s = before(day(2023, 7, 2));
    expect(experience(s, day(2026, 7, 1))).toBe(2);
    expect(experience(s, day(2026, 7, 2))).toBe(3);
    expect(experience(s, day(2026, 6, 2))).toBe(2);
    expect(experience(s, day(2026, 8, 1))).toBe(3);
    // The director's years and the first job read from the slice, the earlier film kept.
    const l = dispatch(made(NOW, s), prepFilm, { form: 'feature', country: 'NO', prep: 10, shoot: 20, cut: 10 });
    expect(l.slices.directing.films.map((x) => x.fee)).toEqual([s.films[0]?.fee, m('NOK', '173780')]);
  });

  it("pays a fee by its own count: whole units in a band, the rest pro rata, a first job's cut, a short engagement's more", () => {
    expect([within(10, null), within(10, [4, null]), within(3, [4, null]), within(4, [4, null]), within(70, [1, 60]), within(70, [61, null]), within(0, [1, 60])]).toEqual([10, 7, 0, 1, 60, 10, 0]);
    expect(stepAt([['2025-01-01', '1'], ['2026-01-01', '2']], '2025-12-31')).toBe('1');
    expect(stepAt([['2025-01-01', '1'], ['2026-01-01', '2']], '2026-01-01')).toBe('2');
    expect(() => stepAt([['2025-01-01', '1']], '2024-12-31')).toThrow('no minimum is known before 2025-01-01');
    const a: MarketAgreement = { country: 'XX', forms: ['feature'], currency: 'EUR', none: false, month: null, short: null, fees: [], periods: [] };
    const fee1 = (x: Partial<Fee>): Fee => ({ form: 'feature', per: 'day', phases: ['prep', 'shoot', 'cut'], when: {}, band: null, floor: null, first: null, steps: [['2020-01-01', '100']], ...x });
    const j: Job = { budget: 1000, minutes: 90, days: { prep: 2, shoot: 3, cut: 5 }, years: 0, first: false };
    const pays = (x: Partial<Fee>, ag = a, jj = j) => feePays(ag, fee1(x), jj, '2026-01-01');
    expect(pays({})).toEqual(m('EUR', '1000'));
    expect(pays({ phases: ['shoot'] })).toEqual(m('EUR', '300'));
    expect(pays({ phases: ['prep', 'cut'] })).toEqual(m('EUR', '700'));
    expect(pays({ per: 'half-day' })).toEqual(m('EUR', '2000'));
    expect(pays({ per: 'half-day', band: [4, null], phases: ['prep'] })).toEqual(m('EUR', '100'));
    expect(pays({ per: 'week' })).toEqual(m('EUR', '200'));
    expect(pays({ per: 'month' })).toEqual(m('EUR', '47.62'));
    expect(pays({ per: 'month' }, { ...a, month: 20 })).toEqual(m('EUR', '50'));
    expect(pays({ per: 'hour' })).toEqual(m('EUR', '8000'));
    expect(pays({ per: 'day', band: [3, 9] })).toEqual(m('EUR', '700'));
    expect(pays({ per: 'job' })).toEqual(m('EUR', '100'));
    expect(pays({ per: 'minute' })).toEqual(m('EUR', '9000'));
    expect(pays({ per: 'minute', band: [61, null] })).toEqual(m('EUR', '3000'));
    expect(pays({ per: 'share', steps: [['2020-01-01', '0.1']] })).toEqual(m('EUR', '100'));
    expect(pays({ per: 'share', steps: [['2020-01-01', '0.1']], floor: '150' })).toEqual(m('EUR', '150'));
    expect(pays({ per: 'share', steps: [['2020-01-01', '0.1']], floor: '50' })).toEqual(m('EUR', '100'));
    expect(pays({ per: 'job', first: '0.75' })).toEqual(m('EUR', '100'));
    expect(pays({ per: 'job', first: '0.75' }, a, { ...j, first: true })).toEqual(m('EUR', '75'));
    // A short engagement is paid more by the time it works, not by the job or the minute.
    const short = { ...a, short: { upTo: 10, share: '0.1' } };
    expect(pays({}, short)).toEqual(m('EUR', '1100'));
    expect(pays({}, short, { ...j, days: { prep: 2, shoot: 3, cut: 6 } })).toEqual(m('EUR', '1100'));
    expect(pays({}, { ...a, short: { upTo: 9, share: '0.1' } })).toEqual(m('EUR', '1000'));
    expect(pays({ per: 'job' }, short)).toEqual(m('EUR', '100'));
    expect(pays({ per: 'minute' }, short)).toEqual(m('EUR', '9000'));
    // Every fee whose tiers hold, added; none where none holds.
    const two = { ...a, fees: [fee1({ per: 'job' }), fee1({ per: 'job', steps: [['2020-01-01', '5']], when: { budget: [0, 1000] } }), fee1({ per: 'job', when: { years: [1, null] } }), fee1({ form: 'hour' as never, per: 'job' })] };
    expect(marketFee(two, 'feature', j, '2026-01-01')).toEqual(m('EUR', '105'));
    expect(marketFee(two, 'feature', { ...j, budget: 1001 }, '2026-01-01')).toEqual(m('EUR', '100'));
    expect(marketFee(two, 'feature', { ...j, years: 1 }, '2026-01-01')).toEqual(m('EUR', '205'));
    expect(marketFee({ ...a, fees: [fee1({ per: 'job', when: { minutes: [91, null] } })] }, 'feature', j, '2026-01-01')).toBeNull();
    expect(marketFee({ ...a, fees: [fee1({ per: 'job', when: { days: [0, 9] } })] }, 'feature', j, '2026-01-01')).toBeNull();
    expect(marketFee({ ...a, fees: [fee1({ per: 'job', when: { days: [10, 10] } })] }, 'feature', j, '2026-01-01')).toEqual(m('EUR', '100'));
  });

  it("tells the player what of a market isn't known", () => {
    expect(UNKEPT_LINE).toBe('directing.unkept');
    expect(Object.keys(MISSING)).toEqual(['agreement', 'fees', 'periods', 'union', 'language', 'none']);
    expect(aboutMarket('GB')).toBe(t(UNKEPT_LINE, { country: 'United Kingdom', missing: "some of the minimum fees, the prep, shoot and cut a director is guaranteed and the guild's fees or how a director joins" }));
    expect(aboutMarket('NO')).toBe("Some of what a director is paid or given in Norway isn't known to this game yet: some of the minimum fees.");
    expect(aboutMarket('JP')).toBe(t(UNKEPT_LINE, { country: 'Japan', missing: 'some of the minimum fees, the prep, shoot and cut a director is guaranteed and the language the work is made in' }));
    expect(aboutMarket('NG')).toBe(t(UNKEPT_LINE, { country: 'Nigeria', missing: "whether anything sets the pay where no agreement does and the guild's fees or how a director joins" }));
    expect(aboutMarket('BR')).toContain('some of the agreements a director is engaged under.');
    for (const cc of ['AU', 'US', 'XX', 'toString']) expect(aboutMarket(cc), cc).toBeUndefined();
    expect(Object.keys(MARKETS).filter((cc) => aboutMarket(cc) !== undefined)).toEqual(Object.keys(MARKETS).filter((cc) => cc !== 'AU'));
  });
});
