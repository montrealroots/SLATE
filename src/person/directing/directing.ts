import { defineCommand, type Context, type Json } from '../../core/frame/frame.ts';
import { money, type Money } from '../../core/money/money.ts';
import type { LineId } from '../../core/text/text.ts';
import { ATTRIBUTES, componentValues, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { inTheBusiness, personOf, type IdentitySlice } from '../identity/identity.ts';
import { spread } from '../work/work.ts';

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
  /** A feature's budget, USD; null for an episode. */
  readonly budget: number | null;
  readonly started: number;
  readonly prepDays: number;
  readonly shootDays: number;
  /** The Director's Cut the DGA guarantees, in days. */
  readonly cutDays: number;
  /** The DGA's minimum for the job; null where it is left to negotiation. */
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
  /** A feature's budget, USD, and its scheduled shooting days; an episode's are the DGA's. */
  budget?: number;
  shoot?: number;
}

/** The schedule and the pay of a job, as the DGA sets them. */
function terms(a: PrepArgs): Pick<Film, 'budget' | 'prepDays' | 'shootDays' | 'cutDays' | 'fee'> {
  if (a.form === 'feature') {
    wholeAtLeast(a.budget, 1, 'a budget');
    wholeAtLeast(a.shoot, 1, 'the shooting days');
    const budget = a.budget as number;
    const shoot = a.shoot as number;
    const level = levelOf(budget);
    return { budget, prepDays: FEATURE.prep, shootDays: shoot, cutDays: level.cut(shoot), fee: level.weekly === null ? null : money('USD', level.weekly * FEATURE.weeks * 100) };
  }
  if (!(a.form in EPISODES)) throw new Error(`there's no form ${String(a.form)}`);
  if (a.budget !== undefined || a.shoot !== undefined) throw new Error("an episode's budget and schedule are the show's");
  const e = EPISODES[a.form];
  return { budget: null, prepDays: e.prep, shootDays: e.shoot, cutDays: e.cut, fee: money('USD', e.rate * 100) };
}

/** Whether a feature can be prepped: a debut always; a second only once the debut has led to one. */
function mayDirectFeature(s: DirectingSlice): void {
  const features = s.films.filter((f) => f.form === 'feature').length;
  // @slate:consumer directing.pursue
  if (features === 1 && s.second !== true) throw new Error('a second feature needs the debut to lead to one');
}

/** Preps a film or an episode: casts it, plans its shots and its story, in the DGA's guaranteed prep. */
function prep(s: Directing, a: PrepArgs, c: Context): void {
  const t = terms(a);
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
  practise(s.attributes, 'director', [...used('story'), ...used('performances'), ...used('images')], t.prepDays);
}

export interface FilmArgs {
  [key: string]: number;
  film: number;
}

/** Shoots it: what prep planned, as far as the schedule and the set carry it. */
function shoot(s: Directing, a: FilmArgs): void {
  const values = componentValues(s.attributes, 'director');
  const film = filmOf(s.directing, a.film);
  if (film.shot !== null) throw new Error(`film ${a.film} is shot`);
  const needed = shootNeeded(values, film);
  const carried = finish(values, film.shootDays, needed) * onSet(values);
  const shot = {} as Record<Planned, number>;
  // @slate:consumer directing.prep
  for (const p of PLANNED) shot[p] = film.plan[p] * carried;
  film.needed = needed;
  film.shot = shot;
  practise(s.attributes, 'director', [...used('performances'), ...used('images'), ...componentsOf('leadership'), ...componentsOf('communication')], film.shootDays);
}

/** The finished film: its four parts' mean. */
function finished(film: Film, cut: number): number {
  // @slate:consumer directing.shoot
  const shot = film.shot as Record<Planned, number>;
  return mean([...PLANNED.map((p) => shot[p]), cut]);
}

/** Cuts it, in the Director's Cut the DGA guarantees. */
function cut(s: Directing, a: FilmArgs, c: Context): void {
  const values = componentValues(s.attributes, 'director');
  const film = filmOf(s.directing, a.film);
  if (film.shot === null) throw new Error(`film ${a.film} isn't shot`);
  if (film.cut !== null) throw new Error(`film ${a.film} is cut`);
  const k = partSkill(values, 'cut');
  // @slate:consumer directing.prep
  const f = finish(values, film.cutDays, cutNeeded(values, film.shootDays));
  film.cut = clamp(k * f + spread(k) * (2 * c.draws('directing.work', 'cut', film.id).float() - 1), 0, 100);
  film.quality = finished(film, film.cut);
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
export const prepFilm = defineCommand<Directing, PrepArgs>({ id: 'directing.prep', reads: [], writes: ['attributes', 'directing'], run: prep });
export const shootFilm = defineCommand<Directing, FilmArgs>({ id: 'directing.shoot', reads: [], writes: ['attributes', 'directing'], run: shoot });
export const cutFilm = defineCommand<Directing, FilmArgs>({ id: 'directing.cut', reads: [], writes: ['attributes', 'directing'], run: cut });
export const submitFilm = defineCommand<{ directing: DirectingSlice }, SubmitArgs>({ id: 'directing.submit', reads: [], writes: ['directing'], run: submit });
export const pursueSecond = defineCommand<Pursuing, Record<string, never>>({ id: 'directing.pursue', reads: ['identity'], writes: ['attributes', 'directing'], run: pursue });
