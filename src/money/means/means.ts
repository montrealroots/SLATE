import { money, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './means.json' with { type: 'json' };

/**
 * What the family a life is born into gives it on the first morning (src/money/means/means.json, compiled by
 * tools/money/means from the World Inequality Database's figures, register facts money.means.<CC>): in the country the
 * family is from, a month of its band's average post-tax income per adult in checking, and its band's average net wealth
 * per adult, where below nothing, as a debt, each in the currency and of the year the database gives them; in savings,
 * the deposits its band of households holds, from the country's household wealth survey where one publishes them by
 * net wealth band (the owner's ruling of 2026-10-30), and nothing where none does, the player told so. Each family
 * is a band of the country's adults, the game's reading, said as the game's: Nothing the bottom fifth, Scraping By the
 * next, Modest the middle fifth, Comfortable the 60th to 90th percentiles, Wealthy the 90th to 99th, Inherited the top 1
 * percent. A country whose figures the game doesn't know gives nothing, and the player is told so.
 */

export const FAMILIES = ['nothing', 'scraping', 'modest', 'comfortable', 'wealthy', 'inherited'] as const;
export type Family = (typeof FAMILIES)[number];

interface Means {
  readonly currency: string;
  readonly year: number;
  readonly families: { readonly [f in Family]: { readonly checking: number; readonly debt: number; readonly savings?: number } };
  readonly liquid?: { readonly currency: string; readonly period: string };
}

const DATA = data as { countries: { readonly [code: string]: Means } };

export interface FirstMorning {
  checking: Money;
  /** The band's deposits, in the survey's currency; nothing where no survey gives them. */
  savings: Money;
  /** What the family's negative net wealth leaves the life owing. */
  debt: Money;
  /** The year the figures are of. */
  year: number;
}

/** A family's first morning in a country: checking and savings in the figures' currency; none where the game doesn't know them. */
export function meansOf(country: CountryCode, family: Family): FirstMorning | undefined {
  const m = DATA.countries[country];
  if (m === undefined) return undefined;
  const f = m.families[family];
  const currency = m.currency as CurrencyCode;
  const saved = m.liquid === undefined ? money(currency, 0) : money(m.liquid.currency as CurrencyCode, f.savings as number);
  return { checking: money(currency, f.checking), savings: saved, debt: money(currency, f.debt), year: m.year };
}

export const UNKEPT_LINE = 'means.unkept';
export const SAVINGS_UNKEPT_LINE = 'means.savings-unkept';

/** What the player is told about a country whose families' means, or whose families' savings, the game doesn't know. Nothing otherwise. */
export function aboutMeans(country: CountryCode): string | undefined {
  const m = DATA.countries[country];
  if (m === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  return m.liquid === undefined ? t(SAVINGS_UNKEPT_LINE, { country: countryName(country) }) : undefined;
}
