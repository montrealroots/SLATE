import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BENCHMARK, CARRIED_TO, carryForward, keptLevel, relativeLevel, compileLevels, currencyUnits, decimal, FROM, icpBenchmark, INDICES, mean, OUTPUT, PLACES, readLevels, sameCurrency, serialize, SOURCES, threeLetterCodes, UNIT_WORDS, US_INDEX, withCarried, type Indices } from '../../tools/prices/compile.ts';
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
/** The countries carried from the benchmark or priced against another: one file each, besides the indices others are carried against. */
const CARRIED = readdirSync(join(ROOT, INDICES)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).length;
const year = (y: number, ...values: string[]) => ({ year: y, values });
const indices = (from: string[], to: string[]): Indices => ({ from: year(2021, ...from), to: year(2025, ...to) });

/** A copy of the files the compiler reads, to change one of them. */
function copyRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'prices-'));
  mkdirSync(join(root, 'src/world/gazetteer'), { recursive: true });
  for (const s of Object.values(SOURCES)) {
    mkdirSync(dirname(join(root, s.file)), { recursive: true });
    copyFileSync(join(ROOT, s.file), join(root, s.file));
  }
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
    // Guadeloupe, priced against France: France's 0.732501 euros x INSEE's 2022 gap (1.158), carried by the two indices.
    expect(levels['GP']).toEqual({ ppp: '0.848586213156', year: 2025 });
    // The Caribbean Netherlands, from the Program's level for Bonaire (part of it) carried by Bonaire's index.
    expect(levels['BQ']).toEqual({ ppp: '0.734067268186', year: 2025 });
    // Mayotte's 2022 is given through 2023, across its change of method.
    expect(levels['YT']).toEqual({ ppp: '0.81394825101', year: 2025 });
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
  it('takes a year given through the next as each value over one plus its change, and refuses changes not matching or not above -100%', () => {
    const through = (values: string[], changes: string[]) => mean({ year: 2022, values, changes }, 2022, 'YT');
    expect(through(['105.6', '103'], ['5.6', '3'])).toStrictEqual({ num: 217536000n, den: 2175360n });
    expect(decimal(...(Object.values(through(['99', '201.99'], ['-1', '-99.99'])) as [bigint, bigint]))).toBe('1010000');
    expect(() => through(['100'], ['-100'])).toThrow("YT's index for 2022 has a change of -100%, not above -100%");
    expect(() => through(['100'], ['-100.5'])).toThrow("YT's index for 2022 has a change of -100.5%, not above -100%");
    expect(() => through(['100', '101'], ['1'])).toThrow("YT's index for 2022 has 2 values and 1 changes");
    expect(() => through(['100'], ['1', '2'])).toThrow("YT's index for 2022 has 1 values and 2 changes");
    expect(() => through(['100'], ['x'])).toThrow('"x" is not a decimal number');
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
    expect(carryForward('226.6', indices(['100'], ['109.6']), indices(['100'], ['108.1']), 'SN')).toStrictEqual({ ppp: '229.744310823312', year: 2025 });
    expect(carryForward('2', indices(['1', '3'], ['4']), indices(['5'], ['10', '20']), 'SN')).toStrictEqual({ ppp: '1.333333333333', year: 2025 });
    expect(() => carryForward('2', { from: year(2020, '1'), to: year(2025, '1') }, indices(['1'], ['1']), 'SN')).toThrow("SN's index is for 2020, not 2021");
    expect(() => carryForward('2', indices(['1'], ['1']), { from: year(2020, '1'), to: year(2025, '1') }, 'SN')).toThrow("US's index is for 2020, not 2021");
    // An index that stops at 2024 is carried to 2024, against the United States' 2024; none before 2024 or after 2025.
    const us = { ...indices(['10'], ['13']), also: [year(2023, '11'), year(2024, '12')] };
    expect(carryForward('2', { from: year(2021, '1'), to: year(2024, '1.5') }, us, 'SN')).toStrictEqual({ ppp: '2.5', year: 2024 });
    expect(carryForward('2', indices(['1'], ['1.3']), us, 'SN')).toStrictEqual({ ppp: '2', year: 2025 });
    expect(() => carryForward('2', { from: year(2021, '1'), to: year(2024, '1') }, indices(['1'], ['1']), 'SN')).toThrow("the United States' index has no 2024");
    expect(() => carryForward('2', { from: year(2021, '1'), to: year(2023, '1') }, us, 'SN')).toThrow("SN's index is carried to 2023, not a year from 2024 to 2025");
    expect(() => carryForward('2', { from: year(2021, '1'), to: year(2026, '1') }, us, 'SN')).toThrow("SN's index is carried to 2026, not a year from 2024 to 2025");
    expect(() => carryForward('2', indices(['1'], ['1']), { from: year(2021, '1'), to: year(2024, '1') }, 'SN')).toThrow("the United States' index has no 2025");
  });
  it("prices a country against another's level by the gap a survey measured, carried by the two indices", () => {
    const rel = { to: 'FR', gap: '1.1', year: 2022, index: 'fr-cpi' };
    const fr = { from: year(2022, '100'), to: year(2025, '110') };
    const own = { from: year(2022, '50', '150'), to: year(2025, '121') };
    // 0.8 x 1.1 x (121 / 100) / (110 / 100) = 0.968
    expect(relativeLevel({ ppp: '0.8', year: 2025 }, own, rel, fr, 'GP')).toStrictEqual({ ppp: '0.968', year: 2025 });
    expect(relativeLevel({ ppp: '0.8', year: 2024 }, { ...own, to: year(2024, '110') }, rel, { ...fr, to: year(2024, '100') }, 'GP')).toStrictEqual({ ppp: '0.968', year: 2024 });
    expect(() => relativeLevel(undefined, own, rel, fr, 'GP')).toThrow("GP is priced against FR, which the World Bank doesn't price from 2024 on");
    expect(() => relativeLevel({ ppp: '0.8', year: 2025 }, own, rel, undefined, 'GP')).toThrow("GP is carried by fr-cpi, which isn't among the indices");
    expect(() => relativeLevel({ ppp: '0.8', year: 2025 }, { ...own, from: year(2021, '1') }, rel, fr, 'GP')).toThrow("GP's index is for 2021, not 2022");
    expect(() => relativeLevel({ ppp: '0.8', year: 2025 }, own, rel, { ...fr, from: year(2021, '1') }, 'GP')).toThrow("FR's index is for 2021, not 2022");
    expect(() => relativeLevel({ ppp: '0.8', year: 2024 }, own, rel, fr, 'GP')).toThrow("GP's index is for 2025, not 2024");
    expect(() => relativeLevel({ ppp: '0.8', year: 2024 }, { ...own, to: year(2024, '1') }, rel, fr, 'GP')).toThrow("FR's index is for 2025, not 2024");
    // Through the levels: against the World Bank's own level, in the same currency only.
    const levels = { FR: { ppp: '0.8', year: 2025 } };
    const relative = { ...own, relative: rel };
    expect(withCarried(levels, [], { 'fr-cpi': fr }, { GP: relative }, new Map(), { FR: 'EUR', GP: 'EUR' })).toStrictEqual({ FR: { ppp: '0.8', year: 2025 }, GP: { ppp: '0.968', year: 2025 } });
    expect(() => withCarried(levels, [], { 'fr-cpi': fr }, { GP: relative }, new Map(), { FR: 'EUR', GP: 'USD' })).toThrow("GP is priced against FR, whose currency isn't its own");
  });
  it("keeps another country's level for a territory with none of its own, in its own currency, pegged where it isn't the same", () => {
    const ch = { ppp: '1.065544', year: 2025 };
    expect(keptLevel(ch, { of: 'CH' }, 'LI', { LI: 'CHF', CH: 'CHF' })).toStrictEqual(ch);
    expect(keptLevel({ ppp: '0.7', year: 2024 }, { of: 'GB', peg: '1' }, 'GI', { GI: 'GIP', GB: 'GBP' })).toStrictEqual({ ppp: '0.7', year: 2024 });
    expect(keptLevel({ ppp: '0.7', year: 2025 }, { of: 'GB', peg: '2.5' }, 'XX', { XX: 'GIP', GB: 'GBP' })).toStrictEqual({ ppp: '1.75', year: 2025 });
    expect(() => keptLevel(undefined, { of: 'CH' }, 'LI', { LI: 'CHF', CH: 'CHF' })).toThrow("LI keeps CH's level, which isn't priced");
    expect(() => keptLevel(ch, { of: 'CH' }, 'LI', { LI: 'EUR', CH: 'CHF' })).toThrow("LI's currency is EUR and CH's CHF: a peg is given only between two");
    expect(() => keptLevel(ch, { of: 'CH', peg: '1' }, 'LI', { LI: 'CHF', CH: 'CHF' })).toThrow("LI's currency is CHF and CH's CHF: a peg is given only between two");
    // Through the levels: after the carried ones, so a territory may keep one of those.
    const levels = { CH: ch };
    expect(withCarried(levels, [row('NC', '2021', 100)], { [US_INDEX]: indices(['1'], ['1']) }, { WF: { of: 'NC' }, LI: { of: 'CH' }, NC: indices(['1'], ['1.1']) }, new Map([['NC', 'CFP franc']]), { CH: 'CHF', LI: 'CHF', NC: 'XPF', WF: 'XPF' })).toStrictEqual({
      CH: ch,
      LI: ch,
      NC: { ppp: '110', year: 2025 },
      WF: { ppp: '110', year: 2025 },
    });
  });
  it('adds the carried levels to the World Bank\'s, refusing a country it prices already, one without a benchmark, or one in another currency', () => {
    const us = indices(['100'], ['110']);
    const kept = { US: { ppp: '1', year: 2025 } };
    const benchmark = [row('JP', '2020', 90), row('JP', '2021', 100), row('US', '2021', 1)];
    expect(withCarried(kept, benchmark, { [US_INDEX]: us }, { JP: indices(['100'], ['121']) }, UNITS, CURRENCIES)).toStrictEqual({ JP: { ppp: '110', year: 2025 }, US: { ppp: '1', year: 2025 } });
    expect(Object.keys(withCarried({ ZZ: { ppp: '1', year: 2025 } }, benchmark, { [US_INDEX]: us }, { JP: indices(['100'], ['121']) }, UNITS, CURRENCIES))).toEqual(['JP', 'ZZ']);
    expect(withCarried(kept, benchmark, { [US_INDEX]: us }, {}, UNITS, CURRENCIES)).toStrictEqual(kept);
    // Where two benchmarks price a country, the first is taken (the World Bank's indicators' own, before the Program's).
    expect(withCarried(kept, [...benchmark, row('JP', '2021', 50)], { [US_INDEX]: us }, { JP: indices(['100'], ['121']) }, UNITS, CURRENCIES).JP).toStrictEqual({ ppp: '110', year: 2025 });
    expect(() => withCarried(kept, benchmark, { [US_INDEX]: us }, { US: us }, UNITS, CURRENCIES)).toThrow("the World Bank prices US from 2024 on; its own index isn't needed");
    expect(() => withCarried(kept, [row('JP', '2020', 90)], { [US_INDEX]: us }, { JP: us }, UNITS, CURRENCIES)).toThrow('the World Bank has no 2021 level for JP');
    expect(() => withCarried(kept, [row('JP', '2021', null)], { [US_INDEX]: us }, { JP: us }, UNITS, CURRENCIES)).toThrow('the World Bank has no 2021 level for JP');
    expect(() => withCarried(kept, benchmark, { [US_INDEX]: us }, { JP: us }, UNITS, { JP: 'USD' })).toThrow('the World Bank prices JP in Japanese yen, not USD');
    expect(() => withCarried(kept, benchmark, { [US_INDEX]: us }, { JP: us }, new Map(), CURRENCIES)).toThrow('the World Bank prices JP in no currency it names, not JPY');
    expect(() => withCarried(kept, benchmark, { [US_INDEX]: us }, { JP: us }, UNITS, {})).toThrow('the World Bank prices JP in Japanese yen, not none');
  });
  it("reads GeoNames' three-letter codes, its comments and blank lines left out", () => {
    expect([...threeLetterCodes('#ISO\tISO3\n\nTW\tTWN\tx\nAI\tAIA\n')]).toEqual([
      ['TWN', 'TW'],
      ['AIA', 'AI'],
    ]);
  });
  it("takes the Program's own benchmark for an economy the World Bank's indicators leave out, with the currency it names", () => {
    const datum = (id: string, value: number | null) => ({ variable: [{ concept: 'Time', id: 'YR2021' }, { concept: 'Country', id }], value });
    const data = { source: { data: [datum('TWN', 15.7), datum('ARG', 43), datum('BON', 0.7), datum('AIA', null), datum('MSR', 1.7)] } };
    const metadata = { source: [{ concept: [{ variable: [{ id: 'TWN', metatype: [{ id: 'LongName', value: 'Taiwan' }, { id: 'CurrencyUnit', value: 'TWD: New Taiwan Dollar' }] }, { id: 'MSR', metatype: [] }] }] }] };
    const codes = new Map([
      ['TWN', 'TW'],
      ['ARG', 'AR'],
      ['AIA', 'AI'],
      ['MSR', 'MS'],
    ]);
    const { rows, units } = icpBenchmark(data, metadata, codes);
    expect(rows).toStrictEqual([row('TW', '2021', 15.7), row('AR', '2021', 43), row('MS', '2021', 1.7)]);
    expect([...units]).toEqual([
      ['TW', 'TWD: New Taiwan Dollar'],
      ['AR', ''],
      ['MS', ''],
    ]);
    expect(icpBenchmark({ source: { data: [{ variable: [], value: 1 }] } }, { source: [] }, new Map([['', 'XX']]))).toStrictEqual({ rows: [row('XX', '2021', 1)], units: new Map([['XX', '']]) });
    expect(icpBenchmark(data, { source: [{ concept: [] }] }, codes).units.get('TW')).toBe('');
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
    ['world.prices.GP', 'R-0007'],
    ['world.prices.fr-metro-cpi', 'R-0008'],
  ]);
  it('is researched where a level is kept, blocked where the register holds why not, pending otherwise, and proven where no place is', () => {
    const rows = pricesCoverage(['US', 'AR', 'GP', 'KP', 'TW', 'AQ'], new Set(['US', 'AR', 'GP', 'KP', 'TW']), new Set(['US', 'AR', 'GP', 'AQ']), facts, new Map([['GP', 'fr-metro-cpi']]));
    expect(rows).toStrictEqual([
      { key: 'US', status: 'researched', register: ['R-0001', 'R-0002', 'R-0003'], tests: TESTS },
      { key: 'AR', status: 'researched', register: ['R-0001', 'R-0002', 'R-0004', 'R-0005', 'R-0006'], tests: TESTS },
      { key: 'GP', status: 'researched', register: ['R-0001', 'R-0002', 'R-0003', 'R-0007', 'R-0008'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-0009'], tests: [...TESTS, TOLD] },
      { key: 'TW', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
    ]);
    // Without the levels' register entry, a level isn't researched.
    expect(pricesCoverage(['US'], new Set(['US']), new Set(['US']), new Map(), new Map())).toStrictEqual([{ key: 'US', status: 'pending' }]);
    // A territory keeping another's level cites its own file and all the other's row cites; one keeping an unpriced country's isn't priced.
    expect(pricesCoverage(['AR', 'XX', 'YY', 'ZZ'], new Set(['AR', 'XX', 'YY', 'ZZ']), new Set(['AR', 'XX', 'YY']), new Map([...facts, ['world.prices.XX', 'R-0010'], ['world.prices.YY', 'R-0011'], ['world.prices.ZZ', 'R-0012']]), new Map(), new Map([['XX', 'AR'], ['YY', 'QQ'], ['ZZ', 'AR']]))).toStrictEqual([
      { key: 'AR', status: 'researched', register: ['R-0001', 'R-0002', 'R-0004', 'R-0005', 'R-0006'], tests: TESTS },
      { key: 'XX', status: 'researched', register: ['R-0001', 'R-0002', 'R-0004', 'R-0005', 'R-0006', 'R-0010'], tests: TESTS },
      { key: 'YY', status: 'researched', register: ['R-0001', 'R-0002', 'R-0004', 'R-0005', 'R-0011'], tests: TESTS },
      { key: 'ZZ', status: 'pending' },
    ]);
    // Nor a country whose own index the register cites, without a level.
    expect(pricesCoverage(['AR'], new Set(['AR']), new Set(), facts, new Map())).toStrictEqual([{ key: 'AR', status: 'pending' }]);
    expect(CURRENCY_FACTS).toEqual(['world.gazetteer.countries', 'money.iso4217.list-one']);
    expect(CARRIED_FACTS).toEqual(['world.prices.ppp-2021', 'world.prices.us-cpi']);
    expect(TESTS).toEqual(["tests/world/prices/prices.test.ts::the prices > are the World Bank's levels, or carried from its benchmark, in each country's own currency", 'tests/world/prices/prices.places.test.ts::the prices > at every place on the map']);
    expect(TOLD).toBe("tests/world/prices/prices.test.ts::the prices > tell the player where a country's aren't kept");
    expect(NO_PLACES).toBe('tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own');
  });
  it('is the matrix the gate reads, byte for byte', () => {
    expect(COVERAGE).toBe('coverage/prices-countries.json');
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([{ key: 'TW', status: 'pending' }])).toBe('{\n "engine": "world.prices",\n "axis": "country",\n "rows": [\n  {\n   "key": "TW",\n   "status": "pending"\n  }\n ]\n}\n');
  });
});
