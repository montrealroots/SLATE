import { compare, money, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './banks.json' with { type: 'json' };

/**
 * The banks of each country and what their everyday account costs (src/money/banks/banks.json, compiled by
 * tools/money/banks from the research, register facts money.banks.<CC>): each bank as it names itself, the account it
 * sells as it names it, and the fees that account carries, each with how often it's charged and the conditions any one of
 * which waives it. A country whose banks the game doesn't keep has none here, and the player is told.
 */

/** How often a fee is charged: a month, two months, a quarter, half a year or a year. */
export type Period = 'month' | 'bimonth' | 'quarter' | 'half' | 'year';

export type Waiver =
  | { readonly deposits: Money }
  | { readonly balance: Money }
  | { readonly average: Money }
  | { readonly under: number }
  | { readonly from: number };

export interface Fee {
  readonly fee: Money;
  readonly per: Period;
  /** Any one of these waives the fee for the period. */
  readonly waived?: readonly Waiver[];
  /** The figures the price list gives the fee from later days (YYYY-MM-DD), in order. */
  readonly changes?: readonly { readonly from: string; readonly fee: Money }[];
}

export interface Bank {
  readonly bank: string;
  readonly account: string;
  /** None where the account costs nothing to keep. */
  readonly fees: readonly Fee[];
}

const DATA = data as unknown as { countries: Record<string, readonly Bank[]> };

/** Whether the game keeps a country's banks. */
export const keepsBanks = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** A country's banks, in the order the research gives them; none where the game doesn't keep them. */
export const banksIn = (country: CountryCode): readonly Bank[] => DATA.countries[country] ?? [];

/** What the holder did over the period the fee is charged for, in the account's currency. */
export interface Standing {
  readonly age: number;
  /** Money paid in over the period. */
  readonly deposits: Money;
  /** The lowest the balance stood at any time in it. */
  readonly lowest: Money;
  /** The average of its daily balances. */
  readonly average: Money;
}

const met = (w: Waiver, s: Standing): boolean => {
  if ('deposits' in w) return compare(s.deposits, w.deposits) >= 0;
  if ('balance' in w) return compare(s.lowest, w.balance) >= 0;
  if ('average' in w) return compare(s.average, w.average) >= 0;
  if ('under' in w) return s.age < w.under;
  return s.age >= w.from;
};

/** The figure a fee stands at on a day (YYYY-MM-DD): the last change from that day or before, else its first. */
export const feeOn = (charge: Fee, on: string): Money => charge.changes?.filter((c) => c.from <= on).at(-1)?.fee ?? charge.fee;

/** What a fee charges on a day for a period the holder stood so in: nothing where any waiver is met. */
export const feeFor = (charge: Fee, standing: Standing, on: string): Money =>
  charge.waived?.some((w) => met(w, standing)) === true ? money(charge.fee.currency as CurrencyCode, 0) : feeOn(charge, on);

export const UNKEPT_LINE = 'banks.unkept';

/** What the player is told about a country whose banks the game doesn't keep. Nothing otherwise. */
export const aboutBanks = (country: CountryCode): string | undefined => (keepsBanks(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
