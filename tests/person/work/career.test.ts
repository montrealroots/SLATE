import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { ATTRIBUTES_START, chooseAttributes, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  CAREER_START,
  contactChance,
  FEES,
  joinRoom,
  LADDER,
  meetPeople,
  pitchScript,
  pitchSkill,
  promoteScript,
  quality,
  requestChance,
  saleChance,
  seasonOutcome,
  staffingSkill,
  standingOf,
  summariseScript,
  SYNOPSIS_DAYS,
  workSeason,
  type CareerSlice,
} from '../../../src/person/work/career.ts';
import { readScript, SCRIPTS_START, spread, writeScript, type Form, type Script, type ScriptsSlice } from '../../../src/person/work/work.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

type Career = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice };
const SEED = '0123456789abcdef';
const u = (...keys: (string | number)[]) => draws(seedFromText(SEED), 'work.career', ...keys);
const clamp = (n: number) => Math.min(100, Math.max(0, n));

const made = (all: number, each: Record<string, number> = {}): Life<Career> =>
  dispatch(begin(SEED, 0, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START), career: structuredClone(CAREER_START) }), chooseAttributes, { role: 'screenwriter', all, each });
const withScript = (all: number, form: Form = 'feature', each: Record<string, number> = {}) => dispatch(made(all, each), writeScript, { form, days: 200 });
const v = (l: Life<Career>) => l.slices.attributes['screenwriter'] as Record<string, number>;
const out = (l: Life<Career>, id = 1) => l.slices.career.out[String(id)];
const script = (l: Life<Career>, id = 1) => l.slices.scripts.written[id - 1] as Script;
const contacts = (l: Life<Career>, n: number): Life<Career> => ({ ...l, slices: { ...l.slices, career: { ...l.slices.career, contacts: n } } });
const requested = (l: Life<Career>, n: number, synopsis: number | null = null): Life<Career> => ({ ...l, slices: { ...l.slices, career: { ...l.slices.career, out: { '1': { synopsis, requests: n, sold: null } } } } });

describe('a synopsis', () => {
  it('is written from Synopsis and Writing, worth half when rushed to nothing, within the draft spread', () => {
    const before = withScript(60, 'feature', { synopsis: 80 });
    const vb = v(before);
    const needed = Math.ceil(SYNOPSIS_DAYS.feature / (0.5 + (0.5 * (0.6 * (vb['writing'] as number) + 0.4 * (vb['time-management'] as number))) / 100));
    const k = 0.7 * (vb['synopsis'] as number) + 0.3 * (vb['writing'] as number);
    for (const days of [1, 30]) {
      const l = dispatch(before, summariseScript, { script: 1, days });
      const effort = Math.min(1, days / needed);
      expect(out(l)?.synopsis, String(days)).toBeCloseTo(clamp(k * (0.5 + 0.5 * effort) + spread(k) * (2 * u('synopsis', 1, 0).float() - 1)), 10);
      expect(v(l)['synopsis']).toBeCloseTo((vb['synopsis'] as number) + 4 * Math.min(1.5, days / needed) * (1 - (vb['synopsis'] as number) / 100), 10);
    }
    expect(SYNOPSIS_DAYS).toEqual({ feature: 7, pilot: 5, episode: 3, short: 1 });
    expect(out(dispatch(before, summariseScript, { script: 1, days: 3 }))).toMatchObject({ requests: 0, sold: null });
  });

  it('script.summarise: a better hand at it writes a better synopsis', () => {
    falsifyAny({ feature: 'script.summarise', claim: 'bites', says: 'a writer at 90 in Synopsis writes a better one than at 20', base: 20, twin: 90, outcome: (n) => out(dispatch(withScript(60, 'feature', { synopsis: n }), summariseScript, { script: 1, days: 10 }))?.synopsis });
  });

  it('is refused for days that are not whole', () => {
    expect(() => dispatch(withScript(60), summariseScript, { script: 1, days: 0 })).toThrow('the days given are a whole number of at least 1 (0)');
  });
});

describe('networking', () => {
  it('makes a contact a day as often as Networking, Speaking and Social Perceptiveness make it likely', () => {
    expect(contactChance(made(0).slices.attributes['screenwriter'] as Record<string, number>)).toBeCloseTo(0.05, 10);
    expect(contactChance(made(100).slices.attributes['screenwriter'] as Record<string, number>)).toBeCloseTo(0.5, 10);
    expect(contactChance(v(made(0, { networking: 100 })))).toBeCloseTo(0.05 + 0.45 * 0.6, 10);
    expect(contactChance(v(made(0, { speaking: 100 })))).toBeCloseTo(0.05 + 0.45 * 0.2, 10);
    expect(contactChance(v(made(0, { 'social-perceptiveness': 100 })))).toBeCloseTo(0.05 + 0.45 * 0.2, 10);
    const base = made(50);
    const p = contactChance(v(base));
    const d = u('network', 0);
    let expected = 0;
    for (let i = 0; i < 40; i += 1) if (d.float() < p) expected += 1;
    const l = dispatch(base, meetPeople, { days: 40 });
    expect(l.slices.career.contacts).toBe(expected);
    for (let n = 1; n <= 40; n += 1) {
      const dn = u('network', 0);
      let e = 0;
      for (let i = 0; i < n; i += 1) if (dn.float() < p) e += 1;
      expect(dispatch(base, meetPeople, { days: n }).slices.career.contacts, String(n)).toBe(e);
    }
    expect(v(l)['networking']).toBeCloseTo(50 + 4 * (40 / 30) * 0.5, 10);
    expect(v(dispatch(base, meetPeople, { days: 400 }))['speaking']).toBeCloseTo(50 + 4 * 1.5 * 0.5, 10);
    expect(() => dispatch(base, meetPeople, { days: 0 })).toThrow(RangeError);
  });

  it('network.meet: a better networker meets more people', () => {
    falsifyAny({ feature: 'network.meet', claim: 'bites', says: 'a writer at 100 in Networking makes more contacts in 60 days than one at 0', base: 0, twin: 100, outcome: (n) => dispatch(made(50, { networking: n }), meetPeople, { days: 60 }).slices.career.contacts });
  });
});

describe('sending a script out', () => {
  it("is weighed by the buyer on its last grade, or its parts' mean where none has graded it", () => {
    const l = withScript(70);
    const s = script(l);
    expect(quality(s)).toBeCloseTo(Object.values(s.parts).reduce((t, p) => t + p, 0) / 11, 10);
    const graded = script(dispatch(l, readScript, { script: 1, reader: 'black-list' }));
    expect(quality(graded)).toBe((graded.reads.at(-1)?.overall ?? 0) * 10);
  });

  it('gets requests to read from the contacts approached, one a day, by Promotion, the synopsis and the grade', () => {
    expect(requestChance({ promotion: 0 }, null, 0)).toBeCloseTo(0.1 * 0.3 * 0.5, 10);
    expect(requestChance({ promotion: 100 }, 100, 100)).toBeCloseTo(0.6, 10);
    expect(requestChance({ promotion: 100 }, 0, 100)).toBeCloseTo(0.6 * 0.3, 10);
    const base = contacts(dispatch(withScript(70), summariseScript, { script: 1, days: 10 }), 8);
    const p = requestChance(v(base), out(base)?.synopsis ?? null, quality(script(base)));
    const d = u('promote', 1, 0);
    let expected = 0;
    for (let i = 0; i < 5; i += 1) if (d.float() < p) expected += 1;
    const l = dispatch(base, promoteScript, { script: 1, days: 5 });
    expect(out(l)?.requests).toBe(expected);
    const many = contacts(base, 40);
    for (let n = 1; n <= 40; n += 1) {
      const dn = u('promote', 1, 0);
      let e = 0;
      for (let i = 0; i < n; i += 1) if (dn.float() < p) e += 1;
      expect(out(dispatch(many, promoteScript, { script: 1, days: n }))?.requests, String(n)).toBe(e);
    }
    expect(v(l)['promotion']).toBeCloseTo((v(base)['promotion'] as number) + 4 * (5 / 30) * (1 - (v(base)['promotion'] as number) / 100), 10);
    expect(out(dispatch(contacts(withScript(70), 0), promoteScript, { script: 1, days: 30 }))?.requests).toBe(0);
    expect(out(dispatch(contacts(withScript(100), 3), promoteScript, { script: 1, days: 30 }))?.requests).toBeLessThanOrEqual(3);
    expect(() => dispatch(base, promoteScript, { script: 1, days: 0 })).toThrow(RangeError);
  });

  it('script.promote: a better promoter gets more requests', () => {
    falsifyAny({ feature: 'script.promote', claim: 'bites', says: 'a writer at 100 in Promotion gets more requests from 30 contacts than one at 0', base: 0, twin: 100, outcome: (n) => out(dispatch(contacts(dispatch(withScript(80, 'feature', { promotion: n }), summariseScript, { script: 1, days: 10 }), 30), promoteScript, { script: 1, days: 30 }))?.requests });
  });
});

describe('a pitch', () => {
  it("sells as the script's quality and the meeting make likely: nearly always at 100, seldom at 30", () => {
    expect(pitchSkill({ pitching: 100, speaking: 0, persuasion: 0 }, null)).toBe(50);
    expect(pitchSkill({ pitching: 0, speaking: 100, persuasion: 100 }, 100)).toBe(50);
    expect(saleChance(100, 100)).toBe(1);
    expect(saleChance(100, 0)).toBeCloseTo(0.4, 10);
    expect(saleChance(50, 100)).toBeCloseTo(0.25, 10);
    expect(saleChance(0, 100)).toBe(0);
    const top = dispatch(requested(withScript(100), 1, 100), pitchScript, { script: 1 });
    expect(out(top)?.sold).toEqual({ at: 0, fee: FEES.feature });
    expect(top.slices.career.contacts).toBe(1);
    expect(out(top)?.requests).toBe(0);
    expect(v(top)['pitching']).toBe(100);
  });

  it('decides by the meeting draw, and grows Pitching, Speaking and Persuasion', () => {
    const base = requested(withScript(60), 2, 50);
    const chance = saleChance(quality(script(base)), pitchSkill(v(base), 50));
    const l = dispatch(base, pitchScript, { script: 1 });
    expect(out(l)?.sold !== null).toBe(u('pitch', 1, 0, 1).float() < chance);
    expect(out(l)?.requests).toBe(1);
    for (const id of ['pitching', 'speaking', 'persuasion']) expect(v(l)[id], id).toBeCloseTo((v(base)[id] as number) + 4 * (1 - (v(base)[id] as number) / 100), 10);
  });

  it('sells by the meeting draw on each script, a dozen scripts over', () => {
    let l = made(65);
    for (let i = 0; i < 12; i += 1) l = dispatch(l, writeScript, { form: 'episode', days: 200 });
    l = { ...l, slices: { ...l.slices, career: { contacts: 0, room: null, out: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), { synopsis: 50, requests: 1, sold: null }])) } } };
    for (let id = 1; id <= 12; id += 1) {
      const chance = saleChance(quality(script(l, id)), pitchSkill(v(l), 50));
      const sold = u('pitch', id, 0, 0).float() < chance;
      l = dispatch(l, pitchScript, { script: id });
      expect(out(l, id)?.sold !== null, String(id)).toBe(sold);
    }
  });

  it("pays the WGA's minimum for the form, takes the script off the market and leaves the buyer a contact", () => {
    expect(FEES.feature).toEqual({ currency: 'USD', minor: 17_321_500 });
    expect(FEES.pilot).toEqual({ currency: 'USD', minor: 7_119_000 });
    expect(FEES.episode).toEqual({ currency: 'USD', minor: 4_746_000 });
    expect(FEES.short).toBeNull();
    const sold = dispatch(requested(withScript(100, 'short'), 2, 100), pitchScript, { script: 1 });
    expect(out(sold)?.sold).toEqual({ at: 0, fee: null });
    expect(() => dispatch(sold, pitchScript, { script: 1 })).toThrow('script 1 is sold');
    expect(() => dispatch(sold, promoteScript, { script: 1, days: 3 })).toThrow('script 1 is sold');
    expect(() => dispatch(sold, summariseScript, { script: 1, days: 3 })).toThrow('script 1 is sold');
    expect(() => dispatch(withScript(100), pitchScript, { script: 1 })).toThrow('no one has asked to read script 1');
  });

  it('script.pitch: a better script sells where a weak one does not', () => {
    falsifyAny({ feature: 'script.pitch', claim: 'bites', says: 'a writer at 100 sells on a pitch where one at 5 does not', base: 5, twin: 100, outcome: (n) => out(dispatch(requested(withScript(n), 1, 100), pitchScript, { script: 1 }))?.sold !== null });
  });
});

describe('a writers room', () => {
  const staffed = (all: number, each: Record<string, number> = {}) => dispatch(contacts(withScript(all, 'pilot', each), 1), joinRoom, { script: 1 });

  it('staffs a writer through a contact on a pilot or episode sample, as the sample and the meeting make likely', () => {
    expect(staffingSkill({ speaking: 100, 'social-perceptiveness': 0, persuasion: 0 })).toBe(40);
    expect(staffingSkill({ speaking: 0, 'social-perceptiveness': 100, persuasion: 0 })).toBe(30);
    expect(staffingSkill({ speaking: 0, 'social-perceptiveness': 0, persuasion: 100 })).toBe(30);
    expect(staffed(100).slices.career.room).toEqual({ level: 0, seasons: 0, standing: null, episodes: 0 });
    const base = contacts(withScript(55, 'episode'), 1);
    const l = dispatch(base, joinRoom, { script: 1 });
    expect(l.slices.career.room !== null).toBe(u('staff', 1, 0).float() < saleChance(quality(script(base)), staffingSkill(v(base))));
    expect(v(l)['speaking']).toBeCloseTo((v(base)['speaking'] as number) + 4 * (1 - (v(base)['speaking'] as number) / 100), 10);
    expect(() => dispatch(contacts(withScript(100), 1), joinRoom, { script: 1 })).toThrow('a staffing sample is a pilot or an episode, not a feature');
    expect(() => dispatch(withScript(100, 'pilot'), joinRoom, { script: 1 })).toThrow('a staffing meeting comes through a contact, and the writer has none');
    expect(() => dispatch(staffed(100), joinRoom, { script: 1 })).toThrow('the writer is already in a room');
  });

  it("gives each season's standing its episodes, keeps the writer on or lets them go, and steps them up the WGA's ladder", () => {
    expect(LADDER).toEqual(['Staff Writer', 'Story Editor', 'Executive Story Editor', 'Co-Producer', 'Producer', 'Supervising Producer', 'Consulting Producer', 'Co-Executive Producer', 'Executive Producer', 'Showrunner']);
    expect(standingOf({ 'social-perceptiveness': 100, speaking: 0, persuasion: 0 })).toBe(50);
    expect(standingOf({ 'social-perceptiveness': 0, speaking: 100, persuasion: 100 })).toBe(50);
    let l = staffed(100);
    for (let i = 0; i < 12; i += 1) l = dispatch(l, workSeason, {});
    expect(l.slices.career.room).toMatchObject({ level: 9, seasons: 12, episodes: 2 });
    for (const all of [20, 45, 60, 75, 90]) {
      const s = staffed(100, Object.fromEntries(['social-perceptiveness', 'speaking', 'persuasion'].map((id) => [id, all])));
      const vb = v(s);
      const base = standingOf(vb);
      const standing = clamp(base + spread(base) * (2 * u('season', 0, 0).float() - 1));
      const after = dispatch(s, workSeason, {});
      if (standing < 40) expect(after.slices.career.room, String(all)).toBeNull();
      else expect(after.slices.career.room, String(all)).toEqual({ level: standing >= 70 ? 1 : 0, seasons: 1, standing, episodes: standing >= 80 ? 2 : standing >= 50 ? 1 : 0 });
      expect(v(after)['social-perceptiveness']).toBeCloseTo((vb['social-perceptiveness'] as number) + 4 * 1.5 * (1 - (vb['social-perceptiveness'] as number) / 100), 10);
    }
    expect(() => dispatch(withScript(50), workSeason, {})).toThrow('the writer is in no room');
  });

  it('turns a standing into its season at the exact marks: 80, 70, 50, 40', () => {
    expect(seasonOutcome(80)).toEqual({ episodes: 2, kept: true, up: true });
    expect(seasonOutcome(79.9)).toEqual({ episodes: 1, kept: true, up: true });
    expect(seasonOutcome(70)).toEqual({ episodes: 1, kept: true, up: true });
    expect(seasonOutcome(69.9)).toEqual({ episodes: 1, kept: true, up: false });
    expect(seasonOutcome(50)).toEqual({ episodes: 1, kept: true, up: false });
    expect(seasonOutcome(49.9)).toEqual({ episodes: 0, kept: true, up: false });
    expect(seasonOutcome(40)).toEqual({ episodes: 0, kept: true, up: false });
    expect(seasonOutcome(39.9)).toEqual({ episodes: 0, kept: false, up: false });
  });

  it('staffs by the meeting draw in each life, a dozen lives over', () => {
    for (let k = 0; k < 12; k += 1) {
      const at = k * 86_400;
      const l0 = dispatch(begin(SEED, at, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START), career: { contacts: 1, out: {}, room: null } }), chooseAttributes, { role: 'screenwriter', all: 70 });
      const l1 = dispatch(l0, writeScript, { form: 'episode', days: 200 });
      const chance = saleChance(quality(script(l1)), staffingSkill(v(l1)));
      expect(dispatch(l1, joinRoom, { script: 1 }).slices.career.room !== null, String(k)).toBe(u('staff', 1, at).float() < chance);
    }
  });

  it('room.join: a better sample and meeting staff the writer where weak ones do not', () => {
    falsifyAny({ feature: 'room.join', claim: 'bites', says: 'a writer at 100 is staffed where one at 5 is not', base: 5, twin: 100, outcome: (n) => staffed(n).slices.career.room !== null });
  });

  it('room.season: a writer the room values is kept, one it does not is let go', () => {
    falsifyAny({ feature: 'room.season', claim: 'bites', says: 'a writer at 100 with people is kept where one at 0 is let go', base: 0, twin: 100, outcome: (n) => dispatch(staffed(100, { 'social-perceptiveness': n, speaking: n, persuasion: n }), workSeason, {}).slices.career.room !== null });
  });

  it('is run through the frame, each command declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => ['script.summarise', 'network.meet', 'script.promote', 'script.pitch', 'room.join', 'room.season'].includes(x.id))).toEqual([
      { id: 'script.summarise', reads: ['scripts'], writes: ['attributes', 'career'] },
      { id: 'network.meet', reads: [], writes: ['attributes', 'career'] },
      { id: 'script.promote', reads: ['scripts'], writes: ['attributes', 'career'] },
      { id: 'script.pitch', reads: ['scripts'], writes: ['attributes', 'career'] },
      { id: 'room.join', reads: ['scripts'], writes: ['attributes', 'career'] },
      { id: 'room.season', reads: [], writes: ['attributes', 'career'] },
    ]);
  });
});
