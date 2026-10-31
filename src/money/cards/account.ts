import { defineCommand, defineKind, defineNotice, type Context, type Item, type Json } from '../../core/frame/frame.ts';
import { add, compare, fromMajor, money, multiply, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { civilFromDays, daysFromCivil, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { ageOn } from '../../core/time/dates.ts';
import { canonicalZone } from '../../core/time/time.ts';
import type { CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { clear, record, reportAfter, standingOf, type CreditSlice } from '../credit/credit.ts';
import { cardsIn, cashFee, cashInterestFor, feeFor, fxFee, interestFor, lateFee, limitFee, minimumDue, overLimitFee, paidInFull, taxOnFees, taxOnInterest, type Card } from './cards.ts';

/**
 * A card the holder holds (BUILD-ORDER layer 3), run on its bank's own terms (src/money/cards). It has a limit, asked
 * for at opening and held to the multiple of income the bank states where it states one; opening charges its issue fee
 * and any fee set as a share of the limit at issue. Spending goes on it, the share the bank adds to spending in another
 * currency with it, and cash advances with their fee; nothing past the limit.
 *
 * Once a month, on the day it opened (the 28th at the latest), a statement is cut. Purchases bear interest once a
 * statement hasn't been paid in full by its due date, until one is: at the card's rate for the holder's record within
 * its range, its introductory rate while that lasts, its penalty rate once a minimum has been missed; or the fixed sum
 * for each step of the balance where the bank charges that instead. Cash carried bears its own rate from the day, with
 * no grace. Each fee the card costs to hold comes due in its period, counted from issue, waived as the bank
 * waives it (by spending over the period, for its first periods, by the holder's age or citizenship), a monthly one
 * with each statement and a longer one on the first statement of its period; a fee set as a share of the limit comes
 * each year after the first; a balance over the limit brings the over-limit fee; the tax the bank adds goes on
 * its interest and its fees. The statement asks its minimum (a charge card, all of it) by its due date: the grace less a
 * month of thirty days after it, or the next statement where the bank publishes no grace.
 *
 * A minimum not paid by its due date brings the late fee and the penalty rate, and is owed beside what's due after; a
 * payment clears what's past due first. One still short as many days after its due date as the country's bureaus wait to
 * report a late payment is marked on the holder's credit record (src/money/credit), which prices every card held after;
 * where the record lifts a late payment once paid, paying what was past due lifts it.
 *
 * The interest is worked on the balance on the statement's day, not day by day: shortcut: no daily balances; when the
 * accounts' ledger keeps each day's balance, interest moves to the average daily balance most banks state.
 */

/** One card held, its figures in the card's minor units. */
export interface Held {
  readonly country: string;
  readonly bank: string;
  readonly card: string;
  readonly currency: string;
  /** The card's terms as they stood when it opened, which it's run on. */
  readonly terms: Card;
  readonly limit: number;
  /** When it opened (seconds UT), and the day of the month its statements come. */
  readonly opened: number;
  readonly day: number;
  /** Owed on purchases (with fees, interest and tax), and on cash advances. */
  purchases: number;
  cash: number;
  /** Statements cut so far: the nth is the card's nth month from issue. */
  stated: number;
  /** Spent on it since the last statement, and in each statement month before, the newest last (twelve kept). */
  spent: number;
  months: number[];
  /** A statement went unpaid in full by its due date, so purchases bear interest until one is paid in full. */
  carrying: boolean;
  /** A minimum has been missed: the penalty rate, and no introductory rate. */
  late: boolean;
  /** The last statement: its balance, its minimum, its due date, and what's been paid toward it since. */
  statement: { balance: number; minimum: number; due: number; paid: number } | null;
  /** Minimums missed and still short, each by its due date, oldest first. */
  past: { due: number; short: number }[];
}

export interface CardsSlice {
  held: Held[];
}

export const CARDS_START: CardsSlice = { held: [] };

export type Holding = { cards: CardsSlice; credit: CreditSlice };

export interface Holder {
  [key: string]: Json;
  /**
   * The holder's birth date (YYYY-MM-DD), for a fee waived by age, the zone of the place they live in, whose midnight
   * their birthday turns at, and whether they're a citizen of the card's country.
   */
  born: string;
  zone: string;
  national: boolean;
}

const DAY = SECONDS_PER_DAY;
const PERIOD_MONTHS = { month: 1, bimonth: 2, quarter: 3, half: 6, year: 12 } as const;

/** A bank's card of a name, among a country's. */
export const pick = (cards: readonly Card[], bank: string, name: string): Card | undefined => cards.find((c) => c.bank === bank && c.card === name);

/** The card a held one runs on. */
export function termsOf(h: Pick<Held, 'country' | 'bank' | 'card'>): Card {
  const card = pick(cardsIn(h.country as CountryCode), h.bank, h.card);
  if (card === undefined) throw new Error(`${h.bank}'s ${h.card} isn't a card of ${h.country}`);
  return card;
}

const m = (h: Held, minor: number): Money => money(h.currency as CurrencyCode, minor);

/** An amount written in major units, above nothing. */
export function sum(currency: CurrencyCode, text: string, what: string): Money {
  const out = /^\d+(\.\d+)?$/.test(text) ? fromMajor(currency, text) : undefined;
  if (out === undefined || out.minor <= 0) throw new Error(`${what} is an amount above nothing, written in major units`);
  return out;
}

/** The next statement after a moment: the held card's day in the following month, at the hour it opened. */
export function nextStatement(h: Pick<Held, 'day' | 'opened'>, after: number): number {
  const c = civilFromDays(Math.floor(after / DAY));
  // The calendar carries a thirteenth month into the next year's January; the day, the 28th at most, is in every month.
  return daysFromCivil(c.year, c.month + 1, h.day) * DAY + (h.opened % DAY);
}

/** A statement's due date: the card's grace less a month of thirty days after it (a day at least), or the next statement. */
export const dueAfter = (card: Card, statementAt: number, h: Pick<Held, 'day' | 'opened'>): number =>
  card.grace === undefined ? nextStatement(h, statementAt) : statementAt + Math.max(card.grace - 30, 1) * DAY;

/**
 * The holder's age at a moment, in the zone they live in (the core's, src/core/time/dates.ts). Until 2026-10-30 the
 * card counted it here on UT's day, so a birthday in Tokyo came nine hours after its local midnight.
 */
const ageAt = (born: string, at: number, zone: string): number => {
  const [year, month, day] = born.split('-').map(Number) as [number, number, number];
  return ageOn({ year, month, day }, at, zone);
};

const dateOf = (at: number): string => {
  const c = civilFromDays(Math.floor(at / DAY));
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
};

export interface OpenArgs extends Holder {
  country: string;
  bank: string;
  card: string;
  /** The limit asked for, and the holder's monthly income, in the card's currency's major units. */
  limit: string;
  income: string;
}

/** Opens a card on its bank's terms from the catalog. */
const open = (s: Holding, a: OpenArgs, c: Context): void => openOn(s, a, termsOf(a), c);

/** Opens a card on terms: its limit (within its multiple of income), its issue fees, its first statement scheduled. */
export function openOn(s: Holding, a: OpenArgs, card: Card, c: Context): void {
  const limit = sum(card.currency, a.limit, 'a limit');
  const income = sum(card.currency, a.income, 'an income');
  if (canonicalZone(a.zone) === undefined) throw new Error(`${a.zone} isn't a time zone`);
  if (card.limit !== undefined && compare(limit, multiply(income, card.limit.times)) > 0) throw new Error(`${a.bank} lends at most ${card.limit.times} times a month's income on its ${a.card}`);
  const h: Held = { country: a.country, bank: a.bank, card: a.card, currency: card.currency, terms: card, limit: limit.minor, opened: c.now, day: Math.min(civilFromDays(Math.floor(c.now / DAY)).day, 28), purchases: 0, cash: 0, stated: 0, spent: 0, months: [], carrying: false, late: false, statement: null, past: [] };
  // What it costs once, at issue, and as a share of its limit at issue, with the tax the bank adds on its fees.
  const fees = add(card.issue ?? money(card.currency, 0), limitFee(card, limit, 'issue'));
  h.purchases = add(fees, taxOnFees(card, fees)).minor;
  s.cards.held.push(h);
  c.schedule(STATEMENT_KIND, nextStatement(h, c.now), { card: s.cards.held.length - 1, born: a.born, zone: a.zone, national: a.national });
}

function heldAt(s: Holding, i: number): Held {
  const h = s.cards.held[i];
  if (h === undefined) throw new Error(`there's no card ${i}`);
  return h;
}

export interface SpendArgs {
  [key: string]: Json;
  card: number;
  amount: string;
  /** Spent in another currency (the amount being what it came to in the card's). */
  foreign: boolean;
  /** A cash advance. */
  cash: boolean;
}

/** Spends on a held card: a purchase, with the share added in another currency, or a cash advance with its fee. */
export function spend(s: Holding, a: SpendArgs): void {
  const h = heldAt(s, a.card);
  const card = h.terms;
  const amt = sum(card.currency, a.amount, 'a sum spent');
  const extra = add(a.foreign ? fxFee(card, amt) : money(card.currency, 0), a.cash ? cashFee(card, amt) : money(card.currency, 0));
  const charges = add(extra, taxOnFees(card, extra));
  if (h.purchases + h.cash + amt.minor + charges.minor > h.limit) throw new Error(`that's more than the limit left on ${h.bank}'s ${h.card}`);
  if (a.cash) h.cash += amt.minor;
  else h.purchases += amt.minor;
  h.purchases += charges.minor;
  h.spent += amt.minor;
}

/**
 * Pays toward a held card: what's past due first, oldest first, then toward the statement; the cash carried is paid
 * down before the purchases, its rate having no grace.
 */
export function pay(s: Holding, a: { card: number; amount: string }, c: Context): void {
  const h = heldAt(s, a.card);
  let left = sum(h.currency as CurrencyCode, a.amount, 'a payment').minor;
  const paid = left;
  const toCash = Math.min(paid, h.cash);
  h.cash -= toCash;
  h.purchases -= paid - toCash;
  for (const p of h.past) {
    const cleared = Math.min(left, p.short);
    p.short -= cleared;
    left -= cleared;
    if (p.short === 0) clear(s.credit, `${a.card}:${p.due}`, c.now);
  }
  h.past = h.past.filter((p) => p.short > 0);
  if (h.statement !== null) h.statement.paid += left;
}

/** A statement: interest, the fees that come due, tax, the over-limit fee, its minimum, and its due date scheduled. */
export function statement(s: Holding, item: Item, c: Context): void {
  const { card: i, born, zone, national } = item.data as { card: number; born: string; zone: string; national: boolean };
  const h = heldAt(s, i);
  // @slate:consumer card.open
  const card = h.terms;
  const zero = money(card.currency, 0);
  // @slate:consumer card.report
  const standing = standingOf(s.credit, c.now);
  h.stated += 1;
  const n = h.stated;
  h.months = [...h.months, h.spent].slice(-12);
  h.spent = 0;
  let interest = zero;
  if (!paidInFull(card)) {
    if (h.carrying) interest = interestFor(card, m(h, h.purchases), standing, n, h.late);
    interest = add(interest, cashInterestFor(card, m(h, h.cash), standing));
  }
  // A monthly fee comes with each statement, for the month it closes; a longer one on the first statement of its
  // period, as a card's yearly fee comes, its spending waiver read over the period just ended.
  let fees = zero;
  for (const f of card.fees) {
    const every = PERIOD_MONTHS[f.per];
    if ((n - 1) % every !== 0) continue;
    const spent = m(h, h.months.slice(-every).reduce((a, b) => a + b, 0));
    const period = (n - 1) / every + 1;
    fees = add(fees, feeFor(f, { age: ageAt(born, c.now, zone), national, deposits: zero, lowest: zero, average: zero, spent, period }, dateOf(c.now)));
  }
  // A fee set as a share of the limit each year, from the second year (the issue's own being charged at issue).
  if (n > 1 && (n - 1) % 12 === 0) fees = add(fees, limitFee(card, m(h, h.limit), 'year'));
  // @slate:consumer card.spend
  const owed = h.purchases + h.cash + interest.minor + fees.minor;
  fees = add(fees, overLimitFee(card, { excess: m(h, owed - h.limit), balance: m(h, owed), limit: m(h, h.limit) }));
  h.purchases += add(add(interest, fees), add(taxOnInterest(card, interest), taxOnFees(card, fees))).minor;
  const balance = m(h, h.purchases + h.cash);
  // @slate:consumer card.due
  const pastDue = h.past.reduce((a, p) => a + p.short, 0);
  // What's past due is owed on top of the new minimum (Chase's agreement: "plus any amount past due"), the two never
  // more than the balance. Until 2026-10-30 the new minimum had the past due taken from it, which on a card asking a
  // share left a holder who had missed one payment owing nothing new the next month.
  const minimum = paidInFull(card) ? balance.minor : Math.max(Math.min(balance.minor, pastDue + minimumDue(card, balance, interest).minor) - pastDue, 0);
  const due = dueAfter(card, c.now, h);
  h.statement = { balance: balance.minor, minimum, due, paid: 0 };
  c.notify(STATED, { card: i, balance: balance.minor, minimum, pastDue, due });
  if (balance.minor > 0) c.schedule(DUE_KIND, due, { card: i });
  c.schedule(STATEMENT_KIND, nextStatement(h, c.now), { card: i, born, zone, national });
}

/**
 * A due date: a statement unpaid in full brings interest on purchases from here; a minimum short brings the late fee and
 * the penalty rate, and is owed past due, its record checked as long after as the country's bureaus wait to report.
 */
export function dueDate(s: Holding, item: Item, c: Context): void {
  const { card: i } = item.data as { card: number };
  const h = heldAt(s, i);
  // @slate:consumer card.statement
  const st = h.statement as NonNullable<Held['statement']>;
  h.carrying = st.paid < st.balance;
  // @slate:consumer card.pay
  if (st.paid >= st.minimum) return;
  const card = h.terms;
  const short = st.minimum - st.paid;
  const fee = lateFee(card, { minimum: m(h, st.minimum), balance: m(h, st.balance), unpaid: m(h, short) });
  h.purchases += add(fee, taxOnFees(card, fee)).minor;
  h.late = true;
  h.past.push({ due: st.due, short });
  c.notify(MISSED, { card: i, minimum: st.minimum, paid: st.paid });
  const after = reportAfter(h.country);
  if (after !== undefined) c.schedule(REPORT_KIND, st.due + after * DAY, { card: i, due: st.due });
}

/** A minimum still short as long after its due date as the country's bureaus wait: a mark on the credit record. */
export function report(s: Holding, item: Item, c: Context): void {
  const { card: i, due } = item.data as { card: number; due: number };
  if (heldAt(s, i).past.some((p) => p.due === due)) record(s.credit, heldAt(s, i).country, c.now, `${i}:${due}`);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice, and Stryker 10.0.0 counts a module that fails to load as surviving
// (10.1.0 fixes it). The declarations are held by the test that lists each with what it reads and writes; what each
// does is mutated above.
export const STATED = defineNotice('card.stated');
export const MISSED = defineNotice('card.missed');
export const STATEMENT_KIND = 'card.statement';
export const DUE_KIND = 'card.due';
export const REPORT_KIND = 'card.report';
defineKind<Holding>({ kind: STATEMENT_KIND, wants: false, reads: ['credit'], writes: ['cards', 'schedule', 'notices'], happen: statement });
defineKind<Holding>({ kind: DUE_KIND, wants: false, reads: [], writes: ['cards', 'schedule', 'notices'], happen: dueDate });
defineKind<Holding>({ kind: REPORT_KIND, wants: false, reads: ['cards'], writes: ['credit'], happen: report });
export const openCard = defineCommand<Holding, OpenArgs>({ id: 'card.open', reads: [], writes: ['cards', 'schedule'], run: open });
export const spendOnCard = defineCommand<Holding, SpendArgs>({ id: 'card.spend', reads: [], writes: ['cards'], run: spend });
export const payCard = defineCommand<Holding, { card: number; amount: string }>({ id: 'card.pay', reads: [], writes: ['cards', 'credit'], run: pay });
// Stryker restore all
