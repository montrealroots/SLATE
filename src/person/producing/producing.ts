import { defineCommand, type Context } from '../../core/frame/frame.ts';
import { fromMajor, money, type Money } from '../../core/money/money.ts';
import { addMonths } from '../../core/time/dates.ts';
import type { LineId } from '../../core/text/text.ts';
import { componentValues, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { FEATURE_SHOOT } from '../directing/directing.ts';
import { spread } from '../work/work.ts';

/**
 * The producer's work and how it comes out (BUILD-ORDER layer 4; the owner, 2026-10-31: "I want my attributes to effect
 * the quality of my work ... it needs to actually produce results depending on how bad or good I am"). A project is
 * taken from material to release, each stage on the trade's own figures where it publishes them (R-4612), the
 * producer's six broad attributes (Development, Financing, Production, Leadership, Dealmaking, Marketing) read through
 * the components and facets the research names (R-4609):
 *
 * - Optioning material (Development: choosing the material): the producer reads a script a day and options the one
 *   that reads best to them; a better eye picks the better script. The option is the WGA's: 18 months for 10% of the
 *   minimum, renewed for 18 more at another 10%, each payment credited against the purchase price.
 * - Budgeting and scheduling (Production's detailed plan, Financing's production costs): the shooting days the script
 *   needs, around the CNC's 32 for a feature (the director's FEATURE_SHOOT), and the days the plan schedules, nearer the need the better the plan; the
 *   producer's fee and overheads at the BFI's 7 to 8% of direct costs; the UK's tax credit, 53% (the IFTC, budgets to
 *   £15m) or 34% (the AVEC) of the 80% of core costs it counts.
 * - Financing (Development's pitch, Financing's sources and strategy, Dealmaking's network, words and terms): the BFI
 *   says yes at its 13%, as the package sells it, an award of its 22% of the budget up to its £1.25m, and only to an
 *   option with ten months left; the rest from the market in the EAO's shares (broadcasters 18%, pre-sales 14%), the
 *   remainder from equity, the producer's own 18% (the EAO's producer investment) carried last.
 * - The shoot (Production's crew, Leadership's team): days slip where the team falters, the days past the schedule cost
 *   the budget's day rate, and the producer's fee is deferred against the overrun first.
 * - The release (Marketing, the film's quality): a cinema release at the BFI's rate for the budget (11.6% under £0.5m
 *   to 83.3% above £10m), and earning back twice the budget at its rate for those released (3.3% to 14.8%), as the film
 *   and its campaign sell it. A producer's films released in the last seven years (the PGA's window for its two
 *   features) count toward how financiers take the next.
 *
 * The producer works in the UK, the one market whose every stage has a published figure here (the BFI's funding,
 * option rule, fee line, release and recoupment by budget; the UK's credits). shortcut: the CNC's, Telefilm's and
 * Screen Australia's terms (R-4612) wait for a release and recoupment figure in their own markets, read when that
 * engine is built. What the trade doesn't publish (how well a producer's eye reads a script, how far a plan is off,
 * how far a shoot slips, how often the market closes a deal, how much a better package or campaign moves a rate) is the
 * game's own until the owner balances it (person.producing.model).
 */

/** The line that tells the player these figures are the game's own (person.producing.model). */
export const MODEL_LINE: LineId = 'producing.model';

/** The zone the option's months run in: the producer's market. */
export const ZONE = 'Europe/London';

/** The WGA's option: 18 months, renewed for 18 more, each at 10% of the minimum (R-4612, the 2026 MBA). */
export const OPTION_MONTHS = 18;

/**
 * 10% of the 2026 MBA's minimum for an original screenplay with treatment, low budget ($92,268).
 * shortcut: the high-budget minimum ($173,215, its option $17,321.50) binds a picture of $5m and over, which needs the
 * budget in dollars at the day's rate; read when the ledger pays the option.
 */
// Stryker disable next-line StringLiteral: a mutant here throws as the module loads, which Stryker reports as surviving
// (HANDOFF, blockers); the test holds the payment to the cent.
export const OPTION_FEE: Money = fromMajor('USD', '9226.80');

/** The BFI funds no project with under ten months left on its option, unless renewal is provided for (R-4612). */
export const MONTHS_LEFT = 10;

/** The producer's fee and overheads, as a share of the direct costs: the middle of the BFI's 7 to 8% (R-4612). */
export const FEE_SHARE = 0.075;

/** The UK's credits on the 80% of core costs they count: the IFTC's 53% for budgets to £15m, the AVEC's 34% above (R-4612). */
export const CREDIT = { core: 0.8, independent: 0.53, ceiling: 15_000_000, film: 0.34 } as const;

/** The BFI's production funding: 13% of applicants funded (2013/14), awards 22% of the budget (2018/19), at most £1.25m (Impact). */
export const BFI = { rate: 0.13, share: 0.22, most: 1_250_000 } as const;

/** The market's sources in the order sought, each its EAO share of a European film's budget (2020 films; R-4612). */
export const MARKET = { broadcaster: 0.18, 'pre-sales': 0.14, equity: null } as const;
export type Source = keyof typeof MARKET;

/** The producer's own investment, carried after every source: the EAO's 18%. */
export const PRODUCER_SHARE = 0.18;

/** A cinema release within two years, by budget in pounds below each bound (BFI, UK independent films 2003 to 2011). */
export const RELEASE: readonly (readonly [number, number])[] = [
  [500_000, 0.116],
  [2_000_000, 0.379],
  [5_000_000, 0.592],
  [10_000_000, 0.714],
  [Infinity, 0.833],
];

/** Box office of twice the budget, of those released, by budget in pounds below each bound (the same BFI study). */
export const RECOUP: readonly (readonly [number, number])[] = [
  [500_000, 0.033],
  [2_000_000, 0.049],
  [5_000_000, 0.087],
  [Infinity, 0.148],
];

/** The PGA's bar: two released features in seven years (R-4612). */
export const PGA = { features: 2, years: 7 } as const;

/** The game's own figures (person.producing.model). */
export const MODEL = {
  /** How far off a producer with no eye judges a script, either side, in points; none at 100. */
  misjudged: 100,
  /** How far a plan's days are off the need at 0, either side, as a share; none at 100. */
  planned: 0.3,
  /** A script's own need, either side of the CNC's average, as a share. */
  need: 0.25,
  /** How far a shoot slips at 0 where the team falters, at most, as a share of the days; none at 100. */
  falter: 0.5,
  /** The market's chance of closing a source on a day of raising, for a package at the trade's middle. */
  daily: 1 / 30,
  /** What each film released in the PGA's window adds to how financiers take the next, up to its two. */
  record: 0.1,
} as const;

export interface Plan {
  budget: Money;
  /** The shooting days the script needs. */
  needed: number;
  /** The days the plan schedules. */
  scheduled: number;
  /** The producer's fee and overheads. */
  fee: Money;
  /** The UK's tax credit. */
  credit: Money;
}

export interface Shoot {
  at: number;
  days: number;
  /** What the days past the schedule cost. */
  overrun: Money;
  /** The producer's fee after the overrun is taken from it. */
  fee: Money;
  /** The film, 0 to 100. */
  quality: number;
}

export interface Project {
  readonly id: number;
  readonly optioned: number;
  expires: number;
  /** Each option payment, the first and each renewal's, credited against the purchase price. */
  options: Money[];
  /** The script optioned, 0 to 100. */
  material: number;
  plan: Plan | null;
  applied: boolean;
  /** Each source of money closed. */
  raised: { [source: string]: Money };
  shot: Shoot | null;
  release: { at: number; cinema: boolean; doubled: boolean } | null;
}

export interface ProducingSlice {
  projects: Project[];
}

export const PRODUCING_START: ProducingSlice = { projects: [] };

type Values = Readonly<Record<string, number>>;
type Producing = { attributes: AttributesSlice; producing: ProducingSlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const of = (v: Values, id: string) => skillOf(v, 'producer', id);
const pounds = (minor: number) => money('GBP', Math.round(minor));
const wholeDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`the days given are a whole number of at least 1 (${days})`);
};

export function projectOf(s: ProducingSlice, id: number): Project {
  const found = s.projects.find((p) => p.id === id);
  if (found === undefined) throw new Error(`there's no project ${id}`);
  return found;
}

/** The component ids the engine reads, by the broad attribute that covers them. */
export const C = {
  select: 'select-plays-scripts-books-news-content-or-ideas-to-be-produ',
  pitch: 'pitch-ideas-to-tv-companies-and-film-studios-to-back-your-pr',
  arrange: 'arrange-financing-for-productions',
  adequacy: 'adequacy-of-the-financing-strategy',
  costs: 'calculate-production-costs',
  plan: 'detailed-plan-for-a-project',
  hire: 'hire-directors-and-production-staff',
  lead: 'ability-to-lead-and-motivate-teams',
  network: 'develop-professional-network',
  communicator: 'a-first-class-communicator',
  marketing: 'develop-marketing-plans-for-finished-products-collaborating-',
} as const;

/** The option still runs a number of months past a moment; refused where it doesn't. */
function running(p: Project, at: number, months: number): void {
  // @slate:consumer producing.renew
  if (addMonths(ZONE, at, months) > p.expires) throw new Error(`project ${p.id}'s option ${months === 0 ? 'has lapsed' : `has under ${months} months left`}`);
}

/** The producer's films released in cinemas in the PGA's seven years before a moment. */
export function record(s: ProducingSlice, at: number): number {
  const since = addMonths(ZONE, at, -12 * PGA.years);
  // @slate:consumer producing.release
  return s.projects.filter((p) => p.release?.cinema === true && p.release.at >= since).length;
}

/** How the producer sells a package, 0 to 100: the pitch, the financing's sources and strategy, the network, words and terms. */
export const pitchSkill = (v: Values): number =>
  0.3 * of(v, C.pitch) + 0.2 * of(v, C.arrange) + 0.1 * of(v, C.adequacy) + 0.2 * of(v, C.network) + 0.1 * of(v, C.communicator) + 0.1 * of(v, 'negotiation');

/** How a financier takes a project, 0.5 to 1.7: the script and the pitch, 1 for both at the middle, and the producer's record. */
export function factor(s: ProducingSlice, v: Values, p: Project, at: number): number {
  // @slate:consumer producing.option
  return 0.5 + (0.5 * p.material + 0.5 * pitchSkill(v)) / 100 + MODEL.record * Math.min(PGA.features, record(s, at));
}

/** The eye a producer reads material with, 0 to 100: choosing the material. */
export const eye = (v: Values): number => of(v, C.select);

export interface DaysArgs {
  [key: string]: number;
  days: number;
}

/**
 * Options a script: a script read a day, each at its own worth (any from 0 to 100, as the market's are), judged by the
 * producer's eye, the one judged best optioned.
 */
function option(s: Producing, a: DaysArgs, c: Context): void {
  wholeDays(a.days);
  const v = componentValues(s.attributes, 'producer');
  const id = s.producing.projects.length + 1;
  const off = MODEL.misjudged * (1 - eye(v) / 100);
  const d = c.draws('producing.work', 'option', id, c.now);
  let best = { worth: 0, judged: -Infinity };
  for (let i = 0; i < a.days; i += 1) {
    const worth = 100 * d.float();
    // Off by up to `off` either side: only the order of the judgements counts, so it is drawn on one side, twice as wide.
    const judged = worth + 2 * off * d.float();
    // Stryker disable next-line EqualityOperator: a draw is continuous, so two judge alike with no probability.
    if (judged > best.judged) best = { worth, judged };
  }
  s.producing.projects.push({ id, optioned: c.now, expires: addMonths(ZONE, c.now, OPTION_MONTHS), options: [OPTION_FEE], material: best.worth, plan: null, applied: false, raised: {}, shot: null, release: null });
  practise(s.attributes, 'producer', [C.select], a.days);
}

export interface ProjectArgs {
  [key: string]: number;
  project: number;
}

/** Renews a running option for another 18 months, from when it would have lapsed, at another 10%. */
function renew(s: { producing: ProducingSlice }, a: ProjectArgs, c: Context): void {
  const p = projectOf(s.producing, a.project);
  if (p.shot !== null) throw new Error(`project ${p.id}'s rights are bought`);
  running(p, c.now, 0);
  p.expires = addMonths(ZONE, p.expires, OPTION_MONTHS);
  p.options.push(OPTION_FEE);
}

export interface PlanArgs {
  [key: string]: number | string;
  project: number;
  /** In pounds. */
  budget: string;
}

/** The UK's credit on a budget: the IFTC's 53% to £15m (its £6.36m most is 53% of 80% of £15m), the AVEC's 34% above. */
export function creditOn(budget: Money): Money {
  const rate = budget.minor <= CREDIT.ceiling * 100 ? CREDIT.independent : CREDIT.film;
  return pounds(budget.minor * CREDIT.core * rate);
}

/** How near the need a producer schedules, 0 to 100: the detailed plan and the production's costs. */
export const planSkill = (v: Values): number => 0.5 * of(v, C.plan) + 0.5 * of(v, C.costs);

/** Budgets and schedules a project: the days its script needs, the days the plan gives it, the fee and the credit. */
function plan(s: Producing, a: PlanArgs, c: Context): void {
  const v = componentValues(s.attributes, 'producer');
  const p = projectOf(s.producing, a.project);
  if (p.plan !== null) throw new Error(`project ${p.id} is planned`);
  const budget = fromMajor('GBP', a.budget);
  if (budget.minor < 100) throw new RangeError(`a budget is at least £1 (${a.budget})`);
  const d = c.draws('producing.work', 'plan', p.id);
  const needed = Math.round(FEATURE_SHOOT * (1 + MODEL.need * (2 * d.float() - 1)));
  const scheduled = Math.max(1, Math.round(needed * (1 + MODEL.planned * (1 - planSkill(v) / 100) * (2 * d.float() - 1))));
  p.plan = { budget, needed, scheduled, fee: pounds((budget.minor * FEE_SHARE) / (1 + FEE_SHARE)), credit: creditOn(budget) };
  practise(s.attributes, 'producer', [C.plan, C.costs], 1);
}

const planOf = (p: Project): Plan => {
  if (p.plan === null) throw new Error(`project ${p.id} has no budget`);
  return p.plan;
};

/** The money closed for a project, the credit with it. */
export function raised(p: Project): number {
  // @slate:consumer producing.plan
  // @slate:consumer producing.apply
  // @slate:consumer producing.raise
  return Object.values(p.raised).reduce((t, m) => t + m.minor, planOf(p).credit.minor);
}

/** What the sources must close: all but the producer's own share. */
export const target = (p: Project): number => planOf(p).budget.minor - Math.round(planOf(p).budget.minor * PRODUCER_SHARE);

export const financed = (p: Project): boolean => raised(p) >= target(p);

/** Refused where a project can't take more money: not planned, financed already, or its option short of the months. */
function seeking(p: Project, at: number, months: number): void {
  if (financed(p)) throw new Error(`project ${p.id} is financed`);
  running(p, at, months);
}

/** Applies to the BFI, once a project: a yes at its rate as the package sells it, an award of its share of the budget. */
function apply(s: Producing, a: ProjectArgs, c: Context): void {
  const v = componentValues(s.attributes, 'producer');
  const p = projectOf(s.producing, a.project);
  if (p.applied) throw new Error(`project ${p.id} has applied`);
  seeking(p, c.now, MONTHS_LEFT);
  p.applied = true;
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  if (c.draws('producing.work', 'apply', p.id).float() < BFI.rate * factor(s.producing, v, p, c.now)) p.raised['bfi'] = pounds(Math.min(planOf(p).budget.minor * BFI.share, BFI.most * 100));
  practise(s.attributes, 'producer', [C.pitch, C.arrange, C.network], 1);
}

/** Days raising the rest from the market: each day a chance of closing the next source, until the project is financed. */
function raise(s: Producing, a: DaysArgs & ProjectArgs, c: Context): void {
  wholeDays(a.days);
  const v = componentValues(s.attributes, 'producer');
  const p = projectOf(s.producing, a.project);
  seeking(p, c.now, 0);
  const chance = MODEL.daily * factor(s.producing, v, p, c.now);
  const d = c.draws('producing.work', 'raise', p.id, c.now);
  for (let day = 0; day < a.days && !financed(p); day += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() >= chance) continue;
    const [source, share] = Object.entries(MARKET).find(([k]) => !(k in p.raised)) as [Source, number | null];
    p.raised[source] = pounds(share === null ? target(p) - raised(p) : planOf(p).budget.minor * share);
  }
  practise(s.attributes, 'producer', [C.arrange, C.network], a.days);
}

/** The crew a producer hires and runs, 0 to 100: Production's hiring, coordination, time and detail. */
export const crewSkill = (v: Values): number => 0.4 * of(v, C.hire) + 0.2 * of(v, 'coordination') + 0.2 * of(v, 'time-management') + 0.2 * of(v, 'attention-to-detail');

/** How the producer holds the team, 0 to 100: Leadership's leading, stress, problems and change. */
export const leadSkill = (v: Values): number => 0.4 * of(v, C.lead) + 0.2 * of(v, 'stress-tolerance') + 0.2 * of(v, 'complex-problem-solving') + 0.2 * of(v, 'adaptability');

export const team = (v: Values): number => (crewSkill(v) + leadSkill(v)) / 2;

/** Shoots a financed project: the days it takes, what the days past the schedule cost, the fee left, and the film. */
function shoot(s: Producing, a: ProjectArgs, c: Context): void {
  const v = componentValues(s.attributes, 'producer');
  const p = projectOf(s.producing, a.project);
  // @slate:consumer producing.raise
  if (!financed(p)) throw new Error(`project ${p.id} isn't financed`);
  running(p, c.now, 0);
  // @slate:consumer producing.plan
  const { budget, needed, scheduled, fee } = planOf(p);
  const t = team(v);
  const d = c.draws('producing.work', 'shoot', p.id);
  const days = Math.ceil(needed * (1 + MODEL.falter * (1 - t / 100) * d.float()));
  const overrun = (Math.max(0, days - scheduled) * budget.minor) / scheduled;
  const quality = clamp(0.5 * p.material + 0.5 * t + spread(t) * (2 * d.float() - 1), 0, 100);
  p.shot = { at: c.now, days, overrun: pounds(overrun), fee: pounds(Math.max(0, fee.minor - overrun)), quality };
  practise(s.attributes, 'producer', [C.hire, C.lead], days);
}

/** How the film and its campaign sell it, 0 to 100: the film, and Marketing's plans and media. */
export const sellSkill = (v: Values, quality: number): number => 0.5 * quality + 0.5 * (0.7 * of(v, C.marketing) + 0.3 * of(v, 'communications-and-media'));

/** A rate by budget, from a table of bounds in pounds. */
export const rateFor = (table: readonly (readonly [number, number])[], budget: Money): number => (table.find(([below]) => budget.minor < below * 100) as readonly [number, number])[1];

/** Releases a film shot: a cinema release, and twice the budget back, at the BFI's rates for its budget as it sells. */
function release(s: Producing, a: ProjectArgs, c: Context): void {
  const v = componentValues(s.attributes, 'producer');
  const p = projectOf(s.producing, a.project);
  // @slate:consumer producing.shoot
  if (p.shot === null) throw new Error(`project ${p.id} isn't shot`);
  if (p.release !== null) throw new Error(`project ${p.id} is released`);
  const f = 0.5 + sellSkill(v, p.shot.quality) / 100;
  const d = c.draws('producing.work', 'release', p.id);
  const { budget } = planOf(p);
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  const cinema = d.float() < rateFor(RELEASE, budget) * f;
  // Stryker disable next-line EqualityOperator: as above.
  p.release = { at: c.now, cinema, doubled: cinema && d.float() < rateFor(RECOUP, budget) * f };
  practise(s.attributes, 'producer', [C.marketing], 1);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const optionMaterial = defineCommand<Producing, DaysArgs>({ id: 'producing.option', reads: [], writes: ['attributes', 'producing'], run: option });
export const renewOption = defineCommand<{ producing: ProducingSlice }, ProjectArgs>({ id: 'producing.renew', reads: [], writes: ['producing'], run: renew });
export const planProject = defineCommand<Producing, PlanArgs>({ id: 'producing.plan', reads: [], writes: ['attributes', 'producing'], run: plan });
export const applyToFunder = defineCommand<Producing, ProjectArgs>({ id: 'producing.apply', reads: [], writes: ['attributes', 'producing'], run: apply });
export const raiseMoney = defineCommand<Producing, DaysArgs & ProjectArgs>({ id: 'producing.raise', reads: [], writes: ['attributes', 'producing'], run: raise });
export const shootProject = defineCommand<Producing, ProjectArgs>({ id: 'producing.shoot', reads: [], writes: ['attributes', 'producing'], run: shoot });
export const releaseFilm = defineCommand<Producing, ProjectArgs>({ id: 'producing.release', reads: [], writes: ['attributes', 'producing'], run: release });
