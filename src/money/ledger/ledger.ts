import { money, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { SECONDS_PER_DAY } from '../../core/time/calendar.ts';

/**
 * The ledger (BUILD-ORDER layer 3, the owner's ruling of 2026-10-30 that the money a life holds is built here): every
 * account a life holds, each in one currency, and every movement of money between them. The house standard holds it:
 * a balance is never a figure typed, it's the sum of the account's postings.
 *
 * A movement is one transaction of two or more postings in one currency whose amounts sum to nothing: what leaves one
 * account enters another. Money from or to the world beyond the life (the family on the first morning, a shop, a bank's
 * fees, an employer) goes through the world's account of that name in that currency, opened the first time it's
 * named and kept like any other, so each currency's accounts sum to nothing at every moment. Postings come in the order
 * of their moments; an account opened at a moment takes nothing before it.
 */

const DAY = SECONDS_PER_DAY;

export interface Posting {
  /** The moment (seconds UT), the transaction it belongs to, what it was (a fee, a deposit, a payment), its amount in minor units: in above nothing, out below. */
  readonly at: number;
  readonly tx: number;
  readonly what: string;
  readonly amount: number;
}

export interface Account {
  readonly id: string;
  readonly currency: string;
  readonly opened: number;
  readonly postings: Posting[];
}

export interface LedgerSlice {
  accounts: Account[];
  /** The id the next transaction takes. */
  next: number;
}

export const LEDGER_START: LedgerSlice = { accounts: [], next: 1 };

/** The world's accounts are named so, one per name and currency: `world:family:USD`. */
export const WORLD = 'world:';
export const worldAccount = (name: string, currency: string) => `${WORLD}${name}:${currency}`;

/** An account the life holds, by its id. */
export function accountOf(l: LedgerSlice, id: string): Account {
  const found = l.accounts.find((a) => a.id === id);
  if (found === undefined) throw new Error(`no account ${id} is held`);
  return found;
}

/** Opens an account in a currency at a moment; its id is its own. */
export function open(l: LedgerSlice, id: string, currency: CurrencyCode, at: number): Account {
  if (l.accounts.some((a) => a.id === id)) throw new Error(`the account ${id} is held already`);
  const made: Account = { id, currency, opened: at, postings: [] };
  l.accounts.push(made);
  return made;
}

/** One leg of a movement: the account (or the world's, by its name) and what enters it (above nothing) or leaves it. */
export interface Leg {
  readonly account: string;
  readonly amount: Money;
}

/**
 * Moves money at a moment: every leg in one currency, the legs summing to nothing, each account holding that currency
 * and open by then, and nothing posted to it later already. The world's accounts named (`world:<name>`) are opened as
 * they're first met. The transaction's id.
 */
export function move(l: LedgerSlice, at: number, what: string, legs: readonly Leg[]): number {
  if (legs.length < 2) throw new Error(`${what} moves money between two accounts at least`);
  const currency = (legs[0] as Leg).amount.currency;
  if (legs.some((g) => g.amount.currency !== currency)) throw new Error(`${what} moves money in one currency`);
  // Stryker disable next-line ArithmeticOperator: a sum and its negative are nothing together or not at all.
  if (legs.reduce((s, g) => s + g.amount.minor, 0) !== 0) throw new Error(`${what} doesn't balance: what leaves must enter`);
  const accounts = legs.map((g) => {
    const id = g.account.startsWith(WORLD) ? worldAccount(g.account.slice(WORLD.length), currency) : g.account;
    const held = l.accounts.find((a) => a.id === id) ?? (id.startsWith(WORLD) ? open(l, id, currency as CurrencyCode, at) : accountOf(l, id));
    if (held.currency !== currency) throw new Error(`${held.id} is held in ${held.currency}, not ${currency}`);
    if (at < held.opened || at < (held.postings.at(-1)?.at ?? at)) throw new Error(`${held.id} has nothing to post before its last moment`);
    return held;
  });
  const tx = l.next;
  l.next = tx + 1;
  legs.forEach((g, i) => (accounts[i] as Account).postings.push({ at, tx, what, amount: g.amount.minor }));
  return tx;
}

const of = (a: Account, minor: number): Money => money(a.currency as CurrencyCode, minor);

/** An account's balance at a moment (its postings up to and at it), or now. */
export const balance = (a: Account, at = Number.MAX_SAFE_INTEGER): Money => of(a, a.postings.reduce((s, p) => (p.at <= at ? s + p.amount : s), 0));

/** What came into an account from a moment (inclusive) to another (exclusive), its own transfers out not netted. */
// Stryker disable next-line EqualityOperator: a posting of nothing adds nothing either way.
export const paidIn = (a: Account, from: number, to: number): Money => of(a, a.postings.reduce((s, p) => (p.at >= from && p.at < to && p.amount > 0 ? s + p.amount : s), 0));

/**
 * An account's balance over a period of whole days from a moment (inclusive) to another (exclusive): the lowest it
 * stood at any time in it and the average of its balances at each day's end, as banks state an average daily balance.
 */
export function standing(a: Account, from: number, to: number): { lowest: Money; average: Money } {
  if (to <= from) throw new Error('a period runs forward');
  const days = Math.ceil((to - from) / DAY);
  let lowest = balance(a, from).minor;
  // Stryker disable next-line EqualityOperator: a posting at the period's first moment is in the balance it starts from.
  for (const p of a.postings) if (p.at > from && p.at < to) lowest = Math.min(lowest, balance(a, p.at).minor);
  let total = 0;
  for (let d = 1; d <= days; d += 1) total += balance(a, Math.min(from + d * DAY, to) - 1).minor;
  return { lowest: of(a, lowest), average: of(a, Number(roundHalfEven(BigInt(total), BigInt(days)))) };
}
