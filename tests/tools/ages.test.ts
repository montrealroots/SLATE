import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileAges, OUTPUT, PERFORMERS, readAges, serialize, SEXES, SOURCES } from '../../tools/papers/ages/compile.ts';
import { agesCoverage, COVERAGE, coverageOf, TESTS, TOLD, whole } from '../../tools/papers/ages/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const US = { country: 'US', majority: 18, work: { from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } }, service: 'none' };
const us = (over: Record<string, unknown>) => ({ ...US, ...over });
const AGE = 'is an age: whole years, or years and months (1 to 11) or days (1 to 364)';

describe('the ages compile', () => {
  it("takes a country's majority, working age and service, each null where unread", () => {
    expect([PERFORMERS, SEXES]).toEqual([['permit', 'free', 'barred'], ['male', 'female']]);
    expect(compileAges('US', { ...US, note: 'x', sources: [] })).toStrictEqual({ majority: 18, work: US.work, service: 'none' });
    expect(compileAges('US', us({ majority: null, work: null, service: null }))).toStrictEqual({ majority: null, work: null, service: null });
    expect(compileAges('US', us({ majority: { years: 17, months: 6 } })).majority).toStrictEqual({ years: 17, months: 6 });
    expect(() => compileAges('XX', { ...US, country: 'XX' })).toThrow('XX is not a country on the map');
    expect(() => compileAges('US', us({ country: 'CA' }))).toThrow("US's file is for CA");
    expect(() => compileAges('US', us({ licence: 1 }))).toThrow('US has no term licence');
    for (const k of ['majority', 'work', 'service']) {
      const f = Object.fromEntries(Object.entries(US).filter(([key]) => key !== k));
      expect(() => compileAges('US', f)).toThrow(`US gives its ${k}, or null`);
    }
    for (const majority of [-1, 17.5, '18', { years: 17 }]) expect(() => compileAges('US', us({ majority }))).toThrow(`US's majority ${AGE}`);
  });

  it("takes a region's own majority beside the country's", () => {
    expect(compileAges('US', us({ regions: { 'US.AL': 19, 'US.MS': 21 } })).regions).toStrictEqual({ 'US.AL': 19, 'US.MS': 21 });
    for (const regions of [{}, 'x', [19]]) expect(() => compileAges('US', us({ regions }))).toThrow("US's regions set their own majority beside the country's");
    expect(() => compileAges('US', us({ majority: null, regions: { 'US.AL': 19 } }))).toThrow("US's regions set their own majority beside the country's");
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

  it('takes military service by sex and age, or none', () => {
    const kr = { sexes: ['male'], from: 18, until: 28, months: 18 };
    expect(compileAges('US', us({ service: kr })).service).toStrictEqual(kr);
    expect(compileAges('US', us({ service: { ...kr, sexes: ['male', 'female'], months: null } })).service).toStrictEqual({ ...kr, sexes: ['male', 'female'], months: null });
    for (const service of ['some', 7]) expect(() => compileAges('US', us({ service }))).toThrow("US's service is none or an object");
    expect(() => compileAges('US', us({ service: { ...kr, alt: 1 } }))).toThrow("US's service has no term alt");
    for (const sexes of [[], 'male', ['men'], ['male', 'male'], undefined]) expect(() => compileAges('US', us({ service: { ...kr, sexes } }))).toThrow("US's service calls male, female or both, each once");
    expect(() => compileAges('US', us({ service: { ...kr, from: 'x' } }))).toThrow(`US's service's from ${AGE}`);
    expect(() => compileAges('US', us({ service: { ...kr, until: 'x' } }))).toThrow(`US's service's until ${AGE}`);
    for (const until of [18, 17, { years: 18, months: 6 }]) expect(() => compileAges('US', us({ service: { ...kr, until } }))).toThrow("US's service runs until an age above the one it calls from");
    expect(compileAges('US', us({ service: { ...kr, from: { years: 18, months: 6 }, until: 19 } })).service).toStrictEqual({ ...kr, from: { years: 18, months: 6 }, until: 19 });
    expect(compileAges('US', us({ service: { ...kr, months: 1 } })).service).toStrictEqual({ ...kr, months: 1 });
    for (const months of [0, 1.5, '18', undefined]) expect(() => compileAges('US', us({ service: { ...kr, months } }))).toThrow("US's service lasts a whole number of months, or null");
  });

  it('reads the files the register cites, and none else', () => {
    const root = mkdtempSync(join(tmpdir(), 'ages-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const file = JSON.stringify(US);
    writeFileSync(join(root, `${SOURCES}/US.json`), file);
    const register = (sha: string) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.ages.US', value: { file: `${SOURCES}/US.json`, sha256: sha } }] }));
    register(createHash('sha256').update(file).digest('hex'));
    expect(readAges(root)).toStrictEqual({ US: { majority: 18, work: US.work, service: 'none' } });
    register('0'.repeat(64));
    expect(() => readAges(root)).toThrow(`${SOURCES}/US.json isn't the file the register cites`);
    // Cited under another engine's fact isn't cited for the ages.
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.work.US', value: { file: `${SOURCES}/US.json`, sha256: createHash('sha256').update(file).digest('hex') } }] }));
    expect(() => readAges(root)).toThrow(`${SOURCES}/US.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readAges(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
  });
});

describe('the ages coverage', () => {
  it('is researched where all three are read and cited, blocked where the register holds a blocker, proven where no one lives', () => {
    const ages = { US: { majority: 18, work: {}, service: 'none' }, FR: { majority: 18, work: null, service: 'none' }, DE: { majority: null, work: {}, service: 'none' }, IT: { majority: 18, work: {}, service: null } };
    expect(whole(ages)).toEqual(new Set(['US']));
    const facts = new Map([['papers.ages.US', 'R-1'], ['papers.ages.FR', 'R-2'], ['papers.ages.blocked.FR', 'R-3']]);
    expect(agesCoverage(['US', 'FR', 'DE', 'AQ'], new Set(['US', 'FR', 'DE']), whole(ages), facts)).toEqual([
      { key: 'US', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'DE', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
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
