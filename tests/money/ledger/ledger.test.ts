import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { accountOf, balance, LEDGER_START, move, open, paidIn, standing, WORLD, worldAccount, type LedgerSlice } from '../../../src/money/ledger/ledger.ts';

const DAY = 86_400;
const usd = (minor: number) => money('USD', minor);
const fresh = (): LedgerSlice => structuredClone(LEDGER_START);

describe('the ledger', () => {
  it('opens accounts in a currency, each id once, and finds them', () => {
    expect(LEDGER_START).toStrictEqual({ accounts: [], next: 1 });
    const l = fresh();
    expect(open(l, 'checking', 'USD', 10)).toStrictEqual({ id: 'checking', currency: 'USD', opened: 10, postings: [] });
    expect(accountOf(l, 'checking').currency).toBe('USD');
    expect(() => open(l, 'checking', 'EUR', 20)).toThrow('the account checking is held already');
    expect(() => accountOf(l, 'savings')).toThrow('no account savings is held');
    expect([WORLD, worldAccount('family', 'USD')]).toEqual(['world:', 'world:family:USD']);
  });

  it("moves money in one currency, what leaves entering elsewhere, and keeps a balance as the sum of its postings", () => {
    const l = fresh();
    open(l, 'checking', 'USD', 0);
    open(l, 'savings', 'USD', 0);
    expect(move(l, 100, 'the first morning', [{ account: 'world:family', amount: usd(-5000) }, { account: 'checking', amount: usd(3000) }, { account: 'savings', amount: usd(2000) }])).toBe(1);
    expect(move(l, 200, 'a transfer', [{ account: 'checking', amount: usd(-500) }, { account: 'savings', amount: usd(500) }])).toBe(2);
    expect(l.next).toBe(3);
    expect([balance(accountOf(l, 'checking')), balance(accountOf(l, 'savings')), balance(accountOf(l, 'world:family:USD'))]).toStrictEqual([usd(2500), usd(2500), usd(-5000)]);
    // At a moment: the postings up to and at it.
    expect([balance(accountOf(l, 'checking'), 99), balance(accountOf(l, 'checking'), 100), balance(accountOf(l, 'checking'), 199)]).toStrictEqual([usd(0), usd(3000), usd(3000)]);
    expect(accountOf(l, 'checking').postings).toStrictEqual([{ at: 100, tx: 1, what: 'the first morning', amount: 3000 }, { at: 200, tx: 2, what: 'a transfer', amount: -500 }]);
    // Every currency's accounts sum to nothing.
    expect(l.accounts.reduce((s, a) => s + balance(a).minor, 0)).toBe(0);
    // The world's account of a name is one per currency, opened when first met.
    move(l, 300, 'a fee', [{ account: 'checking', amount: usd(-100) }, { account: 'world:family', amount: usd(100) }]);
    expect(l.accounts.filter((a) => a.id.startsWith(WORLD)).map((a) => [a.id, a.opened])).toEqual([['world:family:USD', 100]]);
  });

  it("refuses a movement that doesn't balance, mixes currencies, has one leg, or comes before an account's last moment", () => {
    const l = fresh();
    open(l, 'checking', 'USD', 100);
    open(l, 'euro', 'EUR', 0);
    expect(() => move(l, 100, 'x', [{ account: 'checking', amount: usd(5) }])).toThrow('x moves money between two accounts at least');
    expect(() => move(l, 100, 'x', [])).toThrow('x moves money between two accounts at least');
    expect(() => move(l, 100, 'x', [{ account: 'checking', amount: usd(5) }, { account: 'world:shop', amount: money('EUR', -5) }])).toThrow('x moves money in one currency');
    expect(() => move(l, 100, 'x', [{ account: 'checking', amount: usd(5) }, { account: 'world:shop', amount: usd(-4) }])).toThrow("x doesn't balance: what leaves must enter");
    expect(() => move(l, 100, 'x', [{ account: 'euro', amount: usd(5) }, { account: 'world:shop', amount: usd(-5) }])).toThrow('euro is held in EUR, not USD');
    expect(() => move(l, 99, 'x', [{ account: 'checking', amount: usd(5) }, { account: 'world:shop', amount: usd(-5) }])).toThrow('checking has nothing to post before its last moment');
    expect(() => move(l, 100, 'x', [{ account: 'nowhere', amount: usd(5) }, { account: 'world:shop', amount: usd(-5) }])).toThrow('no account nowhere is held');
    move(l, 200, 'x', [{ account: 'checking', amount: usd(5) }, { account: 'world:shop', amount: usd(-5) }]);
    expect(() => move(l, 150, 'y', [{ account: 'checking', amount: usd(5) }, { account: 'world:shop', amount: usd(-5) }])).toThrow('checking has nothing to post before its last moment');
    // At the same moment as the last is allowed; nothing was posted by a refused movement.
    move(l, 200, 'z', [{ account: 'checking', amount: usd(1) }, { account: 'world:shop', amount: usd(-1) }]);
    expect([balance(accountOf(l, 'checking')).minor, l.next]).toEqual([6, 3]);
  });

  it('gives what came in over a period, and the lowest and average daily balance a bank states', () => {
    const l = fresh();
    open(l, 'checking', 'USD', 0);
    move(l, 0, 'in', [{ account: 'world:pay', amount: usd(-1000) }, { account: 'checking', amount: usd(1000) }]);
    move(l, DAY + 5, 'out', [{ account: 'checking', amount: usd(-900) }, { account: 'world:shop', amount: usd(900) }]);
    move(l, DAY + 10, 'in', [{ account: 'world:pay', amount: usd(-200) }, { account: 'checking', amount: usd(200) }]);
    move(l, 3 * DAY, 'in', [{ account: 'world:pay', amount: usd(-1) }, { account: 'checking', amount: usd(1) }]);
    const a = accountOf(l, 'checking');
    expect([paidIn(a, 0, 3 * DAY), paidIn(a, 1, 3 * DAY), paidIn(a, 0, 3 * DAY + 1)]).toStrictEqual([usd(1200), usd(200), usd(1201)]);
    // Days ending at 1,000, 300 and 300: the lowest touched 100 between the two movements on the second day.
    expect(standing(a, 0, 3 * DAY)).toStrictEqual({ lowest: usd(100), average: usd(533) });
    // A period opening after earlier postings starts from the balance they left; a part day counts as a day.
    expect(standing(a, DAY, DAY + 7)).toStrictEqual({ lowest: usd(100), average: usd(100) });
    expect(standing(a, 2 * DAY, 3 * DAY + 1)).toStrictEqual({ lowest: usd(300), average: usd(300) });
    expect(standing(a, 2 * DAY, 3 * DAY + 2).average).toStrictEqual(usd(300));
    // Half a minor unit goes to the even: (1 + 2) / 2.
    const h = fresh();
    open(h, 'x', 'USD', 0);
    move(h, 0, 'in', [{ account: 'world:pay', amount: usd(-1) }, { account: 'x', amount: usd(1) }]);
    move(h, DAY, 'in', [{ account: 'world:pay', amount: usd(-1) }, { account: 'x', amount: usd(1) }]);
    expect(standing(accountOf(h, 'x'), 0, 2 * DAY).average).toStrictEqual(usd(2));
    expect(() => standing(a, 5, 5)).toThrow('a period runs forward');
    // What came after the period, at its end or later, doesn't lower it.
    move(l, 4 * DAY, 'out', [{ account: 'checking', amount: usd(-1000) }, { account: 'world:shop', amount: usd(1000) }]);
    expect([standing(a, 0, 4 * DAY).lowest, standing(a, 0, 4 * DAY + 1).lowest]).toStrictEqual([usd(100), usd(-699)]);
  });
});
