import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { fromMajor, isCurrency, rational, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import { fee as accountFee, waiver as accountWaiver, type Fee as AccountFee, type Waiver as AccountWaiver } from '../banks/compile.ts';

/**
 * Compiles each country's credit cards (src/money/cards/cards.json), from the research's files, one per country
 * (research/sources/money/cards/<CC>.json, register fact money.cards.<CC>), each checked against the SHA-256 its
 * register entry cites before a byte of it is read. A card is named as its bank names it, with the bank, the card's
 * currency (the country's unless the bank names another), the interest it charges on what's owed (`rate`: a percent
 * by the year or by the month, as the bank states it, or `in full` for a charge card, whose balance the bank takes from
 * the account each month and on which nothing is carried) and the fees it
 * carries (`fees`, none where it costs nothing to hold), each read as an account's fee is (tools/money/banks), and
 * waivable also by spending a figure on the card over the fee's period (`spend`). A condition the game can't check
 * isn't written, and the fee is charged in full.
 */
export const SOURCES = 'research/sources/money/cards';
export const OUTPUT = 'src/money/cards/cards.json';

export const RATE_PERIODS = ['month', 'year'] as const;
export type RatePeriod = (typeof RATE_PERIODS)[number];

export interface Rate {
  /** The percent as the bank writes it ("24.99"), exactly. */
  percent: string;
  per: RatePeriod;
}

export type Waiver = AccountWaiver | { spend: Money };

export type Fee = Omit<AccountFee, 'waived'> & { waived?: Waiver[] };

export interface Card {
  bank: string;
  card: string;
  rate: Rate | 'in full';
  fees: Fee[];
}

const named = (s: unknown) => typeof s === 'string' && s !== '' && s.trim() === s;

/**
 * The interest a card charges: a percent by the year (at most 300) or the month (at most 25), as the bank states it;
 * or `in full`, a charge card's balance being taken from the account each month.
 */
export function rate(r: unknown, what: string): Rate | 'in full' {
  if (r === 'in full') return r;
  if (typeof r !== 'object' || r === null) throw new Error(`${what} is a percent and the period it's charged by, or in full`);
  const { percent, per } = r as Record<string, unknown>;
  if (!RATE_PERIODS.includes(per as RatePeriod)) throw new Error(`${what} is charged by the month or the year, not ${String(per)}`);
  if (typeof percent !== 'string' || !/^\d+(\.\d+)?$/.test(percent)) throw new Error(`${what}'s percent is a decimal written as text`);
  const { num, den } = rational(percent);
  // Above these the figure is a misreading (a monthly rate written as a yearly one), not a price. They were 100 and 10
  // until Nubank's revolving rate (19.99% a month, Brazil, 2026-10-29) showed a real card above the monthly one.
  if (num > (per === 'year' ? 300n : 25n) * den) throw new Error(`${what}'s percent is above what a bank charges by the ${per as string}`);
  return { percent, per: per as RatePeriod };
}

/** One condition that waives a card's fee: an account's, or spending a figure on the card over the fee's period. */
export function waiver(w: unknown, currency: CurrencyCode, what: string): Waiver {
  if (typeof w === 'object' && w !== null && Object.keys(w).length === 1 && 'spend' in w) {
    const spend = (w as { spend: unknown }).spend;
    const m = typeof spend === 'string' ? fromMajor(currency, spend) : undefined;
    if (m === undefined || m.minor <= 0) throw new Error(`${what}'s spend is an amount above nothing, written in major units`);
    return { spend: m };
  }
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

/** One bank's card, in the country's currency unless it names another: its rate and its fees. */
export function card(c: unknown, home: CurrencyCode, what: string): Card {
  if (typeof c !== 'object' || c === null) throw new Error(`${what} is not an object`);
  const { bank, card: name, currency = home, rate: r, fees } = c as Record<string, unknown>;
  if (!named(bank)) throw new Error(`${what} names the bank`);
  if (!named(name)) throw new Error(`${what} names the card the bank sells`);
  if (!isCurrency(currency as string)) throw new Error(`${what}'s currency is not one in use (${String(currency)})`);
  if (!Array.isArray(fees)) throw new Error(`${what}'s fees are a list, empty where the card costs nothing to hold`);
  return { bank: bank as string, card: name as string, rate: rate(r, `${what}'s rate`), fees: fees.map((f, i) => fee(f, currency as CurrencyCode, `${what}'s fee ${i}`)) };
}

/** A country's file: its cards, none named twice. */
export function compileCountry(code: string, file: Record<string, unknown>): Card[] {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
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
