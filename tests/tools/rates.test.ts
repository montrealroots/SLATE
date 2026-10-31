import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCurrency, FIRST, OUTPUT, readRates, resolve, scaled, serialize, SOURCES, times } from '../../tools/money/rates/compile.ts';
import { COVERAGE, coverageOf, ratesCoverage, serializeCoverage, TESTS, TOLD, UNIT } from '../../tools/money/rates/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolvePath(import.meta.dirname, '../..');

describe('the exchange rates compile', () => {
  it("takes a currency's file to its rates against the dollar, in day order, or its peg", () => {
    expect([SOURCES, OUTPUT, FIRST]).toEqual(['research/sources/money/rates', 'src/money/rates/rates.json', '2025-12-31']);
    const r = [{ from: '2025-12-31', perUSD: '0.851' }, { from: '2026-03-31', perUSD: '0.87' }];
    expect(compileCurrency('EUR', { currency: 'EUR', rates: r, note: 'x', sources: [] })).toStrictEqual({ rates: r });
    expect(compileCurrency('JPY', { currency: 'JPY', rates: [{ from: '2026-01-01', perUSD: '156', extra: 1 }] })).toStrictEqual({ rates: [{ from: '2026-01-01', perUSD: '156' }] });
    for (const code of ['XYZ', 'USD', 'eur']) expect(() => compileCurrency(code, { currency: code }), code).toThrow(`${code} is not a currency with a rate against the dollar`);
    expect(() => compileCurrency('EUR', { currency: 'GBP' })).toThrow("EUR's file is for GBP");
    for (const f of [{}, { rates: r, peg: { currency: 'USD', units: '1' } }]) expect(() => compileCurrency('EUR', { currency: 'EUR', ...f }), JSON.stringify(f)).toThrow('EUR gives its rates or its peg, one of them');
    for (const rates of [[], 'x']) expect(() => compileCurrency('EUR', { currency: 'EUR', rates }), JSON.stringify(rates)).toThrow('EUR gives at least one rate');
    for (const rates of [[{ from: 20260101, perUSD: '1' }], [{ from: '2026-1-01', perUSD: '1' }], [{ from: 'x2026-01-01', perUSD: '1' }], [{ from: '2026-01-01x', perUSD: '1' }], [r[1], r[0]], [r[0], r[0]]])
      expect(() => compileCurrency('EUR', { currency: 'EUR', rates }), JSON.stringify(rates)).toThrow("EUR's rates are each from a day (YYYY-MM-DD), in order");
    for (const perUSD of [0.851, '0', '0.000', '-1', '1.', '.5', '1e3', ' 1', '1 ', undefined])
      expect(() => compileCurrency('EUR', { currency: 'EUR', rates: [{ from: '2025-12-31', perUSD }] }), String(perUSD)).toThrow("EUR's rate from 2025-12-31 is a decimal above 0");
    // A fixed parity: units of the currency one unit of the anchor buys.
    expect(compileCurrency('FKP', { currency: 'FKP', peg: { currency: 'GBP', units: '1' } })).toStrictEqual({ peg: { currency: 'GBP', units: '1' } });
    for (const peg of [{ currency: 'FKP', units: '1' }, { currency: 'XYZ', units: '1' }, { currency: 7, units: '1' }, { units: '1' }])
      expect(() => compileCurrency('FKP', { currency: 'FKP', peg }), JSON.stringify(peg)).toThrow("FKP's peg names another currency");
    for (const units of ['0', '-1', 1, undefined]) expect(() => compileCurrency('FKP', { currency: 'FKP', peg: { currency: 'GBP', units } }), String(units)).toThrow("FKP's peg gives the units one GBP buys, a decimal above 0");
    // A parity the authority states as so many units for so many of the anchor's.
    expect(compileCurrency('XPF', { currency: 'XPF', peg: { currency: 'EUR', units: '1000', per: '8.38' } })).toStrictEqual({ peg: { currency: 'EUR', units: '1000', per: '8.38' } });
    for (const per of ['0', '-1', 8.38, '', null]) expect(() => compileCurrency('XPF', { currency: 'XPF', peg: { currency: 'EUR', units: '1000', per } }), String(per)).toThrow("XPF's peg gives the EUR its units buy, a decimal above 0");
  });

  it('multiplies decimals exactly', () => {
    expect([times('0.743', '1'), times('7.784', '1.03'), times('2', '3'), times('0.5', '0.2'), times('1.25', '8'), times('0.001', '0.01'), times('100', '0.5')]).toEqual(['0.743', '8.01752', '6', '0.1', '10', '0.00001', '50']);
  });

  it('scales a rate by a parity with no finite decimal to six places, half to even', () => {
    expect([scaled('0.851', '1000', '8.38'), scaled('1', '1000', '8.38'), scaled('2', '1', '4'), scaled('1', '1', '3'), scaled('1', '1', '2000000'), scaled('1', '1', '1600000'), scaled('3', '1', '1600000'), scaled('0.5', '3', '0.25'), scaled('2', '1.5', '1')]).toEqual(['101.551313', '119.331742', '0.5', '0.333333', '0', '0.000001', '0.000002', '6', '3']);
  });

  it("gives a peg its anchor's rates times the parity, or one step at a parity with the dollar", () => {
    const gbp = [{ from: '2025-12-31', perUSD: '0.743' }, { from: '2026-03-31', perUSD: '0.75' }];
    expect(resolve({ GBP: { rates: gbp }, FKP: { peg: { currency: 'GBP', units: '1' } }, AWG: { peg: { currency: 'USD', units: '1.79' } }, HKD: { rates: [{ from: '2025-12-31', perUSD: '7.784' }] }, MOP: { peg: { currency: 'HKD', units: '1.03' } } })).toStrictEqual({
      GBP: { fact: 'money.rates.GBP', rates: gbp },
      FKP: { fact: 'money.rates.FKP', rates: gbp },
      AWG: { fact: 'money.rates.AWG', rates: [{ from: '2025-12-31', perUSD: '1.79' }] },
      HKD: { fact: 'money.rates.HKD', rates: [{ from: '2025-12-31', perUSD: '7.784' }] },
      MOP: { fact: 'money.rates.MOP', rates: [{ from: '2025-12-31', perUSD: '8.01752' }] },
    });
    expect(resolve({ EUR: { rates: [{ from: '2025-12-31', perUSD: '0.851' }] }, XPF: { peg: { currency: 'EUR', units: '1000', per: '8.38' } }, XYD: { peg: { currency: 'USD', units: '3', per: '2' } } })).toStrictEqual({
      EUR: { fact: 'money.rates.EUR', rates: [{ from: '2025-12-31', perUSD: '0.851' }] },
      XPF: { fact: 'money.rates.XPF', rates: [{ from: '2025-12-31', perUSD: '101.551313' }] },
      XYD: { fact: 'money.rates.XYD', rates: [{ from: '2025-12-31', perUSD: '1.5' }] },
    });
    expect(() => resolve({ FKP: { peg: { currency: 'GBP', units: '1' } } })).toThrow('FKP is pegged to GBP, which has no rates of its own');
    expect(() => resolve({ SHP: { peg: { currency: 'FKP', units: '1' } }, FKP: { peg: { currency: 'GBP', units: '1' } } })).toThrow('SHP is pegged to FKP, which has no rates of its own');
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'rates-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const file = `${JSON.stringify({ currency: 'GBP', rates: [{ from: '2025-12-31', perUSD: '0.743' }] })}\n`;
    writeFileSync(join(root, SOURCES, 'GBP.json'), file);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = createHash('sha256').update(file).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    register([{ fact: 'money.rates.GBP', value: { file: `${SOURCES}/GBP.json`, sha256: sha } }]);
    expect(readRates(root)).toStrictEqual({ currencies: { GBP: { fact: 'money.rates.GBP', rates: [{ from: '2025-12-31', perUSD: '0.743' }] } } });
    register([{ fact: 'money.rates.GBP', value: { file: `${SOURCES}/GBP.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readRates(root)).toThrow(`${SOURCES}/GBP.json isn't the file the register cites`);
    register([{ fact: 'money.credit.GBP', value: { file: `${SOURCES}/GBP.json`, sha256: sha } }, { fact: 'money.rates.blocked.KPW' }]);
    expect(() => readRates(root)).toThrow(`${SOURCES}/GBP.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readRates(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ currencies: {} })).toBe('{\n "currencies": {}\n}\n');
  });
});

describe('the exchange rates coverage', () => {
  it('rows each country researched by its currency, proven in dollars or with no place, blocked or pending', () => {
    const facts = new Map([['money.rates.GBP', 'R-1'], ['money.rates.blocked.KPW', 'R-2'], ['money.rates.EUR', 'R-3'], ['money.credit.JPY', 'R-4']]);
    expect(ratesCoverage({ GB: 'GBP', KP: 'KPW', JP: 'JPY', AQ: '', US: 'USD', FR: 'EUR', DE: 'EUR' }, new Set(['GB', 'KP', 'JP', 'US', 'FR', 'DE']), new Set(['GBP', 'JPY', 'EUR']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      { key: 'JP', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      { key: 'US', status: 'proven', tests: [UNIT] },
      { key: 'FR', status: 'researched', register: ['R-3'], tests: TESTS },
      { key: 'DE', status: 'researched', register: ['R-3'], tests: TESTS },
    ]);
    expect(ratesCoverage({ FK: 'FKP' }, new Set(['FK']), new Set(), new Map([['money.rates.FKP', 'R-5']]))).toStrictEqual([{ key: 'FK', status: 'pending' }]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, UNIT, TOLD, TESTS]).toEqual([
      'coverage/rates-countries.json',
      'tests/money/rates/rates.test.ts::rates > keep the dollar as the unit',
      "tests/money/rates/rates.test.ts::rates > tell the player what the game doesn't know",
      ["tests/money/rates/rates.test.ts::rates > give each currency's rate against the dollar on a day, from the rates its source gives", 'tests/money/rates/rates.places.test.ts::rates > for every place on the map'],
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.rates",\n "axis": "country",\n "rows": []\n}\n');
  });
});
