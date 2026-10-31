import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { amount, checkIssuers, compileIssued, compileNone, compileNumber, currencyIn, NEEDED, OUTPUT, readCited, readNumbers, serialize, SOURCES, terms, WHEN, WHO, within } from '../../tools/papers/numbers/compile.ts';
import { COVERAGE, coverageBy, coverageOf, inputsOf, numbersCoverage, serializeBy, TESTS, TOLD } from '../../tools/papers/numbers/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const file = (over: Record<string, unknown> = {}) => ({
  country: 'CA',
  name: 'Social Insurance Number',
  issuer: 'Service Canada',
  format: { length: 9, pattern: '[0-9]{9}', check: 'luhn' },
  when: 'application',
  who: ['citizens', 'residents'],
  note: 'anything',
  sources: [],
  ...over,
});

/** A repository on disk with the register and the files given, each cited by its own SHA-256 unless a sha is given. */
function repo(files: Record<string, unknown>, sha: Record<string, string> = {}, fact = 'papers.numbers.') {
  const root = mkdtempSync(join(tmpdir(), 'numbers-'));
  mkdirSync(join(root, SOURCES), { recursive: true });
  const entries: unknown[] = [{ fact: `${fact}blocked.KP` }];
  for (const [name, body] of Object.entries(files)) {
    const text = JSON.stringify(body);
    writeFileSync(join(root, SOURCES, name), text);
    if (sha[name] === 'none') continue;
    entries.push({ fact: `${fact}${name.slice(0, -5)}`, value: { file: `${SOURCES}/${name}`, sha256: sha[name] ?? createHash('sha256').update(text).digest('hex') } });
  }
  mkdirSync(join(root, 'research'), { recursive: true });
  writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
  return root;
}

describe('the national numbers compile', () => {
  it('takes a number to its name, issuer, form, and what the research states', () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/papers/numbers', 'src/papers/numbers/numbers.json']);
    expect([WHEN, WHO, NEEDED]).toEqual([['birth', 'registration', 'application', 'work'], ['citizens', 'residents', 'workers', 'anyone'], ['work', 'bank', 'pay', 'tax', 'health']]);
    expect(compileNumber('CA', file())).toStrictEqual({ name: 'Social Insurance Number', issuer: 'Service Canada', format: { length: 9, pattern: '[0-9]{9}', check: 'luhn' }, when: 'application', who: ['citizens', 'residents'] });
    const full = compileNumber('CA', file({ format: { length: 9, pattern: '\\d{9}' }, from: 12, fee: '0', within: { n: 0, unit: 'day' }, needed: ['work', 'tax'] }));
    expect(full).toStrictEqual({ name: 'Social Insurance Number', issuer: 'Service Canada', format: { length: 9, pattern: '\\d{9}' }, when: 'application', from: 12, who: ['citizens', 'residents'], fee: { currency: 'CAD', minor: 0 }, within: { n: 0, unit: 'day' }, needed: ['work', 'tax'] });
    // A fee in another currency than the country's names it.
    expect(compileNumber('CA', file({ fee: '12.5', currency: 'USD' })).fee).toStrictEqual({ currency: 'USD', minor: 1250 });
    expect(compileNumber('BR', file({ country: 'BR', format: { length: 11, pattern: '\\d{11}', check: 'br-cpf' }, when: 'birth', from: 0, who: ['anyone'] })).from).toBe(0);
  });

  it('refuses a number that is not what it says it is', () => {
    expect(() => compileNumber('XX', file())).toThrow('XX is not a country on the map');
    expect(() => compileNumber('US', file())).toThrow("US's file is for CA");
    expect(() => compileNumber('CA', file({ issuedBy: 'US' }))).toThrow('CA has no term issuedBy');
    for (const name of [undefined, '', 7]) expect(() => compileNumber('CA', file({ name }))).toThrow("CA's number needs its name");
    for (const issuer of [undefined, '', 7]) expect(() => compileNumber('CA', file({ issuer }))).toThrow("CA's number needs its issuer");
    expect(() => compileNumber('CA', file({ format: 'nine digits' }))).toThrow("CA's format is not an object");
    expect(() => compileNumber('CA', file({ format: { length: 9, pattern: 'x', spaces: true } }))).toThrow("CA's format has no term spaces");
    for (const length of [undefined, 0, 1.5, '9']) expect(() => compileNumber('CA', file({ format: { length, pattern: 'x' } }))).toThrow("CA's number is a whole number of characters long");
    expect(compileNumber('CA', file({ format: { length: 1, pattern: 'x' } })).format.length).toBe(1);
    // A length that varies: the fewest it takes, fewer than its most.
    expect(compileNumber('PA', file({ country: 'PA', format: { length: 10, min: 3, pattern: 'x' } })).format).toStrictEqual({ length: 10, min: 3, pattern: 'x' });
    expect(compileNumber('PA', file({ country: 'PA', format: { length: 2, min: 1, pattern: 'x' } })).format).toStrictEqual({ length: 2, min: 1, pattern: 'x' });
    for (const min of [0, 1.5, '3', 10, 11]) expect(() => compileNumber('CA', file({ format: { length: 10, min, pattern: 'x' } })), String(min)).toThrow(`CA's number is ${String(min)} characters long at the fewest, fewer than its 10 at the most`);
    // No most, where the source sets none: then a fewest is needed.
    expect(compileNumber('KN', file({ country: 'KN', format: { min: 1, pattern: '\\d+' } })).format).toStrictEqual({ min: 1, pattern: '\\d+' });
    expect(() => compileNumber('CA', file({ format: { pattern: 'x' } }))).toThrow("CA's number is a whole number of characters long");
    // A fewest doesn't excuse a most that isn't a whole number.
    expect(() => compileNumber('CA', file({ format: { length: 1.5, min: 1, pattern: 'x' } }))).toThrow("CA's number is a whole number of characters long");
    for (const min of [0, 1.5]) expect(() => compileNumber('CA', file({ format: { min, pattern: 'x' } })), String(min)).toThrow(`CA's number is ${String(min)} characters long at the fewest, fewer than its undefined at the most`);
    for (const pattern of [undefined, '', 7]) expect(() => compileNumber('CA', file({ format: { length: 9, pattern } }))).toThrow("CA's number has a pattern");
    expect(() => compileNumber('CA', file({ format: { length: 9, pattern: '[0-9' } }))).toThrow("CA's pattern isn't a regular expression ([0-9)");
    expect(() => compileNumber('CA', file({ format: { length: 9, pattern: 'x', check: 'verhoeff' } }))).toThrow("CA's number is checked by verhoeff, which the game doesn't compute");
    for (const when of [undefined, 'death']) expect(() => compileNumber('CA', file({ when }))).toThrow("CA's number is given at birth, registration, application, work");
    for (const who of [undefined, [], 'citizens', ['aliens'], ['citizens', 'aliens'], ['citizens', 'citizens']]) expect(() => compileNumber('CA', file({ who }))).toThrow("CA's who is a list of distinct terms from citizens, residents, workers, anyone");
    for (const from of [-1, 1.5, '12']) expect(() => compileNumber('CA', file({ from }))).toThrow("CA's number is given from a whole age");
    expect(() => compileNumber('CA', file({ fee: 5 }))).toThrow("CA's fee is an amount written out in major units");
    expect(() => compileNumber('CA', file({ fee: '1.234' }))).toThrow("CA's fee has more decimals than CAD has");
    expect(() => compileNumber('CA', file({ fee: '1', currency: 'XXX' }))).toThrow("CA's fees are in XXX, not a currency in use");
    expect(() => compileNumber('CA', file({ within: { n: 3 } }))).toThrow("CA's within is a whole number of minutes, hours, days, working days, weeks or months");
    expect(() => compileNumber('CA', file({ needed: ['vote'] }))).toThrow("CA's needed is a list of distinct terms from work, bank, pay, tax, health");
  });

  it('reads the shared terms as the other papers do', () => {
    expect(amount('46', 'EUR', 'x')).toStrictEqual({ currency: 'EUR', minor: 4600 });
    for (const text of ['-1', '1,5', '1.', '.5', ' 1', '1 ']) expect(() => amount(text, 'EUR', 'the fee'), text).toThrow('the fee is an amount written out in major units');
    expect(within({ n: 3, unit: 'working day' }, 'x')).toStrictEqual({ n: 3, unit: 'working day' });
    for (const w of [null, [], { n: -1, unit: 'day' }, { n: 1.5, unit: 'day' }, { n: 1, unit: 'year' }, { n: 1, unit: 'day', or: 2 }]) expect(() => within(w, 'the time'), JSON.stringify(w)).toThrow('the time is a whole number of minutes, hours, days, working days, weeks or months');
    expect(terms(['a', 'b'], ['a', 'b', 'c'], 'x')).toEqual(['a', 'b']);
    expect(() => terms(['a', 'a'], ['a'], 'the list')).toThrow('the list is a list of distinct terms from a');
    expect([currencyIn('CA', {}), currencyIn('CA', { currency: 'USD' })]).toEqual(['CAD', 'USD']);
    // Antarctica has no currency of its own, so its file names one.
    expect(() => currencyIn('AQ', {})).toThrow("AQ's fees are in , not a currency in use");
  });

  it('takes a country that gives none to none, and a territory to the country whose number its people hold', () => {
    expect(compileNone('DE', { country: 'DE', none: true, note: 'x', sources: [] })).toStrictEqual({ none: true });
    expect(() => compileNone('XX', { country: 'XX', none: true })).toThrow('XX is not a country on the map');
    expect(() => compileNone('DE', { country: 'DE', none: 'yes' })).toThrow("DE's file says it gives none only as none: true");
    expect(() => compileNone('DE', { country: 'DE', none: true, name: 'x' })).toThrow('DE, which gives no number, has no term name');
    expect(compileIssued('GU', { country: 'GU', issuedBy: 'US', note: 'x', sources: [] }, 'numbers')).toStrictEqual({ issuedBy: 'US' });
    expect(() => compileIssued('XX', { country: 'XX', issuedBy: 'US' }, 'numbers')).toThrow('XX is not a country on the map');
    for (const issuedBy of ['XX', 'GU', 7]) expect(() => compileIssued('GU', { country: 'GU', issuedBy }, 'permits')).toThrow(`GU's permits are given by another country on the map, not ${String(issuedBy)}`);
    expect(() => compileIssued('GU', { country: 'GU', issuedBy: 'US', name: 'x' }, 'numbers')).toThrow("GU, whose numbers are US's, has no term name");
    const ca = compileNumber('CA', file());
    expect(() => checkIssuers({ CA: ca, DE: { none: true }, GU: { issuedBy: 'CA' }, AT: { issuedBy: 'DE' } }, 'numbers')).not.toThrow();
    expect(() => checkIssuers({ CA: ca, GU: { issuedBy: 'US' } }, 'numbers')).toThrow("GU's numbers are US's, which the game doesn't keep in its own right");
    expect(() => checkIssuers({ CA: ca, GU: { issuedBy: 'CA' }, AS: { issuedBy: 'GU' } }, 'permits')).toThrow("AS's permits are GU's, which the game doesn't keep in its own right");
  });

  it('reads only files the register cites, as cited, and nothing where none is written', () => {
    expect(readCited(repo({}), 'research/sources/papers/nowhere', 'papers.numbers.')).toEqual([]);
    // Written out of order: the files are read in the order of their names.
    const ok = repo({ 'DE.json': { country: 'DE', none: true }, 'CA.json': file(), 'GU.json': { country: 'GU', issuedBy: 'CA' }, 'notes.txt': 'x' });
    const numbers = readNumbers(ok);
    expect(Object.keys(numbers)).toEqual(['CA', 'DE', 'GU']);
    expect(numbers).toStrictEqual({ CA: compileNumber('CA', file()), DE: { none: true }, GU: { issuedBy: 'CA' } });
    expect(() => readNumbers(repo({ 'CA.json': file() }, { 'CA.json': '0'.repeat(64) }))).toThrow(`${SOURCES}/CA.json isn't the file the register cites`);
    expect(() => readNumbers(repo({ 'CA.json': file() }, { 'CA.json': 'none' }))).toThrow(`${SOURCES}/CA.json isn't cited by the register`);
    // A citation by another engine's fact doesn't count.
    expect(() => readNumbers(repo({ 'CA.json': file() }, {}, 'papers.ids.'))).toThrow(`${SOURCES}/CA.json isn't cited by the register`);
    expect(() => readNumbers(repo({ 'GU.json': { country: 'GU', issuedBy: 'US' } }))).toThrow("GU's numbers are US's, which the game doesn't keep in its own right");
    expect(() => readNumbers(repo({ 'GU.json': { country: 'GU', issuedBy: 'XX' } }))).toThrow("GU's numbers are given by another country on the map, not XX");
    expect(serialize({ DE: { none: true } })).toBe('{\n "DE": {\n  "none": true\n }\n}\n');
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readNumbers(ROOT)));
  });
});

describe('the national numbers coverage', () => {
  it('is researched where compiled and cited, blocked where the register holds a blocker, proven where no one is born', () => {
    const facts = new Map([['papers.numbers.CA', 'R-1'], ['papers.numbers.blocked.KP', 'R-3'], ['papers.numbers.blocked.CA', 'R-4']]);
    const rows = numbersCoverage(['CA', 'KP', 'FR', 'AQ', 'CZ'], new Set(['CA', 'KP', 'FR', 'CZ']), new Set(['CA', 'CZ']), facts);
    expect(rows).toEqual([
      { key: 'CA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'FR', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // Compiled but not cited: not researched.
      { key: 'CZ', status: 'pending' },
    ]);
    expect(coverageBy('papers.x', ['t'], 'told')(['KP'], new Set(['KP']), new Set(), new Map([['papers.x.blocked.KP', 'R-9']]))).toEqual([{ key: 'KP', status: 'blocked', register: ['R-9'], tests: ['t', 'told'] }]);
    expect(TESTS).toEqual(["tests/papers/numbers/numbers.test.ts::the national numbers > are each country's own", 'tests/papers/numbers/numbers.places.test.ts::the national numbers > for every place on the map']);
    expect(TOLD).toBe("tests/papers/numbers/numbers.test.ts::the national numbers > tell the player what the game doesn't know");
    expect(serializeBy('papers.numbers', rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.numbers', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('reads the gazetteer, the compiled file and the register', () => {
    const { countries, withPlaces, compiled, facts } = inputsOf(ROOT, 'src/papers/ids/ids.json');
    expect(countries).toHaveLength(252);
    expect([withPlaces.has('DE'), withPlaces.has('AQ'), compiled.has('DE'), compiled.has('LY')]).toEqual([true, false, true, false]);
    expect(facts.get('papers.ids.DE')).toMatch(/^R-\d+$/);
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/numbers-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
