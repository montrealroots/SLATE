import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { draws, seedFromText } from '../../../src/core/rng/rng.ts';
import { ATTRIBUTES_START, attributeOf, chooseAttributes, DAILY, facetSkill, skillOf, type AttributesSlice } from '../../../src/person/attributes/attributes.ts';
import {
  bestOf,
  CAREER_START,
  COLD,
  coldChance,
  contactChance,
  DOCUMENT_DAYS,
  documentSkill,
  FEES,
  MARKET_LEVEL,
  MARKET_SHARE,
  meetPeople,
  PITCH,
  pitchScript,
  pitchSkill,
  promoteScript,
  pull,
  quality,
  QUERY,
  requestChance,
  saleChance,
  summariseScript,
  type CareerSlice,
  type Document,
  type Out,
} from '../../../src/person/work/career.ts';
import { PARTS, partScore, readScript, SCRIPTS_START, spread, writeScript, type Form, type Script, type ScriptsSlice } from '../../../src/person/work/work.ts';
import { falsifyAny } from '../../support/falsify-core.ts';

type Career = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice };
const SEED = '0123456789abcdef';
const u = (...keys: (string | number)[]) => draws(seedFromText(SEED), 'work.career', ...keys);
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const grown = (from: number, days: number) => 100 - (100 - from) * (1 - DAILY) ** days;
const of = (v: Record<string, number>, id: string) => skillOf(v, 'screenwriter', id);

const made = (all: number, each: Record<string, number> = {}, at = 0): Life<Career> =>
  dispatch(begin(SEED, at, { attributes: structuredClone(ATTRIBUTES_START), scripts: structuredClone(SCRIPTS_START), career: structuredClone(CAREER_START) }), chooseAttributes, { role: 'screenwriter', all, each });
const withScript = (all: number, form: Form = 'feature', each: Record<string, number> = {}) => dispatch(made(all, each), writeScript, { form, days: 200 });
const v = (l: Life<Career>) => l.slices.attributes['screenwriter'] as Record<string, number>;
const out = (l: Life<Career>, id = 1) => l.slices.career.out[String(id)];
const script = (l: Life<Career>, id = 1) => l.slices.scripts.written[id - 1] as Script;
const withCareer = (l: Life<Career>, career: Partial<CareerSlice>): Life<Career> => ({ ...l, slices: { ...l.slices, career: { ...l.slices.career, ...career } } });
const contacts = (l: Life<Career>, n: number) => withCareer(l, { contacts: n });
const requested = (l: Life<Career>, n: number, documents: Record<string, number> = {}) => withCareer(l, { out: { '1': { documents, requests: n, sold: null } } });
const emptyOut: Out = { documents: {}, requests: 0, sold: null };

describe("a script's documents", () => {
  it('are the ten the sources name, each its own facet of Synopsis, written in its own time', () => {
    expect(Object.keys(DOCUMENT_DAYS)).toEqual(attributeOf('screenwriter', 'synopsis').facets.map((f) => f.id));
    expect(DOCUMENT_DAYS.treatment).toBe(21.5);
    expect(QUERY).toEqual(['logline', 'short-synopsis', 'one-page-synopsis']);
    expect(PITCH).toEqual(['pitch-document', 'one-page-synopsis', 'treatment']);
    const w = v(made(60, { synopsis: 90, premise: 20 }));
    const logline = attributeOf('screenwriter', 'synopsis').facets.find((f) => f.id === 'logline');
    expect(logline?.draws).toEqual(['premise']);
    expect(documentSkill(w, 'logline')).toBeCloseTo(0.7 * (0.75 * 90 + 0.25 * 20) + 0.3 * of(w, 'writing'), 10);
    expect(documentSkill(w, 'statement-of-intent')).toBeCloseTo(0.7 * 90 + 0.3 * of(w, 'writing'), 10);
    expect(() => documentSkill(w, 'novel' as Document)).toThrow("there's no document novel");
    expect(facetSkill(w, logline!, 'synopsis')).toBeCloseTo(72.5, 10); // eslint-disable-line @typescript-eslint/no-non-null-assertion
  });

  it('come out as the writer is, worth half when rushed to nothing, within the spread', () => {
    const before = withScript(60, 'feature', { synopsis: 80 });
    const vb = v(before);
    const k = documentSkill(vb, 'treatment');
    const needed = Math.ceil(DOCUMENT_DAYS.treatment / (0.5 + (0.5 * (0.6 * of(vb, 'writing') + 0.4 * of(vb, 'time-management'))) / 100));
    for (const days of [1, 60]) {
      const l = dispatch(before, summariseScript, { script: 1, document: 'treatment', days });
      expect(out(l)?.documents['treatment'], String(days)).toBeCloseTo(clamp(k * (0.5 + 0.5 * Math.min(1, days / needed)) + spread(k) * (2 * u('document', 1, 'treatment', 0).float() - 1)), 10);
      expect(v(l)['synopsis']).toBeCloseTo(grown(vb['synopsis'] as number, days), 10);
    }
    expect(out(dispatch(before, summariseScript, { script: 1, document: 'logline', days: 1 }))).toMatchObject({ requests: 0, sold: null });
    expect(() => dispatch(before, summariseScript, { script: 1, document: 'logline', days: 0 })).toThrow('the days given are a whole number of at least 1 (0)');
  });

  it('script.summarise: a better hand at Synopsis writes a better logline', () => {
    falsifyAny({ feature: 'script.summarise', claim: 'bites', says: 'a writer at 90 in Synopsis writes a better logline than at 20', base: 20, twin: 90, outcome: (n) => out(dispatch(withScript(60, 'feature', { synopsis: n }), summariseScript, { script: 1, document: 'logline', days: 3 }))?.documents['logline'] });
  });
});

describe('networking', () => {
  it('makes a contact a day as often as Networking, Speaking and Social Perceptiveness make it likely', () => {
    expect(contactChance(v(made(0)))).toBeCloseTo(0.05, 10);
    expect(contactChance(v(made(100)))).toBeCloseTo(0.5, 10);
    const w = v(made(50, { networking: 100 }));
    expect(contactChance(w)).toBeCloseTo(0.05 + (0.45 * (0.6 * of(w, 'networking') + 0.2 * of(w, 'speaking') + 0.2 * of(w, 'social-perceptiveness'))) / 100, 10);
    const base = made(50);
    const p = contactChance(v(base));
    for (const n of [1, 7, 40]) {
      const d = u('network', 0);
      let e = 0;
      for (let i = 0; i < n; i += 1) if (d.float() < p) e += 1;
      expect(dispatch(base, meetPeople, { days: n }).slices.career.contacts, String(n)).toBe(e);
    }
    for (let n = 1; n <= 40; n += 1) {
      const d = u('network', 0);
      let e = 0;
      for (let i = 0; i < n; i += 1) if (d.float() < p) e += 1;
      expect(dispatch(base, meetPeople, { days: n }).slices.career.contacts).toBe(e);
    }
    expect(v(dispatch(base, meetPeople, { days: 40 }))['networking']).toBeCloseTo(grown(50, 40), 10);
    expect(() => dispatch(base, meetPeople, { days: 0 })).toThrow(RangeError);
  });

  it('network.meet: a better networker meets more people', () => {
    falsifyAny({ feature: 'network.meet', claim: 'bites', says: 'a writer at 100 in Networking makes more contacts in 60 days than one at 0', base: 0, twin: 100, outcome: (n) => dispatch(made(50, { networking: n }), meetPeople, { days: 60 }).slices.career.contacts });
  });
});

describe('sending a script out', () => {
  it("is weighed by the buyer on its last grade, or its parts' mean where none has graded it", () => {
    const l = withScript(70);
    expect(quality(script(l))).toBeCloseTo(PARTS.reduce((t, p) => t + partScore(script(l), p), 0) / PARTS.length, 10);
    const graded = script(dispatch(l, readScript, { script: 1, reader: 'black-list' }));
    expect(quality(graded)).toBe((graded.reads.at(-1)?.overall ?? 0) * 10);
  });

  it("asks a contact or, after them, a stranger: a cold query is answered one time in sixty-six, the query services' 1 to 2%", () => {
    expect(COLD).toBe(0.015);
    expect(bestOf(emptyOut, QUERY)).toBe(0);
    expect(bestOf({ ...emptyOut, documents: { logline: 40, treatment: 90 } }, QUERY)).toBe(40);
    expect(pull(v(made(0)), emptyOut)).toBe(0.5);
    expect(pull(v(made(100)), { ...emptyOut, documents: { 'one-page-synopsis': 100 } })).toBe(1.5);
    expect(requestChance(v(made(0)), emptyOut, 0)).toBeCloseTo(0.4 * 0.5 * 0.5, 10);
    expect(requestChance(v(made(100)), { ...emptyOut, documents: { logline: 100 } }, 100)).toBeCloseTo(0.6, 10);
    const base = contacts(dispatch(withScript(70), summariseScript, { script: 1, document: 'logline', days: 3 }), 3);
    const warm = requestChance(v(base), out(base) as Out, quality(script(base)));
    const cold = COLD * pull(v(base), out(base) as Out);
    expect(coldChance(v(base), out(base) as Out)).toBeCloseTo(cold, 15);
    expect(coldChance(v(made(100)), { ...emptyOut, documents: { logline: 100 } })).toBeCloseTo(0.0225, 15);
    expect(coldChance(v(made(0)), emptyOut)).toBeCloseTo(0.0075, 15);
    for (let n = 1; n <= 30; n += 1) {
      const d = u('promote', 1, 0);
      let e = 0;
      for (let i = 0; i < n; i += 1) if (d.float() < (i < 3 ? warm : cold)) e += 1;
      expect(out(dispatch(base, promoteScript, { script: 1, days: n }))?.requests, String(n)).toBe(e);
    }
    expect(v(dispatch(base, promoteScript, { script: 1, days: 5 }))['promotion']).toBeCloseTo(grown(v(base)['promotion'] as number, 5), 10);
    expect(() => dispatch(base, promoteScript, { script: 1, days: 0 })).toThrow(RangeError);
  });

  it('script.promote: a better promoter gets more requests', () => {
    falsifyAny({ feature: 'script.promote', claim: 'bites', says: 'a writer at 100 in Promotion gets more requests from 30 contacts than one at 0', base: 0, twin: 100, outcome: (n) => out(dispatch(contacts(withScript(80, 'feature', { promotion: n }), 30), promoteScript, { script: 1, days: 30 }))?.requests });
  });
});

describe('a pitch', () => {
  it('sells a third of the time for a script at the market level and a middling meeting, more for better, 88% at best', () => {
    expect(MARKET_SHARE).toBeCloseTo(112 / 338, 12);
    expect(MARKET_LEVEL).toBe(75);
    expect(saleChance(75, 50)).toBeCloseTo(112 / 338, 12);
    expect(saleChance(100, 100)).toBeCloseTo((112 / 338) * (100 / 75) ** 2 * 1.5, 12);
    expect(saleChance(50, 50)).toBeCloseTo((112 / 338) * (50 / 75) ** 2, 12);
    expect(saleChance(75, 0)).toBeCloseTo((112 / 338) * 0.5, 12);
    expect(saleChance(0, 100)).toBe(0);
    const w = v(made(60, { pitching: 90 }));
    expect(pitchSkill(w, { ...emptyOut, documents: { 'pitch-document': 70, logline: 100 } })).toBeCloseTo(0.5 * of(w, 'pitching') + 0.2 * of(w, 'speaking') + 0.2 * of(w, 'persuasion') + 0.1 * 70, 10);
  });

  it('sells by the meeting draw on each script, a dozen over, and grows Pitching, Speaking and Persuasion', () => {
    let l = made(65);
    for (let i = 0; i < 12; i += 1) l = dispatch(l, writeScript, { form: 'episode', days: 200 });
    l = withCareer(l, { out: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), { documents: { 'pitch-document': 50 }, requests: 1, sold: null }])) });
    const before = v(l);
    for (let id = 1; id <= 12; id += 1) {
      const chance = saleChance(quality(script(l, id)), pitchSkill(v(l), out(l, id) as Out));
      const sold = u('pitch', id, 0, 0).float() < chance;
      l = dispatch(l, pitchScript, { script: id });
      expect(out(l, id)?.sold !== null, String(id)).toBe(sold);
      expect(out(l, id)?.requests).toBe(0);
    }
    expect(v(l)['pitching']).toBeCloseTo(grown(before['pitching'] as number, 12), 8);
  });

  it("pays the WGA's minimum for the form, takes the script off the market and leaves the buyer a contact", () => {
    expect(FEES.feature).toEqual({ currency: 'USD', minor: 17_321_500 });
    expect(FEES.pilot).toEqual({ currency: 'USD', minor: 7_119_000 });
    expect(FEES.episode).toEqual({ currency: 'USD', minor: 4_746_000 });
    expect(FEES.short).toBeNull();
    const sold = dispatch(requested(withScript(100, 'short'), 2, { 'pitch-document': 100 }), pitchScript, { script: 1 });
    expect(out(sold)?.sold).toEqual({ at: 0, fee: null });
    expect(sold.slices.career.contacts).toBe(1);
    expect(() => dispatch(sold, pitchScript, { script: 1 })).toThrow('script 1 is sold');
    expect(() => dispatch(sold, promoteScript, { script: 1, days: 3 })).toThrow('script 1 is sold');
    expect(() => dispatch(sold, summariseScript, { script: 1, document: 'logline', days: 3 })).toThrow('script 1 is sold');
    expect(() => dispatch(withScript(100), pitchScript, { script: 1 })).toThrow('no one has asked to read script 1');
  });

  it('script.pitch: a better script sells where a weak one does not', () => {
    const sales = (n: number) => {
      let l = made(n);
      for (let i = 0; i < 12; i += 1) l = dispatch(l, writeScript, { form: 'episode', days: 200 });
      l = withCareer(l, { out: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), { documents: { 'pitch-document': 100 }, requests: 1, sold: null }])) });
      for (let id = 1; id <= 12; id += 1) l = dispatch(l, pitchScript, { script: id });
      return Object.values(l.slices.career.out).filter((o) => o.sold !== null).length;
    };
    falsifyAny({ feature: 'script.pitch', claim: 'bites', says: 'a writer at 100 sells more of a dozen scripts on a pitch than one at 5', base: 5, twin: 100, outcome: sales });
  });
});

describe('the solo writer', () => {
  it('works alone, with no room, run through the frame, each command declaring what it reads and writes', () => {
    expect(commandIndex().filter((x) => x.id.startsWith('room.'))).toEqual([]);
    expect(CAREER_START).toEqual({ contacts: 0, out: {} });
    expect(commandIndex().filter((x) => ['script.summarise', 'network.meet', 'script.promote', 'script.pitch'].includes(x.id))).toEqual([
      { id: 'script.summarise', reads: ['scripts'], writes: ['attributes', 'career'] },
      { id: 'network.meet', reads: [], writes: ['attributes', 'career'] },
      { id: 'script.promote', reads: ['scripts'], writes: ['attributes', 'career'] },
      { id: 'script.pitch', reads: ['scripts'], writes: ['attributes', 'career'] },
    ]);
  });
});
