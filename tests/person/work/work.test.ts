import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { ATTRIBUTES_START, broadOf, chooseAttributes, componentValues, DAILY, skillOf, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  BLACK_LIST_POSITION,
  BLACK_LIST_WEIGHTS,
  CRITERIA,
  DAYS,
  daysNeeded,
  facetsOf,
  finish,
  graded,
  MODEL_LINE,
  normal,
  ownRead,
  PARTS,
  partScore,
  readScript,
  reviseScript,
  REVISIONS,
  SCRIPTS_START,
  scoresOf,
  scriptOf,
  skill,
  SOURCES_OF_MATTER,
  spread,
  TASTE,
  tiedTo,
  writeScript,
  type Part,
  type Read,
  type Script,
  type ScriptsSlice,
} from '../../../src/person/work/work.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

type Working = { attributes: AttributesSlice; scripts: ScriptsSlice };
const SEED = '0123456789abcdef';
const u = (decider: 'work.draft' | 'work.read', ...keys: (string | number)[]) => 2 * draws(seedFromText(SEED), decider, ...keys).float() - 1;
const ctx = { draws: (decider: 'work.read', ...keys: (string | number)[]) => draws(seedFromText(SEED), decider, ...keys) };
const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Levels set by component, held by the broad attribute that covers each (a later one wins where two share it). */
const toBroad = (each: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(each).map(([id, n]) => [broadOf('screenwriter', id).id, n]));
const made = (all: number, each: Record<string, number> = {}, seed = SEED): Life<Working> =>
  dispatch(begin(seed, 0, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START) }), chooseAttributes, { role: 'screenwriter', all, each: toBroad(each) });
const written = (all: number, days = 200, each: Record<string, number> = {}, seed = SEED, form: 'feature' | 'episode' = 'feature') => dispatch(made(all, each, seed), writeScript, { form, days });
const first = (l: Life<Working>): Script => l.slices.scripts.written[0] as Script;
const v = (l: Life<Working>) => componentValues(l.slices.attributes, 'screenwriter');
const held = (l: Life<Working>) => l.slices.attributes['screenwriter'] as Record<string, number>;
const values = (all: number, each: Record<string, number> = {}) => v(made(all, each));
const only = (reads: readonly Read[]): Read => {
  expect(reads).toHaveLength(1);
  return reads[0] as Read;
};
const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const facetMean = (s: Script) => mean(PARTS.map((p) => partScore(s, p)));

describe('a script', () => {
  it("is written facet by facet: each part a reader grades is a craft attribute, made of the facets its sources name", () => {
    expect(PARTS).toEqual(['characters', 'dialogue', 'structure', 'plot', 'theme', 'premise', 'setting', 'visual-storytelling', 'distinctive-voice', 'screenplay-format', 'film-production-process']);
    expect(facetsOf('dialogue').map((f) => f.id)).toEqual(['natural-and-believable', 'a-voice-for-each-character', 'reveals-character', 'moves-the-story', 'succinct', 'subtext', 'fits-tone-and-setting']);
    const s = first(written(60));
    for (const p of PARTS) expect(Object.keys(s.facets[p]), p).toEqual(facetsOf(p).map((f) => f.id));
    expect(partScore(s, 'dialogue')).toBeCloseTo(mean(Object.values(s.facets.dialogue)), 10);
    expect(MODEL_LINE).toBe('work.model');
  });

  it("scores a facet from the part's attribute, Writing, and the attributes a source ties to it", () => {
    const voice = facetsOf('dialogue').find((f) => f.id === 'a-voice-for-each-character');
    const natural = facetsOf('dialogue').find((f) => f.id === 'natural-and-believable');
    expect(voice?.draws).toContain('characters');
    expect(tiedTo('dialogue', voice!)).toEqual(['characters']); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(tiedTo('dialogue', natural!)).toEqual([]); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    const w = { ...values(50), dialogue: 90, writing: 10, characters: 30 };
    expect(skill(w, 'dialogue', voice!)).toBeCloseTo(0.6 * 90 + 0.25 * 10 + 0.15 * 30, 10); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(skill(w, 'dialogue', natural!)).toBeCloseTo(0.7 * 90 + 0.3 * 10, 10); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });

  it("ties no part's facet to its own part or to Writing, and names its tied attributes in order", () => {
    for (const p of PARTS) for (const f of facetsOf(p)) expect(f.draws.filter((id) => id === p || id === 'writing'), `${p} ${f.id}`).toEqual([]);
    const ids = PARTS.flatMap((p) => facetsOf(p).map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    const subtext = facetsOf('dialogue').find((f) => f.id === 'subtext');
    expect(new Set(tiedTo('dialogue', subtext!))).toEqual(new Set(['characters', 'theme', 'visual-storytelling'])); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    const authentic = facetsOf('setting').find((f) => f.id === 'authentically-brought-to-life');
    expect(new Set(tiedTo('setting', authentic!))).toEqual(new Set([...authentic!.draws, 'research'])); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(tiedTo('setting', authentic!)).toHaveLength(new Set([...authentic!.draws, 'research']).size); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });

  it("brings in Innovation and Research where their own facets name the part's matter", () => {
    expect(SOURCES_OF_MATTER).toEqual(['innovation', 'research']);
    for (const p of ['plot', 'characters'] as Part[]) for (const f of facetsOf(p)) expect(tiedTo(p, f), `${p} ${f.id}`).toContain('innovation');
    for (const f of facetsOf('setting')) expect(tiedTo('setting', f)).toContain('research');
    for (const f of facetsOf('dialogue')) expect(tiedTo('dialogue', f)).not.toContain('research');
    expect(partScore(first(written(50, 200, { innovation: 100 })), 'plot')).toBeGreaterThan(partScore(first(written(50, 200, { innovation: 0 })), 'plot'));
    expect(partScore(first(written(50, 200, { research: 100 })), 'setting')).toBeGreaterThan(partScore(first(written(50, 200, { research: 0 })), 'setting'));
  });

  it('is moved in each facet by every attribute that writes it', () => {
    for (const p of PARTS) for (const f of facetsOf(p)) for (const id of [p, 'writing', ...tiedTo(p, f)]) expect(skill(values(50, { [id]: 90 }), p, f), `${p} ${f.id} by ${id}`).toBeGreaterThan(skill(values(50, { [id]: 20 }), p, f));
  });

  it('comes out at the top from a writer at 100 throughout, around 50 from one at 50, hardly readable from one at 10', () => {
    const top = first(written(100));
    for (const p of PARTS) for (const x of Object.values(top.facets[p])) expect(x, p).toBeGreaterThanOrEqual(97);
    expect(top).toMatchObject({ id: 1, form: 'feature', started: 0, needed: 56, drafts: 1, reads: [] });
    const mid = first(written(50));
    for (const p of PARTS) for (const x of Object.values(mid.facets[p])) expect(Math.abs(x - 50), p).toBeLessThanOrEqual(spread(50));
    const low = first(written(10));
    for (const p of PARTS) for (const x of Object.values(low.facets[p])) expect(x, p).toBeLessThanOrEqual(10 + spread(10));
    expect(facetMean(top)).toBeGreaterThan(facetMean(mid));
    expect(facetMean(mid)).toBeGreaterThan(facetMean(low));
  });

  it('spreads less as the writer gets better', () => {
    expect(spread(100)).toBe(3);
    expect(spread(0)).toBe(18);
    expect(spread(50)).toBe(10.5);
  });

  it("needs the trade's time: a feature in eight weeks at the top, an episode within the MBA's 2.4 weeks", () => {
    expect(DAYS).toEqual({ feature: 56, pilot: 12.6, episode: 8.4, short: 10 });
    expect(daysNeeded(values(100), 'feature')).toBe(56);
    expect(daysNeeded(values(0), 'feature')).toBe(112);
    expect(daysNeeded(values(0), 'episode')).toBe(17);
    expect(daysNeeded(values(100), 'episode')).toBe(9);
    const pace = (w: Record<string, number>) => 0.6 * skillOf(w, 'screenwriter', 'writing') + 0.4 * skillOf(w, 'screenwriter', 'time-management');
    for (const w of [values(0, { writing: 100 }), values(0, { 'time-management': 100 }), values(37)]) for (const form of ['feature', 'pilot', 'episode', 'short'] as const) expect(daysNeeded(w, form)).toBe(Math.ceil(DAYS[form] / (0.5 + (0.5 * pace(w)) / 100)));
    expect(daysNeeded(values(0, { writing: 100 }), 'short')).toBeGreaterThan(daysNeeded(values(100), 'short'));
    expect(finish(values(0), 60, 60)).toBe(1);
    expect(finish(values(0), 90, 60)).toBe(1);
    expect(finish(values(0), 30, 60)).toBeCloseTo(0.7, 10);
    expect(finish(values(100), 30, 60)).toBeCloseTo(0.85, 10);
    expect(partScore(first(written(100, 20)), 'dialogue')).toBeLessThan(partScore(first(written(100, 56)), 'dialogue'));
  });

  it('scores each facet exactly: the level, shortened by rushing, within the spread', () => {
    const w = values(50, { dialogue: 80 });
    const s = first(written(50, 30, { dialogue: 80 }));
    const needed = daysNeeded(w, 'feature');
    const f = finish(w, 30, needed);
    for (const p of PARTS) for (const facet of facetsOf(p)) expect(s.facets[p][facet.id], `${p} ${facet.id}`).toBeCloseTo(clamp(skill(w, p, facet) * f + spread(skill(w, p, facet)) * u('work.draft', 1, 1, p, facet.id)), 10);
  });

  it('teaches the attributes its writing used, a day at a time, at the pace of two decades to professional', () => {
    expect((1 - DAILY) ** (20 * 365)).toBeCloseTo(20 / 90, 10);
    const after = held(written(50, 56));
    // Drafting uses every part (Film Production Process among them, which the owner's map puts in Pitching), Writing and Discipline; not Revision.
    for (const id of ['story', 'characters', 'voice', 'writing', 'discipline', 'pitching']) expect(after[id], id).toBeCloseTo(100 - 50 * (1 - DAILY) ** 56, 10);
    expect(after['revision']).toBe(50);
    expect(Object.values(held(written(100))).every((x) => x === 100)).toBe(true);
  });

  it('is refused in a form there is not, for days that are not whole, or before the attributes are chosen', () => {
    expect(() => dispatch(made(50), writeScript, { form: 'novel' as 'feature', days: 10 })).toThrow("there's no form novel");
    expect(() => dispatch(made(50), writeScript, { form: 'short', days: 0 })).toThrow(RangeError);
    expect(() => dispatch(made(50), writeScript, { form: 'short', days: 1.5 })).toThrow('the days given are a whole number of at least 1 (1.5)');
    expect(first(dispatch(made(50), writeScript, { form: 'short', days: 1 })).needed).toBe(daysNeeded(values(50), 'short'));
    const bare = begin(SEED, 0, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START) });
    expect(() => dispatch(bare, writeScript, { form: 'short', days: 5 })).toThrow("the screenwriter's attributes haven't been chosen");
    expect(() => scriptOf(SCRIPTS_START, 1)).toThrow("there's no script 1");
  });

  it('is the same for the same life and differs for another', () => {
    expect(first(written(50)).facets).toEqual(first(written(50)).facets);
    expect(first(written(50, 200, {}, 'fedcba9876543210')).facets).not.toEqual(first(written(50)).facets);
  });

  it('script.write: a better writer writes better dialogue', () => {
    falsifyAny({ feature: 'script.write', claim: 'bites', says: 'a writer at 90 in dialogue writes better dialogue than one at 30', base: 30, twin: 90, outcome: (n) => partScore(first(written(50, 200, { dialogue: n })), 'dialogue') });
  });
});

describe('a reader', () => {
  it("grades by its own criteria, each on the facets those criteria name", () => {
    expect(Object.keys(CRITERIA['black-list'])).toEqual(['premise', 'plot', 'characters', 'dialogue', 'setting']);
    expect(Object.keys(CRITERIA.page)).toEqual(['premise/concept', 'presentation', 'structure', 'plot', 'pacing', 'characters', 'dialogue', 'theme', 'style/tone', 'marketing potential']);
    const read = new Set(Object.values(CRITERIA).flatMap((m) => Object.values(m).flat()));
    expect([...read].sort()).toEqual([...PARTS].sort());
    expect(graded('black-list', 'dialogue').map((f) => f.id)).toEqual(facetsOf('dialogue').map((f) => f.id));
    expect(graded('page', 'dialogue').map((f) => f.id)).toEqual(['natural-and-believable', 'a-voice-for-each-character', 'reveals-character', 'moves-the-story', 'succinct']);
    expect(graded('page', 'film-production-process').map((f) => f.id)).toEqual(facetsOf('film-production-process').map((f) => f.id));
  });

  it("weighs the Black List's components as its regression found, the overall placed between the weakest and strongest", () => {
    expect(BLACK_LIST_WEIGHTS).toEqual({ plot: 0.318, characters: 0.234, dialogue: 0.219, premise: 0.13, setting: 0.102 });
    expect(BLACK_LIST_POSITION).toBe(0.38);
    expect(TASTE).toEqual({ lenience: 0.75, criterion: 0.6, residual: 0.4 });
    const at = (parts: Partial<Record<Part, number>>): Script => ({ id: 9, form: 'feature', started: 0, needed: 56, drafts: 1, reads: [], facets: Object.fromEntries(PARTS.map((p) => [p, Object.fromEntries(facetsOf(p).map((f) => [f.id, parts[p] ?? 100]))])) as Record<Part, Record<string, number>> });
    expect(scoresOf('black-list', at({}), ctx).overall).toBeGreaterThanOrEqual(9);
    const weakPlot = scoresOf('black-list', at({ plot: 30 }), ctx);
    const weakSetting = scoresOf('black-list', at({ setting: 30 }), ctx);
    expect(weakSetting.overall).toBeGreaterThan(weakPlot.overall);
    expect(scoresOf('page', at({ 'screenplay-format': 0 }), ctx).scores['presentation']).toBeLessThanOrEqual(3);
  });

  it("scores as the Black List's own readers do: a writer at 53 averages about its 5.74, an 8 is rare below the top", () => {
    const reads = (lvl: number, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const l = dispatch(dispatch(written(lvl, 200, {}, (i + 1).toString(16).padStart(16, '0')), readScript, { script: 1, reader: 'black-list' }), readScript, { script: 1, reader: 'black-list' });
        const r = first(l).reads;
        return [r[0]?.overall ?? 0, r[1]?.overall ?? 0] as const;
      });
    const mid = reads(53, 200);
    expect(mean(mid.map((r) => r[0]))).toBeGreaterThan(5.2);
    expect(mean(mid.map((r) => r[0]))).toBeLessThan(6.2);
    expect(mid.filter((r) => r[0] >= 8).length / 200).toBeLessThan(0.05);
    const gap = (k: number) => mid.filter((r) => Math.abs(r[0] - r[1]) === k).length / 200;
    expect(gap(0)).toBeGreaterThan(0.22);
    expect(gap(0)).toBeLessThan(0.38);
    expect(gap(0) + gap(1)).toBeGreaterThan(0.64);
    expect(gap(0) + gap(1)).toBeLessThan(0.84);
    expect(mean(reads(100, 40).map((r) => r[0]))).toBeGreaterThan(8.8);
    expect(mean(reads(10, 40).map((r) => r[0]))).toBeLessThan(3);
  });

  it('notes only facets of the parts it grades, though another part be weaker', () => {
    const s = first(dispatch(written(60, 200, { theme: 0, structure: 0 }), readScript, { script: 1, reader: 'black-list' }));
    for (const n of only(s.reads).notes) expect(['premise', 'plot', 'characters', 'dialogue', 'setting']).toContain(n.part);
  });

  it('notes the three weakest facets it grades, weakest first', () => {
    const s = first(dispatch(written(50, 200, { dialogue: 0, plot: 5 }), readScript, { script: 1, reader: 'black-list' }));
    const notes = only(s.reads).notes;
    const all = (['premise', 'plot', 'characters', 'dialogue', 'setting'] as Part[]).flatMap((part) => graded('black-list', part).map((f) => ({ part, facet: f.id })));
    const score = (n: { part: Part; facet: string }) => s.facets[n.part][n.facet] as number;
    expect(notes).toEqual([...all].sort((x, y) => score(x) - score(y)).slice(0, 3));
    expect(notes.every((n) => n.part === 'dialogue' || n.part === 'plot')).toBe(true);
  });

  it('combines exactly: the score, the read\'s lenience, each criterion\'s taste, the weights, the place between weakest and strongest, the residual', () => {
    for (let i = 1; i <= 12; i += 1) {
    const seed = i.toString(16).padStart(16, '0');
    const ws = first(written(45 + i * 3, 200, {}, seed));
    const d = (...k: (string | number)[]) => draws(seedFromText(seed), 'work.read', ...k);
    const ctxi = { draws: (decider: 'work.read', ...keys: (string | number)[]) => draws(seedFromText(seed), decider, ...keys) };
    for (const reader of ['black-list', 'page'] as const) {
      const key = [reader, 1, 1, 0] as const;
      const lenience = 0.75 * normal(d(...key, 'lenience'));
      const exact: Record<string, number> = {};
      for (const [name, parts] of Object.entries(CRITERIA[reader])) {
        const n = mean(parts.map((p) => mean(graded(reader, p).map((f) => ws.facets[p][f.id] as number))));
        exact[name] = Math.min(10, Math.max(1, 1 + (9 * n) / 100 + lenience + 0.6 * normal(d(...key, name))));
      }
      const residual = 0.4 * normal(d(...key, 'overall'));
      const vals = Object.values(exact);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const weighed = Object.entries(BLACK_LIST_WEIGHTS).reduce((t, [k, w]) => t + w * (exact[k] ?? 0), 0);
      const expected = reader === 'black-list' ? (weighed + lo + 0.38 * (hi - lo)) / 2 + residual : mean(vals) + residual;
      const got = scoresOf(reader, ws, ctxi);
      expect(got.scores, reader).toEqual(Object.fromEntries(Object.entries(exact).map(([k, x]) => [k, Math.round(x)])));
      expect(got.overall, reader).toBe(Math.min(10, Math.max(1, Math.round(expected))));
    }
    }
  });

  it('gives each read its own taste, the same read again the same', () => {
    const l = dispatch(dispatch(written(55), readScript, { script: 1, reader: 'page' }), readScript, { script: 1, reader: 'page' });
    expect(first(l).reads.map((r) => r.scores)).not.toEqual([first(l).reads[0]?.scores, first(l).reads[0]?.scores]);
    expect(first(dispatch(written(55), readScript, { script: 1, reader: 'page' })).reads).toEqual(first(dispatch(written(55), readScript, { script: 1, reader: 'page' })).reads);
  });

  it('is refused for a reader there is not', () => {
    expect(() => dispatch(written(50), readScript, { script: 1, reader: 'nobody' as 'page' })).toThrow("there's no reader nobody");
  });

  it('script.read: a better draft is graded higher', () => {
    falsifyAny({ feature: 'script.read', claim: 'bites', says: 'a writer at 90 is graded above one at 30', base: 30, twin: 90, outcome: (n) => first(dispatch(written(n), readScript, { script: 1, reader: 'black-list' })).reads[0]?.overall });
  });
});

describe('a revision', () => {
  const rushed = (each: Record<string, number> = {}) => dispatch(written(80, 10, each), readScript, { script: 1, reader: 'black-list' });

  it("does what the MBA says each kind is, in its share of a draft's time", () => {
    expect(REVISIONS.rewrite.share).toBeCloseTo(6.14 / 9.22, 10);
    expect(REVISIONS.polish.share).toBeCloseTo(3.07 / 9.22, 10);
    expect(REVISIONS.rewrite.parts).toEqual(PARTS);
    expect(REVISIONS.polish.parts).toEqual(['dialogue', 'visual-storytelling', 'screenplay-format']);
    const before = first(rushed());
    const polished = first(dispatch(rushed(), reviseScript, { script: 1, kind: 'polish', days: 30 }));
    for (const p of PARTS) if (!REVISIONS.polish.parts.includes(p)) expect(polished.facets[p], p).toEqual(before.facets[p]);
    expect(partScore(polished, 'dialogue')).toBeGreaterThan(partScore(before, 'dialogue'));
    expect(() => dispatch(rushed(), reviseScript, { script: 1, kind: 'redo' as 'rewrite', days: 3 })).toThrow("there's no revision redo");
    expect(() => dispatch(rushed(), reviseScript, { script: 1, kind: 'rewrite', days: 0 })).toThrow('the days given are a whole number of at least 1 (0)');
  });

  it("moves each facet toward the writer, by the days, Revision, and the share of the work Taking Notes keeps on the notes", () => {
    const base = rushed({ revision: 40, 'taking-notes': 60 });
    const before = first(base);
    const vb = v(base);
    const after = dispatch(base, reviseScript, { script: 1, kind: 'rewrite', days: 10 });
    const notes = only(before.reads).notes;
    const kept = 0.5 + (0.5 * skillOf(vb, 'screenwriter', 'taking-notes')) / 100;
    const reach = Math.min(1, 10 / (REVISIONS.rewrite.share * before.needed)) * (0.3 + (0.5 * skillOf(vb, 'screenwriter', 'revision')) / 100);
    const total = PARTS.reduce((t, p) => t + facetsOf(p).length, 0);
    for (const p of PARTS) {
      for (const f of facetsOf(p)) {
        const noted = notes.some((n) => n.part === p && n.facet === f.id);
        const share = (noted ? kept / notes.length : 0) + (1 - kept) / total;
        const target = Math.min(100, skill(vb, p, f) + 5);
        const was = before.facets[p][f.id] as number;
        expect(first(after).facets[p][f.id], `${p} ${f.id}`).toBeCloseTo(was + (target - was) * Math.min(1, reach * share * 3), 10);
      }
    }
    expect(first(after).drafts).toBe(2);
    const grown = held(after);
    const hb = held(base);
    const raised = new Set(['revision', 'writing', ...notes.map((n) => broadOf('screenwriter', n.part).id)]);
    for (const id of Object.keys(hb)) expect(grown[id], id).toBeCloseTo(raised.has(id) ? 100 - (100 - (hb[id] as number)) * (1 - DAILY) ** 10 : (hb[id] as number), 10);
    expect(raised.has('discipline')).toBe(false);
  });

  it('polishes only what a polish may change, its notes on other parts set aside', () => {
    const base = dispatch(written(80, 10, { plot: 0, dialogue: 10 }), readScript, { script: 1, reader: 'page' });
    const before = first(base);
    const vb = v(base);
    const after = first(dispatch(base, reviseScript, { script: 1, kind: 'polish', days: 10 }));
    const notes = only(before.reads).notes.filter((n) => REVISIONS.polish.parts.includes(n.part));
    const kept = 0.5 + (0.5 * skillOf(vb, 'screenwriter', 'taking-notes')) / 100;
    const reach = Math.min(1, 10 / (REVISIONS.polish.share * before.needed)) * (0.3 + (0.5 * skillOf(vb, 'screenwriter', 'revision')) / 100);
    const open = REVISIONS.polish.parts.flatMap((part) => facetsOf(part).map((f) => ({ part, facet: f })));
    for (const { part, facet } of open) {
      const noted = notes.some((n) => n.part === part && n.facet === facet.id);
      const share = (noted ? kept / notes.length : 0) + (1 - kept) / open.length;
      const was = before.facets[part][facet.id] as number;
      expect(after.facets[part][facet.id], `${part} ${facet.id}`).toBeCloseTo(was + (Math.min(100, skill(vb, part, facet) + 5) - was) * Math.min(1, reach * share * 3), 10);
    }
    expect(only(before.reads).notes.some((n) => !REVISIONS.polish.parts.includes(n.part))).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('keeps more of the work on the noted facets with better Taking Notes, and carries further with better Revision', () => {
    const gain = (each: Record<string, number>) => {
      const b = rushed(each);
      const a = first(dispatch(b, reviseScript, { script: 1, kind: 'rewrite', days: 20 }));
      return only(first(b).reads).notes.reduce((t, n) => t + (a.facets[n.part][n.facet] as number) - (first(b).facets[n.part][n.facet] as number), 0);
    };
    expect(gain({ 'taking-notes': 100 })).toBeGreaterThan(gain({ 'taking-notes': 0 }));
    expect(gain({ revision: 100 })).toBeGreaterThan(gain({ revision: 0 }));
  });

  it("works where no reader has noted on what the writer's own read thinks weakest, read truer with a better eye", () => {
    const s = first(written(60));
    const sharp = ownRead(values(100), s, ctx);
    for (const p of PARTS) for (const f of facetsOf(p)) expect(sharp[p][f.id]).toBeCloseTo(s.facets[p][f.id] as number, 10);
    const w = values(60, { 'story-critique': 30, 'critical-thinking': 80 });
    const r = ownRead(w, s, ctx);
    const eye = 0.7 * skillOf(w, 'screenwriter', 'story-critique') + 0.3 * skillOf(w, 'screenwriter', 'critical-thinking');
    for (const p of PARTS) for (const f of facetsOf(p)) expect(r[p][f.id]).toBeCloseTo((s.facets[p][f.id] as number) + 20 * (1 - eye / 100) * u('work.read', 'own', 1, 1, p, f.id), 10);
    const base = written(60, 10);
    const after = dispatch(base, reviseScript, { script: 1, kind: 'rewrite', days: 20 });
    expect(first(after).drafts).toBe(2);
    expect(held(after)['revision']).toBeGreaterThan(held(base)['revision'] as number);
    expect(held(after)['discipline']).toBe(held(base)['discipline']);
  });

  it("revises without notes exactly on the three facets the writer's own read finds weakest", () => {
    const base = written(60, 10);
    const s = first(base);
    const vb = v(base);
    const r = ownRead(vb, s, ctx);
    const open = PARTS.flatMap((part) => facetsOf(part).map((f) => ({ part, facet: f })));
    const focus = [...open].sort((x, y) => (r[x.part][x.facet.id] as number) - (r[y.part][y.facet.id] as number)).slice(0, 3);
    const after = first(dispatch(base, reviseScript, { script: 1, kind: 'rewrite', days: 20 }));
    const kept = 0.5 + (0.5 * skillOf(vb, 'screenwriter', 'taking-notes')) / 100;
    const reach = Math.min(1, 20 / (REVISIONS.rewrite.share * s.needed)) * (0.3 + (0.5 * skillOf(vb, 'screenwriter', 'revision')) / 100);
    for (const { part, facet } of open) {
      const share = (focus.some((x) => x.part === part && x.facet.id === facet.id) ? kept / 3 : 0) + (1 - kept) / open.length;
      const was = s.facets[part][facet.id] as number;
      expect(after.facets[part][facet.id], `${part} ${facet.id}`).toBeCloseTo(was + (Math.min(100, skill(vb, part, facet) + 5) - was) * Math.min(1, reach * share * 3), 10);
    }
  });

  it('script.revise: more days carry a revision further', () => {
    falsifyAny({ feature: 'script.revise', claim: 'bites', says: 'a longer rewrite lifts the draft further', base: 2, twin: 30, outcome: (d) => facetMean(first(dispatch(rushed(), reviseScript, { script: 1, kind: 'rewrite', days: d }))) });
  });

  it('finds the script asked for among several', () => {
    const two = dispatch(dispatch(written(50, 60), writeScript, { form: 'short', days: 5 }), readScript, { script: 2, reader: 'page' });
    expect(two.slices.scripts.written.map((x) => [x.id, x.form, x.reads.length])).toEqual([
      [1, 'feature', 0],
      [2, 'short', 1],
    ]);
    expect(scriptOf(two.slices.scripts, 2).form).toBe('short');
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('script.') && ['script.write', 'script.revise', 'script.read'].includes(x.id))).toEqual([
      { id: 'script.write', reads: [], writes: ['attributes', 'scripts'] },
      { id: 'script.revise', reads: [], writes: ['attributes', 'scripts'] },
      { id: 'script.read', reads: [], writes: ['scripts'] },
    ]);
    expect(commandIndex().find((x) => x.id === 'attributes.choose')).toEqual({ id: 'attributes.choose', reads: [], writes: ['attributes'] });
  });
});
