import { defineCommand, type Context } from '../../core/frame/frame.ts';
import { fromMajor, type Money } from '../../core/money/money.ts';
import { practise, valuesOf, type AttributesSlice } from '../attributes/attributes.ts';
import { scriptOf, spread, type Form, type Script, type ScriptsSlice } from './work.ts';

/**
 * Getting the work out: the screenwriter's seven attributes that work with people (workbench/plans/
 * screenwriter-attributes.md, 13 and 21 to 26), each read where the research says it is judged.
 *
 * - A script's synopsis (Synopsis): the logline, synopsis and treatment that submissions and pitches ask for.
 * - Networking (Networking, with Speaking and Social Perceptiveness behind it): the contacts days spent among the trade
 *   make, which every request to read and every meeting comes through.
 * - Sending a script out (Promotion): of the contacts approached, those who ask to read it, as the synopsis sells it and
 *   the script's last grade backs it.
 * - A pitch meeting on a script someone asked to read (Pitching, Speaking, Persuasion): whether the buyer takes it. A
 *   script sold is off the market, pays the WGA's minimum for its form (2026 MBA, first year: an original feature with
 *   treatment $173,215 at high budget; a 60-minute teleplay $47,460, a pilot 150% of it; R-4241), and leaves its buyer
 *   among the writer's contacts. A short has no MBA minimum, so no fee is set.
 * - A writers' room (Speaking, Social Perceptiveness, Persuasion): staffed through a contact on a spec sample (a pilot
 *   or an episode), then each season a standing that decides the episodes assigned, being kept on, and the step up the
 *   WGA's own ladder of titles (R-4241: Staff Writer, Story Editor ... Showrunner).
 *
 * How much each attribute weighs, and the chances, are the game's own until the owner balances them (register
 * person.career.model); the minimums and the titles are the WGA's.
 */

/** The WGA's titles for television writers, in its own order (R-4241). */
export const LADDER = ['Staff Writer', 'Story Editor', 'Executive Story Editor', 'Co-Producer', 'Producer', 'Supervising Producer', 'Consulting Producer', 'Co-Executive Producer', 'Executive Producer', 'Showrunner'] as const;

/**
 * What the buyer pays for a script of each form, at the 2026 MBA's first-year minimum (R-4241): a feature as an
 * original screenplay with treatment at high budget, an episode a 60-minute network prime time story and teleplay, a
 * pilot 150% of that. shortcut: the MBA binds the WGA's signatories; other countries' guild minimums wait for the
 * per-country industry research, read when that engine is built.
 */
// Stryker disable next-line StringLiteral: a mutant here throws as the module loads, which Stryker 10.0.0 reports as
// surviving (HANDOFF, blockers); the test holds each fee to the cent.
export const FEES: Readonly<Record<Form, Money | null>> = {
  // Stryker disable next-line StringLiteral: as above.
  feature: fromMajor('USD', '173215'),
  // Stryker disable next-line StringLiteral: as above.
  pilot: fromMajor('USD', '71190'),
  // Stryker disable next-line StringLiteral: as above.
  episode: fromMajor('USD', '47460'),
  short: null,
};

/** The days a synopsis needs from a writer at 100 in Writing and Time Management; twice that from one at 0. */
export const SYNOPSIS_DAYS: Readonly<Record<Form, number>> = { feature: 7, pilot: 5, episode: 3, short: 1 };

export interface Out {
  /** The synopsis's quality, 0 to 100, once written. */
  synopsis: number | null;
  /** Requests to read it not yet met in a meeting. */
  requests: number;
  sold: { at: number; fee: Money | null } | null;
}

export interface Room {
  /** The rung on the ladder, from 0 (Staff Writer). */
  level: number;
  seasons: number;
  /** The last season's standing, 0 to 100 (none before the first). */
  standing: number | null;
  /** Episodes assigned in the last season. */
  episodes: number;
}

export interface CareerSlice {
  contacts: number;
  out: { [script: string]: Out };
  room: Room | null;
}

export const CAREER_START: CareerSlice = { contacts: 0, out: {}, room: null };

type Values = Readonly<Record<string, number>>;
type Career = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mix = (v: Values, weights: Readonly<Record<string, number>>) => Object.entries(weights).reduce((t, [id, w]) => t + w * (v[id] as number), 0);
const wholeDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`the days given are a whole number of at least 1 (${days})`);
};
const outOf = (s: CareerSlice, script: number): Out => (s.out[String(script)] ??= { synopsis: null, requests: 0, sold: null });
const onTheMarket = (s: Career, id: number): { script: Script; out: Out } => {
  const script = scriptOf(s.scripts, id);
  const out = outOf(s.career, id);
  if (out.sold !== null) throw new Error(`script ${id} is sold`);
  return { script, out };
};

/** A script's quality as a buyer weighs it: its last grade out of 10, or the mean of its parts where none has graded it. */
export function quality(script: Script): number {
  const last = script.reads.at(-1);
  if (last !== undefined) return last.overall * 10;
  const parts = Object.values(script.parts);
  return parts.reduce((t, p) => t + p, 0) / parts.length;
}

/** Each attribute a stretch of work used, by `use`. */
const usedBy = (ids: readonly string[], use: number) => Object.fromEntries(ids.map((id) => [id, use]));

export interface SummariseArgs {
  [key: string]: number;
  script: number;
  days: number;
}

/** Writes a script's logline, synopsis and treatment. */
function summarise(s: Career, a: SummariseArgs, c: Context): void {
  wholeDays(a.days);
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const { script, out } = onTheMarket(s, a.script);
  const needed = Math.ceil(SYNOPSIS_DAYS[script.form] / (0.5 + (0.5 * mix(values, { writing: 0.6, 'time-management': 0.4 })) / 100));
  const effort = Math.min(1, a.days / needed);
  // @slate:consumer script.write
  const k = mix(values, { synopsis: 0.7, writing: 0.3 });
  out.synopsis = clamp(k * (0.5 + 0.5 * effort) + spread(k) * (2 * c.draws('work.career', 'synopsis', script.id, c.now).float() - 1), 0, 100);
  practise(values, usedBy(['synopsis', 'writing'], Math.min(1.5, a.days / needed)));
  s.attributes['screenwriter'] = values;
}

export interface DaysArgs {
  [key: string]: number;
  days: number;
}

/** A contact a day's networking makes, at the most: a twentieth of the days for a writer at 0, half for one at 100. */
export const contactChance = (v: Values): number => 0.05 + (0.45 * mix(v, { networking: 0.6, speaking: 0.2, 'social-perceptiveness': 0.2 })) / 100;

/** Days spent among the trade: festivals, panels, the people a writer already knows. */
function network(s: Career, a: DaysArgs, c: Context): void {
  wholeDays(a.days);
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const p = contactChance(values);
  const d = c.draws('work.career', 'network', c.now);
  for (let day = 0; day < a.days; day += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() < p) s.career.contacts += 1;
  }
  practise(values, usedBy(['networking', 'speaking', 'social-perceptiveness'], Math.min(1.5, a.days / 30)));
  s.attributes['screenwriter'] = values;
}

/** The chance a contact approached asks to read the script: by Promotion, the synopsis that sells it, the grade behind it. */
export const requestChance = (v: Values, synopsis: number | null, q: number): number =>
  (0.1 + (0.5 * (v['promotion'] as number)) / 100) * (0.3 + (0.7 * (synopsis ?? 0)) / 100) * (0.5 + (0.5 * q) / 100);

export interface ScriptDaysArgs {
  [key: string]: number;
  script: number;
  days: number;
}

/** Sends a script out: a contact approached each day, as many as the writer has. */
function promote(s: Career, a: ScriptDaysArgs, c: Context): void {
  wholeDays(a.days);
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const { script, out } = onTheMarket(s, a.script);
  // @slate:consumer network.meet
  // @slate:consumer script.pitch
  const approached = Math.min(a.days, s.career.contacts);
  // @slate:consumer script.summarise
  const p = requestChance(values, out.synopsis, quality(script));
  const d = c.draws('work.career', 'promote', script.id, c.now);
  for (let i = 0; i < approached; i += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() < p) out.requests += 1;
  }
  practise(values, usedBy(['promotion'], Math.min(1.5, a.days / 30)));
  s.attributes['screenwriter'] = values;
}

/** How a writer does in a meeting, 0 to 100. */
export const pitchSkill = (v: Values, synopsis: number | null): number => 0.5 * (v['pitching'] as number) + 0.2 * (v['speaking'] as number) + 0.2 * (v['persuasion'] as number) + 0.1 * (synopsis ?? 0);

/** The chance a pitch sells: the script's quality counting most, the meeting the rest. */
export const saleChance = (q: number, meeting: number): number => clamp((q / 100) ** 2 * (0.4 + (0.6 * meeting) / 100), 0, 1);

export interface ScriptArgs {
  [key: string]: number;
  script: number;
}

/** A pitch meeting with someone who asked to read the script. */
function pitch(s: Career, a: ScriptArgs, c: Context): void {
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const { script, out } = onTheMarket(s, a.script);
  // @slate:consumer script.promote
  if (out.requests < 1) throw new Error(`no one has asked to read script ${a.script}`);
  out.requests -= 1;
  const chance = saleChance(quality(script), pitchSkill(values, out.synopsis));
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  if (c.draws('work.career', 'pitch', script.id, c.now, out.requests).float() < chance) {
    out.sold = { at: c.now, fee: FEES[script.form] };
    s.career.contacts += 1;
  }
  practise(values, usedBy(['pitching', 'speaking', 'persuasion'], 1));
  s.attributes['screenwriter'] = values;
}

/** How a writer comes across in a staffing meeting, 0 to 100. */
export const staffingSkill = (v: Values): number => mix(v, { speaking: 0.4, 'social-perceptiveness': 0.3, persuasion: 0.3 });

/** A staffing meeting, through a contact, on a spec sample: a pilot or an episode. */
function join(s: Career, a: ScriptArgs, c: Context): void {
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const script = scriptOf(s.scripts, a.script);
  if (script.form !== 'pilot' && script.form !== 'episode') throw new Error(`a staffing sample is a pilot or an episode, not a ${script.form}`);
  // @slate:consumer room.season
  if (s.career.room !== null) throw new Error('the writer is already in a room');
  if (s.career.contacts < 1) throw new Error('a staffing meeting comes through a contact, and the writer has none');
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  if (c.draws('work.career', 'staff', script.id, c.now).float() < saleChance(quality(script), staffingSkill(values))) s.career.room = { level: 0, seasons: 0, standing: null, episodes: 0 };
  practise(values, usedBy(['speaking', 'social-perceptiveness', 'persuasion'], 1));
  s.attributes['screenwriter'] = values;
}

/** A writer's standing in the room over a season, before the season's turns: Social Perceptiveness counting most. */
export const standingOf = (v: Values): number => mix(v, { 'social-perceptiveness': 0.5, speaking: 0.25, persuasion: 0.25 });

/** What a season's standing gives: the episodes assigned, whether the writer is kept on, and whether they step up. */
export function seasonOutcome(standing: number): { episodes: number; kept: boolean; up: boolean } {
  return { episodes: standing >= 80 ? 2 : standing >= 50 ? 1 : 0, kept: standing >= 40, up: standing >= 70 };
}

/**
 * A season in the room. The standing (moved by the season's turns, within the writer's spread) gives two episodes at 80
 * or more, one at 50 or more, none below; at 40 or more the writer is kept for the next season, and at 70 or more steps
 * up a rung; below 40 the writer is let go.
 */
function season(s: Career, _a: Record<string, never>, c: Context): void {
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  // @slate:consumer room.join
  const room = s.career.room;
  if (room === null) throw new Error('the writer is in no room');
  const base = standingOf(values);
  const standing = clamp(base + spread(base) * (2 * c.draws('work.career', 'season', room.seasons, c.now).float() - 1), 0, 100);
  const turn = seasonOutcome(standing);
  room.seasons += 1;
  room.standing = standing;
  room.episodes = turn.episodes;
  // @slate:consumer room.season
  if (turn.up) room.level = Math.min(LADDER.length - 1, room.level + 1);
  if (!turn.kept) s.career.room = null;
  practise(values, usedBy(['social-perceptiveness', 'speaking', 'persuasion'], 1.5));
  s.attributes['screenwriter'] = values;
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const summariseScript = defineCommand<Career, SummariseArgs>({ id: 'script.summarise', reads: ['scripts'], writes: ['attributes', 'career'], run: summarise });
export const meetPeople = defineCommand<Career, DaysArgs>({ id: 'network.meet', reads: [], writes: ['attributes', 'career'], run: network });
export const promoteScript = defineCommand<Career, ScriptDaysArgs>({ id: 'script.promote', reads: ['scripts'], writes: ['attributes', 'career'], run: promote });
export const pitchScript = defineCommand<Career, ScriptArgs>({ id: 'script.pitch', reads: ['scripts'], writes: ['attributes', 'career'], run: pitch });
export const joinRoom = defineCommand<Career, ScriptArgs>({ id: 'room.join', reads: ['scripts'], writes: ['attributes', 'career'], run: join });
export const workSeason = defineCommand<Career, Record<string, never>>({ id: 'room.season', reads: [], writes: ['attributes', 'career'], run: season });
