import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { fromMajor, isCurrency, rational, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import { fee as accountFee, waiver as accountWaiver, type Fee as AccountFee, type Waiver as AccountWaiver } from '../banks/compile.ts';

/**
 * Compiles each country's credit cards (src/money/cards/cards.json), from the research's files, one per country
 * (research/sources/money/cards/<CC>.json, register fact money.cards.<CC>), each checked against the SHA-256 its
 * register entry cites before a byte of it is read. A card is named as its bank names it, with the bank and the card's
 * currency (the country's unless the bank names another), and every term the bank publishes that a holder meets:
 *
 * - `rate`: the interest on what's carried, a percent by the year or the month as the bank states it (a yearly one
 *   marked `effective` where the bank states only its effective rate), with `from`, the lowest, where the bank prices
 *   each holder within a range; or `in full`, a charge card, whose balance is taken from the account each month; or
 *   `steps`, a fixed sum charged each month for each step of the balance carried, instead of interest (Kapital Bank's
 *   Birbank Star, 10 manat for each 500).
 * - `fees`: what it costs to hold, each read as an account's fee is (tools/money/banks), waivable also by spending a
 *   figure on the card over the fee's period (`spend`) or for its first periods (`first`); `issue`, what it costs once,
 *   when it's issued; `limitFees`, those set as a share of the card's limit, at issue, each year or at a raise;
 *   `feesUnpublished`, with no fees, where the bank publishes nothing a holder pays to hold the card, so the game
 *   charges none and says it doesn't know, rather than reading the empty list as a card that costs nothing.
 * - `intro`: an introductory purchase rate, for so many months from the card's opening.
 * - `cash`: a cash advance's own rate and fee; `fx`: the share added to spending in another currency.
 * - `minimum`: the least a statement asks, a share of its balance, never under a floor, the month's interest on top
 *   where the bank adds it; `grace`: the most days a purchase goes without interest, the statement paid in full.
 * - `late`, `overLimit`: the fee for a minimum not paid by its due date, and for a balance over the limit, each a fixed
 *   sum or a share of what the bank names (the minimum, the balance, the unpaid part; the excess, the balance, the
 *   limit), within a floor and a ceiling; `returned`: a payment returned unpaid; `penalty`: the rate after a late payment.
 * - `tax`: a tax the bank adds on its interest or its fees, at the rate it states.
 * - `limit`: the limit as a multiple of the holder's monthly income, where the bank states one.
 *
 * A term the bank doesn't publish is left out, and the game says what it doesn't know. A condition the game can't check
 * isn't written, and the fee is charged in full.
 */
export const SOURCES = 'research/sources/money/cards';
export const OUTPUT = 'src/money/cards/cards.json';

export const RATE_PERIODS = ['month', 'year'] as const;
export type RatePeriod = (typeof RATE_PERIODS)[number];

export interface Rate {
  /** The percent as the bank writes it ("24.99"), exactly: the top of a range. */
  percent: string;
  per: RatePeriod;
  /** A yearly rate the bank states as effective (compounded monthly), not nominal. */
  effective?: true;
  /** The lowest of the range the bank prices a holder within, where it gives one. */
  from?: string;
}

/** A fixed sum charged each month for each step of the balance carried (each started step counts). */
export interface Steps {
  fee: Money;
  each: Money;
}

export type Waiver = AccountWaiver | { spend: Money } | { first: number };

export type Fee = Omit<AccountFee, 'waived'> & { waived?: Waiver[] };

/** A fee set as a fixed sum, a share of a base, or both, within a floor and a ceiling. */
export interface Charge {
  percent?: string;
  fixed?: Money;
  min?: Money;
  max?: Money;
}

export const LATE_BASES = ['minimum', 'balance', 'unpaid'] as const;
export const OVER_BASES = ['excess', 'balance', 'limit'] as const;
export const LIMIT_WHEN = ['issue', 'year', 'raise'] as const;

export interface Card {
  bank: string;
  card: string;
  currency: CurrencyCode;
  rate: Rate | 'in full' | { steps: Steps };
  fees: Fee[];
  /** The bank publishes no fee to hold the card: none is charged, and the player is told so. */
  feesUnpublished?: true;
  issue?: Money;
  limitFees?: { percent: string; when: (typeof LIMIT_WHEN)[number] }[];
  intro?: { percent: string; per: RatePeriod; months: number };
  cash?: { rate?: Rate; fee?: Charge };
  fx?: string;
  minimum?: { percent: string; floor?: Money; interest?: true; plus?: Money };
  grace?: number;
  late?: Charge & { of?: (typeof LATE_BASES)[number] };
  overLimit?: Charge & { of?: (typeof OVER_BASES)[number] };
  returned?: Money;
  penalty?: Rate;
  tax?: { interest?: string; fees?: string };
  limit?: { times: string };
}

const named = (s: unknown) => typeof s === 'string' && s !== '' && s.trim() === s;
const object = (o: unknown, what: string): Record<string, unknown> => {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error(`${what} is not an object`);
  return o as Record<string, unknown>;
};
/** Refuses a key the form doesn't have, so a misspelt term isn't read as one the bank doesn't publish. */
const only = (o: Record<string, unknown>, keys: readonly string[], what: string) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${what} has no term ${k}`);
};
/** Refuses anything left over once a term's own parts are taken. */
const nothingElse = (rest: Record<string, unknown>, what: string) => {
  const [k] = Object.keys(rest);
  if (k !== undefined) throw new Error(`${what} has no term ${k}`);
};

/** A decimal written as text, at most a ceiling. */
export function percent(text: unknown, ceiling: bigint, what: string): string {
  if (typeof text !== 'string' || !/^\d+(\.\d+)?$/.test(text)) throw new Error(`${what} is a decimal written as text`);
  const { num, den } = rational(text);
  if (num > ceiling * den) throw new Error(`${what} is above ${ceiling}`);
  return text;
}

/** An amount the bank states in the card's currency's major units, above nothing. */
export function amount(text: unknown, currency: CurrencyCode, what: string): Money {
  const m = typeof text === 'string' && /^\d+(\.\d+)?$/.test(text) ? fromMajor(currency, text) : undefined;
  if (m === undefined || m.minor <= 0) throw new Error(`${what} is an amount above nothing, written in major units`);
  return m;
}

/** A whole number within bounds. */
function whole(n: unknown, low: number, high: number, what: string): number {
  if (!Number.isInteger(n) || (n as number) < low || (n as number) > high) throw new Error(`${what} is a whole number from ${low} to ${high}`);
  return n as number;
}

/**
 * Interest: a percent by the year (at most 300) or the month (at most 25), as the bank states it, a yearly one marked
 * `effective` where the bank states only its effective annual rate (Peru's TEA, Colombia's E.A.), with the range's
 * lowest (`from`) where it prices within one.
 */
export function interest(r: unknown, what: string): Rate {
  const { percent: p, per, effective, from, ...rest } = object(r, what);
  nothingElse(rest, what);
  if (!RATE_PERIODS.includes(per as RatePeriod)) throw new Error(`${what} is charged by the month or the year, not ${String(per)}`);
  // Above these the figure is a misreading (a monthly rate written as a yearly one), not a price. They were 100 and 10
  // until Nubank's revolving rate (19.99% a month, Brazil, 2026-10-29) showed a real card above the monthly one.
  const top = percent(p, per === 'year' ? 300n : 25n, `${what}'s percent`);
  const out: Rate = { percent: top, per: per as RatePeriod };
  if (effective !== undefined) {
    if (effective !== true || per !== 'year') throw new Error(`${what} is effective only as a yearly rate, marked true`);
    out.effective = true;
  }
  if (from !== undefined) {
    const low = percent(from, 300n, `${what}'s from`);
    const a = rational(low);
    const b = rational(top);
    if (a.num * b.den >= b.num * a.den) throw new Error(`${what}'s range runs from below its percent`);
    out.from = low;
  }
  return out;
}

/** The interest a card charges on what's carried: a rate, in full, or a fixed sum for each step of the balance. */
export function rate(r: unknown, currency: CurrencyCode, what: string): Card['rate'] {
  if (r === 'in full') return r;
  if (typeof r === 'object' && r !== null && 'steps' in r) {
    const { steps, ...rest } = r as Record<string, unknown>;
    nothingElse(rest, what);
    const { fee: f, each, ...more } = object(steps, `${what}'s steps`);
    nothingElse(more, `${what}'s steps`);
    return { steps: { fee: amount(f, currency, `${what}'s step fee`), each: amount(each, currency, `${what}'s step`) } };
  }
  if (typeof r !== 'object' || r === null) throw new Error(`${what} is a percent and the period it's charged by, in full, or steps`);
  return interest(r, what);
}

/** One condition that waives a card's fee: an account's, spending a figure over the fee's period, or its first periods. */
export function waiver(w: unknown, currency: CurrencyCode, what: string): Waiver {
  if (typeof w === 'object' && w !== null && Object.keys(w).length === 1 && 'spend' in w) return { spend: amount((w as { spend: unknown }).spend, currency, `${what}'s spend`) };
  return accountWaiver(w, currency, what);
}

/** One fee a card carries, in its currency. */
export function fee(f: unknown, currency: CurrencyCode, what: string): Fee {
  if (typeof f !== 'object' || f === null) throw new Error(`${what} is not an object`);
  const { waived, ...rest } = f as Record<string, unknown>;
  const out: Fee = accountFee(rest, currency, what);
  if (waived !== undefined) {
    if (!Array.isArray(waived) || waived.length === 0) throw new Error(`${what}'s waivers are a list of conditions`);
    out.waived = waived.map((w, i) => waiver(w, currency, `${what}'s waiver ${i}`));
  }
  return out;
}

/** A fee set as a fixed sum, a share of a base (from the bases named), or both, within a floor and a ceiling. */
export function charge<B extends string>(c: unknown, currency: CurrencyCode, bases: readonly B[], what: string): Charge & { of?: B } {
  const { percent: p, fixed, min, max, of, ...rest } = object(c, what);
  nothingElse(rest, what);
  if (p === undefined && fixed === undefined) throw new Error(`${what} is a share, a fixed sum, or both`);
  const out: Charge & { of?: B } = {};
  if (p !== undefined) {
    out.percent = percent(p, 100n, `${what}'s percent`);
    if (bases.length > 0) {
      if (!bases.includes(of as B)) throw new Error(`${what}'s share is of ${bases.join(', ')}, not ${String(of)}`);
      out.of = of as B;
    }
  }
  if (of !== undefined && out.of === undefined) throw new Error(`${what} names a base only for a share`);
  if (fixed !== undefined) out.fixed = amount(fixed, currency, `${what}'s fixed`);
  if (min !== undefined) out.min = amount(min, currency, `${what}'s min`);
  if (max !== undefined) out.max = amount(max, currency, `${what}'s max`);
  if (out.min !== undefined && out.max !== undefined && out.min.minor > out.max.minor) throw new Error(`${what}'s min is above its max`);
  if (p === undefined && (min !== undefined || max !== undefined)) throw new Error(`${what}'s floor and ceiling bound a share`);
  return out;
}

const TERMS = ['bank', 'card', 'currency', 'rate', 'fees', 'feesUnpublished', 'issue', 'limitFees', 'intro', 'cash', 'fx', 'minimum', 'grace', 'late', 'overLimit', 'returned', 'penalty', 'tax', 'limit'];

/** One bank's card, in the country's currency unless it names another, with every term the bank publishes. */
export function card(c: unknown, home: CurrencyCode, what: string): Card {
  const o = object(c, what);
  only(o, TERMS, what);
  const { bank, card: name, currency = home, rate: r, fees } = o;
  if (!named(bank)) throw new Error(`${what} names the bank`);
  if (!named(name)) throw new Error(`${what} names the card the bank sells`);
  if (!isCurrency(currency as string)) throw new Error(`${what}'s currency is not one in use (${String(currency)})`);
  const cur = currency as CurrencyCode;
  if (!Array.isArray(fees)) throw new Error(`${what}'s fees are a list, empty where the card costs nothing to hold`);
  const out: Card = { bank: bank as string, card: name as string, currency: cur, rate: rate(r, cur, `${what}'s rate`), fees: fees.map((f, i) => fee(f, cur, `${what}'s fee ${i}`)) };
  if (o['feesUnpublished'] !== undefined) {
    if (o['feesUnpublished'] !== true || fees.length !== 0) throw new Error(`${what}'s fees are unpublished (feesUnpublished: true) only where it lists none`);
    out.feesUnpublished = true;
  }
  if (o['issue'] !== undefined) out.issue = amount(o['issue'], cur, `${what}'s issue`);
  if (o['limitFees'] !== undefined) {
    const list = o['limitFees'];
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${what}'s limitFees are a list`);
    out.limitFees = list.map((l, i) => {
      const { percent: p, when, ...rest } = object(l, `${what}'s limitFee ${i}`);
      nothingElse(rest, `${what}'s limitFee ${i}`);
      if (!LIMIT_WHEN.includes(when as (typeof LIMIT_WHEN)[number])) throw new Error(`${what}'s limitFee ${i} is charged at issue, each year or at a raise, not ${String(when)}`);
      return { percent: percent(p, 100n, `${what}'s limitFee ${i}`), when: when as (typeof LIMIT_WHEN)[number] };
    });
  }
  if (o['intro'] !== undefined) {
    const { months, ...r2 } = object(o['intro'], `${what}'s intro`);
    const { percent: p, per } = interest(r2, `${what}'s intro`);
    out.intro = { percent: p, per, months: whole(months, 1, 60, `${what}'s intro months`) };
  }
  if (o['cash'] !== undefined) {
    const { rate: cr, fee: cf, ...rest } = object(o['cash'], `${what}'s cash`);
    nothingElse(rest, `${what}'s cash`);
    if (cr === undefined && cf === undefined) throw new Error(`${what}'s cash names its rate, its fee, or both`);
    out.cash = {};
    if (cr !== undefined) out.cash.rate = interest(cr, `${what}'s cash rate`);
    if (cf !== undefined) out.cash.fee = charge(cf, cur, [], `${what}'s cash fee`);
  }
  if (o['fx'] !== undefined) out.fx = percent(o['fx'], 100n, `${what}'s fx`);
  if (o['minimum'] !== undefined) {
    const { percent: p, floor, interest: plus, plus: sumAdded, ...rest } = object(o['minimum'], `${what}'s minimum`);
    nothingElse(rest, `${what}'s minimum`);
    out.minimum = { percent: percent(p, 100n, `${what}'s minimum`) };
    if (floor !== undefined) out.minimum.floor = amount(floor, cur, `${what}'s minimum floor`);
    if (plus !== undefined) {
      if (plus !== true) throw new Error(`${what}'s minimum adds the interest, marked true`);
      out.minimum.interest = true;
    }
    // A fixed sum on top of the share and the interest, as Canada's banks ask "the interest, the fees and $10".
    if (sumAdded !== undefined) out.minimum.plus = amount(sumAdded, cur, `${what}'s minimum plus`);
  }
  if (o['grace'] !== undefined) out.grace = whole(o['grace'], 1, 90, `${what}'s grace`);
  if (o['late'] !== undefined) out.late = charge(o['late'], cur, LATE_BASES, `${what}'s late`);
  if (o['overLimit'] !== undefined) out.overLimit = charge(o['overLimit'], cur, OVER_BASES, `${what}'s overLimit`);
  if (o['returned'] !== undefined) out.returned = amount(o['returned'], cur, `${what}'s returned`);
  if (o['penalty'] !== undefined) out.penalty = interest(o['penalty'], `${what}'s penalty`);
  if (o['tax'] !== undefined) {
    const { interest: ti, fees: tf, ...rest } = object(o['tax'], `${what}'s tax`);
    nothingElse(rest, `${what}'s tax`);
    if (ti === undefined && tf === undefined) throw new Error(`${what}'s tax is on its interest, its fees, or both`);
    out.tax = {};
    if (ti !== undefined) out.tax.interest = percent(ti, 100n, `${what}'s tax on interest`);
    if (tf !== undefined) out.tax.fees = percent(tf, 100n, `${what}'s tax on fees`);
  }
  if (o['limit'] !== undefined) {
    const { times, ...rest } = object(o['limit'], `${what}'s limit`);
    nothingElse(rest, `${what}'s limit`);
    const t = percent(times, 50n, `${what}'s limit times`);
    if (rational(t).num === 0n) throw new Error(`${what}'s limit times is above nothing`);
    out.limit = { times: t };
  }
  return out;
}

/**
 * A country's file: its cards, none named twice; or none at all, where its source says no bank there offers one (from
 * 2026-10-31, as the banks' `none`; until then such a place could only be blocked).
 */
export function compileCountry(code: string, file: Record<string, unknown>): Card[] {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  if ('none' in file) {
    if (file['none'] !== true) throw new Error(`${code}'s file says no bank there offers a card only as none: true`);
    for (const k of Object.keys(file)) if (!['country', 'none', 'note', 'sources'].includes(k)) throw new Error(`${code}, where no bank offers a card, has no term ${k}`);
    return [];
  }
  const home = (countries as Record<string, { currency: string }>)[code]?.currency as CurrencyCode;
  const list = file['cards'];
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${code} names no card`);
  const cards = list.map((c, i) => card(c, home, `${code}'s card ${i}`));
  cards.forEach((c, i) => {
    if (cards.findIndex((o) => o.bank === c.bank && o.card === c.card) !== i) throw new Error(`${code} names ${c.bank}'s ${c.card} twice`);
  });
  return cards;
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

/** Every country's cards, of the files the register cites and checks. */
export function readCards(root: string): { countries: Record<string, Card[]> } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.cards.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const out: Record<string, Card[]> = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas));
  }
  return { countries: out };
}

export const serialize = (cards: ReturnType<typeof readCards>) => `${JSON.stringify(cards, null, 1)}\n`;
