import { defineCommand, defineKind, defineNotice, type Context, type Item, type Json } from '../../core/frame/frame.ts';
import { add, compare, fromMajor, money, subtract, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { addMonths, ageOn } from '../../core/time/dates.ts';
import { civilFromDays, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import type { CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { banksIn, feeFor, type Bank, type Fee, type Interest, type Overdraft } from '../banks/banks.ts';
import { charged, monthly } from '../cards/cards.ts';
import { accountOf, balance, move, open as openLedger, paidIn, standing, WORLD, type LedgerSlice } from '../ledger/ledger.ts';
import { meansOf, type Family } from '../means/means.ts';
import { exchangeOn } from '../rates/rates.ts';

/**
 * The accounts a life holds at real banks (BUILD-ORDER layer 3; the owner's ruling of 2026-10-30 that the money a life
 * holds is built in layer 3), each a ledger account (src/money/ledger) run on its bank's own terms (src/money/banks):
 * opened as the bank opens it (from the age it sells it, to residents where it sells only to them, with the first
 * deposit it asks), its fees charged in their periods and waived as the bank waives them (on what was paid in, the
 * lowest or the average daily balance, the holder's age or citizenship, the first periods), the interest it pays
 * credited each month on the average daily balance once above the figure it names, and its overdraft run as the bank runs
 * it: a payment past the balance refused with the returned-payment fee where the account can't be overdrawn or its
 * terms aren't published, else paid with the overdraft's fee, its monthly fee and its interest on what's overdrawn.
 * A transfer sent carries the bank's fee for it; a withdrawal at a cash machine the bank's fee for that machine.
 *
 * The first morning: the family's means (src/money/means) are paid into an everyday account at a bank of the country
 * the life starts in, its month of income into the everyday account and its savings into the bank's savings account
 * where it sells one (else into the everyday account too), carried at the day's rate where the bank keeps the
 * account in another currency.
 *
 * The holder's birth date, zone and citizenship come with each command from the life (layer 4's person holds them).
 */

const DAY = SECONDS_PER_DAY;
const PERIOD_MONTHS = { month: 1, bimonth: 2, quarter: 3, half: 6, year: 12 } as const;

export type Kind = 'everyday' | 'savings';

/** One account held, run on its bank's terms as they stood when it opened. */
export interface Opened {
  /** Its account in the ledger. */
  readonly id: string;
  readonly country: string;
  readonly bank: string;
  /** The account as the bank names it. */
  readonly account: string;
  readonly kind: Kind;
  readonly currency: string;
  readonly opened: number;
  readonly terms: Bank;
  /** Months passed since it opened. */
  months: number;
  /** The holder: their birth date (YYYY-MM-DD), the zone they live in, whether they're a citizen of the bank's country. */
  readonly born: string;
  readonly zone: string;
  readonly national: boolean;
}

export interface AccountsSlice {
  held: Opened[];
}

export const ACCOUNTS_START: AccountsSlice = { held: [] };

export type Holding = { accounts: AccountsSlice; ledger: LedgerSlice };

export interface Holder {
  [key: string]: Json;
  born: string;
  zone: string;
  national: boolean;
  /** Whether the holder lives in the bank's country, which a bank selling only to residents asks. */
  resident: boolean;
}

/** An amount written in major units, above nothing. */
export function sum(currency: CurrencyCode, text: string, what: string): Money {
  const out = /^\d+(\.\d+)?$/.test(text) ? fromMajor(currency, text) : undefined;
  if (out === undefined || out.minor <= 0) throw new Error(`${what} is an amount above nothing, written in major units`);
  return out;
}

const dateOf = (at: number): string => {
  const c = civilFromDays(Math.floor(at / DAY));
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
};

const ageAt = (born: string, at: number, zone: string): number => {
  const [year, month, day] = born.split('-').map(Number) as [number, number, number];
  return ageOn({ year, month, day }, at, zone);
};

/** The account held under a ledger id. */
export function heldOf(s: AccountsSlice, id: string): Opened {
  const found = s.held.find((h) => h.id === id);
  if (found === undefined) throw new Error(`no account ${id} is held at a bank`);
  return found;
}

/** A bank's everyday account of a name, among a country's. */
export function bankOf(country: string, bank: string, account: string): Bank {
  const found = banksIn(country as CountryCode).find((b) => b.bank === bank && b.account === account);
  if (found === undefined) throw new Error(`${bank}'s ${account} isn't an account of ${country}`);
  return found;
}

/** The fees and the interest an account of a kind carries on its bank's terms. */
export const feesOf = (h: Pick<Opened, 'kind' | 'terms'>): readonly Fee[] => (h.kind === 'savings' ? (h.terms.savings?.fees ?? []) : h.terms.fees);
export const interestOf = (h: Pick<Opened, 'kind' | 'terms'>): Interest | undefined => (h.kind === 'savings' ? h.terms.savings?.interest : h.terms.interest);

export interface OpenArgs extends Holder {
  country: string;
  bank: string;
  /** The everyday account's name, as the bank names it (its savings account is the bank's for the same). */
  account: string;
  kind: Kind;
  /** The first deposit, from an account the life already holds. */
  deposit: string | null;
  from: string | null;
}

/** Opens an account on its bank's terms: who it's sold to, its first deposit; its first month scheduled. Its ledger id. */
export function openOn(s: Holding, a: OpenArgs, terms: Bank, c: Context): string {
  if (a.kind === 'savings' && terms.savings === undefined) throw new Error(`${a.bank} sells no savings account beside its ${a.account}`);
  const currency = terms.currency as CurrencyCode;
  const opening = terms.opening;
  const age = ageAt(a.born, c.now, a.zone);
  if (opening?.from !== undefined && age < opening.from) throw new Error(`${a.bank} opens its ${a.account} from the age of ${opening.from}`);
  if (opening?.residents === true && !a.resident) throw new Error(`${a.bank} opens its ${a.account} only to those who live in the country`);
  const deposit = a.deposit === null ? null : sum(currency, a.deposit, 'a first deposit');
  if (deposit !== null && a.from === null) throw new Error('a first deposit comes from an account the life holds');
  const least = a.kind === 'savings' ? (terms.savings as NonNullable<Bank['savings']>).minimum : opening?.deposit;
  if (least !== undefined && (deposit === null || compare(deposit, least) < 0)) throw new Error(`${a.bank} asks a first deposit of ${least.minor} in minor units at least`);
  const id = `${a.kind}:${s.accounts.held.length + 1}`;
  openLedger(s.ledger, id, currency, c.now);
  s.accounts.held.push({ id, country: a.country, bank: a.bank, account: a.kind === 'savings' ? (terms.savings as NonNullable<Bank['savings']>).account : a.account, kind: a.kind, currency, opened: c.now, terms, months: 0, born: a.born, zone: a.zone, national: a.national });
  if (deposit !== null) move(s.ledger, c.now, 'first deposit', [{ account: a.from as string, amount: money(currency, -deposit.minor) }, { account: id, amount: deposit }]);
  c.schedule(MONTH_KIND, addMonths(a.zone, c.now, 1), { account: id });
  return id;
}

/** What a monthly fee, a longer one, the interest and the overdraft come to at the end of an account's month. */
export function month(s: Holding, item: Item, c: Context): void {
  const { account: id } = item.data as { account: string };
  // @slate:consumer account.open
  const h = heldOf(s.accounts, id);
  const ledger = accountOf(s.ledger, id);
  h.months += 1;
  const n = h.months;
  const cur = h.currency as CurrencyCode;
  const zero = money(cur, 0);
  const start = addMonths(h.zone, h.opened, n - 1);
  const bank = `${WORLD}${h.bank}`;
  // Interest: on the month's whole average daily balance once it's above the figure the bank names, credited at the
  // month's end.
  const rate = interestOf(h);
  // @slate:consumer account.pay
  // @slate:consumer means.first-morning
  const { average, lowest } = standing(ledger, start, c.now);
  if (rate !== undefined) {
    const over = rate.over ?? zero;
    const earned = compare(average, over) > 0 ? monthly(rate, average) : zero;
    if (earned.minor > 0) move(s.ledger, c.now, 'interest', [{ account: bank, amount: money(cur, -earned.minor) }, { account: id, amount: earned }]);
  }
  // Fees: a monthly one each month, a longer one at the end of its period, waived on the period's standing.
  let fees = zero;
  for (const f of feesOf(h)) {
    const every = PERIOD_MONTHS[f.per];
    if (n % every !== 0) continue;
    const from = addMonths(h.zone, h.opened, n - every);
    const period = standing(ledger, from, c.now);
    fees = add(fees, feeFor(f, { age: ageAt(h.born, c.now, h.zone), national: h.national, deposits: paidIn(ledger, from, c.now), lowest: period.lowest, average: period.average, period: n / every }, dateOf(c.now)));
  }
  // The overdraft: its monthly fee for a month spent overdrawn, and its interest on the average overdrawn.
  const od = h.terms.overdraft;
  if (typeof od === 'object' && lowest.minor < 0) {
    if (od.monthly !== undefined) fees = add(fees, od.monthly);
    // Nothing on an average above nothing: the month's rate takes nothing below it.
    if (od.rate !== undefined) fees = add(fees, monthly(od.rate, money(cur, -average.minor)));
  }
  if (fees.minor > 0) move(s.ledger, c.now, 'fees', [{ account: id, amount: money(cur, -fees.minor) }, { account: bank, amount: fees }]);
  c.schedule(MONTH_KIND, addMonths(h.zone, h.opened, n + 1), { account: id });
}

export interface PayArgs {
  [key: string]: Json;
  account: string;
  /** Whom it's paid to: an account the life holds, or the world beyond it by name (a shop, a landlord). */
  to: string;
  amount: string;
  /** A transfer (the bank's fee for one sent), a payment by card, or cash drawn at a machine (own, other, abroad). */
  how: 'transfer' | 'card' | 'own' | 'other' | 'abroad';
  what: string;
}

/** What a payment of a kind costs on the bank's terms, beside the payment. */
export function costOf(terms: Bank, how: PayArgs['how'], amount: Money): Money {
  const zero = money(amount.currency as CurrencyCode, 0);
  if (how === 'transfer') return terms.transfers?.domestic ?? zero;
  if (how === 'own' || how === 'other') return terms.atm?.[how] ?? zero;
  if (how === 'abroad') return terms.atm?.abroad === undefined ? zero : charged(terms.atm.abroad, amount);
  return zero;
}

/**
 * Pays from an account: past the balance, where the account can't be overdrawn or its overdraft isn't published, the
 * payment is refused and the returned-payment fee charged; where it can, it's paid with the overdraft's fee for an
 * item, within the overdraft's limit where the bank sets one.
 */
export function pay(s: Holding, a: PayArgs, c: Context): void {
  const h = heldOf(s.accounts, a.account);
  const cur = h.currency as CurrencyCode;
  const amount = sum(cur, a.amount, 'a payment');
  const cost = costOf(h.terms, a.how, amount);
  // @slate:consumer account.month
  const after = subtract(subtract(balance(accountOf(s.ledger, h.id)), amount), cost);
  const od = h.terms.overdraft;
  const bank = `${WORLD}${h.bank}`;
  if (after.minor < 0 && (od === undefined || od === false || (od.limit !== undefined && after.minor < -od.limit.minor))) {
    const returned = h.terms.returned;
    if (returned !== undefined && returned.minor > 0) move(s.ledger, c.now, 'returned payment', [{ account: h.id, amount: money(cur, -returned.minor) }, { account: bank, amount: returned }]);
    c.notify(RETURNED, { account: h.id, amount: amount.minor, fee: returned?.minor ?? 0 });
    return;
  }
  const to = a.to.startsWith(WORLD) || s.accounts.held.some((o) => o.id === a.to) ? a.to : `${WORLD}${a.to}`;
  move(s.ledger, c.now, a.what, [{ account: h.id, amount: money(cur, -amount.minor) }, { account: to, amount }]);
  let fees = cost;
  // Past the balance here, the account has an overdraft: a refused payment came back above.
  const itemFee = after.minor < 0 ? (od as Overdraft).fee : undefined;
  if (itemFee !== undefined) fees = add(fees, itemFee);
  if (fees.minor > 0) move(s.ledger, c.now, 'fees', [{ account: h.id, amount: money(cur, -fees.minor) }, { account: bank, amount: fees }]);
}

export interface FirstMorningArgs extends Holder {
  country: string;
  family: string;
  bank: string;
  account: string;
}

/**
 * The first morning: the family's means paid into an everyday account at a bank of the country (its savings into the
 * bank's savings account where it sells one), carried into the account's currency at the day's rate where it differs.
 */
export function firstMorning(s: Holding, a: FirstMorningArgs, terms: Bank, c: Context): void {
  const means = meansOf(a.country as CountryCode, a.family as Family);
  if (means === undefined) throw new Error(`what a family in ${a.country} has to give isn't known to this game`);
  const holder = { born: a.born, zone: a.zone, national: a.national, resident: a.resident };
  const everyday = openOn(s, { ...holder, country: a.country, bank: a.bank, account: a.account, kind: 'everyday', deposit: null, from: null }, terms, c);
  const savings = terms.savings === undefined ? everyday : openOn(s, { ...holder, country: a.country, bank: a.bank, account: a.account, kind: 'savings', deposit: null, from: null }, terms, c);
  for (const [into, figure] of [[everyday, means.checking], [savings, means.savings]] as const) {
    if (figure.minor === 0) continue;
    const cur = accountOf(s.ledger, into).currency as CurrencyCode;
    // Stryker disable next-line ConditionalExpression: a currency carried into itself through the dollar at one day's rate
    // comes back as it was (measured 2026-10-30 over twelve countries' families); not asking for a rate is all it saves.
    const carried = cur === figure.currency ? figure : exchangeOn(figure, cur, dateOf(c.now))?.money;
    if (carried === undefined) throw new Error(`the rate between ${figure.currency} and ${cur} isn't known to this game`);
    move(s.ledger, c.now, 'the family', [{ account: `${WORLD}family`, amount: money(cur, -carried.minor) }, { account: into, amount: carried }]);
  }
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the cards' account says). The declarations are held by the test that
// lists each with what it reads and writes; what each does is mutated above.
export const RETURNED = defineNotice('account.returned');
export const MONTH_KIND = 'account.month';
defineKind<Holding>({ kind: MONTH_KIND, wants: false, reads: [], writes: ['accounts', 'ledger', 'schedule'], happen: month });
export const openAccount = defineCommand<Holding, OpenArgs>({ id: 'account.open', reads: [], writes: ['accounts', 'ledger', 'schedule'], run: (s, a, c) => void openOn(s, a, bankOf(a.country, a.bank, a.account), c) });
export const payFromAccount = defineCommand<Holding, PayArgs>({ id: 'account.pay', reads: [], writes: ['accounts', 'ledger', 'notices'], run: pay });
export const startTheMorning = defineCommand<Holding, FirstMorningArgs>({ id: 'means.first-morning', reads: [], writes: ['accounts', 'ledger', 'schedule'], run: (s, a, c) => firstMorning(s, a, bankOf(a.country, a.bank, a.account), c) });
