import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileLevels, currencyUnits, FROM, OUTPUT, readLevels, sameCurrency, serialize, SOURCES, UNIT_WORDS } from '../../tools/prices/compile.ts';
import { COVERAGE, coverageOf, CURRENCY_FACTS, NO_PLACES, pricesCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/prices/coverage.ts';

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

describe('the price levels compiler', () => {
  it("reproduces the levels the engine reads, byte for byte, from the World Bank's files as the register cites them", () => {
    const { levels, unmapped } = readLevels(ROOT);
    expect(serialize(levels)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(unmapped).toEqual([]);
    expect(Object.keys(levels)).toHaveLength(172);
    expect([levels['US'], levels['BG'], levels['JP'], levels['QA']]).toEqual([
      { ppp: '1', year: 2025 },
      { ppp: '0.414616944167498', year: 2025 },
      { ppp: '103.33658', year: 2025 },
      { ppp: '2.75548696215787', year: 2024 },
    ]);
    expect([OUTPUT, FROM]).toEqual(['src/world/prices/levels.json', 2024]);
  });
  it.each(Object.keys(SOURCES) as (keyof typeof SOURCES)[])("refuses a %s file that isn't the one the register cites", (which) => {
    const root = mkdtempSync(join(tmpdir(), 'prices-'));
    mkdirSync(join(root, 'vendor/worldbank'), { recursive: true });
    mkdirSync(join(root, 'src/world/gazetteer'), { recursive: true });
    for (const s of Object.values(SOURCES)) copyFileSync(join(ROOT, s.file), join(root, s.file));
    copyFileSync(join(ROOT, 'src/world/gazetteer/countries.json'), join(root, 'src/world/gazetteer/countries.json'));
    expect(Object.keys(readLevels(root).levels)).toHaveLength(172);
    writeFileSync(join(root, SOURCES[which].file), 'changed');
    expect(() => readLevels(root)).toThrow(`${SOURCES[which].file} isn't the file the register cites`);
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
  });
  it("refuses a level that isn't a decimal above zero, or one in another currency than the country's", () => {
    expect(() => compileLevels([row('US', '2025', 0)], ECONOMIES, UNITS, CURRENCIES)).toThrow("the World Bank's level for US in 2025 isn't a decimal more than zero (0)");
    expect(() => compileLevels([row('US', '2025', -1)], ECONOMIES, UNITS, CURRENCIES)).toThrow("isn't a decimal more than zero (-1)");
    expect(() => compileLevels([row('US', '2025', 1e-7)], ECONOMIES, UNITS, CURRENCIES)).toThrow("isn't a decimal more than zero (1e-7)");
    expect(() => compileLevels([row('US', '2025', 1e21)], ECONOMIES, UNITS, CURRENCIES)).toThrow("isn't a decimal more than zero (1e+21)");
    expect(() => compileLevels([row('US', '2025', 1)], ECONOMIES, UNITS, { US: 'JPY' })).toThrow('the World Bank prices US in U.S. dollar, not JPY');
    expect(() => compileLevels([row('US', '2025', 1)], ECONOMIES, new Map(), CURRENCIES)).toThrow('the World Bank prices US in no currency it names, not USD');
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
  ]);
  it('is researched where a level is kept, blocked where the register holds why not, pending otherwise, and proven where no place is', () => {
    const rows = pricesCoverage(['US', 'KP', 'TW', 'AQ'], new Set(['US', 'KP', 'TW']), new Set(['US', 'AQ']), facts);
    expect(rows).toStrictEqual([
      { key: 'US', status: 'researched', register: ['R-0001', 'R-0002', 'R-0003'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-0009'], tests: [...TESTS, TOLD] },
      { key: 'TW', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
    ]);
    // Without the levels' register entry, a level isn't researched.
    expect(pricesCoverage(['US'], new Set(['US']), new Set(['US']), new Map())).toStrictEqual([{ key: 'US', status: 'pending' }]);
    expect(CURRENCY_FACTS).toEqual(['world.gazetteer.countries', 'money.iso4217.list-one']);
    expect(TESTS).toEqual(["tests/world/prices/prices.test.ts::the prices > are the World Bank's levels, in each country's own currency", 'tests/world/prices/prices.test.ts::the prices > at every place on the map']);
    expect(TOLD).toBe("tests/world/prices/prices.test.ts::the prices > tell the player where a country's aren't kept");
    expect(NO_PLACES).toBe('tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own');
  });
  it('is the matrix the gate reads, byte for byte', () => {
    expect(COVERAGE).toBe('coverage/prices-countries.json');
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([{ key: 'TW', status: 'pending' }])).toBe('{\n "engine": "world.prices",\n "axis": "country",\n "rows": [\n  {\n   "key": "TW",\n   "status": "pending"\n  }\n ]\n}\n');
  });
});
