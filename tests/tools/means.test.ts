import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { band, BANDS, compileCountry, CUTS, deposits, FAMILIES, liquid, OUTPUT, readMeans, serialize, SOURCES } from '../../tools/money/means/compile.ts';
import { COVERAGE, coverageOf, meansCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/money/means/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

// Averages chosen so each band's is a round figure: 0-20 at 12, 20-40 at 24, 40-60 at 36, 60-90 at 48, 90-99 at 120, top 1% at 1,200.
const FIG = { p0p20: '12', p0p40: '18', p0p60: '24', p0p90: '32', p0p99: '40', p99p100: '1200' };
const q = (n: number | bigint, d: number | bigint = 1) => ({ num: BigInt(n), den: BigInt(d) });
const div = (x: { num: bigint; den: bigint }) => Number(x.num) / Number(x.den);

describe('the family means compile', () => {
  it("reads each family's band from the averages below its edges", () => {
    expect([SOURCES, OUTPUT, FAMILIES, CUTS]).toEqual(['research/sources/money/means', 'src/money/means/means.json', ['nothing', 'scraping', 'modest', 'comfortable', 'wealthy', 'inherited'], ['p0p20', 'p0p40', 'p0p60', 'p0p90', 'p0p99', 'p99p100']]);
    expect(BANDS).toStrictEqual({ nothing: [0, 20], scraping: [20, 40], modest: [40, 60], comfortable: [60, 90], wealthy: [90, 99], inherited: [99, 100] });
    const avg = Object.fromEntries(Object.entries(FIG).map(([k, v]) => [k, q(Number(v))]));
    expect(FAMILIES.map((f) => div(band(f, avg)))).toEqual([12, 24, 36, 48, 120, 1200]);
    // Fractions keep their denominators.
    expect(band('scraping', { p0p20: q(1, 2), p0p40: q(3, 4) })).toStrictEqual(q(40n * 3n * 2n - 20n * 1n * 4n, 20n * 4n * 2n));
  });

  it("takes a country's file to each family's month of income and its wealth", () => {
    const f = { country: 'US', currency: 'USD', year: 2024, wealth: { ...FIG, p0p20: '-50' }, income: FIG, note: 'x', sources: [] };
    expect(compileCountry('US', f)).toStrictEqual({
      currency: 'USD',
      year: 2024,
      // The bottom fifth's wealth below nothing (-50) is its debt; no survey, no savings.
      families: { nothing: { checking: 100, debt: 5000 }, scraping: { checking: 200, debt: 0 }, modest: { checking: 300, debt: 0 }, comfortable: { checking: 400, debt: 0 }, wealthy: { checking: 1000, debt: 0 }, inherited: { checking: 10000, debt: 0 } },
    });
    // The minor unit is the currency's; a month's income is rounded half to even.
    expect(compileCountry('JP', { country: 'JP', currency: 'JPY', year: 2024, wealth: FIG, income: { ...FIG, p0p20: '18', p99p100: '-12' } }).families.nothing).toStrictEqual({ checking: 2, debt: 0 });
    expect(compileCountry('JP', { country: 'JP', currency: 'JPY', year: 2024, wealth: FIG, income: { ...FIG, p0p20: '30' } }).families.nothing.checking).toBe(2);
    expect(compileCountry('JP', { country: 'JP', currency: 'JPY', year: 2024, wealth: FIG, income: { ...FIG, p99p100: '-12' } }).families.inherited.checking).toBe(0);
    expect(() => compileCountry('XX', { country: 'XX' })).toThrow('XX is not a country on the map');
    expect(() => compileCountry('US', { country: 'GB' })).toThrow("US's file is for GB");
    for (const currency of [undefined, 'XYZ', 7]) expect(() => compileCountry('US', { ...f, currency }), String(currency)).toThrow("US names its figures' currency");
    for (const year of [undefined, 1999, 2024.5, '2024']) expect(() => compileCountry('US', { ...f, year }), String(year)).toThrow('US gives the year its figures are for');
    expect(compileCountry('US', { ...f, year: 2000 }).year).toBe(2000);
    for (const v of [undefined, 12, '1e3', '1.', '-', ' 1']) {
      expect(() => compileCountry('US', { ...f, wealth: { ...FIG, p0p60: v } }), String(v)).toThrow("US's wealth gives p0p60 as a decimal");
      expect(() => compileCountry('US', { ...f, income: { ...FIG, p99p100: v } }), String(v)).toThrow("US's income gives p99p100 as a decimal");
    }
    expect(() => compileCountry('US', { ...f, income: undefined })).toThrow("US's income gives p0p20 as a decimal");
  });

  it("gives each family its band's deposits from a survey's bands, each weighed by the width it shares", () => {
    const q = (n: number) => ({ num: BigInt(n), den: 1n });
    const fifths = [0, 20, 40, 60, 80].map((from, i) => ({ from, to: from + 20, deposits: q((i + 1) * 100) }));
    expect(FAMILIES.map((f) => div(deposits(f, fifths)))).toEqual([100, 200, 300, 1300 / 3, 500, 500]);
    // The Fed's bands: half and half; a tenth of a percent weighed exactly.
    const fed = [
      { from: 0, to: 50, deposits: q(10) },
      { from: 50, to: 90, deposits: q(90) },
      { from: 90, to: 99, deposits: q(400) },
      { from: 99, to: 99.9, deposits: q(1000) },
      { from: 99.9, to: 100, deposits: q(11_000) },
    ];
    expect([div(deposits('modest', fed)), div(deposits('inherited', fed))]).toEqual([50, 2000]);
    const l = { survey: 'S', period: '2026-Q1', currency: 'EUR', per: 'household', bands: [{ from: 0, to: 60, deposits: '100' }, { from: 60, to: 100, deposits: '200.5' }] };
    expect(liquid('DE', l)).toStrictEqual({ currency: 'EUR', period: '2026-Q1', bands: [{ from: 0, to: 60, deposits: q(100) }, { from: 60, to: 100, deposits: { num: 2005n, den: 10n } }] });
    const f = { country: 'DE', currency: 'EUR', year: 2024, wealth: FIG, income: FIG, liquid: l };
    expect(compileCountry('DE', f).liquid).toStrictEqual({ currency: 'EUR', period: '2026-Q1' });
    expect(FAMILIES.map((x) => compileCountry('DE', f).families[x].savings)).toEqual([10_000, 10_000, 10_000, 20_050, 20_050, 20_050]);
    // In the survey's currency, its minor units: yen have none.
    expect(compileCountry('DE', { ...f, liquid: { ...l, currency: 'JPY' } }).families.wealthy.savings).toBe(200);
    for (const [bad, error] of [
      [null, "DE's liquid is the survey, its period, currency, per and bands, nothing else"],
      [{ ...l, x: 1 }, "DE's liquid is the survey, its period, currency, per and bands, nothing else"],
      ['bands', "DE's liquid is the survey, its period, currency, per and bands, nothing else"],
      [{ ...l, survey: '' }, "DE's liquid names its survey"],
      [{ ...l, survey: 7 }, "DE's liquid names its survey"],
      [{ ...l, period: '' }, "DE's liquid names the period it's of"],
      [{ ...l, period: 2026 }, "DE's liquid names the period it's of"],
      [{ ...l, currency: 'XYZ' }, "DE's liquid names its currency"],
      [{ ...l, per: 'adult' }, "DE's liquid is per household"],
      [{ ...l, bands: [] }, "DE's liquid has bands"],
      [{ ...l, bands: 'x' }, "DE's liquid has bands"],
      [{ ...l, bands: [{ from: 10, to: 100, deposits: '1' }] }, "DE's liquid band 0 runs on from 0, up to 100 at most"],
      [{ ...l, bands: [{ from: 0, to: 0, deposits: '1' }] }, "DE's liquid band 0 runs on from 0, up to 100 at most"],
      [{ ...l, bands: [{ from: 0, to: 101, deposits: '1' }] }, "DE's liquid band 0 runs on from 0, up to 100 at most"],
      [{ ...l, bands: [{ from: 0, to: '100', deposits: '1' }] }, "DE's liquid band 0 runs on from 0, up to 100 at most"],
      [{ ...l, bands: [null] }, "DE's liquid band 0 runs on from 0, up to 100 at most"],
      [{ ...l, bands: [{ from: 0, to: 100, deposits: 1 }] }, "DE's liquid band 0 gives its deposits as a decimal"],
      [{ ...l, bands: [{ from: 0, to: 100, deposits: '-1' }] }, "DE's liquid band 0 gives its deposits as a decimal"],
      [{ ...l, bands: [{ from: 0, to: 100, deposits: '1x' }] }, "DE's liquid band 0 gives its deposits as a decimal"],
      [{ ...l, bands: [{ from: 0, to: 100, deposits: 'x1' }] }, "DE's liquid band 0 gives its deposits as a decimal"],
      [{ ...l, bands: [{ from: 0, to: 90, deposits: '1' }] }, "DE's liquid bands reach 100"],
    ] as const)
      expect(() => liquid('DE', bad), JSON.stringify(bad)).toThrow(error);
  });

  it('carries figures in a replaced currency into the new, at the rate its issuer fixed', () => {
    const f = { country: 'BG', currency: 'EUR', year: 2024, wealth: FIG, income: FIG, replaced: { currency: 'BGN', per: '2' } };
    expect(compileCountry('BG', { ...f, wealth: { ...FIG, p0p20: '-12' } }).families.nothing).toStrictEqual({ checking: 50, debt: 600 });
    expect(compileCountry('BG', f).families.modest).toStrictEqual({ checking: 150, debt: 0 });
    for (const replaced of [{ per: '2' }, { currency: '', per: '2' }, { currency: 'EUR', per: '2' }, { currency: 7, per: '2' }]) expect(() => compileCountry('BG', { ...f, replaced }), JSON.stringify(replaced)).toThrow("BG's figures are in a replaced currency it names");
    for (const per of [undefined, 2, '0', '0.0', '-2', '2.', 'x2'])
      expect(() => compileCountry('BG', { ...f, replaced: { currency: 'BGN', per } }), String(per)).toThrow('BG gives how many BGN one EUR is worth');
    expect(compileCountry('BG', { ...f, replaced: { currency: 'BGN', per: '0.5' } }).families.modest.checking).toBe(600);
    expect([compileCountry('BG', { ...f, replaced: { currency: 'BGN', per: '10' } }).families.modest.checking, compileCountry('BG', { ...f, replaced: { currency: 'BGN', per: '1.25' } }).families.modest.checking]).toEqual([30, 240]);
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'means-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const file = `${JSON.stringify({ country: 'US', currency: 'USD', year: 2024, wealth: FIG, income: FIG })}\n`;
    writeFileSync(join(root, SOURCES, 'US.json'), file);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = createHash('sha256').update(file).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    register([{ fact: 'money.means.US', value: { file: `${SOURCES}/US.json`, sha256: sha } }]);
    expect(Object.keys(readMeans(root).countries)).toEqual(['US']);
    expect(readMeans(root).countries['US']?.families.modest).toStrictEqual({ checking: 300, debt: 0 });
    register([{ fact: 'money.means.US', value: { file: `${SOURCES}/US.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readMeans(root)).toThrow(`${SOURCES}/US.json isn't the file the register cites`);
    register([{ fact: 'money.credit.US', value: { file: `${SOURCES}/US.json`, sha256: sha } }, { fact: 'money.means.blocked.FR' }]);
    expect(() => readMeans(root)).toThrow(`${SOURCES}/US.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readMeans(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ countries: {} })).toBe('{\n "countries": {}\n}\n');
  });
});

describe('the family means coverage', () => {
  it('rows each country researched, blocked, pending, or proven with no place', () => {
    const facts = new Map([['money.means.GB', 'R-1'], ['money.means.blocked.FR', 'R-2'], ['money.means.DE', 'R-3'], ['money.credit.IT', 'R-4']]);
    expect(meansCoverage(['GB', 'FR', 'IT', 'AQ', 'DE'], new Set(['GB', 'FR', 'IT', 'DE']), new Set(['GB', 'IT']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      { key: 'IT', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      { key: 'DE', status: 'pending' },
    ]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TOLD, TESTS]).toEqual([
      'coverage/means-countries.json',
      "tests/money/means/means.test.ts::means > tell the player what the game doesn't know",
      ["tests/money/means/means.test.ts::means > give each family's first morning, from its band of the country's adults", 'tests/money/means/means.places.test.ts::means > for every place on the map'],
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.means",\n "axis": "country",\n "rows": []\n}\n');
  });
});
