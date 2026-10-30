import { describe, expect, it } from 'vitest';
import { begin, commandIndex, dispatch, pass, type Context, type Item, type Json } from '../../../src/core/frame/frame.ts';
import { money } from '../../../src/core/money/money.ts';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import {
  ageOn,
  CARDS_START,
  pick,
  dueAfter,
  dueDate,
  DUE_KIND,
  MISSED,
  nextStatement,
  openCard,
  openOn,
  pay,
  payCard,
  report,
  REPORT_KIND,
  spend,
  spendOnCard,
  STATED,
  statement,
  STATEMENT_KIND,
  sum,
  termsOf,
  type Held,
  type Holding,
} from '../../../src/money/cards/account.ts';
import type { Card } from '../../../src/money/cards/cards.ts';
import { CREDIT_START } from '../../../src/money/credit/credit.ts';

const DAY = 86_400;
const at = (y: number, m: number, d: number, h = 9) => daysFromCivil(y, m, d) * DAY + h * 3600;
const usd = (minor: number) => money('USD', minor);

/** A context that records what's scheduled and noticed. */
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

const plain: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [] };
const holder = { born: '1996-03-10', national: false };
const fresh = (): Holding => ({ cards: { held: [] }, credit: { marks: [] } });
const opened = (card: Card, when = at(2026, 1, 15), limit = '1000', country = 'US'): { s: Holding; h: Held } => {
  const s = fresh();
  openOn(s, { country, bank: card.bank, card: card.card, limit, income: '5000', ...holder }, card, ctx(when).c);
  return { s, h: s.cards.held[0] as Held };
};
const item = (kind: string, when: number, data: Json): Item => ({ id: 1, at: when, kind, data });
const stated = (s: Holding, when: number, i = 0) => {
  const x = ctx(when);
  statement(s, item(STATEMENT_KIND, when, { card: i, ...holder }), x.c);
  return x;
};

describe('a card held', () => {
  it('reads amounts, ages and the days of its statements', () => {
    expect(sum('USD', '12.50', 'x')).toStrictEqual(usd(1250));
    for (const t of ['0', '-1', '1e3', 'a1', '1a', '']) expect(() => sum('USD', t, 'x'), t).toThrow('x is an amount above nothing, written in major units');
    expect([ageOn('1996-03-10', at(2026, 3, 9)), ageOn('1996-03-10', at(2026, 3, 10)), ageOn('1996-03-10', at(2026, 2, 28)), ageOn('1996-03-10', at(2026, 4, 1))]).toEqual([29, 30, 29, 30]);
    const h = { day: 28, opened: at(2026, 1, 28, 9) };
    expect(nextStatement(h, at(2026, 1, 28))).toBe(at(2026, 2, 28));
    expect(nextStatement(h, at(2026, 12, 28))).toBe(at(2027, 1, 28));
    expect(nextStatement({ day: 15, opened: at(2026, 1, 15, 14) }, at(2026, 1, 20, 3))).toBe(at(2026, 2, 15, 14));
    // A grace less a month of thirty days; at least a day; the next statement where none is published.
    expect(dueAfter({ ...plain, grace: 55 }, at(2026, 2, 15), h)).toBe(at(2026, 3, 12));
    expect(dueAfter({ ...plain, grace: 30 }, at(2026, 2, 15), h)).toBe(at(2026, 2, 16));
    expect(dueAfter({ ...plain, grace: 31 }, at(2026, 2, 15), h)).toBe(at(2026, 2, 16));
    expect(dueAfter({ ...plain, grace: 32 }, at(2026, 2, 15), h)).toBe(at(2026, 2, 17));
    expect(dueAfter(plain, at(2026, 2, 15), { day: 15, opened: at(2026, 1, 15) })).toBe(at(2026, 3, 15));
    expect(() => termsOf({ country: 'US', bank: 'Nobody', card: 'None' })).toThrow("Nobody's None isn't a card of US");
    const list: Card[] = [plain, { ...plain, card: 'D' }, { ...plain, bank: 'E' }];
    expect([pick(list, 'B', 'D'), pick(list, 'E', 'C'), pick(list, 'E', 'D')]).toStrictEqual([list[1], list[2], undefined]);
    expect(termsOf({ country: 'US', bank: 'Chase', card: 'Chase Freedom Unlimited' }).rate).toStrictEqual({ percent: '27.99', per: 'year' });
  });

  it('opens within its multiple of income, charging its issue fees and their tax, its first statement a month on', () => {
    const card: Card = { ...plain, issue: usd(2500), limitFees: [{ percent: '1', when: 'issue' }], tax: { fees: '10' }, limit: { times: '2' } };
    const s = fresh();
    const x = ctx(at(2026, 1, 31, 10));
    openOn(s, { country: 'US', bank: 'B', card: 'C', limit: '10000', income: '5000', ...holder }, card, x.c);
    const h = s.cards.held[0] as Held;
    // 25 to issue and 1% of 10,000, with 10% on both: 137.50.
    expect([h.purchases, h.limit, h.day, h.currency, h.terms, h.stated, h.carrying, h.late, h.statement, h.past]).toStrictEqual([13_750, 1_000_000, 28, 'USD', card, 0, false, false, null, []]);
    expect(x.scheduled).toStrictEqual([{ kind: STATEMENT_KIND, at: at(2026, 2, 28, 10), data: { card: 0, ...holder } }]);
    expect(() => openOn(fresh(), { country: 'US', bank: 'B', card: 'C', limit: '10000.01', income: '5000', ...holder }, card, ctx(0).c)).toThrow("B lends at most 2 times a month's income on its C");
    expect(() => openOn(fresh(), { country: 'US', bank: 'B', card: 'C', limit: '0', income: '5000', ...holder }, card, ctx(0).c)).toThrow('a limit is an amount above nothing, written in major units');
    expect(() => openOn(fresh(), { country: 'US', bank: 'B', card: 'C', limit: '1', income: 'x', ...holder }, card, ctx(0).c)).toThrow('an income is an amount above nothing, written in major units');
    // Without a multiple the bank states, the limit asked is the limit; without issue fees, nothing owed.
    const { h: p } = opened(plain, at(2026, 1, 15), '99999');
    expect([p.limit, p.purchases, p.day]).toEqual([9_999_900, 0, 15]);
  });

  it('spends within the limit, adding the foreign share and the cash fee, and their tax', () => {
    const card: Card = { ...plain, fx: '3', cash: { fee: { percent: '5', min: usd(1000) } }, tax: { fees: '10' } };
    const { s, h } = opened(card, at(2026, 1, 15), '1000');
    spend(s, { card: 0, amount: '100', foreign: false, cash: false });
    expect([h.purchases, h.cash, h.spent]).toEqual([10_000, 0, 10_000]);
    spend(s, { card: 0, amount: '100', foreign: true, cash: false });
    // 3 on 100 abroad, and 10% on it.
    expect([h.purchases, h.spent]).toEqual([20_330, 20_000]);
    spend(s, { card: 0, amount: '100', foreign: false, cash: true });
    // 5%, at least 10, and its tax: 11.
    expect([h.purchases, h.cash, h.spent]).toEqual([21_430, 10_000, 30_000]);
    spend(s, { card: 0, amount: '100', foreign: true, cash: true });
    expect([h.purchases, h.cash]).toEqual([22_860, 20_000]);
    // The limit takes in what's owed, the sum and its charges: 1000 - 428.60 left, and 571.40 is exactly it.
    expect(() => spend(s, { card: 0, amount: '571.41', foreign: false, cash: false })).toThrow("that's more than the limit left on B's C");
    spend(s, { card: 0, amount: '571.40', foreign: false, cash: false });
    expect(h.purchases + h.cash).toBe(100_000);
    expect(() => spend(s, { card: 1, amount: '1', foreign: false, cash: false })).toThrow("there's no card 1");
    // The charges count against the limit: 100 left, and 98 abroad comes to 101.24.
    const { s: f, h: g } = opened(card, at(2026, 1, 15), '100');
    expect(() => spend(f, { card: 0, amount: '98', foreign: true, cash: false })).toThrow("that's more than the limit left on B's C");
    spend(f, { card: 0, amount: '96.50', foreign: true, cash: false });
    expect(g.purchases).toBe(9650 + 290 + 29);
    expect(() => spend(s, { card: 0, amount: '0', foreign: false, cash: false })).toThrow('a sum spent is an amount above nothing, written in major units');
  });

  it('pays what is past due first, then toward the statement; the cash before the purchases', () => {
    const { s, h } = opened(plain);
    h.purchases = 50_000;
    h.cash = 10_000;
    h.past = [{ due: 1, short: 3000 }, { due: 2, short: 2000 }];
    h.statement = { balance: 60_000, minimum: 4000, due: 3, paid: 0 };
    // Where the record lifts a late payment once paid (Honduras: 90 days after), paying one off lifts its mark.
    const lift = 90 * DAY;
    s.credit.marks = [{ country: 'HN', at: 0, until: 10 ** 9, debt: '0:1', lift }, { country: 'HN', at: 0, until: 10 ** 9, debt: '0:2', lift }];
    pay(s, { card: 0, amount: '40' }, ctx(500).c);
    expect([h.cash, h.purchases, h.past, h.statement.paid]).toStrictEqual([6000, 50_000, [{ due: 2, short: 1000 }], 0]);
    expect(s.credit.marks.map((m) => m.until)).toStrictEqual([500 + lift, 10 ** 9]);
    pay(s, { card: 0, amount: '100' }, ctx(800).c);
    expect([h.cash, h.purchases, h.past, h.statement.paid]).toStrictEqual([0, 46_000, [], 9000]);
    expect(s.credit.marks.map((m) => m.until)).toStrictEqual([500 + lift, 800 + lift]);
    const { s: s2, h: h2 } = opened(plain);
    h2.purchases = 1000;
    pay(s2, { card: 0, amount: '5' }, ctx(0).c);
    expect([h2.purchases, h2.statement]).toStrictEqual([500, null]);
    expect(() => pay(s2, { card: 0, amount: '-5' }, ctx(0).c)).toThrow('a payment is an amount above nothing, written in major units');
  });

  it("cuts a statement: interest once one isn't paid in full, its fees as they come due, tax, the over-limit fee and the minimum", () => {
    const card: Card = { ...plain, grace: 55, minimum: { percent: '5', floor: usd(2500), interest: true }, fees: [{ fee: usd(1200), per: 'year' }, { fee: usd(300), per: 'month', waived: [{ spend: usd(20_000) }] }] };
    const { s, h } = opened(card);
    spend(s, { card: 0, amount: '300', foreign: false, cash: false });
    let x = stated(s, at(2026, 2, 15));
    // Not carrying: no interest. The yearly fee on the first statement, and the monthly one (300 spent is past 200: waived).
    expect([h.stated, h.months, h.spent, h.purchases]).toStrictEqual([1, [30_000], 0, 31_200]);
    expect(h.statement).toStrictEqual({ balance: 31_200, minimum: 2500, due: at(2026, 3, 12), paid: 0 });
    expect(x.notices).toStrictEqual([{ kind: STATED, data: { card: 0, balance: 31_200, minimum: 2500, pastDue: 0, due: at(2026, 3, 12) } }]);
    expect(x.scheduled).toStrictEqual([
      { kind: DUE_KIND, at: at(2026, 3, 12), data: { card: 0 } },
      { kind: STATEMENT_KIND, at: at(2026, 3, 15), data: { card: 0, ...holder } },
    ]);
    // Paid in part by its due date: the purchases carry from here.
    pay(s, { card: 0, amount: '100' }, ctx(0).c);
    dueDate(s, item(DUE_KIND, at(2026, 3, 12), { card: 0 }), ctx(at(2026, 3, 12)).c);
    expect([h.carrying, h.late, h.past]).toStrictEqual([true, false, []]);
    stated(s, at(2026, 3, 15));
    // 212 at 24%: 4.24; the monthly fee, 3, nothing spent; no yearly fee.
    expect(h.purchases).toBe(21_200 + 424 + 300);
    expect(h.statement).toStrictEqual({ balance: 21_924, minimum: 2500, due: at(2026, 4, 9), paid: 0 });
    // The second year's fee on the thirteenth statement.
    h.stated = 12;
    h.carrying = false;
    stated(s, at(2027, 2, 15));
    expect(h.purchases).toBe(21_924 + 1200 + 300);
    // An empty statement asks nothing and schedules no due date.
    const { s: e } = opened(plain);
    x = stated(e, at(2026, 2, 15));
    expect(x.scheduled.map((y) => y.kind)).toEqual([STATEMENT_KIND]);
    expect((e.cards.held[0] as Held).statement).toStrictEqual({ balance: 0, minimum: 0, due: at(2026, 3, 15), paid: 0 });
  });

  it('charges the introductory rate, then the rate for the record, the cash at its own, and the penalty rate once late', () => {
    const card: Card = { ...plain, rate: { percent: '24', per: 'year', from: '12' }, intro: { percent: '0', per: 'month', months: 2 }, cash: { rate: { percent: '3', per: 'month' } }, penalty: { percent: '36', per: 'year' } };
    const { s, h } = opened(card);
    h.purchases = 100_000;
    h.carrying = true;
    stated(s, at(2026, 2, 15));
    expect(h.purchases).toBe(100_000);
    stated(s, at(2026, 3, 15));
    expect(h.purchases).toBe(100_000);
    stated(s, at(2026, 4, 15));
    // The best record: 12% a year.
    expect(h.purchases).toBe(101_000);
    s.credit.marks.push({ country: 'US', at: 0, until: at(2030, 1, 1) });
    h.purchases = 100_000;
    stated(s, at(2026, 5, 15));
    // One mark: 750, 24 - 12 × 0.75 = 15%.
    expect(h.purchases).toBe(101_250);
    h.purchases = 100_000;
    h.cash = 10_000;
    stated(s, at(2026, 6, 15));
    expect([h.purchases, h.cash]).toEqual([101_250 + 300, 10_000]);
    h.late = true;
    h.purchases = 100_000;
    h.cash = 0;
    stated(s, at(2026, 7, 15));
    expect(h.purchases).toBe(103_000);
    // A charge card carries nothing: no interest, and the statement asks all of it.
    const { s: f, h: g } = opened({ ...plain, rate: 'in full', fees: [] });
    g.purchases = 50_000;
    g.carrying = true;
    g.cash = 5000;
    stated(f, at(2026, 2, 15));
    expect([g.purchases, g.statement?.minimum]).toEqual([50_000, 55_000]);
    // A card that charges by steps of what's carried.
    const { s: b, h: k } = opened({ ...plain, rate: { steps: { fee: usd(1000), each: usd(50_000) } } });
    k.purchases = 60_000;
    k.carrying = true;
    stated(b, at(2026, 2, 15));
    expect(k.purchases).toBe(62_000);
  });

  it('charges a fee waived for its first periods, by spending, or by age, and the yearly share of the limit after the first year', () => {
    const card: Card = { ...plain, fees: [{ fee: usd(5000), per: 'year', waived: [{ first: 1 }] }, { fee: usd(600), per: 'quarter', waived: [{ from: 60 }] }, { fee: usd(100), per: 'month', waived: [{ spend: usd(1) }] }], limitFees: [{ percent: '1', when: 'year' }] };
    const { s, h } = opened(card);
    stated(s, at(2026, 2, 15));
    // The first year waived; the quarter's 6; a month with nothing spent, 1.
    expect(h.purchases).toBe(700);
    spend(s, { card: 0, amount: '0.01', foreign: false, cash: false });
    stated(s, at(2026, 3, 15));
    expect(h.purchases).toBe(701);
    h.stated = 3;
    stated(s, at(2026, 5, 15));
    // The fourth statement opens the second quarter: 6, and 1 for the month.
    expect(h.purchases).toBe(701 + 700);
    h.stated = 12;
    h.purchases = 0;
    stated(s, at(2027, 2, 15));
    // The thirteenth: the second year's 50, its quarter's 6, the month's 1, and 1% of the 1,000 limit, 10.
    expect(h.purchases).toBe(5000 + 600 + 100 + 1000);
    const old = fresh();
    openOn(old, { country: 'US', bank: 'B', card: 'C', limit: '1000', income: '5000', born: '1960-01-01', national: false }, card, ctx(at(2026, 1, 15)).c);
    statement(old, item(STATEMENT_KIND, at(2026, 2, 15), { card: 0, born: '1960-01-01', national: false }), ctx(at(2026, 2, 15)).c);
    // Sixty and over: the quarterly fee waived.
    expect((old.cards.held[0] as Held).purchases).toBe(100);
  });

  it('keeps a year of months, reads a fee by the day its statement comes, and counts a longer period from issue', () => {
    const card: Card = { ...plain, fees: [{ fee: usd(100), per: 'month', changes: [{ from: '2026-03-10', fee: usd(200) }] }, { fee: usd(1000), per: 'quarter', waived: [{ first: 2 }] }] };
    const { s, h } = opened(card, at(2026, 1, 5));
    stated(s, at(2026, 2, 5));
    // The quarter's first period waived; the month at 1.
    expect(h.purchases).toBe(100);
    stated(s, at(2026, 3, 5));
    expect(h.purchases).toBe(200);
    stated(s, at(2026, 4, 5));
    // From 10 March the month's fee is 2.
    expect(h.purchases).toBe(400);
    stated(s, at(2026, 5, 5));
    // The fourth statement opens the quarter's second period, still waived; the seventh its third, charged.
    expect(h.purchases).toBe(600);
    for (const mo of [6, 7]) stated(s, at(2026, mo, 5));
    stated(s, at(2026, 8, 5));
    expect(h.purchases).toBe(1200 + 1000);
    for (const mo of [9, 10, 11, 12]) stated(s, at(2026, mo, 5));
    for (const mo of [1, 2]) stated(s, at(2027, mo, 5));
    expect([h.stated, h.months.length]).toEqual([13, 12]);
  });

  it('charges the over-limit fee on what is owed with the cash and the fees taken in', () => {
    // A charge card, so no interest moves the figures.
    const card: Card = { ...plain, rate: 'in full', overLimit: { fixed: usd(2500) }, fees: [{ fee: usd(1000), per: 'month' }] };
    const { s, h } = opened(card, at(2026, 1, 15), '1000');
    h.purchases = 98_500;
    h.cash = 500;
    stated(s, at(2026, 2, 15));
    // 985 + 5 + the month's 10 is 1,000: at the limit.
    expect(h.purchases).toBe(98_500 + 1000);
    h.purchases = 98_501;
    stated(s, at(2026, 3, 15));
    expect(h.purchases).toBe(98_501 + 1000 + 2500);
  });

  it('charges the tax on interest and fees, and the over-limit fee on a balance past the limit; takes past due off the minimum', () => {
    const card: Card = { ...plain, tax: { interest: '10', fees: '20' }, overLimit: { fixed: usd(2500) }, fees: [{ fee: usd(1000), per: 'month' }], minimum: { percent: '10' } };
    const { s, h } = opened(card, at(2026, 1, 15), '1000');
    h.purchases = 99_500;
    h.carrying = true;
    h.past = [{ due: 1, short: 3000 }];
    stated(s, at(2026, 2, 15));
    // 995 at 24%: 19.90, its tax 1.99; the month's fee 10 and the over-limit 25, their tax 7.
    expect(h.purchases).toBe(99_500 + 1990 + 199 + 1000 + 2500 + 700);
    // A tenth of 1,058.89 is 105.89; less 30 past due.
    expect(h.statement?.minimum).toBe(10_589 - 3000);
    // At the limit and not past it: no over-limit fee.
    const { s: t, h: u } = opened({ ...plain, overLimit: { fixed: usd(2500) }, minimum: { percent: '10' } }, at(2026, 1, 15), '1000');
    u.purchases = 100_000;
    stated(t, at(2026, 2, 15));
    expect(u.purchases).toBe(100_000);
    // Past due more than the minimum: nothing more asked now.
    u.past = [{ due: 1, short: 999_999 }];
    stated(t, at(2026, 3, 15));
    expect(u.statement?.minimum).toBe(0);
  });

  it("brings the late fee and the penalty rate at a missed minimum, and marks the record once it's reported still short", () => {
    const card: Card = { ...plain, late: { percent: '10', of: 'minimum', min: usd(2000) }, tax: { fees: '10' } };
    const { s, h } = opened(card);
    h.statement = { balance: 30_000, minimum: 5000, due: at(2026, 3, 15), paid: 1000 };
    const x = ctx(at(2026, 3, 15));
    dueDate(s, item(DUE_KIND, at(2026, 3, 15), { card: 0 }), x.c);
    // 10% of 50 is 5, at least 20, and its 2 tax.
    expect([h.purchases, h.late, h.carrying, h.past]).toStrictEqual([2200, true, true, [{ due: at(2026, 3, 15), short: 4000 }]]);
    expect(x.notices).toStrictEqual([{ kind: MISSED, data: { card: 0, minimum: 5000, paid: 1000 } }]);
    expect(x.scheduled).toStrictEqual([{ kind: REPORT_KIND, at: at(2026, 4, 14), data: { card: 0, due: at(2026, 3, 15) } }]);
    // Still short thirty days on: marked; once paid up, not.
    report(s, item(REPORT_KIND, at(2026, 4, 14), { card: 0, due: at(2026, 3, 15) }), ctx(at(2026, 4, 14)).c);
    expect(s.credit.marks).toStrictEqual([{ country: 'US', at: at(2026, 4, 14), until: at(2026, 4, 14) + Math.round(7 * 365.25 * DAY) }]);
    // Another due date's shortfall doesn't mark this one.
    report(s, item(REPORT_KIND, at(2026, 4, 14), { card: 0, due: at(2026, 2, 15) }), ctx(at(2026, 4, 14)).c);
    expect(s.credit.marks).toHaveLength(1);
    pay(s, { card: 0, amount: '40' }, ctx(0).c);
    report(s, item(REPORT_KIND, at(2026, 4, 14), { card: 0, due: at(2026, 3, 15) }), ctx(at(2026, 4, 14)).c);
    expect(s.credit.marks).toHaveLength(1);
    // Where the record lifts a paid late payment (Honduras), the mark is tied to its card and due date.
    const { s: hn, h: hh } = opened(card, at(2026, 1, 15), '1000', 'HN');
    hh.past = [{ due: at(2026, 3, 15), short: 100 }];
    report(hn, item(REPORT_KIND, at(2026, 4, 14), { card: 0, due: at(2026, 3, 15) }), ctx(at(2026, 4, 14)).c);
    expect(hn.credit.marks[0]?.debt).toBe(`0:${at(2026, 3, 15)}`);
    // The minimum paid: nothing but the carrying; paid in full: not even that.
    const { s: p, h: q } = opened(card);
    q.statement = { balance: 30_000, minimum: 5000, due: 1, paid: 5000 };
    dueDate(p, item(DUE_KIND, 1, { card: 0 }), ctx(1).c);
    expect([q.purchases, q.late, q.carrying]).toEqual([0, false, true]);
    q.statement = { balance: 30_000, minimum: 5000, due: 1, paid: 30_000 };
    dueDate(p, item(DUE_KIND, 1, { card: 0 }), ctx(1).c);
    expect(q.carrying).toBe(false);
    // In a country whose records the game doesn't keep, no report is scheduled; and a card that publishes no late fee charges none.
    const { s: f, h: g } = opened({ ...plain }, at(2026, 1, 15), '1000', 'AQ');
    g.statement = { balance: 30_000, minimum: 5000, due: 1, paid: 0 };
    const y = ctx(1);
    dueDate(f, item(DUE_KIND, 1, { card: 0 }), y.c);
    expect([y.scheduled, g.purchases, g.late]).toStrictEqual([[], 0, true]);
  });

  it('runs on the frame: opened, spent on, stated, left unpaid, marked, and priced after by the record', () => {
    const commands = commandIndex().filter((c) => c.id.startsWith('card.'));
    expect(commands).toStrictEqual([
      { id: 'card.open', reads: [], writes: ['cards', 'schedule'] },
      { id: 'card.spend', reads: [], writes: ['cards'] },
      { id: 'card.pay', reads: [], writes: ['cards', 'credit'] },
    ]);
    let life = begin('0123456789abcdef', at(2026, 1, 15), { cards: CARDS_START, credit: CREDIT_START });
    life = dispatch(life, openCard, { country: 'US', bank: 'Chase', card: 'Chase Freedom Unlimited', limit: '5000', income: '4000', ...holder });
    life = dispatch(life, spendOnCard, { card: 0, amount: '1000', foreign: false, cash: false });
    // A month on, the statement; due at the next one (no grace published here), which comes after it, the minimum unpaid;
    // reported thirty days on.
    let moved = pass(life, at(2026, 4, 20));
    life = moved.life;
    const held = life.slices.cards.held[0] as Held;
    expect(life.slices.credit.marks).toHaveLength(1);
    expect(held.late).toBe(true);
    expect(life.frame.notices.map((n) => n.kind)).toEqual([STATED, MISSED, STATED, MISSED, STATED]);
    life = dispatch(life, payCard, { card: 0, amount: '50' });
    expect((life.slices.cards.held[0] as Held).purchases).toBeLessThan(held.purchases);
    moved = pass(life, at(2026, 5, 16));
    expect(moved.stoppedAt).toBeNull();
  });
});
