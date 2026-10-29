import { compare, money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { feeOn, waives, type Fee as AccountFee, type Standing as AccountStanding, type Waiver as AccountWaiver } from '../banks/banks.ts';
import data from './cards.json' with { type: 'json' };

/**
 * Each country's credit cards (src/money/cards/cards.json, compiled by tools/money/cards from the research, register
 * facts money.cards.<CC>): each card as its bank names it, the interest it charges on what's owed, by the year or the
 * month as the bank states it, or none for a charge card, whose balance the bank takes from the account each month,
 * and the fees it carries, each charged and waived as an account's is
 * (src/money/banks), or waived by spending a figure on the card over the fee's period. A country whose cards the game
 * doesn't keep has none here, and the player is told.
 */

export interface Rate {
  /** The percent as the bank writes it ("24.99"), exactly. */
  readonly percent: string;
  readonly per: 'month' | 'year';
}

export type Waiver = AccountWaiver | { readonly spend: Money };

export type Fee = Omit<AccountFee, 'waived'> & { readonly waived?: readonly Waiver[] };

export interface Card {
  readonly bank: string;
  readonly card: string;
  /** `in full`: a charge card, whose balance the bank takes from the account each month. */
  readonly rate: Rate | 'in full';
  /** None where the card costs nothing to hold. */
  readonly fees: readonly Fee[];
}

const DATA = data as unknown as { countries: Record<string, readonly Card[]> };

/** Whether the game keeps a country's cards. */
export const keepsCards = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** A country's cards, in the order the research gives them; none where the game doesn't keep them. */
export const cardsIn = (country: CountryCode): readonly Card[] => DATA.countries[country] ?? [];

/** Whether the card's balance is taken from the account in full each month, so nothing is carried on it. */
export const paidInFull = (card: Card): boolean => card.rate === 'in full';

/** The interest a month adds to what's owed on the card, rounded half to even to a minor unit; nothing on a credit. */
export function interestFor(card: Card, owed: Money): Money {
  if (card.rate === 'in full') throw new Error(`${card.bank}'s ${card.card} carries nothing: it's paid in full each month`);
  const { num, den } = rational(card.rate.percent);
  // A yearly rate is charged a twelfth a month, as the banks state theirs.
  const months = card.rate.per === 'year' ? 12n : 1n;
  // A balance in the holder's favour earns nothing.
  return money(owed.currency as CurrencyCode, Number(roundHalfEven(BigInt(Math.max(owed.minor, 0)) * num, den * 100n * months)));
}

/** What the holder did over the fee's period: an account's standing, and what they spent on the card. */
export interface Standing extends AccountStanding {
  readonly spent: Money;
}

/** What a card's fee charges on a day for a period the holder stood so in: nothing where any waiver is met. */
export const feeFor = (charge: Fee, standing: Standing, on: string): Money =>
  charge.waived?.some((w) => ('spend' in w ? compare(standing.spent, w.spend) >= 0 : waives(w, standing))) === true ? money(charge.fee.currency as CurrencyCode, 0) : feeOn(charge, on);

export const UNKEPT_LINE = 'cards.unkept';

/** What the player is told about a country whose cards the game doesn't keep. Nothing otherwise. */
export const aboutCards = (country: CountryCode): string | undefined => (keepsCards(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
