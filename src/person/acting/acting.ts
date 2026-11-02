import { defineCommand, type Context, type Json } from '../../core/frame/frame.ts';
import { add, fromMajor, multiply, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { civilFromDays, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { earn, type Earning } from '../../money/tax/tax.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { componentOf, componentValues, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { identifiesAs, personOf, playingAge, residenceOf, speaks, type Ethnicity, type IdentitySlice, type Level, type Person } from '../identity/identity.ts';
import { permitted, type PermitsSlice } from '../permits/permits.ts';
import type { DirectingSlice } from '../directing/directing.ts';
import type { ProducingSlice } from '../producing/producing.ts';
import { mayTakeUnionWork, type UnionsSlice } from '../unions/unions.ts';
import { spread } from '../work/work.ts';
import { engagement, holdBack, hoursShare, type YouthSlice } from '../youth/youth.ts';
import compiled from './markets.json' with { type: 'json' };

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
 *
 * Beyond them, every market the research gives terms for (src/person/acting/markets.json, compiled by
 * tools/person/markets from the research, register facts person.markets.<CC>): each agreement a part can be engaged
 * under in the market's city, a territory whose work follows another country's terms engaged under that country's
 * agreements as its own (Saint-Barthélemy under France's, the Cocos Islands under Australia's), its minimums
 * by medium (film, television, the stage), by role where it names roles, by the term it pays (a day, a week, a month, a
 * year, a session, a performance or an episode) and by the tier it sets (the budget, the lines, the seats, an
 * episode's minutes, the engagement's length, the actor's years in the work, the day or performance of the engagement),
 * each from the date it applies, in the agreement's currency. Where the research says no agreement sets an actor's
 * pay, it is left to negotiation, as under the Micro-Budget agreement. The actor's years are the whole years since the
 * first part they played, the game's reading (person.markets.model); what a country's research couldn't find is told,
 * whether its market is compiled or not.
 *
 * Casting puts a part out as a breakdown (R-4620): written for men, women, either or a non-binary performer at the
 * shares of Sowa's count of 3,714 SAG-AFTRA television breakdowns (2017); naming an ethnicity, open to all, or silent
 * at the same count's shares; for an age range by the ages of major characters in the top US films of 2025; in the
 * market's language. An actor is seen only for a breakdown they fit, and every submission goes out under a headshot
 * (R-4622: every submission on the casting platforms carries a profile photo). A named ethnicity is read only as the
 * breakdown writes it, never as an ability, a judgment of the work, a pay rate or a chance (KEEP entry 4).
 */

/** The line that tells the player these figures are the game's own (person.acting.model). */
export const MODEL_LINE: LineId = 'acting.model';

/** The agreements the markets engage parts under, as markets.json compiles them (a test holds the two lists one). */
export const MARKET_AGREEMENTS = [
  'ad-artists', 'ai-all', 'ar-film', 'ar-tv', 'ar-stage', 'at-screen', 'au-screen', 'au-stage', 'be-screen', 'bg-foreign-film', 'bn-screen', 'br-rj-tv', 'br-sp-screen', 'br-rj-stage', 'bw-screen',
  'cl-screen', 'co-all', 'cu-stage', 'de-screen', 'de-stage', 'de-guest', 'dk-film', 'dk-tv', 'dk-soejle-a', 'dk-copenhagen-stage', 'es-screen', 'es-madrid-stage', 'fi-stage', 'fi-guest',
  'fi-screen', 'fr-film', 'fr-tv', 'fr-subsidised-stage', 'fr-private-stage', 'gi-all', 'gr-private-stage', 'hk-film', 'ie-stage', 'il-screen', 'in-screen', 'it-screen', 'it-stage', 'jp-nhk',
  'jp-live', 'kr-kbs', 'kr-mbc-sbs', 'li-film', 'ms-all', 'mx-televisa', 'mx-azteca', 'mx-other', 'nc-all', 'ng-screen', 'nl-stage', 'nl-screen', 'no-film', 'no-tv', 'no-nrk', 'no-stage',
  'nz-screen', 'nz-court', 'nz-atc', 'ph-screen', 'pn-all', 'se-screen', 'se-stage', 'se-private-stage', 'se-free-stage', 'sh-all', 'th-screen', 'tr-screen', 'va-screen', 'vg-all', 'za-all',
  'ax-fi-stage', 'ax-fi-guest', 'ax-fi-screen', 'bl-fr-film', 'bl-fr-tv', 'bl-fr-subsidised-stage', 'bl-fr-private-stage', 'cc-au-screen', 'cc-au-stage', 'cx-au-screen', 'cx-au-stage', 'gf-fr-film',
  'gf-fr-tv', 'gf-fr-subsidised-stage', 'gf-fr-private-stage', 'gp-fr-film', 'gp-fr-tv', 'gp-fr-subsidised-stage', 'gp-fr-private-stage', 'mf-fr-film', 'mf-fr-tv', 'mf-fr-subsidised-stage',
  'mf-fr-private-stage', 'nf-au-screen', 'nf-au-stage', 'pm-fr-film', 'pm-fr-tv', 'pm-fr-subsidised-stage', 'pm-fr-private-stage', 're-fr-film', 're-fr-tv', 're-fr-subsidised-stage',
  're-fr-private-stage', 'yt-fr-film', 'yt-fr-tv', 'yt-fr-subsidised-stage', 'yt-fr-private-stage',
] as const;
/** The agreement a part is engaged under. */
export type Agreement = 'sag-aftra' | 'pact-equity' | 'uk-theatre' | 'actra' | (typeof MARKET_AGREEMENTS)[number];
export const AGREEMENTS: readonly Agreement[] = ['sag-aftra', 'pact-equity', 'uk-theatre', 'actra', ...MARKET_AGREEMENTS];
export const TERMS = ['day', 'week', 'month', 'year', 'session', 'performance', 'episode'] as const;
export type Term = (typeof TERMS)[number];
export const MEDIA = ['film', 'television', 'stage'] as const;
export type Medium = (typeof MEDIA)[number];

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
  /** A market's part: its medium, where its agreement covers more than one. */
  medium?: Medium;
  /** A market's part: its role, where its agreement sets its minimums by role. */
  role?: string;
  /** A market's part: an episode's running time, where its agreement's minimums turn on it. */
  minutes?: number;
}

export interface Work {
  readonly at: number;
  /** How the part was played, 0 to 100. */
  readonly quality: number;
  /** The agreement's minimum for the engagement; none where the agreement sets none. */
  readonly pay: Money | null;
}

/** Who a breakdown is written for: men, women, either (open), or a non-binary performer. */
export type Gender = 'men' | 'women' | 'open' | 'non-binary';
/** The ethnicity a breakdown names, or open to every ethnicity, or silent on it. */
export type Named = 'open' | 'silent' | Ethnicity;

/** A part put out by casting, and who it is written for. */
export interface Breakdown {
  readonly id: number;
  readonly at: number;
  readonly part: Part;
  readonly gender: Gender;
  readonly ethnicity: Named;
  /** The ages the part is written for, from and to. */
  readonly ages: readonly [number, number];
  /** BCP 47: the language it is played in. */
  readonly language: string;
}

export interface Audition {
  readonly id: number;
  readonly at: number;
  /** The breakdown it answered. */
  readonly breakdown: number;
  readonly part: Part;
  /** Self-taped, or held in the room. */
  readonly taped: boolean;
  /** How the audition went, 0 to 100. */
  readonly score: number;
  readonly booked: boolean;
  work: Work | null;
}

export interface ActingSlice {
  breakdowns: Breakdown[];
  auditions: Audition[];
}

export const ACTING_START: ActingSlice = { breakdowns: [], auditions: [] };

type Values = Readonly<Record<string, number>>;
type Acting = { attributes: AttributesSlice; acting: ActingSlice; identity: IdentitySlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mean = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const of = (v: Values, id: string) => skillOf(v, 'actor', id);

/** What every part asks of the actor, whatever the medium: the game's reading of the components any role uses. */
export const CRAFT = ['acting-techniques', 'understanding-character-and-situation', 'text-analysis', 'own-interpretation', 'research-roles', 'study-roles-from-scripts', 'ability-to-take-direction', 'konzentrationsf-higkeit'] as const;

/** What the medium asks besides: the camera on screen; on stage the space and the voice that fills it. */
export const MEDIUM = { screen: ['acting-for-the-camera'], stage: ['appropriation-d-espace-sc-nique', 'speaking'] } as const;

export const STAGE: readonly Agreement[] = ['uk-theatre'];

/** Whether a part is played on stage: UK Theatre's, or a market's part whose medium is the stage. */
export const onStage = (part: Part): boolean => STAGE.includes(part.agreement) || (marketOf(part.agreement) !== undefined && mediumOf(part) === 'stage');

/** Every component a part asks for. */
export function demands(part: Part): string[] {
  const out = new Set<string>(CRAFT);
  if (part.lines > 0) out.add('memorise-lines');
  for (const id of MEDIUM[onStage(part) ? 'stage' : 'screen']) out.add(id);
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
  /** A rehearsal week's, on stage; a market's part's rehearsal unit's. */
  readonly rehearsal?: Table;
  /** A market's part: the minimums for its term, each paying the engagement's units from one to another (to none: the rest). */
  readonly bands?: readonly Band[];
}

export interface Band {
  readonly from: number;
  readonly to: number | null;
  readonly table: Table;
}

/** A market's minimum as compiled (tools/person/markets/compile.ts). */
type Tier = 'budget' | 'lines' | 'seats' | 'minutes' | 'length' | 'years' | 'nth';
export interface Minimum {
  readonly medium: Medium;
  readonly role: string | null;
  readonly per: Term;
  readonly rehearsal: boolean;
  readonly with: readonly Term[] | null;
  readonly when: Readonly<Partial<Record<Tier, readonly [number, number | null]>>>;
  readonly from: string;
  readonly amount: string;
}
export interface MarketAgreement {
  readonly country: CountryCode;
  readonly currency: CurrencyCode | null;
  readonly media: readonly Medium[];
  readonly none: boolean;
  readonly minimums: readonly Minimum[];
  /** The agreement whose terms a territory's work follows. */
  readonly follows?: Agreement;
}
/** What a market's research couldn't find, by the item its blockers name. */
export type Unknown = 'agreements' | 'rates' | 'none' | 'union' | 'language' | 'market' | 'terms' | 'successors';
export interface Market {
  readonly language: string;
  readonly zone: string;
  readonly agreements: readonly Agreement[];
}
export const MARKETS = (compiled as unknown as { markets: Readonly<Record<string, Market>> }).markets;
/** What each country's research couldn't find, its market compiled or not. */
export const UNKNOWN = (compiled as unknown as { unknown: Readonly<Record<string, readonly Unknown[]>> }).unknown;
const COMPILED = (compiled as unknown as { agreements: Readonly<Record<string, MarketAgreement>> }).agreements;

/** A market's agreement as compiled; none for the four this engine keeps itself. */
export const marketOf = (a: Agreement): MarketAgreement | undefined => (Object.hasOwn(COMPILED, a) ? COMPILED[a] : undefined);

/** A market's part's medium: as the part names it, or its agreement's only one. */
export function mediumOf(part: Part): Medium {
  const a = marketOf(part.agreement) as MarketAgreement;
  const medium = part.medium ?? (a.media.length === 1 ? a.media[0] : undefined);
  if (medium === undefined) throw new Error(`a part under ${part.agreement} names its medium: ${a.media.join(', ')}`);
  if (!a.media.includes(medium)) throw new Error(`${part.agreement} sets no terms for ${medium}`);
  return medium;
}

/** Whether a minimum's tiers hold for a part and the actor's years (the unit it pays, `nth`, is a band's, not a test). */
function holds(m: Minimum, part: Part, years: number): boolean {
  const value: Record<Exclude<Tier, 'nth'>, number> = { budget: part.budget, lines: part.lines, seats: part.seats, minutes: part.minutes ?? 0, length: part.length, years };
  return (Object.entries(m.when) as [Tier, readonly [number, number | null]][]).every(([k, [lo, hi]]) => k === 'nth' || (value[k] >= lo && (hi === null || value[k] <= hi)));
}

/** A slot's minimums as a table of steps: the compile writes each agreement's minimums by date. */
const tableOf = (ms: readonly Minimum[]): Table => ms.map((m) => [m.from, m.amount] as const);

/** A market's part's scale: its term's minimums, band by band, and its rehearsal's; none where no agreement sets the pay. */
function marketScale(part: Part, a: MarketAgreement, years: number): Scale | null {
  const medium = mediumOf(part);
  if (a.none) return null;
  const own = a.minimums.filter((m) => m.medium === medium);
  const roles = [...new Set(own.map((m) => m.role))];
  const role = part.role ?? null;
  if (!roles.includes(role)) throw new Error(roles.includes(null) ? `${part.agreement} sets no minimum by role` : `a part under ${part.agreement} is one of its roles: ${roles.join(', ')}`);
  const fit = own.filter((m) => m.role === role && holds(m, part, years));
  const bands = new Map<string, Minimum[]>();
  for (const m of fit.filter((x) => !x.rehearsal && x.per === part.term)) {
    const key = JSON.stringify(m.when.nth ?? [1, null]);
    bands.set(key, [...(bands.get(key) ?? []), m]);
  }
  const rehearsal = fit.filter((m) => m.rehearsal && (m.with === null || m.with.includes(part.term)));
  return {
    currency: a.currency as CurrencyCode,
    bands: [...bands.entries()].map(([key, ms]) => {
      const [from, to] = JSON.parse(key) as [number, number | null];
      return { from, to, table: tableOf(ms) };
    }),
    ...(rehearsal.length > 0 ? { rehearsal: tableOf(rehearsal) } : {}),
  };
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

/** The scale a part is paid on, for an actor of so many years in the work; none where its agreement sets no minimum. */
export function scaleOf(part: Part, years = 0): Scale | null {
  const market = marketOf(part.agreement);
  if (market !== undefined) return marketScale(part, market, years);
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
    default:
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
 * What the engagement pays, at the minimums in force the day the work starts, to an actor of so many years in the work.
 * A market's minimums by the unit pay each unit of the engagement at its own (the first five days at one, the rest at
 * another), and its rehearsal units at the rehearsal's. shortcut: an engagement spanning a new year's rates is paid all
 * of it at the first day's; overtime and use fees aren't modeled.
 */
export function pay(part: Part, date: string, years = 0): Money | null {
  const scale = scaleOf(part, years);
  if (scale === null) return null;
  if (scale.bands !== undefined) return marketPay(part, scale as Scale & { bands: readonly Band[] }, date);
  const table = scale[part.term as 'day' | 'week'];
  if (table === undefined) throw new Error(`there's no ${part.term} minimum for that part`);
  const performed = multiply(rateAt(scale.currency, table, date), String(part.length));
  return scale.rehearsal === undefined ? performed : add(performed, multiply(rateAt(scale.currency, scale.rehearsal, date), String(part.rehearsal)));
}

function marketPay(part: Part, scale: Scale & { bands: readonly Band[] }, date: string): Money {
  if (scale.bands.length === 0) throw new Error(`there's no ${part.term} minimum for that part`);
  let total = fromMajor(scale.currency, '0');
  for (const b of scale.bands) {
    if (part.length >= b.from) total = add(total, multiply(rateAt(scale.currency, b.table, date), String(Math.min(part.length, b.to ?? part.length) - b.from + 1)));
  }
  if (part.rehearsal === 0) return total;
  if (scale.rehearsal === undefined) throw new Error("there's no rehearsal minimum for that part");
  return add(total, multiply(rateAt(scale.currency, scale.rehearsal, date), String(part.rehearsal)));
}

/**
 * The days an engagement works: a week is five (SAG-AFTRA's five-day studio week; the game's for the others); a month
 * 21 and a year 220 (the Virke TV-drama agreement's basis, read for every agreement: person.markets.model); a session,
 * a performance and an episode a day each. A market's rehearsal units are counted by its rehearsal's term (weeks where
 * it sets none).
 */
export const WEEK_DAYS = 5;
export const UNIT_DAYS: Readonly<Record<Term, number>> = { day: 1, week: WEEK_DAYS, month: 21, year: 220, session: 1, performance: 1, episode: 1 };
export function daysWorked(part: Part): number {
  const rehearsal = marketOf(part.agreement)?.minimums.find((m) => m.rehearsal)?.per ?? 'week';
  return UNIT_DAYS[part.term] * part.length + UNIT_DAYS[rehearsal] * part.rehearsal;
}

/** The actor's whole years in the work on a day: since the first part they played, none before it (person.markets.model). */
export function experience(s: ActingSlice, now: number): number {
  // @slate:consumer acting.perform
  const first = Math.min(...s.auditions.flatMap((a) => (a.work === null ? [] : [a.work.at])));
  if (first === Infinity) return 0;
  const [since, today] = [dateOf(first), dateOf(now)];
  return Number(today.slice(0, 4)) - Number(since.slice(0, 4)) - (today.slice(5) < since.slice(5) ? 1 : 0);
}

const whole = (n: unknown, what: string, least: number): void => {
  if (!Number.isSafeInteger(n) || (n as number) < least) throw new RangeError(`${what} must be a whole number of at least ${least} (${String(n)})`);
};

/** A part as given, held to what an engagement can be. */
export function partOf(a: Part): Part {
  if (!AGREEMENTS.includes(a.agreement)) throw new Error(`there's no agreement ${String(a.agreement)}`);
  if (!TERMS.includes(a.term)) throw new Error(`there's no term ${String(a.term)}`);
  whole(a.budget, 'the budget', 0);
  whole(a.seats, 'the seats', 0);
  whole(a.lines, 'the lines', 0);
  whole(a.length, 'the length', 1);
  whole(a.rehearsal, 'the rehearsal', 0);
  if (a.minutes !== undefined) whole(a.minutes, 'the minutes', 1);
  if (a.medium !== undefined && !MEDIA.includes(a.medium)) throw new Error(`there's no medium ${String(a.medium)}`);
  const market = marketOf(a.agreement);
  if (market === undefined) {
    if (a.medium !== undefined || a.role !== undefined || a.minutes !== undefined) throw new Error(`${a.agreement} sets no terms by medium, role or minutes`);
    if (a.term !== 'day' && a.term !== 'week') throw new Error(`there's no ${a.term} minimum for that part`);
    const stage = STAGE.includes(a.agreement);
    if (stage && a.term === 'day') throw new Error('a stage engagement is by the week');
    if (!stage && a.rehearsal > 0) throw new Error("rehearsal weeks are a stage engagement's");
  }
  demands(a);
  const scale = scaleOf(a);
  if (scale !== null && (scale.bands === undefined ? scale[a.term as 'day' | 'week'] === undefined : scale.bands.length === 0)) throw new Error(`there's no ${a.term} minimum for that part`);
  if (scale?.bands !== undefined && a.rehearsal > 0 && scale.rehearsal === undefined) throw new Error("there's no rehearsal minimum for that part");
  return a;
}

/** The shares of a breakdown's gender: Sowa's count of 3,714 SAG-AFTRA television breakdowns, January to August 2017 (R-4620). */
export const GENDER: readonly (readonly [Gender, number])[] = [['men', 57.6], ['women', 37.9], ['open', 4.4], ['non-binary', 0.1]];

/**
 * The shares of the ethnicity a breakdown names, open or silent, from the same count (R-4620). The published shares
 * sum to 105.7, which the paper doesn't explain; they are drawn as weights, each in proportion to the others.
 */
export const ETHNICITY: readonly (readonly [Named, number])[] = [
  ['open', 33.9], ['silent', 30], ['white', 15.5], ['black', 8.5], ['latino', 8.3], ['asian', 3.8], ['middle-eastern', 1.6], ['south-asian', 1.5], ['mixed', 1.4], ['pacific-islander', 0.7], ['native-american', 0.5],
];

/** The shares of major characters in the top 100 US films of 2025 in their 30s, their 40s, 40 or older and 60 or older, by gender (R-4620). */
export const MAJOR_AGES = { women: { thirties: 32, forties: 15, over40: 28, over60: 2 }, men: { thirties: 22, forties: 29, over40: 59, over60: 8 } } as const;

/**
 * The age ranges a breakdown is written for, the game's own (person.acting.model): a child's, a teenager's, an adult's
 * under 30, then each decade, and 60 to 75; a part under 30 is a child's a tenth of the time and a teenager's a tenth.
 */
export const BANDS: readonly (readonly [number, number])[] = [[6, 12], [13, 17], [18, 29], [30, 39], [40, 49], [50, 59], [60, 75]];
export const YOUNG = { child: 0.1, teen: 0.1 } as const;

/** The weight of each band for a breakdown's gender; a part open to either, or non-binary, weighs men's and women's equally (the game's). */
export function ageWeights(g: Gender): number[] {
  if (g === 'open' || g === 'non-binary') {
    const [m, w] = [ageWeights('men'), ageWeights('women')];
    return m.map((x, i) => (x + (w[i] as number)) / 2);
  }
  const a = MAJOR_AGES[g];
  const young = 100 - a.thirties - a.over40;
  return [young * YOUNG.child, young * YOUNG.teen, young * (1 - YOUNG.child - YOUNG.teen), a.thirties, a.forties, a.over40 - a.forties - a.over60, a.over60];
}

/**
 * Each agreement's market: the language its breakdowns are written in (R-4620: the US breakdowns are English; the
 * game's for the UK's and Canada's English-language agreements; each market's own, as compiled) and
 * where casting reckons the actor's age (the market's city's zone).
 */
export const MARKET: Readonly<Record<Agreement, { readonly language: string; readonly zone: string }>> = {
  'sag-aftra': { language: 'en', zone: 'America/Los_Angeles' },
  'pact-equity': { language: 'en', zone: 'Europe/London' },
  'uk-theatre': { language: 'en', zone: 'Europe/London' },
  actra: { language: 'en', zone: 'America/Toronto' },
  ...(Object.fromEntries(Object.values(MARKETS).flatMap((m) => m.agreements.map((id) => [id, { language: m.language, zone: m.zone }]))) as Record<(typeof MARKET_AGREEMENTS)[number], { language: string; zone: string }>),
};

/** How well an actor must speak a part's language to be seen for it, the game's own (person.acting.model). */
export const FLUENT: Level = 'C1';

/** One of a table's entries, in proportion to its weight, for a draw in [0, 1). */
export function weighted<T>(table: readonly (readonly [T, number])[], u: number): T {
  let left = u * table.reduce((t, [, w]) => t + w, 0);
  // Stryker disable next-line MethodExpression: the last entry takes what is left, whether the loop reaches it or not.
  for (const [x, w] of table.slice(0, -1)) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it lands on a boundary with no probability.
    if (left < w) return x;
    left -= w;
  }
  return (table.at(-1) as readonly [T, number])[0];
}

/** Posts the next breakdown for a part: who it is written for, drawn at the trade's shares. */
function post(s: { acting: ActingSlice }, a: Part, c: Context): void {
  const part = partOf(a);
  const id = s.acting.breakdowns.length + 1;
  const d = c.draws('acting.work', 'breakdown', id);
  const gender = weighted(GENDER, d.float());
  const ethnicity = weighted(ETHNICITY, d.float());
  const ages = weighted(BANDS.map((b, i) => [b, ageWeights(gender)[i] as number] as const), d.float());
  s.acting.breakdowns.push({ id, at: c.now, part, gender, ethnicity, ages, language: MARKET[part.agreement].language });
}

export function breakdownOf(s: ActingSlice, id: number): Breakdown {
  const found = s.breakdowns.find((x) => x.id === id);
  if (found === undefined) throw new Error(`there's no breakdown ${id}`);
  return found;
}

/** Why the person isn't seen for a breakdown, or null where they fit it. */
export function misfit(p: Person, b: Breakdown, now: number): string | null {
  // @slate:consumer identity.make
  // A part for men is an actor's, one for women an actress's: casting reads what the person is billed as (the owner,
  // 2026-11-01: "Remember there's an 'Actor' and 'Actress'").
  if (b.gender === 'men' && p.billedAs !== 'actor') return 'the part is written for an actor';
  if (b.gender === 'women' && p.billedAs !== 'actress') return 'the part is written for an actress';
  if (b.gender === 'non-binary' && p.pronouns !== 'they') return 'the part is written for a non-binary performer';
  const [from, to] = playingAge(p, now, MARKET[b.part.agreement].zone);
  if (to < b.ages[0] || from > b.ages[1]) return `the part is for ${b.ages[0]} to ${b.ages[1]}, and you play ${from} to ${to}`;
  if (b.ethnicity !== 'open' && b.ethnicity !== 'silent' && !identifiesAs(p, b.ethnicity)) return `the breakdown names an ethnicity you don't give (${b.ethnicity})`;
  if (!speaks(p, b.language, FLUENT)) return `the part is played in ${b.language}, at ${FLUENT} or better`;
  return null;
}

export function auditionOf(s: ActingSlice, id: number): Audition {
  const found = s.auditions.find((x) => x.id === id);
  if (found === undefined) throw new Error(`there's no audition ${id}`);
  return found;
}

export interface AuditionArgs {
  [key: string]: number;
  breakdown: number;
}

/** Auditions for a part a breakdown puts out, where the person fits it: on tape or in the room, and booked or not. */
function audition(s: Acting, a: AuditionArgs, c: Context): void {
  // @slate:consumer acting.breakdown
  const b = breakdownOf(s.acting, a.breakdown);
  if (s.acting.auditions.some((x) => x.breakdown === b.id)) throw new Error(`you've auditioned for breakdown ${b.id}`);
  const p = personOf(s.identity);
  const why = misfit(p, b, c.now);
  if (why !== null) throw new Error(why);
  const part = b.part;
  // @slate:consumer attributes.choose
  const values = componentValues(s.attributes, 'actor');
  const id = s.acting.auditions.length + 1;
  const d = c.draws('acting.work', 'audition', id);
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the share with no probability.
  const taped = d.float() < TAPED;
  // @slate:consumer identity.make
  // @slate:consumer identity.headshot
  if (p.headshot === null) throw new Error("a submission goes out under a headshot, and you haven't one");
  const k = auditionSkill(values, part, taped);
  const score = clamp(k + spread(k) * (2 * d.float() - 1), 0, 100);
  // Stryker disable next-line EqualityOperator: as above.
  const booked = d.float() < bookingChance(score, credit(s.acting));
  s.acting.auditions.push({ id, at: c.now, breakdown: b.id, part, taped, score, booked, work: null });
  practise(s.attributes, 'actor', [...demands(part), ...ROOM, ...(taped ? ['self-taping'] : [])], 1);
}

export interface PlayArgs {
  [key: string]: Json;
  audition: number;
  /** The account the part is paid into. */
  account: string;
}

/** Plays a part booked: how well, as the actor is in what it asks, and what it pays. */
/** The country each agreement's work is in: SAG-AFTRA's the US, Pact/Equity's and UK Theatre's the UK, ACTRA's Canada, a market's its own. */
export const COUNTRY: Readonly<Record<Agreement, CountryCode>> = {
  'sag-aftra': 'US',
  'pact-equity': 'GB',
  'uk-theatre': 'GB',
  actra: 'CA',
  ...(Object.fromEntries(MARKET_AGREEMENTS.map((id) => [id, (COMPILED[id] as MarketAgreement).country])) as Record<(typeof MARKET_AGREEMENTS)[number], CountryCode>),
};

/** The line that tells the player what of a market isn't known. */
export const UNKEPT_LINE: LineId = 'acting.unkept';
/** Each item a market's research couldn't find, as the player is told it. */
export const MISSING: Readonly<Record<Unknown, string>> = {
  agreements: 'some of the agreements parts are engaged under',
  rates: 'some of the minimums parts are paid',
  none: 'whether anything sets the pay where no agreement does',
  union: "the union's fees or whether a part needs it",
  language: 'the language parts are cast in',
  market: 'where most of the work is',
  terms: 'what terms a part is engaged on',
  successors: 'the terms of the places that succeeded it',
};

/**
 * What the player is told of a country, or of an agreement's, where its research couldn't find all of it: "a, b and
 * c"; nothing where it is known whole. A territory's agreement that follows another country's tells what neither
 * country's research found.
 */
export function aboutMarket(where: Agreement | CountryCode): string | undefined {
  const a = marketOf(where as Agreement);
  const country = a?.country ?? (where as CountryCode);
  const followed = a?.follows === undefined ? [] : (UNKNOWN[(marketOf(a.follows) as MarketAgreement).country] as readonly Unknown[]);
  const missing = [...new Set([...(UNKNOWN[country] ?? []), ...followed])].map((u) => MISSING[u]);
  if (missing.length === 0) return undefined;
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1) as string}` : (missing[0] as string);
  return t(UNKEPT_LINE, { country: countryName(country), missing: list });
}

/**
 * The slices a part played reads besides its own: whether the person may work there reads every role's days and
 * permits, and, for a minor, what the law of the work's country needs first (person.youth); its pay goes into an
 * account, taxed, less what that law sets aside.
 */
type Playing = Acting & Earning & { unions: UnionsSlice; permits: PermitsSlice; directing: DirectingSlice; producing: ProducingSlice; youth: YouthSlice };

function play(s: Playing, a: PlayArgs, c: Context): void {
  const job = auditionOf(s.acting, a.audition);
  // @slate:consumer acting.audition
  if (!job.booked) throw new Error(`audition ${a.audition} didn't book the part`);
  if (job.work !== null) throw new Error(`the part from audition ${a.audition} is played`);
  const where = COUNTRY[job.part.agreement];
  // @slate:consumer permits.decision
  if (!permitted(s, where, c.now, daysWorked(job.part))) throw new Error(`the person may not work in ${where} without a permit`);
  // @slate:consumer unions.join
  if (!mayTakeUnionWork(s, job.part.agreement, c.now)) throw new Error(`a part under ${job.part.agreement} past the thirtieth day of union work is a member's`);
  // A minor's part is engaged as the work's country's law lets them take it (person.youth), its days at the hours it allows.
  const grant = engagement(s, where, 'performer', c.now);
  if (grant !== null) grant.used = true;
  const share = hoursShare(personOf(s.identity), where, 'performer', c.now);
  // @slate:consumer attributes.choose
  const k = partSkill(componentValues(s.attributes, 'actor'), job.part);
  const quality = clamp(k + spread(k) * (2 * c.draws('acting.work', 'perform', job.id).float() - 1), 0, 100);
  const paid = pay(job.part, dateOf(c.now), experience(s.acting, c.now));
  job.work = { at: c.now, quality, pay: paid };
  // The production pays the part into the account named, less what the country withholds (money.tax).
  if (paid !== null) holdBack(s, earn(s, { account: a.account, payer: 'production', country: where, home: residenceOf(personOf(s.identity)), work: 'performer', gross: paid, what: 'pay' }, c), `acting:${job.id}`, c);
  practise(s.attributes, 'actor', demands(job.part), daysWorked(job.part) * share);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const postBreakdown = defineCommand<{ acting: ActingSlice }, Part>({ id: 'acting.breakdown', reads: [], writes: ['acting'], run: post });
export const auditionForPart = defineCommand<Acting, AuditionArgs>({ id: 'acting.audition', reads: ['identity'], writes: ['attributes', 'acting'], run: audition });
export const playPart = defineCommand<Playing, PlayArgs>({ id: 'acting.perform', reads: ['identity', 'unions', 'permits', 'directing', 'producing'], writes: ['attributes', 'acting', 'accounts', 'ledger', 'tax', 'schedule', 'youth'], run: play });
