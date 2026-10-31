import { exchange, type CurrencyCode, type Exchanged, type Money, type Rate } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, currencyOf, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './rates.json' with { type: 'json' };

/**
 * The exchange rates the life's money is estimated at (src/money/rates/rates.json, compiled by tools/money/rates from
 * the research, register facts money.rates.<CUR>): each currency's units per US dollar, from the day its source gives
 * the rate, each holding until the next: the US Treasury's Reporting Rates of Exchange, the issuing central bank's
 * official rate, or a fixed parity the issuer states times its anchor's rates. The dollar is the unit. An amount in
 * another currency is always an estimate, said to be one: no rate is the one a bank will give on the day. A currency
 * whose rate the game doesn't know exchanges nothing, and the player is told so.
 */

interface Series {
  readonly fact: string;
  readonly rates: readonly { readonly from: string; readonly perUSD: string }[];
}

const DATA = data as { currencies: { readonly [code: string]: Series } };

/** A currency's rate on a day (YYYY-MM-DD): the last its source gives from that day or before; none before its first, or for one the game doesn't know. */
export function rateOn(currency: CurrencyCode, day: string): Rate | undefined {
  if (currency === 'USD') return { currency, perUSD: '1', asOf: day, source: 'the unit' };
  const series = DATA.currencies[currency];
  const step = series?.rates.findLast((s) => s.from <= day);
  return step === undefined ? undefined : { currency, perUSD: step.perUSD, asOf: step.from, source: (series as Series).fact };
}

/** Whether the game knows a currency's rate against the dollar. */
export const knowsRate = (currency: CurrencyCode): boolean => currency === 'USD' || Object.hasOwn(DATA.currencies, currency);

/** An amount in another currency on a day, an estimate, through the dollar; none where either rate isn't known that day. */
export function exchangeOn(m: Money, to: CurrencyCode, day: string): Exchanged | undefined {
  const from = rateOn(m.currency, day);
  const into = rateOn(to, day);
  return from === undefined || into === undefined ? undefined : exchange(m, from, into);
}

export const UNKEPT_LINE = 'rates.unkept';

/** What the player is told about a country whose currency's rate the game doesn't know. Nothing otherwise. */
export function aboutRate(country: CountryCode): string | undefined {
  const c = currencyOf(country);
  // Stryker disable next-line ConditionalExpression: a country with no currency has none of the rates' keys, so knowsRate already says no; the guard is for the type.
  return c !== undefined && knowsRate(c) ? undefined : t(UNKEPT_LINE, { country: countryName(country) });
}
