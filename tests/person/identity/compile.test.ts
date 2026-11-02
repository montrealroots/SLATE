import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile, OUTPUT, readResearch, serialize, SOURCE } from '../../../tools/person/identity/compile.ts';

const ROOT = resolve(import.meta.dirname, '../../..');

type Research = Parameters<typeof compile>[0];
const research = (territories: Research['territories'], names: Record<string, string> = { en: 'English', fr: 'French', de: 'German', und: 'Unknown language' }): Research => ({
  figures: [
    { item: 'language-names', value: { names } },
    { item: 'levels', value: { cefr: [{ level: 'A1', name: 'Breakthrough' }, { level: 'B1', name: 'Threshold' }] } },
  ],
  territories,
});

describe('the languages compile', () => {
  it("keeps each territory's languages in CLDR's order, official or not, and the names of the languages spoken", () => {
    expect([SOURCE, OUTPUT]).toEqual(['research/sources/person/identity/languages.json', 'src/person/identity/languages.json']);
    const l = compile(research({ US: [{ lang: 'fr', share: 0.56, official: null }, { lang: 'en', share: 96, official: 'de_facto_official' }], AN: null, AQ: [{ lang: 'und', share: 100, official: null }] }));
    expect(l).toStrictEqual({
      names: { en: 'English', fr: 'French' },
      territories: { US: [{ lang: 'fr', share: 0.56, official: false }, { lang: 'en', share: 96, official: true }], AQ: [] },
      levels: ['A1', 'B1'],
    });
    // The names in code order, whatever order the territories use them in.
    expect(Object.keys(l.names)).toEqual(['en', 'fr']);
  });

  it('refuses a language with no name, and research without its figures', () => {
    for (const lang of ['xx', 'constructor']) expect(() => compile(research({ GB: [{ lang, share: 1, official: null }] }))).toThrow(`GB speaks ${lang}, which has no name`);
    const [names, levels] = research({}).figures;
    expect(() => compile({ ...research({}), figures: levels === undefined ? [] : [levels] })).toThrow('the research has no language-names');
    expect(() => compile({ ...research({}), figures: names === undefined ? [] : [names] })).toThrow('the research has no levels');
  });

  it('writes one space of indent and a closing newline', () => {
    expect(serialize({ names: { en: 'English' }, territories: {}, levels: ['A1'] })).toBe('{\n "names": {\n  "en": "English"\n },\n "territories": {},\n "levels": [\n  "A1"\n ]\n}\n');
  });

  it('reads only the file the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'languages-'));
    mkdirSync(join(root, 'research'), { recursive: true });
    mkdirSync(dirname(join(root, SOURCE)), { recursive: true });
    const text = JSON.stringify(research({ US: [{ lang: 'en', share: 96, official: 'official' }] }));
    writeFileSync(join(root, SOURCE), text);
    const sha = createHash('sha256').update(text).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    register([{ fact: 'person.identity.genres' }, { fact: 'person.identity.languages', value: { file: SOURCE, sha256: sha } }]);
    expect(compile(readResearch(root)).territories).toStrictEqual({ US: [{ lang: 'en', share: 96, official: true }] });
    writeFileSync(join(root, SOURCE), `${text} `);
    expect(() => readResearch(root)).toThrow(`${SOURCE} isn't the file the register cites`);
    for (const entries of [[], [{ fact: 'person.identity.languages' }], [{ fact: 'person.identity.languages', value: { file: SOURCE } }], [{ fact: 'person.identity.casting', value: { file: SOURCE, sha256: sha } }], [{ fact: 'person.identity.languages', value: { file: 'x.json', sha256: sha } }]]) {
      register(entries);
      expect(() => readResearch(root), JSON.stringify(entries)).toThrow(`${SOURCE} isn't cited by the register`);
    }
  });

  it('is the languages the engine reads, from the research the register cites', () => {
    const l = compile(readResearch(ROOT));
    expect(serialize(l)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    // 252 territories less the dissolved two, AN and CS, that CLDR 49 doesn't list.
    expect([Object.keys(l.territories).length, 'AN' in l.territories, 'CS' in l.territories, l.territories['AQ'], l.territories['HM'], 'und' in l.names]).toEqual([250, false, false, [], [], false]);
    expect(l.levels).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});
