import { defineCommand, type Context, type Json } from '../../core/frame/frame.ts';
import { add, fromMajor, multiply, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { civilFromDays, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import type { LineId } from '../../core/text/text.ts';
import { componentOf, componentValues, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { spread } from '../work/work.ts';

/**
 * The actor's work (BUILD-ORDER layer 4; the owner, 2026-10-31: "I want my attributes to effect the quality of my work
 * ... it needs to actually produce results depending on how bad or good I am"): auditioning for a part, booking it, and
 * playing it, paid at the union's minimum for the part's agreement on the day the work starts.
 *
 * A part asks for the craft every role uses (Acting's techniques, understanding the character and the situation, the
 * text, an interpretation of one's own, research and study of the role; Direction's taking direction; Memorization's
 * concentration, and its lines where it has any), the medium's own (the camera on screen; the space and the voice
 * that fills it on stage), and whatever else it calls for, named by the component it reads (singing, a dialect,
 * stunts, Shakespeare ...). Each is read at the level of the broad attribute that covers it, through its facets.
 *
 * An audition is self-taped as 92% of roles were in SAG-AFTRA's 2022 survey, or held in the room; it shows the part's
 * scene and the actor's audition craft (Auditioning; Camera's self-taping on tape). Whether it books, no source gives
 * (R-4614's blocker: unions, casting societies and platforms publish no audition-to-booking ratio; agents' columns put
 * it at 1 in 6 to 1 in 50 without data): the game's own chance runs 1 in 50 for the weakest audition to a little under
 * 1 in 3 for the best, raised by the best work casting has seen the actor do (person.acting.model).
 *
 * The pay is the agreement's minimum (R-4614): SAG-AFTRA's day and weekly performers, its low-budget tiers by the film's
 * budget (none set under $20,000, the Micro-Budget agreement leaving it to negotiation); Pact/Equity's Cinema Films
 * Agreement for UK features of £3 million and over; UK Theatre/Equity's commercial theatre weeks by the venue's seats,
 * rehearsal weeks at the rehearsal rate; ACTRA's Independent Production Agreement, a principal by the day or week and a
 * part of five lines or fewer by the day.
 */

/** The line that tells the player these figures are the game's own (person.acting.model). */
export const MODEL_LINE: LineId = 'acting.model';

/** The agreement a part is engaged under. */
export type Agreement = 'sag-aftra' | 'pact-equity' | 'uk-theatre' | 'actra';
export type Term = 'day' | 'week';

/** A part as casting puts it out. */
export interface Part {
  [key: string]: Json;
  agreement: Agreement;
  /** The production's budget, in the agreement's currency's major units (SAG-AFTRA's tiers, Pact/Equity's threshold turn on it). */
  budget: number;
  /** The theatre's seats (UK Theatre's tiers turn on it). */
  seats: number;
  /** The lines the part speaks. */
  lines: number;
  term: Term;
  /** Days or weeks engaged: on stage, the weeks of performance. */
  length: number;
  /** Weeks of rehearsal before them, on stage. */
  rehearsal: number;
  /** What else the part calls for, by the actor's components (singing, accents-and-dialects ...). */
  asks: string[];
}

export interface Work {
  readonly at: number;
  /** How the part was played, 0 to 100. */
  readonly quality: number;
  /** The agreement's minimum for the engagement; none where the agreement sets none. */
  readonly pay: Money | null;
}

export interface Audition {
  readonly id: number;
  readonly at: number;
  readonly part: Part;
  /** Self-taped, or held in the room. */
  readonly taped: boolean;
  /** How the audition went, 0 to 100. */
  readonly score: number;
  readonly booked: boolean;
  work: Work | null;
}

export interface ActingSlice {
  auditions: Audition[];
}

export const ACTING_START: ActingSlice = { auditions: [] };

type Values = Readonly<Record<string, number>>;
type Acting = { attributes: AttributesSlice; acting: ActingSlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mean = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const of = (v: Values, id: string) => skillOf(v, 'actor', id);

/** What every part asks of the actor, whatever the medium: the game's reading of the components any role uses. */
export const CRAFT = ['acting-techniques', 'understanding-character-and-situation', 'text-analysis', 'own-interpretation', 'research-roles', 'study-roles-from-scripts', 'ability-to-take-direction', 'konzentrationsf-higkeit'] as const;

/** What the medium asks besides: the camera on screen; on stage the space and the voice that fills it. */
export const MEDIUM = { screen: ['acting-for-the-camera'], stage: ['appropriation-d-espace-sc-nique', 'speaking'] } as const;

export const STAGE: readonly Agreement[] = ['uk-theatre'];

/** Every component a part asks for. */
export function demands(part: Part): string[] {
  const out = new Set<string>(CRAFT);
  if (part.lines > 0) out.add('memorise-lines');
  for (const id of MEDIUM[STAGE.includes(part.agreement) ? 'stage' : 'screen']) out.add(id);
  for (const id of part.asks) out.add(componentOf('actor', id).id);
  return [...out];
}

/** What the actor can do in a part: every component it asks, as the actor has it, equally. */
export const partSkill = (v: Values, part: Part): number => mean(demands(part).map((id) => of(v, id)));

/** The audition craft every audition reads; a self-tape reads Camera's self-taping besides. */
export const ROOM = ['prepare-for-and-go-to-auditions', 'audition-technique'] as const;

/** How an audition shows the actor, 0 to 100: the part's scene three fifths, the audition's craft two. */
export function auditionSkill(v: Values, part: Part, taped: boolean): number {
  const room = mean([...ROOM, ...(taped ? ['self-taping'] : [])].map((id) => of(v, id)));
  return 0.6 * partSkill(v, part) + 0.4 * room;
}

/** The share of roles self-taped (SAG-AFTRA's 2022 survey: 92% of roles required it; R-4614). */
export const TAPED = 0.92;

/**
 * The chance an audition books, the game's own (no source gives it, R-4614): 2% for the weakest, 30% for the best,
 * rising with the square of the audition, and up to half again for the best work casting has seen the actor do.
 */
export const BOOKING = { floor: 0.02, top: 0.3, credit: 0.5 } as const;

export const bookingChance = (score: number, credit: number): number => (BOOKING.floor + (BOOKING.top - BOOKING.floor) * (score / 100) ** 2) * (1 + (BOOKING.credit * credit) / 100);

/** The best work the actor has done, 0 where none: what casting has seen. */
export function credit(s: ActingSlice): number {
  // @slate:consumer acting.perform
  return Math.max(0, ...s.auditions.map((x) => x.work?.quality ?? 0));
}

/** A minimum's steps: from each date (the first day it applies), the amount in major units. */
type Table = readonly (readonly [from: string, major: string])[];

interface Scale {
  readonly currency: CurrencyCode;
  readonly day?: Table;
  readonly week?: Table;
  /** A rehearsal week's, on stage. */
  readonly rehearsal?: Table;
}

const SAG_YEARS = ['2025-07-01', '2026-07-01', '2027-07-01', '2028-07-01', '2029-07-01'];
const LOW_YEARS = ['2026-07-01', '2027-07-01', '2028-07-01', '2029-07-01'];
const PACT_YEARS = ['2020-04-06', '2021-04-06', '2022-04-06', '2023-04-06', '2024-04-06'];
const ACTRA_YEARS = ['2025-01-26', '2026-01-01', '2027-01-01'];
const steps = (from: readonly string[], amounts: readonly string[]): Table => from.map((d, i) => [d, amounts[i] as string]);

/** SAG-AFTRA's minimums, July 2025 to June 2030, by the film's budget (R-4614: CBA Schedules A and B; the low-budget agreements). */
export const SAG = {
  /** The Codified Basic Agreement and the Television Agreement: day performers on 8 hours, weekly on a 44-hour week. */
  basic: { currency: 'USD', day: steps(SAG_YEARS, ['1246', '1283', '1321', '1361', '1402']), week: steps(SAG_YEARS, ['4326', '4456', '4590', '4728', '4870']) },
  /** Low Budget, up to $2 million. */
  low: { currency: 'USD', day: steps(LOW_YEARS, ['834', '859', '885', '911']), week: steps(LOW_YEARS, ['2896', '2984', '3073', '3166']) },
  /** Moderate Low Budget, up to $700,000. */
  moderate: { currency: 'USD', day: steps(LOW_YEARS, ['449', '462', '476', '491']), week: steps(LOW_YEARS, ['1560', '1607', '1655', '1705']) },
  /** Ultra Low Budget, up to $300,000: a day rate only. */
  ultra: { currency: 'USD', day: steps(LOW_YEARS, ['257', '264', '272', '280']) },
} as const satisfies Record<string, Scale>;

/** The budgets each SAG-AFTRA tier reaches up to, in dollars; above the last, the basic agreement. */
export const SAG_TIERS = { micro: 20_000, ultra: 300_000, moderate: 700_000, low: 2_000_000 } as const;

/** Pact/Equity's Cinema Films Agreement, features of £3 million and over, April 2020 to April 2025 (R-4614). */
export const PACT = { currency: 'GBP', day: steps(PACT_YEARS, ['144', '147', '150', '156', '161']), week: steps(PACT_YEARS, ['576', '588', '600', '624', '644']) } as const satisfies Scale;
export const PACT_FLOOR = 3_000_000;

/** UK Theatre/Equity's commercial theatre, from 31 March 2025, by the venue's seats: tiers C, B, A and A* (R-4614). */
export const UK_THEATRE: readonly (Scale & { readonly seats: number })[] = [
  { seats: 0, currency: 'GBP', rehearsal: [['2025-03-31', '525.03']], week: [['2025-03-31', '561.66']] },
  { seats: 250, currency: 'GBP', rehearsal: [['2025-03-31', '531.69']], week: [['2025-03-31', '561.93']] },
  { seats: 500, currency: 'GBP', rehearsal: [['2025-03-31', '545.58']], week: [['2025-03-31', '569.14']] },
  { seats: 1500, currency: 'GBP', rehearsal: [['2025-03-31', '551.57']], week: [['2025-03-31', '590.33']] },
];

/** ACTRA's Independent Production Agreement, January 2025 to December 2027 (R-4614). */
export const ACTRA = {
  principal: { currency: 'CAD', day: steps(ACTRA_YEARS, ['935.25', '972.75', '1006.75']), week: steps(ACTRA_YEARS, ['3974.50', '4133.50', '4278.25']) },
  /** An actor with five lines or fewer: a day rate only. */
  few: { currency: 'CAD', day: steps(ACTRA_YEARS, ['631.25', '656.50', '679.50']) },
} as const satisfies Record<string, Scale>;
export const ACTRA_FEW_LINES = 5;

/** The scale a part is paid on; none where its agreement sets no minimum. */
export function scaleOf(part: Part): Scale | null {
  switch (part.agreement) {
    case 'sag-aftra':
      if (part.budget <= SAG_TIERS.micro) return null;
      if (part.budget <= SAG_TIERS.ultra) return SAG.ultra;
      if (part.budget <= SAG_TIERS.moderate) return SAG.moderate;
      return part.budget <= SAG_TIERS.low ? SAG.low : SAG.basic;
    case 'pact-equity':
      // shortcut: films under £3 million go to Equity's low-budget agreements, whose rates Equity shows members only (R-4614 blockers); refused until read.
      if (part.budget < PACT_FLOOR) throw new Error("the minimums for a UK film under £3 million aren't known");
      return PACT;
    case 'uk-theatre':
      return UK_THEATRE.findLast((t) => part.seats >= t.seats) as Scale;
    case 'actra':
      return part.lines <= ACTRA_FEW_LINES ? ACTRA.few : ACTRA.principal;
  }
}

/** A date as the tables write it. */
export function dateOf(now: number): string {
  const { year, month, day } = civilFromDays(Math.floor(now / SECONDS_PER_DAY));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The amount in force on a date: the latest step begun by then. shortcut: past an agreement's term its last rate is
 * kept, the game's own reckoning (person.acting.model), until the next agreement's rates are read.
 */
export function rateAt(currency: CurrencyCode, table: Table, date: string): Money {
  const step = table.findLast(([from]) => from <= date);
  if (step === undefined) throw new Error(`no minimum is known before ${(table[0] as readonly [string, string])[0]}`);
  return fromMajor(currency, step[1]);
}

/**
 * What the engagement pays, at the minimums in force the day the work starts. shortcut: an engagement spanning a new
 * year's rates is paid all of it at the first day's; overtime and use fees aren't modeled.
 */
export function pay(part: Part, date: string): Money | null {
  const scale = scaleOf(part);
  if (scale === null) return null;
  const table = scale[part.term];
  if (table === undefined) throw new Error(`there's no ${part.term} minimum for that part`);
  const performed = multiply(rateAt(scale.currency, table, date), String(part.length));
  return scale.rehearsal === undefined ? performed : add(performed, multiply(rateAt(scale.currency, scale.rehearsal, date), String(part.rehearsal)));
}

/** The days an engagement works: a week is five (SAG-AFTRA's five-day studio week; the game's for the others). */
export const WEEK_DAYS = 5;
export const daysWorked = (part: Part): number => (part.term === 'day' ? part.length : WEEK_DAYS * (part.length + part.rehearsal));

const whole = (n: unknown, what: string, least: number): void => {
  if (!Number.isSafeInteger(n) || (n as number) < least) throw new RangeError(`${what} must be a whole number of at least ${least} (${String(n)})`);
};

/** A part as given, held to what an engagement can be. */
export function partOf(a: Part): Part {
  if (!['sag-aftra', 'pact-equity', 'uk-theatre', 'actra'].includes(a.agreement)) throw new Error(`there's no agreement ${String(a.agreement)}`);
  if (!['day', 'week'].includes(a.term)) throw new Error(`there's no term ${String(a.term)}`);
  whole(a.budget, 'the budget', 0);
  whole(a.seats, 'the seats', 0);
  whole(a.lines, 'the lines', 0);
  whole(a.length, 'the length', 1);
  whole(a.rehearsal, 'the rehearsal', 0);
  const stage = STAGE.includes(a.agreement);
  if (stage && a.term === 'day') throw new Error('a stage engagement is by the week');
  if (!stage && a.rehearsal > 0) throw new Error("rehearsal weeks are a stage engagement's");
  demands(a);
  const scale = scaleOf(a);
  if (scale !== null && scale[a.term] === undefined) throw new Error(`there's no ${a.term} minimum for that part`);
  return a;
}

export function auditionOf(s: ActingSlice, id: number): Audition {
  const found = s.auditions.find((x) => x.id === id);
  if (found === undefined) throw new Error(`there's no audition ${id}`);
  return found;
}

/** Auditions for a part: on tape or in the room, and booked or not. */
function audition(s: Acting, a: Part, c: Context): void {
  const part = partOf(a);
  // @slate:consumer attributes.choose
  const values = componentValues(s.attributes, 'actor');
  const id = s.acting.auditions.length + 1;
  const d = c.draws('acting.work', 'audition', id);
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the share with no probability.
  const taped = d.float() < TAPED;
  const k = auditionSkill(values, part, taped);
  const score = clamp(k + spread(k) * (2 * d.float() - 1), 0, 100);
  // Stryker disable next-line EqualityOperator: as above.
  const booked = d.float() < bookingChance(score, credit(s.acting));
  s.acting.auditions.push({ id, at: c.now, part, taped, score, booked, work: null });
  practise(s.attributes, 'actor', [...demands(part), ...ROOM, ...(taped ? ['self-taping'] : [])], 1);
}

export interface PlayArgs {
  [key: string]: number;
  audition: number;
}

/** Plays a part booked: how well, as the actor is in what it asks, and what it pays. */
function play(s: Acting, a: PlayArgs, c: Context): void {
  const job = auditionOf(s.acting, a.audition);
  // @slate:consumer acting.audition
  if (!job.booked) throw new Error(`audition ${a.audition} didn't book the part`);
  if (job.work !== null) throw new Error(`the part from audition ${a.audition} is played`);
  // @slate:consumer attributes.choose
  const k = partSkill(componentValues(s.attributes, 'actor'), job.part);
  const quality = clamp(k + spread(k) * (2 * c.draws('acting.work', 'perform', job.id).float() - 1), 0, 100);
  job.work = { at: c.now, quality, pay: pay(job.part, dateOf(c.now)) };
  practise(s.attributes, 'actor', demands(job.part), daysWorked(job.part));
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const auditionForPart = defineCommand<Acting, Part>({ id: 'acting.audition', reads: [], writes: ['attributes', 'acting'], run: audition });
export const playPart = defineCommand<Acting, PlayArgs>({ id: 'acting.perform', reads: [], writes: ['attributes', 'acting'], run: play });
