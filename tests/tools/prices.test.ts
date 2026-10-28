import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BENCHMARK, CARRIED_TO, carryForward, compileLevels, currencyUnits, decimal, FROM, INDICES, mean, OUTPUT, PLACES, readLevels, sameCurrency, serialize, SOURCES, UNIT_WORDS, US_INDEX, withCarried, type Indices } from '../../tools/prices/compile.ts';
import { CARRIED_FACTS, COVERAGE, coverageOf, CURRENCY_FACTS, NO_PLACES, pricesCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/prices/coverage.ts';

const ROOT = join(import.meta.dirname, '../..');

const page = (...variables: [string, [string, string][]][]) => ({ source: [{ concept: [{ variable: variables.map(([id, m]) => ({ id, metatype: m.map(([i, value]) => ({ id: i, value })) })) }] }] });
const row = (country: string, date: string, value: number | null) => ({ country: { id: country }, date, value });
const ECONOMIES = [
  { iso2Code: 'US', region: { value: 'North America' } },
  { iso2Code: 'JP', region: { value: 'East Asia & Pacific' } },
  { iso2Code: 'XD', region: { value: 'Aggregates' } },
];
const UNITS = new Map([
  ['US', 'U.S. dollar'],
  ['JP', 'Japanese yen'],
  ['XD', 'U.S. dollar'],
]);
const CURRENCIES = { US: 'USD', JP: 'JPY', XD: 'USD' };
/** The countries carried from the benchmark: one index file each, besides the United States'. */
const CARRIED = readdirSync(join(ROOT, INDICES)).length - 1;
const year = (y: number, ...values: string[]) => ({ year: y, values });
const indices = (from: string[], to: string[]): Indices => ({ from: year(2021, ...from), to: year(2025, ...to) });

/** A copy of the files the compiler reads, to change one of them. */
function copyRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'prices-'));
  mkdirSync(join(root, 'vendor/worldbank'), { recursive: true });
  mkdirSync(join(root, 'src/world/gazetteer'), { recursive: true });
  for (const s of Object.values(SOURCES)) copyFileSync(join(ROOT, s.file), join(root, s.file));
  copyFileSync(join(ROOT, 'src/world/gazetteer/countries.json'), join(root, 'src/world/gazetteer/countries.json'));
  cpSync(join(ROOT, 'research'), join(root, 'research'), { recursive: true });
  return root;
}

describe('the price levels compiler', () => {
  it("reproduces the levels the engine reads, byte for byte, from the World Bank's files as the register cites them", () => {
    const { levels, unmapped } = readLevels(ROOT);
    expect(serialize(levels)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(unmapped).toEqual([]);
    expect(Object.keys(levels)).toHaveLength(172 + CARRIED);
    expect([levels['US'], levels['BG'], levels['JP'], levels['QA']]).toEqual([
      { ppp: '1', year: 2025 },
      { ppp: '0.414616944167498', year: 2025 },
      { ppp: '103.33658', year: 2025 },
      { ppp: '2.75548696215787', year: 2024 },
    ]);
    // Argentina's 2021 level carried by INDEC's index (means 490.554858.. and 8966.166533..) over the CPI-U's (270.96975 and 321.943).
    expect([levels['AR'], levels['AD']]).toEqual([
      { ppp: '661.287794234474', year: 2025 },
      { ppp: '0.636851408291', year: 2025 },
    ]);
    expect([OUTPUT, FROM, BENCHMARK, CARRIED_TO, PLACES, INDICES, US_INDEX]).toEqual(['src/world/prices/levels.json', 2024, 2021, 2025, 12, 'research/sources/prices', 'us-cpi']);
  });
  it.each(Object.keys(SOURCES) as (keyof typeof SOURCES)[])("refuses a %s file that isn't the one the register cites", (which) => {
    const root = copyRoot();
    expect(Object.keys(readLevels(root).levels)).toHaveLength(172 + CARRIED);
    writeFileSync(join(root, SOURCES[which].file), 'changed');
    expect(() => readLevels(root)).toThrow(`${SOURCES[which].file} isn't the file the register cites`);
  });
  it.each([US_INDEX, 'AR'])("refuses an index file (%s) that isn't the one the register cites, or one it doesn't cite", (name) => {
    const root = copyRoot();
    const file = join(root, INDICES, `${name}.json`);
    writeFileSync(file, readFileSync(file, 'utf8').replace('"year": 2021', '"year":  2021'));
    expect(() => readLevels(root)).toThrow(`${INDICES}/${name}.json isn't the file the register cites`);
    const other = copyRoot();
    copyFileSync(join(other, INDICES, 'AR.json'), join(other, INDICES, 'ZZ.json'));
    expect(() => readLevels(other)).toThrow(`${INDICES}/ZZ.json isn't the file the register cites`);
  });
  it("reads each economy's currency unit, its fields merged across pages, an economy without both left out", () => {
    const units = currencyUnits([
      page(['NZL', [['2-alphacode', 'NZ']]], ['USA', [['2-alphacode', 'US'], ['CurrencyUnit', 'U.S. dollar']]]),
      { source: [] },
      { source: [{ concept: [] }] },
      page(['NZL', [['CurrencyUnit', 'New Zealand dollar']]], ['ABC', [['CurrencyUnit', 'Nothing']]], ['DEF', [['2-alphacode', 'DE']]]),
    ]);
    expect([...units]).toEqual([
      ['NZ', 'New Zealand dollar'],
      ['US', 'U.S. dollar'],
    ]);
  });
  it("matches the World Bank's name for a currency to ISO 4217's, by its last word or the word it uses instead, letters only", () => {
    expect(sameCurrency('U.S. dollar', 'USD')).toBe(true);
    expect(sameCurrency('Euro', 'EUR')).toBe(true);
    expect(sameCurrency('Japanese yen', 'JPY')).toBe(true);
    expect(sameCurrency("Tongan pa'anga", 'TOP')).toBe(true);
    expect(sameCurrency('Tongan paanga', 'TOP')).toBe(true);
    expect(sameCurrency('West African CFA franc', 'XOF')).toBe(true);
    expect(sameCurrency('Central African CFA franc', 'XAF')).toBe(true);
    expect(sameCurrency('Belarusian rubel', 'BYN')).toBe(true);
    expect(sameCurrency('Chinese yuan', 'CNY')).toBe(true);
    expect(sameCurrency('Japanese yen', 'USD')).toBe(false);
    expect(sameCurrency('Euro', 'XXX')).toBe(false);
    expect(sameCurrency('to string', 'toString')).toBe(false);
    expect(UNIT_WORDS).toEqual({ XOF: 'cfa franc', XAF: 'cfa franc', BYN: 'rubel', CNY: 'yuan', ILS: 'shekel', NIO: 'cordoba', QAR: 'riyal', UYU: 'peso', UZS: 'som' });
  });
  it("keeps each country's latest level from 2024 on, leaving out aggregates, gaps and economies the map hasn't", () => {
    const rows = [row('JP', '2025', null), row('JP', '2024', 100.5), row('US', '2024', 1.5), row('US', '2025', 1), row('US', '2023', 2), row('XD', '2025', 3), row('ZZ', '2025', 4), row('YY', '2024', 5), row('CA', '2023', 1.3)];
    const { levels, unmapped } = compileLevels(rows, ECONOMIES, UNITS, CURRENCIES);
    expect(levels).toStrictEqual({ JP: { ppp: '100.5', year: 2024 }, US: { ppp: '1', year: 2025 } });
    expect(Object.keys(levels)).toEqual(['JP', 'US']);
    expect(unmapped).toEqual(['YY', 'ZZ']);
    // The later year is kept whichever comes first; an earlier one after it doesn't replace it.
    expect(compileLevels([row('US', '2025', 1), row('US', '2024', 1.5)], ECONOMIES, UNITS, CURRENCIES).levels).toStrictEqual({ US: { ppp: '1', year: 2025 } });
    expect(compileLevels([row('US', '2024', 1.5), row('US', '2024', 1.25)], ECONOMIES, UNITS, CURRENCIES).levels).toStrictEqual({ US: { ppp: '1.5', year: 2024 } });
    expect(compileLevels([], ECONOMIES, UNITS, CURRENCIES)).toStrictEqual({ levels: {}, unmapped: [] });
    expect(Object.keys(compileLevels([row('US', '2025', 1), row('JP', '2025', 100)], ECONOMIES, UNITS, CURRENCIES).levels)).toEqual(['JP', 'US']);
  });
  it("refuses a level that isn't a decimal above zero, or one in another currency than the country's", () => {
    expect(() => compileLevels([row('US', '2025', 0)], ECONOMIES, UNITS, CURRENCIES)).toThrow("the World Bank's level for US in 2025 isn't a decimal more than zero (0)");
    expect(() => compileLevels([row('US', '2025', -1)], ECONOMIES, UNITS, CURRENCIES)).toThrow("isn't a decimal more than zero (-1)");
    expect(() => compileLevels([row('US', '2025', 1e-7)], ECONOMIES, UNITS, CURRENCIES)).toThrow("isn't a decimal more than zero (1e-7)");
    expect(() => compileLevels([row('US', '2025', 1e21)], ECONOMIES, UNITS, CURRENCIES)).toThrow("isn't a decimal more than zero (1e+21)");
    expect(() => compileLevels([row('US', '2025', 1)], ECONOMIES, UNITS, { US: 'JPY' })).toThrow('the World Bank prices US in U.S. dollar, not JPY');
    expect(() => compileLevels([row('US', '2025', 1)], ECONOMIES, new Map(), CURRENCIES)).toThrow('the World Bank prices US in no currency it names, not USD');
  });
  it("averages a year's index exactly, and refuses one for another year, without values, or with one not above zero", () => {
    expect(mean(year(2021, '100'), 2021, 'AD')).toStrictEqual({ num: 100n, den: 1n });
    expect(mean(year(2021, '1.5', '2.25', '3'), 2021, 'AD')).toStrictEqual({ num: 6750n, den: 3000n });
    expect(() => mean(year(2020, '100'), 2021, 'AD')).toThrow("AD's index is for 2020, not 2021");
    expect(() => mean(year(2021), 2021, 'AD')).toThrow("AD's index for 2021 has no values");
    expect(() => mean(year(2021, '1', '0'), 2021, 'AD')).toThrow("AD's index for 2021 has 0, not above zero");
    expect(() => mean(year(2021, '-1'), 2021, 'AD')).toThrow("AD's index for 2021 has -1, not above zero");
    expect(() => mean(year(2021, '1e3'), 2021, 'AD')).toThrow('"1e3" is not a decimal number');
  });
  it('writes a level to twelve places, half to even, without trailing zeros', () => {
    expect(decimal(1n, 3n)).toBe('0.333333333333');
    expect(decimal(2n, 3n)).toBe('0.666666666667');
    expect(decimal(5n, 1_000_000_000_000_0n)).toBe('0');
    expect(decimal(15n, 1_000_000_000_000_0n)).toBe('0.000000000002');
    expect(decimal(25n, 1_000_000_000_000_0n)).toBe('0.000000000002');
    expect(decimal(3n, 2n)).toBe('1.5');
    expect(decimal(1234n, 1n)).toBe('1234');
    expect(decimal(1n, 100n)).toBe('0.01');
  });
  it("carries a benchmark level by the country's index over the United States', as the World Bank's own example does", () => {
    // Senegal's 226.6, its index up 9.6% where the United States' rose 8.1% (the World Bank's help desk): 229.7.
    expect(carryForward('226.6', indices(['100'], ['109.6']), indices(['100'], ['108.1']), 'SN')).toBe('229.744310823312');
    expect(carryForward('2', indices(['1', '3'], ['4']), indices(['5'], ['10', '20']), 'SN')).toBe('1.333333333333');
    expect(() => carryForward('2', { from: year(2020, '1'), to: year(2025, '1') }, indices(['1'], ['1']), 'SN')).toThrow("SN's index is for 2020, not 2021");
    expect(() => carryForward('2', { from: year(2021, '1'), to: year(2024, '1') }, indices(['1'], ['1']), 'SN')).toThrow("SN's index is for 2024, not 2025");
    expect(() => carryForward('2', indices(['1'], ['1']), { from: year(2020, '1'), to: year(2025, '1') }, 'SN')).toThrow("US's index is for 2020, not 2021");
    expect(() => carryForward('2', indices(['1'], ['1']), { from: year(2021, '1'), to: year(2024, '1') }, 'SN')).toThrow("US's index is for 2024, not 2025");
  });
  it('adds the carried levels to the World Bank\'s, refusing a country it prices already, one without a benchmark, or one in another currency', () => {
    const us = indices(['100'], ['110']);
    const kept = { US: { ppp: '1', year: 2025 } };
    const benchmark = [row('JP', '2020', 90), row('JP', '2021', 100), row('US', '2021', 1)];
    expect(withCarried(kept, benchmark, us, { JP: indices(['100'], ['121']) }, UNITS, CURRENCIES)).toStrictEqual({ JP: { ppp: '110', year: 2025 }, US: { ppp: '1', year: 2025 } });
    expect(Object.keys(withCarried({ ZZ: { ppp: '1', year: 2025 } }, benchmark, us, { JP: indices(['100'], ['121']) }, UNITS, CURRENCIES))).toEqual(['JP', 'ZZ']);
    expect(withCarried(kept, benchmark, us, {}, UNITS, CURRENCIES)).toStrictEqual(kept);
    expect(() => withCarried(kept, benchmark, us, { US: us }, UNITS, CURRENCIES)).toThrow("the World Bank prices US from 2024 on; its own index isn't needed");
    expect(() => withCarried(kept, [row('JP', '2020', 90)], us, { JP: us }, UNITS, CURRENCIES)).toThrow('the World Bank has no 2021 level for JP');
    expect(() => withCarried(kept, [row('JP', '2021', null)], us, { JP: us }, UNITS, CURRENCIES)).toThrow('the World Bank has no 2021 level for JP');
    expect(() => withCarried(kept, benchmark, us, { JP: us }, UNITS, { JP: 'USD' })).toThrow('the World Bank prices JP in Japanese yen, not USD');
    expect(() => withCarried(kept, benchmark, us, { JP: us }, new Map(), CURRENCIES)).toThrow('the World Bank prices JP in no currency it names, not JPY');
    expect(() => withCarried(kept, benchmark, us, { JP: us }, UNITS, {})).toThrow('the World Bank prices JP in Japanese yen, not none');
  });
  it('writes the levels one field to a line, ending in a newline', () => {
    expect(serialize({ US: { ppp: '1', year: 2025 } })).toBe('{\n "US": {\n  "ppp": "1",\n  "year": 2025\n }\n}\n');
  });
});

describe("the prices' coverage", () => {
  const facts = new Map([
    ['world.prices.ppp', 'R-0003'],
    ['world.gazetteer.countries', 'R-0002'],
    ['money.iso4217.list-one', 'R-0001'],
    ['world.prices.blocked.KP', 'R-0009'],
    ['world.prices.ppp-2021', 'R-0004'],
    ['world.prices.us-cpi', 'R-0005'],
    ['world.prices.AR', 'R-0006'],
  ]);
  it('is researched where a level is kept, blocked where the register holds why not, pending otherwise, and proven where no place is', () => {
    const rows = pricesCoverage(['US', 'AR', 'KP', 'TW', 'AQ'], new Set(['US', 'AR', 'KP', 'TW']), new Set(['US', 'AR', 'AQ']), facts);
    expect(rows).toStrictEqual([
      { key: 'US', status: 'researched', register: ['R-0001', 'R-0002', 'R-0003'], tests: TESTS },
      { key: 'AR', status: 'researched', register: ['R-0001', 'R-0002', 'R-0004', 'R-0005', 'R-0006'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-0009'], tests: [...TESTS, TOLD] },
      { key: 'TW', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
    ]);
    // Without the levels' register entry, a level isn't researched.
    expect(pricesCoverage(['US'], new Set(['US']), new Set(['US']), new Map())).toStrictEqual([{ key: 'US', status: 'pending' }]);
    // Nor a country whose own index the register cites, without a level.
    expect(pricesCoverage(['AR'], new Set(['AR']), new Set(), facts)).toStrictEqual([{ key: 'AR', status: 'pending' }]);
    expect(CURRENCY_FACTS).toEqual(['world.gazetteer.countries', 'money.iso4217.list-one']);
    expect(CARRIED_FACTS).toEqual(['world.prices.ppp-2021', 'world.prices.us-cpi']);
    expect(TESTS).toEqual(["tests/world/prices/prices.test.ts::the prices > are the World Bank's levels, or carried from its benchmark, in each country's own currency", 'tests/world/prices/prices.test.ts::the prices > at every place on the map']);
    expect(TOLD).toBe("tests/world/prices/prices.test.ts::the prices > tell the player where a country's aren't kept");
    expect(NO_PLACES).toBe('tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own');
  });
  it('is the matrix the gate reads, byte for byte', () => {
    expect(COVERAGE).toBe('coverage/prices-countries.json');
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([{ key: 'TW', status: 'pending' }])).toBe('{\n "engine": "world.prices",\n "axis": "country",\n "rows": [\n  {\n   "key": "TW",\n   "status": "pending"\n  }\n ]\n}\n');
  });
});
