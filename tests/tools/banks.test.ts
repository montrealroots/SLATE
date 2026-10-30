import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { money } from '../../src/core/money/money.ts';
import { atm, bank, changes, compileCountry, day, debit, fee, interest, opening, OUTPUT, overdraft, PAPERS, PERIODS, rate, readBanks, savings, serialize, SOURCES, transfers, waiver } from '../../tools/money/banks/compile.ts';
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
    expect(waiver({ national: true }, 'USD', 'w')).toStrictEqual({ national: true });
    for (const v of [false, 'true', 1]) expect(() => waiver({ national: v }, 'USD', 'w'), String(v)).toThrow("w's national is true");
    expect([waiver({ first: 1 }, 'USD', 'w'), waiver({ first: 60 }, 'USD', 'w')]).toStrictEqual([{ first: 1 }, { first: 60 }]);
    for (const first of [0, 61, 1.5, '1', null]) expect(() => waiver({ first }, 'USD', 'w'), String(first)).toThrow("w's first is a whole number from 1 to 60");
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
    for (const f of [null, 'F', []]) expect(() => fee(f, 'USD', 'f'), String(f)).toThrow('f is not an object');
    expect(() => fee({ fee: '1', per: 'month', waved: [{ from: 60 }] }, 'USD', 'f')).toThrow('f has no term waved');
    expect(() => fee({}, 'USD', 'f')).toThrow('f is an amount written in major units');
    for (const figure of [undefined, 1, '-1']) expect(() => fee({ fee: figure, per: 'month' }, 'USD', 'f'), String(figure)).toThrow('f is an amount written in major units');
    expect(() => fee({ fee: '0', per: 'month' }, 'USD', 'f')).toThrow('f is above nothing, or suspended until a change');
    for (const per of [undefined, 'week', 'Month']) expect(() => fee({ fee: '1', per }, 'USD', 'f'), String(per)).toThrow(`f is charged by the month, two months, the quarter, the half year or the year, not ${String(per)}`);
    for (const waived of [[], {}, 'x']) expect(() => fee({ fee: '1', per: 'month', waived }, 'USD', 'f'), JSON.stringify(waived)).toThrow("f's waivers are a list of conditions");
    expect(() => fee({ fee: '1', per: 'month', waived: [{ from: 60 }, { x: 1 }] }, 'USD', 'f')).toThrow("f's waiver 1 names a condition the game doesn't check (x)");
  });

  it('takes a fee to the figures its price list gives from later days', () => {
    expect([day('2027-01-01', 'd'), day('2024-02-29', 'd')]).toEqual(['2027-01-01', '2024-02-29']);
    for (const d of ['2027-02-29', '2027-04-31', '2027-01-32', '2027-13-01', '2027-00-10', '2027-1-1', ' 2027-01-01', '2027-01-011', 20270101, undefined]) expect(() => day(d, 'd'), String(d)).toThrow('d is a date written YYYY-MM-DD');
    expect(changes([{ from: '2027-01-01', fee: '46.11' }, { from: '2028-01-01', fee: '0' }], 'EUR', 'c')).toStrictEqual([{ from: '2027-01-01', fee: money('EUR', 4611) }, { from: '2028-01-01', fee: money('EUR', 0) }]);
    for (const list of [[], {}, undefined]) expect(() => changes(list, 'EUR', 'c'), JSON.stringify(list)).toThrow('c are a list of dates and figures');
    expect(() => changes([{ from: '2027-01-01', fee: '1' }, { from: '2027-01-01', fee: '2' }], 'EUR', 'c')).toThrow('c are in order of their dates');
    expect(() => changes([{ from: '2027-01-02', fee: '1' }, { from: '2027-01-01', fee: '2' }], 'EUR', 'c')).toThrow('c are in order of their dates');
    expect(() => changes([{ from: '2027-01-01', fee: '-1' }], 'EUR', 'c')).toThrow("c' 0 is an amount written in major units");
    expect(() => changes([null], 'EUR', 'c')).toThrow("c' 0 is a date written YYYY-MM-DD");
    expect(fee({ fee: '44.68', per: 'quarter', changes: [{ from: '2027-01-01', fee: '46.11' }] }, 'EUR', 'f')).toStrictEqual({ fee: money('EUR', 4468), per: 'quarter', changes: [{ from: '2027-01-01', fee: money('EUR', 4611) }] });
    expect(() => fee({ fee: '1', per: 'month', changes: 'x' }, 'EUR', 'f')).toThrow("f's changes are a list of dates and figures");
    // A fee suspended until a day: nothing now, its figure from the change.
    expect(fee({ fee: '0', per: 'half', changes: [{ from: '2027-07-01', fee: '1000' }] }, 'AMD', 'f')).toStrictEqual({ fee: money('AMD', 0), per: 'half', changes: [{ from: '2027-07-01', fee: money('AMD', 100_000) }] });
  });

  it("takes a bank to its account and its fees, in the country's currency or its own", () => {
    expect(bank({ bank: 'B', account: 'A', fees: [] }, 'GBP', 'b')).toStrictEqual({ bank: 'B', account: 'A', currency: 'GBP', fees: [] });
    expect(bank({ bank: 'B', account: 'A', fees: [{ fee: '6.90', per: 'month' }, { fee: '2', per: 'month', waived: [{ average: '5000' }] }] }, 'EUR', 'b')).toStrictEqual({
      bank: 'B',
      account: 'A',
      currency: 'EUR',
      fees: [{ fee: money('EUR', 690), per: 'month' }, { fee: money('EUR', 200), per: 'month', waived: [{ average: money('EUR', 500_000) }] }],
    });
    expect(bank({ bank: 'B', account: 'A', currency: 'USD', fees: [{ fee: '2', per: 'year' }] }, 'KHR', 'b')).toStrictEqual({ bank: 'B', account: 'A', currency: 'USD', fees: [{ fee: money('USD', 200), per: 'year' }] });
  });

  it('refuses a bank that is not one', () => {
    for (const b of [null, 'B', []]) expect(() => bank(b, 'USD', 'b'), String(b)).toThrow('b is not an object');
    expect(() => bank({}, 'USD', 'b')).toThrow('b names the bank');
    expect(() => bank({ bank: 'B', account: 'A', fees: [], overdrafts: false }, 'USD', 'b')).toThrow('b has no term overdrafts');
    for (const name of [undefined, '', ' B', 'B ', 7]) expect(() => bank({ bank: name, account: 'A', fees: [] }, 'USD', 'b'), String(name)).toThrow('b names the bank');
    for (const account of [undefined, '', 'A ', 7]) expect(() => bank({ bank: 'B', account, fees: [] }, 'USD', 'b'), String(account)).toThrow('b names the account the bank sells');
    for (const currency of ['XXX', 7, null]) expect(() => bank({ bank: 'B', account: 'A', currency, fees: [] }, 'USD', 'b'), String(currency)).toThrow(`b's currency is not one in use (${String(currency)})`);
    for (const fees of [undefined, '0', {}]) expect(() => bank({ bank: 'B', account: 'A', fees }, 'USD', 'b'), String(fees)).toThrow("b's fees are a list, empty where the account costs nothing");
    expect(() => bank({ bank: 'B', account: 'A', fees: [{ fee: '1', per: 'month' }, { fee: '0', per: 'month' }] }, 'USD', 'b')).toThrow("b's fee 1 is above nothing, or suspended until a change");
    expect(() => bank({ bank: 'B', account: 'A', currency: 'JPY', fees: [{ fee: '1.5', per: 'month' }] }, 'USD', 'b')).toThrow();
  });

  it("takes a country's file to its banks, in its currency, none named twice", () => {
    expect(compileCountry('DE', { country: 'DE', banks: [{ bank: 'B', account: 'A', fees: [{ fee: '1', per: 'month' }] }], note: 'x', sources: [] })).toStrictEqual([{ bank: 'B', account: 'A', currency: 'EUR', fees: [{ fee: money('EUR', 100), per: 'month' }] }]);
    expect(compileCountry('JP', { country: 'JP', banks: [{ bank: 'B', account: 'A', fees: [] }, { bank: 'B', account: 'C', fees: [{ fee: '110', per: 'month' }] }] })).toStrictEqual([
      { bank: 'B', account: 'A', currency: 'JPY', fees: [] },
      { bank: 'B', account: 'C', currency: 'JPY', fees: [{ fee: money('JPY', 110), per: 'month' }] },
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
    expect(readBanks(root)).toStrictEqual({ countries: { GB: [{ bank: 'B', account: 'A', currency: 'GBP', fees: [] }] } });
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

describe("the banks compile's account terms", () => {
  const usd = (minor: number) => money('USD', minor);

  it('takes a rate by the year or the month, within the cards\' ceilings', () => {
    expect(rate({ percent: '19.9', per: 'year' }, 'r')).toStrictEqual({ percent: '19.9', per: 'year' });
    expect([rate({ percent: '300', per: 'year' }, 'r'), rate({ percent: '25', per: 'month' }, 'r')]).toStrictEqual([{ percent: '300', per: 'year' }, { percent: '25', per: 'month' }]);
    expect(() => rate({ percent: '300.01', per: 'year' }, 'r')).toThrow("r's percent is above 300");
    expect(() => rate({ percent: '25.01', per: 'month' }, 'r')).toThrow("r's percent is above 25");
    expect(() => rate({ percent: 2, per: 'year' }, 'r')).toThrow("r's percent is a decimal written as text");
    for (const per of [undefined, 'week']) expect(() => rate({ percent: '1', per }, 'r'), String(per)).toThrow(`r is a rate by the month or the year, not ${String(per)}`);
    expect(() => rate({}, 'r')).toThrow('r names none of percent, per');
    expect(() => rate({ percent: '1', per: 'year', effective: true }, 'r')).toThrow('r has no term effective');
    for (const r of [null, '1', []]) expect(() => rate(r, 'r'), String(r)).toThrow('r is not an object');
  });

  it('takes the interest the bank pays, above a figure where it says so', () => {
    expect(interest({ percent: '0.01', per: 'year' }, 'USD', 'i')).toStrictEqual({ percent: '0.01', per: 'year' });
    expect(interest({ percent: '4.5', per: 'year', over: '1000' }, 'USD', 'i')).toStrictEqual({ percent: '4.5', per: 'year', over: usd(100_000) });
    expect(() => interest({ percent: '4.5', per: 'year', over: '0' }, 'USD', 'i')).toThrow("i's over is an amount above nothing, written in major units");
    expect(() => interest({}, 'USD', 'i')).toThrow('i names none of percent, per, over');
    expect(() => interest({ percent: '1', per: 'day' }, 'USD', 'i')).toThrow('i is a rate by the month or the year, not day');
    expect(() => interest({ percent: '1', per: 'year', above: '1' }, 'USD', 'i')).toThrow('i has no term above');
  });

  it("takes an overdraft to false, or its terms, a charge for one item at nothing where it's free", () => {
    expect(overdraft(false, 'GBP', 'o')).toBe(false);
    expect(overdraft({}, 'GBP', 'o')).toStrictEqual({});
    expect(overdraft({ rate: { percent: '39.49', per: 'year' }, fee: '0', monthly: '5', limit: '250' }, 'GBP', 'o')).toStrictEqual({
      rate: { percent: '39.49', per: 'year' },
      fee: money('GBP', 0),
      monthly: money('GBP', 500),
      limit: money('GBP', 25_000),
    });
    expect(overdraft({ fee: '35' }, 'USD', 'o')).toStrictEqual({ fee: usd(3500) });
    for (const o of [true, null, 'none', []]) expect(() => overdraft(o, 'GBP', 'o'), String(o)).toThrow('o is not an object');
    expect(() => overdraft({ rate: { percent: '1' } }, 'GBP', 'o')).toThrow("o's rate is a rate by the month or the year, not undefined");
    expect(() => overdraft({ fee: '-1' }, 'GBP', 'o')).toThrow("o's fee is an amount written in major units");
    expect(() => overdraft({ monthly: 5 }, 'GBP', 'o')).toThrow("o's monthly is an amount written in major units");
    expect(() => overdraft({ limit: '0' }, 'GBP', 'o')).toThrow("o's limit is an amount above nothing, written in major units");
    expect(() => overdraft({ buffer: '25' }, 'GBP', 'o')).toThrow('o has no term buffer');
  });

  it('takes the debit card to its fee, read as an account fee is, and its share on another currency', () => {
    expect(debit({ fee: { fee: '12', per: 'year', waived: [{ first: 1 }] }, fx: '2.75' }, 'USD', 'd')).toStrictEqual({ fee: { fee: usd(1200), per: 'year', waived: [{ first: 1 }] }, fx: '2.75' });
    expect(debit({ fx: '0' }, 'USD', 'd')).toStrictEqual({ fx: '0' });
    expect(debit({ fee: { fee: '1', per: 'month' } }, 'USD', 'd')).toStrictEqual({ fee: { fee: usd(100), per: 'month' } });
    expect(() => debit({ fee: { fee: '12', per: 'week' } }, 'USD', 'd')).toThrow("d's fee is charged by the month, two months, the quarter, the half year or the year, not week");
    expect(() => debit({ fx: '100.01' }, 'USD', 'd')).toThrow("d's fx is above 100");
    expect(() => debit({}, 'USD', 'd')).toThrow('d names none of fee, fx');
    expect(() => debit({ fx: '1', atm: '1' }, 'USD', 'd')).toThrow('d has no term atm');
  });

  it("takes each withdrawal and each transfer sent, at home at nothing where it's free, abroad as the cards' charge", () => {
    expect(atm({ own: '0', other: '2.50', abroad: { percent: '2', fixed: '5', min: '5', max: '20' } }, 'USD', 'a')).toStrictEqual({ own: usd(0), other: usd(250), abroad: { percent: '2', fixed: usd(500), min: usd(500), max: usd(2000) } });
    expect(atm({ abroad: { fixed: '3' } }, 'USD', 'a')).toStrictEqual({ abroad: { fixed: usd(300) } });
    expect(() => atm({ own: '-1' }, 'USD', 'a')).toThrow("a's own is an amount written in major units");
    expect(() => atm({ other: '1.234' }, 'USD', 'a')).toThrow();
    expect(() => atm({ other: 2 }, 'USD', 'a')).toThrow("a's other is an amount written in major units");
    expect(() => atm({ abroad: {} }, 'USD', 'a')).toThrow("a's abroad is a share, a fixed sum, or both");
    expect(() => atm({ abroad: { percent: '1', of: 'balance' } }, 'USD', 'a')).toThrow("a's abroad names a base only for a share");
    expect(() => atm({}, 'USD', 'a')).toThrow('a names none of own, other, abroad');
    expect(() => atm({ home: '1' }, 'USD', 'a')).toThrow('a has no term home');
    expect(transfers({ domestic: '0', abroad: { fixed: '45' } }, 'USD', 't')).toStrictEqual({ domestic: usd(0), abroad: { fixed: usd(4500) } });
    expect(transfers({ abroad: { percent: '0.5', min: '10' } }, 'EUR', 't')).toStrictEqual({ abroad: { percent: '0.5', min: money('EUR', 1000) } });
    expect(() => transfers({ domestic: '-1' }, 'USD', 't')).toThrow("t's domestic is an amount written in major units");
    expect(() => transfers({ abroad: { fixed: '0' } }, 'USD', 't')).toThrow("t's abroad's fixed is an amount above nothing, written in major units");
    expect(() => transfers({}, 'USD', 't')).toThrow('t names none of domestic, abroad');
    expect(() => transfers({ sepa: '0' }, 'USD', 't')).toThrow('t has no term sepa');
  });

  it('takes what opening the account asks: a deposit, an age, residence, papers each once', () => {
    expect(PAPERS).toEqual(['passport', 'id', 'number', 'residence', 'address']);
    expect(opening({ deposit: '25', from: 18, residents: true, papers: ['passport', 'id', 'number', 'residence', 'address'] }, 'USD', 'o')).toStrictEqual({
      deposit: usd(2500),
      from: 18,
      residents: true,
      papers: ['passport', 'id', 'number', 'residence', 'address'],
    });
    expect(opening({ from: 1 }, 'USD', 'o')).toStrictEqual({ from: 1 });
    expect(opening({ papers: ['id'] }, 'USD', 'o')).toStrictEqual({ papers: ['id'] });
    expect(() => opening({ deposit: '0' }, 'USD', 'o')).toThrow("o's deposit is an amount above nothing, written in major units");
    for (const from of [0, 121, 17.5, '18']) expect(() => opening({ from }, 'USD', 'o'), String(from)).toThrow("o's from is an age in whole years");
    for (const residents of [false, 'true']) expect(() => opening({ residents }, 'USD', 'o'), String(residents)).toThrow("o's residents is true");
    for (const papers of [[], 'passport', ['visa'], ['id', 'passport', 'id']]) expect(() => opening({ papers }, 'USD', 'o'), JSON.stringify(papers)).toThrow("o's papers are a list of passport, id, number, residence, address, each once");
    expect(() => opening({}, 'USD', 'o')).toThrow('o names none of deposit, from, residents, papers');
    expect(() => opening({ age: 18 }, 'USD', 'o')).toThrow('o has no term age');
  });

  it("takes the bank's savings account to its name, its interest, its fees and its minimum", () => {
    expect(savings({ account: 'S', interest: { percent: '4.1', per: 'year' } }, 'USD', 's')).toStrictEqual({ account: 'S', interest: { percent: '4.1', per: 'year' } });
    expect(savings({ account: 'S', interest: { percent: '0.5', per: 'month', over: '100' }, fees: [], minimum: '300' }, 'USD', 's')).toStrictEqual({
      account: 'S',
      interest: { percent: '0.5', per: 'month', over: usd(10_000) },
      fees: [],
      minimum: usd(30_000),
    });
    expect(savings({ account: 'S', interest: { percent: '1', per: 'year' }, fees: [{ fee: '5', per: 'month', waived: [{ balance: '300' }] }] }, 'USD', 's').fees).toStrictEqual([{ fee: usd(500), per: 'month', waived: [{ balance: usd(30_000) }] }]);
    for (const account of [undefined, '', ' S']) expect(() => savings({ account, interest: { percent: '1', per: 'year' } }, 'USD', 's'), String(account)).toThrow('s names the account the bank sells');
    expect(() => savings({ account: 'S' }, 'USD', 's')).toThrow("s's interest is not an object");
    expect(() => savings({ account: 'S', interest: { percent: '1', per: 'year' }, fees: {} }, 'USD', 's')).toThrow("s's fees are a list, empty where the account costs nothing");
    expect(() => savings({ account: 'S', interest: { percent: '1', per: 'year' }, fees: [{ fee: '0', per: 'month' }] }, 'USD', 's')).toThrow("s's fee 0 is above nothing, or suspended until a change");
    expect(() => savings({ account: 'S', interest: { percent: '1', per: 'year' }, minimum: '0' }, 'USD', 's')).toThrow("s's minimum is an amount above nothing, written in major units");
    expect(() => savings({ account: 'S', interest: { percent: '1', per: 'year' }, rate: '1' }, 'USD', 's')).toThrow('s has no term rate');
  });

  it("takes a bank to every term it states, in the account's currency, and none it doesn't", () => {
    const b = bank(
      {
        bank: 'B',
        account: 'A',
        currency: 'EUR',
        fees: [],
        overdraft: { limit: '500' },
        returned: '10',
        interest: { percent: '0.1', per: 'year' },
        debit: { fx: '1.5' },
        atm: { own: '0' },
        transfers: { domestic: '0' },
        opening: { residents: true },
        savings: { account: 'S', interest: { percent: '2', per: 'year' } },
      },
      'USD',
      'b',
    );
    expect(b).toStrictEqual({
      bank: 'B',
      account: 'A',
      currency: 'EUR',
      fees: [],
      overdraft: { limit: money('EUR', 50_000) },
      returned: money('EUR', 1000),
      interest: { percent: '0.1', per: 'year' },
      debit: { fx: '1.5' },
      atm: { own: money('EUR', 0) },
      transfers: { domestic: money('EUR', 0) },
      opening: { residents: true },
      savings: { account: 'S', interest: { percent: '2', per: 'year' } },
    });
    expect(bank({ bank: 'B', account: 'A', fees: [], overdraft: false, returned: '0' }, 'USD', 'b')).toStrictEqual({ bank: 'B', account: 'A', currency: 'USD', fees: [], overdraft: false, returned: usd(0) });
    expect(() => bank({ bank: 'B', account: 'A', fees: [], overdraft: true }, 'USD', 'b')).toThrow("b's overdraft is not an object");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], returned: '-1' }, 'USD', 'b')).toThrow("b's returned is an amount written in major units");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], interest: {} }, 'USD', 'b')).toThrow("b's interest names none of percent, per, over");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], debit: {} }, 'USD', 'b')).toThrow("b's debit names none of fee, fx");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], atm: {} }, 'USD', 'b')).toThrow("b's atm names none of own, other, abroad");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], transfers: {} }, 'USD', 'b')).toThrow("b's transfers names none of domestic, abroad");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], opening: {} }, 'USD', 'b')).toThrow("b's opening names none of deposit, from, residents, papers");
    expect(() => bank({ bank: 'B', account: 'A', fees: [], savings: {} }, 'USD', 'b')).toThrow("b's savings names none of account, interest, fees, minimum");
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
