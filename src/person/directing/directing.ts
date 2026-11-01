import { defineCommand, type Context, type Json } from '../../core/frame/frame.ts';
import { add, allocate, compare, fromMajor, money, multiply, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { earn, type Earning } from '../../money/tax/tax.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { dateOf, UNIT_DAYS, WEEK_DAYS } from '../acting/acting.ts';
import { ATTRIBUTES, componentValues, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { inTheBusiness, personOf, residenceOf, type IdentitySlice } from '../identity/identity.ts';
import { spread } from '../work/work.ts';
import type { ActingSlice } from '../acting/acting.ts';
import { permitted, type PermitsSlice } from '../permits/permits.ts';
import type { ProducingSlice } from '../producing/producing.ts';
import compiled from './markets.json' with { type: 'json' };

/**
 * The director's work and how good it comes out (BUILD-ORDER layer 4; the owner, 2026-10-31: "I want my attributes to
 * effect the quality of my work ... it needs to actually produce results depending on how bad or good I am"; and of
 * 2026-11-01, "Build them").
 *
 * A film or an episode is prepped, shot and cut, then a feature goes to festivals, and a debut feature may lead to a
 * second. Its parts come from the director's broad attributes, each read through its researched components and their
 * facets (R-4610): the story told from Vision and Script Sense, the performances from Working With Actors, the images
 * from Visual Craft, the cut from Editing. Leadership holds the schedule and carries a short one; Leadership and
 * Communication bring the plan to the set; Communication pitches the next film.
 *
 * The trade's own figures (R-4613): the DGA's guaranteed periods and minimums for 2026-27 (a feature's two weeks of prep
 * and thirteen weeks paid, at the Low Budget Sideletter's level for a budget of $11 million or less; a network episode's
 * prep and shooting days and its program rate); the Director's Cut (ten weeks or a day for every two shooting days,
 * whichever is longer, above $11 million; the sideletter's periods below; four days for an hour episode, a day and up to
 * one more for a half-hour); a feature's 32 shooting days (the CNC's mean, 2024); each festival's selection rate, as
 * its own counts give it; a debut director's chance of a second feature within five years (25.3%; 45% where the debut
 * found an audience; Stephen Follows's count of 146,603 debuts), moved by a family in the business as Follows's debut
 * directors were (72% of those with family in film or TV went on to a second feature against 66% of everyone else; R-4622).
 *
 * Beyond the US, the market of every country and territory whose research the engine can read (src/person/directing/
 * markets.json, compiled by tools/person/markets-director from the research, person.markets.director.<CC>): a job there
 * is engaged under one of the market's agreements, paid its minimum fees (a statute's floor of a director's pay where
 * the research reads one as theirs) and given the periods it guarantees; where the research says nothing sets the pay,
 * or couldn't find what does, there is no minimum, and the player is told what isn't known.
 *
 * The model's own figures (the spreads, how far a short schedule or a short cut carries, what the set takes from a
 * director's plan, a festival's pool and steepness, what a festival's selection says of an audience, what a pitch adds)
 * are the game's until the owner balances them (person.directing.model).
 */

/** The line that tells the player these figures are the game's own (person.directing.model). */
export const MODEL_LINE: LineId = 'directing.model';

export type Form = 'feature' | 'hour' | 'half-hour';

/** The parts of a film and the broad attributes each comes from. */
export const PARTS = {
  story: ['vision', 'script-sense'],
  performances: ['working-with-actors'],
  images: ['visual-craft'],
  cut: ['editing'],
} as const;
export type Part = keyof typeof PARTS;

/** The parts planned in prep and carried through the shoot; the cut comes after. */
export const PLANNED = ['story', 'performances', 'images'] as const;
export type Planned = (typeof PLANNED)[number];

/**
 * A network prime-time episode under the DGA's 2026-27 rate card: its program rate (USD), its guaranteed prep and
 * shooting days, and the Director's Cut (BA 7-505: four days for an hour, one day and up to one more for a half-hour).
 */
export const EPISODES = {
  hour: { rate: 58808, prep: 7, shoot: 8, cut: 4 },
  'half-hour': { rate: 34629, prep: 3, shoot: 4, cut: 2 },
} as const;

/** A theatrical feature's guaranteed prep (two weeks) and the weeks its minimum pays (2 prep, 10 employment, 1 cutting). */
export const FEATURE = { prep: 14, weeks: 13 } as const;

/** A feature's shooting days, the CNC's mean for French-initiative fiction features approved in 2024 (5,738 over 180). */
export const FEATURE_SHOOT = 32;

/**
 * The DGA's levels for a feature by budget (USD, at most `upTo`): the weekly minimum (null where the Low Budget
 * Sideletter leaves pay to negotiation, $3 million or less) and the Director's Cut in days given the shooting days.
 */
export const LEVELS: readonly { readonly upTo: number; readonly weekly: number | null; cut(shoot: number): number }[] = [
  { upTo: 3_000_000, weekly: null, cut: (shoot) => Math.max(20, shoot) },
  { upTo: 4_000_000, weekly: 8321, cut: () => 56 },
  { upTo: 8_500_000, weekly: 18911, cut: () => 70 },
  { upTo: 11_000_000, weekly: 22693, cut: () => 70 },
  { upTo: Infinity, weekly: 25214, cut: (shoot) => Math.max(70, shoot / 2) },
];

export const levelOf = (budget: number) => LEVELS.find((l) => budget <= l.upTo) as (typeof LEVELS)[number];

/** Each festival's selection rate from its own counts: Sundance 2026's features, Cannes 2026's Official Selection, the Berlinale's and TIFF's 2025 films. */
export const FESTIVALS = {
  sundance: 90 / 4255,
  cannes: 72 / 2541,
  berlinale: 252 / 8085,
  tiff: 285 / 9020,
} as const;
export type Festival = keyof typeof FESTIVALS;

/** A festival's rate holds for a film at the pool's middle (the game's 50); its chance grows as the fifth power of quality over it. */
export const POOL = 50;
export const STEEP = 5;

/** A debut director's chance of a second feature within five years; where the debut found an audience (R-4613). */
export const SECOND = { debut: 0.253, audience: 0.45 } as const;

/**
 * Follows's 1,804 directors whose debut since 2000 found a meaningful audience: 72% of those with family in film or TV
 * made a second feature against 66% of everyone else; and 26% of the top films' directors had family in it (R-4622).
 */
export const KIN = { share: 0.26, family: 0.72, other: 0.66 } as const;

/**
 * What a family in the business does to the chance of a second: its side's rate over the directors' mean, so the two sides
 * average back to the sourced rate of all debuts (the game's reading of "another roll of the dice when a film disappoints").
 */
export const kinship = (family: boolean): number => (family ? KIN.family : KIN.other) / (KIN.share * KIN.family + (1 - KIN.share) * KIN.other);

export interface Film {
  readonly id: number;
  readonly form: Form;
  /** The country of the market it is made in, and the agreement it is directed under (the DGA's in the US). */
  readonly country: string;
  readonly agreement: string;
  /** Its budget, in its market's currency (USD in the US); null where its terms don't read one. */
  readonly budget: number | null;
  /** Its running time, where its agreement pays by it. */
  readonly minutes: number | null;
  readonly started: number;
  readonly prepDays: number;
  readonly shootDays: number;
  /** The Director's Cut the agreement guarantees (or the contract gives), in days. */
  readonly cutDays: number;
  /** The agreement's minimum for the job; null where it is left to negotiation or isn't known. */
  readonly fee: Money | null;
  /** What prep made of each part, 0 to 100. */
  plan: Record<Planned, number>;
  /** The days the shoot needed from this director. */
  needed: number | null;
  /** What the shoot brought to the screen. */
  shot: Record<Planned, number> | null;
  cut: number | null;
  /** The finished film, 0 to 100: its four parts' mean. */
  quality: number | null;
  /** Each festival it went to and whether it was chosen. */
  festivals: { [festival: string]: boolean };
}

export interface DirectingSlice {
  films: Film[];
  /** Whether the debut led to a second feature within five years; null until tried. */
  second: boolean | null;
}

export const DIRECTING_START: DirectingSlice = { films: [], second: null };

type Values = Readonly<Record<string, number>>;
type Directing = { attributes: AttributesSlice; directing: DirectingSlice };
type Pursuing = Directing & { identity: IdentitySlice };
/** A film shot or cut: where the director works, so whether they may work there reads the person, every role's days and the permits. */
type Working = Directing & Earning & { identity: IdentitySlice; acting: ActingSlice; producing: ProducingSlice; permits: PermitsSlice };
/** Prep is paid: its share of the fee into an account, taxed where the person lives. */
type Prepping = Directing & Earning & { identity: IdentitySlice };

/** Refuses the work where the person may not work in the film's country for its days (papers.permits); prep books it, as an audition books a part. */
function mayWorkOn(s: Working, film: Film, now: number): void {
  const e = engagement(film);
  // @slate:consumer permits.decision
  if (!permitted(s, e.country as CountryCode, now, e.days, 'director')) throw new Error(`the person may not work in ${e.country} without a permit`);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mean = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const of = (v: Values, id: string) => skillOf(v, 'director', id);

/** The components a broad attribute covers. */
const componentsOf = (broad: string): string[] => (ATTRIBUTES.director.find((a) => a.id === broad) as (typeof ATTRIBUTES.director)[number]).covers.map((c) => c.id);
const used = (part: Part): string[] => PARTS[part].flatMap(componentsOf);

/** What the director can do in a part: the mean of the components of its attributes, each through its facets. */
export const partSkill = (v: Values, part: Part): number => mean(used(part).map((id) => of(v, id)));


/** How far short time leaves the work: whole when the days are enough; Adaptability carries more of a short stretch. */
export function finish(v: Values, days: number, needed: number): number {
  return 1 - (1 - Math.min(1, days / needed)) * (0.6 - (0.3 * of(v, 'adaptability')) / 100);
}

/**
 * The shooting days a director needs: the trade's schedule (the CNC's 32 for a feature, the DGA's guaranteed period for
 * an episode) for one at 50 in holding a schedule (Time Management, and planning each shot), a quarter less at 100, a
 * quarter more at 0.
 */
export function shootNeeded(v: Values, film: Pick<Film, 'form'>): number {
  const pace = 0.6 * of(v, 'time-management') + 0.4 * of(v, 'plan-each-shot-framing-composition-camera-movement-sound-act');
  const base = film.form === 'feature' ? FEATURE_SHOOT : EPISODES[film.form].shoot;
  return base * (1.25 - (0.5 * pace) / 100);
}

/** What the set takes of the plan, 0.8 to 1: leading the cast and crew, coordinating them, briefing and hearing them. */
export const onSet = (v: Values): number => 0.8 + (0.2 * mean(['lead-cast-and-crew', 'coordination', 'speech-clarity', 'active-listening'].map((id) => of(v, id)))) / 100;

/**
 * The cutting days the footage needs: a day for each shooting day from a director at 0 in Editing (the sideletter's
 * floor for the smallest films), a day for every two from one at 100 (the Basic Agreement's ratio).
 */
export const cutNeeded = (v: Values, shootDays: number): number => shootDays * (1 - (0.5 * partSkill(v, 'cut')) / 100);

/** A festival's chance of choosing a film: its rate at the pool's middle, more for better, never past certain. */
export const selectionChance = (festival: Festival, quality: number): number => Math.min(1, FESTIVALS[festival] * (quality / POOL) ** STEEP);

/** How a director pitches the next film, 0 to 100: pitching and presenting it, Persuasion, promoting the last. */
export const pitchSkill = (v: Values): number => mean(['pitching-and-presenting-the-project', 'persuasion', 'promote-productions-through-interviews-and-public-appearance'].map((id) => of(v, id)));

/** The chance the debut leads to a second feature within five years: the sourced rate, as a family and the pitch carry it. */
export const secondChance = (v: Values, audience: boolean, family: boolean): number => (audience ? SECOND.audience : SECOND.debut) * kinship(family) * (0.5 + pitchSkill(v) / 100);

const wholeAtLeast = (n: unknown, lo: number, what: string) => {
  if (!Number.isInteger(n) || (n as number) < lo) throw new RangeError(`${what} is a whole number of at least ${lo} (${String(n)})`);
};

export function filmOf(s: DirectingSlice, id: number): Film {
  const found = s.films.find((f) => f.id === id);
  if (found === undefined) throw new Error(`there's no film ${id}`);
  return found;
}

export interface PrepArgs {
  [key: string]: Json;
  form: Form;
  /** The market's country (the US where none is named) and, where several cover the form there, its agreement. */
  country?: string;
  agreement?: string;
  /** Its budget in the market's currency (a feature's in the US; abroad, where the agreement reads it) and its shooting days. */
  budget?: number;
  shoot?: number;
  /** Abroad, the prep and cut the contract gives, where the agreement guarantees none; the running time, where it pays by it. */
  prep?: number;
  cut?: number;
  minutes?: number;
  /** The account prep's share of the fee is paid into, where the fee is known. */
  account?: string;
}

type Terms = Pick<Film, 'country' | 'agreement' | 'budget' | 'minutes' | 'prepDays' | 'shootDays' | 'cutDays' | 'fee'>;

/** The schedule and the pay of a job in the US, as the DGA sets them. */
function dgaTerms(a: PrepArgs): Terms {
  if (a.agreement !== undefined || a.prep !== undefined || a.cut !== undefined || a.minutes !== undefined) throw new Error("the DGA sets a US job's agreement, prep and cut, and reads no running time");
  const us = { country: 'US', agreement: 'dga', minutes: null };
  if (a.form === 'feature') {
    wholeAtLeast(a.budget, 1, 'a budget');
    wholeAtLeast(a.shoot, 1, 'the shooting days');
    const budget = a.budget as number;
    const shoot = a.shoot as number;
    const level = levelOf(budget);
    return { ...us, budget, prepDays: FEATURE.prep, shootDays: shoot, cutDays: level.cut(shoot), fee: level.weekly === null ? null : money('USD', level.weekly * FEATURE.weeks * 100) };
  }
  if (a.budget !== undefined || a.shoot !== undefined) throw new Error("an episode's budget and schedule are the show's");
  const e = EPISODES[a.form];
  return { ...us, budget: null, prepDays: e.prep, shootDays: e.shoot, cutDays: e.cut, fee: money('USD', e.rate * 100) };
}

/** What a market's research couldn't find, by the item its blockers name. */
export type Unknown = 'agreement' | 'fees' | 'periods' | 'union' | 'language' | 'none' | 'terms';
type Range = readonly [number, number | null];
type Tier = 'budget' | 'years' | 'minutes' | 'days';
type When = Readonly<Partial<Record<Tier, Range>>>;
export type Stage = 'prep' | 'shoot' | 'cut';
export type Per = 'job' | 'share' | 'minute' | 'day' | 'half-day' | 'week' | 'month' | 'hour';
export interface Fee {
  readonly form: Form;
  readonly per: Per;
  readonly phases: readonly Stage[];
  readonly when: When;
  readonly band: Range | null;
  readonly floor: string | null;
  readonly first: string | null;
  readonly steps: readonly (readonly [string, string])[];
}
export interface MarketAgreement {
  readonly country: string;
  readonly forms: readonly Form[];
  readonly currency: CurrencyCode | null;
  readonly none: boolean;
  readonly month: number | null;
  readonly short: { readonly upTo: number; readonly share: string } | null;
  readonly fees: readonly Fee[];
  readonly periods: readonly { readonly form: Form; readonly part: 'prep-shoot' | 'cut' | 'prep'; readonly when: When; readonly days: number }[];
}
export interface Market {
  readonly agreements: readonly string[];
  readonly unknown: readonly Unknown[];
}
export const MARKETS = (compiled as unknown as { markets: Readonly<Record<string, Market>> }).markets;
export const AGREEMENTS = (compiled as unknown as { agreements: Readonly<Record<string, MarketAgreement>> }).agreements;

/** The hours of a day the engagement works where a fee is by the hour: the game's eight (person.directing.model). */
export const HOURS = 8;

const holds = (when: When, values: Readonly<Record<Tier, number>>): boolean => (Object.entries(when) as [Tier, Range][]).every(([k, [lo, hi]]) => values[k] >= lo && (hi === null || values[k] <= hi));

/** The amount of a fee's step in force on a date: the latest begun by then. shortcut: past an agreement's term its last amount is kept (person.markets.model). */
export function stepAt(steps: Fee['steps'], date: string): string {
  const step = steps.findLast(([from]) => from <= date);
  if (step === undefined) throw new Error(`no minimum is known before ${(steps[0] as readonly [string, string])[0]}`);
  return step[1];
}

/** The director's whole years in the work on a day: since the first film they prepped, none before it. */
export function experience(s: DirectingSlice, now: number): number {
  const first = s.films[0];
  if (first === undefined) return 0;
  const [since, today] = [dateOf(first.started), dateOf(now)];
  return Number(today.slice(0, 4)) - Number(since.slice(0, 4)) - (today.slice(5) < since.slice(5) ? 1 : 0);
}

/** How many of a count's units a band pays: from its first to its last, every one where none. */
export const within = (n: number, band: Range | null): number => (band === null ? n : Math.max(0, Math.min(n, band[1] ?? n) - band[0] + 1));

export interface Job {
  budget: number;
  minutes: number;
  days: Readonly<Record<Stage, number>>;
  years: number;
  first: boolean;
}

/**
 * What one fee pays a job on a date: the job's; a share of the budget, no less than its floor; each minute of the film
 * it pays; or each day, half-day or hour of the stages it pays (a week five days, as the actor's engine counts it; a
 * month the agreement's days, or the actor's 21), cut on a first job where the agreement lets it, more for a short one.
 */
export function feePays(a: MarketAgreement, f: Fee, job: Job, date: string): Money {
  const currency = a.currency as CurrencyCode;
  const v = stepAt(f.steps, date);
  if (f.per === 'share') {
    const share = multiply(fromMajor(currency, String(job.budget)), v);
    const floor = f.floor === null ? share : fromMajor(currency, f.floor);
    // Stryker disable next-line EqualityOperator: a share equal to its floor is the floor.
    return compare(share, floor) < 0 ? floor : share;
  }
  const rate = fromMajor(currency, v);
  let pays: Money;
  if (f.per === 'job') pays = rate;
  else if (f.per === 'minute') pays = multiply(rate, String(within(job.minutes, f.band)));
  else {
    const days = f.phases.reduce((n, p) => n + job.days[p], 0);
    const unit = rational({ day: '1', 'half-day': '0.5', hour: String(1 / HOURS), week: String(WEEK_DAYS), month: String(a.month ?? UNIT_DAYS.month) }[f.per]);
    // A banded pay counts whole units (days, half-days); the rest pay the engagement's days pro rata.
    const [num, den] = f.band === null ? [BigInt(days) * unit.den, unit.num] : [BigInt(within((days * Number(unit.den)) / Number(unit.num), f.band)), 1n];
    pays = money(currency, Number(roundHalfEven(BigInt(rate.minor) * num, den)));
    const total = job.days.prep + job.days.shoot + job.days.cut;
    if (a.short !== null && total <= a.short.upTo) pays = add(pays, multiply(pays, a.short.share));
  }
  return f.first !== null && job.first ? multiply(pays, f.first) : pays;
}

/** A job's minimum under a market's agreement: every fee whose tiers hold for it, added; none where none holds. */
export function marketFee(a: MarketAgreement, form: Form, job: Job, date: string): Money | null {
  const total = job.days.prep + job.days.shoot + job.days.cut;
  const values = { budget: job.budget, minutes: job.minutes, years: job.years, days: total };
  const fees = a.fees.filter((f) => f.form === form && holds(f.when, values));
  return fees.length === 0 ? null : fees.map((f) => feePays(a, f, job, date)).reduce(add);
}

/** The schedule and the pay of a job in a market: its agreement's periods (or the contract's) and its minimum on the day prep starts. */
function marketTerms(a: PrepArgs, s: DirectingSlice, now: number): Terms {
  const cc = String(a.country);
  if (!Object.hasOwn(MARKETS, cc)) throw new Error(`there's no market ${cc}`);
  const covering = (MARKETS[cc] as Market).agreements.filter((id) => (AGREEMENTS[id] as MarketAgreement).forms.includes(a.form));
  if (covering.length === 0) throw new Error(`no agreement the game knows covers a ${a.form} in ${cc}`);
  const id = a.agreement ?? (covering.length === 1 ? covering[0] : undefined);
  if (id === undefined) throw new Error(`a ${a.form} in ${cc} names its agreement: ${covering.join(', ')}`);
  if (!covering.includes(id)) throw new Error(`${id} doesn't cover a ${a.form} in ${cc}`);
  const ag = AGREEMENTS[id] as MarketAgreement;
  const periods = ag.periods.filter((p) => p.form === a.form);
  // What the agreement's tiers turn on is asked, what they don't refused (the compile holds a share's and a minute's pay to a tier of theirs).
  const reads = (k: 'budget' | 'minutes') => [...ag.fees, ...ag.periods].some((x) => k in x.when);
  const asked = (k: 'budget' | 'minutes', what: string): number | null => {
    if (reads(k)) return (wholeAtLeast(a[k], 1, `the ${what}`), a[k] as number);
    if (a[k] !== undefined) throw new Error(`${id} doesn't read a ${a.form}'s ${what}`);
    return null;
  };
  const budget = asked('budget', 'budget');
  const minutes = asked('minutes', 'running time');
  wholeAtLeast(a.shoot, 1, 'the shooting days');
  const shoot = a.shoot as number;
  const tier = { budget: budget ?? 0, minutes: minutes ?? 0, years: experience(s, now), days: 0 };
  const guaranteed = (part: 'prep-shoot' | 'cut' | 'prep') => periods.find((p) => p.part === part && holds(p.when, tier))?.days;
  const contract = (k: 'prep' | 'cut', days: number | undefined): number => {
    if (days === undefined) return (wholeAtLeast(a[k], 1, `the ${k} days`), a[k] as number);
    if (a[k] !== undefined) throw new Error(`${id} guarantees a ${a.form}'s ${k}`);
    return days;
  };
  const both = guaranteed('prep-shoot');
  if (shoot > (both ?? Infinity)) throw new Error(`${id} guarantees a ${a.form} ${both} days of prep and shoot, fewer than its shoot`);
  // A prep guaranteed apart from the shoot is its own; one guaranteed with it is what the shoot leaves (the compile allows one of the two to a form).
  const prepDays = contract('prep', guaranteed('prep') ?? (both === undefined ? undefined : both - shoot));
  const cutDays = contract('cut', guaranteed('cut'));
  // @slate:consumer directing.prep
  const job: Job = { ...tier, days: { prep: prepDays, shoot, cut: cutDays }, first: s.films.length === 0 };
  return { country: cc, agreement: id, budget, minutes, prepDays, shootDays: shoot, cutDays, fee: marketFee(ag, a.form, job, dateOf(now)) };
}

/** The schedule and the pay of a job: the DGA's in the US, a market's agreement's abroad. */
function terms(a: PrepArgs, s: DirectingSlice, now: number): Terms {
  if (a.form !== 'feature' && !(a.form in EPISODES)) throw new Error(`there's no form ${String(a.form)}`);
  return a.country === undefined || a.country === 'US' ? dgaTerms(a) : marketTerms(a, s, now);
}

/** A job's engagement, for the permit it may need: the country it is made in and the days it works there. */
export const engagement = (film: Film): { country: string; days: number } => ({ country: film.country, days: film.prepDays + film.shootDays + film.cutDays });

/** The line that tells the player what of a market isn't known. */
export const UNKEPT_LINE: LineId = 'directing.unkept';
/** Each item a market's research couldn't find, as the player is told it. */
export const MISSING: Readonly<Record<Unknown, string>> = {
  agreement: 'some of the agreements a director is engaged under',
  fees: 'some of the minimum fees',
  periods: 'the prep, shoot and cut a director is guaranteed',
  union: "the guild's fees or how a director joins",
  language: 'the language the work is made in',
  none: 'whether anything sets the pay where no agreement does',
  terms: "whether any agreement, guild's rate or law sets a director's terms",
};

/** What the player is told of a market where its research couldn't find all of it: "a, b and c"; nothing where it is known whole, or in the US. */
export function aboutMarket(country: string): string | undefined {
  const missing = (Object.hasOwn(MARKETS, country) ? (MARKETS[country] as Market).unknown : []).map((u) => MISSING[u]);
  if (missing.length === 0) return undefined;
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1) as string}` : (missing[0] as string);
  return t(UNKEPT_LINE, { country: countryName(country as CountryCode), missing: list });
}

/** Whether a feature can be prepped: a debut always; a second only once the debut has led to one. */
function mayDirectFeature(s: DirectingSlice): void {
  const features = s.films.filter((f) => f.form === 'feature').length;
  // @slate:consumer directing.pursue
  if (features === 1 && s.second !== true) throw new Error('a second feature needs the debut to lead to one');
}

export const STAGES: readonly Stage[] = ['prep', 'shoot', 'cut'];

/**
 * What a stage of the work pays of a film's fee: its days' share of it, prep, shoot and cut, the periods the
 * agreement guarantees (the game's reading of a fee paid as the work is done, money.tax.model); none where the fee is
 * left to negotiation.
 */
export function stagePay(film: Pick<Film, 'fee' | 'prepDays' | 'shootDays' | 'cutDays'>, stage: Stage): Money | null {
  // In hundredths of a day: the Director's Cut can run to half a day (75.5 for a 151-day shoot).
  return film.fee === null ? null : (allocate(film.fee, [film.prepDays, film.shootDays, film.cutDays].map((d) => Math.round(d * 100)))[STAGES.indexOf(stage)] as Money);
}

/** Pays a stage's share of the fee into the account named, less what the film's country withholds (money.tax). */
function paidFor(s: Prepping, film: Film, stage: Stage, account: string, c: Context): void {
  const part = stagePay(film, stage);
  // @slate:consumer identity.make
  if (part !== null && part.minor > 0) earn(s, { account, payer: 'production', country: film.country, home: residenceOf(personOf(s.identity)), work: 'director', gross: part, what: stage }, c);
}

/** Preps a film or an episode: casts it, plans its shots and its story, in the prep its agreement guarantees or its contract gives. */
function prep(s: Prepping, a: PrepArgs, c: Context): void {
  const t = terms(a, s.directing, c.now);
  if (a.form === 'feature') mayDirectFeature(s.directing);
  // @slate:consumer attributes.choose
  const values = componentValues(s.attributes, 'director');
  const id = s.directing.films.length + 1;
  const plan = {} as Record<Planned, number>;
  for (const p of PLANNED) {
    const k = partSkill(values, p);
    plan[p] = clamp(k + spread(k) * (2 * c.draws('directing.work', 'plan', id, p).float() - 1), 0, 100);
  }
  s.directing.films.push({ id, form: a.form, started: c.now, ...t, plan, needed: null, shot: null, cut: null, quality: null, festivals: {} });
  paidFor(s, s.directing.films.at(-1) as Film, 'prep', String(a.account), c);
  practise(s.attributes, 'director', [...used('story'), ...used('performances'), ...used('images')], t.prepDays);
}

export interface FilmArgs {
  [key: string]: Json;
  film: number;
  /** The account the stage's share of the fee is paid into. */
  account: string;
}

/** Shoots it: what prep planned, as far as the schedule and the set carry it. */
function shoot(s: Working, a: FilmArgs, c: Context): void {
  const values = componentValues(s.attributes, 'director');
  const film = filmOf(s.directing, a.film);
  if (film.shot !== null) throw new Error(`film ${a.film} is shot`);
  mayWorkOn(s, film, c.now);
  const needed = shootNeeded(values, film);
  const carried = finish(values, film.shootDays, needed) * onSet(values);
  const shot = {} as Record<Planned, number>;
  // @slate:consumer directing.prep
  for (const p of PLANNED) shot[p] = film.plan[p] * carried;
  film.needed = needed;
  film.shot = shot;
  paidFor(s, film, 'shoot', a.account, c);
  practise(s.attributes, 'director', [...used('performances'), ...used('images'), ...componentsOf('leadership'), ...componentsOf('communication')], film.shootDays);
}

/** The finished film: its four parts' mean. */
function finished(film: Film, cut: number): number {
  // @slate:consumer directing.shoot
  const shot = film.shot as Record<Planned, number>;
  return mean([...PLANNED.map((p) => shot[p]), cut]);
}

/** Cuts it, in the Director's Cut its agreement guarantees or its contract gives. */
function cut(s: Working, a: FilmArgs, c: Context): void {
  const values = componentValues(s.attributes, 'director');
  const film = filmOf(s.directing, a.film);
  if (film.shot === null) throw new Error(`film ${a.film} isn't shot`);
  if (film.cut !== null) throw new Error(`film ${a.film} is cut`);
  // Cut where the shoot was: the research and the agreements place the cut nowhere else.
  mayWorkOn(s, film, c.now);
  const k = partSkill(values, 'cut');
  // @slate:consumer directing.prep
  const f = finish(values, film.cutDays, cutNeeded(values, film.shootDays));
  film.cut = clamp(k * f + spread(k) * (2 * c.draws('directing.work', 'cut', film.id).float() - 1), 0, 100);
  film.quality = finished(film, film.cut);
  paidFor(s, film, 'cut', a.account, c);
  practise(s.attributes, 'director', used('cut'), film.cutDays);
}

/** A finished feature, refused otherwise. */
function finishedFeature(s: DirectingSlice, id: number): Film & { quality: number } {
  const film = filmOf(s, id);
  if (film.form !== 'feature') throw new Error(`film ${id} is an episode`);
  // @slate:consumer directing.cut
  if (film.quality === null) throw new Error(`film ${id} isn't cut`);
  return film as Film & { quality: number };
}

export interface SubmitArgs {
  [key: string]: number | string;
  film: number;
  festival: Festival;
}

/** Sends a finished feature to a festival, once to each. */
function submit(s: { directing: DirectingSlice }, a: SubmitArgs, c: Context): void {
  if (!(a.festival in FESTIVALS)) throw new Error(`there's no festival ${String(a.festival)}`);
  const film = finishedFeature(s.directing, a.film);
  if (a.festival in film.festivals) throw new Error(`film ${a.film} went to ${a.festival}`);
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  film.festivals[a.festival] = c.draws('directing.work', 'festival', film.id, a.festival).float() < selectionChance(a.festival, film.quality);
}

/** The debut's chance taken: whether it leads to a second feature within five years. */
function pursue(s: Pursuing, _a: Record<string, never>, c: Context): void {
  const debut = s.directing.films.find((f) => f.form === 'feature');
  if (debut === undefined) throw new Error('there is no debut feature');
  finishedFeature(s.directing, debut.id);
  if (s.directing.second !== null) throw new Error("the debut's chance is taken");
  const values = componentValues(s.attributes, 'director');
  // @slate:consumer identity.make
  // Follows counts family in film or TV (R-4622): a family in music is outside his split.
  const trade = inTheBusiness(personOf(s.identity));
  const family = trade !== null && trade !== 'music';
  // A debut chosen by a festival is read as one that found an audience (the game's reading of Follows's 1,000 votes).
  // @slate:consumer directing.submit
  const audience = Object.values(debut.festivals).includes(true);
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  s.directing.second = c.draws('directing.work', 'second', debut.id).float() < secondChance(values, audience, family);
  practise(s.attributes, 'director', componentsOf('communication'), 1);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const prepFilm = defineCommand<Prepping, PrepArgs>({ id: 'directing.prep', reads: ['identity'], writes: ['attributes', 'directing', 'accounts', 'ledger', 'tax', 'schedule'], run: prep });
export const shootFilm = defineCommand<Working, FilmArgs>({ id: 'directing.shoot', reads: ['identity', 'acting', 'producing', 'permits'], writes: ['attributes', 'directing', 'accounts', 'ledger', 'tax', 'schedule'], run: shoot });
export const cutFilm = defineCommand<Working, FilmArgs>({ id: 'directing.cut', reads: ['identity', 'acting', 'producing', 'permits'], writes: ['attributes', 'directing', 'accounts', 'ledger', 'tax', 'schedule'], run: cut });
export const submitFilm = defineCommand<{ directing: DirectingSlice }, SubmitArgs>({ id: 'directing.submit', reads: [], writes: ['directing'], run: submit });
export const pursueSecond = defineCommand<Pursuing, Record<string, never>>({ id: 'directing.pursue', reads: ['identity'], writes: ['attributes', 'directing'], run: pursue });
