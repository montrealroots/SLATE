import { describe, expect, it } from 'vitest';
import { begin, dispatch } from '../../../src/core/frame/frame.ts';
import { ATTRIBUTES, ATTRIBUTES_START, attributeOf, broadOf, chooseAttributes, chosen, componentOf, componentValues, DAILY, facetSkill, label, MAX, practise, ROLES, shown, skillOf, valuesOf } from '../../../src/person/attributes/attributes.ts';
import map from '../../../workbench/plans/attribute-map.json';
import facetResearch from '../../../research/sources/person/attributes/screenwriter-facets.json';
import research from '../../../research/sources/person/attributes/screenwriter.json';
import producerFacets from '../../../research/sources/person/attributes/producer-facets.json';
import directorFacets from '../../../research/sources/person/attributes/director-facets.json';
import actorFacets from '../../../research/sources/person/attributes/actor-facets.json';
import { falsifyAny } from '../../support/falsify-core.ts';

const ids = ATTRIBUTES.screenwriter.map((a) => a.id);
const components = ATTRIBUTES.screenwriter.flatMap((a) => a.covers.map((c) => c.id));
const life = () => begin('0123456789abcdef', 0, { attributes: structuredClone(ATTRIBUTES_START) });

describe('the screenwriter attributes', () => {
  it("are the owner's seven broad attributes, covering the 27 researched ones as the map says", () => {
    expect(ROLES).toEqual(['screenwriter', 'producer', 'director', 'actor']);
    expect(ids).toEqual(['story', 'characters', 'voice', 'writing', 'revision', 'discipline', 'pitching']);
    expect(ATTRIBUTES.screenwriter.map((a) => a.name)).toEqual(['Story', 'Characters', 'Voice', 'Writing', 'Revision', 'Discipline', 'Pitching']);
    expect(ATTRIBUTES.screenwriter.map((a) => [a.id, a.name, a.covers.map((c) => c.id)])).toEqual(map.roles.screenwriter.map((g) => [g.id, g.name, g.covers]));
    expect(components).toHaveLength(27);
    expect(new Set(components).size).toBe(27);
    expect(attributeOf('screenwriter', 'story').definition).toBe('Plot, structure, premise, theme and setting.');
    expect(broadOf('screenwriter', 'dialogue').id).toBe('characters');
    expect(componentOf('screenwriter', 'dialogue').name).toBe('Dialogue');
    expect(() => attributeOf('screenwriter', 'stamina')).toThrow('screenwriter has no attribute stamina');
    expect(() => attributeOf('stuntman' as 'screenwriter', 'stamina')).toThrow('stuntman has no attribute stamina');
    expect(() => broadOf('screenwriter', 'stamina')).toThrow('screenwriter has no component stamina');
    expect(() => broadOf('stuntman' as 'screenwriter', 'dialogue')).toThrow('stuntman has no component dialogue');
  });

  it("give the producer, the director and the actor the owner's map, each component and facet as its research has it", () => {
    expect(ATTRIBUTES.producer.map((a) => a.name)).toEqual(['Development', 'Financing', 'Production', 'Leadership', 'Dealmaking', 'Marketing']);
    expect(ATTRIBUTES.director.map((a) => a.name)).toEqual(['Vision', 'Working With Actors', 'Visual Craft', 'Editing', 'Script Sense', 'Leadership', 'Communication']);
    expect(ATTRIBUTES.actor.map((a) => a.name)).toEqual(['Acting', 'Memorization', 'Voice', 'Physicality', 'Camera', 'Direction', 'Auditioning']);
    for (const [role, research] of [['producer', producerFacets], ['director', directorFacets], ['actor', actorFacets]] as const) {
      expect(ATTRIBUTES[role].map((a) => [a.id, a.name, a.covers.map((c) => c.research)]), role).toEqual(map.roles[role].map((g) => [g.id, g.name, g.covers]));
      const ids = new Map(research.attributes.map((x) => [x.name, x.attribute]));
      for (const c of ATTRIBUTES[role].flatMap((a) => a.covers)) {
        const r = research.attributes.find((x) => x.name === c.research);
        expect(c.id, c.research).toBe(r?.attribute);
        expect(c.definition).toBe(r?.definition);
        expect(c.facets.map((f) => [f.id, f.name, f.meaning, f.judges])).toEqual(r?.facets.map((f) => [f.id, f.name, f.meaning, [...new Set(f.readBy.map((x) => x.reader))].sort()]));
        for (const [i, f] of c.facets.entries()) expect(f.draws, `${role} ${c.id} ${f.id}`).toEqual([...new Set((r?.facets[i]?.alsoDrawsOn ?? []).map((x) => ids.get(x.attribute)).filter((x) => x !== undefined && x !== c.id))].sort());
      }
    }
  });

  it('cover components each a research group named by at least four institutions', () => {
    // An institution is its registrable name: example.org, example.gov.au (a source's many pages count once).
    const host = (u: string) => {
      const parts = new URL(u).hostname.split('.');
      return parts.slice(['co', 'com', 'gov', 'org', 'ac', 'edu', 'gc'].includes(parts.at(-2) ?? '') ? -3 : -2).join('.');
    };
    for (const c of ATTRIBUTES.screenwriter.flatMap((a) => a.covers)) {
      const group = research.attributes.find((g) => g.name === c.research);
      expect(group, c.research).toBeDefined();
      const institutions = new Set((group?.terms ?? []).flatMap((t) => t.sources.map((s) => host(research.sources[s.src]?.url ?? ''))));
      expect(institutions.size, c.name).toBeGreaterThanOrEqual(4);
    }
  });

  it('read as a whole number, rounded down, beside the name', () => {
    expect(label('screenwriter', 'story', 92)).toBe('Story - 92');
    expect(label('screenwriter', 'pitching', 99.99)).toBe('Pitching - 99');
    expect(shown(100)).toBe(100);
    expect(shown(0.5)).toBe(0);
  });

  it('are chosen when the life is made: all at one level, each its own, or levels over one', () => {
    const all = chosen({ role: 'screenwriter', all: 100 });
    expect(Object.keys(all)).toEqual(ids);
    expect(Object.values(all).every((v) => v === MAX)).toBe(true);
    const mixed = chosen({ role: 'screenwriter', all: 40, each: { characters: 92, story: 0 } });
    expect(mixed).toEqual({ story: 0, characters: 92, voice: 40, writing: 40, revision: 40, discipline: 40, pitching: 40 });
    const each = Object.fromEntries(ids.map((id, i) => [id, i]));
    expect(chosen({ role: 'screenwriter', each })).toEqual(each);
  });

  it("give each component its broad attribute's level", () => {
    const s = { screenwriter: chosen({ role: 'screenwriter', all: 40, each: { characters: 92 } }) };
    const c = componentValues(s, 'screenwriter');
    expect(Object.keys(c)).toEqual(components);
    expect(c['dialogue']).toBe(92);
    expect(c['characters']).toBe(92);
    expect(c['plot']).toBe(40);
  });

  it('are refused outside 0 to 100, for a role or attribute there is not, or with one left without a level', () => {
    expect(() => chosen({ role: 'screenwriter', all: 101 })).toThrow('Story is a whole number from 0 to 100');
    expect(() => chosen({ role: 'screenwriter', all: -1 })).toThrow(RangeError);
    expect(() => chosen({ role: 'screenwriter', all: 50.5 })).toThrow(RangeError);
    expect(() => chosen({ role: 'screenwriter', each: { characters: 50 } })).toThrow('Story needs a level');
    expect(() => chosen({ role: 'screenwriter', all: 50, each: { dialogue: 50 } })).toThrow('screenwriter has no attribute dialogue');
    expect(() => chosen({ role: 'stuntman', all: 50 })).toThrow("there's no role stuntman");
    expect(() => valuesOf(ATTRIBUTES_START, 'screenwriter')).toThrow("the screenwriter's attributes haven't been chosen");
  });

  it('rise with each day of work, once per broad attribute, faster from low, never past 100: twenty years of daily work take a writer from 10 to 80', () => {
    expect(DAILY).toBeCloseTo(1 - (20 / 90) ** (1 / 7300), 15);
    const s = { screenwriter: { story: 50, characters: 10, voice: 100, writing: 90, revision: 0, discipline: 0, pitching: 0 } };
    practise(s, 'screenwriter', ['dialogue'], 20 * 365);
    expect(s.screenwriter.characters).toBeCloseTo(80, 8);
    practise(s, 'screenwriter', ['plot', 'structure', 'distinctive-voice', 'writing'], 30);
    expect(s.screenwriter.story).toBeCloseTo(100 - 50 * (1 - DAILY) ** 30, 10);
    expect(s.screenwriter.voice).toBe(100);
    expect(s.screenwriter.writing).toBeCloseTo(100 - 10 * (1 - DAILY) ** 30, 10);
    const before = s.screenwriter.story;
    practise(s, 'screenwriter', ['plot'], -5);
    expect(s.screenwriter.story).toBe(before);
    expect(s.screenwriter.revision).toBe(0);
    expect(() => practise(s, 'screenwriter', ['stamina'], 1)).toThrow('screenwriter has no component stamina');
  });

  it("carry the sources' definitions and facets in their components, each facet with its ties and the readers that grade it", () => {
    // The owner, 2026-11-01: the writer works alone, so the facets that are writers'-room or running-show work are left out.
    const SOLO: Record<string, string[]> = { pitching: ['staffing-pitch', 'pitching-in-the-room'], speaking: ['speaking-up-in-the-room'], 'social-perceptiveness': ['reading-the-room', 'reading-the-showrunner'], research: ['storyline-research'] };
    for (const a of ATTRIBUTES.screenwriter.flatMap((x) => x.covers)) {
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
    expect(ATTRIBUTES.screenwriter.flatMap((a) => a.covers).reduce((t, a) => t + a.facets.length, 0)).toBe(158);
    expect(Object.values(SOLO).flat()).toHaveLength(6);
    expect(componentOf('screenwriter', 'dialogue').definition).toBe('The words characters speak: natural and believable, in a voice each character owns, saying little, showing who they are and moving the story.');
  });

  it('act through their facets: a facet a source ties to other components draws on them for a quarter', () => {
    const pitching = componentOf('screenwriter', 'pitching');
    const tied = pitching.facets.find((f) => f.draws.length > 0);
    const plain = pitching.facets.find((f) => f.draws.length === 0);
    const v = { ...componentValues({ screenwriter: chosen({ role: 'screenwriter', all: 40 }) }, 'screenwriter'), pitching: 80 };
    expect(facetSkill(v, plain!, 'pitching')).toBe(80); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(facetSkill(v, tied!, 'pitching')).toBeCloseTo(0.75 * 80 + 0.25 * 40, 10); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(skillOf(v, 'screenwriter', 'pitching')).toBeCloseTo(pitching.facets.reduce((t, f) => t + facetSkill(v, f, 'pitching'), 0) / pitching.facets.length, 10);
    expect(skillOf(componentValues({ screenwriter: chosen({ role: 'screenwriter', all: 100 }) }, 'screenwriter'), 'screenwriter', 'pitching')).toBe(100);
  });

  it('attributes.choose: the level chosen is the level held', () => {
    expect(dispatch(life(), chooseAttributes, { role: 'screenwriter', all: 100 }).slices.attributes['screenwriter']?.['story']).toBe(100);
    falsifyAny({ feature: 'attributes.choose', claim: 'bites', says: 'choosing a higher level holds it', base: 40, twin: 90, outcome: (n) => dispatch(life(), chooseAttributes, { role: 'screenwriter', all: n }).slices.attributes['screenwriter']?.['story'] });
  });
});
