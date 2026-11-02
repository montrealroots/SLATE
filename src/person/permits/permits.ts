import { defineCommand, defineKind, type Context, type Item } from '../../core/frame/frame.ts';
import { money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { payCost, type Holding } from '../../money/accounts/accounts.ts';
import { exchangeOn } from '../../money/rates/rates.ts';
import { SECONDS_PER_DAY, weekdayFromDays } from '../../core/time/calendar.ts';
import { addMonths } from '../../core/time/dates.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { holidayOn } from '../../world/holidays/holidays.ts';
import { auditionOf, COUNTRY, credit, dateOf, daysWorked, pay, type ActingSlice } from '../acting/acting.ts';
import { engagement, filmOf, type DirectingSlice } from '../directing/directing.ts';
import { engagementOf, projectOf, type ProducingSlice } from '../producing/producing.ts';
import { aboutVisits, keepsVisits, visit } from '../../papers/visits/visits.ts';
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
 * permit's), by the engager where the research says the employer applies; its fees are recorded, and paid from the
 * account the person names where the worker applies (the engager pays its own); its decision comes at the processing
 * time. A permit is granted for its term
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
 * What a fee comes to for an engagement: its amount, or, set on the pay, the engagement's pay for the days it works
 * scaled to a month, so many months of it by the worker's citizenship, less the abatement, in the fee's currency at the
 * day's rate (half to even); none where the engagement sets no pay or no rate is known that day.
 */
export function priced(f: Fee, p: Person, job: Pick<Engagement, 'days' | 'earned'>, date: string): Money | null {
  if (f.salary === undefined) return f.money;
  const earned = job.earned(date);
  const local = earned === null ? undefined : exchangeOn(earned, f.salary.currency, date)?.money;
  if (local === undefined) return null;
  const sal = f.salary;
  // @slate:consumer identity.make
  const months = rational(p.citizenship.some((c) => sal.african.includes(c)) ? sal.monthsAfrican : sal.months);
  const cut = rational(sal.abatement);
  const num = BigInt(local.minor) * MONTH_DAYS.num * months.num * (cut.den - cut.num);
  const den = MONTH_DAYS.den * BigInt(job.days) * months.den * cut.den;
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
  /** The role the engagement is in, and its id in that role's engine: an audition booked, a film prepped, a project planned. */
  readonly role: Role;
  readonly engagement: number;
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

type Lives = { identity: IdentitySlice; acting: ActingSlice; directing: DirectingSlice; producing: ProducingSlice; permits: PermitsSlice };
type Work3 = Pick<Lives, 'acting' | 'directing' | 'producing'>;

/** The roles whose work abroad takes a permit: a writer's sale is a meeting, a visit (mayVisit). */
export const ROLES = ['actor', 'director', 'producer'] as const;
export type Role = (typeof ROLES)[number];
// Every rule the research names whom it covers covers an actor (COVERS), so only the other roles are ever told apart.
const A_ROLE: Readonly<Record<Exclude<Role, 'actor'>, string>> = { director: 'a director', producer: 'a producer' };

/**
 * Whom a country's rule covers, where the research names them (the game's reading of its words, papers.permits.model):
 * the right to work freely, or the permit's route; every role elsewhere. Kazakhstan's freedom is for artists and
 * directors (Decree 1041, item 11); Armenia's for performers on tour (Law On Foreigners, art. 23(1)(4)); Japan's
 * Entertainer status is a performer's (directors and screenwriters not performing take other statuses); Sweden's
 * artist permit names singers, musicians, dancers, actors and directors; Egypt's syndicate permit is for actors and
 * directors (acting and cinema).
 */
export const COVERS: Readonly<Partial<Record<CountryCode, { readonly free?: readonly Role[]; readonly permit?: readonly Role[] }>>> = {
  KZ: { free: ['actor', 'director'] },
  AM: { free: ['actor'] },
  JP: { permit: ['actor'] },
  SE: { permit: ['actor', 'director'] },
  EG: { permit: ['actor', 'director'] },
};
const covers = (country: CountryCode, which: 'free' | 'permit', role: Role) => COVERS[country]?.[which]?.includes(role) ?? true;

/** Whether a citizenship lets the person work in a country in a role: their own, or a freedom that covers the role. */
function freeIn(p: Person, country: CountryCode, role: Role): boolean {
  if (!mayWorkIn(p, country)) return false;
  // @slate:consumer identity.make
  return p.citizenship.some((c) => work(c, country) === 'home') || covers(country, 'free', role);
}

/** An engagement, in whichever role: where it is, the days it works there, whether it is done, and its pay. */
export interface Engagement {
  readonly country: CountryCode;
  readonly days: number;
  readonly done: boolean;
  readonly earned: (date: string) => Money | null;
}

/** The engagement an application is for: an audition that booked a part, a film prepped, a project planned. */
export function engagedIn(s: Work3, role: Role, id: number): Engagement {
  switch (role) {
    case 'actor': {
      // @slate:consumer acting.audition
      const job = auditionOf(s.acting, id);
      if (!job.booked) throw new Error(`audition ${id} didn't book a part`);
      // @slate:consumer acting.perform
      return { country: COUNTRY[job.part.agreement], days: daysWorked(job.part), done: job.work !== null, earned: (date) => pay(job.part, date) };
    }
    case 'director': {
      // @slate:consumer directing.prep
      const film = filmOf(s.directing, id);
      const e = engagement(film);
      // @slate:consumer directing.cut
      return { country: e.country as CountryCode, days: e.days, done: film.cut !== null, earned: () => film.fee };
    }
    case 'producer': {
      // @slate:consumer producing.plan
      const project = projectOf(s.producing, id);
      const e = engagementOf(project);
      // @slate:consumer producing.shoot
      return { ...e, done: project.shot !== null, earned: () => (project.plan as { fee: Money | null }).fee };
    }
    default:
      throw new Error(`there's no role ${String(role)} a permit is applied for in`);
  }
}

/**
 * Whether a visit for a meeting is open to the person: their own country, or entry their passport is given without a
 * visa applied for beforehand (free, an electronic authorisation, an e-visa, a visa on arrival; papers.visits).
 * shortcut: the game holds no visitor visa applied for at a consulate, so a passport that needs one can't visit.
 */
export function mayVisit(p: Person, country: CountryCode): boolean {
  // @slate:consumer identity.make
  return p.citizenship.some((c) => {
    const v = visit(c, country);
    // At home there is no entry to ask, so never a visa.
    return v !== undefined && (v as { entry?: string }).entry !== 'visa';
  });
}

/** Why the person can't visit a country for a meeting: its list not kept, or a visa their passports need beforehand. */
export const whyNoVisit = (country: CountryCode): string => (keepsVisits(country) ? `a visit to ${country} takes a visa applied for beforehand, which the game doesn't hold` : (aboutVisits(country) as string));
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
export function permitFor(s: Pick<Lives, 'identity'>, country: CountryCode, premium: boolean, role: Role): Permit {
  if (!keepsWork(country)) throw new Error(aboutWork(country));
  const p = personOf(s.identity);
  if (freeIn(p, country, role)) throw new Error(`you need no permit to work in ${country}`);
  const permit = permitOf(country);
  const theirs = `the permit ${A_ROLE[role as Exclude<Role, 'actor'>]} takes`;
  if (permit === undefined) throw new Error(aboutPermit(country) ?? untold(country, [theirs]));
  if (!covers(country, 'permit', role)) throw new Error(untold(country, [theirs]));
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
function lodge(s: Lives & Holding, c: Context, country: CountryCode, role: Role, engaged: number, renews: number | null, premium: boolean, permit: Permit, account: string): void {
  const id = s.permits.applications.length + 1;
  const when = renews === null ? 'grant' : 'renewal';
  const job = engagedIn(s, role, engaged);
  const price = (f: Fee) => priced(f, personOf(s.identity), job, dateOf(c.now));
  const fees = permit.fees === null ? null : chosen(permit.fees, when, premium, price);
  // The worker pays the fees they apply with, but those the research names as the employer's or the sponsor's; an
  // engager's application is the engager's to pay.
  // Stryker disable next-line ConditionalExpression: the one fee priced on the pay today (Cameroon's, where nothing known can come of it) is in an engager's application.
  if (permit.by === 'worker') for (const f of fees ?? []) if (f.money !== null && !ENGAGERS.test(f.what)) payCost(s, account, `government:${country}`, f.money, f.what, c.now);
  s.permits.applications.push({ id, at: c.now, country, role, engagement: engaged, renews, by: permit.by as By, premium, fees, decided: null });
  c.schedule(DECISION_KIND, after(c.now, (premium ? permit.premium : permit.standard) as Span, country), { application: id });
}

/** A fee the research names as the employer's or the sponsor's to pay (the UK's certificate of sponsorship, Spain's tasa 3.2.1). */
export const ENGAGERS = /\bpaid (?:in advance )?by the (?:employer|sponsor)\b|^Employer/i;

/** The fees asked at a grant or a renewal, the premium service's first beside them; none known where the research names none for it. */
function chosen(all: readonly Fee[], when: 'grant' | 'renewal', premium: boolean, price: (f: Fee) => Money | null): { what: string; money: Money | null }[] | null {
  const asked = all.filter((f) => !f.premium && (f.when === when || f.when === 'both'));
  if (asked.length === 0) return null;
  return [...asked, ...(premium ? all.filter((f) => f.premium).slice(0, 1) : [])].map((f) => ({ what: f.what, money: price(f) }));
}

/** Whether a permit applied for is pending or granted and in force: another isn't applied for beside it. */
const live = (a: Application, s: Work3, now: number) => a.decided === null || inForce(a, s, now);

/** Whether a permit granted is in force: before its term ends, or, for one granted for its engagement, until that is played. */
function inForce(a: Application, s: Work3, now: number): boolean {
  if (a.decided === null || !('until' in a.decided)) return false;
  return a.decided.until === null ? !engagedIn(s, a.role, a.engagement).done : now < a.decided.until;
}

export interface ApplyArgs {
  [key: string]: number | boolean | string;
  /** The role the engagement is in: an actor's audition booked, a director's film prepped, a producer's project planned. */
  role: string;
  engagement: number;
  premium: boolean;
  /** The account the fees are paid from, where the worker applies. */
  account: string;
}

const DONE: Readonly<Record<Role, string>> = { actor: 'the part from audition {id} is played', director: 'film {id} is cut', producer: 'project {id} is shot' };

/** Applies for the permit an engagement abroad needs, in its own country, as the research says who applies. */
function apply(s: Lives & Holding, a: ApplyArgs, c: Context): void {
  const role = a.role as Role;
  const job = engagedIn(s, role, a.engagement);
  if (job.done) throw new Error(DONE[role].replace('{id}', String(a.engagement)));
  const permit = permitFor(s, job.country, a.premium, role);
  const same = (x: Application) => x.role === role && x.engagement === a.engagement && x.renews === null;
  if (s.permits.applications.some((x) => same(x) && live(x, s, c.now))) throw new Error(`a permit is applied for already for that engagement`);
  lodge(s, c, job.country, role, a.engagement, null, a.premium, permit, a.account);
}

export interface RenewArgs {
  [key: string]: number | boolean | string;
  application: number;
  premium: boolean;
  /** The account the fees are paid from, where the worker applies. */
  account: string;
}

/** Renews a permit in force, where the research says it renews. */
function renew(s: Lives & Holding, a: RenewArgs, c: Context): void {
  const held = s.permits.applications.find((x) => x.id === a.application);
  if (held === undefined) throw new Error(`there's no application ${a.application}`);
  if (held.decided === null || !('until' in held.decided)) throw new Error(`application ${a.application} wasn't granted`);
  if (!inForce(held, s, c.now)) throw new Error(`the permit from application ${a.application} has lapsed`);
  const permit = permitFor(s, held.country, a.premium, held.role);
  if (permit.renews === false) throw new Error(`${held.country}'s permit doesn't renew`);
  if (permit.renews === null) throw new Error(untold(held.country, ['whether it renews']));
  if (s.permits.applications.some((x) => x.renews === held.id && live(x, s, c.now))) throw new Error(`the permit from application ${held.id} is renewed already`);
  lodge(s, c, held.country, held.role, held.engagement, held.id, a.premium, permit, a.account);
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

/**
 * The days worked in a country within a period before now: the parts played there, the films made there (from the day
 * prep began, all their days), the projects shot there. shortcut: a film's days are counted on the day its prep began.
 */
export function daysWorkedIn(s: Work3, country: CountryCode, now: number, within: number): number {
  const since = now - within * SECONDS_PER_DAY;
  // @slate:consumer acting.perform
  const parts = s.acting.auditions.filter((a) => a.work !== null && COUNTRY[a.part.agreement] === country && a.work.at > since).map((a) => daysWorked(a.part));
  // @slate:consumer directing.prep
  const films = s.directing.films.filter((f) => f.country === country && f.started > since).map((f) => engagement(f).days);
  // @slate:consumer producing.shoot
  const shot = s.producing.projects.filter((p) => p.shot !== null && p.market === country && p.shot.at > since).map((p) => (p.shot as { days: number }).days);
  return [...parts, ...films, ...shot].reduce((t, d) => t + d, 0);
}

/**
 * Whether a short engagement's days are the person's: from the day the law gives them, and for whom it gives them. An
 * artist of renown is read as the O-1's distinction is (papers.permits.model); no engagement the game books is engaged
 * from abroad (each agreement is the country's own producers'), so days for that work are no one's here.
 */
function shortEngagement(s: Pick<Lives, 'acting'>, w: Work, now: number): boolean {
  // Stryker disable next-line ConditionalExpression: a day is never before no day, so the guard says plainly what the comparison does.
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
export function permitted(s: Lives, country: CountryCode, now: number, days: number, role: Role = 'actor'): boolean {
  const p = personOf(s.identity);
  if (freeIn(p, country, role)) return true;
  // @slate:consumer permits.decision
  if (s.permits.applications.some((a) => a.country === country && inForce(a, s, now))) return true;
  // @slate:consumer identity.make
  return p.citizenship.some((c) => {
    const w = work(c, country) as Work | undefined;
    if (w?.days === undefined || !shortEngagement(s, w, now)) return false;
    // Where the law counts no period (the UK), the engagement is counted alone; where it counts one (Germany's 90 days
    // in a year, the Netherlands' 42 in 91, Norway's and Sweden's 14 in a year), the days worked there within it too.
    // Stryker disable next-line ConditionalExpression: with no period, the window's start is NaN and no day falls after it, so the count is 0 either way; the guard says so plainly.
    return (w.within === undefined ? 0 : daysWorkedIn(s, country, now, w.within)) + days <= w.days;
  });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const applyForPermit = defineCommand<Lives & Holding, ApplyArgs>({ id: 'permits.apply', reads: ['identity', 'acting', 'directing', 'producing'], writes: ['permits', 'schedule', 'accounts', 'ledger'], run: apply });
export const renewPermit = defineCommand<Lives & Holding, RenewArgs>({ id: 'permits.renew', reads: ['identity', 'acting', 'directing', 'producing'], writes: ['permits', 'schedule', 'accounts', 'ledger'], run: renew });
export const decision = defineKind<Lives>({ kind: DECISION_KIND, wants: false, reads: ['identity', 'acting'], writes: ['permits'], happen: decide });
