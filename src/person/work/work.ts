import { defineCommand, type Context } from '../../core/frame/frame.ts';
import type { LineId } from '../../core/text/text.ts';
import { componentOf, componentValues, practise, skillOf, type AttributesSlice, type Facet } from '../attributes/attributes.ts';
import { lovesOrRefuse, type GenresSlice } from '../genres/genres.ts';

/**
 * The screenwriter's work and how good it comes out (BUILD-ORDER layer 4; the owner, 2026-10-31: "I want my attributes
 * to effect the quality of my work ... it needs to actually produce results depending on how bad or good I am"; and on
 * the attributes' meanings: "I want those meanings to mean something and actually reflect on the work").
 *
 * A script is written as a draft, revised, and read, facet by facet. Each part a reader grades is one of the
 * screenwriter's craft components (Characters, Dialogue ...; each read at the level of the broad attribute that covers
 * it, Story, Characters, Voice, Writing, Pitching), and each part is made of the facets the sources name
 * (R-4607: Dialogue is natural and believable, a voice for each character, revealing character, moving the story,
 * succinct, subtext over statement, fitting the tone and world). A facet's score comes from the writer's attribute
 * (60%), Writing behind every page (25%), and the attributes a source ties to the facet (15%): where Innovation's or
 * Research's facets name a part's matter (original plots and characters; an authentic world and people), they count
 * toward that part too. The draft's time against the time it needs, and a spread that narrows as the writer gets
 * better, do the rest: a writer at 100 throughout writes at 97 to 100 in every facet, one at 50 around 40 to 60.
 *
 * The time a draft needs is the trade's: a feature in eight weeks from a writer at the top (John August's expectation;
 * the MBA holds a first draft at most 9.2 weeks at high budget), twice that from one at the bottom (the longest he
 * reports runs four months); an episode within the MBA's 2.4 weeks a slow writer spends, half that a fast one (R-4608).
 * A rewrite has two thirds of a draft's time and a polish a third (the MBA's step periods, 6.1 and 3.1 weeks against
 * 9.2), and they do what the MBA says each is: a rewrite changes the plot, the story line and the characters'
 * relationships, anything on the page; a polish only the dialogue, the narration and the action.
 *
 * Readers grade by their own published criteria, each on the facets its criteria name: the Black List's five
 * components, on its 1 to 10 scale, combined as its own data shows (its regression's weights: plot 31.8%, characters
 * 23.4%, dialogue 21.9%, premise 13%, setting 10.2%; and the overall sitting 0.38 of the way from the weakest component
 * to the strongest, almost never outside them), each reader's taste a spread fitted to how far two of its readers differ
 * on the same script (the same score 30% of the time, a point apart 44%, two 19%); PAGE International's ten criteria.
 * A reader's notes name the three weakest facets it grades, and the next revision works on them.
 *
 * A script is written in a genre, and the writer writes in the genres they love (the game's reading of the Genres page,
 * person.genres.model): a genre not loved is refused. Its genre is what the market reads of it (src/person/genres).
 *
 * The model's own figures (the shares, the spreads at 0 and 100, how far a revision carries) are the game's until the
 * owner balances them (person.work.model); the figures named above are the sources' (R-4607, R-4608).
 */

export const MODEL_LINE: LineId = 'work.model';

export type Form = 'feature' | 'pilot' | 'episode' | 'short';

/**
 * The days a first draft needs from a writer at 100 in Writing and Time Management; twice that from one at 0. A feature
 * is August's eight weeks; an episode half the MBA's 2.4 weeks (16.8 days), so the slowest writer takes all of them.
 * shortcut: no source gives a pilot's or a short's writing time (R-4608 blockers); a pilot is held at an episode and a
 * half (the MBA pays a pilot 150% of an episode) and a short at ten days, the game's own, until a source is found.
 */
export const DAYS: Readonly<Record<Form, number>> = { feature: 56, pilot: 12.6, episode: 8.4, short: 10 };

/** The parts a reader grades: the screenwriter's craft attributes, each scored facet by facet. */
export const PARTS = ['characters', 'dialogue', 'structure', 'plot', 'theme', 'premise', 'setting', 'visual-storytelling', 'distinctive-voice', 'screenplay-format', 'film-production-process'] as const;
export type Part = (typeof PARTS)[number];

/** The attributes whose facets feed a part where a source ties them to it: what the writer brings to the page. */
export const SOURCES_OF_MATTER = ['innovation', 'research'] as const;

export type Reader = 'black-list' | 'page';

/** A facet a reader's notes name. */
export interface Note {
  readonly part: Part;
  readonly facet: string;
}

export interface Read {
  readonly reader: Reader;
  readonly at: number;
  /** The reader's score for each of its criteria, 1 to 10. */
  readonly scores: Record<string, number>;
  readonly overall: number;
  /** The three weakest facets the reader grades. */
  readonly notes: Note[];
}

export interface Script {
  readonly id: number;
  readonly form: Form;
  /** The genre it is written in, by id. */
  readonly genre: string;
  readonly started: number;
  /** The days the first draft needed from this writer. */
  readonly needed: number;
  drafts: number;
  /** Each part's facets' scores, 0 to 100. */
  facets: Record<Part, Record<string, number>>;
  reads: Read[];
}

export interface ScriptsSlice {
  written: Script[];
}

export const SCRIPTS_START: ScriptsSlice = { written: [] };

type Values = Readonly<Record<string, number>>;
type Working = { attributes: AttributesSlice; scripts: ScriptsSlice };
type Writing = Working & { genres: GenresSlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mean = (xs: readonly number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;

export const facetsOf = (part: Part): readonly Facet[] => componentOf('screenwriter', part).facets;

/**
 * The attributes that count toward a facet besides its own and Writing: those a source ties to it (no part's facet is
 * tied to its own part or to Writing, which a test holds), and Innovation or Research where one of their facets names
 * this part.
 */
export function tiedTo(part: Part, facet: Facet): string[] {
  const out = new Set(facet.draws);
  for (const id of SOURCES_OF_MATTER) if (componentOf('screenwriter', id).facets.some((f) => f.draws.includes(part))) out.add(id);
  return [...out];
}

/** What the writer can do in a facet of a part. */
export function skill(values: Values, part: Part, facet: Facet): number {
  const own = values[part] as number;
  const writing = values['writing'] as number;
  const tied = tiedTo(part, facet);
  if (tied.length === 0) return 0.7 * own + 0.3 * writing;
  return 0.6 * own + 0.25 * writing + (0.15 * tied.reduce((t, id) => t + (values[id] as number), 0)) / tied.length;
}

/** A part's score: its facets' mean. */
export const partScore = (script: Script, part: Part): number => mean(Object.values(script.facets[part]));

/** The days a draft of this form needs from this writer. */
export function daysNeeded(values: Values, form: Form): number {
  const pace = 0.6 * skillOf(values, 'screenwriter', 'writing') + 0.4 * skillOf(values, 'screenwriter', 'time-management');
  return Math.ceil(DAYS[form] / (0.5 + (0.5 * pace) / 100));
}

/** How far short time leaves a draft: whole when the days are enough; Perseverance carries more of a short stretch. */
export function finish(values: Values, days: number, needed: number): number {
  const effort = Math.min(1, days / needed);
  return 1 - (1 - effort) * (0.6 - (0.3 * skillOf(values, 'screenwriter', 'perseverance')) / 100);
}

/** A facet's spread either side: three points for a writer at 100 in it, eighteen for one at 0. */
export const spread = (s: number): number => 3 + 15 * (1 - s / 100);

/** Every attribute a stretch of drafting used: the parts', Writing, and what feeds them. */
const DRAFTING = [...PARTS, 'writing', 'time-management', 'perseverance', ...SOURCES_OF_MATTER];

export interface WriteArgs {
  [key: string]: string | number;
  form: Form;
  /** The genre, by id: one the writer loves. */
  genre: string;
  /** The days given to the first draft. */
  days: number;
}

const wholeDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`the days given are a whole number of at least 1 (${days})`);
};

/** Writes a script's first draft. */
function write(s: Writing, a: WriteArgs, c: Context): void {
  if (!(a.form in DAYS)) throw new Error(`there's no form ${String(a.form)}`);
  wholeDays(a.days);
  // @slate:consumer genres.choose
  lovesOrRefuse(s.genres, a.genre);
  const values = componentValues(s.attributes, 'screenwriter');
  const id = s.scripts.written.length + 1;
  const needed = daysNeeded(values, a.form);
  const f = finish(values, a.days, needed);
  const facets = {} as Record<Part, Record<string, number>>;
  for (const p of PARTS) {
    facets[p] = {};
    for (const facet of facetsOf(p)) {
      // @slate:consumer attributes.choose
      const k = skill(values, p, facet);
      facets[p][facet.id] = clamp(k * f + spread(k) * (2 * c.draws('work.draft', id, 1, p, facet.id).float() - 1), 0, 100);
    }
  }
  s.scripts.written.push({ id, form: a.form, genre: a.genre, started: c.now, needed, drafts: 1, facets, reads: [] });
  practise(s.attributes, 'screenwriter', DRAFTING, a.days);
}

export function scriptOf(s: ScriptsSlice, id: number): Script {
  const found = s.written.find((x) => x.id === id);
  if (found === undefined) throw new Error(`there's no script ${id}`);
  return found;
}

/** Every facet of a script, part by part. */
const allNotes = (): Note[] => PARTS.flatMap((part) => facetsOf(part).map((f) => ({ part, facet: f.id })));
const scoreOf = (script: Script, n: Note) => script.facets[n.part][n.facet] as number;

/** The n weakest of the facets given, by their scores; equal ones in their own order, the sort being stable. */
const weakest = (score: (n: Note) => number, among: readonly Note[], n: number): Note[] => [...among].sort((x, y) => score(x) - score(y)).slice(0, n);

/**
 * The writer's own read of a draft: each facet as the writer judges it, off by up to twenty points for one with no eye
 * for a draft (Story Critique, with Critical Thinking behind it), by none for one at 100.
 */
export function ownRead(values: Values, script: Script, c: Pick<Context, 'draws'>): Record<Part, Record<string, number>> {
  const eye = 0.7 * skillOf(values, 'screenwriter', 'story-critique') + 0.3 * skillOf(values, 'screenwriter', 'critical-thinking');
  const out = {} as Record<Part, Record<string, number>>;
  for (const p of PARTS) {
    out[p] = {};
    for (const f of facetsOf(p)) out[p][f.id] = (script.facets[p][f.id] as number) + 20 * (1 - eye / 100) * (2 * c.draws('work.read', 'own', script.id, script.drafts, p, f.id).float() - 1);
  }
  return out;
}

/** The three weakest of the facets given, as the writer's own read judges them. */
function weakestOwn(values: Values, script: Script, open: readonly Note[], c: Pick<Context, 'draws'>): Note[] {
  // @slate:consumer script.write
  const own = ownRead(values, script, c);
  return weakest((n) => own[n.part][n.facet] as number, open, 3);
}

/** A revision's kind, as the MBA defines it, and its time against a first draft's (6.1 and 3.1 weeks against 9.2). */
export const REVISIONS = {
  /** "Significant changes in plot, story line, or interrelationship of characters": the whole page. */
  rewrite: { share: 6.14 / 9.22, parts: PARTS },
  /** "Changes in dialogue, narration, or action, but not including a rewrite." */
  polish: { share: 3.07 / 9.22, parts: ['dialogue', 'visual-storytelling', 'screenplay-format'] as readonly Part[] },
} as const;

export type Revision = keyof typeof REVISIONS;

export interface ReviseArgs {
  [key: string]: number | string;
  script: number;
  kind: Revision;
  days: number;
}

/**
 * Revises a draft. The facets worked on are the last read's notes, or, with none, the three the writer's own read thinks
 * weakest, of those the kind of revision can change; Taking Notes keeps the work on them (half of it at 0, all of it at
 * 100), the rest spread over what the revision can change. Each facet moves toward what the writer can do in it (five
 * points past it, up to 100) as far as the days and Revision carry it.
 */
function revise(s: Working, a: ReviseArgs, c: Context): void {
  if (!(a.kind in REVISIONS)) throw new Error(`there's no revision ${String(a.kind)}`);
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const script = scriptOf(s.scripts, a.script);
  const kind = REVISIONS[a.kind];
  const open = allNotes().filter((n) => kind.parts.includes(n.part));
  // @slate:consumer script.read
  const last = script.reads.at(-1);
  const focus = last !== undefined ? last.notes.filter((n) => kind.parts.includes(n.part)) : weakestOwn(values, script, open, c);
  const kept = 0.5 + (0.5 * skillOf(values, 'screenwriter', 'taking-notes')) / 100;
  const reach = Math.min(1, a.days / (kind.share * script.needed)) * (0.3 + (0.5 * skillOf(values, 'screenwriter', 'revision')) / 100);
  for (const n of open) {
    // Stryker disable next-line ConditionalExpression: no two parts share a facet's id (a test holds it), so the part's check can't change who is noted.
    const noted = focus.some((x) => x.part === n.part && x.facet === n.facet);
    const share = (noted ? kept / focus.length : 0) + (1 - kept) / open.length;
    const facet = facetsOf(n.part).find((f) => f.id === n.facet) as Facet;
    const target = Math.min(100, skill(values, n.part, facet) + 5);
    const now = scoreOf(script, n);
    script.facets[n.part][n.facet] = clamp(now + (target - now) * Math.min(1, reach * share * 3), 0, 100);
  }
  script.drafts += 1;
  // Revision covers Taking Notes, Story Critique and Critical Thinking: a revision teaches all of it at once.
  practise(s.attributes, 'screenwriter', [...focus.map((n) => n.part), 'revision', 'writing'], a.days);
}

/** A reader's criteria and the parts each reads (PAGE's named as its judging page names them). */
export const CRITERIA: Readonly<Record<Reader, Readonly<Record<string, readonly Part[]>>>> = {
  'black-list': {
    premise: ['premise'],
    plot: ['plot'],
    characters: ['characters'],
    dialogue: ['dialogue'],
    setting: ['setting'],
  },
  page: {
    'premise/concept': ['premise'],
    presentation: ['screenplay-format'],
    structure: ['structure'],
    plot: ['plot'],
    pacing: ['structure', 'plot'],
    characters: ['characters'],
    dialogue: ['dialogue'],
    theme: ['theme'],
    'style/tone': ['distinctive-voice', 'visual-storytelling'],
    'marketing potential': ['premise', 'film-production-process'],
  },
};

/** The facets of a part a reader grades: those its criteria name, or all of them where it names none. */
export function graded(reader: Reader, part: Part): Facet[] {
  const named = facetsOf(part).filter((f) => f.readers.includes(reader));
  return named.length > 0 ? named : [...facetsOf(part)];
}

/** The Black List's components' weights in its overall, from its regression (film: plot 31.8%, characters 23.4% ...). */
export const BLACK_LIST_WEIGHTS: Readonly<Record<string, number>> = { plot: 0.318, characters: 0.234, dialogue: 0.219, premise: 0.13, setting: 0.102 };

/** Where the overall sits between the weakest and the strongest component, in the Black List's data. */
export const BLACK_LIST_POSITION = 0.38;

/**
 * A reader's taste, on its 1 to 10 scale, as normal spreads fitted to how far two of the Black List's readers differ on
 * the same script (R-4608: the same overall 30% of the time, within a point 73.8%; a component within a point 65% to
 * 70%): a leniency moving all of one read's scores together, a spread of its own on each criterion, and the overall's
 * residual from its components (the Black List's regression leaves under 0.4 of a point).
 */
export const TASTE = { lenience: 0.75, criterion: 0.6, residual: 0.4 } as const;

/** A normal draw from two uniform ones (Box and Muller). */
export const normal = (d: { float(): number }): number => Math.sqrt(-2 * Math.log(1 - d.float())) * Math.cos(2 * Math.PI * d.float());

/** A reader's scores for a script, by its own criteria. */
export function scoresOf(reader: Reader, script: Script, c: Pick<Context, 'draws'>): { scores: Record<string, number>; overall: number } {
  const exact: Record<string, number> = {};
  const key = [reader, script.id, script.drafts, script.reads.length] as const;
  const lenience = TASTE.lenience * normal(c.draws('work.read', ...key, 'lenience'));
  for (const [name, parts] of Object.entries(CRITERIA[reader])) {
    const n = mean(parts.map((p) => mean(graded(reader, p).map((f) => script.facets[p][f.id] as number))));
    exact[name] = clamp(1 + (9 * n) / 100 + lenience + TASTE.criterion * normal(c.draws('work.read', ...key, name)), 1, 10);
  }
  const residual = TASTE.residual * normal(c.draws('work.read', ...key, 'overall'));
  const scores = Object.fromEntries(Object.entries(exact).map(([k, v]) => [k, Math.round(v)]));
  const values = Object.values(exact);
  if (reader === 'black-list') {
    // The regression's shares, as published, sum to 1.003.
    const weighed = Object.entries(BLACK_LIST_WEIGHTS).reduce((t, [k, w]) => t + w * (exact[k] as number), 0);
    const lo = Math.min(...values);
    const placed = lo + BLACK_LIST_POSITION * (Math.max(...values) - lo);
    return { scores, overall: clamp(Math.round((weighed + placed) / 2 + residual), 1, 10) };
  }
  return { scores, overall: clamp(Math.round(mean(values) + residual), 1, 10) };
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
  const reader = a.reader;
  const gradedNotes = PARTS.filter((p) => Object.values(CRITERIA[reader]).some((parts) => parts.includes(p))).flatMap((part) => graded(reader, part).map((f) => ({ part, facet: f.id })));
  script.reads.push({ reader, at: c.now, scores, overall, notes: weakest((n) => scoreOf(script, n), gradedNotes, 3) });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const writeScript = defineCommand<Writing, WriteArgs>({ id: 'script.write', reads: ['genres'], writes: ['attributes', 'scripts'], run: write });
export const reviseScript = defineCommand<Working, ReviseArgs>({ id: 'script.revise', reads: [], writes: ['attributes', 'scripts'], run: revise });
export const readScript = defineCommand<{ scripts: ScriptsSlice }, ReadArgs>({ id: 'script.read', reads: [], writes: ['scripts'], run: read });
