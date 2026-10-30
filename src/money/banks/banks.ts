import { compare, money, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import type { Charge } from '../cards/cards.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './banks.json' with { type: 'json' };

/**
 * The banks of each country and what their everyday account costs (src/money/banks/banks.json, compiled by
 * tools/money/banks from the research, register facts money.banks.<CC>): each bank as it names itself, the account it
 * sells as it names it, and the fees that account carries, each with how often it's charged and the conditions any one of
 * which waives it. From 2026-10-30 the account also carries every other term the bank states that its holder meets: its
 * overdraft, a returned payment, the interest it pays, its debit card, its cash machines, its transfers, what opening it
 * asks, and the bank's savings account. A term the bank doesn't state isn't here, and the game doesn't charge it. A
 * country whose banks the game doesn't keep has none here, and the player is told.
 */

/** How often a fee is charged: a month, two months, a quarter, half a year or a year. */
export type Period = 'month' | 'bimonth' | 'quarter' | 'half' | 'year';

export type Waiver =
  | { readonly deposits: Money }
  | { readonly balance: Money }
  | { readonly average: Money }
  | { readonly under: number }
  | { readonly from: number }
  /** The holder is a citizen of the bank's country. */
  | { readonly national: true }
  /** The account's first so many periods. */
  | { readonly first: number };

export interface Fee {
  readonly fee: Money;
  readonly per: Period;
  /** Any one of these waives the fee for the period. */
  readonly waived?: readonly Waiver[];
  /** The figures the price list gives the fee from later days (YYYY-MM-DD), in order. */
  readonly changes?: readonly { readonly from: string; readonly fee: Money }[];
}

/** A rate as the bank writes it ("1.25"), by the year or the month. */
export interface Rate {
  readonly percent: string;
  readonly per: 'month' | 'year';
}

/** What the bank pays on a balance: the rate, on the part above `over` where the bank pays only above a figure. */
export interface Interest extends Rate {
  readonly over?: Money;
}

/** An overdraft's terms, each where the bank states it. A charge at nothing is one the bank says is free. */
export interface Overdraft {
  /** The interest on what's overdrawn. */
  readonly rate?: Rate;
  /** Each item paid into the overdraft. */
  readonly fee?: Money;
  /** Each month spent overdrawn. */
  readonly monthly?: Money;
  /** The limit the bank sets for every holder. */
  readonly limit?: Money;
}

/** A paper the bank asks to open an account: a passport, an identity card, a national number, a residence permit, a proof of address. */
export type Paper = 'passport' | 'id' | 'number' | 'residence' | 'address';

export interface Bank {
  readonly bank: string;
  readonly account: string;
  /** The currency the account is kept in: the country's, or the one the bank names. */
  readonly currency: string;
  /** None where the account costs nothing to keep. */
  readonly fees: readonly Fee[];
  /** `false`: a payment past the balance is refused. */
  readonly overdraft?: false | Overdraft;
  /** The fee for a payment refused for want of funds. */
  readonly returned?: Money;
  /** What the bank pays on the account's balance. */
  readonly interest?: Interest;
  /** The debit card's own fee, and its share (a percent) on spending in another currency. */
  readonly debit?: { readonly fee?: Fee; readonly fx?: string };
  /** Each withdrawal: at the bank's own machines, at another bank's at home, and abroad. */
  readonly atm?: { readonly own?: Money; readonly other?: Money; readonly abroad?: Charge };
  /** Each transfer sent, at home and abroad. */
  readonly transfers?: { readonly domestic?: Money; readonly abroad?: Charge };
  /** What opening the account asks: a first deposit, an age from which it's sold, residence in the country, papers. */
  readonly opening?: { readonly deposit?: Money; readonly from?: number; readonly residents?: true; readonly papers?: readonly Paper[] };
  /** The bank's savings account for individuals: its interest, its fees where the bank states them, its least balance. */
  readonly savings?: { readonly account: string; readonly interest: Interest; readonly fees?: readonly Fee[]; readonly minimum?: Money };
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
  /** Whether the holder is a citizen of the bank's country. */
  readonly national: boolean;
  /** The period's place since the account was opened, the first being 1. */
  readonly period: number;
}

/** Whether the holder's standing over the period meets a waiver. */
export const waives = (w: Waiver, s: Standing): boolean => {
  if ('deposits' in w) return compare(s.deposits, w.deposits) >= 0;
  if ('balance' in w) return compare(s.lowest, w.balance) >= 0;
  if ('average' in w) return compare(s.average, w.average) >= 0;
  if ('under' in w) return s.age < w.under;
  if ('national' in w) return s.national;
  if ('first' in w) return s.period <= w.first;
  return s.age >= w.from;
};

/** The figure a fee stands at on a day (YYYY-MM-DD): the last change from that day or before, else its first. */
export const feeOn = (charge: Pick<Fee, 'fee' | 'changes'>, on: string): Money => charge.changes?.filter((c) => c.from <= on).at(-1)?.fee ?? charge.fee;

/** What a fee charges on a day for a period the holder stood so in: nothing where any waiver is met. */
export const feeFor = (charge: Fee, standing: Standing, on: string): Money =>
  charge.waived?.some((w) => waives(w, standing)) === true ? money(charge.fee.currency as CurrencyCode, 0) : feeOn(charge, on);

export const UNKEPT_LINE = 'banks.unkept';

/** What the player is told about a country whose banks the game doesn't keep. Nothing otherwise. */
export const aboutBanks = (country: CountryCode): string | undefined => (keepsBanks(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
