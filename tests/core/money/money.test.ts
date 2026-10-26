import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENCY_CODES,
  ISO4217_PUBLISHED,
  add,
  allocate,
  compare,
  exchange,
  fromMajor,
  isCurrency,
  minorUnits,
  money,
  multiply,
  rational,
  roundHalfEven,
  subtract,
  toMajor,
  type CurrencyCode,
  type Rate,
} from '../../../src/core/money/money.ts';
import { OUTPUT, readListOne, serialize } from '../../../tools/money/compile.ts';

const ROOT = join(import.meta.dirname, '../../..');
const usd = (minor: number) => money('USD', minor);

describe('the currencies, from ISO 4217 list one', () => {
  it('are the list as published, compiled byte for byte', () => {
    expect(serialize(readListOne(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(ISO4217_PUBLISHED).toBe('2026-09-17');
    expect(CURRENCY_CODES).toHaveLength(155);
  });
  it('every currency: an amount writes and reads back at its own minor units', () => {
    for (const code of CURRENCY_CODES) {
      const units = minorUnits(code);
      const m = money(code, -1_234_567);
      const text = toMajor(m);
      expect(text.split('.')[1]?.length ?? 0).toBe(units);
      expect(fromMajor(code, text)).toEqual(m);
    }
    expect([minorUnits('USD'), minorUnits('JPY'), minorUnits('KWD')]).toEqual([2, 0, 3]);
  });
  it('know what is a currency in use, and what is not', () => {
    expect(['USD', 'EUR', 'VES', 'VED', 'SVC', 'FKP', 'TWD'].every(isCurrency)).toBe(true);
    expect(['XAU', 'USN', 'XTS', 'XDR', 'ZZZ', 'usd', 'toString', 'constructor'].some(isCurrency)).toBe(false);
  });
});

describe('amounts', () => {
  it('are whole numbers of minor units, in a currency in use', () => {
    expect(money('EUR', 1050)).toEqual({ currency: 'EUR', minor: 1050 });
    expect(Object.is(money('EUR', -0).minor, 0)).toBe(true);
    expect(() => money('EUR', 10.5)).toThrow('an amount is a whole number of minor units (10.5)');
    expect(() => money('EUR', 2 ** 53)).toThrow('an amount is a whole number of minor units');
    expect(() => money('XAU' as CurrencyCode, 1)).toThrow('"XAU" is not a currency in use');
  });
  it('read from major units, with no more decimals than the currency has', () => {
    expect(fromMajor('USD', '12.34')).toEqual(usd(1234));
    expect(fromMajor('USD', '12.3')).toEqual(usd(1230));
    expect(fromMajor('USD', '12')).toEqual(usd(1200));
    expect(fromMajor('USD', '-0.07')).toEqual(usd(-7));
    expect(fromMajor('JPY', '1500')).toEqual(money('JPY', 1500));
    expect(fromMajor('KWD', '1.005')).toEqual(money('KWD', 1005));
    expect(() => fromMajor('USD', '1.234')).toThrow('USD has 2 decimal places; "1.234" has more');
    expect(() => fromMajor('JPY', '1.5')).toThrow('JPY has 0 decimal places; "1.5" has more');
    for (const bad of ['', '1,000', '1.', '.5', '+1', '1e3', ' 1']) expect(() => fromMajor('USD', bad)).toThrow(`"${bad}" is not an amount`);
  });
  it('write in major units, with exactly the currency\'s decimals', () => {
    expect([toMajor(usd(1234)), toMajor(usd(5)), toMajor(usd(-5)), toMajor(usd(0)), toMajor(usd(100))]).toEqual(['12.34', '0.05', '-0.05', '0.00', '1.00']);
    expect([toMajor(money('JPY', 1500)), toMajor(money('KWD', 1)), toMajor(money('KWD', -12_345))]).toEqual(['1500', '0.001', '-12.345']);
  });
  it('add, subtract and compare only within one currency', () => {
    expect(add(usd(150), usd(-50))).toEqual(usd(100));
    expect(subtract(usd(150), usd(200))).toEqual(usd(-50));
    expect([compare(usd(1), usd(2)), compare(usd(2), usd(2)), compare(usd(3), usd(2))]).toEqual([-1, 0, 1]);
    const eur = money('EUR', 1);
    for (const f of [() => add(usd(1), eur), () => subtract(usd(1), eur), () => compare(usd(1), eur)]) expect(f).toThrow("USD and EUR can't be added without an exchange");
    expect(() => add(usd(Number.MAX_SAFE_INTEGER), usd(1))).toThrow('an amount is a whole number of minor units');
  });
});

describe('exact arithmetic', () => {
  it('reads a decimal exactly', () => {
    expect(rational('0.0125')).toEqual({ num: 125n, den: 10_000n });
    expect(rational('-3')).toEqual({ num: -3n, den: 1n });
    expect(rational('874.73')).toEqual({ num: 87_473n, den: 100n });
    for (const bad of ['', '1/3', '1.2.3', '.5', 'x']) expect(() => rational(bad)).toThrow(`"${bad}" is not a decimal number`);
  });
  it('rounds half to even, both signs', () => {
    const r = (n: number, d: number) => Number(roundHalfEven(BigInt(n), BigInt(d)));
    expect([r(5, 2), r(7, 2), r(-5, 2), r(-7, 2), r(1, 3), r(2, 3), r(-1, 3), r(-2, 3), r(6, 3), r(0, 5), r(-9, 2), r(9, 2)]).toEqual([2, 4, -2, -4, 0, 1, 0, -1, 2, 0, -4, 4]);
    expect(() => roundHalfEven(1n, 0n)).toThrow('the denominator is positive');
    expect(() => roundHalfEven(1n, -1n)).toThrow('the denominator is positive');
  });
  it('multiplies by a decimal factor, rounding half to even to the minor unit', () => {
    expect(multiply(usd(10_000), '0.0125')).toEqual(usd(125));
    expect(multiply(usd(250), '0.5')).toEqual(usd(125));
    expect(multiply(usd(5), '0.5')).toEqual(usd(2));
    expect(multiply(usd(7), '0.5')).toEqual(usd(4));
    expect(multiply(usd(-7), '0.5')).toEqual(usd(-4));
    expect(multiply(money('JPY', 999), '1.08')).toEqual(money('JPY', 1079));
  });
  it('allocates exactly, the leftover minor units to the parts that lost the most', () => {
    const parts = (minor: number, w: number[]) => allocate(usd(minor), w).map((p) => p.minor);
    expect(parts(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(parts(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(parts(101, [1, 2])).toEqual([34, 67]);
    expect(parts(5, [3, 7])).toEqual([2, 3]);
    expect(parts(5, [7, 3])).toEqual([4, 1]);
    expect(parts(7, [0, 1, 1])).toEqual([0, 4, 3]);
    expect(parts(1000, [1, 3, 6])).toEqual([100, 300, 600]);
    for (const [m, w] of [[1_000_001, [7, 11, 13, 17]], [-999, [1, 1, 1, 1, 1, 1, 1]], [1, [5, 5]]] as const) {
      expect(parts(m, [...w]).reduce((a, b) => a + b, 0)).toBe(m);
    }
    for (const bad of [[], [0, 0], [-1, 2], [1.5]]) expect(() => allocate(usd(1), bad)).toThrow('weights are whole numbers, not negative, not all zero');
    expect(allocate(money('KWD', 10), [1, 1])[0]?.currency).toBe('KWD');
  });
});

describe('exchange', () => {
  const rate = (currency: CurrencyCode, perUSD: string): Rate => ({ currency, perUSD, asOf: '2026-09-30', source: 'R-0000' });
  it('goes through the dollar, at each currency\'s minor units, and is always an estimate', () => {
    const r = exchange(usd(10_000), rate('USD', '1'), rate('TWD', '31.852'));
    expect(r).toEqual({ money: money('TWD', 318_520), estimate: true, from: rate('USD', '1'), to: rate('TWD', '31.852') });
    expect(exchange(money('TWD', 318_520), rate('TWD', '31.852'), rate('USD', '1')).money).toEqual(usd(10_000));
    expect(exchange(money('SVC', 875), rate('SVC', '8.75'), rate('USD', '1')).money).toEqual(usd(100));
    expect(exchange(usd(100), rate('USD', '1'), rate('JPY', '156.89')).money).toEqual(money('JPY', 157));
    expect(exchange(usd(100), rate('USD', '1'), rate('KWD', '0.3071')).money).toEqual(money('KWD', 307));
    expect(exchange(money('JPY', 1000), rate('JPY', '156.89'), rate('KWD', '0.3071')).money).toEqual(money('KWD', 1957));
    expect(exchange(usd(-150), rate('USD', '1'), rate('GBP', '0.75')).money).toEqual(money('GBP', -112));
    expect(exchange(usd(150), rate('USD', '1'), rate('GBP', '0.75')).money).toEqual(money('GBP', 112));
    expect(exchange(usd(250), rate('USD', '1'), rate('GBP', '0.75')).money).toEqual(money('GBP', 188));
  });
  it('refuses a rate for another currency, or one that is not more than zero', () => {
    expect(() => exchange(usd(1), rate('EUR', '0.9'), rate('USD', '1'))).toThrow('the rate is for EUR, the amount is in USD');
    expect(() => exchange(usd(1), rate('USD', '0'), rate('EUR', '1'))).toThrow('a rate is more than zero');
    expect(() => exchange(usd(1), rate('USD', '1'), rate('EUR', '0'))).toThrow('a rate is more than zero');
    expect(() => exchange(usd(1), rate('USD', '-1'), rate('EUR', '1'))).toThrow('a rate is more than zero');
  });
});
