import { defineCommand, type Context } from '../../core/frame/frame.ts';
import { fromMajor, multiply, type Money } from '../../core/money/money.ts';
import { SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { exchangeOn } from '../../money/rates/rates.ts';
import { work } from '../../papers/work/work.ts';
import type { CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { dateOf, SAG_TIERS, type ActingSlice, type Agreement, type Part, type Work } from '../acting/acting.ts';
import type { DirectingSlice } from '../directing/directing.ts';
import { ageOf, personOf, type IdentitySlice, type Person } from '../identity/identity.ts';
import type { CareerSlice } from '../work/career.ts';
import { scriptOf, type Form, type ScriptsSlice } from '../work/work.ts';
import type { LineId } from '../../core/text/text.ts';

/**
 * The unions and guilds a person can join, and what membership changes (BUILD-ORDER layer 4; R-4621, read 2026-11-01).
 * Each union is joined by its own route, read from the life's own work where the engines record it: the parts played
 * (src/person/acting), the scripts sold (src/person/work/career.ts), the films directed (src/person/directing). Its
 * initiation fee and yearly dues are recorded on the card, as the role engines record pay, not paid into the ledger.
 *
 * - SAG-AFTRA: one day as a principal on a SAG-AFTRA film above the Ultra Low Budget tier (Ultra Low Budget, Student
 *   and Short Films don't count), or a paid-up year in ACTRA and a part played under ACTRA; $3,121, $246.14 a year.
 * - Equity (UK): £750 earned from the work, or a part on an Equity contract (Pact/Equity, UK Theatre/Equity); no joining
 *   fee named; the 2026 subscription by the average of the three tax years before, half for the subsidised ages.
 * - ACTRA: a Canadian citizen's three parts on ACTRA permits for Full membership ($1,600, $195 a year), one for an
 *   Apprentice's ($75).
 * - Canadian Actors' Equity: three years' paid professional experience (the game's reading: a part first played three
 *   years before); $1,200, $200 a year ($212 from 1 May 2028).
 * - Actors' Equity Association: a year in SAG-AFTRA, its sibling union, and a part played under it; $1,800, $176 a year.
 * - The WGA West: 24 units of sales to signatories in the three years before, for Current ($2,500); fewer for
 *   Associate ($100 a year); dues of $25 a quarter.
 * - The DGA: employment by a signatory, a film or an episode directed; $15,703 for a feature or television, $5,000 for a
 *   low-budget feature ($11 million or less); dues of $50 a quarter.
 *
 * The card carries the name the person goes by. What else membership changes is exported for the role engines:
 * whether a SAG-AFTRA part may be taken (its union security, after the Taft-Hartley days), and whether the person's
 * citizenship lets them work in a country (through papers.work; papers.permits' `permitted` adds a permit held and a
 * short engagement's days).
 */

/** The line that tells the player these figures are the game's own (person.unions.model). */
export const MODEL_LINE: LineId = 'unions.model';

export type Union = 'sag-aftra' | 'equity-uk' | 'actra' | 'caea' | 'aea' | 'wga-west' | 'dga';

/** Full membership, or the lesser one a union offers: the WGA's Associate, ACTRA's Apprentice. */
export type Standing = 'full' | 'associate' | 'apprentice';

export interface Membership {
  readonly union: Union;
  readonly at: number;
  readonly standing: Standing;
  /** The name on the card: the one the person goes by. */
  readonly name: string;
  /** What joining costs (an Apprentice's administration fee); none where the union names none. */
  readonly initiation: Money | null;
  /** The yearly dues at joining, before any on earnings; none where the union names none. */
  readonly dues: Money | null;
}

export interface UnionsSlice {
  /** Every card taken, in order; an Associate or an Apprentice who goes Full takes a new one. */
  joined: Membership[];
}

export const UNIONS_START: UnionsSlice = { joined: [] };

// A mutant of a currency or an amount below throws as the module loads, which Stryker 10.0.0 reports as surviving
// (HANDOFF, blockers; as career.ts's FEES); the tests hold each figure to the cent.
// Stryker disable next-line StringLiteral: as said.
const usd = (n: string) => fromMajor('USD', n);
// Stryker disable next-line StringLiteral: as said.
const cad = (n: string) => fromMajor('CAD', n);
// Stryker disable next-line StringLiteral: as said.
const gbp = (n: string) => fromMajor('GBP', n);

/** SAG-AFTRA's national initiation fee and yearly base dues (R-4621). */
export const SAG_AFTRA = { initiation: usd('3121'), dues: usd('246.14') } as const;
/** ACTRA's Full membership (initiation, basic dues) and an Apprentice's administration fee, by the parts on permits each needs. */
export const ACTRA_FULL = { initiation: cad('1600'), dues: cad('195'), permits: 3 } as const;
export const ACTRA_APPRENTICE = { initiation: cad('75'), dues: null, permits: 1 } as const;
/** Canadian Actors' Equity: the initiation fee, basic dues and their rise on 1 May 2028, and the years of experience. */
export const CAEA = { initiation: cad('1200'), dues: cad('200'), raised: cad('212'), from: '2028-05-01', years: 3 } as const;
/** Actors' Equity Association: the initiation fee and basic dues. */
export const AEA = { initiation: usd('1800'), dues: usd('176') } as const;
/** The WGA West: Current's initiation fee and units, Associate's yearly fee, a Current member's quarterly dues four times over, the years units count. */
export const WGA = { initiation: usd('2500'), units: 24, associate: usd('100'), dues: usd('100'), years: 3 } as const;
/** The units a sale to a signatory earns, by the form sold (the WGA West's chart): a feature screenplay 24; a teleplay of 30 to 60 minutes 8 (pilot, episode). */
export const UNITS: Readonly<Record<Exclude<Form, 'short'>, number>> = { feature: 24, pilot: 8, episode: 8 };
/** The DGA, July 2026 to June 2027: a director's initiation fee, feature or television and low-budget feature, its ceiling, and $50 a quarter. */
export const DGA = { initiation: usd('15703'), low: usd('5000'), ceiling: 11_000_000, dues: usd('200') } as const;
/** Equity (UK): the earnings that open it (pence), its contracts, the subsidised ages and its income ceiling (pence). */
export const EQUITY_UK = { earned: 75_000, contracts: ['pact-equity', 'uk-theatre'] as readonly Agreement[], young: [10, 17], old: 66, ceiling: 4_000_000 } as const;
/** Equity (UK)'s 2026 full subscription by gross annual income, each band up to its ceiling in pence. */
export const EQUITY_BANDS: readonly (readonly [upTo: number, fee: Money])[] = [
  // Stryker disable next-line StringLiteral: as above.
  [4_000_000, gbp('198')],
  // Stryker disable next-line StringLiteral: as above.
  [8_000_000, gbp('396')],
  // Stryker disable next-line StringLiteral: as above.
  [12_000_000, gbp('792')],
  // Stryker disable next-line StringLiteral: as above.
  [24_000_000, gbp('1584')],
  // Stryker disable next-line StringLiteral: as above.
  [Infinity, gbp('3840')],
];
/** SAG-AFTRA's union security: membership may be required from the thirtieth day after the first job. */
export const TAFT_HARTLEY_DAYS = 30;

type Lives = { identity: IdentitySlice; acting: ActingSlice; career: CareerSlice; scripts: ScriptsSlice; directing: DirectingSlice; unions: UnionsSlice };

/** The latest card a union gave, if any. */
export const memberOf = (s: UnionsSlice, union: Union): Membership | undefined => s.joined.findLast((m) => m.union === union);

/** A date some years on (or back), as the tables write it. */
const yearsOn = (date: string, by: number) => `${Number(date.slice(0, 4)) + by}${date.slice(4)}`;

/** The parts played, each with its work. */
function played(s: ActingSlice): { part: Part; work: Work }[] {
  // @slate:consumer acting.perform
  return s.auditions.flatMap((a) => (a.work === null ? [] : [{ part: a.part, work: a.work }]));
}

/** Whether a sibling union has had the person a paid-up Full member a year, and they've played a part under its agreement. */
function siblingYear(s: Pick<Lives, 'acting' | 'unions'>, union: 'actra' | 'sag-aftra', today: string): boolean {
  // @slate:consumer unions.join
  const m = memberOf(s.unions, union);
  return m !== undefined && m.standing === 'full' && today >= yearsOn(dateOf(m.at), 1) && played(s.acting).some((w) => w.part.agreement === union);
}

/** Everything the work has paid, in pence, by the day: each in pounds as estimated that day (none where no rate is known). */
function earnedInPounds(s: Lives): { date: string; pence: number }[] {
  // @slate:consumer script.pitch
  const sold = Object.values(s.career.out).flatMap((o) => (o.sold === null ? [] : [{ at: o.sold.at, pay: o.sold.fee }]));
  // @slate:consumer directing.prep
  const directed = s.directing.films.map((f) => ({ at: f.started, pay: f.fee }));
  return [...played(s.acting).map((w) => w.work), ...sold, ...directed].flatMap(({ at, pay }) => {
    const date = dateOf(at);
    const pounds = pay === null || pay.currency === 'GBP' ? pay : exchangeOn(pay, 'GBP', date)?.money;
    return pounds === null || pounds === undefined ? [] : [{ date, pence: pounds.minor }];
  });
}

/** Equity (UK)'s subscription: the band of the average income of the three tax years (from 6 April) before this one, half for the subsidised. */
function subscription(p: Person, earned: readonly { date: string; pence: number }[], now: number): Money {
  const today = dateOf(now);
  const year = Number(today.slice(0, 4));
  const start = `${today >= `${year}-04-06` ? year : year - 1}-04-06`;
  const three = earned.filter((e) => e.date >= yearsOn(start, -3) && e.date < start).reduce((t, e) => t + e.pence, 0);
  const fee = (EQUITY_BANDS.find(([upTo]) => three <= 3 * upTo) as (typeof EQUITY_BANDS)[number])[1];
  // @slate:consumer identity.make
  const age = ageOf(p, now, 'Europe/London');
  const subsidised = ((age >= EQUITY_UK.young[0] && age <= EQUITY_UK.young[1]) || age >= EQUITY_UK.old) && three < 3 * EQUITY_UK.ceiling;
  return subsidised ? multiply(fee, '0.5') : fee;
}

interface Terms {
  standing: Standing;
  initiation: Money | null;
  dues: Money | null;
}

/** What a union offers the person now, by its own route; refused, saying what it asks, where the life doesn't meet it. */
export function terms(s: Lives, union: Union, now: number): Terms {
  const p = personOf(s.identity);
  const today = dateOf(now);
  const parts = played(s.acting);
  switch (union) {
    case 'sag-aftra':
      if (!parts.some((w) => w.part.agreement === 'sag-aftra' && w.part.budget > SAG_TIERS.ultra) && !siblingYear(s, 'actra', today))
        throw new Error('SAG-AFTRA asks a principal day on a SAG-AFTRA film above Ultra Low Budget, or a year in ACTRA and a part under it');
      return { standing: 'full', ...SAG_AFTRA };
    case 'equity-uk': {
      const earned = earnedInPounds(s);
      if (!parts.some((w) => EQUITY_UK.contracts.includes(w.part.agreement)) && earned.reduce((t, e) => t + e.pence, 0) < EQUITY_UK.earned)
        throw new Error('Equity asks £750 earned from the work, or a part on an Equity contract');
      // @slate:consumer identity.make
      const words = p.preferred.split(' ');
      if ([words[0], words.at(-1)].some((w) => /^\p{L}\.?$/u.test(w as string))) throw new Error('an Equity name may not be a single initial');
      return { standing: 'full', initiation: null, dues: subscription(p, earned, now) };
    }
    case 'actra': {
      // @slate:consumer identity.make
      if (!p.citizenship.includes('CA')) throw new Error('ACTRA membership is for Canadian citizens and permanent residents');
      const permits = parts.filter((w) => w.part.agreement === 'actra').length;
      if (permits >= ACTRA_FULL.permits) return { standing: 'full', initiation: ACTRA_FULL.initiation, dues: ACTRA_FULL.dues };
      if (permits >= ACTRA_APPRENTICE.permits) return { standing: 'apprentice', initiation: ACTRA_APPRENTICE.initiation, dues: ACTRA_APPRENTICE.dues };
      throw new Error('ACTRA asks a part played on an ACTRA permit');
    }
    case 'caea': {
      const since = yearsOn(today, -CAEA.years);
      if (!parts.some((w) => dateOf(w.work.at) <= since)) throw new Error("Canadian Actors' Equity asks three years' paid professional experience");
      return { standing: 'full', initiation: CAEA.initiation, dues: today >= CAEA.from ? CAEA.raised : CAEA.dues };
    }
    case 'aea':
      if (!siblingYear(s, 'sag-aftra', today)) throw new Error("Actors' Equity asks a year in SAG-AFTRA and a part under it");
      return { standing: 'full', ...AEA };
    case 'wga-west': {
      const since = yearsOn(today, -WGA.years);
      let units = 0;
      // @slate:consumer script.pitch
      for (const [id, o] of Object.entries(s.career.out)) {
        // Only a sale under the WGA's own terms is to a signatory: one offered in another market (career's `offered`) isn't.
        if (o.sold !== null && o.sold.fee !== null && s.career.offered[id] === undefined && dateOf(o.sold.at) >= since) units += UNITS[scriptOf(s.scripts, Number(id)).form as keyof typeof UNITS];
      }
      if (units >= WGA.units) return { standing: 'full', initiation: WGA.initiation, dues: WGA.dues };
      if (units > 0) return { standing: 'associate', initiation: null, dues: WGA.associate };
      throw new Error('the WGA asks a sale to a signatory in the last three years');
    }
    case 'dga': {
      // @slate:consumer directing.prep
      // Only a film directed under the DGA's own terms is employment by a signatory: one in another market isn't.
      const film = s.directing.films.filter((f) => f.agreement === 'dga').at(-1);
      if (film === undefined) throw new Error('the DGA asks employment by a signatory: a film or an episode directed');
      const low = film.form === 'feature' && (film.budget as number) <= DGA.ceiling;
      return { standing: 'full', initiation: low ? DGA.low : DGA.initiation, dues: DGA.dues };
    }
    default:
      throw new Error(`there's no union ${String(union)}`);
  }
}

/**
 * Whether a part under an agreement may be taken now. SAG-AFTRA's union security: a non-member may be hired (the
 * producer files a Taft-Hartley report) until the thirtieth day after their first SAG-AFTRA job, then only as a member.
 * Equity's UK work is never barred to a non-member (TULRCA 1992 s.137), nor ACTRA's to a permittee.
 */
export function mayTakeUnionWork(s: { unions: UnionsSlice; acting: ActingSlice }, agreement: Agreement, now: number): boolean {
  if (agreement !== 'sag-aftra') return true;
  // @slate:consumer unions.join
  if (memberOf(s.unions, 'sag-aftra') !== undefined) return true;
  const first = Math.min(...played(s.acting).filter((w) => w.part.agreement === 'sag-aftra').map((w) => w.work.at));
  return now < first + TAFT_HARTLEY_DAYS * SECONDS_PER_DAY;
}

/**
 * Whether the person's citizenship lets them work in a country: one of their citizenships gives the right (it's their
 * own, or free movement covers it). Where it takes a permit, it doesn't: papers.permits' `permitted` reads this, then
 * the permits held and a short engagement's days.
 */
export function mayWorkIn(p: Person, country: CountryCode): boolean {
  // @slate:consumer identity.make
  return p.citizenship.some((c) => {
    const w = work(c, country);
    return w === 'home' || w?.right === 'free';
  });
}

/** Joins a union by its own route: the card in the name the person goes by, the fee and dues recorded. */
function join(s: Lives, a: { [key: string]: string; union: string }, c: Context): void {
  const t = terms(s, a.union as Union, c.now);
  const held = memberOf(s.unions, a.union as Union);
  if (held !== undefined && (held.standing === 'full' || held.standing === t.standing)) throw new Error(`the person is a member of ${a.union} already`);
  // @slate:consumer identity.make
  s.unions.joined.push({ union: a.union as Union, at: c.now, standing: t.standing, name: personOf(s.identity).preferred, initiation: t.initiation, dues: t.dues });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const joinUnion = defineCommand<Lives, { [key: string]: string; union: string }>({ id: 'unions.join', reads: ['identity', 'acting', 'career', 'scripts', 'directing'], writes: ['unions'], run: join });
