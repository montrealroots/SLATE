import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileUnit, OUTPUT, positive, readUnits, serialize, SOURCES } from '../../tools/money/units/compile.ts';
import { COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD, unitsCoverage, unitsNamed } from '../../tools/money/units/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const UMA = { unit: 'UMA', name: 'Unidad de Medida y Actualización', currency: 'MXN', values: [{ from: '2025-02-01', value: '113.14' }, { from: '2026-02-01', value: '117.31' }], note: 'n', sources: [] };

describe('the index units compile', () => {
  it("takes a unit's name, currency and values in day order", () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/money/units', 'src/money/units/units.json']);
    expect(compileUnit('UMA', UMA)).toStrictEqual({ fact: 'money.units.UMA', name: UMA.name, currency: 'MXN', values: UMA.values });
    expect([positive('1'), positive('0.5'), positive('0'), positive('0.0'), positive('-1'), positive('1.'), positive(1), positive('a1'), positive('1a')]).toEqual([true, true, false, false, false, false, false, false, false]);
    for (const key of ['uma', 'UMAXX', 'U', 'U1']) expect(() => compileUnit(key, { ...UMA, unit: key }), key).toThrow(`${key}'s file is for ${key}`);
    expect(compileUnit('UR', { ...UMA, unit: 'UR' }).fact).toBe('money.units.UR');
    expect(() => compileUnit('UMA', { ...UMA, unit: 'UR' })).toThrow("UMA's file is for UR");
    expect(() => compileUnit('UMA', { ...UMA, rates: [] })).toThrow("UMA's file has no term rates");
    for (const name of [undefined, '', 7]) expect(() => compileUnit('UMA', { ...UMA, name }), String(name)).toThrow('UMA is named as its publisher names it');
    // An array of one code reads as that code to a property lookup; it isn't one.
    for (const currency of [undefined, 'XXY', 7, ['MXN']]) expect(() => compileUnit('UMA', { ...UMA, currency }), String(currency)).toThrow('UMA is worth an amount of a currency');
    for (const values of [undefined, [], 'x']) expect(() => compileUnit('UMA', { ...UMA, values }), JSON.stringify(values)).toThrow('UMA gives at least one value');
    for (const values of [[{ from: '2026-2-1', value: '1' }], [{ from: 'x2026-02-01', value: '1' }], [{ from: '2026-02-01x', value: '1' }], [{ from: '2026-02-01', value: '1' }, { from: '2026-02-01', value: '2' }], [{ from: '2026-02-01', value: '1' }, { from: '2025-02-01', value: '2' }]])
      expect(() => compileUnit('UMA', { ...UMA, values }), JSON.stringify(values)).toThrow("UMA's values are each from a day (YYYY-MM-DD), in order");
    // A law's own rounding down, a decimal above 0 (the Northern Territory's whole dollar).
    expect(compileUnit('UMA', { ...UMA, roundDown: '1' }).roundDown).toBe('1');
    for (const roundDown of ['0', 1, 'x']) expect(() => compileUnit('UMA', { ...UMA, roundDown }), String(roundDown)).toThrow('UMA rounds a fee down to a multiple of a decimal above 0');
    for (const value of ['0', '-1', 1, 'x']) expect(() => compileUnit('UMA', { ...UMA, values: [{ from: '2026-02-01', value }] }), String(value)).toThrow("UMA's value from 2026-02-01 is a decimal above 0");
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'units-'));
    mkdirSync(join(root, 'research'), { recursive: true });
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    register([]);
    expect(readUnits(root)).toStrictEqual({ units: {} });
    mkdirSync(join(root, SOURCES), { recursive: true });
    const text = JSON.stringify(UMA);
    writeFileSync(join(root, SOURCES, 'UMA.json'), text);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const cite = { fact: 'money.units.UMA', value: { file: `${SOURCES}/UMA.json`, sha256: createHash('sha256').update(text).digest('hex') } };
    register([cite, { fact: 'money.units.blocked.UR' }]);
    expect(readUnits(root)).toStrictEqual({ units: { UMA: compileUnit('UMA', UMA) } });
    register([{ ...cite, value: { ...cite.value, sha256: '0'.repeat(64) } }]);
    expect(() => readUnits(root)).toThrow(`${SOURCES}/UMA.json isn't the file the register cites`);
    register([{ ...cite, fact: 'money.rates.UMA' }]);
    expect(() => readUnits(root)).toThrow(`${SOURCES}/UMA.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readUnits(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ units: {} })).toBe('{\n "units": {}\n}\n');
  });
});

describe('the index units coverage', () => {
  it('rows each unit a fee names: researched, blocked or pending', () => {
    const facts = new Map([['money.units.UMA', 'R-1'], ['money.units.blocked.UI', 'R-2'], ['money.units.UF', 'R-3']]);
    expect(unitsCoverage(['UMA', 'UI', 'UR', 'UF'], new Set(['UMA']), facts)).toStrictEqual([
      { key: 'UMA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'UI', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      { key: 'UR', status: 'pending' },
      // A fact the compile didn't take is no research.
      { key: 'UF', status: 'pending' },
    ]);
    expect(unitsCoverage(['UMA'], new Set(['UMA']), new Map())).toStrictEqual([{ key: 'UMA', status: 'pending' }]);
  });

  it('finds every unit a fee names, once, in order', () => {
    expect(unitsNamed({ UY: [{ foreignFee: { count: '1.25', unit: 'UR' } }], MX: { licence: { fee: { count: '6', unit: 'UMA' } }, card: { fee: { count: '2', unit: 'UMA' } } }, GB: { fee: { currency: 'GBP', minor: 1 }, unit: 'x' } })).toEqual(['UMA', 'UR']);
    expect([unitsNamed({ a: { unit: 'UMA', count: 6 } }), unitsNamed({ a: { unit: 7, count: '6' } })]).toEqual([[], []]);
    expect([unitsNamed(null), unitsNamed('UMA'), unitsNamed([])]).toEqual([[], [], []]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TESTS, TOLD]).toEqual([
      'coverage/units-units.json',
      ["tests/money/units/units.test.ts::units > give a count of a unit in its currency on a day, from its publisher's values"],
      "tests/money/units/units.test.ts::units > give nothing for a unit the game doesn't hold",
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage(['UMA'], [])).toBe('{\n "engine": "money.units",\n "axis": "unit",\n "universe": {\n  "keys": [\n   "UMA"\n  ]\n },\n "rows": []\n}\n');
  });
});
