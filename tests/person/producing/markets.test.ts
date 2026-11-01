import { ACTING_START, type ActingSlice } from '../../../src/person/acting/acting.ts';
import { DIRECTING_START, type DirectingSlice } from '../../../src/person/directing/directing.ts';
import type { IdentitySlice } from '../../../src/person/identity/identity.ts';
import type { PermitsSlice } from '../../../src/person/permits/permits.ts';
import { permitsEverywhere } from '../../support/permits.ts';
import { identity } from '../../support/person.ts';
import { describe, expect, it } from 'vitest';
import { begin, dispatch, pass, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor, money, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { addMonths } from '../../../src/core/time/dates.ts';
import { t } from '../../../src/core/text/text.ts';
import { ATTRIBUTES_START, chooseAttributes, componentValues } from '../../../src/person/attributes/attributes.ts';
import { MARKET as WORK } from '../../../src/person/acting/acting.ts';
import {
  aboutMarket,
  amountOf,
  applyToFunder,
  creditIn,
  currencyOf,
  engagementOf,
  factor,
  feeIn,
  fundFor,
  HOME,
  MARKETS,
  MISSING,
  optionMaterial,
  OPTION_FEE,
  planProject,
  PRODUCING_START,
  projectOf,
  raised,
  raiseMoney,
  releaseFilm,
  renewOption,
  sellSkill,
  shootProject,
  target,
  tierFor,
  UNKEPT_LINE,
  ZONE,
  zoneOf,
  type Market,
  type ProducingSlice,
  type Tier,
} from '../../../src/person/producing/producing.ts';
import type { AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import type { GenresSlice } from '../../../src/person/genres/genres.ts';
import compiled from '../../../src/person/producing/markets.json' with { type: 'json' };
import { falsifyAny } from '../../support/falsify-core.ts';

type Producing = { attributes: AttributesSlice; producing: ProducingSlice; genres: GenresSlice; identity: IdentitySlice; acting: ActingSlice; directing: DirectingSlice; permits: PermitsSlice };
const SEED = '0123456789abcdef';
const T0 = daysFromCivil(2026, 11, 1) * SECONDS_PER_DAY;
const GENRE = 'action';
const made = (all = 50): Life<Producing> =>
  dispatch(begin(SEED, T0, { attributes: structuredClone(ATTRIBUTES_START), producing: structuredClone(PRODUCING_START), genres: { loved: [GENRE] }, identity: identity(), acting: structuredClone(ACTING_START), directing: structuredClone(DIRECTING_START), permits: permitsEverywhere() }), chooseAttributes, { role: 'producer', all, each: {} });
const project = (l: Life<Producing>, id = l.slices.producing.projects.length) => projectOf(l.slices.producing, id);
const optioned = (market: string, l = made()) => dispatch(l, optionMaterial, { days: 3, genre: GENRE, market });
const planned = (market: string, budget: string, l = made()) => {
  const o = optioned(market, l);
  return dispatch(o, planProject, { project: o.slices.producing.projects.length, budget });
};
const plan = (market: string, budget: string) => project(planned(market, budget)).plan;
const of = (currency: CurrencyCode, major: string): Money => fromMajor(currency, major);
const award = (market: string, budget: string) => fundFor(project(planned(market, budget))).award;
const edit = (l: Life<Producing>, f: (s: ProducingSlice) => void): Life<Producing> => {
  const producing = structuredClone(l.slices.producing);
  f(producing);
  return { ...l, slices: { ...l.slices, producing } };
};
/** Financed by hand: equity closing what the project still needs. */
const funded = (l: Life<Producing>) =>
  edit(l, (s) => {
    const p = projectOf(s, s.projects.length);
    p.raised['equity'] = money(p.plan?.budget.currency ?? 'GBP', target(p) - raised(p));
  });

/** A tier as a line: its budgets, then its sum, or its bands (from-to: rate), base, net and most. */
const line = (x: Tier) =>
  `${x.budget[0]}-${x.budget[1] ?? ''} ${x.sum !== null ? `sum ${x.sum}` : x.bands.map((b) => `${b.from}-${b.to ?? ''}:${b.rate}`).join(' ')}${x.base === 1 ? '' : ` base ${x.base}`}${x.net ? ' net' : ''}${x.most === null ? '' : ` most ${x.most}`}`.trim();
const lines = (m: Market) => ({
  currency: m.currency,
  fund: m.fund === null ? null : [`rate ${m.fund.rate}`, ...m.fund.tiers.map(line)],
  aid: m.aid.map(line),
  credit: m.credit === null ? null : m.credit.map(line),
  fees: m.fees.map((part) => part.map(line)),
  release: m.release === null ? null : m.release.map((r) => `${r.budget[0]}-${r.budget[1] ?? ''} ${r.rate}`),
  unknown: m.unknown.join(' '),
});

describe('the markets', () => {
  it("are each country's own, every term as the research gives it", () => {
    expect(MARKETS).toBe(compiled);
    expect(HOME).toBe('GB');
    expect(Object.fromEntries(Object.entries(MARKETS).map(([cc, m]) => [cc, lines(m)]))).toEqual({
      // The Producer Offset's 40% for a feature (R-4612) from A$500,000 of spend; Screen Australia sets no fee cap.
      AU: { currency: 'AUD', fund: null, aid: [], credit: ['500000- 0-:0.4'], fees: [], release: null, unknown: 'language' },
      // ANCINE's management fee of at most 10% of the budget.
      BR: { currency: 'BRL', fund: null, aid: [], credit: null, fees: [['0- 0-:0.1']], release: null, unknown: 'fund incentive outcomes' },
      // Telefilm (R-4612): 49% to $500,000 under $1.5m, a third to $3.5m, 49% to $4m above; its English low-budget 11.1%.
      CA: { currency: 'CAD', fund: ['rate 0.111', '0-1499999.99 0-:0.49 most 500000', '1500000-3499999.99 0-:0.3333', '3500000- 0-:0.49 most 4000000'], aid: [], credit: null, fees: [], release: null, unknown: 'market union' },
      // The FFA's jury fund: up to €1m to features to €6m, 28.2% approved; aid held to 50%; 30% DFFF/GMPF; the fee and overheads.
      DE: {
        currency: 'EUR',
        fund: ['rate 0.282', '0-6000000  most 1000000'],
        aid: ['0- 0-:0.5'],
        credit: ['0- 0-:0.3'],
        fees: [['0-299999.99 sum 15000', '300000-500000 sum 25000', '500000.01- 0-:0.05 net most 250000'], ['0- 0-5000000:0.1 5000000-:0.05 most 650000']],
        release: null,
        unknown: 'outcomes',
      },
      // The incentive: 25% to DKK 20m from a DKK 25m budget.
      DK: { currency: 'DKK', fund: null, aid: [], credit: ['25000000- 0-:0.25 most 20000000'], fees: [], release: null, unknown: 'fund feecap' },
      // The ICAA's general aid: 40% to €1.4m from €1.3m, 38% funded; aid 50%; the deduction 30% of the first €1m, 25% after, to €20m.
      ES: {
        currency: 'EUR',
        fund: ['rate 0.38', '1300000- 0-:0.4 most 1400000'],
        aid: ['0- 0-:0.5'],
        credit: ['0- 0-1000000:0.3 1000000-:0.25 most 20000000'],
        fees: [['0- 0-:0.05'], ['0- 0-:0.07']],
        release: null,
        unknown: 'outcomes fund',
      },
      // The CNC's avance (R-4612: 12.3%), held to the 60%/50% cap on all public aid; the French-language film's 30% on 80% to €30m.
      FR: {
        currency: 'EUR',
        fund: ['rate 0.123', '0-'],
        aid: ['0-1250000 0-:0.6', '1250000.01- 0-:0.5'],
        credit: ['0- 0-:0.3 base 0.8 most 30000000'],
        fees: [['0- 0-4000000:0.15 4000000-7000000:0.08 7000000-10000000:0.05']],
        release: null,
        unknown: '',
      },
      // Screen Ireland's loans by budget, 19 of 26 funded (2021); state aid held to 50% above €3m; Section 481's 32%; fees 15%.
      IE: {
        currency: 'EUR',
        fund: [`rate ${19 / 26}`, '0-3000000 0-:0.7 most 950000', '3000000.01-7000000 0-:0.65 most 1200000', '7000000.01-20000000 0-:0.65 most 1300000'],
        aid: ['3000000.01- 0-:0.5'],
        credit: ['0- 0-:0.32'],
        fees: [['0- 0-:0.15']],
        release: null,
        unknown: 'fund',
      },
      IN: { currency: 'INR', fund: null, aid: [], credit: null, fees: [], release: null, unknown: 'fund feecap outcomes' },
      // The selective grants: 40% to first and second features to €4m, 25% funded; aid 50%; the credit 30% to €4m; fee and overheads 7.5% each; 82% released.
      IT: {
        currency: 'EUR',
        fund: ['rate 0.25', '0-4000000 0-:0.4'],
        aid: ['0- 0-:0.5'],
        credit: ['0- 0-:0.3 most 4000000'],
        fees: [['0- 0-:0.075'], ['0- 0-:0.075']],
        release: ['0- 0.82'],
        unknown: 'outcomes',
      },
      // The Arts Council's fixed grants by total budget, 21% funded; no overheads may be budgeted.
      JP: {
        currency: 'JPY',
        fund: ['rate 0.21', '20000000-49999999 sum 4000000', '50000000-99999999 sum 10000000', '100000000-199999999 sum 20000000', '200000000-299999999 sum 40000000', '300000000- sum 60000000'],
        aid: [],
        credit: null,
        fees: [['0- 0-:0']],
        release: null,
        unknown: 'outcomes language',
      },
      // KOFIC's mid-budget support: ₩2bn to ₩10bn, 40% to ₩2.5bn, 4.9% funded; a small company's 15% deduction.
      KR: { currency: 'KRW', fund: ['rate 0.049', '2000000000-10000000000 0-:0.4 most 2500000000'], aid: [], credit: ['0- 0-:0.15'], fees: [], release: null, unknown: 'feecap' },
      // The 2026 credit: 30% to MXN 40m from MXN 40m spent.
      MX: { currency: 'MXN', fund: null, aid: [], credit: ['40000000- 0-:0.3 most 40000000'], fees: [], release: null, unknown: 'union outcomes' },
      // No rebate on a film's spend.
      NG: { currency: 'NGN', fund: null, aid: [], credit: [], fees: [], release: null, unknown: 'fund outcomes union feecap' },
      // The Fund: 33 of 62, 42% of a supported film's cost; aid 50%; the incentive 35% of 80% from €1m to €3m; fees.
      NL: {
        currency: 'EUR',
        fund: [`rate ${33 / 62}`, '0- 0-:0.42'],
        aid: ['0- 0-:0.5'],
        credit: ['1000000- 0-:0.35 base 0.8 most 3000000'],
        fees: [['0-749999.99 0-:0.175', '750000- 0-:0.075'], ['750000- 0-:0.075 most 350000']],
        release: null,
        unknown: '',
      },
      // The NFI's market assessment: 6 of 61, 50% to NOK 9.8m; public money 75%; the incentive 25% from NOK 25m.
      NO: { currency: 'NOK', fund: [`rate ${6 / 61}`, '0- 0-:0.5 most 9800000'], aid: ['0- 0-:0.75'], credit: ['25000000- 0-:0.25'], fees: [], release: null, unknown: 'feecap' },
      // The rebate: 40% to NZ$12m from NZ$1m; overheads 5% to NZ$400,000.
      NZ: { currency: 'NZD', fund: null, aid: [], credit: ['1000000- 0-:0.4 most 12000000'], fees: [['0- 0-:0.05 most 400000']], release: null, unknown: 'outcomes' },
      // The incentive: 25% to SEK 10m from SEK 30m; the mark-up 7% to SEK 2m.
      SE: { currency: 'SEK', fund: null, aid: [], credit: ['30000000- 0-:0.25 most 10000000'], fees: [['0- 0-:0.07 most 2000000']], release: null, unknown: 'union fund' },
      // California's independent film: 35% to $7m from $1m (Los Angeles, the market's city).
      US: { currency: 'USD', fund: null, aid: [], credit: ['1000000- 0-:0.35 most 7000000'], fees: [], release: null, unknown: 'market feecap' },
      // The dtic's 35% to R25m from R1.5m; fees 10% to R1m, overheads 2% to R200,000.
      ZA: { currency: 'ZAR', fund: null, aid: [], credit: ['1500000- 0-:0.35 most 25000000'], fees: [['0- 0-:0.1 most 1000000'], ['0- 0-:0.02 most 200000']], release: null, unknown: 'fund' },
    });
  });

  it("runs each market's months in its city's time, the actor's market there, and pays in its currency", () => {
    expect(zoneOf(HOME)).toBe(ZONE);
    expect([zoneOf('US'), zoneOf('CA'), zoneOf('JP'), zoneOf('NZ')]).toEqual(['America/Los_Angeles', 'America/Toronto', 'Asia/Tokyo', 'Pacific/Auckland']);
    for (const cc of Object.keys(MARKETS)) expect(Object.values(WORK).map((w) => w.zone), cc).toContain(zoneOf(cc));
    expect(currencyOf(HOME)).toBe('GBP');
    expect([currencyOf('JP'), currencyOf('FR')]).toEqual(['JPY', 'EUR']);
    const l = optioned('JP');
    expect(project(l)).toMatchObject({ market: 'JP', expires: addMonths('Asia/Tokyo', T0, 18), options: [OPTION_FEE] });
    expect(project(dispatch(l, renewOption, { project: 1 })).expires).toBe(addMonths('Asia/Tokyo', addMonths('Asia/Tokyo', T0, 18), 18));
    expect(project(dispatch(made(), optionMaterial, { days: 1, genre: GENRE, market: 'GB' })).market).toBe('GB');
    expect(() => optioned('XX')).toThrow("XX isn't a market a producer works in");
    expect(() => optioned('toString')).toThrow("toString isn't a market a producer works in");
    expect(project(planned('JP', '50000000')).plan?.budget).toEqual(money('JPY', 50_000_000));
    expect(() => planned('JP', '0')).toThrow('a budget is at least 1 JPY (0)');
    expect(project(planned('JP', '1')).plan?.budget).toEqual(money('JPY', 1));
    expect(() => planned('FR', '0.99')).toThrow('a budget is at least 1 EUR (0.99)');
    expect(() => planned('JP', '1.5')).toThrow('JPY has 0 decimal places');
  });
});

describe("a market's project", () => {
  it("is planned, funded and released on its market's terms", () => {
    // The fee and overheads at each cap: Germany's flat fees to €500,000, then 5% of the budget less 5%, to €250,000, and
    // overheads at 10% to €5m and 5% above, to €650,000; the research's example: €3.25m, a fee of €154,375.
    expect(plan('DE', '299999.99')?.fee).toEqual(of('EUR', '45000'));
    expect(plan('DE', '300000')?.fee).toEqual(of('EUR', '55000'));
    expect(plan('DE', '500000')?.fee).toEqual(of('EUR', '75000'));
    expect(plan('DE', '500000.01')?.fee).toEqual(money('EUR', Math.round(50_000_001 * 0.05 * 0.95 + 50_000_001 * 0.1)));
    expect(plan('DE', '3250000')?.fee).toEqual(of('EUR', String(154_375 + 325_000)));
    expect(plan('DE', '8000000')?.fee).toEqual(of('EUR', '900000'));
    expect(plan('DE', '20000000')?.fee).toEqual(of('EUR', '900000'));
    // France's pay cap: 15% of the first €4m, 8% to €7m, 5% to €10m (its examples: €8m, €890,000; at most €990,000).
    expect(plan('FR', '2000000')?.fee).toEqual(of('EUR', '300000'));
    expect(plan('FR', '8000000')?.fee).toEqual(of('EUR', '890000'));
    expect(plan('FR', '12000000')?.fee).toEqual(of('EUR', '990000'));
    // The Netherlands: 17.5% together under €750,000; from it 7.5% and overheads 7.5% to €350,000.
    expect(plan('NL', '749999.99')?.fee).toEqual(money('EUR', Math.round(74_999_999 * 0.175)));
    expect(plan('NL', '750000')?.fee).toEqual(of('EUR', '112500'));
    expect(plan('NL', '10000000')?.fee).toEqual(of('EUR', '1100000'));
    expect([plan('ES', '2000000')?.fee, plan('IT', '2000000')?.fee, plan('IE', '2000000')?.fee, plan('BR', '1000000')?.fee]).toEqual([of('EUR', '240000'), of('EUR', '300000'), of('EUR', '300000'), of('BRL', '100000')]);
    expect([plan('NZ', '2000000')?.fee, plan('NZ', '10000000')?.fee, plan('SE', '10000000')?.fee, plan('SE', '40000000')?.fee]).toEqual([of('NZD', '100000'), of('NZD', '400000'), of('SEK', '700000'), of('SEK', '2000000')]);
    expect([plan('ZA', '5000000')?.fee, plan('ZA', '20000000')?.fee, plan('JP', '100000000')?.fee]).toEqual([of('ZAR', '600000'), of('ZAR', '1200000'), money('JPY', 0)]);
    // No cap set, or none known: no fee is carried.
    for (const cc of ['AU', 'CA', 'DK', 'IN', 'KR', 'MX', 'NG', 'NO', 'US']) expect(plan(cc, '2000000')?.fee, cc).toBeNull();

    // The credit at its rate on the share counted, at most its cap, nothing below its threshold.
    expect([plan('AU', '499999.99')?.credit, plan('AU', '500000')?.credit]).toEqual([of('AUD', '0'), of('AUD', '200000')]);
    expect([plan('DK', '24999999.99')?.credit, plan('DK', '25000000')?.credit, plan('DK', '100000000')?.credit]).toEqual([of('DKK', '0'), of('DKK', '6250000'), of('DKK', '20000000')]);
    expect([plan('ES', '1000000')?.credit, plan('ES', '2000000')?.credit, plan('ES', '100000000')?.credit]).toEqual([of('EUR', '300000'), of('EUR', '550000'), of('EUR', '20000000')]);
    expect([plan('FR', '1000000')?.credit, plan('FR', '200000000')?.credit]).toEqual([of('EUR', '240000'), of('EUR', '30000000')]);
    expect([plan('NL', '999999.99')?.credit, plan('NL', '1000000')?.credit, plan('NL', '20000000')?.credit]).toEqual([of('EUR', '0'), of('EUR', '280000'), of('EUR', '3000000')]);
    expect([plan('IT', '20000000')?.credit, plan('IE', '2000000')?.credit, plan('DE', '2000000')?.credit, plan('KR', '5000000000')?.credit]).toEqual([of('EUR', '4000000'), of('EUR', '640000'), of('EUR', '600000'), of('KRW', '750000000')]);
    expect([plan('MX', '39999999.99')?.credit, plan('MX', '40000000')?.credit, plan('MX', '200000000')?.credit]).toEqual([of('MXN', '0'), of('MXN', '12000000'), of('MXN', '40000000')]);
    expect([plan('NO', '24999999.99')?.credit, plan('NO', '25000000')?.credit, plan('NZ', '999999.99')?.credit, plan('NZ', '1000000')?.credit, plan('NZ', '50000000')?.credit]).toEqual([of('NOK', '0'), of('NOK', '6250000'), of('NZD', '0'), of('NZD', '400000'), of('NZD', '12000000')]);
    expect([plan('SE', '29999999.99')?.credit, plan('SE', '30000000')?.credit, plan('SE', '50000000')?.credit]).toEqual([of('SEK', '0'), of('SEK', '7500000'), of('SEK', '10000000')]);
    expect([plan('US', '999999.99')?.credit, plan('US', '1000000')?.credit, plan('US', '30000000')?.credit]).toEqual([of('USD', '0'), of('USD', '350000'), of('USD', '7000000')]);
    expect([plan('ZA', '1499999.99')?.credit, plan('ZA', '1500000')?.credit, plan('ZA', '100000000')?.credit, plan('NG', '1000000')?.credit]).toEqual([of('ZAR', '0'), of('ZAR', '525000'), of('ZAR', '25000000'), of('NGN', '0')]);
    // Not known: none carried, and none counted toward the money.
    for (const cc of ['BR', 'CA', 'IN', 'JP']) expect(plan(cc, '2000000')?.credit, cc).toBeNull();
    const br = project(planned('BR', '1000000'));
    expect([raised(br), target(br)]).toEqual([0, 82_000_000]);

    // The fund's award at the most its terms allow, held to what the cap on public aid leaves after the credit.
    expect([award('DE', '3000000'), award('DE', '6000000')]).toEqual([60_000_000, 100_000_000]);
    expect(() => award('DE', '6000000.01')).toThrow("project 1's budget isn't one Germany's fund backs");
    expect([award('ES', '1300000'), award('ES', '2000000'), award('ES', '20000000')]).toEqual([27_500_000, 45_000_000, 140_000_000]);
    expect(() => award('ES', '1299999.99')).toThrow("project 1's budget isn't one Spain's fund backs");
    expect([award('FR', '1000000'), award('FR', '2000000')]).toEqual([36_000_000, 52_000_000]);
    expect([award('IE', '1000000'), award('IE', '3000000'), award('IE', '7000000'), award('IE', '20000000')]).toEqual([70_000_000, 95_000_000, 120_000_000, 130_000_000]);
    expect(award('IE', '5000000')).toBe(90_000_000);
    expect(() => award('IE', '20000000.01')).toThrow("project 1's budget isn't one Ireland's fund backs");
    expect([award('IT', '2000000'), award('IT', '4000000')]).toEqual([40_000_000, 80_000_000]);
    expect(() => award('IT', '4000000.01')).toThrow("project 1's budget isn't one Italy's fund backs");
    expect([award('JP', '20000000'), award('JP', '49999999'), award('JP', '50000000'), award('JP', '100000000'), award('JP', '299999999'), award('JP', '300000000')]).toEqual([4e6, 4e6, 1e7, 2e7, 4e7, 6e7]);
    expect(() => award('JP', '19999999')).toThrow("project 1's budget isn't one Japan's fund backs");
    expect([award('KR', '2000000000'), award('KR', '5000000000'), award('KR', '10000000000')]).toEqual([8e8, 2e9, 2.5e9]);
    expect(() => award('KR', '1999999999')).toThrow("project 1's budget isn't one South Korea's fund backs");
    expect(() => award('KR', '10000000001')).toThrow("project 1's budget isn't one South Korea's fund backs");
    expect([award('NL', '2000000'), award('NL', '999999.99')]).toEqual([44_000_000, 0.42 * 99_999_999]);
    expect([award('NO', '10000000'), award('NO', '30000000')]).toEqual([500_000_000, 980_000_000]);
    expect([award('CA', '1000000'), award('CA', '1499999.99'), award('CA', '3000000'), award('CA', '3500000'), award('CA', '10000000')]).toEqual([49_000_000, 50_000_000, 0.3333 * 300_000_000, 171_500_000, 400_000_000]);
    for (const cc of ['AU', 'BR', 'DK', 'IN', 'MX', 'NG', 'NZ', 'SE', 'US', 'ZA']) expect(() => award(cc, '2000000'), cc).toThrow(/^what a public fund in .+ gives a producer's film isn't known to this game$/);
    expect(() => award('US', '2000000')).toThrow("what a public fund in United States gives a producer's film isn't known to this game");
    expect(fundFor(project(planned('NO', '10000000'))).rate).toBe(6 / 61);
    const greedy = edit(planned('DE', '3000000'), (s) => {
      const p = projectOf(s, 1);
      if (p.plan !== null) p.plan.credit = of('EUR', '1500000');
    });
    expect(() => fundFor(project(greedy))).toThrow("project 1's credit takes all the public aid it may have");
    expect(fundFor(project(edit(greedy, (s) => {
      const p = projectOf(s, 1);
      if (p.plan !== null) p.plan.credit = null;
    }))).award).toBe(100_000_000);
    expect(fundFor(project(edit(greedy, (s) => {
      const p = projectOf(s, 1);
      if (p.plan !== null) p.plan.credit = of('EUR', '1499999.99');
    }))).award).toBe(1);

    // Applying: a yes at the fund's rate as the package sells it, the award closed as the market's money.
    let l = made(90);
    for (let i = 0; i < 30; i += 1) l = planned('IE', '3000000', l);
    const yes: boolean[] = [];
    for (let id = 1; id <= 30; id += 1) {
      const p = project(l, id);
      const said = draws(seedFromText(SEED), 'producing.work', 'apply', id).float() < (19 / 26) * factor(l.slices.producing, componentValues(l.slices.attributes, 'producer'), p, T0);
      l = dispatch(l, applyToFunder, { project: id });
      expect(project(l, id).applied).toBe(true);
      expect(project(l, id).raised, String(id)).toEqual(said ? { fund: of('EUR', '950000') } : {});
      yes.push(said);
    }
    expect(yes).toContain(true);
    expect(yes).toContain(false);
    expect(() => dispatch(planned('AU', '1000000'), applyToFunder, { project: 1 })).toThrow("what a public fund in Australia gives a producer's film isn't known to this game");
    // The BFI's ten months left are its own: elsewhere the option need only run.
    const late = dispatch(pass(planned('IE', '3000000'), addMonths(zoneOf('IE'), T0, 17)).life, applyToFunder, { project: 1 });
    expect(project(late).applied).toBe(true);
    expect(() => dispatch(funded(planned('IE', '3000000')), applyToFunder, { project: 1 })).toThrow('project 1 is financed');

    // Raised, shot and released in the market's currency.
    const raisedIn = project(dispatch(planned('FR', '2000000', made(80)), raiseMoney, { project: 1, days: 400 })).raised;
    expect(Object.values(raisedIn).map((m) => m.currency)).toEqual(['EUR', 'EUR', 'EUR']);
    expect(raisedIn['broadcaster']).toEqual(of('EUR', '360000'));
    const shot = project(dispatch(funded(planned('IT', '2000000')), shootProject, { project: 1 })).shot;
    expect(shot?.overrun.currency).toBe('EUR');
    expect(shot?.fee?.currency).toBe('EUR');
    expect(project(dispatch(funded(planned('AU', '2000000')), shootProject, { project: 1 })).shot?.fee).toBeNull();
    let it_ = made(30);
    for (let i = 0; i < 12; i += 1) it_ = dispatch(funded(planned('IT', '2000000', it_)), shootProject, { project: i + 1 });
    const cinemas: boolean[] = [];
    for (let id = 1; id <= 12; id += 1) {
      const p = project(it_, id);
      const f = 0.5 + sellSkill(componentValues(it_.slices.attributes, 'producer'), p.shot?.quality ?? 0) / 100;
      const cinema = draws(seedFromText(SEED), 'producing.work', 'release', id).float() < 0.82 * f;
      it_ = dispatch(it_, releaseFilm, { project: id });
      expect(project(it_, id).release, String(id)).toEqual({ at: T0, cinema, doubled: null });
      cinemas.push(cinema);
    }
    expect(cinemas).toContain(true);
    expect(cinemas).toContain(false);
    expect(() => dispatch(dispatch(funded(planned('FR', '2000000')), shootProject, { project: 1 }), releaseFilm, { project: 1 })).toThrow("how often a film made in France reaches cinemas isn't known to this game");
  });

  it('reads a tier by its budgets, both counted, and gives its sum or its bands at most its most', () => {
    const tier = (over: Partial<Tier>): Tier => ({ budget: [0, null], bands: [{ from: 0, to: null, rate: 0.1 }], base: 1, net: false, most: null, sum: null, ...over });
    const tiers = [tier({ budget: [0, 99.99] }), tier({ budget: [100, 200] }), tier({ budget: [200.01, null] })];
    expect(tierFor(tiers, of('EUR', '99.99'))).toBe(tiers[0]);
    expect(tierFor(tiers, of('EUR', '100'))).toBe(tiers[1]);
    expect(tierFor(tiers, of('EUR', '200'))).toBe(tiers[1]);
    expect(tierFor(tiers, of('EUR', '200.01'))).toBe(tiers[2]);
    expect(tierFor(tiers.slice(0, 2), of('EUR', '200.01'))).toBeUndefined();
    expect(tierFor([tier({ budget: [0.07, null] })], of('EUR', '0.07'))).toBeDefined();
    expect(tierFor([tier({ budget: [0, 0.07] })], of('EUR', '0.07'))).toBeDefined();
    expect(amountOf(tier({ sum: 15 }), of('EUR', '1000'))).toBe(1500);
    expect(amountOf(tier({ sum: 15 }), money('JPY', 1000))).toBe(15);
    expect(amountOf(tier({ base: 0.8, most: 50 }), of('EUR', '1000'))).toBe(5000);
    expect(amountOf(tier({ base: 0.8 }), of('EUR', '1000'))).toBe(8000);
    expect(amountOf(tier({ net: true }), of('EUR', '1000'))).toBe(9000);
    expect(amountOf(tier({ bands: [] }), of('EUR', '1000'))).toBe(Infinity);
    expect(amountOf(tier({ bands: [], most: 7 }), of('EUR', '1000'))).toBe(700);
    const banded = tier({ bands: [{ from: 0, to: 10, rate: 0.5 }, { from: 10, to: 30, rate: 0.25 }, { from: 30, to: null, rate: 0.1 }] });
    expect([5, 10, 20, 30, 40].map((n) => amountOf(banded, of('EUR', String(n))))).toEqual([250, 500, 750, 1000, 1100]);
    expect(amountOf({ ...banded, bands: banded.bands.slice(0, 2) }, of('EUR', '40'))).toBe(1000);
    const m = MARKETS['DE'] as Market;
    expect(feeIn({ ...m, fees: [] }, of('EUR', '1'))).toBeNull();
    expect(feeIn({ ...m, fees: [[tier({ budget: [10, null] })]] }, of('EUR', '1'))).toBeNull();
    expect(feeIn({ ...m, fees: [[tier({ budget: [10, null] })], [tier({})]] }, of('EUR', '1'))).toEqual(of('EUR', '0.10'));
    expect(creditIn({ ...m, credit: null }, of('EUR', '1'))).toBeNull();
    expect(creditIn({ ...m, credit: [] }, of('EUR', '1'))).toEqual(of('EUR', '0'));
  });

  it("tells the player what of a market isn't known", () => {
    expect(UNKEPT_LINE).toBe('producing.unkept');
    expect(MISSING).toEqual({
      fund: 'what its public fund gives a film, or how often it says yes',
      incentive: 'the production incentive a film can claim',
      feecap: "the cap a funder sets on the producer's fee and overheads",
      outcomes: 'how often a film is released or earns back its cost',
      market: 'where most of the work is',
      union: "the producers' association and what it asks",
      language: 'the language the work is made in',
    });
    expect(aboutMarket('AU')).toBe("Some of what a producer can raise, claim or expect in Australia isn't known to this game yet: the language the work is made in.");
    expect(aboutMarket('BR')).toBe(t(UNKEPT_LINE, { country: 'Brazil', missing: 'what its public fund gives a film, or how often it says yes, the production incentive a film can claim and how often a film is released or earns back its cost' }));
    expect(aboutMarket('US')).toBe(t(UNKEPT_LINE, { country: 'United States', missing: "where most of the work is and the cap a funder sets on the producer's fee and overheads" }));
    for (const cc of ['FR', 'NL', 'GB', 'XX']) expect(aboutMarket(cc), cc).toBeUndefined();
    // Every market the register holds blockers for tells the player; none other does.
    expect(Object.keys(MARKETS).filter((cc) => aboutMarket(cc) !== undefined)).toEqual(['AU', 'BR', 'CA', 'DE', 'DK', 'ES', 'IE', 'IN', 'IT', 'JP', 'KR', 'MX', 'NG', 'NO', 'NZ', 'SE', 'US', 'ZA']);
  });

  it('gives the country and days of its shoot for a permit to work there', () => {
    const p = project(planned('NZ', '2000000'));
    expect(engagementOf(p)).toEqual({ country: 'NZ', days: p.plan?.scheduled });
    expect(() => engagementOf(project(optioned('NZ')))).toThrow('project 1 has no budget');
  });

  it("producing.option: the market a project is optioned in sets what it can claim", () => {
    falsifyAny({ feature: 'producing.option', claim: 'downstream', says: "the same £2m project optioned in Ireland rather than the UK is credited at Section 481's 32%, not the IFTC's 53% of 80%", base: 'GB', twin: 'IE', outcome: (market: string) => project(planned(market, '2000000')).plan?.credit });
  });
});

describe('a project shot abroad', () => {
  it('is shot only where the person may work: a permit in force, else refused', () => {
    const none = (l: Life<Producing>): Life<Producing> => ({ ...l, slices: { ...l.slices, permits: { applications: [] } } });
    expect(() => dispatch(none(funded(planned('IT', '2000000'))), shootProject, { project: 1 })).toThrow('the person may not work in IT without a permit');
    expect(project(dispatch(funded(planned('IT', '2000000')), shootProject, { project: 1 })).shot).not.toBeNull();
    // A British citizen shoots in the UK with none.
    const brit = (l: Life<Producing>): Life<Producing> => ({ ...none(l), slices: { ...none(l).slices, identity: identity({ citizenship: ['GB'] }) } });
    expect(project(dispatch(brit(funded(planned('GB', '2000000'))), shootProject, { project: 1 })).shot).not.toBeNull();
  });
});
