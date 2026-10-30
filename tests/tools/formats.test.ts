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

  it("takes the checks inside a country's own number, held to the publisher's worked number", () => {
    // Nigeria's NUBAN as the central bank's 2019 standard gives it, with its worked number (bank 011, check 9).
    const digits = (n: number) => ({ name: 'd', length: n, kind: 'n' });
    const NUBAN = { name: 'NUBAN', parts: [digits(3), digits(9), digits(1)], bank: [1, 3], checks: [{ over: [1, 12], weights: [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3] }] };
    expect(national('NG', { ...NUBAN, example: '0110000014579' })).toStrictEqual({ national: NUBAN });
    expect(national('AO', { name: 'NBA', parts: [digits(21)], checks: [{ over: [1, 19], mod97: true }] })).toStrictEqual({ national: { name: 'NBA', parts: [digits(21)], checks: [{ over: [1, 19], mod97: true }] } });
    // A check misread fails on the publisher's own number.
    expect(() => national('NG', { ...NUBAN, example: '0110000014578' })).toThrow("NG's national number's example 0110000014578 doesn't pass its form (check)");
    expect(() => national('NG', { ...NUBAN, checks: [{ over: [1, 12], weights: [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 1] }], example: '0110000014579' })).toThrow('(check)');
    expect(() => national('NG', { ...NUBAN, example: '011000001457' })).toThrow("NG's national number's example 011000001457 doesn't pass its form (length)");
    expect(() => national('NG', { ...NUBAN, example: 110000014579 })).toThrow('(length)');
    for (const checks of [[], 'x', { over: [1, 12] }]) expect(() => national('NG', { ...NUBAN, checks }), JSON.stringify(checks)).toThrow("NG's national number's checks are a list");
    const one = (c: unknown, parts = NUBAN.parts) => () => national('NG', { ...NUBAN, parts, checks: [{ over: [5, 6], weights: [1, 1] }, c] });
    expect(one('x')).toThrow("NG's national number's check 1 is not an object");
    expect(one({ over: [1, 12], weights: [], mod: 10 })).toThrow("NG's national number's check 1 has no term mod");
    expect(one({ over: [1, 14], weights: [] })).toThrow("NG's national number's check 1's over is characters 1 to 14 of a number 13 long");
    // Its digits come straight after what it's worked over, inside the number: one, or two for mod 97.
    expect(one({ over: [1, 13], weights: Array(13).fill(1) })).toThrow("NG's national number's check 1's digits don't fit after characters 1 to 13");
    expect(one({ over: [1, 12], mod97: true })).toThrow("NG's national number's check 1's digits don't fit after characters 1 to 12");
    expect(national('NG', { ...NUBAN, checks: [{ over: [1, 11], mod97: true }] })).toStrictEqual({ national: { ...NUBAN, checks: [{ over: [1, 11], mod97: true }] } });
    // Worked over digits and written in digits: a letter anywhere from its first to its last digit is refused.
    const lettered = (at: number) => [digits(at - 1), { name: 'l', length: 1, kind: 'c' }, digits(13 - at)].filter((p) => p.length > 0);
    for (const at of [1, 12, 13]) expect(one({ over: [1, 12], weights: Array(12).fill(1) }, lettered(at)), String(at)).toThrow("NG's national number's check 1 is worked over digits, into digits");
    expect(one({ over: [2, 12], weights: Array(11).fill(1) }, lettered(1))).not.toThrow();
    expect(one({ over: [2, 11], weights: Array(10).fill(1) }, lettered(13))).not.toThrow();
    for (const mod97 of [false, 1, 'true']) expect(one({ over: [1, 11], mod97 }), String(mod97)).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    expect(one({ over: [1, 11], mod97: true, weights: [] })).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    // The French RIB's key, two digits like mod 97's; one rule to a check.
    expect(national('NG', { ...NUBAN, checks: [{ over: [1, 11], key97: true }] })).toStrictEqual({ national: { ...NUBAN, checks: [{ over: [1, 11], key97: true }] } });
    for (const key97 of [false, 1]) expect(one({ over: [1, 11], key97 }), String(key97)).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    expect(one({ over: [1, 11], key97: true, mod97: true })).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    expect(one({ over: [1, 11], key97: true, weights: [] })).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    expect(one({ over: [1, 12], key97: true })).toThrow("NG's national number's check 1's digits don't fit after characters 1 to 12");
    expect(national('NG', { ...NUBAN, checks: [{ over: [1, 11], rest97: true }] })).toStrictEqual({ national: { ...NUBAN, checks: [{ over: [1, 11], rest97: true }] } });
    expect(one({ over: [1, 11], rest97: true, key97: true })).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    expect(one({ over: [1, 11], rest97: 'yes' })).toThrow("NG's national number's check 1 is one of mod97, key97 or rest97: true, with no weights");
    expect(one({ over: [1, 12], rest97: true })).toThrow("NG's national number's check 1's digits don't fit after characters 1 to 12");
    for (const weights of [undefined, 'x', Array(11).fill(1), Array(13).fill(1), [...Array(11).fill(1), 1.5], [...Array(11).fill(1), -1], [...Array(11).fill(1), '1']])
      expect(one({ over: [1, 12], weights }), JSON.stringify(weights)).toThrow("NG's national number's check 1's weights are a whole number for each of characters 1 to 12");
    expect(one({ over: [1, 12], weights: Array(12).fill(0) })).not.toThrow();
  });

  it("takes a part whose length varies, the bank's code and the checks before it", () => {
    const fixed = (n: number, name = 'd') => ({ name, length: n, kind: 'n' });
    const ROUTING = [fixed(8, 'routing'), fixed(1, 'check')];
    const ACCOUNT = { name: 'account', length: 17, kind: 'c', min: 1, drawn: [8, 12] };
    const US = { name: 'R', parts: [...ROUTING, ACCOUNT], bank: [1, 8], checks: [{ over: [1, 8], weights: [3, 7, 1, 3, 7, 1, 3, 7] }] };
    expect(national('US', US)).toStrictEqual({ national: US });
    expect(national('US', { ...US, parts: [...ROUTING, { ...ACCOUNT, drawn: undefined }] })).toStrictEqual({ national: { ...US, parts: [...ROUTING, { name: 'account', length: 17, kind: 'c', min: 1 }] } });
    // A part's fewest is fewer than its most; its drawn lengths are lengths it takes.
    const part = (p: Record<string, unknown>) => () => national('US', { ...US, parts: [...ROUTING, { ...ACCOUNT, ...p }] });
    for (const min of [0, 1.5, '1']) expect(part({ min }), String(min)).toThrow("US's national number's part 2's min is a whole number above nothing");
    expect(part({ min: 17 })).toThrow("US's national number's part 2 takes 17 characters at the fewest, fewer than its 17 at the most");
    expect(part({ min: 16, drawn: [16, 17] })).not.toThrow();
    expect(part({ drawn: [8, 18] })).toThrow("US's national number's part 2's drawn is characters 8 to 18 of a number 17 long");
    expect(part({ min: 9, drawn: [8, 12] })).toThrow("US's national number's part 2 is drawn at lengths it takes");
    expect(part({ min: 8, drawn: [8, 12] })).not.toThrow();
    expect(part({ min: undefined, drawn: [17, 17] })).toThrow("US's national number's part 2 is drawn at lengths of its own only where its length varies (min)");
    expect(part({ name: 'a', check: 1 })).toThrow("US's national number's part 2 has no term check");
    // After a part whose length varies, nothing has a fixed place: the bank's code and the checks sit before.
    expect(() => national('US', { ...US, bank: [1, 10] })).toThrow("US's national number's bank sits after a part whose length varies");
    expect(() => national('US', { ...US, bank: [1, 9] })).not.toThrow();
    const mid = { ...US, parts: [fixed(4), { ...ACCOUNT, kind: 'n', length: 4, min: 2, drawn: undefined }, fixed(4)], bank: [1, 4], checks: [] };
    expect(() => national('US', { ...mid, checks: [{ over: [1, 3], weights: [1, 1, 1] }] })).not.toThrow();
    expect(() => national('US', { ...mid, checks: [{ over: [1, 4], weights: [1, 1, 1, 1] }] })).toThrow("US's national number's check 0 sits after a part whose length varies");
    expect(() => national('US', { ...mid, checks: [{ over: [1, 2], mod97: true }] })).not.toThrow();
    expect(() => national('US', { ...mid, checks: [{ over: [1, 3], mod97: true }] })).toThrow("US's national number's check 0 sits after a part whose length varies");
    expect(() => national('US', { ...mid, checks: [{ over: [1, 2], key97: true }] })).not.toThrow();
    expect(() => national('US', { ...mid, checks: [{ over: [1, 3], key97: true }] })).toThrow("US's national number's check 0 sits after a part whose length varies");
    expect(() => national('US', { ...mid, checks: [{ over: [1, 2], weights: [1, 1] }, { over: [1, 3], weights: [1, 1, 1] }, { over: [1, 4], weights: [1, 1, 1, 1] }] })).toThrow("US's national number's check 2 sits");
    expect(() => national('US', { ...mid, bank: [1, 5] })).toThrow("US's national number's bank sits after a part whose length varies");
    // A fixed form keeps its places to its end.
    expect(() => national('NG', { name: 'N', parts: [fixed(13)], bank: [1, 13], checks: [{ over: [1, 12], weights: Array(12).fill(1) }] })).not.toThrow();
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
