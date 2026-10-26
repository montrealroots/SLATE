import data from './currencies.json';

/**
 * Money: an amount in a currency's minor units (cents, fils, or the whole yen), held as a whole number so no sum ever
 * drifts. The currencies are ISO 4217's list one (register R-0026), with each one's minor units. Exchange takes a rate
 * that says where it came from and when, and its result is always an estimate, said to be one.
 */
export type CurrencyCode = keyof typeof data.currencies;

export interface Money {
  readonly currency: CurrencyCode;
  /** A whole number of minor units. */
  readonly minor: number;
}

export const ISO4217_PUBLISHED = data.published;
export const CURRENCY_CODES = Object.keys(data.currencies) as CurrencyCode[];

export function isCurrency(code: string): code is CurrencyCode {
  return Object.hasOwn(data.currencies, code);
}

export function minorUnits(code: CurrencyCode): number {
  return data.currencies[code].minorUnits;
}

export function money(currency: CurrencyCode, minor: number): Money {
  if (!isCurrency(currency)) throw new RangeError(`"${String(currency)}" is not a currency in use`);
  if (!Number.isSafeInteger(minor)) throw new RangeError(`an amount is a whole number of minor units (${minor})`);
  return { currency, minor: minor === 0 ? 0 : minor };
}

/** An amount written in major units ("1234.5", "-0.07"), with no more decimals than the currency has. */
export function fromMajor(currency: CurrencyCode, text: string): Money {
  const units = minorUnits(currency);
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (m === null) throw new RangeError(`"${text}" is not an amount`);
  const [, sign, whole = '', fraction = ''] = m;
  if (fraction.length > units) throw new RangeError(`${currency} has ${units} decimal places; "${text}" has more`);
  const minor = BigInt(whole) * 10n ** BigInt(units) + BigInt(fraction.padEnd(units, '0') || '0');
  return money(currency, Number(sign === '-' ? -minor : minor));
}

/** The amount in major units, with exactly the currency's decimals ("1234.50"). */
export function toMajor(m: Money): string {
  const units = minorUnits(m.currency);
  const abs = BigInt(Math.abs(m.minor)).toString().padStart(units + 1, '0');
  const whole = abs.slice(0, abs.length - units);
  return `${m.minor < 0 ? '-' : ''}${whole}${units > 0 ? `.${abs.slice(abs.length - units)}` : ''}`;
}

function same(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new RangeError(`${a.currency} and ${b.currency} can't be added without an exchange`);
}

export function add(a: Money, b: Money): Money {
  same(a, b);
  return money(a.currency, a.minor + b.minor);
}

export function subtract(a: Money, b: Money): Money {
  same(a, b);
  return money(a.currency, a.minor - b.minor);
}

/** -1, 0 or 1. */
export function compare(a: Money, b: Money): number {
  same(a, b);
  return Math.sign(a.minor - b.minor);
}

/** A rational number from a decimal written as text ("0.0125", "-3", "874.73"), exactly. */
export function rational(text: string): { num: bigint; den: bigint } {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (m === null) throw new RangeError(`"${text}" is not a decimal number`);
  const [, sign, whole = '', fraction = ''] = m;
  const num = BigInt(whole + fraction);
  return { num: sign === '-' ? -num : num, den: 10n ** BigInt(fraction.length) };
}

/** A fraction rounded to a whole number, half to even (so no direction is favoured over many roundings). */
export function roundHalfEven(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new RangeError('the denominator is positive');
  const q = num / den;
  const r = num % den;
  const twice = 2n * (r < 0n ? -r : r);
  if (twice < den) return q;
  const away = num < 0n ? q - 1n : q + 1n;
  if (twice > den) return away;
  return q % 2n === 0n ? q : away;
}

/** The amount times a decimal factor (an interest rate, a share), rounded half to even to a minor unit. */
export function multiply(m: Money, factor: string): Money {
  const f = rational(factor);
  return money(m.currency, Number(roundHalfEven(BigInt(m.minor) * f.num, f.den)));
}

/**
 * The amount split by weights into parts that add up to it exactly: each part rounded down, and the minor units left
 * over given one by one to the parts that lost the most in rounding (the largest-remainder method), earlier parts
 * first on a tie.
 */
export function allocate(m: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0 || weights.some((w) => !Number.isSafeInteger(w) || w < 0) || weights.every((w) => w === 0)) {
    throw new RangeError('weights are whole numbers, not negative, not all zero');
  }
  const total = BigInt(weights.reduce((a, b) => a + b, 0));
  const amount = BigInt(m.minor);
  const sign = amount < 0n ? -1n : 1n;
  const abs = amount * sign;
  const shares = weights.map((w) => ({ floor: (abs * BigInt(w)) / total, rest: (abs * BigInt(w)) % total }));
  let left = abs - shares.reduce((a, s) => a + s.floor, 0n);
  const order = shares.map((s, i) => ({ i, rest: s.rest })).sort((a, b) => (b.rest > a.rest ? 1 : b.rest < a.rest ? -1 : a.i - b.i));
  const parts = shares.map((s) => s.floor);
  for (const { i } of order) {
    if (left === 0n) break;
    parts[i] = (parts[i] as bigint) + 1n;
    left -= 1n;
  }
  return parts.map((p) => money(m.currency, Number(p * sign)));
}

/** A rate of exchange: how many units of each currency one US dollar buys, from where, and as of when. */
export interface Rate {
  currency: CurrencyCode;
  /** Units of the currency per US dollar, as a decimal written out ("874.73"). */
  perUSD: string;
  /** The date the source gives the rate for (YYYY-MM-DD). */
  asOf: string;
  /** The register entry the rate comes from. */
  source: string;
}

export interface Exchanged {
  money: Money;
  /** An exchange is always an estimate: no rate is the one a bank will give on the day. */
  estimate: true;
  from: Rate;
  to: Rate;
}

/** An amount in another currency, through the dollar, rounded half to even to the target's minor unit. */
export function exchange(m: Money, from: Rate, to: Rate): Exchanged {
  if (from.currency !== m.currency) throw new RangeError(`the rate is for ${from.currency}, the amount is in ${m.currency}`);
  const a = rational(from.perUSD);
  const b = rational(to.perUSD);
  if (a.num <= 0n || b.num <= 0n) throw new RangeError('a rate is more than zero');
  // minor_to = minor_from / 10^u_from / (a.num / a.den) * (b.num / b.den) * 10^u_to
  const num = BigInt(m.minor) * a.den * b.num * 10n ** BigInt(minorUnits(to.currency));
  const den = a.num * b.den * 10n ** BigInt(minorUnits(m.currency));
  return { money: money(to.currency, Number(roundHalfEven(num, den))), estimate: true, from, to };
}
