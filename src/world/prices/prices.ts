import { minorUnits, money, rational, roundHalfEven, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, currencyOf, type CountryCode } from '../gazetteer/gazetteer.ts';
import data from './levels.json' with { type: 'json' };

/**
 * Prices by country (src/world/prices/levels.json): each country's price level for what households buy, as the
 * International Comparison Program measures it and the World Bank carries it to later years (register R-0373), in the
 * country's own currency per US dollar spent in the United States. A thing's price in a country is its price in the
 * United States times that level, in the currency the gazetteer gives the country. A country without a level from
 * 2024 on has none here, and the player is told.
 */
export interface Level {
  /** Units of the country's currency that buy what a US dollar buys in the United States, as a decimal written out. */
  ppp: string;
  /** The year the level is the World Bank's for. */
  year: number;
}
const LEVELS = data as Record<string, Level>;

/** Whether the game keeps a country's prices. */
export const keepsPrices = (country: CountryCode) => Object.hasOwn(LEVELS, country);

/** A country's price level, or none where the game doesn't keep its prices. */
export const priceLevel = (country: CountryCode): Level | undefined => LEVELS[country];

/**
 * What costs a sum of US dollars in the United States costs in a country, in its currency, rounded half to even to
 * the currency's minor unit; none where the game doesn't keep its prices.
 */
export function priceIn(country: CountryCode, dollars: string): Money | undefined {
  const level = LEVELS[country];
  if (level === undefined) return undefined;
  // A country with a level has a currency (the prices test holds it).
  const currency = currencyOf(country) as NonNullable<ReturnType<typeof currencyOf>>;
  const d = rational(dollars);
  const p = rational(level.ppp);
  return money(currency, Number(roundHalfEven(d.num * p.num * 10n ** BigInt(minorUnits(currency)), d.den * p.den)));
}

export const UNKEPT_LINE = 'prices.unkept';

/** What the player is told about a country's prices: where the game doesn't keep them, that nothing there has one. Nothing where it does. */
export const aboutPrices = (country: CountryCode): string | undefined => (keepsPrices(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
