import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileAges, OUTPUT, PERFORMERS, PERSON, readAges, readInto, readPerson, serialize, SOURCES } from '../../tools/papers/ages/compile.ts';
import { agesCoverage, COVERAGE, coverageOf, majorityRead, TESTS, TOLD, whole, withPerson } from '../../tools/papers/ages/coverage.ts';
import { READINGS, type Reading } from '../../tools/papers/ages/person.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const US = { country: 'US', majority: 18, work: { from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } } };
const us = (over: Record<string, unknown>) => ({ ...US, ...over });
const AGE = 'is an age: whole years, or years and months (1 to 11) or days (1 to 364)';

describe('the ages compile', () => {
  it("takes a country's majority and working age, each null where unread, and leaves its service unread", () => {
    expect(PERFORMERS).toEqual(['permit', 'free', 'barred']);
    expect(compileAges('US', { ...US, note: 'x', sources: [] })).toStrictEqual({ majority: 18, work: US.work });
    expect(compileAges('US', us({ majority: null, work: null }))).toStrictEqual({ majority: null, work: null });
    // The research's service, whatever it holds, or none given, is no part of the ages.
    for (const service of [null, 'x', { sexes: ['male'] }]) expect(compileAges('US', us({ service }))).toStrictEqual({ majority: 18, work: US.work });
    expect(compileAges('US', { country: 'US', majority: 18, work: null })).toStrictEqual({ majority: 18, work: null });
    expect(compileAges('US', us({ majority: { years: 17, months: 6 } })).majority).toStrictEqual({ years: 17, months: 6 });
    expect(() => compileAges('XX', { ...US, country: 'XX' })).toThrow('XX is not a country on the map');
    expect(() => compileAges('US', us({ country: 'CA' }))).toThrow("US's file is for CA");
    expect(() => compileAges('US', us({ licence: 1 }))).toThrow('US has no term licence');
    for (const k of ['majority', 'work']) {
      const f = Object.fromEntries(Object.entries(US).filter(([key]) => key !== k));
      expect(() => compileAges('US', f)).toThrow(`US gives its ${k}, or null`);
    }
    for (const majority of [-1, 17.5, '18', { years: 17 }]) expect(() => compileAges('US', us({ majority }))).toThrow(`US's majority ${AGE}`);
  });

  it("takes a region's own majority beside the country's", () => {
    expect(compileAges('US', us({ regions: { 'US.AL': 19, 'US.MS': 21 } })).regions).toStrictEqual({ 'US.AL': 19, 'US.MS': 21 });
    for (const regions of [{}, 'x', [19]]) expect(() => compileAges('US', us({ regions }))).toThrow("US's regions set their own majority beside the country's");
    // A region whose law wasn't read stands null, not the country's; regions stand beside a country's own null.
    expect(compileAges('US', us({ regions: { 'US.AL': 19, 'US.MS': null } })).regions).toStrictEqual({ 'US.AL': 19, 'US.MS': null });
    expect(compileAges('US', us({ majority: null, regions: { 'US.AL': 19 } }))).toStrictEqual({ majority: null, regions: { 'US.AL': 19 }, work: US.work });
    for (const key of ['CA.01', 'US.ZZ', 'US']) expect(() => compileAges('US', us({ regions: { [key]: 19 } }))).toThrow(`US's region ${key} is one of its regions on the map`);
    expect(() => compileAges('US', us({ regions: { 'US.AL': 19.5 } }))).toThrow(`US's majority in US.AL ${AGE}`);
  });

  it('takes the working age and what the law says of a younger performer', () => {
    expect(compileAges('US', us({ work: { from: 16, performers: 'free' } })).work).toStrictEqual({ from: 16, performers: 'free' });
    expect(compileAges('US', us({ work: { from: 16, performers: 'permit', permit: 'Licence' } })).work).toStrictEqual({ from: 16, performers: 'permit', permit: 'Licence' });
    expect(() => compileAges('US', us({ work: 16 }))).toThrow("US's work is an object");
    expect(() => compileAges('US', us({ work: { from: 16, performers: 'free', hours: 4 } }))).toThrow("US's work has no term hours");
    expect(() => compileAges('US', us({ work: { from: -1, performers: 'free' } }))).toThrow(`US's work's from ${AGE}`);
    for (const performers of ['allowed', undefined]) expect(() => compileAges('US', us({ work: { from: 16, performers } }))).toThrow("US's work's performers are permit, free or barred");
    for (const extra of [{ permit: 'x' }, { permitFrom: 1 }]) expect(() => compileAges('US', us({ work: { from: 16, performers: 'barred', ...extra } }))).toThrow("US's work names a permit only where performers need one");
    for (const permit of [undefined, '', ' x', 7]) expect(() => compileAges('US', us({ work: { from: 16, performers: 'permit', permit } }))).toThrow("US's work names the permit a young performer needs");
    expect(() => compileAges('US', us({ work: { from: 16, performers: 'permit', permit: 'x', permitFrom: 'a' } }))).toThrow(`US's work's permitFrom ${AGE}`);
  });

  it('reads the files the register cites, and none else', () => {
    const root = mkdtempSync(join(tmpdir(), 'ages-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const file = JSON.stringify(US);
    writeFileSync(join(root, `${SOURCES}/US.json`), file);
    const register = (sha: string) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.ages.US', value: { file: `${SOURCES}/US.json`, sha256: sha } }] }));
    register(createHash('sha256').update(file).digest('hex'));
    expect(readAges(root, {})).toStrictEqual({ US: { majority: 18, work: US.work } });
    register('0'.repeat(64));
    expect(() => readAges(root, {})).toThrow(`${SOURCES}/US.json isn't the file the register cites`);
    // Cited under another engine's fact isn't cited for the ages.
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.work.US', value: { file: `${SOURCES}/US.json`, sha256: createHash('sha256').update(file).digest('hex') } }] }));
    expect(() => readAges(root, {})).toThrow(`${SOURCES}/US.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readAges(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
  });
});

/** A person research file as the research holds it: figures by item, each a value the reading's keys point into. */
const figure = (item: string, value: unknown, finding = '') => ({ item, finding, value, applies: '', sources: [] });
const PERSONS = { country: 'US', figures: [figure('majority', { age: 18, 'US.CA': 18 }), figure('minimumWorkAge', { general: 16, act: { age: 15 }, odd: 'x' }), figure('childPerformers', { permit: 'Entertainment Work Permit', lowestAge: { years: 0, days: 15 } })] };
const EMPTY = { country: 'US', majority: null, work: null };
const into = (own: Record<string, unknown> | undefined, reading: Reading, person: Record<string, unknown> = PERSONS) => readInto('US', own, { reading, person });

describe('the ages read from the person research', () => {
  it("is layer 3's file where nothing is read from it, and an empty one where layer 3 has none", () => {
    const own = { ...US, note: 'x' };
    expect(readInto('US', own)).toBe(own);
    expect(readInto('US', undefined)).toStrictEqual(EMPTY);
    // A majority read leaves the work as layer 3 has it, a null work null.
    expect(into(undefined, { majority: 'age' })).toStrictEqual({ ...EMPTY, majority: 18 });
    expect(into({ ...US, majority: null }, { majority: 'age' })).toStrictEqual(US);
  });

  it('reads an age at its key in the one figure that holds it', () => {
    expect(into(undefined, { from: 'act.age', performers: 'barred' }).work).toStrictEqual({ from: 15, performers: 'barred' });
    const two = { ...PERSONS, figures: [...PERSONS.figures, figure('majority', { age: 21 })] };
    expect(() => into(undefined, { majority: 'age' }, two)).toThrow("US's person research gives its majority age in 2 figures, not one");
    for (const key of ['years', 'general.age', 'act.years']) expect(() => into(undefined, { majority: key })).toThrow(`US's person research gives its majority ${key} in 0 figures, not one`);
    // A key is read in its own item's figure only: the working age isn't the majority's.
    expect(() => into(undefined, { majority: 'general' })).toThrow("US's person research gives its majority general in 0 figures, not one");
    expect(() => into(undefined, { from: 'odd', performers: 'free' })).toThrow(`US's minimumWorkAge odd ${AGE}`);
  });

  it("reads a region's majority at its own key, beside layer 3's regions", () => {
    expect(into(undefined, { regions: ['US.CA'] })).toStrictEqual({ ...EMPTY, regions: { 'US.CA': 18 } });
    expect(into({ ...US, regions: { 'US.AL': 19, 'US.CA': null } }, { regions: ['US.CA'] }).regions).toStrictEqual({ 'US.AL': 19, 'US.CA': 18 });
    expect(() => into(US, { regions: ['US.NY'] })).toThrow("US's person research gives its majority US.NY in 0 figures, not one");
  });

  it("reads the working age and a younger performer's rule, the permit as the research names it", () => {
    expect(into(undefined, { from: 'general', performers: 'permit', permit: 'Entertainment Work Permit', permitFrom: 'lowestAge' }).work).toStrictEqual({ from: 16, performers: 'permit', permit: 'Entertainment Work Permit', permitFrom: { years: 0, days: 15 } });
    expect(into(undefined, { from: 'general', performers: 'permit', permit: 'Work Permit' }).work).toStrictEqual({ from: 16, performers: 'permit', permit: 'Work Permit' });
    expect(() => into(undefined, { from: 'general', performers: 'permit', permit: 'Licence' })).toThrow("US's person research doesn't name the permit Licence");
    // A working age read without a performer's rule leaves the work unfinished, refused by the form.
    expect(() => compileAges('US', into(undefined, { from: 'general' }))).toThrow("US's work's performers are permit, free or barred");
    expect(() => compileAges('US', into(undefined, { performers: 'free' }))).toThrow(`US's work's from ${AGE}`);
  });

  it("keeps what layer 3 holds unless the reading says why the person research's stands over it", () => {
    const why = 'A later act sets 16.';
    const refused = (what: string) => `US's ${what} is layer 3's; the person research's stands over it only where the reading says why`;
    expect(() => into(US, { majority: 'age' })).toThrow(refused('majority'));
    expect(() => into({ ...US, regions: { 'US.CA': 21 } }, { regions: ['US.CA'] })).toThrow(refused('majority in US.CA'));
    expect(() => into(US, { from: 'general' })).toThrow(refused('working age'));
    expect(() => into({ ...US, work: { from: null, performers: 'free' } }, { performers: 'barred' })).toThrow(refused('rule for a younger performer'));
    expect(() => into(US, { from: 'general', settles: '' })).toThrow(refused('working age'));
    // Uganda's: the later act's age over layer 3's, the performer's rule layer 3 read kept.
    expect(into(US, { from: 'general', settles: why }).work).toStrictEqual({ ...US.work, from: 16 });
    expect(into(US, { majority: 'age', regions: ['US.CA'], settles: why })).toStrictEqual({ ...US, regions: { 'US.CA': 18 } });
    expect(into(US, { performers: 'free', settles: why }).work).toStrictEqual({ from: 14, performers: 'free' });
  });

  it('reads only the file the register cites, as it cites it', () => {
    const root = mkdtempSync(join(tmpdir(), 'ages-person-'));
    mkdirSync(join(root, PERSON), { recursive: true });
    const bytes = JSON.stringify(PERSONS);
    writeFileSync(join(root, `${PERSON}/US.json`), bytes);
    const sha = createHash('sha256').update(bytes).digest('hex');
    const register = (fact: string, file: string, digest = sha) => ({ entries: [{ fact: 'person.ages.blocked.US' }, { fact, value: { file, sha256: digest } }] });
    expect(readPerson(root, register('person.ages.US', `${PERSON}/US.json`), 'US')).toStrictEqual(PERSONS);
    expect(() => readPerson(root, register('person.ages.US', `${PERSON}/US.json`, '0'.repeat(64)), 'US')).toThrow(`${PERSON}/US.json isn't the file the register cites`);
    expect(() => readPerson(root, register('person.ages.US', `${PERSON}/CA.json`), 'US')).toThrow(`${PERSON}/US.json isn't cited by the register`);
    expect(() => readPerson(root, register('person.markets.US', `${PERSON}/US.json`), 'US')).toThrow(`${PERSON}/US.json isn't cited by the register`);
    // The ages of every country layer 3 has a file for or the person research is read for, in code order.
    mkdirSync(join(root, SOURCES), { recursive: true });
    const own = JSON.stringify({ ...US, country: 'CA', majority: null });
    writeFileSync(join(root, `${SOURCES}/CA.json`), own);
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [...register('person.ages.US', `${PERSON}/US.json`).entries, { fact: 'papers.ages.CA', value: { file: `${SOURCES}/CA.json`, sha256: createHash('sha256').update(own).digest('hex') } }] }));
    const ages = readAges(root, { US: { majority: 'age' } });
    expect(Object.keys(ages)).toEqual(['CA', 'US']);
    expect(ages).toStrictEqual({ CA: { majority: null, work: US.work }, US: { majority: 18, work: null } });
  });

  it("are each country's own, as its research finds them", () => {
    const ages = readAges(ROOT);
    // Uganda: the Children (Amendment) Act 2016's sixteen over the Employment Act 2006's fourteen, layer 3's rule kept.
    expect(ages['UG']?.work).toStrictEqual({ from: 16, performers: 'barred' });
    expect(READINGS['UG']?.settles).toMatch(/^The Children \(Amendment\) Act 2016/);
    // A country layer 3 has no file for: Cuba's majority, its working age and its younger performer's consent from fifteen.
    expect(ages['CU']).toStrictEqual({ majority: 18, work: { from: 17, performers: 'permit', permit: 'consentimiento de los padres o tutores', permitFrom: 15 } });
    expect([ages['BH']?.majority, ages['EG']?.majority, ages['NZ']?.majority, ages['WS']?.majority, ages['BL']?.majority]).toEqual([21, 21, 20, 21, 18]);
    expect(ages['IL']?.work).toStrictEqual({ from: 15, performers: 'permit', permit: 'היתר (Minister of Labour and Welfare)' });
    // The states' and provinces' own: California's and New York's, Ontario's and Quebec's, four Australian states'.
    expect([ages['US']?.regions?.['US.CA'], ages['US']?.regions?.['US.NY'], ages['CA']?.regions?.['CA.08'], ages['CA']?.regions?.['CA.10'], ages['AU']?.regions?.['AU.07']]).toEqual([18, 18, 18, 18, 18]);
    // Layer 3's own where it holds one: Mauritania's code over the state's report.
    expect(ages['MR']?.work).toStrictEqual({ from: 14, performers: 'barred' });
    expect(Object.keys(ages).length).toBe(213);
  });
});

describe('the ages coverage', () => {
  it('is researched where the majority and the working age are read and cited, blocked where the register holds a blocker, proven where no one lives', () => {
    const ages = { US: { majority: 18, work: {} }, FR: { majority: 18, work: null }, DE: { majority: null, work: {} } };
    expect(whole(ages, [])).toEqual(new Set(['US']));
    // A majority by region is read only where every region's is: Canada's with both read, Australia's with one missing;
    // a region named unknown leaves its country unread though the country's own is known.
    const regions = ['CA.01', 'CA.02', 'AU.01', 'AU.02', 'US.AL'];
    expect(majorityRead('CA', { majority: null, regions: { 'CA.01': 18, 'CA.02': 19 }, work: {} }, regions)).toBe(true);
    expect(majorityRead('AU', { majority: null, regions: { 'AU.01': 18 }, work: {} }, regions)).toBe(false);
    expect(majorityRead('US', { majority: 18, regions: { 'US.AL': null }, work: {} }, regions)).toBe(false);
    expect(majorityRead('US', { majority: 18, regions: { 'US.AL': 19 }, work: {} }, regions)).toBe(true);
    expect(majorityRead('FR', { majority: null, work: {} }, ['FR.01'])).toBe(false);
    expect(whole({ CA: { majority: null, regions: { 'CA.01': 18, 'CA.02': 19 }, work: {} } }, regions)).toEqual(new Set(['CA']));
    const facts = new Map([['papers.ages.US', 'R-1'], ['papers.ages.FR', 'R-2'], ['papers.ages.blocked.FR', 'R-3']]);
    expect(agesCoverage(['US', 'FR', 'DE', 'AQ'], new Set(['US', 'FR', 'DE']), whole(ages, []), facts)).toEqual([
      { key: 'US', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'DE', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
    ]);
  });

  it('cites the person research beside a row its country is read from', () => {
    const facts = new Map([['person.ages.US', 'R-9'], ['person.ages.FR', 'R-8'], ['person.ages.AQ', 'R-7']]);
    const rows = [
      { key: 'US', status: 'researched' as const, register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked' as const, register: ['R-3'], tests: TESTS },
      { key: 'DE', status: 'blocked' as const, register: ['R-4'], tests: TESTS },
      { key: 'IT', status: 'blocked' as const, register: ['R-5'], tests: TESTS },
      { key: 'AQ', status: 'proven' as const, tests: [NO_PLACES] },
    ];
    expect(withPerson(rows, new Set(['US', 'FR', 'IT', 'AQ']), facts)).toEqual([
      { ...rows[0], register: ['R-1', 'R-9'] },
      { ...rows[1], register: ['R-3', 'R-8'] },
      rows[2],
      rows[3],
      rows[4],
    ]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TOLD, TESTS]).toEqual([
      'coverage/ages-countries.json',
      "tests/papers/ages/ages.test.ts::the ages > tell the player what the game doesn't know",
      ["tests/papers/ages/ages.test.ts::the ages > are each country's own", 'tests/papers/ages/ages.places.test.ts::the ages > for every place on the map'],
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
  });
});
