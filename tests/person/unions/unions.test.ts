import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { fromMajor, type Money } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { exchangeOn } from '../../../src/money/rates/rates.ts';
import { ACTING_START, type ActingSlice, type Agreement, type Audition, type Part } from '../../../src/person/acting/acting.ts';
import { DIRECTING_START, type DirectingSlice, type Film, type Form as FilmForm } from '../../../src/person/directing/directing.ts';
import type { IdentitySlice, Person } from '../../../src/person/identity/identity.ts';
import { CAREER_START, type CareerSlice } from '../../../src/person/work/career.ts';
import { SCRIPTS_START, type Form, type Script, type ScriptsSlice } from '../../../src/person/work/work.ts';
import {
  ACTRA_APPRENTICE,
  ACTRA_FULL,
  AEA,
  CAEA,
  DGA,
  EQUITY_BANDS,
  EQUITY_UK,
  joinUnion,
  mayTakeUnionWork,
  mayWorkIn,
  memberOf,
  SAG_AFTRA,
  TAFT_HARTLEY_DAYS,
  terms,
  UNIONS_START,
  UNITS,
  WGA,
  type Membership,
  type Union,
  type UnionsSlice,
} from '../../../src/person/unions/unions.ts';
import { falsifyAny } from '../../support/falsify-core.ts';
import { identity, person } from '../../support/person.ts';
import { ACCOUNT, minorIn, purse } from '../../support/purse.ts';

type Lives = { identity: IdentitySlice; acting: ActingSlice; career: CareerSlice; scripts: ScriptsSlice; directing: DirectingSlice; unions: UnionsSlice } & ReturnType<typeof purse>;

const SEED = '0123456789abcdef';
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * SECONDS_PER_DAY;
const NOW = day(2026, 11, 1);
const usd = (n: string) => fromMajor('USD', n);
const cad = (n: string) => fromMajor('CAD', n);
const gbp = (n: string) => fromMajor('GBP', n);

const part = (agreement: Agreement, budget = 5_000_000): Part => ({ agreement, budget, seats: 0, lines: 10, term: agreement === 'uk-theatre' ? 'week' : 'day', length: 1, rehearsal: 0, asks: [] });
/** A part played at a moment, paid as given. */
const played = (agreement: Agreement, at: number, budget = 5_000_000, pay: Money | null = usd('1')): Audition => ({ id: 0, at, breakdown: 0, part: part(agreement, budget), taped: true, score: 50, booked: true, work: { at, quality: 50, pay } });
const unplayed = (agreement: Agreement): Audition => ({ ...played(agreement, 0), work: null });
const film = (form: FilmForm, budget: number | null, started = 0, fee: Money | null = usd('1')): Film => ({ id: 0, country: 'US', agreement: 'dga', minutes: null, form, budget, started, prepDays: 1, shootDays: 1, cutDays: 1, fee, plan: { story: 0, performances: 0, images: 0 }, needed: null, shot: null, cut: null, quality: null, festivals: {} });
/** A script sold, by its form, at a moment, for a fee. */
const sale = (form: Form, at: number, fee: Money | null = usd('1'), agreement: string | null = null) => ({ form, at, fee, agreement });
const card = (union: Union, at: number, standing: Membership['standing'] = 'full'): Membership => ({ union, at, standing, name: 'Ada Reyes', initiation: null, dues: null });

interface Given {
  person?: Partial<Person>;
  parts?: Audition[];
  sold?: ReturnType<typeof sale>[];
  films?: Film[];
  joined?: Membership[];
  now?: number;
  /** The money slices: an account in dollars holding a million, where none is given. */
  purse?: ReturnType<typeof purse>;
}

function life(g: Given = {}): Life<Lives> {
  const career = structuredClone(CAREER_START);
  const scripts = structuredClone(SCRIPTS_START);
  (g.sold ?? []).forEach((s, i) => {
    scripts.written.push({ id: i + 1, form: s.form } as unknown as Script);
    career.out[String(i + 1)] = { documents: {}, requests: 0, sold: { at: s.at, fee: s.fee } };
    if (s.agreement !== null) career.offered[String(i + 1)] = { agreement: s.agreement, budget: null, minutes: null, options: [] };
  });
  career.out['99'] = { documents: {}, requests: 0, sold: null };
  return begin(SEED, g.now ?? NOW, {
    identity: identity(g.person),
    acting: { ...structuredClone(ACTING_START), auditions: (g.parts ?? []).map((a, i) => ({ ...a, id: i + 1 })) },
    career,
    scripts,
    directing: { ...structuredClone(DIRECTING_START), films: (g.films ?? []).map((f, i) => ({ ...f, id: i + 1 })) },
    unions: { joined: g.joined ?? [] },
    ...(g.purse ?? purse()),
  });
}

const join = (g: Given, union: string) => dispatch(life(g), joinUnion, { account: ACCOUNT, union }).slices.unions.joined;
const joined = (g: Given, union: string) => join(g, union).at(-1);
const offer = (g: Given, union: Union) => terms(life(g).slices, union, g.now ?? NOW);

describe("the unions' figures", () => {
  it('are the ones the unions publish (R-4621)', () => {
    expect(SAG_AFTRA).toEqual({ initiation: usd('3121'), dues: usd('246.14') });
    expect(ACTRA_FULL).toEqual({ initiation: cad('1600'), dues: cad('195'), permits: 3 });
    expect(ACTRA_APPRENTICE).toEqual({ initiation: cad('75'), dues: null, permits: 1 });
    expect(CAEA).toEqual({ initiation: cad('1200'), dues: cad('200'), raised: cad('212'), from: '2028-05-01', years: 3 });
    expect(AEA).toEqual({ initiation: usd('1800'), dues: usd('176') });
    expect(WGA).toEqual({ initiation: usd('2500'), units: 24, associate: usd('100'), dues: usd('100'), years: 3 });
    expect(UNITS).toEqual({ feature: 24, pilot: 8, episode: 8 });
    expect(DGA).toEqual({ initiation: usd('15703'), low: usd('5000'), ceiling: 11_000_000, dues: usd('200') });
    expect(EQUITY_UK).toEqual({ earned: 75_000, contracts: ['pact-equity', 'uk-theatre'], young: [10, 17], old: 66, ceiling: 4_000_000 });
    expect(EQUITY_BANDS).toEqual([
      [4_000_000, gbp('198')],
      [8_000_000, gbp('396')],
      [12_000_000, gbp('792')],
      [24_000_000, gbp('1584')],
      [Infinity, gbp('3840')],
    ]);
    expect(TAFT_HARTLEY_DAYS).toBe(30);
  });

  it('refuse a union there is none of', () => {
    expect(() => join({}, 'pga')).toThrow("there's no union pga");
  });

  it('declare what joining reads and writes', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('unions.'))).toEqual([{ id: 'unions.join', reads: ['identity', 'acting', 'career', 'scripts', 'directing'], writes: ['unions', 'accounts', 'ledger'] }]);
    expect(UNIONS_START).toEqual({ joined: [] });
  });
});

describe('SAG-AFTRA', () => {
  it('takes a principal day on a SAG-AFTRA film above Ultra Low Budget, and records its card in the name the person goes by', () => {
    const refused = 'SAG-AFTRA asks a principal day on a SAG-AFTRA film above Ultra Low Budget, or a year in ACTRA and a part under it';
    expect(() => join({}, 'sag-aftra')).toThrow(refused);
    expect(() => join({ parts: [played('sag-aftra', 0, 300_000)] }, 'sag-aftra')).toThrow(refused);
    expect(() => join({ parts: [unplayed('sag-aftra')] }, 'sag-aftra')).toThrow(refused);
    expect(() => join({ parts: [played('actra', 0, 9_000_000)] }, 'sag-aftra')).toThrow(refused);
    const g = { person: { legal: { first: 'Adelaide', middle: 'June', last: 'Reyes' }, preferred: 'June Reyes' }, parts: [played('sag-aftra', 0, 300_001)] };
    expect(join(g, 'sag-aftra')).toEqual([{ union: 'sag-aftra', at: NOW, standing: 'full', name: 'June Reyes', initiation: usd('3121'), dues: usd('246.14') }]);
    expect(() => join({ ...g, joined: [card('sag-aftra', 0)] }, 'sag-aftra')).toThrow('the person is a member of sag-aftra already');
    // The fee and the year's dues are paid from the account named, to the union; refused where it can't cover them.
    const paid = dispatch(life(g), joinUnion, { account: ACCOUNT, union: 'sag-aftra' }).slices.ledger;
    expect([minorIn(paid, ACCOUNT), minorIn(paid, 'world:sag-aftra:USD')]).toEqual([100_000_000 - 312_100 - 24_614, 312_100 + 24_614]);
    expect(() => join({ ...g, purse: purse('USD', 312_099) }, 'sag-aftra')).toThrow("everyday:1 can't cover an initiation fee");
    expect(() => join({ ...g, purse: purse('USD', 312_100 + 24_613) }, 'sag-aftra')).toThrow("everyday:1 can't cover dues");
    // Equity's first year has no initiation fee: its subscription alone, carried from pounds.
    const equity = dispatch(life({ parts: [played('pact-equity', 0, 5_000_000, null)], purse: purse('GBP') }), joinUnion, { account: ACCOUNT, union: 'equity-uk' }).slices.ledger;
    expect(minorIn(equity, ACCOUNT)).toBe(100_000_000 - 19_800);
  });

  it('takes a paid-up year in ACTRA and a part played under it', () => {
    const at = day(2025, 11, 1);
    const g = (joinedAt: number, standing: Membership['standing'] = 'full', parts = [played('actra', 0)]): Given => ({ parts, joined: [card('actra', joinedAt, standing)] });
    expect(joined(g(at), 'sag-aftra')?.standing).toBe('full');
    expect(() => join(g(at + SECONDS_PER_DAY), 'sag-aftra')).toThrow('SAG-AFTRA asks');
    expect(() => join(g(at, 'apprentice'), 'sag-aftra')).toThrow('SAG-AFTRA asks');
    expect(() => join(g(at, 'full', [played('sag-aftra', 0, 1000)]), 'sag-aftra')).toThrow('SAG-AFTRA asks');
    expect(() => join(g(at, 'full', [unplayed('actra')]), 'sag-aftra')).toThrow('SAG-AFTRA asks');
    expect(joined({ ...g(day(2024, 2, 29)), now: day(2025, 3, 1) }, 'sag-aftra')?.standing).toBe('full');
    expect(() => join({ ...g(day(2024, 2, 29)), now: day(2025, 2, 28) }, 'sag-aftra')).toThrow('SAG-AFTRA asks');
  });
});

describe('Equity (UK)', () => {
  const refused = 'Equity asks £750 earned from the work, or a part on an Equity contract';

  it('takes a part on an Equity contract, with no joining fee', () => {
    expect(() => join({}, 'equity-uk')).toThrow(refused);
    expect(() => join({ parts: [unplayed('pact-equity')] }, 'equity-uk')).toThrow(refused);
    for (const a of ['pact-equity', 'uk-theatre'] as const) {
      expect(join({ parts: [played(a, 0, 5_000_000, null)] }, 'equity-uk')).toEqual([{ union: 'equity-uk', at: NOW, standing: 'full', name: 'Ada Reyes', initiation: null, dues: gbp('198') }]);
    }
  });

  it('takes £750 earned from the work, in pounds as estimated the day it was paid', () => {
    const at = day(2026, 1, 15);
    expect(() => join({ sold: [sale('feature', at, gbp('749.99'))] }, 'equity-uk')).toThrow(refused);
    expect(joined({ sold: [sale('feature', at, gbp('750'))] }, 'equity-uk')?.standing).toBe('full');
    expect(joined({ films: [film('feature', 1_000_000, at, gbp('750'))] }, 'equity-uk')?.standing).toBe('full');
    expect(joined({ parts: [played('actra', at, 0, gbp('750'))] }, 'equity-uk')?.standing).toBe('full');
    expect(joined({ sold: [sale('feature', at, gbp('400'))], parts: [played('sag-aftra', at, 5_000_000, gbp('350'))] }, 'equity-uk')?.standing).toBe('full');
    // A pound paid before the rates begin is still a pound.
    expect(joined({ sold: [sale('feature', day(2024, 1, 15), gbp('750'))] }, 'equity-uk')?.standing).toBe('full');
    // Dollars, at the day's estimate: $1,000 is £752 on the rate from 30 September 2026, $997 short of £750.
    const sep = day(2026, 10, 1);
    expect(exchangeOn(usd('1000'), 'GBP', '2026-10-01')?.money).toEqual(gbp('752'));
    expect(joined({ sold: [sale('feature', sep, usd('1000'))] }, 'equity-uk')?.standing).toBe('full');
    expect(exchangeOn(usd('997'), 'GBP', '2026-10-01')?.money).toEqual(gbp('749.74'));
    expect(() => join({ sold: [sale('feature', sep, usd('997'))] }, 'equity-uk')).toThrow(refused);
    // No estimate before the pound's rate is known; nothing paid counts nothing.
    expect(() => join({ sold: [sale('feature', day(2025, 6, 1), usd('100000'))] }, 'equity-uk')).toThrow(refused);
    expect(() => join({ sold: [sale('short', at, null)], films: [film('feature', 1_000_000, at, null)], parts: [played('sag-aftra', at, 10_000, null)] }, 'equity-uk')).toThrow(refused);
  });

  it('may not take a single initial for a forename or a surname', () => {
    const g = (preferred: string): Given => ({ person: { preferred }, parts: [played('uk-theatre', 0)] });
    for (const name of ['J Reyes', 'J. Reyes', 'Ada R', 'Ada R.', 'A']) expect(() => join(g(name), 'equity-uk')).toThrow('an Equity name may not be a single initial');
    for (const name of ['Jo Reyes', 'Ada J Reyes', 'Ada Reyes', 'Zendaya']) expect(joined(g(name), 'equity-uk')?.name).toBe(name);
  });

  it("charges the band of the three tax years' average income before this one", () => {
    const at = day(2024, 1, 15);
    const dues = (pounds: string, now = NOW, paidAt = at) => joined({ parts: [played('uk-theatre', 0)], films: [film('feature', 1_000_000, paidAt, gbp(pounds))], now }, 'equity-uk')?.dues;
    const bands: [string, string][] = [
      ['120000', '198'],
      ['120000.01', '396'],
      ['240000', '396'],
      ['240000.01', '792'],
      ['360000', '792'],
      ['360000.01', '1584'],
      ['720000', '1584'],
      ['720000.01', '3840'],
    ];
    for (const [earned, fee] of bands) expect(dues(earned)).toEqual(gbp(fee));
    // On 1 November 2026 the three tax years run from 6 April 2023 to 5 April 2026.
    expect(dues('720000.01', NOW, day(2023, 4, 6))).toEqual(gbp('3840'));
    expect(dues('720000.01', NOW, day(2023, 4, 5))).toEqual(gbp('198'));
    expect(dues('720000.01', NOW, day(2026, 4, 5))).toEqual(gbp('3840'));
    expect(dues('720000.01', NOW, day(2026, 4, 6))).toEqual(gbp('198'));
    // Before 6 April the year before is this one; from it, the next.
    expect(dues('720000.01', day(2027, 4, 5), day(2023, 4, 6))).toEqual(gbp('3840'));
    expect(dues('720000.01', day(2027, 4, 6), day(2023, 4, 6))).toEqual(gbp('198'));
    expect(dues('720000.01', day(2027, 4, 6), day(2027, 4, 5))).toEqual(gbp('3840'));
  });

  it('halves it for the subsidised ages, 10 to 17 and 66 on, under £40,000', () => {
    const dues = (born: string, pounds = '0') => joined({ person: { born: { date: born, country: 'GB', region: '' } }, parts: [played('uk-theatre', 0)], films: [film('feature', 1, day(2024, 1, 15), gbp(pounds))] }, 'equity-uk')?.dues;
    expect(dues('2016-11-02')).toEqual(gbp('198'));
    expect(dues('2016-11-01')).toEqual(gbp('99'));
    expect(dues('2009-11-01')).toEqual(gbp('99'));
    expect(dues('2008-11-01')).toEqual(gbp('198'));
    expect(dues('1960-11-02')).toEqual(gbp('198'));
    expect(dues('1960-11-01')).toEqual(gbp('99'));
    expect(dues('2016-11-01', '119999.99')).toEqual(gbp('99'));
    expect(dues('2016-11-01', '120000')).toEqual(gbp('198'));
    expect(dues('1950-01-01', '120000.01')).toEqual(gbp('396'));
  });
});

describe('ACTRA', () => {
  const parts = (n: number) => Array.from({ length: n }, () => played('actra', 0));

  it('takes a Canadian citizen with a part on a permit as an Apprentice, with three as a Full member', () => {
    expect(() => join({ parts: parts(3) }, 'actra')).toThrow('ACTRA membership is for Canadian citizens and permanent residents');
    const ca = { citizenship: ['US', 'CA'] as Person['citizenship'] };
    expect(() => join({ person: ca, parts: [unplayed('actra'), played('sag-aftra', 0)] }, 'actra')).toThrow('ACTRA asks a part played on an ACTRA permit');
    expect(join({ person: ca, parts: parts(1) }, 'actra')).toEqual([{ union: 'actra', at: NOW, standing: 'apprentice', name: 'Ada Reyes', initiation: cad('75'), dues: null }]);
    expect(joined({ person: ca, parts: parts(2) }, 'actra')?.standing).toBe('apprentice');
    expect(() => join({ person: ca, parts: parts(2), joined: [card('actra', 0, 'apprentice')] }, 'actra')).toThrow('the person is a member of actra already');
    expect(join({ person: ca, parts: parts(3), joined: [card('actra', 0, 'apprentice')] }, 'actra')).toEqual([card('actra', 0, 'apprentice'), { union: 'actra', at: NOW, standing: 'full', name: 'Ada Reyes', initiation: cad('1600'), dues: cad('195') }]);
    expect(() => join({ person: ca, parts: parts(3), joined: [card('actra', 0, 'apprentice'), card('actra', 1)] }, 'actra')).toThrow('a member of actra already');
  });
});

describe("Canadian Actors' Equity", () => {
  it("takes three years' paid professional experience, and its dues rise on 1 May 2028", () => {
    const refused = "Canadian Actors' Equity asks three years' paid professional experience";
    expect(() => join({}, 'caea')).toThrow(refused);
    expect(() => join({ parts: [played('actra', day(2023, 11, 2)), unplayed('actra')] }, 'caea')).toThrow(refused);
    expect(join({ parts: [played('actra', day(2026, 1, 1)), played('uk-theatre', day(2023, 11, 1))] }, 'caea')).toEqual([{ union: 'caea', at: NOW, standing: 'full', name: 'Ada Reyes', initiation: cad('1200'), dues: cad('200') }]);
    const g = (now: number): Given => ({ parts: [played('actra', day(2023, 1, 1))], now });
    expect(joined(g(day(2028, 4, 30)), 'caea')?.dues).toEqual(cad('200'));
    expect(joined(g(day(2028, 5, 1)), 'caea')?.dues).toEqual(cad('212'));
  });
});

describe("Actors' Equity Association", () => {
  it('takes a year in SAG-AFTRA, its sibling, and a part played under it', () => {
    const refused = "Actors' Equity asks a year in SAG-AFTRA and a part under it";
    const at = day(2025, 11, 1);
    expect(() => join({}, 'aea')).toThrow(refused);
    expect(join({ parts: [played('sag-aftra', 0, 10_000)], joined: [card('sag-aftra', at)] }, 'aea').at(-1)).toEqual({ union: 'aea', at: NOW, standing: 'full', name: 'Ada Reyes', initiation: usd('1800'), dues: usd('176') });
    expect(() => join({ parts: [played('sag-aftra', 0)], joined: [card('sag-aftra', at + SECONDS_PER_DAY)] }, 'aea')).toThrow(refused);
    expect(() => join({ parts: [played('actra', 0)], joined: [card('sag-aftra', at)] }, 'aea')).toThrow(refused);
    expect(() => join({ parts: [played('sag-aftra', 0)], joined: [card('actra', at)] }, 'aea')).toThrow(refused);
  });
});

describe('the WGA West', () => {
  it("counts the units of sales to signatories in the three years before: 24 for Current, fewer for Associate", () => {
    const refused = 'the WGA asks a sale to a signatory in the last three years';
    const at = day(2026, 1, 1);
    expect(() => join({}, 'wga-west')).toThrow(refused);
    expect(() => join({ sold: [sale('short', at, null), sale('feature', at, null)] }, 'wga-west')).toThrow(refused);
    expect(joined({ sold: [sale('feature', at, null), sale('episode', at)] }, 'wga-west')?.standing).toBe('associate');
    expect(join({ sold: [sale('feature', at)] }, 'wga-west')).toEqual([{ union: 'wga-west', at: NOW, standing: 'full', name: 'Ada Reyes', initiation: usd('2500'), dues: usd('100') }]);
    expect(join({ sold: [sale('episode', at)] }, 'wga-west')).toEqual([{ union: 'wga-west', at: NOW, standing: 'associate', name: 'Ada Reyes', initiation: null, dues: usd('100') }]);
    expect(joined({ sold: [sale('pilot', at)] }, 'wga-west')?.standing).toBe('associate');
    expect(joined({ sold: [sale('pilot', at), sale('episode', at)] }, 'wga-west')?.standing).toBe('associate');
    expect(joined({ sold: [sale('pilot', at), sale('episode', at), sale('episode', at)] }, 'wga-west')?.standing).toBe('full');
    expect(joined({ sold: [sale('feature', day(2023, 11, 1))] }, 'wga-west')?.standing).toBe('full');
    // A sale in another market (offered under its agreement) is not to a WGA signatory: it earns no units.
    expect(() => join({ sold: [sale('feature', at, usd('1'), 'ca-ipa')] }, 'wga-west')).toThrow('the WGA asks a sale to a signatory in the last three years');
    expect(joined({ sold: [sale('feature', at, usd('1'), 'ca-ipa'), sale('pilot', at)] }, 'wga-west')?.standing).toBe('associate');
    expect(() => join({ sold: [sale('feature', day(2023, 10, 31))] }, 'wga-west')).toThrow(refused);
    expect(joined({ sold: [sale('feature', day(2023, 10, 31)), sale('episode', at)] }, 'wga-west')?.standing).toBe('associate');
    expect(join({ sold: [sale('feature', at)], joined: [card('wga-west', 0, 'associate')] }, 'wga-west')).toHaveLength(2);
    expect(() => join({ sold: [sale('episode', at)], joined: [card('wga-west', 0, 'associate')] }, 'wga-west')).toThrow('a member of wga-west already');
    expect(() => join({ sold: [sale('episode', at)], joined: [card('wga-west', 0)] }, 'wga-west')).toThrow('a member of wga-west already');
  });
});

describe('the DGA', () => {
  it("takes employment by a signatory, at the latest job's category's fee", () => {
    expect(() => join({}, 'dga')).toThrow('the DGA asks employment by a signatory: a film or an episode directed');
    expect(join({ films: [film('feature', 11_000_000)] }, 'dga')).toEqual([{ union: 'dga', at: NOW, standing: 'full', name: 'Ada Reyes', initiation: usd('5000'), dues: usd('200') }]);
    expect(joined({ films: [film('feature', 11_000_001)] }, 'dga')?.initiation).toEqual(usd('15703'));
    expect(joined({ films: [film('hour', null)] }, 'dga')?.initiation).toEqual(usd('15703'));
    // A film directed in another market isn't employment by a DGA signatory; the DGA reads its own films, the latest last.
    const abroad: Film = { ...film('feature', 11_000_001), country: 'FR', agreement: 'fr-idcc-3097' };
    expect(() => join({ films: [abroad] }, 'dga')).toThrow('the DGA asks employment by a signatory: a film or an episode directed');
    expect(joined({ films: [film('feature', 1_000_000), abroad] }, 'dga')?.initiation).toEqual(joined({ films: [film('feature', 1_000_000)] }, 'dga')?.initiation);
    expect(joined({ films: [film('feature', 1_000_000), film('half-hour', null)] }, 'dga')?.initiation).toEqual(usd('15703'));
    expect(joined({ films: [film('half-hour', null), film('feature', 1_000_000)] }, 'dga')?.initiation).toEqual(usd('5000'));
  });
});

describe('joining', () => {
  it("bites: the life's work decides whether the card is given", () => {
    const outcome = (budget: number) => {
      try {
        return join({ parts: [played('sag-aftra', 0, budget)] }, 'sag-aftra');
      } catch {
        return null;
      }
    };
    falsifyAny({ feature: 'unions.join', claim: 'bites', says: 'a principal day on a $300,001 SAG-AFTRA film opens SAG-AFTRA; on a $300,000 one it does not', base: 300_000, twin: 300_001, outcome });
    expect(offer({ parts: [played('sag-aftra', 0)] }, 'sag-aftra')).toEqual({ standing: 'full', ...SAG_AFTRA });
  });

  it('is read downstream: a SAG-AFTRA card lets the person take SAG-AFTRA work past the Taft-Hartley days', () => {
    const first = day(2026, 1, 1);
    const g = (n: number): Given => ({ parts: [played('sag-aftra', first)], joined: n === 0 ? [] : [card('sag-aftra', first)] });
    falsifyAny({ feature: 'unions.join', claim: 'downstream', says: 'a member may take SAG-AFTRA work a year after the first job; a non-member may not', base: 0, twin: 1, outcome: (n) => mayTakeUnionWork(life(g(n)).slices, 'sag-aftra', NOW) });
    expect(memberOf(life(g(1)).slices.unions, 'sag-aftra')).toEqual(card('sag-aftra', first));
    expect(memberOf(life(g(0)).slices.unions, 'sag-aftra')).toBeUndefined();
  });
});

describe('union work', () => {
  it("lets a non-member take SAG-AFTRA work until the thirtieth day after their first SAG-AFTRA job, then only a member", () => {
    const first = day(2026, 3, 1);
    const s = (parts: Audition[], joinedCards: Membership[] = []) => life({ parts, joined: joinedCards }).slices;
    const thirty = first + TAFT_HARTLEY_DAYS * SECONDS_PER_DAY;
    expect(mayTakeUnionWork(s([]), 'sag-aftra', NOW)).toBe(true);
    expect(mayTakeUnionWork(s([unplayed('sag-aftra'), played('actra', 0), played('pact-equity', 0)]), 'sag-aftra', NOW)).toBe(true);
    const once = s([played('sag-aftra', day(2026, 5, 1)), played('sag-aftra', first)]);
    expect(mayTakeUnionWork(once, 'sag-aftra', thirty - 1)).toBe(true);
    expect(mayTakeUnionWork(once, 'sag-aftra', thirty)).toBe(false);
    expect(mayTakeUnionWork(s([played('sag-aftra', first)], [card('sag-aftra', first)]), 'sag-aftra', thirty)).toBe(true);
    expect(mayTakeUnionWork(s([played('sag-aftra', first)], [card('actra', first)]), 'sag-aftra', thirty)).toBe(false);
  });

  it("never bars a non-member from Equity's UK work or ACTRA's", () => {
    const s = life({ parts: [played('sag-aftra', 0)] }).slices;
    for (const a of ['pact-equity', 'uk-theatre', 'actra'] as const) expect(mayTakeUnionWork(s, a, NOW)).toBe(true);
  });
});

describe('working in a country', () => {
  it('is open where a citizenship gives the right, and closed where it takes a permit or the rules are not kept', () => {
    const p = (citizenship: string[]) => person({ citizenship: citizenship as Person['citizenship'] });
    expect(mayWorkIn(p(['US']), 'US')).toBe(true);
    expect(mayWorkIn(p(['US']), 'PR')).toBe(true);
    expect(mayWorkIn(p(['US']), 'GB')).toBe(false);
    expect(mayWorkIn(p(['IE']), 'GB')).toBe(true);
    expect(mayWorkIn(p(['FR']), 'DE')).toBe(true);
    expect(mayWorkIn(p(['US', 'IE']), 'GB')).toBe(true);
    expect(mayWorkIn(p(['IE', 'US']), 'CA')).toBe(false);
    expect(mayWorkIn(p(['US']), 'CU')).toBe(false);
  });
});

describe('the line for the game\'s own figures', () => {
  it("tells the player its own figures are the game's", async () => {
    const { MODEL_LINE } = await import('../../../src/person/unions/unions.ts');
    const { t } = await import('../../../src/core/text/text.ts');
    expect(MODEL_LINE).toBe('unions.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own");
  });
});
