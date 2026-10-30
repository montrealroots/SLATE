import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCountry, iban, KINDS, national, OUTPUT, readFormats, resolve as resolveForms, serialize, SOURCES, span, structure } from '../../tools/money/formats/compile.ts';
import { COVERAGE, coverageOf, formatsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/money/formats/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const GB = { length: 22, bban: '4!a6!n8!n', bank: [1, 4], branch: [5, 10], example: 'GB29NWBK60161331926819' };
const GB_FORM = { iban: { prefix: 'GB', length: 22, bban: [{ length: 4, kind: 'a' }, { length: 6, kind: 'n' }, { length: 8, kind: 'n' }], bank: [1, 4] } };
const CLABE = { name: 'CLABE', parts: [{ name: 'bank', length: 3, kind: 'n' }, { name: 'rest', length: 15, kind: 'c' }], bank: [1, 3] };

describe('the account formats compile', () => {
  it("reads the registry's notation and positions", () => {
    expect([SOURCES, OUTPUT, KINDS]).toEqual(['research/sources/money/formats', 'src/money/formats/formats.json', ['n', 'a', 'c']]);
    expect(structure('4!a6!n8!n', 's')).toStrictEqual([{ length: 4, kind: 'a' }, { length: 6, kind: 'n' }, { length: 8, kind: 'n' }]);
    expect(structure('12!c', 's')).toStrictEqual([{ length: 12, kind: 'c' }]);
    for (const s of ['', '4a', '4!x', '4!a 6!n', 'NO4!n', '4!n6', 4, undefined, ['4!n']]) expect(() => structure(s, 's'), String(s)).toThrow("s is a structure in the registry's notation, such as 4!a6!n8!n");
    expect(() => structure('0!n', 's')).toThrow('s is a whole number above nothing');
    expect(span([1, 4], 18, 'b')).toStrictEqual([1, 4]);
    expect(span([18, 18], 18, 'b')).toStrictEqual([18, 18]);
    for (const s of [undefined, [1], [1, 2, 3], '1-4']) expect(() => span(s, 18, 'b'), JSON.stringify(s)).toThrow('b is characters from..to, written [from, to]');
    for (const s of [[0, 4], [1, 2.5], [1, '4']]) expect(() => span(s, 18, 'b'), JSON.stringify(s)).toThrow('b is a whole number above nothing');
    expect(() => span([5, 4], 18, 'b')).toThrow('b is characters 5 to 4 of a number 18 long');
    expect(() => span([1, 19], 18, 'b')).toThrow('b is characters 1 to 19 of a number 18 long');
  });

  it("takes a country's IBAN, held to the registry's own example", () => {
    expect(iban('GB', GB)).toStrictEqual(GB_FORM);
    // The branch is checked, and kept in the research only; a form without a bank's code has none.
    const { bank: _b, branch: _r, ...plain } = GB;
    expect(iban('GB', plain)).toStrictEqual({ iban: { prefix: 'GB', length: 22, bban: GB_FORM.iban.bban } });
    expect(iban('GP', { prefix: 'FR' })).toStrictEqual({ prefix: 'FR' });
    for (const o of [null, 'x', []]) expect(() => iban('GB', o), JSON.stringify(o)).toThrow("GB's IBAN is not an object");
    expect(() => iban('GB', { ...GB, check: 'x' })).toThrow("GB's IBAN has no term check");
    expect(() => iban('GP', { prefix: 'FR', length: 27 })).toThrow("GP's IBAN, under another's prefix, has no term length");
    for (const prefix of ['GP', 'fr', 'FRA', 1, ['FR']]) expect(() => iban('GP', { prefix }), String(prefix)).toThrow("GP's IBAN's prefix is another country's two letters");
    expect(() => iban('GB', { ...GB, bban: '4a6!n8!n' })).toThrow("GB's IBAN's bban is a structure");
    expect(() => iban('GB', { ...GB, bban: '4!a6!n' })).toThrow("GB's IBAN is 14 characters long by its structure, not 22");
    for (const length of [21, 23, '22', undefined]) expect(() => iban('GB', { ...GB, length }), String(length)).toThrow(`GB's IBAN is 22 characters long by its structure, not ${String(length)}`);
    expect(() => iban('GB', { ...GB, bank: [1, 19] })).toThrow("GB's IBAN's bank is characters 1 to 19 of a number 18 long");
    expect(() => iban('GB', { ...GB, branch: [11, 10] })).toThrow("GB's IBAN's branch is characters 11 to 10 of a number 18 long");
    // A structure misread fails on the registry's own number.
    expect(() => iban('GB', { ...GB, example: 'GB28NWBK60161331926819' })).toThrow("GB's IBAN's example GB28NWBK60161331926819 doesn't pass its form (check)");
    expect(() => iban('GB', { ...GB, bban: '4!n6!n8!n' })).toThrow("GB's IBAN's example GB29NWBK60161331926819 doesn't pass its form (structure)");
    expect(() => iban('GB', { ...GB, example: 'IE29NWBK60161331926819' })).toThrow('(country)');
    for (const example of [undefined, 29]) expect(() => iban('GB', { ...GB, example }), String(example)).toThrow(`GB's IBAN's example ${String(example)} doesn't pass its form (length)`);
  });

  it("takes a country's own number, part by part", () => {
    expect(national('MX', CLABE)).toStrictEqual({ national: CLABE });
    const { bank: _b, ...plain } = CLABE;
    expect(national('MX', plain)).toStrictEqual({ national: plain });
    expect(() => national('MX', null)).toThrow("MX's national number is not an object");
    expect(() => national('MX', { ...CLABE, check: 'x' })).toThrow("MX's national number has no term check");
    for (const name of [undefined, '', ' CLABE', 1]) expect(() => national('MX', { ...CLABE, name }), String(name)).toThrow("MX's national number is named as the country's banks name it");
    for (const parts of [undefined, [], 'x']) expect(() => national('MX', { ...CLABE, parts }), JSON.stringify(parts)).toThrow("MX's national number's parts are a list");
    const part = (p: unknown) => () => national('MX', { name: 'N', parts: [{ name: 'a', length: 1, kind: 'n' }, p] });
    expect(part('x')).toThrow("MX's national number's part 1 is not an object");
    expect(part({ name: 'b', length: 1, kind: 'n', check: 1 })).toThrow("MX's national number's part 1 has no term check");
    expect(part({ name: '', length: 1, kind: 'n' })).toThrow("MX's national number's part 1 is named");
    for (const kind of ['x', 'N', undefined]) expect(part({ name: 'b', length: 1, kind }), String(kind)).toThrow("MX's national number's part 1 is digits (n), letters (a) or either (c)");
    expect(part({ name: 'b', length: 0, kind: 'n' })).toThrow("MX's national number's part 1's length is a whole number above nothing");
    expect(() => national('MX', { ...CLABE, bank: [17, 19] })).toThrow("MX's national number's bank is characters 17 to 19 of a number 18 long");
  });

  it("takes a country's file to its one form", () => {
    expect(compileCountry('GB', { country: 'GB', iban: GB, note: 'n', sources: [] })).toStrictEqual(GB_FORM);
    expect(compileCountry('MX', { country: 'MX', national: CLABE })).toStrictEqual({ national: CLABE });
    expect(() => compileCountry('XX', { country: 'XX' })).toThrow('XX is not a country on the map');
    expect(() => compileCountry('GB', { country: 'FR', iban: GB })).toThrow("GB's file is for FR");
    expect(() => compileCountry('GB', { country: 'GB', iban: GB, banks: [] })).toThrow("GB's file has no term banks");
    expect(() => compileCountry('GB', { country: 'GB' })).toThrow('GB gives one form, an IBAN or a national number');
    expect(() => compileCountry('GB', { country: 'GB', iban: GB, national: CLABE })).toThrow('GB gives one form, an IBAN or a national number');
  });

  it("takes a folded prefix to its country's form", () => {
    const mx = { national: CLABE } as never;
    expect(resolveForms({ GB: GB_FORM as never, IM: { prefix: 'GB' }, MX: mx })).toStrictEqual({ GB: GB_FORM, IM: GB_FORM, MX: mx });
    expect(() => resolveForms({ IM: { prefix: 'GB' } })).toThrow("IM's prefix GB is no IBAN the research gives");
    expect(() => resolveForms({ MX: mx, XX: { prefix: 'MX' } })).toThrow("XX's prefix MX is no IBAN the research gives");
    expect(() => resolveForms({ GP: { prefix: 'FR' }, FR: { prefix: 'GP' } })).toThrow("GP's prefix FR is no IBAN the research gives");
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'formats-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const gb = `${JSON.stringify({ country: 'GB', iban: GB })}\n`;
    const im = `${JSON.stringify({ country: 'IM', iban: { prefix: 'GB' } })}\n`;
    writeFileSync(join(root, SOURCES, 'GB.json'), gb);
    writeFileSync(join(root, SOURCES, 'IM.json'), im);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = (s: string) => createHash('sha256').update(s).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    mkdirSync(join(root, 'research'), { recursive: true });
    const cite = (code: string, s: string) => ({ fact: `money.formats.${code}`, value: { file: `${SOURCES}/${code}.json`, sha256: sha(s) } });
    register([cite('GB', gb), cite('IM', im)]);
    expect(readFormats(root)).toStrictEqual({ countries: { GB: GB_FORM, IM: GB_FORM } });
    register([cite('GB', gb), { ...cite('IM', im), value: { file: `${SOURCES}/IM.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readFormats(root)).toThrow(`${SOURCES}/IM.json isn't the file the register cites`);
    register([cite('GB', gb), { ...cite('IM', im), fact: 'money.banks.IM' }, { fact: 'money.formats.blocked.US' }]);
    expect(() => readFormats(root)).toThrow(`${SOURCES}/IM.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readFormats(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ countries: {} })).toBe('{\n "countries": {}\n}\n');
  });
});

describe('the account formats coverage', () => {
  it('rows each country researched, blocked, pending, or proven with no place', () => {
    const facts = new Map([['money.formats.GB', 'R-1'], ['money.formats.blocked.US', 'R-2'], ['money.formats.DE', 'R-3']]);
    expect(formatsCoverage(['GB', 'US', 'MX', 'AQ', 'DE'], new Set(['GB', 'US', 'MX', 'DE']), new Set(['GB']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'US', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      { key: 'MX', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // A file the register cites but the compile didn't take is no research.
      { key: 'DE', status: 'pending' },
    ]);
    expect(formatsCoverage(['GB'], new Set(['GB']), new Set(['GB']), new Map())).toStrictEqual([{ key: 'GB', status: 'pending' }]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TESTS, TOLD]).toEqual([
      'coverage/formats-countries.json',
      ["tests/money/formats/formats.test.ts::account numbers > are drawn and checked in each country's own form", 'tests/money/formats/formats.places.test.ts::account numbers > for every place on the map'],
      "tests/money/formats/formats.test.ts::account numbers > tell the player what the game doesn't know",
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.formats",\n "axis": "country",\n "rows": []\n}\n');
  });
});
