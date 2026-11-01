import { defineCommand, type Context } from '../../core/frame/frame.ts';
import { fromMajor, type Money } from '../../core/money/money.ts';
import { componentOf, componentValues, facetSkill, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { partScore, PARTS, scriptOf, spread, type Form, type Script, type ScriptsSlice } from './work.ts';

/**
 * Getting the work out: the screenwriter's attributes that work with people (workbench/plans/screenwriter-attributes.md,
 * 13 and 21 to 26), each acting through the facets the sources name (R-4607) and read where the research says it is
 * judged, on the trade's own figures where it publishes them (R-4608, R-4241).
 *
 * - A script's documents (Synopsis): the ten the sources name, logline to scriptment, each written on its own.
 * - Networking (Networking, Speaking, Social Perceptiveness): the contacts days among the trade make. The studios read
 *   nothing unsolicited (Netflix's and Disney's own terms), so every meeting comes through a contact.
 * - Sending a script out (Promotion, the query documents, the script's grade): a contact approached may ask to read it;
 *   a stranger queried cold asks about once in sixty-six times (query services' 1 to 2%).
 * - A pitch on a request (Pitching, Speaking, Persuasion, the pitch documents): a third of the specs agents took out sold
 *   in 2012 (the Scoggins Report), the share for a script at the market's level, better scripts and meetings selling
 *   more. A script sold pays the WGA's minimum for its form (R-4241), goes off the market, and leaves its buyer a contact.

 * The writer works alone (the owner, 2026-11-01: "just get rid of all the team stuff because I will be a solo writer"):
 * no writers' room, staffing or ladder of titles; a pilot or an episode is written and sold as a spec.
 *
 * What the trade doesn't publish (how likely a contact is made in a day, or asks to read) is the game's own until the owner balances it (person.career.model).
 */

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

/**
 * The days each document needs from a writer at 100 in Writing and Time Management, twice that from one at 0. The
 * treatment is half the MBA's 6.1 weeks for the treatment step at high budget (43 days), so the slowest writer takes all
 * of it (R-4608). shortcut: the others' times aren't published (R-4608 blockers); they're the game's own until found.
 */
export const DOCUMENT_DAYS = {
  logline: 1,
  'short-synopsis': 1,
  'one-page-synopsis': 2,
  outline: 5,
  treatment: 21.5,
  'scene-breakdown': 10,
  'series-bible': 14,
  'pitch-document': 3,
  'statement-of-intent': 1,
  scriptment: 21,
} as const;

export type Document = keyof typeof DOCUMENT_DAYS;

/** What a query carries, and what a pitch leaves behind. */
export const QUERY: readonly Document[] = ['logline', 'short-synopsis', 'one-page-synopsis'];
export const PITCH: readonly Document[] = ['pitch-document', 'one-page-synopsis', 'treatment'];

export interface Out {
  /** Each document written, by its quality, 0 to 100. */
  documents: { [document: string]: number };
  /** Requests to read it not yet met in a meeting. */
  requests: number;
  sold: { at: number; fee: Money | null } | null;
}

export interface CareerSlice {
  contacts: number;
  out: { [script: string]: Out };
}

export const CAREER_START: CareerSlice = { contacts: 0, out: {} };

type Values = Readonly<Record<string, number>>;
type Career = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const of = (v: Values, id: string) => skillOf(v, 'screenwriter', id);
const wholeDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`the days given are a whole number of at least 1 (${days})`);
};
const outOf = (s: CareerSlice, script: number): Out => (s.out[String(script)] ??= { documents: {}, requests: 0, sold: null });
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
  return PARTS.reduce((t, p) => t + partScore(script, p), 0) / PARTS.length;
}

/** The best of the documents written among those given, 0 where none is: what a query or a pitch puts forward. */
export const bestOf = (out: Out, among: readonly Document[]): number => Math.max(0, ...among.map((d) => out.documents[d] ?? 0));

export interface DocumentArgs {
  [key: string]: number | string;
  script: number;
  document: Document;
  days: number;
}

/** What a writer can do in a document: the Synopsis facet it is (with what a source ties to it), and Writing. */
export function documentSkill(values: Values, document: Document): number {
  const facet = componentOf('screenwriter', 'synopsis').facets.find((f) => f.id === document);
  if (facet === undefined) throw new Error(`there's no document ${document}`);
  return 0.7 * facetSkill(values, facet, 'synopsis') + 0.3 * of(values, 'writing');
}

/** Writes one of a script's documents. */
function summarise(s: Career, a: DocumentArgs, c: Context): void {
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const k = documentSkill(values, a.document);
  const { script, out } = onTheMarket(s, a.script);
  const needed = Math.ceil(DOCUMENT_DAYS[a.document] / (0.5 + (0.5 * (0.6 * of(values, 'writing') + 0.4 * of(values, 'time-management'))) / 100));
  const effort = Math.min(1, a.days / needed);
  // @slate:consumer script.write
  out.documents[a.document] = clamp(k * (0.5 + 0.5 * effort) + spread(k) * (2 * c.draws('work.career', 'document', script.id, a.document, c.now).float() - 1), 0, 100);
  practise(s.attributes, 'screenwriter', ['synopsis', 'writing'], a.days);
}

export interface DaysArgs {
  [key: string]: number;
  days: number;
}

/** A contact a day's networking makes, at the most: a twentieth of the days for a writer at 0, half for one at 100. */
export const contactChance = (v: Values): number => 0.05 + (0.45 * (0.6 * of(v, 'networking') + 0.2 * of(v, 'speaking') + 0.2 * of(v, 'social-perceptiveness'))) / 100;

/** Days spent among the trade: festivals, panels, the people a writer already knows. */
function network(s: Career, a: DaysArgs, c: Context): void {
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const p = contactChance(values);
  const d = c.draws('work.career', 'network', c.now);
  for (let day = 0; day < a.days; day += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() < p) s.career.contacts += 1;
  }
  practise(s.attributes, 'screenwriter', ['networking', 'speaking', 'social-perceptiveness'], a.days);
}

/** How well the query sells the script, 0.5 to 1.5: Promotion and the best query document. */
export const pull = (v: Values, out: Out): number => 0.5 + (0.5 * of(v, 'promotion') + 0.5 * bestOf(out, QUERY)) / 100;

/** A cold query's chance of a request: 1.5%, the middle of the query services' 1 to 2%, as the query sells it. */
export const COLD = 0.015;

/** A stranger's chance of asking to read, on a cold query: the sourced 1.5% as the query sells it. */
export const coldChance = (v: Values, out: Out): number => COLD * pull(v, out);

/** A contact's chance of asking to read: a tenth to nine tenths, by how the query sells it and the script's grade. */
export const requestChance = (v: Values, out: Out, q: number): number => 0.4 * pull(v, out) * (0.5 + (0.5 * q) / 100);

export interface ScriptDaysArgs {
  [key: string]: number;
  script: number;
  days: number;
}

/** Sends a script out: a contact approached each day while there are contacts, a stranger queried cold each day after. */
function promote(s: Career, a: ScriptDaysArgs, c: Context): void {
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const { script, out } = onTheMarket(s, a.script);
  // @slate:consumer network.meet
  // @slate:consumer script.pitch
  const known = Math.min(a.days, s.career.contacts);
  // @slate:consumer script.summarise
  const warm = requestChance(values, out, quality(script));
  const cold = coldChance(values, out);
  const d = c.draws('work.career', 'promote', script.id, c.now);
  for (let i = 0; i < a.days; i += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() < (i < known ? warm : cold)) out.requests += 1;
  }
  practise(s.attributes, 'screenwriter', ['promotion'], a.days);
}

/** How a writer does in a meeting, 0 to 100: Pitching, Speaking and Persuasion, and the best pitch document. */
export const pitchSkill = (v: Values, out: Out): number => 0.5 * of(v, 'pitching') + 0.2 * of(v, 'speaking') + 0.2 * of(v, 'persuasion') + 0.1 * bestOf(out, PITCH);

/** The share of specs taken out that sold, 2012 (the Scoggins Report: 112 of 338 sent out that year; R-4608). */
export const MARKET_SHARE = 112 / 338;

/** A script at the market's level: one a Black List reader scores 7 or 8, which few reach (3.8% score 8 or more). */
export const MARKET_LEVEL = 75;

/** The chance a pitch sells: the market's share for a script at its level and a middling meeting, more for better (88% at best). */
export const saleChance = (q: number, meeting: number): number => MARKET_SHARE * (q / MARKET_LEVEL) ** 2 * (0.5 + meeting / 100);

export interface ScriptArgs {
  [key: string]: number;
  script: number;
}

/** A pitch meeting with someone who asked to read the script. */
function pitch(s: Career, a: ScriptArgs, c: Context): void {
  const values = componentValues(s.attributes, 'screenwriter');
  const { script, out } = onTheMarket(s, a.script);
  // @slate:consumer script.promote
  if (out.requests < 1) throw new Error(`no one has asked to read script ${a.script}`);
  out.requests -= 1;
  const chance = saleChance(quality(script), pitchSkill(values, out));
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  if (c.draws('work.career', 'pitch', script.id, c.now, out.requests).float() < chance) {
    out.sold = { at: c.now, fee: FEES[script.form] };
    s.career.contacts += 1;
  }
  practise(s.attributes, 'screenwriter', ['pitching', 'speaking', 'persuasion'], 1);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const summariseScript = defineCommand<Career, DocumentArgs>({ id: 'script.summarise', reads: ['scripts'], writes: ['attributes', 'career'], run: summarise });
export const meetPeople = defineCommand<Career, DaysArgs>({ id: 'network.meet', reads: [], writes: ['attributes', 'career'], run: network });
export const promoteScript = defineCommand<Career, ScriptDaysArgs>({ id: 'script.promote', reads: ['scripts'], writes: ['attributes', 'career'], run: promote });
export const pitchScript = defineCommand<Career, ScriptArgs>({ id: 'script.pitch', reads: ['scripts'], writes: ['attributes', 'career'], run: pitch });
