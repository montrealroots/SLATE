import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCountry, compileGroup, GROUPS, named, OUTPUT, readWork, RIGHTS, rule, serialize, SOURCES } from '../../tools/papers/work/compile.ts';
import { COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD, workCoverage } from '../../tools/papers/work/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('the work rules compile', () => {
  it("takes a rule to a right, or to a permit's route and the days a short engagement is worked without it", () => {
    expect([SOURCES, GROUPS, OUTPUT]).toEqual(['research/sources/papers/work', 'research/sources/papers/work/groups', 'src/papers/work/work.json']);
    expect(RIGHTS).toEqual(['free', 'permit']);
    expect(rule({ right: 'free' }, 'r')).toStrictEqual({ right: 'free' });
    expect(rule({ right: 'permit', route: 'O-1' }, 'r')).toStrictEqual({ right: 'permit', route: 'O-1' });
    expect(rule({ right: 'permit', route: 'R', days: 30 }, 'r')).toStrictEqual({ right: 'permit', route: 'R', days: 30 });
    expect(rule({ right: 'permit', route: 'R', days: 90, within: 365 }, 'r')).toStrictEqual({ right: 'permit', route: 'R', days: 90, within: 365 });
    expect(rule({ right: 'permit', route: 'R', days: 1, within: 2 }, 'r')).toStrictEqual({ right: 'permit', route: 'R', days: 1, within: 2 });
  });

  it('refuses a rule that is not one', () => {
    for (const r of [null, 'free', 7]) expect(() => rule(r, 'r'), String(r)).toThrow('r is not an object');
    for (const right of ['none', undefined, 'Free']) expect(() => rule({ right }, 'r'), String(right)).toThrow(`r is free or a permit, not ${String(right)}`);
    for (const extra of [{ route: 'R' }, { days: 30 }, { within: 60 }]) expect(() => rule({ right: 'free', ...extra }, 'r'), JSON.stringify(extra)).toThrow('r is free, so it names no route and no days');
    for (const route of [undefined, '', ' R', 'R ', 7]) expect(() => rule({ right: 'permit', route }, 'r'), String(route)).toThrow('r names the route a performer takes');
    for (const days of [0, -1, 2.5, '90', null]) expect(() => rule({ right: 'permit', route: 'R', days }, 'r'), String(days)).toThrow("r's days are a whole number above 0");
    for (const within of [90, 89, 180.5, '180', null]) expect(() => rule({ right: 'permit', route: 'R', days: 90, within }, 'r'), String(within)).toThrow("r's days are counted within a whole number of days above them");
    expect(() => rule({ right: 'permit', route: 'R', within: 180 }, 'r')).toThrow("r's days are counted within a whole number of days above them");
  });

  it('takes rules to the rule for each passport they name', () => {
    expect(named([{ right: 'free', passports: ['DE', 'FR'] }, { right: 'permit', route: 'R', passports: ['US'] }], 'L')).toStrictEqual({ DE: { right: 'free' }, FR: { right: 'free' }, US: { right: 'permit', route: 'R' } });
    expect(named([], 'L')).toStrictEqual({});
    for (const rules of [undefined, {}, 'x']) expect(() => named(rules, 'L'), String(rules)).toThrow('L has no rules');
    for (const r of [null, { right: 'free' }, { right: 'free', passports: [] }, { right: 'free', passports: 'DE' }]) {
      expect(() => named([r], 'L'), JSON.stringify(r)).toThrow("L's rule 0 names no passports");
    }
    for (const p of ['XX', 7]) expect(() => named([{ right: 'free', passports: ['DE'] }, { right: 'free', passports: [p] }], 'L')).toThrow(`L's rule 1 names a passport of no country on the map (${String(p)})`);
    expect(() => named([{ right: 'free', passports: ['DE'] }, { right: 'free', passports: ['FR', 'DE'] }], 'L')).toThrow("L names DE's passport twice");
    expect(() => named([{ right: 'nothing', passports: ['DE'] }], 'L')).toThrow("L's rule 0 is free or a permit, not nothing");
  });

  it('takes a shared list to its passports, and its rule for every other where it gives one', () => {
    expect(compileGroup({ rules: [{ right: 'free', passports: ['FR'] }] }, 'G')).toStrictEqual({ passports: { FR: { right: 'free' } } });
    expect(compileGroup({ rules: [], others: { right: 'permit', route: 'O-1' } }, 'G')).toStrictEqual({ passports: {}, others: { right: 'permit', route: 'O-1' } });
    expect(() => compileGroup({ others: { right: 'free' } }, 'G')).toThrow('G has no rules');
    expect(() => compileGroup({ rules: [], others: 'x' }, 'G')).toThrow("G's others is not an object");
  });

  it('takes a country to every passport named, its own or the shared list it keeps, and the rule for every other', () => {
    const groups = new Map([
      ['eea', { passports: { FR: { right: 'free' as const } } }],
      ['us', { passports: { PW: { right: 'free' as const } }, others: { right: 'permit' as const, route: 'O-1' } }],
    ]);
    const others = { right: 'permit', route: 'R' };
    expect(compileCountry('DE', { country: 'DE', group: 'eea', others, note: 'x', sources: [] }, groups)).toStrictEqual({ group: 'eea', passports: { FR: { right: 'free' } }, others });
    expect(compileCountry('DE', { country: 'DE', group: 'eea', rules: [{ right: 'free', passports: ['CH'] }], others }, groups)).toStrictEqual({ group: 'eea', passports: { FR: { right: 'free' }, CH: { right: 'free' } }, others });
    // A shared list's rule for every other, unless the country gives its own.
    expect(compileCountry('GU', { country: 'GU', group: 'us' }, groups)).toStrictEqual({ group: 'us', passports: { PW: { right: 'free' } }, others: { right: 'permit', route: 'O-1' } });
    expect(compileCountry('GU', { country: 'GU', group: 'us', others }, groups)).toStrictEqual({ group: 'us', passports: { PW: { right: 'free' } }, others });
    expect(compileCountry('US', { country: 'US', rules: [{ right: 'free', passports: ['PW'] }], others }, groups)).toStrictEqual({ passports: { PW: { right: 'free' } }, others });
    expect(compileCountry('JP', { country: 'JP', others }, groups)).toStrictEqual({ passports: {}, others });
    expect(() => compileCountry('XX', { country: 'XX', others }, groups)).toThrow('XX is not a country on the map');
    expect(() => compileCountry('DE', { country: 'FR', others }, groups)).toThrow("DE's file is for FR");
    expect(() => compileCountry('DE', { country: 'DE', group: 'ch', others }, groups)).toThrow("DE keeps a shared list the game doesn't keep (ch)");
    expect(() => compileCountry('DE', { country: 'DE', group: 'eea' }, groups)).toThrow('DE keeps the eea list, which gives no rule for other passports, and gives none of its own');
    expect(() => compileCountry('DE', { country: 'DE', group: 'eea', others: 'x' }, groups)).toThrow("DE's others is not an object");
    expect(() => compileCountry('JP', { country: 'JP' }, groups)).toThrow("JP's others is not an object");
    expect(() => compileCountry('DE', { country: 'DE', group: 'eea', rules: [{ right: 'free', passports: ['FR'] }], others }, groups)).toThrow("DE names FR's passport, which the eea list already names");
    expect(() => compileCountry('DE', { country: 'DE', rules: 'x', others }, groups)).toThrow('DE has no rules');
  });

  it('reads only files the register cites, as cited', () => {
    const root = mkdtempSync(join(tmpdir(), 'work-'));
    mkdirSync(join(root, GROUPS), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const write = (path: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, path), text);
      return createHash('sha256').update(text).digest('hex');
    };
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    const cite = (fact: string, file: string, sha256: string) => ({ fact: `papers.work.${fact}`, value: { file, sha256 } });
    const others = { right: 'permit', route: 'R' };
    const eea = write(`${GROUPS}/eea.json`, { group: 'eea', rules: [{ right: 'free', passports: ['FR'] }] });
    // Written out of order: the files are read in the order of their names.
    const fr = write(`${SOURCES}/FR.json`, { country: 'FR', group: 'eea', others });
    const de = write(`${SOURCES}/DE.json`, { country: 'DE', group: 'eea', rules: [{ right: 'free', passports: ['CH'] }], others });
    const jp = write(`${SOURCES}/JP.json`, { country: 'JP', others });
    write(`${SOURCES}/notes.txt`, 'not a file');
    const all = [cite('group.eea', `${GROUPS}/eea.json`, eea), cite('FR', `${SOURCES}/FR.json`, fr), cite('DE', `${SOURCES}/DE.json`, de), cite('JP', `${SOURCES}/JP.json`, jp)];
    register([...all, { fact: 'papers.work.blocked.KP' }, { fact: 'papers.visits.FR', value: { file: `${SOURCES}/FR.json`, sha256: 'other' } }]);
    const work = readWork(root);
    expect(Object.keys(work.countries)).toEqual(['DE', 'FR', 'JP']);
    expect(work).toStrictEqual({
      groups: { eea: { passports: { FR: { right: 'free' } } } },
      countries: { DE: { group: 'eea', passports: { FR: { right: 'free' }, CH: { right: 'free' } }, others }, FR: { group: 'eea', passports: { FR: { right: 'free' } }, others }, JP: { passports: {}, others } },
    });
    register([cite('group.eea', `${GROUPS}/eea.json`, eea.replace(/^./, (c) => (c === '0' ? '1' : '0'))), ...all.slice(1)]);
    expect(() => readWork(root)).toThrow(`${GROUPS}/eea.json isn't the file the register cites`);
    register(all.slice(1));
    expect(() => readWork(root)).toThrow(`${GROUPS}/eea.json isn't cited by the register`);
    const eea2 = write(`${GROUPS}/eea.json`, { group: 'us', rules: [] });
    register([cite('group.eea', `${GROUPS}/eea.json`, eea2), ...all.slice(1)]);
    expect(() => readWork(root)).toThrow(`${GROUPS}/eea.json is for us`);
    const eea4 = write(`${GROUPS}/eea.json`, { group: 'eea' });
    register([cite('group.eea', `${GROUPS}/eea.json`, eea4), ...all.slice(1)]);
    expect(() => readWork(root)).toThrow('the eea list has no rules');
    expect(serialize({ groups: {}, countries: { JP: { passports: {}, others: { right: 'free' } } } })).toBe('{\n "groups": {},\n "countries": {\n  "JP": {\n   "passports": {},\n   "others": {\n    "right": "free"\n   }\n  }\n }\n}\n');
  });

  it('reads no shared lists where there are none', () => {
    const root = mkdtempSync(join(tmpdir(), 'work-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const text = JSON.stringify({ country: 'JP', others: { right: 'free' } });
    writeFileSync(join(root, SOURCES, 'JP.json'), text);
    const sha256 = createHash('sha256').update(text).digest('hex');
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.work.JP', value: { file: `${SOURCES}/JP.json`, sha256 } }] }));
    expect(readWork(root)).toStrictEqual({ groups: {}, countries: { JP: { passports: {}, others: { right: 'free' } } } });
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readWork(ROOT)));
  });
});

describe('the work rules coverage', () => {
  it('is researched where compiled and cited with the list it shares, blocked where the register holds a blocker, proven where no one lives', () => {
    const facts = new Map([['papers.work.JP', 'R-1'], ['papers.work.FR', 'R-2'], ['papers.work.group.eea', 'R-3'], ['papers.work.blocked.KP', 'R-4'], ['papers.work.DE', 'R-5'], ['papers.work.blocked.DE', 'R-6']]);
    const compiled = new Map<string, string | null>([['JP', null], ['FR', 'eea'], ['DE', 'us'], ['CZ', null]]);
    const rows = workCoverage(['JP', 'FR', 'KP', 'IT', 'AQ', 'DE', 'CZ'], new Set(['JP', 'FR', 'KP', 'IT', 'DE', 'CZ']), compiled, facts);
    expect(rows).toEqual([
      { key: 'JP', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'researched', register: ['R-2', 'R-3'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'IT', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // The list it shares isn't cited: not researched.
      { key: 'DE', status: 'blocked', register: ['R-6'], tests: [...TESTS, TOLD] },
      // Compiled but not cited: not researched.
      { key: 'CZ', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/papers/work/work.test.ts::work > ask each country's own, or the list it shares, of each passport", 'tests/papers/work/work.places.test.ts::work > for every place on the map']);
    expect(TOLD).toBe("tests/papers/work/work.test.ts::work > tell the player what the game doesn't know");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.work', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/work-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
