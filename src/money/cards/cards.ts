import { add, compare, money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { feeOn, waives, type Fee as AccountFee, type Standing as AccountStanding, type Waiver as AccountWaiver } from '../banks/banks.ts';
import data from './cards.json' with { type: 'json' };

/**
 * Each country's credit cards (src/money/cards/cards.json, compiled by tools/money/cards from the research, register
 * facts money.cards.<CC>): each card as its bank names it and every term the bank publishes that a holder meets. The
 * interest on what's carried, by the year or the month as the bank states it (a yearly one marked effective where the
 * bank states only its effective rate), priced within a range by the holder's record where the bank gives one; or none
 * for a charge card, whose balance the bank takes from the account each month; or a fixed sum for each step of the
 * balance carried. What it costs to hold, charged and waived as an account's fee is (src/money/banks), or waived by
 * spending on the card or for its first periods; once at issue; and as a share of its limit. An introductory rate; a
 * cash advance's rate and fee; the share added to spending in another currency; the minimum a statement asks and the
 * grace a purchase has; the fees for a late payment, a balance over the limit and a payment returned; the rate after a
 * late payment; the tax the bank adds; the limit as a multiple of income. A term the bank doesn't publish isn't here,
 * and the game doesn't charge it. A country whose cards the game doesn't keep has none, and the player is told.
 */

export interface Rate {
  /** The percent as the bank writes it ("24.99"), exactly: the top of its range where it has one. */
  readonly percent: string;
  readonly per: 'month' | 'year';
  /** A yearly rate the bank states as effective: a month charges the rate that, compounded twelve times, makes it. */
  readonly effective?: true;
  /** The range's lowest, where the bank prices each holder within one. */
  readonly from?: string;
}

/** A fixed sum each month for each step of the balance carried, every step begun counting. */
export interface Steps {
  readonly fee: Money;
  readonly each: Money;
}

export type Waiver = AccountWaiver | { readonly spend: Money } | { readonly first: number };

export type Fee = Omit<AccountFee, 'waived'> & { readonly waived?: readonly Waiver[] };

/** A fixed sum, a share of a base, or both, within a floor and a ceiling. */
export interface Charge {
  readonly percent?: string;
  readonly fixed?: Money;
  readonly min?: Money;
  readonly max?: Money;
}

export interface Card {
  readonly bank: string;
  readonly card: string;
  readonly currency: CurrencyCode;
  /** `in full`: a charge card, whose balance the bank takes from the account each month. */
  readonly rate: Rate | 'in full' | { readonly steps: Steps };
  /** None where the card costs nothing to hold, or where the bank publishes none (`feesUnpublished`). */
  readonly fees: readonly Fee[];
  /** The bank publishes no fee to hold the card: none is charged, and the player is told so. */
  readonly feesUnpublished?: true;
  readonly issue?: Money;
  readonly limitFees?: readonly { readonly percent: string; readonly when: 'issue' | 'year' | 'raise' }[];
  readonly intro?: { readonly percent: string; readonly per: 'month' | 'year'; readonly months: number };
  readonly cash?: { readonly rate?: Rate; readonly fee?: Charge };
  readonly fx?: string;
  readonly minimum?: { readonly percent: string; readonly floor?: Money; readonly interest?: true };
  readonly grace?: number;
  readonly late?: Charge & { readonly of?: 'minimum' | 'balance' | 'unpaid' };
  readonly overLimit?: Charge & { readonly of?: 'excess' | 'balance' | 'limit' };
  readonly returned?: Money;
  readonly penalty?: Rate;
  readonly tax?: { readonly interest?: string; readonly fees?: string };
  readonly limit?: { readonly times: string };
}

const DATA = data as unknown as { countries: Record<string, readonly Card[]> };

/** Whether the game keeps a country's cards. */
export const keepsCards = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** A country's cards, in the order the research gives them; none where the game doesn't keep them. */
export const cardsIn = (country: CountryCode): readonly Card[] => DATA.countries[country] ?? [];

/** Whether the card's balance is taken from the account in full each month, so nothing is carried on it. */
export const paidInFull = (card: Card): boolean => card.rate === 'in full';

// An effective rate's month is a twelfth root, irrational in general: it is carried to 18 decimal places, far below the
// minor unit any balance reaches, and floored, so the same balance always gives the same interest.
const SCALE = 10n ** 18n;

/** The largest integer whose twelfth power is at most n (Newton's method, from an estimate at or above the root). */
export function root12(n: bigint, above: bigint): bigint {
  let x = above;
  for (;;) {
    const next = (11n * x + n / x ** 11n) / 12n;
    if (next >= x) return x;
    x = next;
  }
}

/** A share of an amount (a percent written as text), rounded half to even to a minor unit. */
export function share(of: Money, percent: string): Money {
  const { num, den } = rational(percent);
  return money(of.currency as CurrencyCode, Number(roundHalfEven(BigInt(of.minor) * num, den * 100n)));
}

/**
 * The rate a holder is priced at within the card's range: the lowest for the best record, the top for the worst, and in
 * between in proportion (`standing`, from 0, the worst, to 1000, the best). A rate with no range is the same for all.
 */
export function priced(rate: Rate, standing: number): Rate {
  if (!Number.isInteger(standing) || standing < 0 || standing > 1000) throw new RangeError(`a standing is a whole number from 0 to 1000 (${standing})`);
  if (rate.from === undefined) return rate;
  const top = rational(rate.percent);
  const low = rational(rate.from);
  // top - (top - low) × standing / 1000, over the product of the denominators, written back as a decimal to 6 places.
  const den = top.den * low.den * 1000n;
  const num = top.num * low.den * 1000n - (top.num * low.den - low.num * top.den) * BigInt(standing);
  const micro = roundHalfEven(num * 1_000_000n, den);
  const text = `${micro / 1_000_000n}.${String(micro % 1_000_000n).padStart(6, '0')}`;
  return { percent: text, per: rate.per, ...(rate.effective === true ? { effective: true as const } : {}) };
}

/** The interest a month adds at a rate to what's owed, rounded half to even to a minor unit; nothing on a credit. */
export function monthly(rate: Rate, owed: Money): Money {
  const { num, den } = rational(rate.percent);
  const carried = BigInt(Math.max(owed.minor, 0));
  if (rate.effective === true) {
    // (1 + rate) to SCALE, then its twelfth root to SCALE: the root of (1 + rate) * SCALE^12, less one.
    const base = (SCALE * (den * 100n + num)) / (den * 100n);
    const month = root12(base * SCALE ** 11n, base) - SCALE;
    return money(owed.currency as CurrencyCode, Number(roundHalfEven(carried * month, SCALE)));
  }
  // A yearly rate is charged a twelfth a month, as the banks state theirs.
  const months = rate.per === 'year' ? 12n : 1n;
  return money(owed.currency as CurrencyCode, Number(roundHalfEven(carried * num, den * 100n * months)));
}

/** The fixed sum a month's steps charge on what's carried: each step begun, a fee; nothing on nothing. */
export const stepped = (steps: Steps, owed: Money): Money => money(owed.currency as CurrencyCode, Math.ceil(Math.max(owed.minor, 0) / steps.each.minor) * steps.fee.minor);

/**
 * The interest (or the steps' charge) a month adds to what's carried on purchases, for a holder of a standing, in the
 * card's nth month from opening (from 1): its introductory rate while that lasts, else its rate, the penalty rate after
 * a late payment where it has one.
 */
export function interestFor(card: Card, owed: Money, standing = 0, month = Number.MAX_SAFE_INTEGER, late = false): Money {
  if (card.rate === 'in full') throw new Error(`${card.bank}'s ${card.card} carries nothing: it's paid in full each month`);
  if ('steps' in card.rate) return stepped(card.rate.steps, owed);
  if (card.intro !== undefined && month <= card.intro.months && !late) return monthly(card.intro, owed);
  if (late && card.penalty !== undefined) return monthly(card.penalty, owed);
  return monthly(priced(card.rate, standing), owed);
}

/** The interest a month adds to cash advances carried: the card's cash rate where it has one, else its purchase rate. */
export function cashInterestFor(card: Card, owed: Money, standing = 0): Money {
  if (card.cash?.rate !== undefined) return monthly(priced(card.cash.rate, standing), owed);
  return interestFor(card, owed, standing);
}

/** What a charge costs on a base: its share of the base and its fixed sum, never under its floor or over its ceiling. */
export function charged(c: Charge, base: Money): Money {
  const cur = base.currency as CurrencyCode;
  let sum = add(c.percent === undefined ? money(cur, 0) : share(base, c.percent), c.fixed ?? money(cur, 0));
  // Stryker disable next-line EqualityOperator: at the floor, taking it or the sum is the same.
  if (c.min !== undefined && compare(sum, c.min) < 0) sum = c.min;
  // Stryker disable next-line EqualityOperator: at the ceiling, taking it or the sum is the same.
  if (c.max !== undefined && compare(sum, c.max) > 0) sum = c.max;
  return sum;
}

const none = (m: Money) => money(m.currency as CurrencyCode, 0);

/** A cash advance's fee on its amount; nothing where the card publishes none. */
export const cashFee = (card: Card, amount: Money): Money => (card.cash?.fee === undefined ? none(amount) : charged(card.cash.fee, amount));

/** What spending in another currency adds, on the amount in the card's; nothing where the card publishes no share. */
export const fxFee = (card: Card, amount: Money): Money => (card.fx === undefined ? none(amount) : share(amount, card.fx));

/** A statement's figures a late fee can be a share of. */
export interface Statement {
  readonly minimum: Money;
  readonly balance: Money;
  readonly unpaid: Money;
}

/** The fee for a minimum not paid by its due date; nothing where the card publishes none. */
export function lateFee(card: Card, s: Statement): Money {
  if (card.late === undefined) return none(s.minimum);
  return charged(card.late, s[card.late.of ?? 'minimum']);
}

/** A balance's place against its limit. */
export interface Over {
  readonly excess: Money;
  readonly balance: Money;
  readonly limit: Money;
}

/** The fee for a balance over the limit; nothing where the card publishes none or the balance is within it. */
export function overLimitFee(card: Card, o: Over): Money {
  if (card.overLimit === undefined || o.excess.minor <= 0) return none(o.excess);
  return charged(card.overLimit, o[card.overLimit.of ?? 'excess']);
}

/**
 * The least a statement asks: its share of the balance and the month's interest where the bank adds it, never under
 * its floor nor over the balance itself; nothing on nothing owed. A card that publishes no minimum asks the balance.
 */
export function minimumDue(card: Card, balance: Money, interest: Money): Money {
  // Stryker disable next-line EqualityOperator: at nothing owed, the minimum below is held to the balance, nothing, too.
  if (balance.minor <= 0) return none(balance);
  if (card.minimum === undefined) return balance;
  let due = share(balance, card.minimum.percent);
  if (card.minimum.interest === true) due = add(due, interest);
  // Stryker disable next-line EqualityOperator: at the floor, taking it or the sum is the same.
  if (card.minimum.floor !== undefined && compare(due, card.minimum.floor) < 0) due = card.minimum.floor;
  // Stryker disable next-line EqualityOperator: at the balance, taking it or the minimum is the same.
  return compare(due, balance) > 0 ? balance : due;
}

/** The tax a bank adds on its interest, and on its fees, at the rates it states; nothing where it states none. */
export const taxOnInterest = (card: Card, interest: Money): Money => (card.tax?.interest === undefined ? none(interest) : share(interest, card.tax.interest));
export const taxOnFees = (card: Card, fees: Money): Money => (card.tax?.fees === undefined ? none(fees) : share(fees, card.tax.fees));

/** The fees set as a share of the card's limit, charged at a moment (issue, a year, a raise), added together. */
export const limitFee = (card: Card, limit: Money, when: 'issue' | 'year' | 'raise'): Money =>
  card.limitFees?.filter((l) => l.when === when).reduce((sum, l) => add(sum, share(limit, l.percent)), none(limit)) ?? none(limit);

/** What the holder did over the fee's period: an account's standing, what they spent on the card, and which period it is. */
export interface Standing extends AccountStanding {
  readonly spent: Money;
  /** The period's place since the card was issued, the first being 1. */
  readonly period: number;
}

/** Whether the holder's standing over the period meets a waiver. */
const met = (w: Waiver, s: Standing): boolean => {
  if ('spend' in w) return compare(s.spent, w.spend) >= 0;
  if ('first' in w) return s.period <= w.first;
  return waives(w, s);
};

/** What a card's fee charges on a day for a period the holder stood so in: nothing where any waiver is met. */
export const feeFor = (charge: Fee, standing: Standing, on: string): Money =>
  charge.waived?.some((w) => met(w, standing)) === true ? money(charge.fee.currency as CurrencyCode, 0) : feeOn(charge, on);

export const UNKEPT_LINE = 'cards.unkept';
export const FEES_UNPUBLISHED_LINE = 'cards.fees-unpublished';

/** What the player is told about a card whose bank publishes no fee to hold it. Nothing otherwise. */
export const aboutCard = (card: Card): string | undefined => (card.feesUnpublished === true ? t(FEES_UNPUBLISHED_LINE, { bank: card.bank, card: card.card }) : undefined);

/** What the player is told about a country whose cards the game doesn't keep. Nothing otherwise. */
export const aboutCards = (country: CountryCode): string | undefined => (keepsCards(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
