import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { money } from '../../src/core/money/money.ts';
import { card, compileCountry, fee, OUTPUT, rate, RATE_PERIODS, readCards, serialize, SOURCES, waiver } from '../../tools/money/cards/compile.ts';
import { cardsCoverage, COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD } from '../../tools/money/cards/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('the cards compile', () => {
  it('takes a rate to its percent and its period, or a charge card to in full', () => {
    expect([SOURCES, OUTPUT, RATE_PERIODS]).toEqual(['research/sources/money/cards', 'src/money/cards/cards.json', ['month', 'year']]);
    expect(rate({ percent: '27.99', per: 'year' }, 'r')).toStrictEqual({ percent: '27.99', per: 'year' });
    expect(rate({ percent: '3', per: 'month' }, 'r')).toStrictEqual({ percent: '3', per: 'month' });
    expect(rate({ percent: '0', per: 'year' }, 'r')).toStrictEqual({ percent: '0', per: 'year' });
    expect(rate('in full', 'r')).toBe('in full');
    // The ceilings themselves are figures a bank can state; above them, a misreading.
    expect(rate({ percent: '300', per: 'year' }, 'r')).toStrictEqual({ percent: '300', per: 'year' });
    expect(rate({ percent: '25.0', per: 'month' }, 'r')).toStrictEqual({ percent: '25.0', per: 'month' });
    expect(() => rate({ percent: '300.01', per: 'year' }, 'r')).toThrow("r's percent is above what a bank charges by the year");
    expect(() => rate({ percent: '25.01', per: 'month' }, 'r')).toThrow("r's percent is above what a bank charges by the month");
    // A yearly rate the bank states only as effective is marked so; nothing else is.
    expect(rate({ percent: '95.90', per: 'year', effective: true }, 'r')).toStrictEqual({ percent: '95.90', per: 'year', effective: true });
    for (const r of [{ percent: '2', per: 'month', effective: true }, { percent: '9', per: 'year', effective: false }, { percent: '9', per: 'year', effective: 'true' }])
      expect(() => rate(r, 'r'), JSON.stringify(r)).toThrow('r is effective only as a yearly rate, marked true');
    expect(() => rate({ percent: '300.01', per: 'year', effective: true }, 'r')).toThrow("r's percent is above what a bank charges by the year");
  });

  it("refuses a rate that isn't one", () => {
    for (const r of [null, 'in Full', 24, undefined]) expect(() => rate(r, 'r'), String(r)).toThrow("r is a percent and the period it's charged by, or in full");
    for (const per of [undefined, 'day', 'Year']) expect(() => rate({ percent: '1', per }, 'r'), String(per)).toThrow(`r is charged by the month or the year, not ${String(per)}`);
    for (const percent of [24.99, '-1', '24,99', '.5', '5.', '1e2', ' 5', undefined]) expect(() => rate({ percent, per: 'year' }, 'r'), String(percent)).toThrow("r's percent is a decimal written as text");
  });

  it('takes a fee waived by spending, or as an account fee is', () => {
    expect(waiver({ spend: '10000' }, 'HKD', 'w')).toStrictEqual({ spend: money('HKD', 1_000_000) });
    expect(waiver({ spend: '0.01' }, 'USD', 'w')).toStrictEqual({ spend: money('USD', 1) });
    expect(waiver({ under: 26 }, 'USD', 'w')).toStrictEqual({ under: 26 });
    for (const spend of ['0', '-1', 100, undefined]) expect(() => waiver({ spend }, 'USD', 'w'), String(spend)).toThrow("w's spend is an amount above nothing, written in major units");
    expect(() => waiver({ spend: '1', under: 26 }, 'USD', 'w')).toThrow('w names one condition');
    for (const w of [null, 'x', 7]) expect(() => waiver(w, 'USD', 'w'), String(w)).toThrow('w names one condition');
    expect(fee({ fee: '39.00', per: 'year' }, 'EUR', 'f')).toStrictEqual({ fee: money('EUR', 3900), per: 'year' });
    expect(fee({ fee: '1800', per: 'year', waived: [{ spend: '10000' }, { from: 60 }] }, 'HKD', 'f')).toStrictEqual({ fee: money('HKD', 180_000), per: 'year', waived: [{ spend: money('HKD', 1_000_000) }, { from: 60 }] });
    for (const f of [null, 'F']) expect(() => fee(f, 'USD', 'f'), String(f)).toThrow('f is not an object');
    for (const waived of [[], {}, 'x']) expect(() => fee({ fee: '1', per: 'year', waived }, 'USD', 'f'), JSON.stringify(waived)).toThrow("f's waivers are a list of conditions");
    expect(() => fee({ fee: '1', per: 'year', waived: [{ spend: '1' }, { x: 1 }] }, 'USD', 'f')).toThrow("f's waiver 1 names a condition the game doesn't check (x)");
    expect(() => fee({ fee: '0', per: 'year' }, 'USD', 'f')).toThrow('f is above nothing, or suspended until a change');
  });

  it("takes a card to its bank, its rate and its fees, in the country's currency or its own", () => {
    expect(card({ bank: 'B', card: 'C', rate: { percent: '24', per: 'year' }, fees: [] }, 'GBP', 'c')).toStrictEqual({ bank: 'B', card: 'C', rate: { percent: '24', per: 'year' }, fees: [] });
    expect(card({ bank: 'B', card: 'C', currency: 'USD', rate: 'in full', fees: [{ fee: '25', per: 'year' }] }, 'KHR', 'c')).toStrictEqual({ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: money('USD', 2500), per: 'year' }] });
    for (const c of [null, 'C']) expect(() => card(c, 'USD', 'c'), String(c)).toThrow('c is not an object');
    for (const bank of [undefined, '', ' B', 7]) expect(() => card({ bank, card: 'C', rate: 'in full', fees: [] }, 'USD', 'c'), String(bank)).toThrow('c names the bank');
    for (const name of [undefined, '', 'C ', 7]) expect(() => card({ bank: 'B', card: name, rate: 'in full', fees: [] }, 'USD', 'c'), String(name)).toThrow('c names the card the bank sells');
    for (const currency of ['XXX', 7, null]) expect(() => card({ bank: 'B', card: 'C', currency, rate: 'in full', fees: [] }, 'USD', 'c'), String(currency)).toThrow(`c's currency is not one in use (${String(currency)})`);
    for (const fees of [undefined, '0', {}]) expect(() => card({ bank: 'B', card: 'C', rate: 'in full', fees }, 'USD', 'c'), String(fees)).toThrow("c's fees are a list, empty where the card costs nothing to hold");
    expect(() => card({ bank: 'B', card: 'C', fees: [] }, 'USD', 'c')).toThrow("c's rate is a percent and the period it's charged by, or in full");
    expect(() => card({ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: '1', per: 'year' }, { fee: '0', per: 'year' }] }, 'USD', 'c')).toThrow("c's fee 1 is above nothing, or suspended until a change");
  });

  it("takes a country's file to its cards, in its currency, none named twice", () => {
    expect(compileCountry('DE', { country: 'DE', cards: [{ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: '39', per: 'year' }] }], note: 'x', sources: [] })).toStrictEqual([{ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: money('EUR', 3900), per: 'year' }] }]);
    expect(() => compileCountry('XX', { country: 'XX', cards: [] })).toThrow('XX is not a country on the map');
    expect(() => compileCountry('DE', { country: 'FR', cards: [] })).toThrow("DE's file is for FR");
    for (const cards of [undefined, [], 'x']) expect(() => compileCountry('DE', { country: 'DE', cards }), JSON.stringify(cards)).toThrow('DE names no card');
    const c = { bank: 'B', card: 'C', rate: 'in full', fees: [] };
    expect(() => compileCountry('DE', { country: 'DE', cards: [c, { ...c, rate: { percent: '9', per: 'year' } }] })).toThrow("DE names B's C twice");
    expect(() => compileCountry('DE', { country: 'DE', cards: [c, { ...c, card: '' }] })).toThrow("DE's card 1 names the card the bank sells");
    // Two banks may sell a card of the same name, and a bank two cards.
    expect(compileCountry('DE', { country: 'DE', cards: [c, { ...c, bank: 'D' }, { ...c, card: 'E' }] }).map((x) => `${x.bank} ${x.card}`)).toEqual(['B C', 'D C', 'B E']);
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'cards-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const file = `${JSON.stringify({ country: 'GB', cards: [{ bank: 'B', card: 'C', rate: 'in full', fees: [] }] })}\n`;
    writeFileSync(join(root, SOURCES, 'GB.json'), file);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = createHash('sha256').update(file).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    mkdirSync(join(root, 'research'), { recursive: true });
    register([{ fact: 'money.cards.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }]);
    expect(readCards(root)).toStrictEqual({ countries: { GB: [{ bank: 'B', card: 'C', rate: 'in full', fees: [] }] } });
    register([{ fact: 'money.cards.GB', value: { file: `${SOURCES}/GB.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readCards(root)).toThrow(`${SOURCES}/GB.json isn't the file the register cites`);
    register([{ fact: 'money.banks.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }, { fact: 'money.cards.blocked.FR' }]);
    expect(() => readCards(root)).toThrow(`${SOURCES}/GB.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readCards(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ countries: {} })).toBe('{\n "countries": {}\n}\n');
  });
});

describe('the cards coverage', () => {
  it('rows each country researched, blocked, pending, or proven with no place', () => {
    const facts = new Map([['money.cards.GB', 'R-1'], ['money.cards.blocked.FR', 'R-2'], ['money.cards.DE', 'R-3'], ['money.banks.IT', 'R-4']]);
    expect(cardsCoverage(['GB', 'FR', 'IT', 'AQ', 'DE'], new Set(['GB', 'FR', 'IT', 'DE']), new Set(['GB', 'IT']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      // The banks' fact isn't the cards'.
      { key: 'IT', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // A file the register cites but the compile didn't take is no research.
      { key: 'DE', status: 'pending' },
    ]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TOLD, TESTS]).toEqual([
      'coverage/cards-countries.json',
      "tests/money/cards/cards.test.ts::cards > tell the player what the game doesn't know",
      ["tests/money/cards/cards.test.ts::cards > name each country's credit cards, their interest and their fees", 'tests/money/cards/cards.places.test.ts::cards > for every place on the map'],
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.cards",\n "axis": "country",\n "rows": []\n}\n');
  });
});
