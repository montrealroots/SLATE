import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCountry, ENTRIES, GROUPS, list, named, OUTPUT, readVisits, rule, serialize, SOURCES } from '../../tools/papers/visits/compile.ts';
import { COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD, visitsCoverage } from '../../tools/papers/visits/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('the visitor rules compile', () => {
  it('takes a rule to its entry, and the days a stay may last within a period', () => {
    expect([SOURCES, GROUPS, OUTPUT]).toEqual(['research/sources/papers/visits', 'research/sources/papers/visits/groups', 'src/papers/visits/visits.json']);
    expect(ENTRIES).toEqual(['free', 'eta', 'evisa', 'arrival', 'visa']);
    for (const entry of ENTRIES) expect(rule({ entry }, 'r')).toStrictEqual({ entry });
    expect(rule({ entry: 'free', days: 90, within: 180 }, 'r')).toStrictEqual({ entry: 'free', days: 90, within: 180 });
    expect(rule({ entry: 'eta', days: 1, within: 2 }, 'r')).toStrictEqual({ entry: 'eta', days: 1, within: 2 });
    expect(rule({ entry: 'arrival', days: 30 }, 'r')).toStrictEqual({ entry: 'arrival', days: 30 });
    expect(rule({ entry: 'eta', months: 6 }, 'r')).toStrictEqual({ entry: 'eta', months: 6 });
    expect(rule({ entry: 'free', months: 1 }, 'r')).toStrictEqual({ entry: 'free', months: 1 });
  });

  it('refuses a rule that is not one', () => {
    for (const r of [null, 'free', 7]) expect(() => rule(r, 'r'), String(r)).toThrow('r is not an object');
    for (const entry of ['none', undefined, 'Visa']) expect(() => rule({ entry }, 'r'), String(entry)).toThrow(`r asks free, eta, evisa, arrival or visa, not ${String(entry)}`);
    for (const days of [0, -1, 2.5, '90', null]) expect(() => rule({ entry: 'free', days }, 'r'), String(days)).toThrow("r's days are a whole number above 0");
    expect(() => rule({ entry: 'visa', days: 30 }, 'r')).toThrow("r asks a visa, whose stay is the visa's, not the list's");
    expect(() => rule({ entry: 'visa', months: 3 }, 'r')).toThrow("r asks a visa, whose stay is the visa's, not the list's");
    for (const months of [0, -1, 2.5, '6', null]) expect(() => rule({ entry: 'free', months }, 'r'), String(months)).toThrow("r's months are a whole number above 0");
    for (const extra of [{ days: 90 }, { within: 180 }, { days: 90, within: 180 }]) {
      expect(() => rule({ entry: 'free', months: 6, ...extra }, 'r'), JSON.stringify(extra)).toThrow("r's stay is in days or in months, not both");
    }
    for (const within of [90, 89, 180.5, '180', null]) expect(() => rule({ entry: 'free', days: 90, within }, 'r'), String(within)).toThrow("r's days are counted within a whole number of days above them");
    expect(() => rule({ entry: 'free', within: 180 }, 'r')).toThrow("r's days are counted within a whole number of days above them");
  });

  it('takes a list to the rule for each passport it names and for every other', () => {
    const file = { rules: [{ entry: 'free', passports: ['DE', 'FR'] }, { entry: 'eta', days: 90, passports: ['US'] }], others: { entry: 'visa' } };
    expect(list(file, 'L')).toStrictEqual({ passports: { DE: { entry: 'free' }, FR: { entry: 'free' }, US: { entry: 'eta', days: 90 } }, others: { entry: 'visa' } });
    expect(named([], 'L')).toStrictEqual({});
    for (const rules of [undefined, {}, 'x']) expect(() => named(rules, 'L'), String(rules)).toThrow('L has no rules');
    for (const r of [null, { entry: 'free' }, { entry: 'free', passports: [] }, { entry: 'free', passports: 'DE' }]) {
      expect(() => named([r], 'L'), JSON.stringify(r)).toThrow("L's rule 0 names no passports");
    }
    for (const p of ['XX', 7]) expect(() => named([{ entry: 'free', passports: ['DE'] }, { entry: 'free', passports: [p] }], 'L')).toThrow(`L's rule 1 names a passport of no country on the map (${String(p)})`);
    expect(() => named([{ entry: 'free', passports: ['DE'] }, { entry: 'visa', passports: ['FR', 'DE'] }], 'L')).toThrow("L names DE's passport twice");
    expect(() => named([{ entry: 'nothing', passports: ['DE'] }], 'L')).toThrow("L's rule 0 asks free, eta, evisa, arrival or visa, not nothing");
    expect(() => list({ rules: [] }, 'L')).toThrow("L's others is not an object");
  });

  it("takes a country to its own list, or the shared one it keeps with its own rules on top", () => {
    const groups = new Set(['eu']);
    expect(compileCountry('FR', { country: 'FR', group: 'eu', note: 'x', sources: [] }, groups)).toStrictEqual({ group: 'eu' });
    expect(compileCountry('GU', { country: 'GU', group: 'eu', rules: [{ entry: 'eta', days: 45, passports: ['MY'] }] }, groups)).toStrictEqual({ group: 'eu', passports: { MY: { entry: 'eta', days: 45 } } });
    expect(compileCountry('JP', { country: 'JP', rules: [{ entry: 'free', passports: ['US'] }], others: { entry: 'visa' } }, groups)).toStrictEqual({ passports: { US: { entry: 'free' } }, others: { entry: 'visa' } });
    expect(() => compileCountry('XX', { country: 'XX', group: 'eu' }, groups)).toThrow('XX is not a country on the map');
    expect(() => compileCountry('FR', { country: 'DE', group: 'eu' }, groups)).toThrow("FR's file is for DE");
    expect(() => compileCountry('FR', { country: 'FR', group: 'us' }, groups)).toThrow("FR keeps a shared list the game doesn't keep (us)");
    expect(() => compileCountry('FR', { country: 'FR', group: 'eu', others: { entry: 'free' } }, groups)).toThrow("FR keeps the eu list, so its other passports are that list's");
    expect(() => compileCountry('GU', { country: 'GU', group: 'eu', rules: 'x' }, groups)).toThrow('GU has no rules');
  });

  it('reads only files the register cites, as cited', () => {
    const root = mkdtempSync(join(tmpdir(), 'visits-'));
    mkdirSync(join(root, GROUPS), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const write = (path: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, path), text);
      return createHash('sha256').update(text).digest('hex');
    };
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    const cite = (fact: string, file: string, sha256: string) => ({ fact: `papers.visits.${fact}`, value: { file, sha256 } });
    const eu = write(`${GROUPS}/eu.json`, { group: 'eu', rules: [{ entry: 'free', passports: ['FR'] }], others: { entry: 'visa' } });
    // Written out of order: the files are read in the order of their names.
    const fr = write(`${SOURCES}/FR.json`, { country: 'FR', group: 'eu' });
    const de = write(`${SOURCES}/DE.json`, { country: 'DE', group: 'eu', rules: [{ entry: 'eta', passports: ['US'] }] });
    const jp = write(`${SOURCES}/JP.json`, { country: 'JP', rules: [], others: { entry: 'visa' } });
    write(`${SOURCES}/notes.txt`, 'not a file');
    const all = [cite('group.eu', `${GROUPS}/eu.json`, eu), cite('FR', `${SOURCES}/FR.json`, fr), cite('DE', `${SOURCES}/DE.json`, de), cite('JP', `${SOURCES}/JP.json`, jp)];
    register([...all, { fact: 'papers.visits.blocked.KP' }, { fact: 'papers.ids.FR', value: { file: `${SOURCES}/FR.json`, sha256: 'other' } }]);
    const visits = readVisits(root);
    expect(Object.keys(visits.countries)).toEqual(['DE', 'FR', 'JP']);
    expect(visits).toStrictEqual({
      groups: { eu: { passports: { FR: { entry: 'free' } }, others: { entry: 'visa' } } },
      countries: { DE: { group: 'eu', passports: { US: { entry: 'eta' } } }, FR: { group: 'eu' }, JP: { passports: {}, others: { entry: 'visa' } } },
    });
    register([cite('group.eu', `${GROUPS}/eu.json`, eu.replace(/^./, (c) => (c === '0' ? '1' : '0'))), ...all.slice(1)]);
    expect(() => readVisits(root)).toThrow(`${GROUPS}/eu.json isn't the file the register cites`);
    register(all.slice(1));
    expect(() => readVisits(root)).toThrow(`${GROUPS}/eu.json isn't cited by the register`);
    const eu2 = write(`${GROUPS}/eu.json`, { group: 'us', rules: [], others: { entry: 'visa' } });
    register([cite('group.eu', `${GROUPS}/eu.json`, eu2), ...all.slice(1)]);
    expect(() => readVisits(root)).toThrow(`${GROUPS}/eu.json is for us`);
    const eu3 = write(`${GROUPS}/eu.json`, { group: 'eu', others: { entry: 'visa' } });
    register([cite('group.eu', `${GROUPS}/eu.json`, eu3), ...all.slice(1)]);
    expect(() => readVisits(root)).toThrow('the eu list has no rules');
    expect(serialize({ groups: {}, countries: { FR: { group: 'eu' } } })).toBe('{\n "groups": {},\n "countries": {\n  "FR": {\n   "group": "eu"\n  }\n }\n}\n');
  });

  it('reads no shared lists where there are none', () => {
    const root = mkdtempSync(join(tmpdir(), 'visits-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const text = JSON.stringify({ country: 'JP', rules: [], others: { entry: 'free' } });
    writeFileSync(join(root, SOURCES, 'JP.json'), text);
    const sha256 = createHash('sha256').update(text).digest('hex');
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.visits.JP', value: { file: `${SOURCES}/JP.json`, sha256 } }] }));
    expect(readVisits(root)).toStrictEqual({ groups: {}, countries: { JP: { passports: {}, others: { entry: 'free' } } } });
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readVisits(ROOT)));
  });
});

describe('the visitor rules coverage', () => {
  it('is researched where compiled and cited with the list it shares, blocked where the register holds a blocker, proven where no one lives', () => {
    const facts = new Map([['papers.visits.JP', 'R-1'], ['papers.visits.FR', 'R-2'], ['papers.visits.group.eu', 'R-3'], ['papers.visits.blocked.KP', 'R-4'], ['papers.visits.DE', 'R-5'], ['papers.visits.blocked.DE', 'R-6']]);
    const compiled = new Map<string, string | null>([['JP', null], ['FR', 'eu'], ['DE', 'us'], ['CZ', null]]);
    const rows = visitsCoverage(['JP', 'FR', 'KP', 'IT', 'AQ', 'DE', 'CZ'], new Set(['JP', 'FR', 'KP', 'IT', 'DE', 'CZ']), compiled, facts);
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
    expect(TESTS).toEqual(["tests/papers/visits/visits.test.ts::visits > ask each country's own, or the list it shares, of each passport", 'tests/papers/visits/visits.places.test.ts::visits > for every place on the map']);
    expect(TOLD).toBe("tests/papers/visits/visits.test.ts::visits > tell the player what the game doesn't know");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.visits', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/visits-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
