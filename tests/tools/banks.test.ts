import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { money } from '../../src/core/money/money.ts';
import { bank, changes, compileCountry, day, fee, OUTPUT, PERIODS, readBanks, serialize, SOURCES, waiver } from '../../tools/money/banks/compile.ts';
import { banksCoverage, COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD } from '../../tools/money/banks/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('the banks compile', () => {
  it('takes a condition to the waiver the game checks', () => {
    expect([SOURCES, OUTPUT, PERIODS]).toEqual(['research/sources/money/banks', 'src/money/banks/banks.json', ['month', 'bimonth', 'quarter', 'half', 'year']]);
    expect(waiver({ deposits: '500' }, 'USD', 'w')).toStrictEqual({ deposits: money('USD', 50_000) });
    expect(waiver({ balance: '1500.00' }, 'USD', 'w')).toStrictEqual({ balance: money('USD', 150_000) });
    expect(waiver({ average: '0.01' }, 'USD', 'w')).toStrictEqual({ average: money('USD', 1) });
    expect(waiver({ under: 26 }, 'USD', 'w')).toStrictEqual({ under: 26 });
    expect(waiver({ from: 1 }, 'USD', 'w')).toStrictEqual({ from: 1 });
    expect(waiver({ from: 120 }, 'USD', 'w')).toStrictEqual({ from: 120 });
  });

  it('refuses a condition the game can\'t check', () => {
    for (const w of [null, 'x', {}, { under: 26, from: 60 }]) expect(() => waiver(w, 'USD', 'w'), JSON.stringify(w)).toThrow('w names one condition');
    expect(() => waiver({ student: true }, 'USD', 'w')).toThrow("w names a condition the game doesn't check (student)");
    for (const v of [500, '-1.00', '1.234']) expect(() => waiver({ deposits: v }, 'USD', 'w'), String(v)).toThrow();
    expect(() => waiver({ deposits: 500 }, 'USD', 'w')).toThrow("w's deposits is an amount written in major units");
    expect(() => waiver({ deposits: '-1.00' }, 'USD', 'w')).toThrow("w's deposits is an amount written in major units");
    expect(() => waiver({ balance: '0' }, 'USD', 'w')).toThrow("w's balance is above nothing");
    for (const age of [0, 121, 2.5, '26', null]) expect(() => waiver({ under: age }, 'USD', 'w'), String(age)).toThrow("w's under is an age in whole years");
  });

  it('takes a fee to its figure, its period and its waivers', () => {
    expect(fee({ fee: '6.90', per: 'month' }, 'EUR', 'f')).toStrictEqual({ fee: money('EUR', 690), per: 'month' });
    expect(fee({ fee: '0.01', per: 'year', waived: [{ from: 65 }] }, 'USD', 'f')).toStrictEqual({ fee: money('USD', 1), per: 'year', waived: [{ from: 65 }] });
    expect(fee({ fee: '15', per: 'quarter', waived: [{ deposits: '500' }] }, 'USD', 'f').waived).toStrictEqual([{ deposits: money('USD', 50_000) }]);
    for (const f of [null, 'F']) expect(() => fee(f, 'USD', 'f'), String(f)).toThrow('f is not an object');
    for (const figure of [undefined, 1, '-1']) expect(() => fee({ fee: figure, per: 'month' }, 'USD', 'f'), String(figure)).toThrow('f is an amount written in major units');
    expect(() => fee({ fee: '0', per: 'month' }, 'USD', 'f')).toThrow('f is above nothing');
    for (const per of [undefined, 'week', 'Month']) expect(() => fee({ fee: '1', per }, 'USD', 'f'), String(per)).toThrow(`f is charged by the month, two months, the quarter, the half year or the year, not ${String(per)}`);
    for (const waived of [[], {}, 'x']) expect(() => fee({ fee: '1', per: 'month', waived }, 'USD', 'f'), JSON.stringify(waived)).toThrow("f's waivers are a list of conditions");
    expect(() => fee({ fee: '1', per: 'month', waived: [{ from: 60 }, { x: 1 }] }, 'USD', 'f')).toThrow("f's waiver 1 names a condition the game doesn't check (x)");
  });

  it('takes a fee to the figures its price list gives from later days', () => {
    expect([day('2027-01-01', 'd'), day('2024-02-29', 'd')]).toEqual(['2027-01-01', '2024-02-29']);
    for (const d of ['2027-02-29', '2027-13-01', '2027-00-10', '2027-1-1', ' 2027-01-01', 20270101, undefined]) expect(() => day(d, 'd'), String(d)).toThrow('d is a date written YYYY-MM-DD');
    expect(changes([{ from: '2027-01-01', fee: '46.11' }, { from: '2028-01-01', fee: '0' }], 'EUR', 'c')).toStrictEqual([{ from: '2027-01-01', fee: money('EUR', 4611) }, { from: '2028-01-01', fee: money('EUR', 0) }]);
    for (const list of [[], {}, undefined]) expect(() => changes(list, 'EUR', 'c'), JSON.stringify(list)).toThrow('c are a list of dates and figures');
    expect(() => changes([{ from: '2027-01-01', fee: '1' }, { from: '2027-01-01', fee: '2' }], 'EUR', 'c')).toThrow('c are in order of their dates');
    expect(() => changes([{ from: '2027-01-02', fee: '1' }, { from: '2027-01-01', fee: '2' }], 'EUR', 'c')).toThrow('c are in order of their dates');
    expect(() => changes([{ from: '2027-01-01', fee: '-1' }], 'EUR', 'c')).toThrow("c' 0 is an amount written in major units");
    expect(() => changes([null], 'EUR', 'c')).toThrow("c' 0 is a date written YYYY-MM-DD");
    expect(fee({ fee: '44.68', per: 'quarter', changes: [{ from: '2027-01-01', fee: '46.11' }] }, 'EUR', 'f')).toStrictEqual({ fee: money('EUR', 4468), per: 'quarter', changes: [{ from: '2027-01-01', fee: money('EUR', 4611) }] });
    expect(() => fee({ fee: '1', per: 'month', changes: 'x' }, 'EUR', 'f')).toThrow("f's changes are a list of dates and figures");
  });

  it("takes a bank to its account and its fees, in the country's currency or its own", () => {
    expect(bank({ bank: 'B', account: 'A', fees: [] }, 'GBP', 'b')).toStrictEqual({ bank: 'B', account: 'A', fees: [] });
    expect(bank({ bank: 'B', account: 'A', fees: [{ fee: '6.90', per: 'month' }, { fee: '2', per: 'month', waived: [{ average: '5000' }] }] }, 'EUR', 'b')).toStrictEqual({
      bank: 'B',
      account: 'A',
      fees: [{ fee: money('EUR', 690), per: 'month' }, { fee: money('EUR', 200), per: 'month', waived: [{ average: money('EUR', 500_000) }] }],
    });
    expect(bank({ bank: 'B', account: 'A', currency: 'USD', fees: [{ fee: '2', per: 'year' }] }, 'KHR', 'b')).toStrictEqual({ bank: 'B', account: 'A', fees: [{ fee: money('USD', 200), per: 'year' }] });
  });

  it('refuses a bank that is not one', () => {
    for (const b of [null, 'B']) expect(() => bank(b, 'USD', 'b'), String(b)).toThrow('b is not an object');
    for (const name of [undefined, '', ' B', 'B ', 7]) expect(() => bank({ bank: name, account: 'A', fees: [] }, 'USD', 'b'), String(name)).toThrow('b names the bank');
    for (const account of [undefined, '', 'A ', 7]) expect(() => bank({ bank: 'B', account, fees: [] }, 'USD', 'b'), String(account)).toThrow('b names the account the bank sells');
    for (const currency of ['XXX', 7, null]) expect(() => bank({ bank: 'B', account: 'A', currency, fees: [] }, 'USD', 'b'), String(currency)).toThrow(`b's currency is not one in use (${String(currency)})`);
    for (const fees of [undefined, '0', {}]) expect(() => bank({ bank: 'B', account: 'A', fees }, 'USD', 'b'), String(fees)).toThrow("b's fees are a list, empty where the account costs nothing");
    expect(() => bank({ bank: 'B', account: 'A', fees: [{ fee: '1', per: 'month' }, { fee: '0', per: 'month' }] }, 'USD', 'b')).toThrow("b's fee 1 is above nothing");
    expect(() => bank({ bank: 'B', account: 'A', currency: 'JPY', fees: [{ fee: '1.5', per: 'month' }] }, 'USD', 'b')).toThrow();
  });

  it("takes a country's file to its banks, in its currency, none named twice", () => {
    expect(compileCountry('DE', { country: 'DE', banks: [{ bank: 'B', account: 'A', fees: [{ fee: '1', per: 'month' }] }], note: 'x', sources: [] })).toStrictEqual([{ bank: 'B', account: 'A', fees: [{ fee: money('EUR', 100), per: 'month' }] }]);
    expect(compileCountry('JP', { country: 'JP', banks: [{ bank: 'B', account: 'A', fees: [] }, { bank: 'B', account: 'C', fees: [{ fee: '110', per: 'month' }] }] })).toStrictEqual([
      { bank: 'B', account: 'A', fees: [] },
      { bank: 'B', account: 'C', fees: [{ fee: money('JPY', 110), per: 'month' }] },
    ]);
    expect(() => compileCountry('XX', { country: 'XX', banks: [] })).toThrow('XX is not a country on the map');
    expect(() => compileCountry('DE', { country: 'FR', banks: [] })).toThrow("DE's file is for FR");
    for (const banks of [undefined, [], 'x']) expect(() => compileCountry('DE', { country: 'DE', banks }), JSON.stringify(banks)).toThrow('DE names no bank');
    expect(() => compileCountry('DE', { country: 'DE', banks: [{ bank: 'B', account: 'A', fees: [] }, { bank: 'B', account: 'A', fees: [{ fee: '1', per: 'month' }] }] })).toThrow("DE names B's A twice");
    expect(() => compileCountry('DE', { country: 'DE', banks: [{ bank: 'B', account: 'A', fees: [] }, { bank: 'B', account: '' }] })).toThrow("DE's bank 1 names the account the bank sells");
    // Two banks may sell an account of the same name.
    expect(compileCountry('DE', { country: 'DE', banks: [{ bank: 'B', account: 'A', fees: [] }, { bank: 'C', account: 'A', fees: [] }] }).map((b) => b.bank)).toEqual(['B', 'C']);
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'banks-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const file = `${JSON.stringify({ country: 'GB', banks: [{ bank: 'B', account: 'A', fees: [] }] })}\n`;
    writeFileSync(join(root, SOURCES, 'GB.json'), file);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = createHash('sha256').update(file).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    mkdirSync(join(root, 'research'), { recursive: true });
    register([{ fact: 'money.banks.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }]);
    expect(readBanks(root)).toStrictEqual({ countries: { GB: [{ bank: 'B', account: 'A', fees: [] }] } });
    register([{ fact: 'money.banks.GB', value: { file: `${SOURCES}/GB.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readBanks(root)).toThrow(`${SOURCES}/GB.json isn't the file the register cites`);
    register([{ fact: 'papers.work.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }, { fact: 'money.banks.blocked.FR' }]);
    expect(() => readBanks(root)).toThrow(`${SOURCES}/GB.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    const banks = readBanks(ROOT);
    expect(serialize(banks)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ countries: {} })).toBe('{\n "countries": {}\n}\n');
  });
});

describe('the banks coverage', () => {
  it('rows each country researched, blocked, pending, or proven with no place', () => {
    const facts = new Map([['money.banks.GB', 'R-1'], ['money.banks.blocked.FR', 'R-2'], ['money.banks.DE', 'R-3']]);
    expect(banksCoverage(['GB', 'FR', 'IT', 'AQ', 'DE'], new Set(['GB', 'FR', 'IT', 'DE']), new Set(['GB']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      { key: 'IT', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // A file the register cites but the compile didn't take is no research.
      { key: 'DE', status: 'pending' },
    ]);
    expect(banksCoverage(['GB'], new Set(['GB']), new Set(['GB']), new Map())).toStrictEqual([{ key: 'GB', status: 'pending' }]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TOLD]).toEqual(['coverage/banks-countries.json', "tests/money/banks/banks.test.ts::banks > tell the player what the game doesn't know"]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.banks",\n "axis": "country",\n "rows": []\n}\n');
  });
});
