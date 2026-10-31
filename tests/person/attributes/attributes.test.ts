import { describe, expect, it } from 'vitest';
import { begin, dispatch } from '../../../src/core/frame/frame.ts';
import { ATTRIBUTES, ATTRIBUTES_START, attributeOf, chooseAttributes, chosen, label, MAX, practise, RATE, ROLES, shown, valuesOf } from '../../../src/person/attributes/attributes.ts';
import research from '../../../research/sources/person/attributes/screenwriter.json';
import { falsifyAny } from '../../support/falsify-core.ts';

const ids = ATTRIBUTES.screenwriter.map((a) => a.id);
const life = () => begin('0123456789abcdef', 0, { attributes: structuredClone(ATTRIBUTES_START) });

describe('the screenwriter attributes', () => {
  it('are the 27 the plan keeps, each a research group named by at least four institutions', () => {
    expect(ROLES).toEqual(['screenwriter']);
    expect(ids).toHaveLength(27);
    expect(new Set(ids).size).toBe(27);
    // An institution is its registrable name: example.org, example.gov.au (a source's many pages count once).
    const host = (u: string) => {
      const parts = new URL(u).hostname.split('.');
      return parts.slice(['co', 'com', 'gov', 'org', 'ac', 'edu', 'gc'].includes(parts.at(-2) ?? '') ? -3 : -2).join('.');
    };
    for (const a of ATTRIBUTES.screenwriter) {
      const group = research.attributes.find((g) => g.name === a.research);
      expect(group, a.research).toBeDefined();
      const institutions = new Set((group?.terms ?? []).flatMap((t) => t.sources.map((s) => host(research.sources[s.src]?.url ?? ''))));
      expect(institutions.size, a.name).toBeGreaterThanOrEqual(4);
    }
    expect(attributeOf('screenwriter', 'dialogue').name).toBe('Dialogue');
    expect(() => attributeOf('screenwriter', 'stamina')).toThrow('screenwriter has no attribute stamina');
    expect(() => attributeOf('stuntman' as 'screenwriter', 'stamina')).toThrow('stuntman has no attribute stamina');
  });

  it('read as a whole number, rounded down, beside the name', () => {
    expect(label('screenwriter', 'dialogue', 92)).toBe('Dialogue - 92');
    expect(label('screenwriter', 'film-production-process', 99.99)).toBe('Film Production Process - 99');
    expect(shown(100)).toBe(100);
    expect(shown(0.5)).toBe(0);
  });

  it('are chosen when the life is made: all at one level, each its own, or levels over one', () => {
    const all = chosen({ role: 'screenwriter', all: 100 });
    expect(Object.keys(all)).toEqual(ids);
    expect(Object.values(all).every((v) => v === MAX)).toBe(true);
    const mixed = chosen({ role: 'screenwriter', all: 40, each: { dialogue: 92, plot: 0 } });
    expect(mixed['dialogue']).toBe(92);
    expect(mixed['plot']).toBe(0);
    expect(mixed['characters']).toBe(40);
    const each = Object.fromEntries(ids.map((id, i) => [id, i]));
    expect(chosen({ role: 'screenwriter', each })).toEqual(each);
  });

  it('are refused outside 0 to 100, for a role or attribute there is not, or with one left without a level', () => {
    expect(() => chosen({ role: 'screenwriter', all: 101 })).toThrow('Characters is a whole number from 0 to 100');
    expect(() => chosen({ role: 'screenwriter', all: -1 })).toThrow(RangeError);
    expect(() => chosen({ role: 'screenwriter', all: 50.5 })).toThrow(RangeError);
    expect(() => chosen({ role: 'screenwriter', each: { dialogue: 50 } })).toThrow('Characters needs a level');
    expect(() => chosen({ role: 'screenwriter', all: 50, each: { stamina: 50 } })).toThrow('screenwriter has no attribute stamina');
    expect(() => chosen({ role: 'stuntman', all: 50 })).toThrow("there's no role stuntman");
    expect(() => valuesOf(ATTRIBUTES_START, 'screenwriter')).toThrow("the screenwriter's attributes haven't been chosen");
  });

  it('rise with work, faster from low, never past 100', () => {
    const v: Record<string, number> = { dialogue: 0, plot: 50, characters: 100, theme: 90 };
    practise(v, { dialogue: 1, plot: 1, characters: 1, theme: 0.5 });
    expect(v['dialogue']).toBe(RATE);
    expect(v['plot']).toBe(50 + RATE / 2);
    expect(v['characters']).toBe(100);
    expect(v['theme']).toBeCloseTo(90 + RATE * 0.5 * 0.1, 10);
    practise(v, { dialogue: -1 });
    expect(v['dialogue']).toBe(RATE);
    const near: Record<string, number> = { dialogue: 99.9 };
    practise(near, { dialogue: 100 });
    expect(near['dialogue']).toBe(100);
    expect(() => practise(v, { stamina: 1 })).toThrow("there's no attribute stamina to raise");
  });

  it('attributes.choose: the level chosen is the level held', () => {
    expect(dispatch(life(), chooseAttributes, { role: 'screenwriter', all: 100 }).slices.attributes['screenwriter']?.['dialogue']).toBe(100);
    falsifyAny({ feature: 'attributes.choose', claim: 'bites', says: 'choosing a higher level holds it', base: 40, twin: 90, outcome: (n) => dispatch(life(), chooseAttributes, { role: 'screenwriter', all: n }).slices.attributes['screenwriter']?.['dialogue'] });
  });
});
