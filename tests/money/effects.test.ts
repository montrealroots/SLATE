import { describe, it } from 'vitest';
import { begin, dispatch, pass, type Life } from '../../src/core/frame/frame.ts';
import { daysFromCivil } from '../../src/core/time/calendar.ts';
import { addMonths } from '../../src/core/time/dates.ts';
import { ACCOUNTS_START, openAccount, payFromAccount, startTheMorning, type Holding as Accounts } from '../../src/money/accounts/accounts.ts';
import { CARDS_START, openCard, payCard, spendOnCard, type Holding as Cards } from '../../src/money/cards/account.ts';
import { CREDIT_START } from '../../src/money/credit/credit.ts';
import { accountOf, balance, LEDGER_START } from '../../src/money/ledger/ledger.ts';
import { CLOCK_START, elapse, pause, play, type ClockSlice } from '../../src/world/clock/clock.ts';
import { falsifyAny } from '../support/falsify-core.ts';

/**
 * Each command and scheduled kind the engines declare, falsified (MANDATE rule 1, the gate's effects check): change its
 * input, and the state it leaves changes. Each runs through the frame as a life does.
 */
const DAY = 86_400;
const T0 = daysFromCivil(2026, 1, 15) * DAY + 14 * 3600;
const ZONE = 'America/New_York';
const holder = { born: '1996-03-10', zone: ZONE, national: true };

const cardLife = (): Life<Cards> => begin('0123456789abcdef', T0, { cards: structuredClone(CARDS_START), credit: structuredClone(CREDIT_START) });
const withCard = (limit = '5000') => dispatch(cardLife(), openCard, { country: 'US', bank: 'Chase', card: 'Chase Freedom Unlimited', limit, income: '4000', ...holder });
const spent = (amount: string) => dispatch(withCard(), spendOnCard, { card: 0, amount, foreign: false, cash: false });

describe('the cards', () => {
  it('card.open: the limit asked is the limit held', () => {
    falsifyAny({ feature: 'card.open', claim: 'bites', says: 'a card opened with a higher limit holds it', base: '1000', twin: '2000', outcome: (limit) => withCard(limit).slices.cards.held[0]?.limit });
  });
  it('card.spend: what is spent is owed', () => {
    falsifyAny({ feature: 'card.spend', claim: 'bites', says: 'spending more puts more on the card', base: '10', twin: '20', outcome: (a) => spent(a).slices.cards.held[0]?.purchases });
  });
  it('card.pay: a payment brings what is owed down', () => {
    const after = (amount: string) => dispatch(spent('100'), payCard, { card: 0, amount }).slices.cards.held[0]?.purchases;
    falsifyAny({ feature: 'card.pay', claim: 'bites', says: 'paying more leaves less owed', base: '10', twin: '20', outcome: after });
  });
  it('card.statement: the statement asks for what was spent', () => {
    const stated = (amount: string) => pass(spent(amount), addMonths(ZONE, T0, 1) + DAY).life.slices.cards.held[0]?.statement?.balance;
    falsifyAny({ feature: 'card.statement', claim: 'bites', says: 'more spent, a bigger statement', base: '100', twin: '200', outcome: stated });
  });
  it('card.due: a minimum unpaid by its due date makes the card late', () => {
    const late = (pay: boolean) => {
      let l = pass(spent('100'), addMonths(ZONE, T0, 1) + DAY).life;
      if (pay) l = dispatch(l, payCard, { card: 0, amount: '100' });
      return pass(l, addMonths(ZONE, T0, 2) + DAY).life.slices.cards.held[0]?.late;
    };
    falsifyAny({ feature: 'card.due', claim: 'bites', says: 'the minimum paid, no late payment', base: true, twin: false, outcome: late });
  });
  it('card.report: a minimum still short when the bureaus report it marks the record', () => {
    const marks = (pay: boolean) => {
      let l = pass(spent('100'), addMonths(ZONE, T0, 2) + DAY).life;
      if (pay) l = dispatch(l, payCard, { card: 0, amount: '500' });
      return pass(l, addMonths(ZONE, T0, 4)).life.slices.credit.marks.length;
    };
    falsifyAny({ feature: 'card.report', claim: 'bites', says: 'what was past due paid before the report, no mark', base: false, twin: true, outcome: marks });
  });
});

const moneyLife = (): Life<Accounts> => begin('0123456789abcdef', T0, { accounts: structuredClone(ACCOUNTS_START), ledger: structuredClone(LEDGER_START) });
const chase = { country: 'US', bank: 'Chase', account: 'Chase Total Checking', ...holder, resident: true };
const morning = (family: string) => dispatch(moneyLife(), startTheMorning, { ...chase, family });
const bal = (l: Life<Accounts>, id: string) => balance(accountOf(l.slices.ledger, id)).minor;

describe('the accounts', () => {
  it("means.first-morning: the family's means are what the first morning holds", () => {
    falsifyAny({ feature: 'means.first-morning', claim: 'bites', says: 'a richer family, more on the first morning', base: 'scraping', twin: 'modest', outcome: (f) => bal(morning(f), 'everyday:1') });
  });
  it('account.open: the first deposit is what the account holds', () => {
    const opened = (deposit: string) => bal(dispatch(morning('modest'), openAccount, { ...chase, kind: 'everyday', deposit, from: 'everyday:1' }), 'everyday:2');
    falsifyAny({ feature: 'account.open', claim: 'bites', says: 'a bigger first deposit, a bigger balance', base: '25', twin: '50', outcome: opened });
  });
  it('account.pay: a payment leaves the account', () => {
    const paid = (amount: string) => bal(dispatch(morning('modest'), payFromAccount, { account: 'everyday:1', to: 'shop', amount, how: 'card', what: 'shopping' }), 'everyday:1');
    falsifyAny({ feature: 'account.pay', claim: 'bites', says: 'paying more leaves less', base: '10', twin: '20', outcome: paid });
  });
  it("account.month: the bank's monthly fee, waived on the lowest balance", () => {
    // Chase's 15 dollars a month, waived on 500 paid in, a lowest balance of 1,500 or an average of 5,000: the first
    // month's family money waives it, so the second month is read, the account spent down at its start to keep 2,000
    // (waived) or 1,000 (charged).
    const second = (keep: number) => {
      let l = pass(morning('scraping'), addMonths(ZONE, T0, 1) + 1).life;
      const spend = String((bal(l, 'everyday:1') - keep) / 100);
      l = dispatch(l, payFromAccount, { account: 'everyday:1', to: 'shop', amount: spend, how: 'card', what: 'shopping' });
      return bal(l, 'everyday:1') - bal(pass(l, addMonths(ZONE, T0, 2) + 1).life, 'everyday:1');
    };
    falsifyAny({ feature: 'account.month', claim: 'bites', says: 'a lowest balance under the waiver, the monthly fee', base: 200_000, twin: 100_000, outcome: second });
  });
});

type S = { clock: ClockSlice };
const clockLife = (playing = false): Life<S> => begin('0123456789abcdef', T0, { clock: { ...CLOCK_START, playing } });

describe('the clock', () => {
  it('clock.play: played, real time moves the life on', () => {
    falsifyAny({ feature: 'clock.play', claim: 'bites', says: 'playing, five seconds pass', base: false, twin: true, outcome: (p) => elapse(p ? dispatch(clockLife(), play, null) : clockLife(), 5000).life.frame.now });
  });
  it('clock.pause: paused, real time moves the life on no more', () => {
    falsifyAny({ feature: 'clock.pause', claim: 'bites', says: 'paused, no time passes', base: false, twin: true, outcome: (p) => elapse(p ? dispatch(clockLife(true), pause, null) : clockLife(true), 5000).life.frame.now });
  });
  it('clock.counted: the real time played is counted, and the part of a second carried', () => {
    falsifyAny({ feature: 'clock.counted', claim: 'bites', says: 'more real time played, more counted', base: 1500, twin: 2700, outcome: (ms) => elapse(clockLife(true), ms).life.slices.clock });
  });
});
