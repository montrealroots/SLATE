import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { begin, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { ATTRIBUTES_START, chooseAttributes, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import type { IdentitySlice, Person } from '../../../src/person/identity/identity.ts';
import {
  aboutCountry,
  aboutMarket,
  CAREER_START,
  countryOf,
  DEALS,
  FEES,
  KEPT,
  kindOf,
  languagesOf,
  MARKETS,
  marketOf,
  MEETING_DAYS,
  minimumOf,
  MISSING,
  offerScript,
  OPTION_YEARS,
  optionOf,
  paidOf,
  pitchScript,
  promoteScript,
  saleIn,
  soldIn,
  summariseScript,
  UNKEPT_LINE,
  WRITES_IN,
  type CareerSlice,
  type Fee,
  type Offer,
  type Work,
} from '../../../src/person/work/career.ts';
import { COUNTRY_CODES, countryName } from '../../../src/world/gazetteer/gazetteer.ts';
import { SCRIPTS_START, writeScript, type Form, type ScriptsSlice } from '../../../src/person/work/work.ts';
import type { GenresSlice } from '../../../src/person/genres/genres.ts';
import compiled from '../../../src/person/work/markets.json' with { type: 'json' };
import { falsifyAny } from '../../support/falsify-core.ts';
import { identity } from '../../support/person.ts';
import { ACCOUNT, minorIn, purse } from '../../support/purse.ts';
import { YOUTH_START, type YouthSlice } from '../../../src/person/youth/youth.ts';

type Career = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice; identity: IdentitySlice; genres: GenresSlice; youth: YouthSlice } & ReturnType<typeof purse>;
const SEED = '0123456789abcdef';
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
const NOW = day(2026, 11, 1);
const money = (c: CurrencyCode, n: string) => fromMajor(c, n);
const terms = (agreement: string, budget: number | null = null, minutes: number | null = null) => ({ agreement, budget, minutes });
const fee = (agreement: string, form: Form, date: string, budget: number | null = null, minutes: number | null = null, work: Work | null = null) => minimumOf(terms(agreement, budget, minutes), form, date, work).minimum;
const paid = (agreement: string, form: Form, date: string, budget: number | null = null, minutes: number | null = null) => paidOf(terms(agreement, budget, minutes), form, date);
/** Each country's writer research, as the compile reads it (its blockers' items). */
const SOURCES = resolve(import.meta.dirname, '../../../research/sources/person/markets');
const RESEARCH = Object.fromEntries(
  readdirSync(SOURCES)
    .filter((f) => f.startsWith('writer-'))
    .map((f) => [f.slice(7, -5), JSON.parse(readFileSync(join(SOURCES, f), 'utf8')) as { blockers: { item: string }[] }]),
);

/** Every minimum as the research gives it (read from each country's writer file, 2026-11-01): forms, tiers, unit, from, amount, its share of the budget and ceiling, what waits for photography. */
const EXPECTED: Record<string, string[]> = {
  'ca-ipa': [
    'feature budget0-82000 - 2023-05-22 negotiated',
    'feature budget82001- script 2023-05-22 62998',
    'feature budget82001- script 2024-05-22 66148',
    'feature budget82001- script 2025-03-15 68794',
    'feature budget82001- script 2026-02-01 71202',
    'pilot/episode minutes1-15 script 2026-02-01 5271',
    'pilot/episode minutes16-30 script 2026-02-01 10546',
    'pilot/episode minutes31-60 script 2026-02-01 21088',
    'pilot/episode minutes61-90 script 2026-02-01 31629',
  ],
  'ca-sartec': ['feature - script 2019-03-01 49063', 'feature - script 2021-11-28 50535'],
  'de-netflix': ['feature budget0-5000000 script 2026-01-01 80000', 'feature budget5000001-7500000 script 2026-01-01 95000', 'feature budget7500001-10000000 script 2026-01-01 110000'],
  'de-ard': ['pilot/episode minutes1-30 script 2025-09-01 20064', 'pilot/episode minutes31-45 script 2025-09-01 33410', 'pilot/episode minutes46-60 script 2025-09-01 44500'],
  'de-ard-early': ['pilot/episode minutes1-30 script 2025-09-01 17160', 'pilot/episode minutes31-45 script 2025-09-01 28512', 'pilot/episode minutes46-60 script 2025-09-01 38016'],
  'de-zdf': ['pilot/episode minutes1-45 script 2025-07-01 27580.8'],
  'de-rtl': [
    'pilot/episode minutes1-22 budget350000-574999 script 2026-02-15 16750 held 0.4',
    'pilot/episode minutes1-22 budget575000-899999 script 2026-02-15 17500 held 0.4',
    'pilot/episode minutes1-22 budget900000- script 2026-02-15 20000 held 0.4',
    'pilot/episode minutes23-45 budget600000-1149999 script 2026-02-15 33500 held 0.4',
    'pilot/episode minutes23-45 budget1150000-1899999 script 2026-02-15 35000 held 0.4',
    'pilot/episode minutes23-45 budget1900000- script 2026-02-15 40000 held 0.4',
  ],
  'de-p7s1': ['pilot/episode minutes1-45 script 2014-06-03 30500 held 0.5'],
  'dk-feature': ['feature - script 2026-01-01 598836'],
  'fr-film': ['feature - script 2026-01-15 17000'],
  'fr-tv': ['pilot/episode hourly0-599999 - 2023-07-01 negotiated', 'pilot/episode hourly600000- hour 2023-07-01 27550 share 0.03 cap 1200000'],
  'gb-pact-film': ['feature budget0-749999 script 1990-10-01 14000', 'feature budget750000-2000000 script 1990-10-01 14000', 'feature budget2000001- script 1990-10-01 23200 held £4800'],
  'gb-bbc': ['pilot/episode - minute 2025-12-15 220'],
  'gb-itv': ['pilot/episode - hour 2026-10-19 12882'],
  'gb-pact-tv': ['pilot/episode - hour 2016-10-01 10570'],
  'no-film': ['feature - script 2026-05-01 535106'],
  'no-nrk': ['pilot/episode - minute 2026-05-01 3022'],
  'se-svt': ['pilot/episode minutes1-19 minute 2025-01-01 2898', 'pilot/episode minutes20-29 minute 2025-01-01 4456', 'pilot/episode minutes30-60 minute 2025-01-01 4551', 'pilot/episode minutes61- minute 2025-01-01 3945'],
  'se-producers': ['pilot/episode minutes1-19 minute 2023-08-30 2674', 'pilot/episode minutes20-29 minute 2023-08-30 4113', 'pilot/episode minutes30-60 minute 2023-08-30 4200', 'pilot/episode minutes61- minute 2023-08-30 3642'],
  // Andorra's artists' statute: the minimum wage a day of 8 hours, from 1 July 2026, for each day the script was written.
  ad: ['feature/pilot/episode/short - day 2026-07-01 72.4'],
  // Azerbaijan's minimum author fees for films made to state order (new wording of 10 January 2025), an original screenplay.
  'az-state': [
    'feature fiction - script 2025-01-10 10000',
    'feature documentary - script 2025-01-10 4000',
    'feature animation - script 2025-01-10 4000',
    'pilot/episode/short fiction - script 2025-01-10 1200',
    'pilot/episode/short documentary - script 2025-01-10 1200',
    'pilot/episode/short animation - script 2025-01-10 1200',
  ],
  // Switzerland's ARF/FDS agreement with GARP, IG and SFP from 5 August 2025: a fiction feature's screenplay; no agreed minimum for a documentary.
  'ch-film': ['feature fiction - script 2025-08-05 75000', 'feature documentary - - 2025-08-05 negotiated'],
};

const ALL: Form[] = ['feature', 'pilot', 'episode', 'short'];
const TV: Form[] = ['pilot', 'episode'];
/** Each agreement's country, languages, currency, forms, and how it pays (none, unknown, or its minimums), and its option. */
const AGREEMENTS: Record<string, [string, string[], string | null, Form[], 'none' | 'unknown' | 'fees', unknown]> = {
  'au-awg': ['AU', ['en'], null, ALL, 'unknown', null],
  br: ['BR', ['pt'], null, ALL, 'none', 'negotiated'],
  'ca-ipa': ['CA', ['en'], 'CAD', ['feature', 'pilot', 'episode'], 'fees', [{ forms: ['feature'], share: '0.05', base: null }, { forms: TV, share: '0.1', base: null }]],
  'ca-sartec': ['CA', ['fr'], 'CAD', ['feature'], 'fees', 'negotiated'],
  'de-cinema': ['DE', ['de'], null, ['feature'], 'none', null],
  'de-netflix': ['DE', ['de'], 'EUR', ['feature'], 'fees', null],
  'de-ard': ['DE', ['de'], 'EUR', TV, 'fees', null],
  'de-ard-early': ['DE', ['de'], 'EUR', TV, 'fees', null],
  'de-zdf': ['DE', ['de'], 'EUR', TV, 'fees', null],
  'de-rtl': ['DE', ['de'], 'EUR', TV, 'fees', null],
  'de-p7s1': ['DE', ['de'], 'EUR', TV, 'fees', null],
  'dk-feature': ['DK', ['da'], 'DKK', ['feature'], 'fees', null],
  'dk-dr': ['DK', ['da'], null, TV, 'none', null],
  es: ['ES', ['es'], null, ALL, 'none', 'negotiated'],
  'fr-film': ['FR', ['fr'], 'EUR', ['feature'], 'fees', null],
  'fr-tv': ['FR', ['fr'], 'EUR', TV, 'fees', 'negotiated'],
  'gb-pact-film': ['GB', ['en'], 'GBP', ['feature'], 'fees', 'negotiated'],
  'gb-bbc': ['GB', ['en'], 'GBP', TV, 'fees', null],
  'gb-itv': ['GB', ['en'], 'GBP', TV, 'fees', null],
  'gb-pact-tv': ['GB', ['en'], 'GBP', TV, 'fees', null],
  ie: ['IE', ['en'], null, ALL, 'none', null],
  in: ['IN', ['hi'], null, ALL, 'none', null],
  it: ['IT', ['it'], null, ALL, 'none', 'negotiated'],
  jp: ['JP', ['ja'], null, ALL, 'unknown', null],
  kr: ['KR', ['ko'], null, ALL, 'none', 'negotiated'],
  mx: ['MX', ['es'], null, ALL, 'unknown', null],
  ng: ['NG', ['en'], null, ALL, 'none', null],
  nl: ['NL', ['nl'], null, ALL, 'none', null],
  'no-film': ['NO', ['no'], 'NOK', ['feature'], 'fees', [{ forms: ['feature'], share: '0.1', base: '529883' }]],
  'no-series': ['NO', ['no'], null, TV, 'none', null],
  'no-nrk': ['NO', ['no'], 'NOK', TV, 'fees', null],
  nz: ['NZ', ['en'], null, ALL, 'none', 'negotiated'],
  'se-svt': ['SE', ['sv'], 'SEK', TV, 'fees', null],
  'se-producers': ['SE', ['sv'], 'SEK', TV, 'fees', null],
  'se-film': ['SE', ['sv'], null, ['feature'], 'none', null],
  za: ['ZA', ['en'], null, ALL, 'none', null],
  // The world's markets beyond the twenty (2026-11-01): a wage floor by the day written, fees by kind, and pay left to negotiation.
  ad: ['AD', ['ca'], 'EUR', ALL, 'fees', null],
  ai: ['AI', ['en'], null, ALL, 'none', null],
  as: ['AS', ['sm', 'en'], null, ALL, 'none', null],
  at: ['AT', ['de'], null, ALL, 'none', null],
  ax: ['AX', ['sv'], null, ALL, 'none', null],
  'az-state': ['AZ', ['az'], 'AZN', ALL, 'fees', null],
  ba: ['BA', ['bs', 'hr', 'sr'], null, ALL, 'none', null],
  be: ['BE', ['nl', 'fr'], null, ALL, 'none', null],
  bn: ['BN', ['ms'], null, ALL, 'none', null],
  bw: ['BW', ['en', 'tn'], null, ALL, 'none', null],
  'ch-film': ['CH', ['de', 'fr', 'it'], 'CHF', ['feature'], 'fees', null],
  'ch-tv': ['CH', ['de', 'fr', 'it'], null, TV, 'none', null],
  cl: ['CL', ['es'], null, ALL, 'none', null],
  fi: ['FI', ['fi', 'sv'], null, ALL, 'none', null],
  gi: ['GI', ['en'], null, ALL, 'none', null],
  li: ['LI', ['de'], null, ALL, 'none', null],
  ms: ['MS', ['en'], null, ALL, 'none', null],
  nc: ['NC', ['fr'], null, ALL, 'none', null],
  pa: ['PA', ['es'], null, ALL, 'none', null],
  ph: ['PH', ['fil', 'en'], null, ALL, 'none', null],
  pn: ['PN', ['en'], null, ALL, 'none', null],
  sh: ['SH', ['en'], null, ALL, 'none', null],
  tz: ['TZ', ['sw', 'en'], null, ALL, 'none', null],
  ua: ['UA', ['uk'], null, ALL, 'none', null],
  va: ['VA', ['it'], null, ALL, 'none', null],
  vg: ['VG', ['en'], null, ALL, 'none', null],
};
/** The markets that follow another's terms (the research: a French overseas department, an Australian territory, Puerto Rico under the US system), and those with none to sell under. */
const FOLLOWS: Record<string, string> = { BL: 'FR', CC: 'AU', CX: 'AU', GF: 'FR', MF: 'FR', NF: 'AU', PM: 'FR', PR: 'US', YT: 'FR' };
const NO_AGREEMENT = ['AN', 'AQ', 'CS', 'GS', 'HM', 'IO', 'JE', 'TH', 'UM'];
/** Every other market's own agreement, its figures unknown, as its blockers say: whether any agreement, guild rate or law sets the terms, or the fees. */
const UNKNOWN_AGREEMENTS = Object.keys(RESEARCH).filter((cc) => !Object.values(AGREEMENTS).some(([c]) => c === cc) && !(cc in FOLLOWS) && !NO_AGREEMENT.includes(cc));

/** What the twenty's research couldn't find, and the world's where it compiles an agreement of its own that tells or a market with nothing to sell under. */
const UNKNOWN: Record<string, string[]> = {
  AU: ['fees', 'option', 'language'],
  BR: [],
  CA: [],
  DE: ['option'],
  DK: ['fees'],
  ES: ['fees'],
  FR: ['option'],
  GB: ['language'],
  IE: ['union', 'option'],
  IN: ['union', 'fees'],
  IT: [],
  JP: ['fees'],
  KR: ['union', 'fees'],
  MX: ['agreement'],
  NG: ['union', 'fees'],
  NL: ['fees'],
  NO: ['fees'],
  NZ: ['fees', 'option'],
  SE: ['fees'],
  ZA: ['fees'],
  AI: ['none'],
  BE: ['fees'],
  BN: ['terms'],
  GI: ['none'],
  GP: ['follows'],
  HK: ['union', 'none'],
  HU: ['union', 'none'],
  RE: ['follows'],
  MS: ['none'],
  SH: ['none'],
  TH: ['union'],
  VG: ['none'],
};

const tierText = (f: Fee) => {
  const tiers = Object.entries(f.when).map(([k, [lo, hi]]) => `${k}${lo}-${hi ?? ''}`);
  return tiers.length === 0 ? '-' : tiers.join(' ');
};
const line = (f: Fee) =>
  [f.forms.join('/'), ...(f.kind === null ? [] : [f.kind]), tierText(f), f.per ?? '-', f.from, f.amount ?? 'negotiated', ...(f.share === null ? [] : ['share', f.share]), ...(f.cap === null ? [] : ['cap', f.cap]), ...(f.held === null ? [] : ['held', 'share' in f.held ? f.held.share : `£${f.held.amount}`])].join(' ');

type Lives = Career;
const writer = (over: Partial<Person> = {}, at = NOW): Life<Lives> =>
  dispatch(
    dispatch(begin(SEED, at, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START), career: structuredClone(CAREER_START), identity: identity(over), genres: { loved: ['drama'] }, youth: structuredClone(YOUTH_START), ...purse() }), chooseAttributes, { role: 'screenwriter', all: 100, each: {} }),
    writeScript,
    { form: 'episode', genre: 'drama', days: 200 },
  );
const asked = (l: Life<Lives>, n = 1): Life<Lives> => ({ ...l, slices: { ...l.slices, career: { ...l.slices.career, out: { '1': { documents: { 'pitch-document': 100 }, requests: n, sold: null } } } } });
const at = (l: Life<Lives>, now: number): Life<Lives> => ({ ...l, frame: { ...l.frame, now } });
const offered = (l: Life<Lives>) => l.slices.career.offered['1'] as Offer;

describe('the markets', () => {
  it("are each country's own, every minimum as the research gives it", () => {
    const agreements = compiled.agreements as unknown as Record<string, { country: string; languages: string[]; currency: string | null; forms: Form[]; none: boolean; unknown: boolean; fees: Fee[]; option: unknown }>;
    const unknown = Object.fromEntries(UNKNOWN_AGREEMENTS.map((cc) => [cc.toLowerCase(), [cc, [], null, ALL, 'unknown', null] as const]));
    expect(UNKNOWN_AGREEMENTS).toHaveLength(188);
    expect(Object.keys(agreements).sort()).toEqual([...Object.keys(AGREEMENTS), ...Object.keys(unknown)].sort());
    for (const [id, [country, languages, currency, forms, pays, option]] of Object.entries({ ...AGREEMENTS, ...unknown })) {
      const a = agreements[id];
      expect([a?.country, a?.languages, a?.currency, a?.forms, a?.none ? 'none' : a?.unknown ? 'unknown' : 'fees', a?.option], id).toEqual([country, languages, currency, forms, pays, option]);
      expect(a?.fees.map(line), id).toEqual(EXPECTED[id] ?? []);
      expect(countryOf(id)).toBe(country);
      expect(languagesOf(id)).toEqual(languages);
      expect(marketOf(id)).toBe(a);
    }
    // An agreement whose figures are unknown stands where its country's research couldn't find whether one sets the terms, or its fees.
    for (const cc of UNKNOWN_AGREEMENTS) expect(RESEARCH[cc]?.blockers.some((b) => ['agreement', 'fees', 'terms', 'none', 'follows'].includes(b.item)), cc).toBe(true);
    // What each market's research couldn't find: its blockers' items, each once, in the research's order.
    for (const [cc, m] of Object.entries(MARKETS)) expect(m.unknown, cc).toEqual([...new Set(RESEARCH[cc]?.blockers.map((b) => b.item))]);
    for (const [cc, u] of Object.entries(UNKNOWN)) expect(MARKETS[cc]?.unknown, cc).toEqual(u);
    // Each market sells under its own agreements, or those of the market it follows; or under none.
    for (const [cc, m] of Object.entries(MARKETS)) {
      const followed = FOLLOWS[cc];
      if (followed === 'US') expect(m.agreements, cc).toEqual([KEPT]);
      else if (followed !== undefined) expect(m.agreements, cc).toEqual(MARKETS[followed]?.agreements);
      else if (NO_AGREEMENT.includes(cc)) expect(m.agreements, cc).toEqual([]);
      else expect(m.agreements.length > 0 && m.agreements.every((id) => countryOf(id) === cc), cc).toBe(true);
    }
  });

  it('cover every country on the map: the WGA the US, each other one its research', () => {
    expect(Object.keys(MARKETS)).toEqual(COUNTRY_CODES.filter((cc) => cc !== 'US').sort());
    expect(Object.keys(MARKETS)).toHaveLength(251);
    expect(Object.keys(RESEARCH).sort()).toEqual(Object.keys(MARKETS));
    for (const cc of COUNTRY_CODES) expect(cc === 'US' || soldIn(KEPT, cc) === (FOLLOWS[cc] === 'US'), cc).toBe(true);
  });

  it("read a script's kind from its genre's BFI group", () => {
    expect(['documentary', 'nature-documentary', 'rockumentary', 'concert-film'].map(kindOf)).toEqual(['documentary', 'documentary', 'documentary', 'documentary']);
    expect(['animated', 'anime', 'isekai'].map(kindOf)).toEqual(['animation', 'animation', 'animation']);
    expect(['drama', 'docudrama', 'mockumentary', 'comedy'].map(kindOf)).toEqual(['fiction', 'fiction', 'fiction', 'fiction']);
  });

  it("keeps the WGA's own, the US's, in English, and refuses an agreement there's none of", () => {
    expect(KEPT).toBe('wga');
    expect(marketOf('wga')).toBeNull();
    expect(countryOf('wga')).toBe('US');
    expect(languagesOf('wga')).toEqual(['en']);
    expect(() => marketOf('wgx')).toThrow("there's no agreement wgx");
    expect(() => marketOf('toString')).toThrow("there's no agreement toString");
    for (const form of ALL) expect(minimumOf(terms('wga'), form, '1900-01-01')).toEqual({ minimum: FEES[form], held: null });
    expect(paid('wga', 'feature', '2026-11-01')).toEqual(FEES.feature);
  });
});

describe('a script sold in a market', () => {
  it("is paid its agreement's minimum, by form and tier, on the day it sells", () => {
    // Canada's IPA: a feature by the date, negotiable at a budget of C$82,000 or less; a TV script by its minutes.
    expect(fee('ca-ipa', 'feature', '2026-02-01', 82_000)).toBeNull();
    expect(fee('ca-ipa', 'feature', '2026-02-01', 82_001)).toEqual(money('CAD', '71202'));
    expect(fee('ca-ipa', 'feature', '2026-01-31', 82_001)).toEqual(money('CAD', '68794'));
    expect(fee('ca-ipa', 'feature', '2025-03-15', 1_000_000)).toEqual(money('CAD', '68794'));
    expect(fee('ca-ipa', 'feature', '2025-03-14', 1_000_000)).toEqual(money('CAD', '66148'));
    expect(fee('ca-ipa', 'feature', '2024-05-22', 1_000_000)).toEqual(money('CAD', '66148'));
    expect(fee('ca-ipa', 'feature', '2023-05-22', 1_000_000)).toEqual(money('CAD', '62998'));
    expect(() => fee('ca-ipa', 'feature', '2023-05-21', 1_000_000)).toThrow('no minimum under ca-ipa is known before 2023-05-22');
    expect(() => fee('ca-ipa', 'feature', '2023-05-21', 10)).toThrow('no minimum under ca-ipa is known before 2023-05-22');
    expect(fee('ca-ipa', 'feature', '2023-05-22', 10)).toBeNull();
    const tv: [number, string][] = [[1, '5271'], [15, '5271'], [16, '10546'], [30, '10546'], [31, '21088'], [60, '21088'], [61, '31629'], [90, '31629']];
    for (const [minutes, amount] of tv) for (const form of TV) expect(fee('ca-ipa', form, '2026-11-01', null, minutes), `${form} ${minutes}`).toEqual(money('CAD', amount));
    expect(() => fee('ca-ipa', 'episode', '2026-11-01', null, 91)).toThrow('ca-ipa sets no minimum for that episode');
    expect(() => fee('ca-ipa', 'episode', '2026-01-31', null, 60)).toThrow('no minimum under ca-ipa is known before 2026-02-01');
    expect(fee('ca-sartec', 'feature', '2021-11-27')).toEqual(money('CAD', '49063'));
    expect(fee('ca-sartec', 'feature', '2021-11-28')).toEqual(money('CAD', '50535'));
    expect(fee('ca-sartec', 'feature', '2019-03-01')).toEqual(money('CAD', '49063'));
    expect(() => fee('ca-sartec', 'feature', '2019-02-28')).toThrow('no minimum under ca-sartec is known before 2019-03-01');
    // Germany: Netflix's films by the budget; ARD, ZDF, RTL and ProSiebenSat.1 by the minutes; RTL's by the budget too.
    const netflix: [number, string][] = [[1, '80000'], [5_000_000, '80000'], [5_000_001, '95000'], [7_500_000, '95000'], [7_500_001, '110000'], [10_000_000, '110000']];
    for (const [budget, amount] of netflix) expect(fee('de-netflix', 'feature', '2026-11-01', budget), String(budget)).toEqual(money('EUR', amount));
    expect(() => fee('de-netflix', 'feature', '2026-11-01', 10_000_001)).toThrow('de-netflix sets no minimum for that feature');
    expect(() => fee('de-netflix', 'feature', '2025-12-31', 1)).toThrow('no minimum under de-netflix is known before 2026-01-01');
    const ard: [number, string, string][] = [[1, '20064', '17160'], [30, '20064', '17160'], [31, '33410', '28512'], [45, '33410', '28512'], [46, '44500', '38016'], [60, '44500', '38016']];
    for (const [minutes, prime, early] of ard) {
      expect(fee('de-ard', 'episode', '2025-09-01', null, minutes)).toEqual(money('EUR', prime));
      expect(fee('de-ard-early', 'pilot', '2025-09-01', null, minutes)).toEqual(money('EUR', early));
    }
    expect(() => fee('de-ard', 'episode', '2025-09-01', null, 61)).toThrow('de-ard sets no minimum for that episode');
    expect(fee('de-zdf', 'episode', '2026-11-01', null, 45)).toEqual(money('EUR', '27580.80'));
    expect(() => fee('de-zdf', 'episode', '2026-11-01', null, 46)).toThrow('de-zdf sets no minimum for that episode');
    const rtl: [number, number, string][] = [[22, 350_000, '16750'], [22, 574_999, '16750'], [1, 575_000, '17500'], [22, 899_999, '17500'], [22, 900_000, '20000'], [23, 600_000, '33500'], [45, 1_149_999, '33500'], [45, 1_150_000, '35000'], [45, 1_899_999, '35000'], [45, 1_900_000, '40000']];
    for (const [minutes, budget, amount] of rtl) {
      expect(minimumOf(terms('de-rtl', budget, minutes), 'episode', '2026-02-15'), `${minutes} ${budget}`).toEqual({ minimum: money('EUR', amount), held: money('EUR', String(Number(amount) * 0.4)) });
      expect(paid('de-rtl', 'episode', '2026-02-15', budget, minutes)).toEqual(money('EUR', String(Number(amount) * 0.6)));
    }
    expect(() => fee('de-rtl', 'episode', '2026-11-01', 349_999, 22)).toThrow('de-rtl sets no minimum for that episode');
    expect(() => fee('de-rtl', 'episode', '2026-11-01', 599_999, 23)).toThrow('de-rtl sets no minimum for that episode');
    expect(() => fee('de-rtl', 'episode', '2026-11-01', 900_000, 46)).toThrow('de-rtl sets no minimum for that episode');
    expect(paid('de-p7s1', 'episode', '2014-06-03', null, 45)).toEqual(money('EUR', '15250'));
    // Denmark, France, Norway: a feature's own minimum.
    expect(fee('dk-feature', 'feature', '2026-01-01')).toEqual(money('DKK', '598836'));
    expect(() => fee('dk-feature', 'feature', '2025-12-31')).toThrow('no minimum under dk-feature is known before 2026-01-01');
    expect(fee('fr-film', 'feature', '2026-01-15')).toEqual(money('EUR', '17000'));
    expect(fee('no-film', 'feature', '2026-05-01')).toEqual(money('NOK', '535106'));
    // France's TV: 3% of the budget, at least €27,550 and at most €1.2 million an hour; left to negotiation under €600,000 an hour.
    expect(fee('fr-tv', 'episode', '2026-11-01', 599_999, 60)).toBeNull();
    expect(fee('fr-tv', 'episode', '2026-11-01', 600_000, 60)).toEqual(money('EUR', '27550'));
    expect(fee('fr-tv', 'episode', '2026-11-01', 1_000_000, 52)).toEqual(money('EUR', '30000'));
    expect(fee('fr-tv', 'episode', '2026-11-01', 520_000, 52)).toEqual(money('EUR', '23876.67'));
    expect(fee('fr-tv', 'episode', '2026-11-01', 519_999, 52)).toBeNull();
    expect(fee('fr-tv', 'pilot', '2026-11-01', 918_333, 60)).toEqual(money('EUR', '27550'));
    expect(fee('fr-tv', 'pilot', '2026-11-01', 918_334, 60)).toEqual(money('EUR', '27550.02'));
    expect(fee('fr-tv', 'pilot', '2026-11-01', 40_000_000, 60)).toEqual(money('EUR', '1200000'));
    expect(fee('fr-tv', 'pilot', '2026-11-01', 41_000_000, 60)).toEqual(money('EUR', '1200000'));
    expect(fee('fr-tv', 'pilot', '2026-11-01', 39_999_900, 60)).toEqual(money('EUR', '1199997'));
    expect(fee('fr-tv', 'pilot', '2026-11-01', 40_000_000, 30)).toEqual(money('EUR', '600000'));
    expect(() => fee('fr-tv', 'pilot', '2023-06-30', 40_000_000, 30)).toThrow('no minimum under fr-tv is known before 2023-07-01');
    // The UK: Pact's features by the budget, the photography stage held; the BBC by the minute, ITV and Pact's TV by the hour.
    expect(paid('gb-pact-film', 'feature', '2026-11-01', 749_999)).toEqual(money('GBP', '14000'));
    expect(paid('gb-pact-film', 'feature', '2026-11-01', 2_000_000)).toEqual(money('GBP', '14000'));
    expect(minimumOf(terms('gb-pact-film', 2_000_001), 'feature', '1990-10-01')).toEqual({ minimum: money('GBP', '23200'), held: money('GBP', '4800') });
    expect(paid('gb-pact-film', 'feature', '1990-10-01', 2_000_001)).toEqual(money('GBP', '18400'));
    expect(fee('gb-bbc', 'episode', '2025-12-15', null, 45)).toEqual(money('GBP', '9900'));
    expect(fee('gb-itv', 'episode', '2026-10-19', null, 45)).toEqual(money('GBP', '9661.50'));
    expect(fee('gb-itv', 'pilot', '2026-10-19', null, 60)).toEqual(money('GBP', '12882'));
    expect(() => fee('gb-itv', 'pilot', '2026-10-18', null, 60)).toThrow('no minimum under gb-itv is known before 2026-10-19');
    expect(fee('gb-pact-tv', 'episode', '2026-11-01', null, 7)).toEqual(money('GBP', '1233.17'));
    expect(fee('gb-pact-tv', 'episode', '2026-11-01', null, 30)).toEqual(money('GBP', '5285'));
    // Norway's NRK by the minute; Sweden's SVT and producers by the minute, at the rate of the script's length.
    expect(fee('no-nrk', 'episode', '2026-05-01', null, 60)).toEqual(money('NOK', '181320'));
    const svt: [number, string, string][] = [[1, '2898', '2674'], [19, '2898', '2674'], [20, '4456', '4113'], [29, '4456', '4113'], [30, '4551', '4200'], [60, '4551', '4200'], [61, '3945', '3642'], [200, '3945', '3642']];
    for (const [minutes, svtRate, producers] of svt) {
      expect(fee('se-svt', 'episode', '2026-11-01', null, minutes)).toEqual(money('SEK', String(Number(svtRate) * minutes)));
      expect(fee('se-producers', 'pilot', '2026-11-01', null, minutes)).toEqual(money('SEK', String(Number(producers) * minutes)));
    }
    // Where no agreement sets the pay, it is left to negotiation.
    for (const id of ['br', 'de-cinema', 'dk-dr', 'es', 'ie', 'in', 'it', 'kr', 'ng', 'nl', 'no-series', 'nz', 'se-film', 'za']) {
      for (const form of AGREEMENTS[id]?.[3] ?? []) expect(minimumOf(terms(id), form, '1900-01-01'), id).toEqual({ minimum: null, held: null });
    }
  });

  it("refuses what a market doesn't set: a form, a production's tier unsaid, a market whose figures aren't known", () => {
    expect(() => fee('de-ard', 'feature', '2026-11-01')).toThrow('de-ard sets no terms for a feature');
    expect(() => fee('ca-ipa', 'short', '2026-11-01')).toThrow('ca-ipa sets no terms for a short');
    expect(() => fee('de-cinema', 'episode', '2026-11-01')).toThrow('de-cinema sets no terms for a episode');
    expect(() => fee('ca-ipa', 'feature', '2026-11-01')).toThrow("a feature under ca-ipa names its production's budget");
    expect(() => fee('fr-tv', 'episode', '2026-11-01', null, 60)).toThrow("a episode under fr-tv names its production's budget");
    expect(() => fee('fr-tv', 'episode', '2026-11-01', 1_000_000)).toThrow('a episode under fr-tv names its running time');
    expect(() => fee('ca-ipa', 'episode', '2026-11-01', 1_000_000)).toThrow('a episode under ca-ipa names its running time');
    expect(() => fee('gb-bbc', 'episode', '2026-11-01')).toThrow('a episode under gb-bbc names its running time');
    expect(() => fee('gb-itv', 'episode', '2026-11-01')).toThrow('a episode under gb-itv names its running time');
    expect(() => fee('de-rtl', 'episode', '2026-11-01', null, 45)).toThrow("a episode under de-rtl names its production's budget");
    expect(fee('ca-ipa', 'episode', '2026-11-01', null, 30)).toEqual(money('CAD', '10546'));
    expect(fee('dk-feature', 'feature', '2026-11-01', null, null)).toEqual(money('DKK', '598836'));
    expect(() => fee('au-awg', 'feature', '2026-11-01')).toThrow(aboutMarket('au-awg') as string);
    expect(() => fee('jp', 'episode', '2026-11-01')).toThrow(aboutMarket('jp') as string);
    expect(() => fee('mx', 'short', '2026-11-01')).toThrow(t(UNKEPT_LINE, { country: 'Mexico', missing: MISSING.agreement }));
  });

  it("prices an option for a year at its agreement's share, negotiated where nothing sets it, refused where nothing is known", () => {
    expect(OPTION_YEARS).toBe(1);
    expect(DEALS).toEqual(['sale', 'option']);
    expect(optionOf(terms('ca-ipa', 1_000_000), 'feature', '2026-11-01')).toEqual(money('CAD', '3560.10'));
    expect(optionOf(terms('ca-ipa', null, 60), 'episode', '2026-11-01')).toEqual(money('CAD', '2108.80'));
    expect(optionOf(terms('ca-ipa', null, 30), 'pilot', '2026-11-01')).toEqual(money('CAD', '1054.60'));
    expect(optionOf(terms('ca-ipa', 82_000), 'feature', '2026-11-01')).toBeNull();
    expect(optionOf(terms('no-film'), 'feature', '2026-11-01')).toEqual(money('NOK', '52988.30'));
    expect(() => optionOf(terms('no-film'), 'feature', '2026-04-30')).toThrow('no minimum under no-film is known before 2026-05-01');
    for (const id of ['br', 'ca-sartec', 'es', 'fr-tv', 'gb-pact-film', 'it', 'kr', 'nz']) expect(optionOf(terms(id, 1_000_000, 60), (AGREEMENTS[id]?.[3] as Form[])[0] as Form, '2026-11-01'), id).toBeNull();
    expect(() => optionOf(terms('de-netflix', 1), 'feature', '2026-11-01')).toThrow(t(UNKEPT_LINE, { country: 'Germany', missing: MISSING.option }));
    expect(() => optionOf(terms('ie'), 'feature', '2026-11-01')).toThrow(aboutMarket('ie') as string);
    expect(() => optionOf(terms('dk-feature'), 'feature', '2026-11-01')).toThrow('dk-feature sets no option');
    expect(() => optionOf(terms('gb-bbc', null, 60), 'episode', '2026-11-01')).toThrow('gb-bbc sets no option');
    expect(() => optionOf(terms('wga'), 'feature', '2026-11-01')).toThrow("the WGA's option terms aren't kept by the game");
    expect(() => optionOf(terms('de-ard'), 'feature', '2026-11-01')).toThrow('de-ard sets no terms for a feature');
    expect(() => optionOf(terms('au-awg'), 'feature', '2026-11-01')).toThrow(aboutMarket('au-awg') as string);
  });

  it("tells the player what of a market isn't known", () => {
    expect(UNKEPT_LINE).toBe('writing.unkept');
    expect(MISSING).toEqual({
      agreement: 'whether any agreement sets what a script is paid',
      fees: 'some of the minimums a script is paid',
      option: 'the terms of an option on a script',
      language: 'the language scripts are written in',
      union: "the guild's fees or whom it takes",
      terms: "whether any agreement, guild rate or law sets a script's terms",
      none: 'whether any fund, guild or agreement serves a writer there',
      follows: 'whether the agreements of the country whose law it follows reach a script sold there',
    });
    expect(aboutMarket('au-awg')).toBe("Some of what a screenwriter is paid or asked in Australia isn't known to this game yet: some of the minimums a script is paid, the terms of an option on a script and the language scripts are written in.");
    expect(aboutMarket('ie')).toBe("Some of what a screenwriter is paid or asked in Ireland isn't known to this game yet: the guild's fees or whom it takes and the terms of an option on a script.");
    expect(aboutMarket('de-zdf')).toBe("Some of what a screenwriter is paid or asked in Germany isn't known to this game yet: the terms of an option on a script.");
    expect(aboutMarket('ca-ipa')).toBeUndefined();
    expect(aboutMarket('it')).toBeUndefined();
    expect(aboutMarket('wga')).toBeUndefined();
    for (const m of Object.values(MARKETS)) for (const id of m.agreements) expect(aboutMarket(id) === undefined, id).toBe(id === KEPT || (MARKETS[countryOf(id)] as typeof m).unknown.length === 0);
    // The world's: a country whose research couldn't find whether anything sets the terms, or whether any fund, guild or agreement serves a writer; one with nothing to sell under told by its country.
    expect(aboutMarket('bn')).toBe(t(UNKEPT_LINE, { country: 'Brunei', missing: MISSING.terms }));
    expect(aboutMarket('ai')).toBe(t(UNKEPT_LINE, { country: 'Anguilla', missing: MISSING.none }));
    expect(aboutMarket('cd')).toBe(t(UNKEPT_LINE, { country: countryName('CD'), missing: `${MISSING.fees} and ${MISSING.none}` }));
    expect(aboutMarket('bg')).toBe(t(UNKEPT_LINE, { country: 'Bulgaria', missing: MISSING.fees }));
    expect(aboutCountry('TH')).toBe(t(UNKEPT_LINE, { country: 'Thailand', missing: MISSING.union }));
    expect(aboutCountry('BE')).toBe(aboutMarket('be'));
    expect(aboutMarket('re')).toBe(t(UNKEPT_LINE, { country: countryName('RE'), missing: MISSING.follows }));
    for (const cc of ['US', 'AZ', 'BL', 'JE', 'XX', 'toString']) expect(aboutCountry(cc), cc).toBeUndefined();
    for (const cc of Object.keys(MARKETS)) expect(aboutCountry(cc) === undefined, cc).toBe((RESEARCH[cc]?.blockers.length ?? 0) === 0);
  });

  it('is paid where a wage floor reaches the writer by the days written, and by the kind of script where an agreement sets it by kind', () => {
    // Andorra: the minimum wage a day for each day given to the script, from 1 July 2026; none known before.
    const days = (n: number): Work => ({ genre: 'drama', days: n });
    expect(fee('ad', 'feature', '2026-07-01', null, null, days(1))).toEqual(money('EUR', '72.40'));
    expect(fee('ad', 'short', '2026-11-01', null, null, days(56))).toEqual(money('EUR', '4054.40'));
    expect(paidOf(terms('ad'), 'episode', '2026-11-01', days(9))).toEqual(money('EUR', '651.60'));
    expect(() => fee('ad', 'feature', '2026-06-30', null, null, days(1))).toThrow('no minimum under ad is known before 2026-07-01');
    expect(() => fee('ad', 'pilot', '2026-11-01')).toThrow('a pilot under ad is paid by the days it was written');
    expect(() => optionOf(terms('ad'), 'feature', '2026-11-01', days(1))).toThrow('ad sets no option');
    // Azerbaijan's films made to state order: an original screenplay by its kind, from 10 January 2025.
    const of = (genre: string): Work => ({ genre, days: 1 });
    expect(fee('az-state', 'feature', '2025-01-10', null, null, of('drama'))).toEqual(money('AZN', '10000'));
    expect(fee('az-state', 'feature', '2026-11-01', null, null, of('nature-documentary'))).toEqual(money('AZN', '4000'));
    expect(fee('az-state', 'feature', '2026-11-01', null, null, of('anime'))).toEqual(money('AZN', '4000'));
    for (const form of ['pilot', 'episode', 'short'] as const) for (const genre of ['comedy', 'documentary', 'animated']) expect(fee('az-state', form, '2026-11-01', null, null, of(genre)), `${form} ${genre}`).toEqual(money('AZN', '1200'));
    expect(() => fee('az-state', 'feature', '2025-01-09', null, null, of('drama'))).toThrow('no minimum under az-state is known before 2025-01-10');
    expect(() => fee('az-state', 'feature', '2026-11-01')).toThrow('a feature under az-state names its genre');
    // Switzerland: a fiction feature's screenplay at CHF 75,000 from 5 August 2025, a documentary's left to negotiation, an animation's not set; TV left to negotiation.
    expect(fee('ch-film', 'feature', '2025-08-05', null, null, of('thriller'))).toEqual(money('CHF', '75000'));
    expect(fee('ch-film', 'feature', '2026-11-01', null, null, of('documentary'))).toBeNull();
    expect(() => fee('ch-film', 'feature', '2026-11-01', null, null, of('animated'))).toThrow('ch-film sets no minimum for that feature');
    expect(() => fee('ch-film', 'feature', '2025-08-04', null, null, of('thriller'))).toThrow('no minimum under ch-film is known before 2025-08-05');
    expect(() => fee('ch-film', 'episode', '2026-11-01')).toThrow('ch-film sets no terms for a episode');
    expect(fee('ch-tv', 'episode', '2026-11-01')).toBeNull();
    // Where the research says no agreement sets the pay, it is left to negotiation.
    for (const [id, [, , , forms, pays]] of Object.entries(AGREEMENTS)) if (pays === 'none') for (const form of forms) expect(minimumOf(terms(id), form, '1900-01-01'), id).toEqual({ minimum: null, held: null });
    // And where the research couldn't find it, refused and told.
    for (const cc of UNKNOWN_AGREEMENTS) expect(() => fee(cc.toLowerCase(), 'feature', '2026-11-01'), cc).toThrow(aboutCountry(cc) as string);
  });

  it("is sold in a market that follows another's terms under that market's agreements, there; refused in one with none to sell under", () => {
    expect(['fr-film', 'fr-tv'].every((id) => soldIn(id, 'BL') && soldIn(id, 'FR'))).toBe(true);
    expect([soldIn('fr-film', 'RE'), soldIn('fr-film', 'DE'), soldIn('wga', 'PR'), soldIn('wga', 'US'), soldIn('au-awg', 'CX'), soldIn('wga', 'toString')]).toEqual([false, false, true, true, true, false]);
    const french = writer({ languages: [{ lang: 'en', level: 'C2' }, { lang: 'fr', level: 'C1' }] });
    const barts = dispatch(french, offerScript, { script: 1, agreement: 'fr-tv', country: 'BL', budget: 1_000_000, minutes: 52 });
    expect(offered(barts)).toEqual({ agreement: 'fr-tv', country: 'BL', budget: 1_000_000, minutes: 52, options: [] });
    expect(saleIn(barts.slices.career, 1)).toEqual({ country: 'BL', days: 1 });
    expect(offered(dispatch(french, offerScript, { script: 1, agreement: 'fr-tv', country: 'FR', budget: 1_000_000, minutes: 52 }))).toEqual({ agreement: 'fr-tv', budget: 1_000_000, minutes: 52, options: [] });
    expect(saleIn(dispatch(writer(), offerScript, { script: 1, agreement: 'wga', country: 'PR' }).slices.career, 1)).toEqual({ country: 'PR', days: 1 });
    expect(() => dispatch(french, offerScript, { script: 1, agreement: 'fr-tv', country: 'JE', budget: 1_000_000, minutes: 52 })).toThrow("a script isn't sold under fr-tv in JE");
    // Where the research couldn't show France's agreements reach it, told.
    expect(() => dispatch(french, offerScript, { script: 1, agreement: 'fr-tv', country: 'RE', budget: 1_000_000, minutes: 52 })).toThrow(aboutCountry('RE') as string);
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'wga', country: 'TH' })).toThrow(aboutCountry('TH') as string);
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'au-awg', country: 'CX' })).toThrow(aboutMarket('au-awg') as string);
    // In one of its languages: a Swiss film in German, French or Italian.
    const swiss = (lang: string) => writer({ languages: [{ lang, level: 'C1' }] });
    expect(dispatch(dispatch(swiss('fr'), writeScript, { form: 'feature', genre: 'drama', days: 30 }), offerScript, { script: 2, agreement: 'ch-film' }).slices.career.offered['2']?.agreement).toBe('ch-film');
    const film = dispatch(swiss('it'), writeScript, { form: 'feature', genre: 'drama', days: 30 });
    expect(film.slices.career.offered['2']).toBeUndefined();
    expect(dispatch(film, offerScript, { script: 2, agreement: 'ch-film' }).slices.career.offered['2']).toEqual({ agreement: 'ch-film', budget: null, minutes: null, options: [] });
    expect(() => dispatch(dispatch(swiss('en'), writeScript, { form: 'feature', genre: 'drama', days: 30 }), offerScript, { script: 2, agreement: 'ch-film' })).toThrow("a script under ch-film is written in de or fr or it, which the writer doesn't write well enough");
  });

  it('is paid and taxed where it is sold: a wage floor by the days written, a followed market in its own country', () => {
    const sell = (l: Life<Lives>) => {
      let x = asked(l, 9);
      while (x.slices.career.out['1']?.sold === null && (x.slices.career.out['1']?.requests as number) > 0) x = dispatch(x, pitchScript, { script: 1, account: ACCOUNT });
      return x;
    };
    const andorra = sell(dispatch(writer({ languages: [{ lang: 'ca', level: 'C1' }] }), offerScript, { script: 1, agreement: 'ad' }));
    expect(andorra.slices.career.out['1']?.sold).toEqual({ at: NOW, fee: money('EUR', '14480') });
    expect(andorra.slices.tax.paid.map((p) => p.country)).toEqual(['AD']);
    const barts = sell(dispatch(writer({ languages: [{ lang: 'fr', level: 'C1' }] }), offerScript, { script: 1, agreement: 'fr-tv', country: 'BL', budget: 1_000_000, minutes: 52 }));
    expect(barts.slices.career.out['1']?.sold).toEqual({ at: NOW, fee: money('EUR', '30000') });
    expect(barts.slices.tax.paid.map((p) => p.country)).toEqual(['BL']);
  });

  it("script.offer: a script offered under France's TV terms in Saint-Barthélemy is sold there, where the same offer in France is sold in France", () => {
    const french = writer({ languages: [{ lang: 'en', level: 'C2' }, { lang: 'fr', level: 'C1' }] });
    const where = (country: string | null) => saleIn(dispatch(french, offerScript, country === null ? { script: 1, agreement: 'fr-tv', budget: 1_000_000, minutes: 52 } : { script: 1, agreement: 'fr-tv', country, budget: 1_000_000, minutes: 52 }).slices.career, 1);
    falsifyAny({ feature: 'script.offer', claim: 'bites', says: "a script offered in Saint-Barthélemy under France's TV agreement is sold there, not in France", base: null, twin: 'BL', outcome: where });
  });

  it("is offered in a market under its agreement, in its language, refused where the writer doesn't write it or the market doesn't price it", () => {
    expect(WRITES_IN).toBe('C1');
    const german = (level: 'B2' | 'C1' | 'C2') => writer({ languages: [{ lang: 'en', level: 'C2' }, { lang: 'de', level }] });
    const l = dispatch(german('C1'), offerScript, { script: 1, agreement: 'de-ard', minutes: 45 });
    expect(offered(l)).toEqual({ agreement: 'de-ard', budget: null, minutes: 45, options: [] });
    expect(offered(dispatch(german('C2'), offerScript, { script: 1, agreement: 'de-rtl', budget: 1_000_000, minutes: 45 }))).toEqual({ agreement: 'de-rtl', budget: 1_000_000, minutes: 45, options: [] });
    expect(() => dispatch(german('B2'), offerScript, { script: 1, agreement: 'de-ard', minutes: 45 })).toThrow("a script under de-ard is written in de, which the writer doesn't write well enough");
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'br' })).toThrow("a script under br is written in pt, which the writer doesn't write well enough");
    expect(offered(dispatch(writer(), offerScript, { script: 1, agreement: 'wga' }))).toEqual({ agreement: 'wga', budget: null, minutes: null, options: [] });
    expect(offered(dispatch(writer(), offerScript, { script: 1, agreement: 'gb-bbc', minutes: 1 }))).toEqual({ agreement: 'gb-bbc', budget: null, minutes: 1, options: [] });
    expect(offered(dispatch(writer(), offerScript, { script: 1, agreement: 'nz', budget: 1 })).budget).toBe(1);
    expect(() => dispatch(writer(), offerScript, { script: 2, agreement: 'wga' })).toThrow("there's no script 2");
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'nz', budget: 0 })).toThrow('a budget is a whole number of at least 1 (0)');
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'nz', budget: 1.5 })).toThrow(RangeError);
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'gb-bbc', minutes: 0 })).toThrow('a running time is a whole number of at least 1 (0)');
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'gb-bbc' })).toThrow('a episode under gb-bbc names its running time');
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'gb-pact-film', budget: 5 })).toThrow('gb-pact-film sets no terms for a episode');
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'au-awg' })).toThrow(aboutMarket('au-awg') as string);
    expect(() => dispatch(writer({}, day(2026, 10, 18)), offerScript, { script: 1, agreement: 'gb-itv', minutes: 60 })).toThrow('no minimum under gb-itv is known before 2026-10-19');
    expect(() => dispatch(writer(), offerScript, { script: 1, agreement: 'xx' })).toThrow("there's no agreement xx");
  });

  it("is paid on a sale as its market pays, or optioned for a year at its price, the script back on the market when the option lapses", () => {
    /** Pitches until a deal is made or the requests run out. */
    const pitched = (l: Life<Lives>, deal?: 'sale' | 'option'): Life<Lives> => {
      let x = l;
      const before = l.slices.career.offered['1']?.options.length ?? 0;
      while ((x.slices.career.out['1']?.requests ?? 0) > 0 && x.slices.career.out['1']?.sold === null && (x.slices.career.offered['1']?.options.length ?? 0) === before) x = dispatch(x, pitchScript, deal === undefined ? { script: 1, account: ACCOUNT } : { script: 1, deal, account: ACCOUNT });
      return x;
    };
    const sold = (l: Life<Lives>) => l.slices.career.out['1']?.sold;
    expect(sold(pitched(asked(writer(), 9)))).toEqual({ at: NOW, fee: FEES.episode });
    // The buyer pays the sale into the account named: a US writer's fee at home, nothing withheld at source.
    const wga = pitched(asked(writer(), 9));
    expect([minorIn(wga.slices.ledger, ACCOUNT), minorIn(wga.slices.ledger, 'world:buyer:USD')]).toEqual([100_000_000 + (FEES.episode as Money).minor, -(FEES.episode as Money).minor]);
    expect(wga.slices.tax.paid.map((p) => [p.what, p.work, p.country])).toEqual([['sale', 'author', 'US']]);
    expect(sold(pitched(asked(dispatch(writer(), offerScript, { script: 1, agreement: 'gb-bbc', minutes: 45 }), 9)))).toEqual({ at: NOW, fee: money('GBP', '9900') });
    const german = writer({ languages: [{ lang: 'de', level: 'C1' }] });
    expect(sold(pitched(asked(dispatch(german, offerScript, { script: 1, agreement: 'de-rtl', budget: 700_000, minutes: 20 }), 9)))).toEqual({ at: NOW, fee: money('EUR', '10500') });
    expect(sold(pitched(asked(dispatch(writer(), offerScript, { script: 1, agreement: 'nz' }), 9)))).toEqual({ at: NOW, fee: null });
    // An option for a year at a tenth of the minimum for a Canadian hour; the script off the market until it lapses.
    const canada = asked(dispatch(writer(), offerScript, { script: 1, agreement: 'ca-ipa', minutes: 60 }), 9);
    const optioned = pitched(canada, 'option');
    expect(offered(optioned).options).toEqual([{ at: NOW, until: '2027-11-01', fee: money('CAD', '2108.80') }]);
    expect(sold(optioned)).toBeNull();
    expect(optioned.slices.career.contacts).toBe(1);
    expect(optioned.slices.career.out['1']?.requests).toBeLessThan(9);
    const later = (y: number, m: number, d: number) => at(optioned, day(y, m, d));
    for (const [what, args] of [[pitchScript, { script: 1, account: ACCOUNT }], [promoteScript, { script: 1, days: 1 }], [offerScript, { script: 1, agreement: 'wga' }], [summariseScript, { script: 1, document: 'logline', days: 1 }]] as const) {
      expect(() => dispatch(later(2027, 10, 31), what as never, args as never)).toThrow('script 1 is under option until 2027-11-01');
    }
    const back = dispatch(later(2027, 11, 1), offerScript, { script: 1, agreement: 'ca-ipa', minutes: 30 });
    expect(offered(back)).toEqual({ agreement: 'ca-ipa', budget: null, minutes: 30, options: [{ at: NOW, until: '2027-11-01', fee: money('CAD', '2108.80') }] });
    const again = pitched(back, 'option');
    expect(offered(again).options).toHaveLength(2);
    expect(offered(again).options[1]).toMatchObject({ until: '2028-11-01', fee: money('CAD', '1054.60') });
    expect(dispatch(later(2027, 11, 1), promoteScript, { script: 1, days: 1 }).slices.career.out['1']?.requests).toBeGreaterThanOrEqual(optioned.slices.career.out['1']?.requests as number);
    // Refused before a request is spent.
    expect(() => dispatch(asked(writer()), pitchScript, { script: 1, deal: 'option', account: ACCOUNT })).toThrow("the WGA's option terms aren't kept by the game");
    expect(() => dispatch(asked(writer()), pitchScript, { script: 1, deal: 'loan' as 'sale', account: ACCOUNT })).toThrow("there's no deal loan");
    expect(() => dispatch(writer(), pitchScript, { script: 1, deal: 'option', account: ACCOUNT })).toThrow('no one has asked to read script 1');
    const danish = asked(dispatch(writer({ languages: [{ lang: 'da', level: 'C2' }] }), writeScript, { form: 'feature', genre: 'drama', days: 200 }));
    expect(() => dispatch(asked(dispatch(danish, offerScript, { script: 1, agreement: 'dk-dr' })), pitchScript, { script: 1, deal: 'option', account: ACCOUNT })).toThrow('dk-dr sets no option');
  });

  it('is sold where its market is, the meeting a day there', () => {
    expect(MEETING_DAYS).toBe(1);
    expect(saleIn(CAREER_START, 1)).toEqual({ country: 'US', days: 1 });
    expect(saleIn(dispatch(writer(), offerScript, { script: 1, agreement: 'gb-bbc', minutes: 30 }).slices.career, 1)).toEqual({ country: 'GB', days: 1 });
  });

  it("script.offer: a script offered under the BBC's terms sells for pounds a minute, where the WGA's pays its dollars", () => {
    const sale = (agreement: string | null) => {
      let l = asked(agreement === null ? writer() : dispatch(writer(), offerScript, { script: 1, agreement, minutes: 45 }), 9);
      while (l.slices.career.out['1']?.sold === null && (l.slices.career.out['1']?.requests as number) > 0) l = dispatch(l, pitchScript, { script: 1, account: ACCOUNT });
      return l.slices.career.out['1']?.sold;
    };
    falsifyAny({ feature: 'script.offer', claim: 'bites', says: 'an episode offered under the BBC agreement sells at its minimum a minute, not the WGA minimum', base: null, twin: 'gb-bbc', outcome: sale });
  });
});

describe("a sale meeting abroad", () => {
  it("is a visit, not work there: open where the person's passport visits the market's country without a visa applied for beforehand", () => {
    // The WGA's market, the US: a British writer enters on the electronic travel authorisation; an Indian passport needs a visa first.
    expect(dispatch(asked(writer({ citizenship: ['GB'] })), pitchScript, { script: 1, account: ACCOUNT }).slices.career.out['1']?.requests).toBe(0);
    expect(() => dispatch(asked(writer({ citizenship: ['IN'] })), pitchScript, { script: 1, account: ACCOUNT })).toThrow("a visit to US takes a visa applied for beforehand, which the game doesn't hold");
    expect(dispatch(asked(writer({ citizenship: ['IN', 'GB'] })), pitchScript, { script: 1, account: ACCOUNT }).slices.career.out['1']?.requests).toBe(0);
  });
});
