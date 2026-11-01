import { defineCommand, defineKind, type Context, type Item } from '../../core/frame/frame.ts';
import { money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { exchangeOn } from '../../money/rates/rates.ts';
import { SECONDS_PER_DAY, weekdayFromDays } from '../../core/time/calendar.ts';
import { addMonths } from '../../core/time/dates.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { holidayOn } from '../../world/holidays/holidays.ts';
import { auditionOf, COUNTRY, credit, dateOf, daysWorked, pay, type ActingSlice, type Part } from '../acting/acting.ts';
import { ageOf, personOf, speaks, type IdentitySlice, type Level, type Person } from '../identity/identity.ts';
import { mayWorkIn } from '../unions/unions.ts';
import { aboutWork, keepsWork, work, type Work } from '../../papers/work/work.ts';
import kept from '../../papers/work/work.json' with { type: 'json' };
import data from './permits.json' with { type: 'json' };

/**
 * The work permit a foreign performer holds to be engaged in a country (src/person/permits/permits.json, compiled by
 * tools/papers/permits from the research, register facts papers.permits.<CC>): who applies, the government's fees,
 * how long a decision takes (standard, and premium where offered), the term it is granted for and whether it renews.
 * Who needs it, by what route, and the days a short engagement is worked without it are papers.work's: the researched
 * permit is the one papers.work names for every passport it doesn't name (`others`), and for each passport it names
 * by the same route.
 *
 * An application is made for an engagement booked there (an acting part booked, whose agreement's country is the
 * permit's), by the engager where the research says the employer applies; its fees are recorded, as the role engines
 * record pay, not paid into the ledger; its decision comes at the processing time. A permit is granted for its term
 * from the day of the decision, refused where the country's eligibility is a test the life's own records answer and
 * they don't meet it (the game's readings, papers.permits.model): the United States' O-1 (and its territories') a
 * distinction read from the parts played, the Turks and Caicos Islands' proficiency in English, Laos's age over 20.
 * Any other eligibility the research quotes isn't read, and the permit is granted.
 */

export type Unit = 'hours' | 'days' | 'business-days' | 'weeks' | 'months' | 'years';
export interface Span {
  readonly n: number;
  readonly unit: Unit;
}
export type By = 'engager' | 'worker';

/**
 * A fee the law sets on the worker's pay (Cameroon's contract visa): so many months of the gross pay, fewer for a
 * citizen of a country named (the African), less an abatement, in a currency.
 */
export interface Salary {
  readonly currency: CurrencyCode;
  readonly months: string;
  readonly monthsAfrican: string;
  readonly abatement: string;
  readonly african: readonly CountryCode[];
}

export interface Fee {
  readonly what: string;
  /** The amount; none where the law sets it on the worker's pay (`salary`). */
  readonly money: Money | null;
  readonly salary?: Salary;
  readonly premium: boolean;
  readonly when: 'grant' | 'renewal' | 'both';
}

/** A month of five-day weeks, in working days (52 weeks a year), as acting counts days worked: the game's own (papers.permits.model). */
// Five days a week (acting's WEEK_DAYS, which this module can't read as it loads: acting imports it) for 52 weeks.
export const MONTH_DAYS = { num: 260n, den: 12n } as const;

/**
 * What a fee comes to for an engagement: its amount, or, set on the pay, the part's pay for the days it works scaled to
 * a month, so many months of it by the worker's citizenship, less the abatement, in the fee's currency at the day's
 * rate (half to even); none where the part's agreement sets no pay or no rate is known that day.
 */
export function priced(f: Fee, p: Person, part: Part, date: string): Money | null {
  if (f.salary === undefined) return f.money;
  const earned = pay(part, date);
  const local = earned === null ? undefined : exchangeOn(earned, f.salary.currency, date)?.money;
  if (local === undefined) return null;
  const sal = f.salary;
  // @slate:consumer identity.make
  const months = rational(p.citizenship.some((c) => sal.african.includes(c)) ? sal.monthsAfrican : sal.months);
  const cut = rational(sal.abatement);
  const num = BigInt(local.minor) * MONTH_DAYS.num * months.num * (cut.den - cut.num);
  const den = MONTH_DAYS.den * BigInt(daysWorked(part)) * months.den * cut.den;
  return money(sal.currency, Number(roundHalfEven(num, den)));
}

export interface Permit {
  readonly by: By | null;
  readonly fees: readonly Fee[] | null;
  readonly standard: Span | null;
  readonly premium: Span | null;
  /** A span, or the engagement's own: the permit lasts as long as the engagement booked. */
  readonly term: Span | 'engagement' | null;
  readonly renews: boolean | null;
  /** A renewal's term, where the research gives one apart from the first grant's. */
  readonly renewal: Span | null;
  readonly union: string | null;
  readonly eligibility: string | null;
  readonly pay: string | null;
  /** What the research couldn't find, by the facts sought. */
  readonly unknown: readonly Field[];
}

export type Field = 'route' | 'applies' | 'first' | 'fees' | 'processing' | 'validity' | 'union' | 'eligibility' | 'pay' | 'exempt' | 'country' | 'all';

const PERMITS = (data as unknown as { countries: Record<string, Permit> }).countries;
const KEPT = (kept as unknown as { countries: Record<string, { passports: Record<string, { right: string }>; others: { right: string; route?: string } }> }).countries;
/** The countries every passport works in freely, by papers.work. */
const FREE = new Set(Object.keys(KEPT).filter((c) => { const k = KEPT[c] as (typeof KEPT)[string]; return [k.others, ...Object.values(k.passports)].every((r) => r.right === 'free'); }));

/** The permit the research gives a country; none where a passport needs none there, or it isn't known. */
export const permitOf = (country: CountryCode): Permit | undefined => PERMITS[country];

/** The line that tells the player what of a country's permit isn't known. */
export const UNKEPT_LINE = 'permits.unkept';
/** The line that tells the player which readings are the game's own (papers.permits.model). */
export const MODEL_LINE: LineId = 'permits.model';

/** Each fact sought, as the player is told it isn't known. */
export const MISSING: Readonly<Record<Field, string>> = {
  route: "the permit's name",
  applies: 'who applies',
  first: 'what must come first',
  fees: 'its fees',
  processing: 'how long a decision takes',
  validity: 'how long it is granted for',
  union: 'any union consultation',
  eligibility: 'who is eligible',
  pay: 'its pay rule',
  exempt: 'how long a short engagement may be worked without it',
  country: 'the permit itself',
  all: 'the permit itself',
};
const ALL: readonly Field[] = ['applies', 'first', 'fees', 'processing', 'validity', 'union', 'eligibility', 'pay', 'exempt'];

/** The line, naming what isn't known: "a, b and c". */
function untold(country: CountryCode, missing: readonly string[]): string {
  const words = [...new Set(missing)];
  const list = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1) as string}` : (words[0] as string);
  return t(UNKEPT_LINE, { country: countryName(country), missing: list });
}

/**
 * What the player is told of a country's permit where the research couldn't find all of it: the facts not found, or
 * every fact where none is known. Nothing where it is known whole, or no passport needs one there, or papers.work
 * doesn't keep the country (aboutWork tells that).
 */
export function aboutPermit(country: CountryCode): string | undefined {
  const permit = permitOf(country);
  if (permit === undefined) return keepsWork(country) && !FREE.has(country) ? untold(country, ALL.map((f) => MISSING[f])) : undefined;
  return permit.unknown.length > 0 ? untold(country, permit.unknown.map((f) => MISSING[f])) : undefined;
}

/** Granted until a moment, or (`until` null) for as long as its engagement, until it is played; or refused. */
export type Decision = { at: number; until: number | null } | { at: number; refused: string };

export interface Application {
  readonly id: number;
  readonly at: number;
  readonly country: CountryCode;
  /** The audition that booked the engagement it is for. */
  readonly audition: number;
  /** The application whose permit it renews; none for a first grant. */
  readonly renews: number | null;
  readonly by: By;
  readonly premium: boolean;
  /** The government's fees for it, as the research names them; none where they aren't known. */
  /** Each fee's amount is none where it is set on the pay and can't be reckoned. */
  readonly fees: { what: string; money: Money | null }[] | null;
  decided: Decision | null;
}

export interface PermitsSlice {
  applications: Application[];
}

export const PERMITS_START: PermitsSlice = { applications: [] };

/** The kind of the decision on an application, at its processing time. */
export const DECISION_KIND = 'permits.decision';

type Lives = { identity: IdentitySlice; acting: ActingSlice; permits: PermitsSlice };
type Test = (s: Pick<Lives, 'identity' | 'acting'>, now: number) => string | null;

const HOUR = 3600;

/**
 * A moment a span after another. A business day is Monday to Friday, less the country's holidays (world.holidays).
 * shortcut: the Gulf's Friday and Saturday weekend isn't read; when the holidays engine keeps each country's days of
 * rest, read them.
 */
export function after(now: number, span: Span, country: CountryCode): number {
  switch (span.unit) {
    case 'hours':
      return now + span.n * HOUR;
    case 'days':
      return now + span.n * SECONDS_PER_DAY;
    case 'weeks':
      return now + 7 * span.n * SECONDS_PER_DAY;
    case 'months':
      return addMonths('UTC', now, span.n);
    case 'years':
      return addMonths('UTC', now, 12 * span.n);
    case 'business-days': {
      let t = now;
      for (let left = span.n; left > 0; ) {
        t += SECONDS_PER_DAY;
        const day = Math.floor(t / SECONDS_PER_DAY);
        const weekday = weekdayFromDays(day);
        if (weekday !== 0 && weekday !== 6 && holidayOn(country, day) === undefined) left -= 1;
      }
      return t;
    }
  }
}

/** The O-1's distinction, the game's reading (papers.permits.model): the best part played 75 or better, and three parts played. */
export const RECOGNITION = { best: 75, parts: 3 } as const;
/** The Turks and Caicos Islands' proficiency in written and spoken English, the game's reading: C1 or better. */
export const PROFICIENT: Level = 'C1';
/** Laos's worker "more than 20 years old", the game's reading: from the twentieth birthday, in Vientiane's time. */
export const LAO_AGE = 20;

const recognised: Test = (s) => {
  // @slate:consumer acting.perform
  const parts = s.acting.auditions.filter((a) => a.work !== null).length;
  return credit(s.acting) >= RECOGNITION.best && parts >= RECOGNITION.parts ? null : 'the petition shows no distinction yet: the work recognised as substantially above the ordinary';
};

/** The eligibility a country's permit asks that the life's own records answer. */
export const ELIGIBILITY: Readonly<Partial<Record<CountryCode, Test>>> = {
  US: recognised,
  GU: recognised,
  MP: recognised,
  PR: recognised,
  VI: recognised,
  // @slate:consumer identity.make
  TC: (s) => (speaks(personOf(s.identity), 'en', PROFICIENT) ? null : `the permit asks proficiency in written and spoken English (${PROFICIENT} or better)`),
  // @slate:consumer identity.make
  LA: (s, now) => (ageOf(personOf(s.identity), now, 'Asia/Vientiane') >= LAO_AGE ? null : `the permit asks a worker more than ${LAO_AGE} years old`),
};

/** The permit a person may apply for in a country: refused where they need none, or the permit their passport takes isn't known well enough. */
export function permitFor(s: Pick<Lives, 'identity'>, country: CountryCode, premium: boolean): Permit {
  if (!keepsWork(country)) throw new Error(aboutWork(country));
  const p = personOf(s.identity);
  if (mayWorkIn(p, country)) throw new Error(`you need no permit to work in ${country}`);
  const permit = permitOf(country);
  if (permit === undefined) throw new Error(aboutPermit(country));
  const route = (KEPT[country] as { others: { route?: string } }).others.route;
  // @slate:consumer identity.make
  if (!p.citizenship.some((c) => (work(c, country) as Work).route === route)) throw new Error(`the permit your passport takes in ${country} isn't known`);
  const missing = [
    permit.by === null ? MISSING.applies : '',
    (premium ? permit.premium : permit.standard) === null ? (premium ? 'how long a premium decision takes' : MISSING.processing) : '',
    permit.term === null ? MISSING.validity : '',
  ].filter((m) => m !== '');
  if (missing.length > 0) throw new Error(untold(country, missing));
  return permit;
}

/**
 * Lodges an application: its fees recorded, its decision scheduled at the processing time. A renewal's fees are those
 * the research names for a renewal. shortcut: where the research lists several premium
 * services (the UK's priority and super priority), the first is taken as the premium processing's.
 */
function lodge(s: Lives, c: Context, country: CountryCode, audition: number, renews: number | null, premium: boolean, permit: Permit): void {
  const id = s.permits.applications.length + 1;
  const when = renews === null ? 'grant' : 'renewal';
  // @slate:consumer acting.audition
  const part = auditionOf(s.acting, audition).part;
  const price = (f: Fee) => priced(f, personOf(s.identity), part, dateOf(c.now));
  const fees = permit.fees === null ? null : chosen(permit.fees, when, premium, price);
  s.permits.applications.push({ id, at: c.now, country, audition, renews, by: permit.by as By, premium, fees, decided: null });
  c.schedule(DECISION_KIND, after(c.now, (premium ? permit.premium : permit.standard) as Span, country), { application: id });
}

/** The fees asked at a grant or a renewal, the premium service's first beside them; none known where the research names none for it. */
function chosen(all: readonly Fee[], when: 'grant' | 'renewal', premium: boolean, price: (f: Fee) => Money | null): { what: string; money: Money | null }[] | null {
  const asked = all.filter((f) => !f.premium && (f.when === when || f.when === 'both'));
  if (asked.length === 0) return null;
  return [...asked, ...(premium ? all.filter((f) => f.premium).slice(0, 1) : [])].map((f) => ({ what: f.what, money: price(f) }));
}

/** Whether a permit applied for is pending or granted and in force: another isn't applied for beside it. */
const live = (a: Application, s: ActingSlice, now: number) => a.decided === null || inForce(a, s, now);

/** Whether a permit granted is in force: before its term ends, or, for one granted for its engagement, until that is played. */
function inForce(a: Application, s: ActingSlice, now: number): boolean {
  if (a.decided === null || !('until' in a.decided)) return false;
  // @slate:consumer acting.perform
  return a.decided.until === null ? auditionOf(s, a.audition).work === null : now < a.decided.until;
}

export interface ApplyArgs {
  [key: string]: number | boolean;
  audition: number;
  premium: boolean;
}

/** Applies for the permit an engagement booked abroad needs. */
function apply(s: Lives, a: ApplyArgs, c: Context): void {
  // @slate:consumer acting.audition
  const job = auditionOf(s.acting, a.audition);
  if (!job.booked) throw new Error(`audition ${a.audition} didn't book a part`);
  if (job.work !== null) throw new Error(`the part from audition ${a.audition} is played`);
  const country = COUNTRY[job.part.agreement];
  const permit = permitFor(s, country, a.premium);
  if (s.permits.applications.some((x) => x.audition === job.id && x.renews === null && live(x, s.acting, c.now))) throw new Error(`a permit is applied for already for audition ${job.id}`);
  lodge(s, c, country, job.id, null, a.premium, permit);
}

export interface RenewArgs {
  [key: string]: number | boolean;
  application: number;
  premium: boolean;
}

/** Renews a permit in force, where the research says it renews. */
function renew(s: Lives, a: RenewArgs, c: Context): void {
  const held = s.permits.applications.find((x) => x.id === a.application);
  if (held === undefined) throw new Error(`there's no application ${a.application}`);
  if (held.decided === null || !('until' in held.decided)) throw new Error(`application ${a.application} wasn't granted`);
  if (!inForce(held, s.acting, c.now)) throw new Error(`the permit from application ${a.application} has lapsed`);
  const permit = permitFor(s, held.country, a.premium);
  if (permit.renews === false) throw new Error(`${held.country}'s permit doesn't renew`);
  if (permit.renews === null) throw new Error(untold(held.country, ['whether it renews']));
  if (s.permits.applications.some((x) => x.renews === held.id && live(x, s.acting, c.now))) throw new Error(`the permit from application ${held.id} is renewed already`);
  lodge(s, c, held.country, held.audition, held.id, a.premium, permit);
}

/** The decision on an application: granted for the term from that day, or refused by the eligibility the life's records answer. */
function decide(s: Lives, item: Item, c: Context): void {
  // @slate:consumer permits.apply
  // @slate:consumer permits.renew
  const app = s.permits.applications.find((x) => x.id === (item.data as { application: number }).application) as Application;
  const why = ELIGIBILITY[app.country]?.(s, c.now) ?? null;
  const permit = permitOf(app.country) as Permit;
  // A renewal is for the renewal's term where the research gives one apart; the first grant's otherwise.
  const term = (app.renews === null ? permit.term : (permit.renewal ?? permit.term)) as Span | 'engagement';
  app.decided = why === null ? { at: c.now, until: term === 'engagement' ? null : after(c.now, term, app.country) } : { at: c.now, refused: why };
}

/** The days worked in a country within a period before now, by the parts played there. */
export function daysWorkedIn(s: ActingSlice, country: CountryCode, now: number, within: number): number {
  // @slate:consumer acting.perform
  const there = s.auditions.filter((a) => a.work !== null && COUNTRY[a.part.agreement] === country && a.work.at > now - within * SECONDS_PER_DAY);
  return there.reduce((t, a) => t + daysWorked(a.part), 0);
}

/**
 * Whether a short engagement's days are the person's: from the day the law gives them, and for whom it gives them. An
 * artist of renown is read as the O-1's distinction is (papers.permits.model); no engagement the game books is engaged
 * from abroad (each agreement is the country's own producers'), so days for that work are no one's here.
 */
function shortEngagement(s: Pick<Lives, 'acting'>, w: Work, now: number): boolean {
  if (w.from !== undefined && dateOf(now) < w.from) return false;
  if (w.only === 'engaged-abroad') return false;
  return w.only === undefined || recognised(s as Pick<Lives, 'identity' | 'acting'>, now) === null;
}

/**
 * Whether the person may work in a country, for an engagement of so many days: by a citizenship (their own country,
 * or free movement, papers.work), by a permit granted and in force on the day, or because the engagement, with the
 * days worked there in the period the law counts, is within the days papers.work lets a short engagement be worked
 * without one. shortcut: a permit is read as the person's to work there, whoever engaged them; most are the engager's.
 */
export function permitted(s: Lives, country: CountryCode, now: number, days: number): boolean {
  const p = personOf(s.identity);
  if (mayWorkIn(p, country)) return true;
  // @slate:consumer permits.decision
  if (s.permits.applications.some((a) => a.country === country && inForce(a, s.acting, now))) return true;
  // @slate:consumer identity.make
  return p.citizenship.some((c) => {
    const w = work(c, country) as Work | undefined;
    if (w?.days === undefined || !shortEngagement(s, w, now)) return false;
    // Where the law counts no period, the engagement is counted alone. No engagement can be booked yet where the law
    // counts one (acting's agreements are the US's, the UK's and Canada's, none of which does), so the days there are
    // none either way; daysWorkedIn's own test holds the counting.
    // Stryker disable next-line ConditionalExpression,EqualityOperator: as said.
    return (w.within === undefined ? 0 : daysWorkedIn(s.acting, country, now, w.within)) + days <= w.days;
  });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const applyForPermit = defineCommand<Lives, ApplyArgs>({ id: 'permits.apply', reads: ['identity', 'acting'], writes: ['permits', 'schedule'], run: apply });
export const renewPermit = defineCommand<Lives, RenewArgs>({ id: 'permits.renew', reads: ['identity', 'acting'], writes: ['permits', 'schedule'], run: renew });
export const decision = defineKind<Lives>({ kind: DECISION_KIND, wants: false, reads: ['identity', 'acting'], writes: ['permits'], happen: decide });
