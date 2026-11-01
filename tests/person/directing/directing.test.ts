import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { ATTRIBUTES, ATTRIBUTES_START, chooseAttributes, componentValues, DAILY, skillOf, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  cutFilm,
  cutNeeded,
  DIRECTING_START,
  EPISODES,
  FEATURE,
  FEATURE_SHOOT,
  FESTIVALS,
  filmOf,
  KIN,
  kinship,
  finish,
  LEVELS,
  levelOf,
  onSet,
  PARTS,
  partSkill,
  pitchSkill,
  PLANNED,
  POOL,
  prepFilm,
  pursueSecond,
  SECOND,
  secondChance,
  selectionChance,
  shootFilm,
  shootNeeded,
  STEEP,
  submitFilm,
  type DirectingSlice,
  type Festival,
  type Film,
  type Part,
  type PrepArgs,
  MODEL_LINE,
} from '../../../src/person/directing/directing.ts';
import { spread } from '../../../src/person/work/work.ts';
import { t } from '../../../src/core/text/text.ts';
import { FAMILY, type Family, type IdentitySlice } from '../../../src/person/identity/identity.ts';
import { ACTING_START, type ActingSlice } from '../../../src/person/acting/acting.ts';
import { PRODUCING_START, type ProducingSlice } from '../../../src/person/producing/producing.ts';
import type { PermitsSlice } from '../../../src/person/permits/permits.ts';
import { permitsEverywhere } from '../../support/permits.ts';
import { identity } from '../../support/person.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

type D = { attributes: AttributesSlice; directing: DirectingSlice; identity: IdentitySlice; acting: ActingSlice; producing: ProducingSlice; permits: PermitsSlice };
const SEED = '0123456789abcdef';
const seedOf = (i: number) => i.toString(16).padStart(16, '0');
const u = (seed: string, ...keys: (string | number)[]) => draws(seedFromText(seed), 'directing.work', ...keys).float();
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const grown = (from: number, days: number) => 100 - (100 - from) * (1 - DAILY) ** days;
const BROAD = ['vision', 'working-with-actors', 'visual-craft', 'editing', 'script-sense', 'leadership', 'communication'];
const covers = (broad: string) => (ATTRIBUTES.director.find((a) => a.id === broad)?.covers ?? []).map((c) => c.id);
const of = (v: Record<string, number>, id: string) => skillOf(v, 'director', id);

const STUDIO: PrepArgs = { form: 'feature', budget: 20_000_000, shoot: 40 };
const made = (all: number, each: Record<string, number> = {}, seed = SEED): Life<D> =>
  dispatch(begin(seed, 0, { attributes: structuredClone(ATTRIBUTES_START), directing: structuredClone(DIRECTING_START), identity: identity(), acting: structuredClone(ACTING_START), producing: structuredClone(PRODUCING_START), permits: permitsEverywhere() }), chooseAttributes, { role: 'director', all, each });
const prepped = (all: number, args: PrepArgs = STUDIO, each: Record<string, number> = {}, seed = SEED) => dispatch(made(all, each, seed), prepFilm, args);
const shot = (all: number, args: PrepArgs = STUDIO, each: Record<string, number> = {}, seed = SEED) => dispatch(prepped(all, args, each, seed), shootFilm, { film: 1 });
const cutOf = (all: number, args: PrepArgs = STUDIO, each: Record<string, number> = {}, seed = SEED) => dispatch(shot(all, args, each, seed), cutFilm, { film: 1 });
const film = (l: Life<D>, id = 1): Film => filmOf(l.slices.directing, id);
const v = (l: Life<D>) => componentValues(l.slices.attributes, 'director');
const held = (l: Life<D>) => l.slices.attributes['director'] as Record<string, number>;
const values = (all: number, each: Record<string, number> = {}) => v(made(all, each));
const withDirecting = (l: Life<D>, d: Partial<DirectingSlice>): Life<D> => ({ ...l, slices: { ...l.slices, directing: { ...l.slices.directing, ...d } } });
const withFamily = (l: Life<D>, family: Family): Life<D> => ({ ...l, slices: { ...l.slices, identity: identity({ family }) } });

describe("a film's parts", () => {
  it('come from the broad attributes the owner names: the story from Vision and Script Sense, performances, images, the cut', () => {
    expect(PARTS).toEqual({ story: ['vision', 'script-sense'], performances: ['working-with-actors'], images: ['visual-craft'], cut: ['editing'] });
    expect(PLANNED).toEqual(['story', 'performances', 'images']);
    expect(ATTRIBUTES.director.map((a) => a.id)).toEqual(BROAD);
    const w = values(40, { vision: 90, 'script-sense': 10, editing: 70 });
    expect(partSkill(w, 'story')).toBeCloseTo(mean([...covers('vision'), ...covers('script-sense')].map((id) => of(w, id))), 10);
    expect(partSkill(w, 'cut')).toBeCloseTo(mean(covers('editing').map((id) => of(w, id))), 10);
    expect(partSkill(w, 'cut')).toBeGreaterThan(65);
  });

  it('are moved by every broad attribute of the part, and by none of the others but through a facet a source ties', () => {
    for (const p of Object.keys(PARTS) as Part[]) {
      for (const id of PARTS[p]) expect(partSkill(values(50, { [id]: 90 }), p), `${p} by ${id}`).toBeGreaterThan(partSkill(values(50, { [id]: 20 }), p));
    }
    expect(partSkill(values(50, { leadership: 90 }), 'cut')).toBe(partSkill(values(50, { leadership: 20 }), 'cut'));
  });

  it('spread less as the director gets better', () => {
    expect(spread(100)).toBe(3);
    expect(spread(0)).toBe(18);
    expect(spread(50)).toBe(10.5);
  });
});

describe('the DGA terms', () => {
  it("are the 2026-27 rate card's, the Basic Agreement's and the Low Budget Sideletter's", () => {
    expect(EPISODES).toEqual({ hour: { rate: 58808, prep: 7, shoot: 8, cut: 4 }, 'half-hour': { rate: 34629, prep: 3, shoot: 4, cut: 2 } });
    expect(FEATURE).toEqual({ prep: 14, weeks: 13 });
    expect(FEATURE_SHOOT).toBe(32);
    expect(LEVELS.map((l) => [l.upTo, l.weekly])).toEqual([
      [3_000_000, null],
      [4_000_000, 8321],
      [8_500_000, 18911],
      [11_000_000, 22693],
      [Infinity, 25214],
    ]);
  });

  it('set a feature by its budget: pay, prep and the Director\'s Cut at every level\'s edge', () => {
    const at = (budget: number, shoot: number) => film(prepped(60, { form: 'feature', budget, shoot }));
    const usd = (weekly: number) => ({ currency: 'USD', minor: weekly * 13 * 100 });
    expect(at(1, 10)).toMatchObject({ budget: 1, prepDays: 14, shootDays: 10, cutDays: 20, fee: null });
    expect(at(3_000_000, 30)).toMatchObject({ cutDays: 30, fee: null });
    expect(at(3_000_000, 20).cutDays).toBe(20);
    expect(at(3_000_001, 30)).toMatchObject({ cutDays: 56, fee: usd(8321) });
    expect(at(4_000_000, 90)).toMatchObject({ cutDays: 56, fee: usd(8321) });
    expect(at(4_000_001, 30)).toMatchObject({ cutDays: 70, fee: usd(18911) });
    expect(at(8_500_000, 160)).toMatchObject({ cutDays: 70, fee: usd(18911) });
    expect(at(8_500_001, 30)).toMatchObject({ cutDays: 70, fee: usd(22693) });
    expect(at(11_000_000, 160)).toMatchObject({ cutDays: 70, fee: usd(22693) });
    expect(at(11_000_001, 140)).toMatchObject({ cutDays: 70, fee: usd(25214) });
    expect(at(11_000_001, 150).cutDays).toBe(75);
    expect(at(11_000_001, 151).cutDays).toBe(75.5);
    expect(usd(25214).minor).toBe(32778200);
    expect(levelOf(11_000_000).weekly).toBe(22693);
  });

  it("set an episode by the show: the network program rate, the guaranteed prep and shoot, the episode's cut", () => {
    expect(film(prepped(60, { form: 'hour' }))).toMatchObject({ form: 'hour', budget: null, prepDays: 7, shootDays: 8, cutDays: 4, fee: { currency: 'USD', minor: 5880800 } });
    expect(film(prepped(60, { form: 'half-hour' }))).toMatchObject({ form: 'half-hour', budget: null, prepDays: 3, shootDays: 4, cutDays: 2, fee: { currency: 'USD', minor: 3462900 } });
  });
});

describe('prep', () => {
  it('plans each part at what the director can do in it, within the spread', () => {
    for (let i = 1; i <= 12; i += 1) {
      const lvl = [0, 100, 30, 70][i % 4] as number;
      const seed = seedOf(i);
      const l = prepped(lvl, STUDIO, { vision: Math.min(100, lvl + 5) }, seed);
      const w = values(lvl, { vision: Math.min(100, lvl + 5) });
      for (const p of PLANNED) {
        const k = partSkill(w, p);
        expect(film(l).plan[p], `${seed} ${p}`).toBeCloseTo(clamp(k + spread(k) * (2 * u(seed, 'plan', 1, p) - 1)), 10);
      }
    }
    expect(film(prepped(100)).plan).toEqual(film(prepped(100)).plan);
    for (const x of Object.values(film(prepped(100)).plan)) expect(x).toBeGreaterThanOrEqual(97);
  });

  it('holds a plan to 0 and 100', () => {
    const tops = Array.from({ length: 12 }, (_, i) => film(prepped(100, STUDIO, {}, seedOf(i + 1))).plan);
    expect(tops.flatMap((p) => Object.values(p)).some((x) => x === 100)).toBe(true);
    const bottoms = Array.from({ length: 12 }, (_, i) => film(prepped(0, STUDIO, {}, seedOf(i + 1))).plan);
    expect(bottoms.flatMap((p) => Object.values(p)).some((x) => x === 0)).toBe(true);
  });

  it('records the film and teaches what prep used, over its days', () => {
    const l = prepped(50, { form: 'hour' });
    expect(film(l)).toMatchObject({ id: 1, started: 0, needed: null, shot: null, cut: null, quality: null, festivals: {} });
    for (const id of ['vision', 'script-sense', 'working-with-actors', 'visual-craft']) expect(held(l)[id], id).toBeCloseTo(grown(50, 7), 10);
    for (const id of ['editing', 'leadership', 'communication']) expect(held(l)[id], id).toBe(50);
    expect(film(dispatch(l, prepFilm, { form: 'half-hour' }), 2).id).toBe(2);
  });

  it('is refused in a form there is not, for a budget or a schedule not whole, an episode given either, or before the attributes are chosen', () => {
    expect(() => prepped(50, { form: 'novel' as 'hour' })).toThrow("there's no form novel");
    expect(() => prepped(50, { form: 'feature', shoot: 30 })).toThrow('a budget is a whole number of at least 1 (undefined)');
    expect(() => prepped(50, { form: 'feature', budget: 0, shoot: 30 })).toThrow(RangeError);
    expect(() => prepped(50, { form: 'feature', budget: 1.5, shoot: 30 })).toThrow('a budget is a whole number of at least 1 (1.5)');
    expect(() => prepped(50, { form: 'feature', budget: 1, shoot: 0 })).toThrow('the shooting days is a whole number of at least 1 (0)');
    expect(() => prepped(50, { form: 'feature', budget: 1 })).toThrow(RangeError);
    expect(() => prepped(50, { form: 'hour', budget: 5 })).toThrow("an episode's budget and schedule are the show's");
    expect(() => prepped(50, { form: 'hour', shoot: 5 })).toThrow("an episode's budget and schedule are the show's");
    const bare = begin(SEED, 0, { attributes: structuredClone(ATTRIBUTES_START), directing: structuredClone(DIRECTING_START), identity: identity(), acting: structuredClone(ACTING_START), producing: structuredClone(PRODUCING_START), permits: permitsEverywhere() });
    expect(() => dispatch(bare, prepFilm, { form: 'hour' })).toThrow("the director's attributes haven't been chosen");
    expect(() => filmOf(DIRECTING_START, 1)).toThrow("there's no film 1");
  });

  it('takes a second feature only once the debut has led to one, and any after that', () => {
    const debut = prepped(60);
    expect(() => dispatch(debut, prepFilm, STUDIO)).toThrow('a second feature needs the debut to lead to one');
    expect(() => dispatch(withDirecting(debut, { second: false }), prepFilm, STUDIO)).toThrow('a second feature needs the debut to lead to one');
    const two = dispatch(withDirecting(debut, { second: true }), prepFilm, STUDIO);
    expect(film(two, 2).form).toBe('feature');
    expect(film(dispatch(withDirecting(two, { second: false }), prepFilm, STUDIO), 3).id).toBe(3);
    expect(film(dispatch(debut, prepFilm, { form: 'hour' }), 2).form).toBe('hour');
    expect(film(dispatch(prepped(60, { form: 'hour' }), prepFilm, STUDIO), 2).form).toBe('feature');
  });

  it('directing.prep: a director with more Vision plans a better story', () => {
    falsifyAny({ feature: 'directing.prep', claim: 'bites', says: 'a director at 90 in Vision plans a better story than one at 20', base: 20, twin: 90, outcome: (n) => film(prepped(50, STUDIO, { vision: n })).plan.story });
  });
});

describe('the shoot', () => {
  it("needs the trade's schedule from a director at 50 in holding it, a quarter less at 100, a quarter more at 0", () => {
    expect(shootNeeded(values(50), { form: 'feature' })).toBeCloseTo(32, 10);
    expect(shootNeeded(values(100), { form: 'feature' })).toBeCloseTo(24, 10);
    expect(shootNeeded(values(0), { form: 'feature' })).toBeCloseTo(40, 10);
    expect(shootNeeded(values(50), { form: 'hour' })).toBeCloseTo(8, 10);
    expect(shootNeeded(values(50), { form: 'half-hour' })).toBeCloseTo(4, 10);
    const w = values(30, { leadership: 80, 'visual-craft': 10 });
    expect(shootNeeded(w, { form: 'feature' })).toBeCloseTo(32 * (1.25 - (0.5 * (0.6 * of(w, 'time-management') + 0.4 * of(w, 'plan-each-shot-framing-composition-camera-movement-sound-act'))) / 100), 10);
    expect(shootNeeded(values(50, { 'visual-craft': 100 }), { form: 'hour' })).toBeLessThan(shootNeeded(values(50), { form: 'hour' }));
  });

  it('is carried by the set: 0.8 of the plan from a director at 0 in leading and talking to it, all of it at 100', () => {
    expect(onSet(values(0))).toBeCloseTo(0.8, 10);
    expect(onSet(values(100))).toBeCloseTo(1, 10);
    const w = values(50, { communication: 90 });
    expect(onSet(w)).toBeCloseTo(0.8 + (0.2 * mean(['lead-cast-and-crew', 'coordination', 'speech-clarity', 'active-listening'].map((id) => of(w, id)))) / 100, 10);
    expect(onSet(values(50, { leadership: 90 }))).toBeGreaterThan(onSet(values(50)));
  });

  it('loses what a short schedule leaves undone, Adaptability carrying more of it', () => {
    expect(finish(values(0), 60, 60)).toBe(1);
    expect(finish(values(0), 90, 60)).toBe(1);
    expect(finish(values(0), 30, 60)).toBeCloseTo(0.7, 10);
    expect(finish(values(100), 30, 60)).toBeCloseTo(0.85, 10);
  });

  it('brings each planned part to the screen exactly as far as the schedule and the set carry it', () => {
    for (const [lvl, days] of [
      [40, 20],
      [40, 60],
      [90, 25],
      [0, 1],
    ] as const) {
      const before = prepped(lvl, { form: 'feature', budget: 20_000_000, shoot: days }, { leadership: lvl + 10 });
      const w = v(before);
      const after = film(dispatch(before, shootFilm, { film: 1 }));
      const needed = shootNeeded(w, after);
      expect(after.needed).toBeCloseTo(needed, 10);
      for (const p of PLANNED) expect(after.shot?.[p], `${lvl} ${days} ${p}`).toBeCloseTo(film(before).plan[p] * finish(w, days, needed) * onSet(w), 10);
    }
    const top = film(shot(100, { form: 'feature', budget: 20_000_000, shoot: 24 }));
    expect(top.shot).toEqual(top.plan);
  });

  it('teaches Working With Actors, Visual Craft, Leadership and Communication over its days', () => {
    const before = prepped(50, { form: 'hour' });
    const after = dispatch(before, shootFilm, { film: 1 });
    for (const id of ['working-with-actors', 'visual-craft', 'leadership', 'communication']) expect(held(after)[id], id).toBeCloseTo(grown(held(before)[id] as number, 8), 10);
    for (const id of ['vision', 'script-sense', 'editing']) expect(held(after)[id], id).toBe(held(before)[id]);
  });

  it('is refused for a film shot already', () => {
    expect(() => dispatch(shot(50), shootFilm, { film: 1 })).toThrow('film 1 is shot');
    expect(() => dispatch(made(50), shootFilm, { film: 1 })).toThrow("there's no film 1");
  });

  it('directing.shoot: more days on the schedule bring more to the screen', () => {
    falsifyAny({ feature: 'directing.shoot', claim: 'bites', says: 'a feature shot in 40 days holds more of its plan than one shot in 15', base: 15, twin: 40, outcome: (n) => film(shot(50, { form: 'feature', budget: 20_000_000, shoot: n })).shot?.performances });
  });
});

describe('the cut', () => {
  it('needs a day for each shooting day from a director at 0 in Editing, a day for every two at 100', () => {
    expect(cutNeeded(values(0), 40)).toBeCloseTo(40, 10);
    expect(cutNeeded(values(100), 40)).toBeCloseTo(20, 10);
    const w = values(30, { editing: 80 });
    expect(cutNeeded(w, 8)).toBeCloseTo(8 * (1 - (0.5 * partSkill(w, 'cut')) / 100), 10);
  });

  it("is made in the Director's Cut the DGA guarantees, exactly, and the film is its four parts' mean", () => {
    const cases: [number, PrepArgs][] = [
      [20, { form: 'hour' }],
      [100, { form: 'hour' }],
      [0, { form: 'half-hour' }],
      [60, { form: 'feature', budget: 3_500_000, shoot: 120 }],
      [100, STUDIO],
    ];
    cases.forEach(([lvl, args], i) => {
      const seed = seedOf(i + 1);
      const before = shot(lvl, args, {}, seed);
      const w = v(before);
      const b = film(before);
      const k = partSkill(w, 'cut');
      const c = clamp(k * finish(w, b.cutDays, cutNeeded(w, b.shootDays)) + spread(k) * (2 * u(seed, 'cut', 1) - 1));
      const after = film(dispatch(before, cutFilm, { film: 1 }));
      expect(after.cut, String(i)).toBeCloseTo(c, 10);
      expect(after.quality, String(i)).toBeCloseTo(mean([b.shot?.story ?? 0, b.shot?.performances ?? 0, b.shot?.images ?? 0, c]), 10);
    });
  });

  it('holds the cut to 0 and 100', () => {
    const cuts = (lvl: number) => Array.from({ length: 12 }, (_, i) => film(cutOf(lvl, { form: 'hour' }, {}, seedOf(i + 1))).cut);
    expect(cuts(100).some((x) => x === 100)).toBe(true);
    expect(cuts(0).some((x) => x === 0)).toBe(true);
  });

  it("is shorter than the footage needs for an hour's four days from a director below the top, enough at 100", () => {
    const w = values(40);
    expect(finish(w, 4, cutNeeded(w, 8))).toBeLessThan(1);
    expect(finish(values(100), 4, cutNeeded(values(100), 8))).toBe(1);
    const lowLevel = film(cutOf(30, { form: 'feature', budget: 3_500_000, shoot: 100 })).cut ?? 0;
    const fullLevel = film(cutOf(30, { form: 'feature', budget: 4_500_000, shoot: 100 })).cut ?? 0;
    expect(fullLevel).toBeGreaterThan(lowLevel);
  });

  it('teaches Editing over the days of the cut', () => {
    const before = shot(50, { form: 'hour' });
    const after = dispatch(before, cutFilm, { film: 1 });
    expect(held(after)['editing']).toBeCloseTo(grown(50, 4), 10);
    expect(held(after)['vision']).toBe(held(before)['vision']);
  });

  it('is refused before the shoot and once cut', () => {
    expect(() => dispatch(prepped(50), cutFilm, { film: 1 })).toThrow("film 1 isn't shot");
    expect(() => dispatch(cutOf(50), cutFilm, { film: 1 })).toThrow('film 1 is cut');
  });

  it('comes out at the top from a director at 100 throughout, around half from one at 50, poorly from one at 10', () => {
    const q = (lvl: number) => mean(Array.from({ length: 10 }, (_, i) => film(cutOf(lvl, { form: 'feature', budget: 20_000_000, shoot: 40 }, {}, seedOf(i + 1))).quality ?? 0));
    expect(film(cutOf(100)).quality).toBeGreaterThanOrEqual(97);
    expect(q(50)).toBeGreaterThan(38);
    expect(q(50)).toBeLessThan(55);
    expect(q(10)).toBeLessThan(15);
  });

  it('directing.cut: a better editor cuts better', () => {
    falsifyAny({ feature: 'directing.cut', claim: 'bites', says: 'a director at 90 in Editing cuts an hour better than one at 20', base: 20, twin: 90, outcome: (n) => film(cutOf(50, { form: 'hour' }, { editing: n })).cut });
  });
});

describe('festivals', () => {
  it("choose at each festival's own rate for a film at the pool's middle, more for better, never past certain", () => {
    expect(FESTIVALS).toEqual({ sundance: 90 / 4255, cannes: 72 / 2541, berlinale: 252 / 8085, tiff: 285 / 9020 });
    expect(POOL).toBe(50);
    expect(STEEP).toBe(5);
    expect(selectionChance('cannes', 50)).toBeCloseTo(72 / 2541, 12);
    expect(selectionChance('sundance', 100)).toBeCloseTo((90 / 4255) * 32, 12);
    expect(selectionChance('sundance', 25)).toBeCloseTo((90 / 4255) / 32, 12);
    expect(selectionChance('tiff', 100)).toBe(1);
    expect(selectionChance('berlinale', 0)).toBe(0);
  });

  it('take a finished feature by the draw on its chance, once each', () => {
    let hits = 0;
    for (let i = 1; i <= 24; i += 1) {
      const seed = seedOf(i);
      let l = cutOf(i % 2 === 0 ? 100 : 70, STUDIO, {}, seed);
      for (const f of Object.keys(FESTIVALS) as Festival[]) {
        const expected = u(seed, 'festival', 1, f) < selectionChance(f, film(l).quality ?? 0);
        l = dispatch(l, submitFilm, { film: 1, festival: f });
        expect(film(l).festivals[f], `${seed} ${f}`).toBe(expected);
        if (expected) hits += 1;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(96);
  });

  it('are refused for a festival there is not, an episode, a film not cut, or a second time', () => {
    expect(() => dispatch(cutOf(60), submitFilm, { film: 1, festival: 'venice' as Festival })).toThrow("there's no festival venice");
    expect(() => dispatch(cutOf(60, { form: 'hour' }), submitFilm, { film: 1, festival: 'cannes' })).toThrow('film 1 is an episode');
    expect(() => dispatch(shot(60), submitFilm, { film: 1, festival: 'cannes' })).toThrow("film 1 isn't cut");
    expect(() => dispatch(dispatch(cutOf(60), submitFilm, { film: 1, festival: 'cannes' }), submitFilm, { film: 1, festival: 'cannes' })).toThrow('film 1 went to cannes');
  });

  it('directing.submit: a better film is chosen more often', () => {
    const chosen = (lvl: number) => Array.from({ length: 30 }, (_, i) => film(dispatch(cutOf(lvl, STUDIO, {}, seedOf(i + 1)), submitFilm, { film: 1, festival: 'cannes' })).festivals['cannes']).filter(Boolean).length;
    falsifyAny({ feature: 'directing.submit', claim: 'bites', says: 'thirty films by a director at 100 reach Cannes more often than thirty by one at 40', base: 40, twin: 100, outcome: chosen });
  });
});

describe('a second feature', () => {
  it("comes a quarter of the time within five years, nearly half where the debut found an audience, as the pitch carries it", () => {
    expect(SECOND).toEqual({ debut: 0.253, audience: 0.45 });
    const other = 0.66 / 0.6756;
    expect(secondChance(values(50), false, false)).toBeCloseTo(0.253 * other, 12);
    expect(secondChance(values(50), true, false)).toBeCloseTo(0.45 * other, 12);
    expect(secondChance(values(100), true, false)).toBeCloseTo(0.675 * other, 12);
    expect(secondChance(values(0), false, false)).toBeCloseTo(0.1265 * other, 12);
    const w = values(40, { communication: 90 });
    expect(pitchSkill(w)).toBeCloseTo(mean(['pitching-and-presenting-the-project', 'persuasion', 'promote-productions-through-interviews-and-public-appearance'].map((id) => of(w, id))), 10);
    expect(pitchSkill(w)).toBeGreaterThan(pitchSkill(values(40)));
  });

  it('is decided by the draw on the debut, a festival choosing it read as an audience found, and teaches Communication', () => {
    for (let i = 1; i <= 16; i += 1) {
      const seed = seedOf(i);
      let l = cutOf(i % 2 === 0 ? 95 : 55, STUDIO, {}, seed);
      for (const f of ['sundance', 'cannes'] as Festival[]) l = dispatch(l, submitFilm, { film: 1, festival: f });
      const audience = Object.values(film(l).festivals).includes(true);
      const before = v(l);
      const after = dispatch(l, pursueSecond, {});
      expect(after.slices.directing.second, seed).toBe(u(seed, 'second', 1) < secondChance(before, audience, false));
      expect(held(after)['communication']).toBeCloseTo(grown(held(l)['communication'] as number, 1), 10);
      expect(held(after)['editing']).toBe(held(l)['editing']);
    }
    const chosen = withDirecting(cutOf(50), {});
    const at = (festivals: Record<string, boolean>) => {
      const l = { ...chosen, slices: { ...chosen.slices, directing: { ...chosen.slices.directing, films: [{ ...film(chosen), festivals }] } } };
      return Array.from({ length: 40 }, (_, i) => dispatch({ ...l, frame: { ...l.frame, seed: seedOf(i + 1) } }, pursueSecond, {}).slices.directing.second).filter(Boolean).length;
    };
    expect(at({ cannes: true, sundance: false })).toBeGreaterThan(at({ cannes: false, sundance: false }));
  });

  it('reads the debut, the first feature, even after episodes', () => {
    const l = dispatch(dispatch(dispatch(prepped(60, { form: 'hour' }), prepFilm, STUDIO), shootFilm, { film: 2 }), cutFilm, { film: 2 });
    expect(dispatch(l, pursueSecond, {}).slices.directing.second).not.toBeNull();
  });

  it('is refused with no debut, a debut not cut, or once taken', () => {
    expect(() => dispatch(made(50), pursueSecond, {})).toThrow('there is no debut feature');
    expect(() => dispatch(cutOf(50, { form: 'hour' }), pursueSecond, {})).toThrow('there is no debut feature');
    expect(() => dispatch(shot(50), pursueSecond, {})).toThrow("film 1 isn't cut");
    expect(() => dispatch(dispatch(cutOf(50), pursueSecond, {}), pursueSecond, {})).toThrow("the debut's chance is taken");
    const unmade = cutOf(50);
    expect(() => dispatch({ ...unmade, slices: { ...unmade.slices, identity: { person: null, sessions: [] } } }, pursueSecond, {})).toThrow('the person is not made yet');
  });

  it('directing.pursue: a better pitcher gets the second feature more often', () => {
    const backed = (n: number) => Array.from({ length: 40 }, (_, i) => dispatch(cutOf(50, STUDIO, { communication: n }, seedOf(i + 1)), pursueSecond, {}).slices.directing.second).filter(Boolean).length;
    falsifyAny({ feature: 'directing.pursue', claim: 'bites', says: 'forty debuts by a director at 100 in Communication lead to more second features than forty at 0', base: 0, twin: 100, outcome: backed });
  });
});

describe('a family in the business', () => {
  it("moves the chance of a second as Follows's debut directors were moved, 72% against 66%, averaging back to the sourced rate", () => {
    expect(KIN).toEqual({ share: 0.26, family: 0.72, other: 0.66 });
    expect(kinship(true)).toBeCloseTo(0.72 / 0.6756, 12);
    expect(kinship(false)).toBeCloseTo(0.66 / 0.6756, 12);
    expect(0.26 * kinship(true) + 0.74 * kinship(false)).toBeCloseTo(1, 12);
    expect(kinship(true) / kinship(false)).toBeCloseTo(0.72 / 0.66, 12);
    expect(secondChance(values(50), false, true)).toBeCloseTo((0.253 * 0.72) / 0.6756, 12);
    expect(secondChance(values(50), true, true)).toBeCloseTo((0.45 * 0.72) / 0.6756, 12);
    expect(secondChance(values(100), true, true)).toBeCloseTo((0.675 * 0.72) / 0.6756, 12);
  });

  it('is any trade in film or TV the family was in, not music (Follows counts film and TV), read when the debut is pursued, and changes nothing of the film', () => {
    for (let i = 1; i <= 16; i += 1) {
      const seed = seedOf(i);
      const trade = FAMILY[i % FAMILY.length] as Family;
      const l = withFamily(dispatch(cutOf(i % 2 === 0 ? 95 : 55, STUDIO, {}, seed), submitFilm, { film: 1, festival: 'cannes' }), trade);
      const audience = film(l).festivals['cannes'] === true;
      const after = dispatch(l, pursueSecond, {});
      expect(after.slices.directing.second, `${seed} ${trade}`).toBe(u(seed, 'second', 1) < secondChance(v(l), audience, trade !== 'outside' && trade !== 'music'));
      expect(film(after)).toEqual(film(l));
    }
  });

  it('reads a family in music as outside the business, as Follows counts film and TV only', () => {
    const debut = (i: number) => cutOf(50, STUDIO, {}, seedOf(i));
    // A debut whose draw falls between the two sides' chances, so the family decides it.
    const i = Array.from({ length: 400 }, (_, k) => k + 1).find((k) => {
      const w = v(debut(k));
      const x = u(seedOf(k), 'second', 1);
      return x >= secondChance(w, false, false) && x < secondChance(w, false, true);
    }) as number;
    const second = (family: Family) => dispatch(withFamily(debut(i), family), pursueSecond, {}).slices.directing.second;
    expect([second('outside'), second('music'), second('acting'), second('directing')]).toEqual([false, false, true, true]);
  });

  it('identity.make: a director whose family is in the business gets a second feature more often', () => {
    const backed = (family: Family) => Array.from({ length: 200 }, (_, i) => dispatch(withFamily(cutOf(50, STUDIO, {}, seedOf(i + 1)), family), pursueSecond, {}).slices.directing.second).filter(Boolean).length;
    falsifyAny({ feature: 'identity.make', claim: 'bites', says: 'two hundred debuts by a director whose family directs lead to more second features than by one whose family is outside the business', base: 'outside' as Family, twin: 'directing' as Family, outcome: backed });
  });
});

describe('the director', () => {
  it('reads every broad attribute somewhere in the work', () => {
    const outcome = (each: Record<string, number>) => {
      const l = dispatch(cutOf(50, STUDIO, each), submitFilm, { film: 1, festival: 'cannes' });
      return { f: film(l), second: secondChance(v(l), false, false) };
    };
    const base = outcome({});
    for (const id of BROAD) expect(outcome({ [id]: 90 }), id).not.toEqual(base);
  });

  it('is the same for the same life and differs for another', () => {
    expect(film(cutOf(50))).toEqual(film(cutOf(50)));
    expect(film(cutOf(50, STUDIO, {}, 'fedcba9876543210'))).not.toEqual(film(cutOf(50)));
  });

  it("tells the player its own figures are the game's", () => {
    expect(MODEL_LINE).toBe('directing.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own reckoning");
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('directing.'))).toEqual([
      { id: 'directing.prep', reads: [], writes: ['attributes', 'directing'] },
      { id: 'directing.shoot', reads: ['identity', 'acting', 'producing', 'permits'], writes: ['attributes', 'directing'] },
      { id: 'directing.cut', reads: ['identity', 'acting', 'producing', 'permits'], writes: ['attributes', 'directing'] },
      { id: 'directing.submit', reads: [], writes: ['directing'] },
      { id: 'directing.pursue', reads: ['identity'], writes: ['attributes', 'directing'] },
    ]);
  });
});
