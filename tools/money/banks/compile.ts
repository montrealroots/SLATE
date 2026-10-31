import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { fromMajor, isCurrency, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import { civilFromDays, daysFromCivil } from '../../../src/core/time/calendar.ts';
// The cards' compile reads an account's fee and waiver from here: these are used only once a file is read, never as
// either module loads, so the two may import each other.
import { amount as above, charge, percent, RATE_PERIODS, type Charge, type RatePeriod } from '../cards/compile.ts';

/**
 * Compiles the banks of each country and what their everyday account costs (src/money/banks/banks.json), from the
 * research's files, one per country (research/sources/money/banks/<CC>.json, register fact money.banks.<CC>), each
 * checked against the SHA-256 its register entry cites before a byte of it is read. A bank is named as it names itself,
 * with the everyday account it sells as it names it and the fees that account carries (`fees`, none where it costs
 * nothing to keep): each in the major units of the account's currency (the country's unless the bank names another),
 * how often it's charged (`per`: a month, two months, a quarter, half a year or a year), and the conditions any one of
 * which waives it (`waived`): money paid in over the period (`deposits`), a balance never below a figure through it
 * (`balance`), an average daily balance (`average`), an age (`under`, `from`), or citizenship of the bank's country
 * (`national`), or the account's first periods (`first`). A condition the game can't check
 * isn't written, and the fee is charged in full, as it would be to anyone who doesn't meet it. A price list that states
 * the fee's next figure and the day it takes effect gives it (`changes`, each a date and the figure from it, in order);
 * a fee the price list suspends until a day stands at nothing until its first change.
 *
 * From 2026-10-30 (the owner's ruling that account formats are built with transfers, layer 3) the account may also give
 * every other term its holder meets, each only where the bank states it: `overdraft` (`false` where a payment past the
 * balance is refused; else its rate, its fee for each item paid into it, its fee for each month spent in it, and the
 * limit the bank sets for every holder), `returned` (a payment refused for want of funds), `interest` (what the bank pays
 * on the balance, above a figure where it says so), `debit` (the card's own fee and its share on another currency),
 * `atm` (each withdrawal at the bank's own machines, another bank's at home, and abroad), `transfers` (each sent at home
 * and abroad), `opening` (the deposit, the age, residence and the papers it asks) and `savings` (the bank's savings
 * account: its name, its interest, its fees and its minimum). A charge for one item (a withdrawal, a transfer, a returned
 * payment, an item paid into overdraft) may be nothing, where the bank says it's free, so nothing is told apart from not
 * known; a threshold (a limit, a deposit, a minimum, the figure interest is paid above) is above nothing, since one at
 * nothing is no threshold and is left out. A share abroad is the cards' charge (tools/money/cards), its floor and ceiling
 * `min` and `max`. Nothing else is taken, so a misspelt term isn't read as one the bank doesn't state.
 *
 * A place with no bank of its own, where its source says so, is `none` (from 2026-10-30; until then such a place could
 * only be blocked): it compiles to no banks, and the player is told there's none.
 */
export const SOURCES = 'research/sources/money/banks';
export const OUTPUT = 'src/money/banks/banks.json';

export const PERIODS = ['month', 'bimonth', 'quarter', 'half', 'year'] as const;
export type Period = (typeof PERIODS)[number];

export type Waiver = { deposits: Money } | { balance: Money } | { average: Money } | { under: number } | { from: number } | { national: true } | { first: number };

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

/** A rate as the bank writes it ("1.25"), by the year or the month. */
export interface Rate {
  percent: string;
  per: RatePeriod;
}

/** What the bank pays on a balance, above a figure where it says so. */
export interface Interest extends Rate {
  over?: Money;
}

export interface Overdraft {
  rate?: Rate;
  /** Each item paid into the overdraft. */
  fee?: Money;
  /** Each month spent overdrawn. */
  monthly?: Money;
  /** The limit the bank sets for every holder. */
  limit?: Money;
}

export const PAPERS = ['passport', 'id', 'number', 'residence', 'address'] as const;
export type Paper = (typeof PAPERS)[number];

export interface Opening {
  deposit?: Money;
  from?: number;
  residents?: true;
  papers?: Paper[];
}

export interface Savings {
  account: string;
  interest: Interest;
  fees?: Fee[];
  minimum?: Money;
}

export interface Bank {
  bank: string;
  account: string;
  /** The currency the account is kept in: the country's, or the one the bank names. */
  currency: CurrencyCode;
  fees: Fee[];
  overdraft?: false | Overdraft;
  returned?: Money;
  interest?: Interest;
  debit?: { fee?: Fee; fx?: string };
  atm?: { own?: Money; other?: Money; abroad?: Charge };
  transfers?: { domestic?: Money; abroad?: Charge };
  opening?: Opening;
  savings?: Savings;
}

const named = (s: unknown) => typeof s === 'string' && s !== '' && s.trim() === s;

/** A term's parts: an object with none but its own keys, and at least one unless an empty one says something. */
function terms(o: unknown, keys: readonly string[], what: string, empty = false): Record<string, unknown> {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error(`${what} is not an object`);
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${what} has no term ${k}`);
  if (!empty && Object.keys(o).length === 0) throw new Error(`${what} names none of ${keys.join(', ')}`);
  return o as Record<string, unknown>;
}

/** An age in whole years a bank can name. */
function age(n: unknown, what: string): number {
  if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 120) throw new Error(`${what} is an age in whole years`);
  return n as number;
}

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
  if ((AGES as readonly string[]).includes(key)) return { [key]: age(value, `${what}'s ${key}`) } as Waiver;
  // The cards' bound (tools/money/cards): no price list met frees more than five years.
  if (key === 'first') {
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 60) throw new Error(`${what}'s first is a whole number from 1 to 60`);
    return { first: value as number };
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
  const { fee: figure, per, waived, changes: next } = terms(f, ['fee', 'per', 'waived', 'changes'], what, true);
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

/** A rate by the year or the month, within the cards' ceilings (above them the figure is a misreading). */
export function rate(r: unknown, what: string): Rate {
  const { percent: p, per } = terms(r, ['percent', 'per'], what);
  if (!RATE_PERIODS.includes(per as RatePeriod)) throw new Error(`${what} is a rate by the month or the year, not ${String(per)}`);
  return { percent: percent(p, per === 'year' ? 300n : 25n, `${what}'s percent`), per: per as RatePeriod };
}

/** What the bank pays on a balance, above a figure where it says so. */
export function interest(i: unknown, currency: CurrencyCode, what: string): Interest {
  const { over, ...r } = terms(i, ['percent', 'per', 'over'], what);
  const out: Interest = rate(r, what);
  if (over !== undefined) out.over = above(over, currency, `${what}'s over`);
  return out;
}

/** `false` where the account can't go below nothing; else the overdraft's terms, none of them where the bank states none. */
export function overdraft(o: unknown, currency: CurrencyCode, what: string): false | Overdraft {
  if (o === false) return false;
  const { rate: r, fee: f, monthly, limit } = terms(o, ['rate', 'fee', 'monthly', 'limit'], what, true);
  const out: Overdraft = {};
  if (r !== undefined) out.rate = rate(r, `${what}'s rate`);
  if (f !== undefined) out.fee = amount(currency, f, `${what}'s fee`);
  if (monthly !== undefined) out.monthly = amount(currency, monthly, `${what}'s monthly`);
  if (limit !== undefined) out.limit = above(limit, currency, `${what}'s limit`);
  return out;
}

/** The debit card's own fee, read as the account's are, and its share on spending in another currency. */
export function debit(d: unknown, currency: CurrencyCode, what: string): NonNullable<Bank['debit']> {
  const { fee: f, fx } = terms(d, ['fee', 'fx'], what);
  const out: NonNullable<Bank['debit']> = {};
  if (f !== undefined) out.fee = fee(f, currency, `${what}'s fee`);
  if (fx !== undefined) out.fx = percent(fx, 100n, `${what}'s fx`);
  return out;
}

/** Each withdrawal: at the bank's own machines, another bank's at home, and abroad. */
export function atm(a: unknown, currency: CurrencyCode, what: string): NonNullable<Bank['atm']> {
  const { own, other, abroad } = terms(a, ['own', 'other', 'abroad'], what);
  const out: NonNullable<Bank['atm']> = {};
  if (own !== undefined) out.own = amount(currency, own, `${what}'s own`);
  if (other !== undefined) out.other = amount(currency, other, `${what}'s other`);
  if (abroad !== undefined) out.abroad = charge(abroad, currency, [], `${what}'s abroad`);
  return out;
}

/** Each transfer sent, at home and abroad. */
export function transfers(t: unknown, currency: CurrencyCode, what: string): NonNullable<Bank['transfers']> {
  const { domestic, abroad } = terms(t, ['domestic', 'abroad'], what);
  const out: NonNullable<Bank['transfers']> = {};
  if (domestic !== undefined) out.domestic = amount(currency, domestic, `${what}'s domestic`);
  if (abroad !== undefined) out.abroad = charge(abroad, currency, [], `${what}'s abroad`);
  return out;
}

/** What opening the account asks: a first deposit, an age, residence in the country, and papers. */
export function opening(o: unknown, currency: CurrencyCode, what: string): Opening {
  const { deposit, from, residents, papers } = terms(o, ['deposit', 'from', 'residents', 'papers'], what);
  const out: Opening = {};
  if (deposit !== undefined) out.deposit = above(deposit, currency, `${what}'s deposit`);
  if (from !== undefined) out.from = age(from, `${what}'s from`);
  if (residents !== undefined) {
    if (residents !== true) throw new Error(`${what}'s residents is true`);
    out.residents = true;
  }
  if (papers !== undefined) {
    if (!Array.isArray(papers) || papers.length === 0 || papers.some((p, i) => !PAPERS.includes(p as Paper) || papers.indexOf(p) !== i)) throw new Error(`${what}'s papers are a list of ${PAPERS.join(', ')}, each once`);
    out.papers = papers as Paper[];
  }
  return out;
}

/** The bank's savings account for individuals: its name, its interest, its fees where it states them, its minimum. */
export function savings(s: unknown, currency: CurrencyCode, what: string): Savings {
  const { account, interest: i, fees, minimum } = terms(s, ['account', 'interest', 'fees', 'minimum'], what);
  if (!named(account)) throw new Error(`${what} names the account the bank sells`);
  const out: Savings = { account: account as string, interest: interest(i, currency, `${what}'s interest`) };
  if (fees !== undefined) {
    if (!Array.isArray(fees)) throw new Error(`${what}'s fees are a list, empty where the account costs nothing`);
    out.fees = fees.map((f, n) => fee(f, currency, `${what}'s fee ${n}`));
  }
  if (minimum !== undefined) out.minimum = above(minimum, currency, `${what}'s minimum`);
  return out;
}

const TERMS = ['bank', 'account', 'currency', 'fees', 'overdraft', 'returned', 'interest', 'debit', 'atm', 'transfers', 'opening', 'savings'];

/** One bank's everyday account, in the country's currency unless it names another, its fees and every other term it states. */
export function bank(b: unknown, home: CurrencyCode, what: string): Bank {
  const o = terms(b, TERMS, what, true);
  const { bank: name, account, currency = home, fees } = o;
  if (!named(name)) throw new Error(`${what} names the bank`);
  if (!named(account)) throw new Error(`${what} names the account the bank sells`);
  if (!isCurrency(currency as string)) throw new Error(`${what}'s currency is not one in use (${String(currency)})`);
  const cur = currency as CurrencyCode;
  if (!Array.isArray(fees)) throw new Error(`${what}'s fees are a list, empty where the account costs nothing`);
  const out: Bank = { bank: name as string, account: account as string, currency: cur, fees: fees.map((f, i) => fee(f, cur, `${what}'s fee ${i}`)) };
  if (o['overdraft'] !== undefined) out.overdraft = overdraft(o['overdraft'], cur, `${what}'s overdraft`);
  if (o['returned'] !== undefined) out.returned = amount(cur, o['returned'], `${what}'s returned`);
  if (o['interest'] !== undefined) out.interest = interest(o['interest'], cur, `${what}'s interest`);
  if (o['debit'] !== undefined) out.debit = debit(o['debit'], cur, `${what}'s debit`);
  if (o['atm'] !== undefined) out.atm = atm(o['atm'], cur, `${what}'s atm`);
  if (o['transfers'] !== undefined) out.transfers = transfers(o['transfers'], cur, `${what}'s transfers`);
  if (o['opening'] !== undefined) out.opening = opening(o['opening'], cur, `${what}'s opening`);
  if (o['savings'] !== undefined) out.savings = savings(o['savings'], cur, `${what}'s savings`);
  return out;
}

/** A country's file: its banks, none named twice; or none at all, where its source says it has no bank of its own. */
export function compileCountry(code: string, file: Record<string, unknown>): Bank[] {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  if ('none' in file) {
    if (file['none'] !== true) throw new Error(`${code}'s file says it has no bank only as none: true`);
    for (const k of Object.keys(file)) if (!['country', 'none', 'note', 'sources'].includes(k)) throw new Error(`${code}, which has no bank, has no term ${k}`);
    return [];
  }
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
