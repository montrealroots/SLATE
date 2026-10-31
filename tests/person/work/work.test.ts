import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { ATTRIBUTES_START, chooseAttributes, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  BLACK_LIST_WEIGHTS,
  CRITERIA,
  DAYS,
  daysNeeded,
  finish,
  MODEL_LINE,
  ownRead,
  PART_NAMES,
  PARTS,
  readScript,
  reviseScript,
  SCRIPTS_START,
  scoresOf,
  scriptOf,
  skill,
  spread,
  writeScript,
  type Part,
  type Read,
  type Script,
  type ScriptsSlice,
} from '../../../src/person/work/work.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

type Working = { attributes: AttributesSlice; scripts: ScriptsSlice };
const SEED = '0123456789abcdef';
const ctx = { draws: (decider: 'work.read', ...keys: (string | number)[]) => draws(seedFromText(SEED), decider, ...keys) };

const made = (all: number, each: Record<string, number> = {}, seed = SEED): Life<Working> =>
  dispatch(begin(seed, 0, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START) }), chooseAttributes, { role: 'screenwriter', all, each });
const written = (all: number, days = 60, each: Record<string, number> = {}, seed = SEED) => dispatch(made(all, each, seed), writeScript, { form: 'feature', days });
const first = (l: Life<Working>): Script => l.slices.scripts.written[0] as Script;
const only = (reads: readonly Read[]): Read => {
  expect(reads).toHaveLength(1);
  return reads[0] as Read;
};
const values = (all: number, each: Record<string, number> = {}) => made(all, each).slices.attributes['screenwriter'] as Record<string, number>;

describe('a script', () => {
  it("is written in parts, each from the attributes that write it, Writing behind the page's parts", () => {
    expect(PART_NAMES).toEqual(['characters', 'dialogue', 'structure', 'plot', 'theme', 'premise', 'setting', 'visual', 'voice', 'format', 'producibility']);
    for (const p of PART_NAMES) expect(Object.values(PARTS[p]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    const v = values(50, { dialogue: 90, writing: 10 });
    expect(skill(v, 'dialogue')).toBeCloseTo(0.7 * 90 + 0.3 * 10, 10);
    expect(skill(v, 'format')).toBe(50);
    expect(MODEL_LINE).toBe('work.model');
  });

  it('comes out at the top of the scale from a writer at 100 in everything, given its days', () => {
    const s = first(written(100));
    for (const p of PART_NAMES) expect(s.parts[p], p).toBeGreaterThanOrEqual(97);
    expect(s).toMatchObject({ id: 1, form: 'feature', started: 0, needed: 60, drafts: 1, reads: [] });
  });

  it('comes out as good as the writer is: around 50 from a writer at 50, hardly readable from one at 10', () => {
    const mid = first(written(50, 120));
    for (const p of PART_NAMES) expect(Math.abs(mid.parts[p] - 50), p).toBeLessThanOrEqual(spread(50));
    const low = first(written(10, 120));
    for (const p of PART_NAMES) expect(low.parts[p], p).toBeLessThanOrEqual(10 + spread(10));
    const mean = (s: Script) => PART_NAMES.reduce((t, p) => t + s.parts[p], 0) / PART_NAMES.length;
    expect(mean(first(written(100)))).toBeGreaterThan(mean(mid));
    expect(mean(mid)).toBeGreaterThan(mean(low));
  });

  it('is better in a part when the attribute that writes it is higher, the rest alike', () => {
    for (const p of PART_NAMES) {
      const own = Object.keys(PARTS[p])[0] as string;
      expect(first(written(50, 120, { [own]: 90 })).parts[p], p).toBeGreaterThan(first(written(50, 120, { [own]: 20 })).parts[p]);
    }
  });

  it('is moved in a part by every attribute that writes it', () => {
    for (const p of PART_NAMES) for (const id of Object.keys(PARTS[p])) expect(skill(values(50, { [id]: 90 }), p), `${p} by ${id}`).toBeGreaterThan(skill(values(50, { [id]: 20 }), p));
  });

  it('spreads less as the writer gets better', () => {
    expect(spread(100)).toBe(3);
    expect(spread(0)).toBe(18);
    expect(spread(50)).toBe(10.5);
  });

  it('needs days by Writing and Time Management, and a rushed draft keeps less, Perseverance holding more of it', () => {
    expect(daysNeeded(values(100), 'feature')).toBe(DAYS.feature);
    expect(daysNeeded(values(0), 'feature')).toBe(120);
    expect(daysNeeded(values(0, { writing: 100 }), 'short')).toBe(13);
    expect(daysNeeded(values(0, { 'time-management': 100 }), 'episode')).toBe(29);
    expect(DAYS).toEqual({ feature: 60, pilot: 30, episode: 20, short: 10 });
    expect(finish(values(0), 60, 60)).toBe(1);
    expect(finish(values(0), 90, 60)).toBe(1);
    expect(finish(values(0), 30, 60)).toBeCloseTo(0.7, 10);
    expect(finish(values(100), 30, 60)).toBeCloseTo(0.85, 10);
    expect(first(written(100, 20)).parts.dialogue).toBeLessThan(first(written(100, 60)).parts.dialogue);
  });

  it('raises the attributes its writing used, and none past 100', () => {
    const after = written(50, 120).slices.attributes['screenwriter'] as Record<string, number>;
    for (const id of ['dialogue', 'writing', 'premise', 'innovation', 'research', 'screenplay-format', 'film-production-process', 'time-management', 'perseverance']) expect(after[id], id).toBeGreaterThan(50);
    expect(after['pitching']).toBe(50);
    expect(after['revision']).toBe(50);
    expect(Object.values(written(100).slices.attributes['screenwriter'] as Record<string, number>).every((v) => v === 100)).toBe(true);
  });

  it('is refused in a form there is not, for days that are not whole, or before the attributes are chosen', () => {
    expect(() => dispatch(made(50), writeScript, { form: 'novel' as 'feature', days: 10 })).toThrow("there's no form novel");
    expect(() => dispatch(made(50), writeScript, { form: 'short', days: 0 })).toThrow(RangeError);
    expect(() => dispatch(made(50), writeScript, { form: 'short', days: 1.5 })).toThrow('the days given are a whole number of at least 1 (1.5)');
    const bare = begin(SEED, 0, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START) });
    expect(() => dispatch(bare, writeScript, { form: 'short', days: 5 })).toThrow("the screenwriter's attributes haven't been chosen");
    expect(() => scriptOf(SCRIPTS_START, 1)).toThrow("there's no script 1");
  });

  it('is the same for the same life and differs for another', () => {
    expect(first(written(50, 120)).parts).toEqual(first(written(50, 120)).parts);
    expect(first(written(50, 120, {}, 'fedcba9876543210')).parts).not.toEqual(first(written(50, 120)).parts);
  });
});

describe('a reader', () => {
  it("grades by its own criteria: the Black List's five, PAGE's ten", () => {
    expect(Object.keys(CRITERIA['black-list'])).toEqual(['premise', 'plot', 'characters', 'dialogue', 'setting']);
    expect(Object.keys(CRITERIA.page)).toEqual(['premise/concept', 'presentation', 'structure', 'plot', 'pacing', 'characters', 'dialogue', 'theme', 'style/tone', 'marketing potential']);
    for (const mixes of Object.values(CRITERIA)) for (const mix of Object.values(mixes)) expect(Object.values(mix).reduce((a, b) => a + (b as number), 0)).toBeCloseTo(1, 10);
    const graded = new Set(Object.values(CRITERIA).flatMap((m) => Object.values(m).flatMap((mix) => Object.keys(mix))));
    expect([...graded].sort()).toEqual([...PART_NAMES].sort());
    expect(Object.values(BLACK_LIST_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
  });

  it('gives a writer at 100 the top of its scale, one at 50 the middle, one at 10 the bottom', () => {
    const top = dispatch(written(100), readScript, { script: 1, reader: 'black-list' });
    const r = only(first(top).reads);
    expect(r.overall).toBe(10);
    for (const v of Object.values(r.scores)) expect(v).toBeGreaterThanOrEqual(9);
    expect(r).toMatchObject({ reader: 'black-list', at: 0 });
    const page = only(first(dispatch(written(100), readScript, { script: 1, reader: 'page' })).reads);
    expect(Object.keys(page.scores)).toHaveLength(10);
    expect(page.overall).toBeGreaterThanOrEqual(9);
    const mid = only(first(dispatch(written(50, 120), readScript, { script: 1, reader: 'black-list' })).reads);
    expect(mid.overall).toBeGreaterThanOrEqual(4);
    expect(mid.overall).toBeLessThanOrEqual(7);
    const low = only(first(dispatch(written(10, 120), readScript, { script: 1, reader: 'black-list' })).reads);
    expect(low.overall).toBeLessThanOrEqual(3);
  });

  it("weighs the Black List's components as its founder found, a weak execution score holding the whole down", () => {
    const at = (parts: Partial<Record<Part, number>>): Script => ({ id: 9, form: 'feature', started: 0, needed: 60, drafts: 1, reads: [], parts: { ...Object.fromEntries(PART_NAMES.map((p) => [p, 100])), ...parts } as Record<Part, number> });
    const strong = scoresOf('black-list', at({}), ctx);
    expect(strong.overall).toBe(10);
    const weakPlot = scoresOf('black-list', at({ plot: 40 }), ctx);
    expect(weakPlot.scores['plot']).toBeLessThanOrEqual(5);
    expect(weakPlot.overall).toBeLessThanOrEqual((weakPlot.scores['plot'] as number) + 1);
    const weakSetting = scoresOf('black-list', at({ setting: 40 }), ctx);
    expect(weakSetting.overall).toBeGreaterThan(weakPlot.overall);
    const flat = scoresOf('page', at({ format: 0 }), ctx);
    expect(flat.scores['presentation']).toBeLessThanOrEqual(2);
    expect(flat.overall).toBe(Math.round(Object.values(flat.scores).reduce((a, b) => a + b, 0) / 10));
  });

  it("notes the three weakest parts it grades, weakest first", () => {
    const l = dispatch(written(50, 120, { dialogue: 0, plot: 5, setting: 10, 'screenplay-format': 0 }), readScript, { script: 1, reader: 'black-list' });
    const s = first(l);
    const graded: Part[] = ['characters', 'dialogue', 'plot', 'premise', 'setting'];
    expect(s.reads[0]?.notes).toEqual([...graded].sort((x, y) => s.parts[x] - s.parts[y]).slice(0, 3));
    expect(s.reads[0]?.notes).not.toContain('format');
    expect(new Set(s.reads[0]?.notes)).toEqual(new Set(['dialogue', 'plot', 'setting']));
    const p = first(dispatch(written(50, 120, { 'screenplay-format': 0, dialogue: 0, plot: 5 }), readScript, { script: 1, reader: 'page' }));
    expect(p.reads[0]?.notes).toContain('format');
  });

  it('is refused for a reader there is not', () => {
    expect(() => dispatch(written(50), readScript, { script: 1, reader: 'nobody' as 'page' })).toThrow("there's no reader nobody");
  });

  it('script.read: a better draft is graded higher', () => {
    falsifyAny({ feature: 'script.read', claim: 'bites', says: 'a writer at 90 is graded above one at 30', base: 30, twin: 90, outcome: (n) => first(dispatch(written(n, 120), readScript, { script: 1, reader: 'black-list' })).reads[0]?.overall });
  });
});

describe('a revision', () => {
  it("moves the noted parts toward what the writer can do, as far as Revision carries it", () => {
    const rushed = dispatch(written(80, 10), readScript, { script: 1, reader: 'black-list' });
    const notes = only(first(rushed).reads).notes;
    const before = first(rushed).parts;
    const after = first(dispatch(rushed, reviseScript, { script: 1, days: 30 }));
    expect(after.drafts).toBe(2);
    for (const p of notes) expect(after.parts[p], p).toBeGreaterThan(before[p]);
    const better = first(dispatch(dispatch(written(80, 10, { revision: 100 }), readScript, { script: 1, reader: 'black-list' }), reviseScript, { script: 1, days: 30 }));
    const worse = first(dispatch(dispatch(written(80, 10, { revision: 0 }), readScript, { script: 1, reader: 'black-list' }), reviseScript, { script: 1, days: 30 }));
    for (const p of notes) expect(better.parts[p], p).toBeGreaterThan(worse.parts[p]);
  });

  it('keeps the work on the noted parts as far as Taking Notes keeps it', () => {
    const base = (tn: number) => dispatch(written(80, 10, { 'taking-notes': tn }), readScript, { script: 1, reader: 'black-list' });
    const notes = only(first(base(0)).reads).notes;
    const gain = (tn: number) => {
      const b = base(tn);
      const a = first(dispatch(b, reviseScript, { script: 1, days: 30 }));
      return notes.reduce((t, p) => t + a.parts[p] - first(b).parts[p], 0);
    };
    expect(gain(100)).toBeGreaterThan(gain(0));
  });

  it("works on what the writer's own read thinks weakest where no reader has noted it, read truer with a better eye", () => {
    const s = first(written(60, 120));
    const sharp = ownRead({ ...values(60), 'story-critique': 100, 'critical-thinking': 100 }, s, ctx);
    for (const p of PART_NAMES) expect(sharp[p]).toBeCloseTo(s.parts[p], 10);
    const blind = ownRead(values(60, { 'story-critique': 0, 'critical-thinking': 0 }), s, ctx);
    const off = PART_NAMES.reduce((t, p) => t + Math.abs(blind[p] - s.parts[p]), 0);
    expect(off).toBeGreaterThan(0);
    for (const p of PART_NAMES) expect(Math.abs(blind[p] - s.parts[p])).toBeLessThanOrEqual(20);
    const after = dispatch(written(60, 10), reviseScript, { script: 1, days: 20 });
    expect(first(after).drafts).toBe(2);
    const grew = after.slices.attributes['screenwriter'] as Record<string, number>;
    expect(grew['story-critique']).toBeGreaterThan(60);
    expect(grew['critical-thinking']).toBeGreaterThan(60);
    expect(grew['revision']).toBeGreaterThan(60);
    expect(grew['taking-notes']).toBe(60);
  });

  it('raises Revision and Taking Notes when it answers a reader', () => {
    const l = dispatch(dispatch(written(60, 10), readScript, { script: 1, reader: 'page' }), reviseScript, { script: 1, days: 20 });
    const v = l.slices.attributes['screenwriter'] as Record<string, number>;
    expect(v['revision']).toBeGreaterThan(60);
    expect(v['taking-notes']).toBeGreaterThan(60);
    expect(v['story-critique']).toBe(60);
  });

  it('script.write: a better writer writes a better draft', () => {
    falsifyAny({ feature: 'script.write', claim: 'bites', says: 'a writer at 90 in dialogue writes better dialogue than one at 30', base: 30, twin: 90, outcome: (n) => first(written(50, 120, { dialogue: n })).parts.dialogue });
  });

  it('script.revise: more days carry a revision further', () => {
    const rushed = dispatch(written(80, 10), readScript, { script: 1, reader: 'black-list' });
    falsifyAny({ feature: 'script.revise', claim: 'bites', says: 'a longer revision lifts the draft further', base: 2, twin: 30, outcome: (d) => first(dispatch(rushed, reviseScript, { script: 1, days: d })).parts.dialogue });
  });
});

describe('the reckoning, exactly', () => {
  const u = (decider: 'work.draft' | 'work.read', ...keys: (string | number)[]) => 2 * draws(seedFromText(SEED), decider, ...keys).float() - 1;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  it("scores each part as the writer's level in it, shortened by rushing, moved within the writer's spread", () => {
    const v = values(50, { dialogue: 80 });
    const s = first(written(50, 30, { dialogue: 80 }));
    const needed = daysNeeded(v, 'feature');
    expect(needed).toBe(80);
    const f = finish(v, 30, needed);
    for (const p of PART_NAMES) expect(s.parts[p], p).toBeCloseTo(clamp(skill(v, p) * f + spread(skill(v, p)) * u('work.draft', 1, 1, p)), 10);
    expect(first(dispatch(made(50), writeScript, { form: 'short', days: 1 })).needed).toBe(daysNeeded(values(50), 'short'));
  });

  it("raises each attribute used by the draft's share of its days, up to half again", () => {
    const at = (days: number) => written(50, days).slices.attributes['screenwriter'] as Record<string, number>;
    expect(at(60)['dialogue']).toBeCloseTo(50 + 4 * (60 / 80) * 0.5, 10);
    expect(at(240)['dialogue']).toBeCloseTo(50 + 4 * 1.5 * 0.5, 10);
  });

  it("reads the writer's own judgement of each part, off by the eye's want", () => {
    const v = values(60, { 'story-critique': 30, 'critical-thinking': 80 });
    const s = first(written(60, 120));
    const r = ownRead(v, s, ctx);
    const eye = 0.7 * 30 + 0.3 * 80;
    for (const p of PART_NAMES) expect(r[p], p).toBeCloseTo(s.parts[p] + 20 * (1 - eye / 100) * u('work.read', 'own', 1, 1, p), 10);
  });

  it("grades each criterion as the parts it reads, moved by the reader's taste, on 1 to 10", () => {
    const s = first(written(60, 120));
    const { scores } = scoresOf('page', s, ctx);
    for (const [name, mix] of Object.entries(CRITERIA.page)) {
      const n = Object.entries(mix).reduce((t, [p, w]) => t + (w as number) * s.parts[p as Part], 0);
      expect(scores[name], name).toBe(Math.min(10, Math.max(1, Math.round(1 + (9 * (n + 5 * u('work.read', 'page', 1, 1, name))) / 100))));
    }
  });

  it('revises each part toward the writer, by the days, Revision, and the share of the work on it', () => {
    const v = values(70, { revision: 40, 'taking-notes': 60, dialogue: 90 });
    const base = dispatch(written(70, 10, { revision: 40, 'taking-notes': 60, dialogue: 90 }), readScript, { script: 1, reader: 'black-list' });
    const before = first(base);
    const vBefore = base.slices.attributes['screenwriter'] as Record<string, number>;
    const after = dispatch(base, reviseScript, { script: 1, days: 10 });
    const notes = only(before.reads).notes;
    const kept = 0.5 + (0.5 * (vBefore['taking-notes'] as number)) / 100;
    const reach = Math.min(1, 10 / (0.4 * before.needed)) * (0.3 + (0.5 * (vBefore['revision'] as number)) / 100);
    for (const p of PART_NAMES) {
      const share = (notes.includes(p) ? kept / 3 : 0) + (1 - kept) / PART_NAMES.length;
      const target = Math.min(100, skill(vBefore, p) + 5);
      expect(first(after).parts[p], p).toBeCloseTo(before.parts[p] + (target - before.parts[p]) * Math.min(1, reach * share * 3), 10);
    }
    expect(v['revision']).toBe(40);
    const grown = after.slices.attributes['screenwriter'] as Record<string, number>;
    const use = Math.min(1.5, 10 / (0.4 * before.needed));
    expect(grown['revision']).toBeCloseTo((vBefore['revision'] as number) + 4 * (use / 2) * (1 - (vBefore['revision'] as number) / 100), 10);
    expect(grown['taking-notes']).toBeCloseTo((vBefore['taking-notes'] as number) + 4 * (use / 2) * (1 - (vBefore['taking-notes'] as number) / 100), 10);
    expect(grown['critical-thinking']).toBe(vBefore['critical-thinking']);
    for (const p of notes) for (const id of Object.keys(PARTS[p])) if (id !== 'revision') expect(grown[id], id).toBeGreaterThan(vBefore[id] as number);
    const long = dispatch(base, reviseScript, { script: 1, days: 400 });
    const capped = (long.slices.attributes['screenwriter'] as Record<string, number>)['taking-notes'] as number;
    expect(capped).toBeCloseTo((vBefore['taking-notes'] as number) + 4 * 0.75 * (1 - (vBefore['taking-notes'] as number) / 100), 10);
    for (const p of PART_NAMES) expect(first(long).parts[p]).toBeLessThanOrEqual(Math.min(100, skill(vBefore, p) + 5) + 1e-9);
  });

  it('revises without notes on what the own read finds weakest, growing the eye', () => {
    const base = written(60, 10);
    const s = first(base);
    const vb = base.slices.attributes['screenwriter'] as Record<string, number>;
    const r = ownRead(vb, s, ctx);
    const focus = [...PART_NAMES].sort((x, y) => r[x] - r[y]).slice(0, 3);
    const after = first(dispatch(base, reviseScript, { script: 1, days: 20 }));
    const kept = 0.5 + (0.5 * (vb['taking-notes'] as number)) / 100;
    const reach = Math.min(1, 20 / (0.4 * s.needed)) * (0.3 + (0.5 * (vb['revision'] as number)) / 100);
    for (const p of PART_NAMES) {
      const share = (focus.includes(p) ? kept / 3 : 0) + (1 - kept) / PART_NAMES.length;
      expect(after.parts[p], p).toBeCloseTo(s.parts[p] + (Math.min(100, skill(vb, p) + 5) - s.parts[p]) * Math.min(1, reach * share * 3), 10);
    }
  });

  it('names its weakest parts in their order where they tie', () => {
    const flat: Script = { id: 1, form: 'short', started: 0, needed: 10, drafts: 1, reads: [], parts: Object.fromEntries(PART_NAMES.map((p) => [p, 50])) as Record<Part, number> };
    const l = dispatch(begin(SEED, 0, { attributes: {}, scripts: { written: [flat] } }), readScript, { script: 1, reader: 'black-list' });
    expect(only(first(l).reads).notes).toEqual(['characters', 'dialogue', 'plot']);
  });

  it('finds the script asked for among several, and refuses a revision of no days', () => {
    const two = dispatch(dispatch(written(50, 60), writeScript, { form: 'short', days: 5 }), readScript, { script: 2, reader: 'page' });
    expect(two.slices.scripts.written.map((x) => [x.id, x.form, x.reads.length])).toEqual([[1, 'feature', 0], [2, 'short', 1]]);
    expect(scriptOf(two.slices.scripts, 2).form).toBe('short');
    expect(() => dispatch(written(50), reviseScript, { script: 1, days: 0 })).toThrow('the days given are a whole number of at least 1 (0)');
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('script.') || x.id === 'attributes.choose')).toEqual([
      { id: 'attributes.choose', reads: [], writes: ['attributes'] },
      { id: 'script.write', reads: [], writes: ['attributes', 'scripts'] },
      { id: 'script.revise', reads: [], writes: ['attributes', 'scripts'] },
      { id: 'script.read', reads: [], writes: ['scripts'] },
    ]);
  });
});
