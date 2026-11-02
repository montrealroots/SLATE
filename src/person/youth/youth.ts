import { defineCommand, defineKind, type Context, type Item, type Json } from '../../core/frame/frame.ts';
import { fromMajor, money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { civilFromDays, daysFromCivil, daysInMonth } from '../../core/time/calendar.ts';
import { dayStart } from '../../core/time/dates.ts';
import { localTime } from '../../core/time/time.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { heldOf, type Holding } from '../../money/accounts/accounts.ts';
import { move, WORLD } from '../../money/ledger/ledger.ts';
import { inCurrency, type Earning, type Paid, type Work } from '../../money/tax/tax.ts';
import { majorityAt, workAge } from '../../papers/ages/ages.ts';
import type { Age } from '../../papers/licence/licence.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { dateOf, WEEK_DAYS } from '../acting/acting.ts';
import { personOf, type IdentitySlice, type Person } from '../identity/identity.ts';
import data from './youth.json' with { type: 'json' };

/**
 * What a person under age meets in screen work (BUILD-ORDER layer 4; the owner, 2026-11-01: "Start the age readers once
 * the ledger lands", the age rules reaching young writers, producers and directors as well as performers, each where
 * the law reaches them), in the country the work is in (src/person/youth/youth.json, compiled by tools/person/youth
 * from the research, register facts person.ages.<CC>), its age of majority and working age layer 3's (papers.ages):
 *
 * - The work is refused where the law bars it at the person's age: a child performer below the youngest age the
 *   permit is granted at, or where no child may perform; any other employed work (directing, producing) below the
 *   general working age unless the child-work rule reaches it. A script sold isn't employment.
 * - It needs, first, what the law requires of it (`youth.authorise`, once for each engagement): the child performer's
 *   permit or licence, below the age the country's law needs it under, for the work it reaches; and, below majority
 *   and the age the minor contracts alone, the guardian's signature, a court's approval or an authority's, as the
 *   research says the contract is made binding, for the work that rule reaches. A contract the minor may avoid
 *   stands without approval.
 * - It is limited to the hours a day and a week the law allows at the person's age, read against the work's days: a
 *   day's work is eight hours (SAG-AFTRA's day performer's), so a minor allowed four works half of each day.
 * - Its pay, below majority, has the share the law sets aside paid into the account the law names (the Coogan
 *   trust's 15% in California, the Caisse des dépôts' pécule in France), of the gross, above the threshold the law
 *   sets where it sets one, never more than the pay itself; it is paid back on the day the person comes of age.
 * - A union's age rules are unions.join's, where the research gives one (Equity UK's young rate, 10 to 17); where the
 *   research shows a union has rules for its young members but couldn't read them (SAG-AFTRA's), the player is told.
 * - A fund that takes only companies takes a producer only from the age the company law lets a person direct one, and
 *   a fund that sets an applicant's age only from it.
 *
 * Where the work's country sets these by region, they are its seat's, the region its work is made in (California,
 * Ontario, New South Wales); ages are reckoned at midnight in the seat's most populous place. What isn't known is told.
 */

export type Need = 'permit' | 'guardian' | 'court' | 'authority';

/** A compiled country (tools/person/youth/compile.ts). */
interface Contract {
  readonly by: 'self' | 'voidable' | 'court' | 'authority' | 'guardian';
  readonly alone: Age | null;
  readonly roles: readonly Work[];
}
interface SetAside {
  readonly share: string;
  readonly into: string | null;
  readonly roles: readonly Work[];
  readonly over: { readonly amount: string; readonly currency: string; readonly per: 'engagement' | 'year'; readonly above: boolean } | null;
}
interface Band {
  readonly from: Age;
  /** The age it ends at: none, at majority; `work`, at the country's working age. */
  readonly to: Age | 'work' | null;
  readonly day: number | null;
  readonly week: number | null;
}
export interface Rules {
  readonly zone: string | null;
  readonly seat: string | null;
  readonly contract: Contract | null;
  readonly setAside: SetAside | 'none' | null;
  readonly permit: { readonly issuer: string | null; readonly under: Age | 'majority'; readonly from: Age | null } | null;
  readonly reach: readonly Work[];
  readonly hours: readonly Band[] | null;
  readonly company: Age | 'majority' | null;
  readonly fund: Age | 'company' | null;
  /** The unions whose rules for a young member exist but aren't known. */
  readonly unions: readonly string[];
}

export const RULES = (data as unknown as { countries: Readonly<Record<string, Rules>> }).countries;

/** A country's rules; none known where the research holds none. */
export const rulesOf = (country: string): Rules | undefined => (Object.hasOwn(RULES, country) ? RULES[country] : undefined);

/** What a minor's engagement was authorised for, once. */
export interface Grant {
  [key: string]: Json;
  id: number;
  at: number;
  country: string;
  role: Work;
  needs: Need[];
  used: boolean;
}

/** Pay set aside until the person comes of age. */
export interface Held {
  [key: string]: Json;
  at: number;
  country: string;
  /** The engagement it was paid for (a part, a script, a film, a project). */
  engagement: string;
  /** The person's account it came out of, and goes back to. */
  account: string;
  /** In the account's currency, minor units. */
  amount: number;
  currency: string;
  into: string | null;
  release: number;
  released: boolean;
}

/** A minor's gross pay in a country whose set-aside starts above a threshold: what the threshold counts. */
export interface Earned {
  [key: string]: Json;
  at: number;
  country: string;
  engagement: string;
  currency: string;
  gross: number;
}

export interface YouthSlice {
  granted: Grant[];
  held: Held[];
  earned: Earned[];
}

export const YOUTH_START: YouthSlice = { granted: [], held: [], earned: [] };

/** The instant a person born on a date reaches an age, at midnight in a zone; a day the month hasn't (29 February) comes on the next, as ageOn reads it. */
export function reachedAt(born: string, age: Age, zone: string): number {
  const [y, m, d] = born.split('-').map(Number) as [number, number, number];
  const [years, months, days] = typeof age === 'number' ? [age, 0, 0] : [age.years, 'months' in age ? age.months : 0, 'days' in age ? age.days : 0];
  const index = y * 12 + m - 1 + years * 12 + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const last = daysInMonth(year, month);
  const day = d > last ? daysFromCivil(year, month, last) + 1 : daysFromCivil(year, month, d);
  return dayStart(zone, civilFromDays(day + days));
}

/** A country's rules and the zone its ages are reckoned in; refused where the game places no work there. */
function placed(country: string): Rules & { zone: string } {
  const r = rulesOf(country);
  if (r?.zone === undefined || r.zone === null) throw new Error(`where the work in ${country} is made isn't known to this game`);
  return r as Rules & { zone: string };
}

// A country without a seat is asked for a region of its own code, which none is: its majority is the country's.
const majorityIn = (r: Rules, country: string): Age | undefined => majorityAt({ country: country as CountryCode, region: r.seat ?? country });
const below = (p: Person, age: Age, now: number, zone: string): boolean => now < reachedAt(p.born.date, age, zone);
const said = (age: Age): string => (typeof age === 'number' ? String(age) : 'days' in age ? `${age.days} days` : `${age.months} months`);

/**
 * Whether the law bars a person from a kind of work in a country now, and what it needs first: the permit, and the
 * guardian's, a court's or an authority's approval of the contract.
 */
export function needsOf(p: Person, country: string, role: Work, now: number, r: Rules & { zone: string } = placed(country)): { barred: string | null; needs: Need[] } {
  const under = (age: Age) => below(p, age, now, r.zone);
  const name = countryName(country as CountryCode);
  const w = workAge(country as CountryCode);
  const needs: Need[] = [];
  if (!r.reach.includes(role)) {
    if (role !== 'author' && w !== undefined && under(w.from)) return { barred: `no one under ${said(w.from)} may be employed in ${name}`, needs };
  } else if (r.permit !== null) {
    const until = r.permit.under === 'majority' ? majorityIn(r, country) : r.permit.under;
    if (until !== undefined && under(until)) {
      if (r.permit.from !== null && under(r.permit.from)) return { barred: `no child under ${said(r.permit.from)} may do that work in ${name}`, needs };
      if (r.permit.issuer !== null) needs.push('permit');
    }
  } else if (w !== undefined && under(w.from)) {
    if (w.performers === 'barred') return { barred: `no child under ${said(w.from)} may do that work in ${name}`, needs };
    if (w.performers === 'permit') {
      if (w.permitFrom !== undefined && under(w.permitFrom)) return { barred: `no child under ${said(w.permitFrom)} may do that work in ${name}`, needs };
      needs.push('permit');
    }
  }
  const m = majorityIn(r, country);
  const c = r.contract;
  if (c !== null && m !== undefined && under(m) && c.roles.includes(role) && (c.alone === null || under(c.alone)) && c.by !== 'self' && c.by !== 'voidable') needs.push(c.by);
  return { barred: null, needs };
}

export interface AuthoriseArgs {
  [key: string]: string;
  country: string;
  role: Work;
}

const ROLES: readonly Work[] = ['performer', 'director', 'producer', 'author'];

/** Has what the law requires of a minor's engagement granted, once: refused where the law bars the work, or nothing is required. */
function authorise(s: { identity: IdentitySlice; youth: YouthSlice }, a: AuthoriseArgs, c: Context): void {
  if (!ROLES.includes(a.role)) throw new Error(`there's no work ${String(a.role)}`);
  // @slate:consumer identity.make
  const { barred, needs } = needsOf(personOf(s.identity), a.country, a.role, c.now);
  if (barred !== null) throw new Error(barred);
  if (needs.length === 0) throw new Error(`nothing needs authorising for that work in ${countryName(a.country as CountryCode)}`);
  s.youth.granted.push({ id: s.youth.granted.length + 1, at: c.now, country: a.country, role: a.role, needs, used: false });
}

/**
 * The engagement of a kind of work in a country now, as the law lets a person of their age take it: refused where it
 * bars it, or where it needs what isn't granted; the grant it uses, which the work marks used, or none where nothing
 * is needed.
 */
export function engagement(s: { identity: IdentitySlice; youth: YouthSlice }, country: string, role: Work, now: number): Grant | null {
  const { barred, needs } = needsOf(personOf(s.identity), country, role, now);
  if (barred !== null) throw new Error(barred);
  if (needs.length === 0) return null;
  // @slate:consumer youth.authorise
  const g = s.youth.granted.find((x) => !x.used && x.country === country && x.role === role);
  if (g === undefined) throw new Error(`that work in ${countryName(country as CountryCode)} needs ${needs.join(' and ')} first`);
  return g;
}

/** The hours a working day is: SAG-AFTRA's day performer's eight (person.ages.model). */
export const DAY_HOURS = 8;

/** The share of each working day the law lets a person of their age work, 1 for all of it: the day's and the week's hours for their band, against an eight-hour day of a five-day week. */
export function hoursShare(p: Person, country: string, role: Work, now: number, r: Rules & { zone: string } = placed(country)): number {
  if (r.hours === null || !r.reach.includes(role)) return 1;
  const m = majorityIn(r, country);
  const ends = (b: Band): Age | undefined => (b.to === null ? m : b.to === 'work' ? workAge(country as CountryCode)?.from : b.to);
  const band = r.hours.find((b) => {
    const to = ends(b);
    return to !== undefined && !below(p, b.from, now, r.zone) && below(p, to, now, r.zone);
  });
  if (band === undefined) return 1;
  return Math.min(1, (band.day ?? DAY_HOURS) / DAY_HOURS, (band.week ?? DAY_HOURS * WEEK_DAYS) / (DAY_HOURS * WEEK_DAYS));
}

export const RELEASE_KIND = 'youth.release';

/** A year in a zone, for a threshold counted by the year. */
const yearIn = (zone: string, at: number): number => localTime(zone, at).date.year;

/**
 * What of a payment the law sets aside: its share of the gross, of the part above the threshold where one starts
 * (Ontario's) or all of it once the year's pay has passed it (the Philippines'), in minor units of the payment's currency.
 */
export function setAsideOf(sa: SetAside, paid: Paid, before: number, day: string): number {
  let base = paid.gross;
  if (sa.over !== null) {
    const limit = inCurrency(fromMajor(sa.over.currency as CurrencyCode, sa.over.amount), paid.currency, day).minor;
    base = sa.over.above ? Math.max(0, before + paid.gross - Math.max(limit, before)) : before + paid.gross > limit ? paid.gross : 0;
  }
  const q = rational(sa.share);
  return Number(roundHalfEven(BigInt(base) * q.num, q.den));
}

/**
 * Sets aside, below majority, what the law of the work's country sets aside of a payment, into the account it names
 * (the world's, for the person), never more than the payment left after what was withheld; paid back the day the
 * person comes of age. `engagement` names the engagement a threshold is counted over.
 */
export function holdBack(s: Earning & { identity: IdentitySlice; youth: YouthSlice }, paid: Paid, engagement: string, c: Context, r: Rules & { zone: string } = placed(paid.country)): void {
  const p = personOf(s.identity);
  const sa = r.setAside;
  const m = majorityIn(r, paid.country);
  if (sa === null || sa === 'none' || !sa.roles.includes(paid.work) || m === undefined || !below(p, m, c.now, r.zone)) return;
  const day = dateOf(c.now);
  let before = 0;
  if (sa.over !== null) {
    const year = yearIn(r.zone, c.now);
    const per = sa.over.per;
    const counted = s.youth.earned.filter((e) => e.country === paid.country && (per === 'engagement' ? e.engagement === engagement : yearIn(r.zone, e.at) === year));
    before = counted.reduce((t, e) => t + inCurrency(money(e.currency as CurrencyCode, e.gross), paid.currency, day).minor, 0);
    s.youth.earned.push({ at: c.now, country: paid.country, engagement, currency: paid.currency, gross: paid.gross });
  }
  const net = paid.gross - paid.tax - paid.social + paid.vat;
  const amount = Math.min(setAsideOf(sa, paid, before, day), net);
  if (amount <= 0) return;
  const h = heldOf(s.accounts, paid.account);
  const x: Money = inCurrency(money(paid.currency as CurrencyCode, amount), h.currency, day);
  move(s.ledger, c.now, 'set aside', [{ account: h.id, amount: money(x.currency as CurrencyCode, -x.minor) }, { account: `${WORLD}youth:${paid.country}`, amount: x }]);
  const release = reachedAt(p.born.date, m, r.zone);
  s.youth.held.push({ at: c.now, country: paid.country, engagement, account: h.id, amount: x.minor, currency: x.currency, into: sa.into, release, released: false });
  c.schedule(RELEASE_KIND, release, { held: s.youth.held.length - 1 });
}

/** Pays what was set aside back into the account it came from, the day the person comes of age. */
function release(s: Holding & { youth: YouthSlice }, item: Item, c: Context): void {
  const h = s.youth.held[(item.data as { held: number }).held] as Held;
  const x = money(h.currency as CurrencyCode, h.amount);
  move(s.ledger, c.now, 'set aside, released', [{ account: `${WORLD}youth:${h.country}`, amount: money(x.currency as CurrencyCode, -x.minor) }, { account: h.account, amount: x }]);
  h.released = true;
}

/** Why a fund refuses a producer of their age in a country, or null: under the fund's own age, or, where it takes only companies, the age to direct one. */
export function fundRefuses(p: Person, country: string, now: number, r: Rules & { zone: string } = placed(country)): string | null {
  const age = r.fund === 'company' ? r.company : r.fund;
  const until = age === 'majority' ? majorityIn(r, country) : age;
  if (until === null || until === undefined || !below(p, until, now, r.zone)) return null;
  const name = countryName(country as CountryCode);
  return r.fund === 'company' ? `${name}'s public fund takes only companies, and no one under ${said(until)} may direct one there` : `${name}'s public fund takes no applicant under ${said(until)}`;
}

/** The line that tells the player what of a country's rules for the young isn't known. */
/** The line that tells the player some of these readings are the game's own (person.ages.model). */
export const MODEL_LINE: LineId = 'youth.model';
export const UNKEPT_LINE: LineId = 'youth.unkept';
export const MISSING: Readonly<Record<string, string>> = {
  majority: 'the age of majority',
  permit: "a child performer's permit",
  contract: "how a minor's contract is made binding",
  setAside: "what of a minor's pay is set aside",
  hours: 'the hours a minor may work',
  company: 'the age from which a person may direct a company',
  fund: 'the age from which its public film fund takes an applicant',
  union: "'s rules for its young members",
};

/** What the player is told of a country where its rules for the young aren't known whole: "a, b and c"; nothing where they are. */
export function aboutYouth(country: string, r: Rules | undefined = rulesOf(country)): string | undefined {
  if (r === undefined) return undefined;
  const missing = [
    majorityIn(r, country) === undefined ? MISSING.majority : null,
    r.permit === null && workAge(country as CountryCode) === undefined ? MISSING.permit : null,
    r.contract === null ? MISSING.contract : null,
    r.setAside === null ? MISSING.setAside : null,
    r.hours === null ? MISSING.hours : null,
    r.company === null ? MISSING.company : null,
    r.fund === null ? MISSING.fund : null,
    ...r.unions.map((u) => `${u}${MISSING.union as string}`),
  ].filter((x): x is string => x !== null);
  if (missing.length === 0) return undefined;
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1) as string}` : (missing[0] as string);
  return t(UNKEPT_LINE, { country: countryName(country as CountryCode), missing: list });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const authoriseWork = defineCommand<{ identity: IdentitySlice; youth: YouthSlice }, AuthoriseArgs>({ id: 'youth.authorise', reads: ['identity'], writes: ['youth'], run: authorise });
export const released = defineKind<Holding & { youth: YouthSlice }>({ kind: RELEASE_KIND, wants: false, reads: [], writes: ['youth', 'ledger'], happen: release });
