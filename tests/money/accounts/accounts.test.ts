import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, pass, type Context, type Json } from '../../../src/core/frame/frame.ts';
import { money } from '../../../src/core/money/money.ts';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { addMonths } from '../../../src/core/time/dates.ts';
import {
  ACCOUNTS_START,
  bankOf,
  costOf,
  feesOf,
  firstMorning,
  heldOf,
  interestOf,
  month,
  MONTH_KIND,
  openAccount,
  openOn,
  pay,
  payFromAccount,
  RETURNED,
  startTheMorning,
  sum,
  type Holding,
  type OpenArgs,
} from '../../../src/money/accounts/accounts.ts';
import type { Bank } from '../../../src/money/banks/banks.ts';
import { accountOf, balance, LEDGER_START } from '../../../src/money/ledger/ledger.ts';
import { meansOf } from '../../../src/money/means/means.ts';
import { exchangeOn } from '../../../src/money/rates/rates.ts';

const DAY = 86_400;
const ZONE = 'America/New_York';
const at = (y: number, m: number, d: number, h = 14) => daysFromCivil(y, m, d) * DAY + h * 3600;
const usd = (minor: number) => money('USD', minor);
const T0 = at(2026, 1, 15);

function ctx(now: number) {
  const scheduled: { kind: string; at: number; data: Json }[] = [];
  const notices: { kind: string; data: Json }[] = [];
  const c: Context = {
    now,
    draws: () => {
      throw new Error('no draws');
    },
    items: () => [],
    schedule: (kind, when, data = null) => scheduled.push({ kind, at: when, data }),
    cancel: () => undefined,
    notices: () => [],
    notify: (kind, data = null) => notices.push({ kind, data }),
    markRead: () => undefined,
  };
  return { c, scheduled, notices };
}

const fresh = (): Holding => ({ accounts: structuredClone(ACCOUNTS_START), ledger: structuredClone(LEDGER_START) });
const holder = { born: '1996-03-10', zone: ZONE, national: true, resident: true };
const args = (o: Partial<OpenArgs> = {}): OpenArgs => ({ ...holder, country: 'US', bank: 'B', account: 'A', kind: 'everyday', deposit: null, from: null, ...o });
const plain: Bank = { bank: 'B', account: 'A', currency: 'USD', fees: [] };
const bal = (s: Holding, id: string) => balance(accountOf(s.ledger, id)).minor;
/** Money into an account from the world, at a moment. */
const fund = (s: Holding, id: string, minor: number, when: number) => {
  s.ledger.accounts.find((a) => a.id === id)?.postings.push({ at: when, tx: 0, what: 'pay', amount: minor });
};

describe('an account at a bank', () => {
  it('opens on the bank\'s terms, its first month scheduled in the holder\'s zone', () => {
    expect(ACCOUNTS_START).toStrictEqual({ held: [] });
    const s = fresh();
    const { c, scheduled } = ctx(T0);
    expect(openOn(s, args(), plain, c)).toBe('everyday:1');
    expect(heldOf(s.accounts, 'everyday:1')).toStrictEqual({ id: 'everyday:1', country: 'US', bank: 'B', account: 'A', kind: 'everyday', currency: 'USD', opened: T0, terms: plain, months: 0, born: '1996-03-10', zone: ZONE, national: true });
    expect(accountOf(s.ledger, 'everyday:1')).toStrictEqual({ id: 'everyday:1', currency: 'USD', opened: T0, postings: [] });
    expect(scheduled).toEqual([{ kind: MONTH_KIND, at: addMonths(ZONE, T0, 1), data: { account: 'everyday:1' } }]);
    expect(() => heldOf(s.accounts, 'everyday:9')).toThrow('no account everyday:9 is held at a bank');
    // The bank's catalog: Chase's Total Checking in the United States.
    expect(bankOf('US', 'Chase', 'Chase Total Checking').currency).toBe('USD');
    expect(() => bankOf('US', 'Chase', 'Nothing')).toThrow("Chase's Nothing isn't an account of US");
    expect(() => bankOf('US', 'Citi', 'Chase Total Checking')).toThrow("Citi's Chase Total Checking isn't an account of US");
    // Opened to a holder living abroad where the bank doesn't ask residence.
    expect(openOn(fresh(), args({ resident: false }), plain, ctx(T0).c)).toBe('everyday:1');
  });

  it('opens only to whom the bank sells, with the first deposit it asks, from an account held', () => {
    const terms: Bank = { ...plain, opening: { from: 18, residents: true, deposit: usd(2500) }, savings: { account: 'Saver', interest: { percent: '1', per: 'year' }, minimum: usd(10000) } };
    const s = fresh();
    expect(() => openOn(s, args({ born: '2010-01-16' }), terms, ctx(T0).c)).toThrow('B opens its A from the age of 18');
    expect(openOn(fresh(), args({ born: '2008-01-15', deposit: '25', from: 'world:wallet' }), terms, ctx(T0).c)).toBe('everyday:1');
    expect(() => openOn(s, args({ resident: false }), terms, ctx(T0).c)).toThrow('B opens its A only to those who live in the country');
    expect(() => openOn(s, args(), terms, ctx(T0).c)).toThrow('B asks a first deposit of 2500 in minor units at least');
    expect(() => openOn(s, args({ deposit: '24.99', from: 'x' }), terms, ctx(T0).c)).toThrow('B asks a first deposit of 2500 in minor units at least');
    for (const deposit of ['ten', 'x25', '25x']) expect(() => openOn(s, args({ deposit, from: 'x' }), terms, ctx(T0).c), deposit).toThrow('a first deposit is an amount above nothing, written in major units');
    expect(() => openOn(s, args({ deposit: '25' }), terms, ctx(T0).c)).toThrow('a first deposit comes from an account the life holds');
    expect(() => openOn(s, args({ kind: 'savings' }), plain, ctx(T0).c)).toThrow('B sells no savings account beside its A');
    const id = openOn(s, args({ deposit: '200', from: 'world:wallet' }), terms, ctx(T0).c);
    expect([bal(s, id), bal(s, 'world:wallet:USD')]).toEqual([20000, -20000]);
    expect(accountOf(s.ledger, id).postings.map((p) => p.what)).toEqual(['first deposit']);
    // A savings account takes its own least, and its own name.
    expect(() => openOn(s, args({ kind: 'savings', deposit: '50', from: id }), terms, ctx(T0).c)).toThrow('B asks a first deposit of 10000 in minor units at least');
    const saver = openOn(s, args({ kind: 'savings', deposit: '100', from: id }), terms, ctx(T0).c);
    expect([saver, heldOf(s.accounts, saver).account, bal(s, id), bal(s, saver)]).toEqual(['savings:2', 'Saver', 10000, 10000]);
    expect([feesOf(heldOf(s.accounts, saver)), interestOf(heldOf(s.accounts, saver)), interestOf(heldOf(s.accounts, id))]).toStrictEqual([[], { percent: '1', per: 'year' }, undefined]);
    expect([feesOf({ kind: 'savings', terms: plain }), interestOf({ kind: 'savings', terms: plain })]).toStrictEqual([[], undefined]);
    expect(feesOf({ kind: 'savings', terms: { ...plain, savings: { account: 'S', interest: { percent: '1', per: 'year' }, fees: [{ fee: usd(1), per: 'month' }] } } })).toStrictEqual([{ fee: usd(1), per: 'month' }]);
    expect(sum('USD', '1.5', 'x')).toStrictEqual(usd(150));
    expect(() => sum('USD', '0', 'x')).toThrow('x is an amount above nothing, written in major units');
  });

  it('charges its fees in their periods, waived as the bank waives them, and pays its interest on the average balance', () => {
    const chase = bankOf('US', 'Chase', 'Chase Total Checking');
    const s = fresh();
    const id = openOn(s, args({ bank: 'Chase', account: 'Chase Total Checking' }), chase, ctx(T0).c);
    const end = addMonths(ZONE, T0, 1);
    // 400 paid in, never 1,500 held, an average under 5,000: the 15-dollar fee.
    fund(s, id, 40000, T0 + DAY);
    const { c, scheduled } = ctx(end);
    month(s, { id: 1, at: end, kind: MONTH_KIND, data: { account: id } }, c);
    expect([bal(s, id), bal(s, 'world:Chase:USD'), heldOf(s.accounts, id).months]).toEqual([38500, 1500, 1]);
    expect(scheduled).toEqual([{ kind: MONTH_KIND, at: addMonths(ZONE, T0, 2), data: { account: id } }]);
    // 500 paid in waives it.
    fund(s, id, 50000, end + DAY);
    const end2 = addMonths(ZONE, T0, 2);
    month(s, { id: 2, at: end2, kind: MONTH_KIND, data: { account: id } }, ctx(end2).c);
    expect(bal(s, id)).toBe(88500);
    // A fee's next figure from a later day isn't charged before it (the day read as YYYY-MM-DD, the 5th as 05).
    const early = at(2026, 1, 5);
    const ew = fresh();
    const ex = openOn(ew, args(), { ...plain, fees: [{ fee: usd(100), per: 'month', changes: [{ from: '2026-02-10', fee: usd(900) }] }] }, ctx(early).c);
    month(ew, { id: 1, at: addMonths(ZONE, early, 1), kind: MONTH_KIND, data: { account: ex } }, ctx(addMonths(ZONE, early, 1)).c);
    expect(bal(ew, ex)).toBe(-100);
    // A fee's next figure from a later day isn't charged before it.
    const w = fresh();
    const x = openOn(w, args(), { ...plain, fees: [{ fee: usd(100), per: 'month', changes: [{ from: '2026-10-01', fee: usd(900) }] }] }, ctx(T0).c);
    month(w, { id: 1, at: end, kind: MONTH_KIND, data: { account: x } }, ctx(end).c);
    expect(bal(w, x)).toBe(-100);
    // A yearly fee at the end of its year, waived its first year; interest above a figure, on the average.
    const terms: Bank = { ...plain, fees: [{ fee: usd(1200), per: 'year', waived: [{ first: 1 }] }, { fee: usd(100), per: 'month', waived: [{ under: 30 }] }], interest: { percent: '12', per: 'year', over: usd(1000) } };
    const t = fresh();
    const a = openOn(t, args(), terms, ctx(T0).c);
    fund(t, a, 100000, T0);
    for (let n = 1; n <= 24; n += 1) month(t, { id: n, at: addMonths(ZONE, T0, n), kind: MONTH_KIND, data: { account: a } }, ctx(addMonths(ZONE, T0, n)).c);
    // The monthly fee is waived under 30: the holder turns 30 on 10 March 2026, so the first month (to 15 February) is
    // free and the 23 after it are charged, the twelfth and the twenty-fourth with the yearly fee, its first year waived.
    const fees = accountOf(t.ledger, a).postings.filter((p) => p.what === 'fees').map((p) => p.amount);
    expect(fees.slice(-1)).toEqual([-1300]);
    expect(fees).toHaveLength(23);
    expect(fees.filter((f) => f === -1300)).toHaveLength(1);
    const interest = accountOf(t.ledger, a).postings.filter((p) => p.what === 'interest');
    expect(interest[0]?.amount).toBe(1000);
    // Nothing earned at or under the figure.
    const u = fresh();
    const b = openOn(u, args(), { ...plain, interest: { percent: '12', per: 'year', over: usd(1000) } }, ctx(T0).c);
    fund(u, b, 1000, T0);
    month(u, { id: 1, at: end, kind: MONTH_KIND, data: { account: b } }, ctx(end).c);
    expect(accountOf(u.ledger, b).postings.map((p) => p.what)).toEqual(['pay']);
    // With no figure, interest on any average above nothing.
    const v = fresh();
    const d = openOn(v, args(), { ...plain, interest: { percent: '12', per: 'year' } }, ctx(T0).c);
    fund(v, d, 10000, T0);
    month(v, { id: 1, at: end, kind: MONTH_KIND, data: { account: d } }, ctx(end).c);
    expect(bal(v, d)).toBe(10100);
  });

  it('runs an overdraft as the bank runs it, and refuses a payment past the balance where it has none', () => {
    const od: Bank = { ...plain, overdraft: { fee: usd(500), monthly: usd(300), rate: { percent: '24', per: 'year' }, limit: usd(10000) }, transfers: { domestic: usd(100) }, atm: { own: usd(50), other: usd(250), abroad: { percent: '2', fixed: usd(300) } } };
    const s = fresh();
    const id = openOn(s, args(), od, ctx(T0).c);
    fund(s, id, 5000, T0);
    // A transfer of 60 past the 50 held: paid, its fee and the overdraft's for an item.
    pay(s, { account: id, to: 'landlord', amount: '60', how: 'transfer', what: 'rent' }, ctx(T0 + DAY).c);
    expect([bal(s, id), bal(s, 'world:landlord:USD'), bal(s, 'world:B:USD')]).toEqual([-1600, 6000, 600]);
    // Past the limit: refused, no returned fee published.
    const { c, notices } = ctx(T0 + 2 * DAY);
    pay(s, { account: id, to: 'landlord', amount: '90', how: 'card', what: 'rent' }, c);
    expect([bal(s, id), notices]).toEqual([-1600, [{ kind: RETURNED, data: { account: id, amount: 9000, fee: 0 } }]]);
    // The month spent overdrawn: its monthly fee and its interest on the average overdrawn.
    const end = addMonths(ZONE, T0, 1);
    month(s, { id: 1, at: end, kind: MONTH_KIND, data: { account: id } }, ctx(end).c);
    // A day at 50, thirty at -16: an average of -13.87, 2% of it 0.28 (rounded half to even), beside the 3.00.
    expect(accountOf(s.ledger, id).postings.at(-1)).toMatchObject({ what: 'fees', amount: -328 });
    // Overdrawn with neither a monthly fee nor a rate: nothing for the overdraft; touching nothing isn't overdrawn.
    for (const [terms, fundAt, expected] of [
      [{ ...plain, overdraft: {}, fees: [{ fee: usd(100), per: 'month' }] }, 0, -200],
      [{ ...plain, overdraft: { monthly: usd(300) } }, 1000, 0],
    ] as const) {
      const w = fresh();
      const x = openOn(w, args(), terms, ctx(T0).c);
      if (fundAt > 0) {
        fund(w, x, fundAt, T0);
        pay(w, { account: x, to: 'shop', amount: '10', how: 'card', what: 'shopping' }, ctx(T0 + DAY).c);
      }
      for (const k of [1, 2]) month(w, { id: k, at: addMonths(ZONE, T0, k), kind: MONTH_KIND, data: { account: x } }, ctx(addMonths(ZONE, T0, k)).c);
      expect(bal(w, x)).toBe(expected);
    }
    // An account with no overdraft driven below nothing by its own fee: no overdraft charges, the month after either.
    const y = fresh();
    const g = openOn(y, args(), { ...plain, fees: [{ fee: usd(100), per: 'month' }] }, ctx(T0).c);
    for (const k of [1, 2]) month(y, { id: k, at: addMonths(ZONE, T0, k), kind: MONTH_KIND, data: { account: g } }, ctx(addMonths(ZONE, T0, k)).c);
    expect(bal(y, g)).toBe(-200);
    // No overdraft: a payment past the balance is refused with the returned-payment fee.
    const n = fresh();
    const b = openOn(n, args(), { ...plain, overdraft: false, returned: usd(3400) }, ctx(T0).c);
    fund(n, b, 5000, T0);
    const r = ctx(T0 + DAY);
    pay(n, { account: b, to: 'shop', amount: '60', how: 'card', what: 'shopping' }, r.c);
    expect([bal(n, b), r.notices[0]?.data]).toEqual([1600, { account: b, amount: 6000, fee: 3400 }]);
    expect(accountOf(n.ledger, b).postings.at(-1)?.what).toBe('returned payment');
    expect(() => pay(n, { account: b, to: 'shop', amount: 'all', how: 'card', what: 'shopping' }, r.c)).toThrow('a payment is an amount above nothing, written in major units');
    // A returned-payment fee of nothing posts nothing; a payment to exactly nothing is paid; an overdraft with no limit
    // takes any payment, and one with a limit takes a payment to exactly its limit, its item fee only once past nothing.
    const z = fresh();
    const zid = openOn(z, args(), { ...plain, overdraft: false, returned: usd(0) }, ctx(T0).c);
    fund(z, zid, 100, T0);
    pay(z, { account: zid, to: 'shop', amount: '5', how: 'card', what: 'shopping' }, ctx(T0).c);
    pay(z, { account: zid, to: 'shop', amount: '1', how: 'card', what: 'shopping' }, ctx(T0).c);
    expect([bal(z, zid), accountOf(z.ledger, zid).postings.length]).toEqual([0, 2]);
    const q = fresh();
    const qa = openOn(q, args(), { ...plain, overdraft: {} }, ctx(T0).c);
    pay(q, { account: qa, to: 'shop', amount: '1000000', how: 'card', what: 'shopping' }, ctx(T0).c);
    expect(bal(q, qa)).toBe(-100000000);
    const lim = fresh();
    const la = openOn(lim, args(), { ...plain, overdraft: { limit: usd(10000), fee: usd(700) } }, ctx(T0).c);
    fund(lim, la, 500, T0);
    pay(lim, { account: la, to: 'shop', amount: '5', how: 'card', what: 'shopping' }, ctx(T0).c);
    pay(lim, { account: la, to: 'shop', amount: '100', how: 'card', what: 'shopping' }, ctx(T0).c);
    expect(bal(lim, la)).toBe(-10700);
    expect(accountOf(lim.ledger, la).postings.map((p) => p.what)).toEqual(['pay', 'shopping', 'shopping', 'fees']);
    // Unpublished: refused too, no fee.
    const u = fresh();
    const d = openOn(u, args(), plain, ctx(T0).c);
    pay(u, { account: d, to: 'shop', amount: '1', how: 'card', what: 'shopping' }, ctx(T0).c);
    expect(bal(u, d)).toBe(0);
    // Within the balance: paid to the world by name or to an account held; a withdrawal costs its machine's fee.
    pay(n, { account: b, to: 'shop', amount: '6', how: 'card', what: 'shopping' }, ctx(T0 + 2 * DAY).c);
    expect(bal(n, b)).toBe(1000);
    const o = fresh();
    const e = openOn(o, args(), od, ctx(T0).c);
    const f = openOn(o, args(), plain, ctx(T0).c);
    fund(o, e, 100000, T0);
    pay(o, { account: e, to: f, amount: '10', how: 'card', what: 'to savings' }, ctx(T0).c);
    pay(o, { account: e, to: 'world:shop', amount: '10', how: 'other', what: 'cash' }, ctx(T0).c);
    expect([bal(o, e), bal(o, f), bal(o, 'world:shop:USD'), bal(o, 'world:B:USD')]).toEqual([100000 - 2000 - 250, 1000, 1000, 250]);
    expect([costOf(od, 'own', usd(1000)), costOf(od, 'abroad', usd(10000)), costOf(od, 'card', usd(1000)), costOf(plain, 'transfer', usd(1)), costOf(plain, 'other', usd(1)), costOf(plain, 'abroad', usd(1))]).toStrictEqual([usd(50), usd(500), usd(0), usd(0), usd(0), usd(0)]);
  });

  it("pays the family's means into the first morning's accounts, at the day's rate where the account's currency differs", () => {
    const means = meansOf('US', 'modest');
    if (means === undefined) throw new Error('the US is kept');
    const s = fresh();
    firstMorning(s, { ...holder, country: 'US', family: 'modest', bank: 'B', account: 'A' }, { ...plain, savings: { account: 'S', interest: { percent: '1', per: 'year' } } }, ctx(T0).c);
    expect([bal(s, 'everyday:1'), bal(s, 'savings:2')]).toEqual([means.checking.minor, means.savings.minor]);
    // No savings account: both into the everyday.
    const t = fresh();
    firstMorning(t, { ...holder, country: 'US', family: 'modest', bank: 'B', account: 'A' }, plain, ctx(T0).c);
    expect([t.accounts.held.length, bal(t, 'everyday:1')]).toEqual([1, means.checking.minor + means.savings.minor]);
    expect(accountOf(t.ledger, 'everyday:1').postings.map((p) => p.what)).toEqual(['the family', 'the family']);
    // The poorest fifth of the US: its net wealth below nothing leaves the life a debt to the family, an account of its own.
    const z = fresh();
    firstMorning(z, { ...holder, country: 'US', family: 'nothing', bank: 'B', account: 'A' }, { ...plain, savings: { account: 'S', interest: { percent: '1', per: 'year' } } }, ctx(T0).c);
    const poor = meansOf('US', 'nothing');
    expect([bal(z, 'debt:3'), accountOf(z.ledger, 'debt:3').postings.map((p) => p.what)]).toEqual([-(poor?.debt.minor ?? 0), ['the family']]);
    // A family with nothing in savings (Norway's, no survey read) puts nothing in the savings account, and owes nothing.
    const n = fresh();
    firstMorning(n, { ...holder, country: 'NO', family: 'modest', bank: 'B', account: 'A' }, { ...plain, currency: 'NOK', savings: { account: 'S', interest: { percent: '1', per: 'year' } } }, ctx(T0).c);
    expect([accountOf(n.ledger, 'savings:2').postings, n.ledger.accounts.some((a) => a.id.startsWith('debt:'))]).toEqual([[], false]);
    // An account in euros takes the dollars at the day's rate.
    const e = fresh();
    firstMorning(e, { ...holder, country: 'US', family: 'nothing', bank: 'B', account: 'A' }, { ...plain, currency: 'EUR' }, ctx(T0).c);
    const nothing = meansOf('US', 'nothing');
    const inEuros = (m: ReturnType<typeof usd> | undefined) => exchangeOn(m ?? usd(0), 'EUR', '2026-01-15')?.money.minor ?? 0;
    expect(bal(e, 'everyday:1')).toBe(inEuros(nothing?.checking) + inEuros(nothing?.savings));
    // North Korea's won has a rate only from 15 January 2026.
    expect(() => firstMorning(fresh(), { ...holder, country: 'US', family: 'modest', bank: 'B', account: 'A' }, { ...plain, currency: 'KPW' }, ctx(at(2026, 1, 14)).c)).toThrow("the rate between USD and KPW isn't known to this game");
    expect(() => firstMorning(fresh(), { ...holder, country: 'VA', family: 'modest', bank: 'B', account: 'A' }, plain, ctx(T0).c)).toThrow("what a family in VA has to give isn't known to this game");
  });

  it('is run through the frame, each command and kind declaring what it reads and writes', () => {
    const index = commandIndex().filter((x) => x.id.startsWith('account.') || x.id === 'means.first-morning');
    expect(index).toEqual([
      { id: 'account.open', reads: [], writes: ['accounts', 'ledger', 'schedule'] },
      { id: 'account.pay', reads: [], writes: ['accounts', 'ledger', 'notices'] },
      { id: 'means.first-morning', reads: [], writes: ['accounts', 'ledger', 'schedule'] },
    ]);
    let life = begin('00000000000000aa', T0, fresh());
    life = dispatch(life, startTheMorning, { ...holder, country: 'US', family: 'modest', bank: 'Chase', account: 'Chase Total Checking' });
    life = dispatch(life, openAccount, { ...args({ bank: 'Chase', account: 'Chase Total Checking' }) });
    life = dispatch(life, payFromAccount, { account: 'everyday:1', to: 'shop', amount: '10', how: 'card', what: 'shopping' });
    life = pass(life, addMonths(ZONE, T0, 1)).life;
    expect(life.slices.accounts.held.map((h) => h.months)).toEqual([1, 1]);
    expect(life.frame.schedule.map((i) => i.kind)).toEqual([MONTH_KIND, MONTH_KIND]);
  });
});
