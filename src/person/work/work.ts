import { defineCommand, type Context } from '../../core/frame/frame.ts';
import type { LineId } from '../../core/text/text.ts';
import { practise, valuesOf, type AttributesSlice } from '../attributes/attributes.ts';

/**
 * The screenwriter's work and how good it comes out (BUILD-ORDER layer 4; the owner, 2026-10-31: "I want my attributes
 * to effect the quality of my work ... it needs to actually produce results depending on how bad or good I am").
 * workbench/plans/screenwriter-attributes.md says which attribute writes what.
 *
 * A script is written as a draft, revised, and read. Each part a real reader grades gets a score from 0 to 100 from the
 * attributes that write it (mostly the part's own, with Writing behind every part of the page), the time given against
 * the time the draft needs, and a spread that narrows as the writer gets better: a writer at 100 throughout writes at
 * 97 to 100 in every part, one at 50 lands around 40 to 60, one at 10 writes something hardly readable. A revision moves
 * each part toward what the writer can do, as far as Revision carries it, on the parts the notes name (as far as
 * Taking Notes keeps the work on them) or, with no reader's notes, on the parts the writer's own read thinks weakest
 * (as true as Story Critique and Critical Thinking make that read). Doing the work raises the attributes it used
 * (src/person/attributes).
 *
 * Readers grade by their own published criteria: the Black List's five components on its 1 to 10 scale, weighed as its
 * founder found its readers weigh them (plot about a third, characters and dialogue another 45%, premise and setting the
 * rest; an execution score can hold the whole down: "An 8 in dialogue cannot rescue a 5 in plot"); PAGE International's
 * ten criteria. The research is R-4601. Every figure of the model itself (days, mixes, spreads, how a weak part holds the
 * whole down) is the game's own until the owner balances it, labelled so (register person.work.model).
 */

export const MODEL_LINE: LineId = 'work.model';

export type Form = 'feature' | 'pilot' | 'episode' | 'short';

/** The days a draft needs from a writer at 100 in Writing and Time Management; twice that from one at 0. */
export const DAYS: Readonly<Record<Form, number>> = { feature: 60, pilot: 30, episode: 20, short: 10 };

/** Each part a reader grades, and the attributes that write it, by their share. */
export const PARTS = {
  characters: { characters: 0.7, writing: 0.3 },
  dialogue: { dialogue: 0.7, writing: 0.3 },
  structure: { structure: 0.7, writing: 0.3 },
  plot: { plot: 0.7, writing: 0.3 },
  theme: { theme: 0.7, writing: 0.3 },
  premise: { premise: 0.6, innovation: 0.4 },
  setting: { setting: 0.6, research: 0.4 },
  visual: { 'visual-storytelling': 0.7, writing: 0.3 },
  voice: { 'distinctive-voice': 0.7, innovation: 0.3 },
  format: { 'screenplay-format': 1 },
  producibility: { 'film-production-process': 0.7, structure: 0.3 },
} as const satisfies Record<string, Record<string, number>>;

export type Part = keyof typeof PARTS;
export const PART_NAMES = Object.keys(PARTS) as Part[];

export type Reader = 'black-list' | 'page';

export interface Read {
  readonly reader: Reader;
  readonly at: number;
  /** The reader's score for each of its criteria, 1 to 10. */
  readonly scores: Record<string, number>;
  readonly overall: number;
  /** The parts the reader's notes name: its three lowest. */
  readonly notes: Part[];
}

export interface Script {
  readonly id: number;
  readonly form: Form;
  readonly started: number;
  /** The days the first draft needed from this writer. */
  readonly needed: number;
  drafts: number;
  parts: Record<Part, number>;
  reads: Read[];
}

export interface ScriptsSlice {
  written: Script[];
}

export const SCRIPTS_START: ScriptsSlice = { written: [] };

type Values = Readonly<Record<string, number>>;
type Working = { attributes: AttributesSlice; scripts: ScriptsSlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** What the writer can do in a part, from the attributes that write it. */
export function skill(values: Values, part: Part): number {
  return Object.entries(PARTS[part]).reduce((n, [id, w]) => n + w * (values[id] as number), 0);
}

/** The days a draft of this form needs from this writer. */
export function daysNeeded(values: Values, form: Form): number {
  const pace = 0.6 * (values['writing'] as number) + 0.4 * (values['time-management'] as number);
  return Math.ceil(DAYS[form] / (0.5 + (0.5 * pace) / 100));
}

/** How far short time leaves a draft: whole when the days are enough; Perseverance carries more of a short stretch. */
export function finish(values: Values, days: number, needed: number): number {
  const effort = Math.min(1, days / needed);
  return 1 - (1 - effort) * (0.6 - (0.3 * (values['perseverance'] as number)) / 100);
}

/** A part's spread either side: three points for a writer at 100 in it, eighteen for one at 0. */
export const spread = (s: number): number => 3 + 15 * (1 - s / 100);

/** The attributes a stretch of work used, each by `use`. */
function used(parts: readonly Part[], use: number, also: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parts) for (const id of Object.keys(PARTS[p])) out[id] = use;
  for (const id of also) out[id] = use;
  return out;
}

export interface WriteArgs {
  [key: string]: string | number;
  form: Form;
  /** The days given to the first draft. */
  days: number;
}

const wholeDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`the days given are a whole number of at least 1 (${days})`);
};

/** Writes a script's first draft. */
function write(s: Working, a: WriteArgs, c: Context): void {
  if (!(a.form in DAYS)) throw new Error(`there's no form ${String(a.form)}`);
  wholeDays(a.days);
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const id = s.scripts.written.length + 1;
  const needed = daysNeeded(values, a.form);
  const f = finish(values, a.days, needed);
  const parts = {} as Record<Part, number>;
  for (const p of PART_NAMES) {
    // @slate:consumer attributes.choose
    const k = skill(values, p);
    const d = c.draws('work.draft', id, 1, p).float();
    parts[p] = clamp(k * f + spread(k) * (2 * d - 1), 0, 100);
  }
  s.scripts.written.push({ id, form: a.form, started: c.now, needed, drafts: 1, parts, reads: [] });
  practise(values, used(PART_NAMES, Math.min(1.5, a.days / needed), ['time-management', 'perseverance']));
  s.attributes['screenwriter'] = values;
}

export function scriptOf(s: ScriptsSlice, id: number): Script {
  const found = s.written.find((x) => x.id === id);
  if (found === undefined) throw new Error(`there's no script ${id}`);
  return found;
}

/** The n weakest parts; equal ones in the parts' own order, the sort being stable and `among` in that order. */
const lowest = (scores: Readonly<Record<Part, number>>, n: number, among: readonly Part[] = PART_NAMES): Part[] => [...among].sort((x, y) => scores[x] - scores[y]).slice(0, n);

/**
 * The writer's own read of a draft: each part as the writer judges it, off by up to twenty points for one with no eye
 * for a draft (Story Critique, with Critical Thinking behind it), by none for one at 100.
 */
export function ownRead(values: Values, script: Script, c: Pick<Context, 'draws'>): Record<Part, number> {
  const eye = 0.7 * (values['story-critique'] as number) + 0.3 * (values['critical-thinking'] as number);
  const out = {} as Record<Part, number>;
  for (const p of PART_NAMES) out[p] = script.parts[p] + 20 * (1 - eye / 100) * (2 * c.draws('work.read', 'own', script.id, script.drafts, p).float() - 1);
  return out;
}

export interface ReviseArgs {
  [key: string]: number;
  script: number;
  days: number;
}

/**
 * Revises a draft. The parts worked on are the last read's notes, or, with none, the three the writer's own read thinks
 * weakest; Taking Notes keeps the work on them (half of it at 0, all of it at 100), the rest spread over every part.
 * Each part moves toward what the writer can do in it (five points past it, up to 100) by as much as the days and
 * Revision carry it.
 */
function revise(s: Working, a: ReviseArgs, c: Context): void {
  wholeDays(a.days);
  const values = { ...valuesOf(s.attributes, 'screenwriter') };
  const script = scriptOf(s.scripts, a.script);
  // @slate:consumer script.read
  const last = script.reads.at(-1);
  // @slate:consumer script.write
  const focus = last?.notes ?? lowest(ownRead(values, script, c), 3);
  const kept = 0.5 + (0.5 * (values['taking-notes'] as number)) / 100;
  const reach = Math.min(1, a.days / (0.4 * script.needed)) * (0.3 + (0.5 * (values['revision'] as number)) / 100);
  for (const p of PART_NAMES) {
    const share = (focus.includes(p) ? kept / focus.length : 0) + (1 - kept) / PART_NAMES.length;
    const target = Math.min(100, skill(values, p) + 5);
    script.parts[p] = clamp(script.parts[p] + (target - script.parts[p]) * Math.min(1, reach * share * 3), 0, 100);
  }
  script.drafts += 1;
  const use = Math.min(1.5, a.days / (0.4 * script.needed));
  practise(values, used(focus, use / 2, last === undefined ? ['revision', 'story-critique', 'critical-thinking'] : ['revision', 'taking-notes']));
  s.attributes['screenwriter'] = values;
}

/** A reader's criterion and the parts it reads, by their share (PAGE's criteria named as its judging page names them). */
export const CRITERIA: Readonly<Record<Reader, Readonly<Record<string, Readonly<Partial<Record<Part, number>>>>>>> = {
  'black-list': {
    premise: { premise: 1 },
    plot: { plot: 1 },
    characters: { characters: 1 },
    dialogue: { dialogue: 1 },
    setting: { setting: 1 },
  },
  page: {
    'premise/concept': { premise: 1 },
    presentation: { format: 1 },
    structure: { structure: 1 },
    plot: { plot: 1 },
    pacing: { structure: 0.5, plot: 0.5 },
    characters: { characters: 1 },
    dialogue: { dialogue: 1 },
    theme: { theme: 1 },
    'style/tone': { voice: 0.6, visual: 0.4 },
    'marketing potential': { premise: 0.5, producibility: 0.5 },
  },
};

/** The Black List's overall score from its components: its founder's finding of how its readers weigh them. */
export const BLACK_LIST_WEIGHTS: Readonly<Record<string, number>> = { plot: 1 / 3, characters: 0.225, dialogue: 0.225, premise: 0.10835, setting: 0.10835 };

/** How a reader turns a part's 0 to 100 into its 1 to 10, a reader's own taste moving it up to five points. */
const tenth = (n: number) => clamp(Math.round(1 + (9 * n) / 100), 1, 10);

/** A reader's scores for a script, by its own criteria. */
export function scoresOf(reader: Reader, script: Script, c: Pick<Context, 'draws'>): { scores: Record<string, number>; overall: number } {
  const scores: Record<string, number> = {};
  for (const [name, mix] of Object.entries(CRITERIA[reader])) {
    const n = Object.entries(mix).reduce((t, [p, w]) => t + (w as number) * script.parts[p as Part], 0);
    scores[name] = tenth(n + 5 * (2 * c.draws('work.read', reader, script.id, script.drafts, name).float() - 1));
  }
  if (reader === 'black-list') {
    const weighed = Object.entries(BLACK_LIST_WEIGHTS).reduce((t, [k, w]) => t + w * (scores[k] as number), 0);
    // An execution score holds the whole down: the overall goes no more than a point above the weakest of the three.
    const floor = Math.min(scores['plot'] as number, scores['characters'] as number, scores['dialogue'] as number);
    return { scores, overall: clamp(Math.round(Math.min(weighed, floor + 1)), 1, 10) };
  }
  const values = Object.values(scores);
  return { scores, overall: clamp(Math.round(values.reduce((t, v) => t + v, 0) / values.length), 1, 10) };
}

export interface ReadArgs {
  [key: string]: string | number;
  script: number;
  reader: Reader;
}

function read(s: { scripts: ScriptsSlice }, a: ReadArgs, c: Context): void {
  if (!(a.reader in CRITERIA)) throw new Error(`there's no reader ${String(a.reader)}`);
  const script = scriptOf(s.scripts, a.script);
  // @slate:consumer script.write
  // @slate:consumer script.revise
  const { scores, overall } = scoresOf(a.reader, script, c);
  const graded = PART_NAMES.filter((p) => Object.values(CRITERIA[a.reader]).some((mix) => p in mix));
  script.reads.push({ reader: a.reader, at: c.now, scores, overall, notes: lowest(script.parts, 3, graded) });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const writeScript = defineCommand<Working, WriteArgs>({ id: 'script.write', reads: [], writes: ['attributes', 'scripts'], run: write });
export const reviseScript = defineCommand<Working, ReviseArgs>({ id: 'script.revise', reads: [], writes: ['attributes', 'scripts'], run: revise });
export const readScript = defineCommand<{ scripts: ScriptsSlice }, ReadArgs>({ id: 'script.read', reads: [], writes: ['scripts'], run: read });
