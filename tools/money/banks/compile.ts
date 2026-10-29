import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { fromMajor, isCurrency, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import { civilFromDays, daysFromCivil } from '../../../src/core/time/calendar.ts';

/**
 * Compiles the banks of each country and what their everyday account costs (src/money/banks/banks.json), from the
 * research's files, one per country (research/sources/money/banks/<CC>.json, register fact money.banks.<CC>), each
 * checked against the SHA-256 its register entry cites before a byte of it is read. A bank is named as it names itself,
 * with the everyday account it sells as it names it and the fees that account carries (`fees`, none where it costs
 * nothing to keep): each in the major units of the account's currency (the country's unless the bank names another),
 * how often it's charged (`per`: a month, two months, a quarter, half a year or a year), and the conditions any one of
 * which waives it (`waived`): money paid in over the period (`deposits`), a balance never below a figure through it
 * (`balance`), an average daily balance (`average`), an age (`under`, `from`), or citizenship of the bank's country
 * (`national`). A condition the game can't check
 * isn't written, and the fee is charged in full, as it would be to anyone who doesn't meet it. A price list that states
 * the fee's next figure and the day it takes effect gives it (`changes`, each a date and the figure from it, in order);
 * a fee the price list suspends until a day stands at nothing until its first change.
 */
export const SOURCES = 'research/sources/money/banks';
export const OUTPUT = 'src/money/banks/banks.json';

export const PERIODS = ['month', 'bimonth', 'quarter', 'half', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export type Waiver = { deposits: Money } | { balance: Money } | { average: Money } | { under: number } | { from: number } | { national: true };

export interface Change {
  from: string;
  fee: Money;
}

export interface Fee {
  fee: Money;
  per: Period;
  waived?: Waiver[];
  changes?: Change[];
}

export interface Bank {
  bank: string;
  account: string;
  fees: Fee[];
}

const named = (s: unknown) => typeof s === 'string' && s !== '' && s.trim() === s;

/** An amount the bank states, in its currency's major units, above nothing. */
function amount(currency: CurrencyCode, text: unknown, what: string): Money {
  if (typeof text !== 'string') throw new Error(`${what} is an amount written in major units`);
  const m = fromMajor(currency, text);
  if (m.minor < 0) throw new Error(`${what} is an amount written in major units`);
  return m;
}

const AMOUNTS = ['deposits', 'balance', 'average'] as const;
const AGES = ['under', 'from'] as const;

/** One condition that waives the fee. */
export function waiver(w: unknown, currency: CurrencyCode, what: string): Waiver {
  if (typeof w !== 'object' || w === null || Object.keys(w).length !== 1) throw new Error(`${what} names one condition`);
  const [[key, value]] = Object.entries(w) as [[string, unknown]];
  if ((AMOUNTS as readonly string[]).includes(key)) {
    const m = amount(currency, value, `${what}'s ${key}`);
    if (m.minor === 0) throw new Error(`${what}'s ${key} is above nothing`);
    return { [key]: m } as Waiver;
  }
  if (key === 'national') {
    if (value !== true) throw new Error(`${what}'s national is true`);
    return { national: true };
  }
  if ((AGES as readonly string[]).includes(key)) {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 120) throw new Error(`${what}'s ${key} is an age in whole years`);
    return { [key]: value } as Waiver;
  }
  throw new Error(`${what} names a condition the game doesn't check (${key})`);
}

/** A calendar date written YYYY-MM-DD, one the calendar has. */
export function day(text: unknown, what: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
  if (m === null) throw new Error(`${what} is a date written YYYY-MM-DD`);
  const [y, mo, d] = m.slice(1).map(Number) as [number, number, number];
  // A day the month doesn't have (the 29th of February 2027, the 32nd) lands in another month.
  if (civilFromDays(daysFromCivil(y, mo, d)).month !== mo) throw new Error(`${what} is a date written YYYY-MM-DD`);
  return text as string;
}

/** A fee's next figures, each from the day the price list gives, in order. */
export function changes(list: unknown, currency: CurrencyCode, what: string): Change[] {
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${what} are a list of dates and figures`);
  const out = list.map((c: unknown, i) => {
    const { from, fee: figure } = (c ?? {}) as Record<string, unknown>;
    return { from: day(from, `${what}' ${i}`), fee: amount(currency, figure, `${what}' ${i}`) };
  });
  out.forEach((c, i) => {
    if (i > 0 && c.from <= (out[i - 1] as Change).from) throw new Error(`${what} are in order of their dates`);
  });
  return out;
}

/** One fee an account carries, in its currency. */
export function fee(f: unknown, currency: CurrencyCode, what: string): Fee {
  if (typeof f !== 'object' || f === null) throw new Error(`${what} is not an object`);
  const { fee: figure, per, waived, changes: next } = f as Record<string, unknown>;
  const out: Fee = { fee: amount(currency, figure, what), per: per as Period };
  // A fee at nothing now is one the price list suspends until a later day it gives (Ameriabank's, until 1 July 2027).
  if (out.fee.minor === 0 && next === undefined) throw new Error(`${what} is above nothing, or suspended until a change`);
  if (!PERIODS.includes(per as Period)) throw new Error(`${what} is charged by the month, two months, the quarter, the half year or the year, not ${String(per)}`);
  if (waived !== undefined) {
    if (!Array.isArray(waived) || waived.length === 0) throw new Error(`${what}'s waivers are a list of conditions`);
    out.waived = waived.map((w, i) => waiver(w, currency, `${what}'s waiver ${i}`));
  }
  if (next !== undefined) out.changes = changes(next, currency, `${what}'s changes`);
  return out;
}

/** One bank's everyday account, in the country's currency unless it names another, and its fees. */
export function bank(b: unknown, home: CurrencyCode, what: string): Bank {
  if (typeof b !== 'object' || b === null) throw new Error(`${what} is not an object`);
  const { bank: name, account, currency = home, fees } = b as Record<string, unknown>;
  if (!named(name)) throw new Error(`${what} names the bank`);
  if (!named(account)) throw new Error(`${what} names the account the bank sells`);
  if (!isCurrency(currency as string)) throw new Error(`${what}'s currency is not one in use (${String(currency)})`);
  if (!Array.isArray(fees)) throw new Error(`${what}'s fees are a list, empty where the account costs nothing`);
  return { bank: name as string, account: account as string, fees: fees.map((f, i) => fee(f, currency as CurrencyCode, `${what}'s fee ${i}`)) };
}

/** A country's file: its banks, none named twice. */
export function compileCountry(code: string, file: Record<string, unknown>): Bank[] {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const home = (countries as Record<string, { currency: string }>)[code]?.currency as CurrencyCode;
  const list = file['banks'];
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${code} names no bank`);
  const banks = list.map((b, i) => bank(b, home, `${code}'s bank ${i}`));
  banks.forEach((b, i) => {
    if (banks.findIndex((o) => o.bank === b.bank && o.account === b.account) !== i) throw new Error(`${code} names ${b.bank}'s ${b.account} twice`);
  });
  return banks;
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

/** The bytes of a research file, checked against what the register cites. */
function cited(root: string, path: string, shas: ReadonlyMap<string, string | undefined>): Record<string, unknown> {
  const bytes = readFileSync(join(root, path));
  const sha = shas.get(path);
  if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
}

/** Every country's banks, of the files the register cites and checks. */
export function readBanks(root: string): { countries: Record<string, Bank[]> } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.banks.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const out: Record<string, Bank[]> = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas));
  }
  return { countries: out };
}

export const serialize = (banks: ReturnType<typeof readBanks>) => `${JSON.stringify(banks, null, 1)}\n`;
