import { describe, expect, it } from 'vitest';
import { begin, dispatch } from '../../../src/core/frame/frame.ts';
import { ATTRIBUTES, ATTRIBUTES_START, attributeOf, chooseAttributes, chosen, DAILY, facetSkill, label, MAX, practise, ROLES, shown, skillOf, valuesOf } from '../../../src/person/attributes/attributes.ts';
import facetResearch from '../../../research/sources/person/attributes/screenwriter-facets.json';
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

  it('rise with each day of work, faster from low, never past 100: twenty years of daily work take a writer from 10 to 80', () => {
    expect(DAILY).toBeCloseTo(1 - (20 / 90) ** (1 / 7300), 15);
    const v: Record<string, number> = { dialogue: 10, plot: 50, characters: 100, theme: 90 };
    practise(v, ['dialogue'], 20 * 365);
    expect(v['dialogue']).toBeCloseTo(80, 8);
    practise(v, ['plot', 'characters', 'theme'], 30);
    expect(v['plot']).toBeCloseTo(100 - 50 * (1 - DAILY) ** 30, 10);
    expect(v['characters']).toBe(100);
    expect(v['theme']).toBeCloseTo(100 - 10 * (1 - DAILY) ** 30, 10);
    const before = v['plot'];
    practise(v, ['plot'], -5);
    expect(v['plot']).toBe(before);
    expect(() => practise(v, ['stamina'], 1)).toThrow("there's no attribute stamina to raise");
  });

  it("carry the sources' definitions and facets, each facet with its ties and the readers that grade it", () => {
    // The owner, 2026-11-01: the writer works alone, so the facets that are writers'-room or running-show work are left out.
    const SOLO: Record<string, string[]> = { pitching: ['staffing-pitch', 'pitching-in-the-room'], speaking: ['speaking-up-in-the-room'], 'social-perceptiveness': ['reading-the-room', 'reading-the-showrunner'], research: ['storyline-research'] };
    for (const a of ATTRIBUTES.screenwriter) {
      const r = facetResearch.attributes.find((x) => x.attribute === a.id);
      expect(r, a.id).toBeDefined();
      expect(a.definition).toBe(r?.definition);
      const kept = r?.facets.filter((f) => !(SOLO[a.id] ?? []).includes(f.id));
      expect(a.facets.map((f) => [f.id, f.name, f.meaning])).toEqual(kept?.map((f) => [f.id, f.name, f.meaning]));
      for (const [i, f] of a.facets.entries()) {
        const rf = kept?.[i];
        expect(f.draws, `${a.id} ${f.id}`).toEqual([...new Set(rf?.alsoDrawsOn.map((x) => x.attribute))].sort());
        expect(f.readers, `${a.id} ${f.id}`).toEqual([...new Set(rf?.readBy.flatMap((x) => (x.game === null ? [] : [x.game])))].sort());
      }
    }
    expect(ATTRIBUTES.screenwriter.reduce((t, a) => t + a.facets.length, 0)).toBe(158);
    expect(Object.values(SOLO).flat()).toHaveLength(6);
    expect(attributeOf('screenwriter', 'dialogue').definition).toBe('The words characters speak: natural and believable, in a voice each character owns, saying little, showing who they are and moving the story.');
  });

  it('act through their facets: a facet a source ties to other attributes draws on them for a quarter', () => {
    const pitching = attributeOf('screenwriter', 'pitching');
    const tied = pitching.facets.find((f) => f.draws.length > 0);
    const plain = pitching.facets.find((f) => f.draws.length === 0);
    const v = { ...chosen({ role: 'screenwriter', all: 40 }), pitching: 80 };
    expect(facetSkill(v, plain!, 'pitching')).toBe(80); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(facetSkill(v, tied!, 'pitching')).toBeCloseTo(0.75 * 80 + 0.25 * 40, 10); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(skillOf(v, 'screenwriter', 'pitching')).toBeCloseTo(pitching.facets.reduce((t, f) => t + facetSkill(v, f, 'pitching'), 0) / pitching.facets.length, 10);
    expect(skillOf(chosen({ role: 'screenwriter', all: 100 }), 'screenwriter', 'pitching')).toBe(100);
  });

  it('attributes.choose: the level chosen is the level held', () => {
    expect(dispatch(life(), chooseAttributes, { role: 'screenwriter', all: 100 }).slices.attributes['screenwriter']?.['dialogue']).toBe(100);
    falsifyAny({ feature: 'attributes.choose', claim: 'bites', says: 'choosing a higher level holds it', base: 40, twin: 90, outcome: (n) => dispatch(life(), chooseAttributes, { role: 'screenwriter', all: n }).slices.attributes['screenwriter']?.['dialogue'] });
  });
});
