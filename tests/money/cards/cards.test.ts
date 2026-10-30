import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/cards/cards.json';
import { aboutCards, cardsIn, cashFee, cashInterestFor, charged, feeFor, fxFee, interestFor, keepsCards, lateFee, limitFee, minimumDue, monthly, overLimitFee, paidInFull, priced, root12, share, stepped, taxOnFees, taxOnInterest, UNKEPT_LINE, type Card, type Fee } from '../../../src/money/cards/cards.ts';

const usd = (minor: number) => money('USD', minor);
const standing = { age: 30, deposits: usd(0), lowest: usd(0), average: usd(0), national: false, spent: usd(0), period: 2 };

describe('cards', () => {
  it("name each country's credit cards, their interest and their fees", () => {
    expect(COUNTRY_CODES.filter(keepsCards)).toEqual(Object.keys(data.countries).sort());
    expect([keepsCards('US'), keepsCards('AQ')]).toEqual([true, false]);
    expect(cardsIn('AQ')).toEqual([]);
    // Chase's Freedom Unlimited: no annual fee, 18.49% to 27.99% a year, 0% for its first 15 months, its cash, foreign,
    // late, returned and penalty terms from its Pricing and Terms box.
    const chase = cardsIn('US').find((c) => c.card === 'Chase Freedom Unlimited') as Card;
    expect(chase).toStrictEqual({
      bank: 'Chase',
      card: 'Chase Freedom Unlimited',
      currency: 'USD',
      rate: { percent: '27.99', per: 'year', from: '18.49' },
      fees: [],
      intro: { percent: '0', per: 'year', months: 15 },
      cash: { rate: { percent: '28.74', per: 'year' }, fee: { percent: '5', min: money('USD', 1000) } },
      fx: '3',
      late: { fixed: money('USD', 4000) },
      returned: money('USD', 4000),
      penalty: { percent: '29.99', per: 'year' },
    });
    expect(paidInFull(chase)).toBe(false);
    // 1,000 dollars at 27.99% a year is 23.325 a month, rounded half to even.
    expect(interestFor(chase, usd(100_000))).toStrictEqual(usd(2332));
    expect(interestFor(chase, usd(100_002))).toStrictEqual(usd(2333));
    expect(interestFor(chase, usd(1))).toStrictEqual(usd(0));
    // Nothing on a balance in the holder's favour, or none.
    expect([interestFor(chase, usd(0)), interestFor(chase, usd(-50_000))]).toStrictEqual([usd(0), usd(0)]);
    // Barclaycard's Amazon card: 28.9% a year effective, the twelfth root of 1.289 less one a month.
    const amazon = cardsIn('GB').find((c) => c.card === 'Amazon Barclaycard') as Card;
    expect(interestFor(amazon, money('GBP', 100_000))).toStrictEqual(money('GBP', 2138));
    // Deutsche Bank's Mastercard: 39 euros a year, its balance taken from the account each month; 2.5% on cash (at least
    // 5.75 euros) and 1.75% on spending in another currency.
    const db = cardsIn('DE').find((c) => c.card === 'Mastercard oder VISA') as Card;
    expect(db).toStrictEqual({ bank: 'Deutsche Bank', card: 'Mastercard oder VISA', currency: 'EUR', rate: 'in full', fees: [{ fee: money('EUR', 3900), per: 'year' }], cash: { fee: { percent: '2.5', min: money('EUR', 575) } }, fx: '1.75' });
    expect(paidInFull(db)).toBe(true);
    expect(() => interestFor(db, money('EUR', 100))).toThrow("Deutsche Bank's Mastercard oder VISA carries nothing: it's paid in full each month");
    expect(feeFor(db.fees[0] as Fee, { ...standing, age: 70, spent: money('EUR', 9_999_999) }, '2026-11-01')).toStrictEqual(money('EUR', 3900));
  });

  it('charge interest by the month where the bank states it so', () => {
    const monthly: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '3.5', per: 'month' }, fees: [] };
    expect(interestFor(monthly, money('XOF', 100_000))).toStrictEqual(money('XOF', 3500));
    expect(interestFor({ ...monthly, rate: { percent: '0', per: 'year' } }, usd(100_000))).toStrictEqual(usd(0));
  });

  it('charge an effective yearly rate as the month that, compounded twelve times, makes it', () => {
    const effective = (percent: string): Card => ({ bank: 'B', card: 'C', currency: 'USD', rate: { percent, per: 'year', effective: true }, fees: [] });
    // 1.02 to the twelfth is 1.2682417945625...: a month is 2%, where a twelfth of the year would be 2.235%.
    expect(interestFor(effective('26.8241794562545'), usd(100_000))).toStrictEqual(usd(2000));
    // 95.90% a year effective is 5.7636% a month (5,763.59 on 100,000), not the 7.99% a twelfth would charge.
    expect(interestFor(effective('95.90'), usd(100_000))).toStrictEqual(usd(5764));
    expect(interestFor(effective('12'), usd(123_456))).toStrictEqual(usd(1171));
    expect(interestFor(effective('300'), usd(100_000))).toStrictEqual(usd(12_246));
    // BBVA Perú's Cero card states only its TEA, 109.99% a year: 1,000 soles owed for a month carry 63.78.
    const [cero] = cardsIn('PE') as [Card];
    expect(cero.rate).toStrictEqual({ percent: '109.99', per: 'year', effective: true });
    expect(interestFor(cero, money('PEN', 100_000))).toStrictEqual(money('PEN', 6378));
    expect([interestFor(effective('0'), usd(100_000)), interestFor(effective('95.90'), usd(-100_000))]).toStrictEqual([usd(0), usd(0)]);
    // The root is the largest integer whose twelfth power doesn't pass the number, from any start at or above it.
    expect([root12(4096n, 4096n), root12(4095n, 4096n), root12(4097n, 9000n), root12(1n, 1n)]).toEqual([2n, 1n, 2n, 1n]);
  });

  it("waive a card's fee by what's spent on it, or as an account's is", () => {
    const fee: Fee = { fee: usd(9500), per: 'year', waived: [{ spend: usd(1_000_000) }, { under: 26 }] };
    expect(feeFor(fee, standing, '2026-11-01')).toStrictEqual(usd(9500));
    expect(feeFor(fee, { ...standing, spent: usd(999_999) }, '2026-11-01')).toStrictEqual(usd(9500));
    expect(feeFor(fee, { ...standing, spent: usd(1_000_000) }, '2026-11-01')).toStrictEqual(usd(0));
    expect(feeFor(fee, { ...standing, age: 25 }, '2026-11-01')).toStrictEqual(usd(0));
    const spendOnly: Fee = { fee: usd(9500), per: 'year', waived: [{ spend: usd(1_000_000) }] };
    expect([feeFor(spendOnly, { ...standing, age: 20 }, '2026-11-01'), feeFor(spendOnly, { ...standing, spent: usd(1_000_001) }, '2026-11-01')]).toStrictEqual([usd(9500), usd(0)]);
    const rising: Fee = { fee: usd(9500), per: 'year', changes: [{ from: '2027-01-01', fee: usd(12_000) }], waived: [{ from: 65 }] };
    expect([feeFor(rising, standing, '2026-12-31'), feeFor(rising, standing, '2027-01-01'), feeFor(rising, { ...standing, age: 65 }, '2027-01-01')]).toStrictEqual([usd(9500), usd(12_000), usd(0)]);
  });

  it("price a holder within the card's range by their record, the best at its lowest", () => {
    const range = { percent: '29', per: 'year' as const, from: '18' };
    expect([priced(range, 0), priced(range, 1000), priced(range, 500), priced(range, 1)]).toStrictEqual([
      { percent: '29.000000', per: 'year' },
      { percent: '18.000000', per: 'year' },
      { percent: '23.500000', per: 'year' },
      { percent: '28.989000', per: 'year' },
    ]);
    expect(priced({ percent: '40.6', per: 'year', effective: true, from: '18.4' }, 250)).toStrictEqual({ percent: '35.050000', per: 'year', effective: true });
    // Past the sixth place a rate rounds half to even.
    expect([priced({ percent: '0.0000025', per: 'month', from: '0' }, 0).percent, priced({ percent: '0.0000015', per: 'month', from: '0' }, 0).percent]).toEqual(['0.000002', '0.000002']);
    expect(priced({ percent: '1', per: 'month', from: '0.000001' }, 999).percent).toBe('0.001001');
    const flat = { percent: '24', per: 'year' as const };
    expect(priced(flat, 700)).toBe(flat);
    for (const s of [-1, 1001, 1.5]) expect(() => priced(range, s), String(s)).toThrow(`a standing is a whole number from 0 to 1000 (${s})`);
    expect(() => priced(flat, 1001)).toThrow('a standing is a whole number from 0 to 1000 (1001)');
    const card: Card = { bank: 'B', card: 'C', currency: 'USD', rate: range, fees: [] };
    // 1,000 owed a month: 29% a twelfth (24.17), 18% (15.00).
    expect([interestFor(card, usd(100_000)), interestFor(card, usd(100_000), 1000)]).toStrictEqual([usd(2417), usd(1500)]);
  });

  it('charge an introductory rate for its months, a penalty rate after a late payment, and steps for each part of a balance', () => {
    const card: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [], intro: { percent: '0', per: 'month', months: 6 }, penalty: { percent: '36', per: 'year' } };
    expect([1, 6, 7].map((m) => interestFor(card, usd(100_000), 0, m))).toStrictEqual([usd(0), usd(0), usd(2000)]);
    // A late payment ends the introductory rate and brings the penalty rate.
    expect([interestFor(card, usd(100_000), 0, 1, true), interestFor(card, usd(100_000), 0, 7, true)]).toStrictEqual([usd(3000), usd(3000)]);
    const plain: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [] };
    expect(interestFor(plain, usd(100_000), 0, 1, true)).toStrictEqual(usd(2000));
    const birbank: Card = { bank: 'Kapital Bank', card: 'Birbank Star', currency: 'AZN', rate: { steps: { fee: money('AZN', 1000), each: money('AZN', 50_000) } }, fees: [] };
    // 10 manat for each 500 begun: 1 manat carried is one step, 500 one, 500.01 two, 1,200 three.
    expect([1, 50_000, 50_001, 120_000, 0, -5].map((m) => interestFor(birbank, money('AZN', m)))).toStrictEqual([1000, 1000, 2000, 3000, 0, 0].map((m) => money('AZN', m)));
    expect(stepped({ fee: usd(1000), each: usd(50_000) }, usd(100_000))).toStrictEqual(usd(2000));
  });

  it('charge cash advances their own rate and fee, and spending abroad its share', () => {
    const card: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [], cash: { rate: { percent: '3', per: 'month' }, fee: { percent: '5', min: usd(1000) } }, fx: '2.75' };
    expect(cashInterestFor(card, usd(100_000))).toStrictEqual(usd(3000));
    expect([cashFee(card, usd(10_000)), cashFee(card, usd(100_000))]).toStrictEqual([usd(1000), usd(5000)]);
    expect(fxFee(card, usd(10_000))).toStrictEqual(usd(275));
    const ranged: Card = { ...card, cash: { rate: { percent: '36', per: 'year', from: '24' } } };
    expect([cashInterestFor(ranged, usd(100_000)), cashInterestFor(ranged, usd(100_000), 1000)]).toStrictEqual([usd(3000), usd(2000)]);
    const plain: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year', from: '12' }, fees: [] };
    expect([cashInterestFor(plain, usd(100_000)), cashInterestFor(plain, usd(100_000), 1000)]).toStrictEqual([usd(2000), usd(1000)]);
    expect([cashFee(plain, usd(10_000)), fxFee(plain, usd(10_000))]).toStrictEqual([usd(0), usd(0)]);
    expect(cashFee({ ...card, cash: { rate: { percent: '3', per: 'month' } } }, usd(10_000))).toStrictEqual(usd(0));
  });

  it('charge a fee as its share and its fixed sum, never under its floor or over its ceiling', () => {
    expect(charged({ percent: '5', min: usd(2000), max: usd(3000) }, usd(10_000))).toStrictEqual(usd(2000));
    expect(charged({ percent: '5', min: usd(2000), max: usd(3000) }, usd(50_000))).toStrictEqual(usd(2500));
    expect(charged({ percent: '5', min: usd(2000), max: usd(3000) }, usd(100_000))).toStrictEqual(usd(3000));
    expect(charged({ fixed: usd(4000) }, usd(1))).toStrictEqual(usd(4000));
    // Sohar's: 3% of the minimum and 3 rials on top; the floor and the ceiling hold the sum.
    expect(charged({ percent: '3', fixed: money('OMR', 3000) }, money('OMR', 100_000))).toStrictEqual(money('OMR', 6000));
    expect(charged({ percent: '1', fixed: usd(300), max: usd(500) }, usd(100_000))).toStrictEqual(usd(500));
    expect(charged({ percent: '1', fixed: usd(300), min: usd(500) }, usd(10_000))).toStrictEqual(usd(500));
    expect(share(usd(1001), '50')).toStrictEqual(usd(500));
    expect(share(usd(1003), '50')).toStrictEqual(usd(502));
  });

  it("charge a late payment, a balance over the limit, and a statement's minimum as the bank sets them", () => {
    const st = { minimum: usd(5000), balance: usd(100_000), unpaid: usd(3000) };
    const card = (late?: Card['late'], overLimit?: Card['overLimit']): Card => ({ bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [], ...(late ? { late } : {}), ...(overLimit ? { overLimit } : {}) });
    expect(lateFee(card({ fixed: usd(4000) }), st)).toStrictEqual(usd(4000));
    expect(lateFee(card({ percent: '10', of: 'minimum' }), st)).toStrictEqual(usd(500));
    expect(lateFee(card({ percent: '1', of: 'balance' }), st)).toStrictEqual(usd(1000));
    expect(lateFee(card({ percent: '10', of: 'unpaid' }), st)).toStrictEqual(usd(300));
    expect(lateFee(card(undefined), st)).toStrictEqual(usd(0));
    const o = { excess: usd(5000), balance: usd(105_000), limit: usd(100_000) };
    expect(overLimitFee(card(undefined, { fixed: usd(2500) }), o)).toStrictEqual(usd(2500));
    expect(overLimitFee(card(undefined, { percent: '10', of: 'excess' }), o)).toStrictEqual(usd(500));
    expect(overLimitFee(card(undefined, { percent: '1', of: 'balance' }), o)).toStrictEqual(usd(1050));
    expect(overLimitFee(card(undefined, { percent: '1', of: 'limit' }), o)).toStrictEqual(usd(1000));
    expect(overLimitFee(card(undefined, { fixed: usd(2500) }), { ...o, excess: usd(0) })).toStrictEqual(usd(0));
    expect(overLimitFee(card(undefined, { fixed: usd(2500) }), { ...o, excess: usd(1) })).toStrictEqual(usd(2500));
    expect(overLimitFee(card(undefined), o)).toStrictEqual(usd(0));
    const m: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [], minimum: { percent: '5', floor: usd(2500), interest: true } };
    expect(minimumDue(m, usd(100_000), usd(2000))).toStrictEqual(usd(7000));
    expect(minimumDue(m, usd(10_000), usd(0))).toStrictEqual(usd(2500));
    expect(minimumDue(m, usd(2400), usd(0))).toStrictEqual(usd(2400));
    expect(minimumDue(m, usd(2500), usd(0))).toStrictEqual(usd(2500));
    expect(minimumDue({ ...m, minimum: { percent: '5' } }, usd(100_000), usd(2000))).toStrictEqual(usd(5000));
    expect(minimumDue({ ...m, minimum: { percent: '5' } }, usd(1), usd(0))).toStrictEqual(usd(0));
    expect([minimumDue(m, usd(0), usd(0)), minimumDue(m, usd(-100), usd(0))]).toStrictEqual([usd(0), usd(0)]);
    // A card that publishes no minimum asks the balance.
    expect(minimumDue({ bank: 'B', card: 'C', currency: 'USD', rate: 'in full', fees: [] }, usd(12_345), usd(0))).toStrictEqual(usd(12_345));
  });

  it('add the tax a bank states on its interest and its fees, and the fees set as a share of the limit', () => {
    const card: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [], tax: { interest: '3.5', fees: '16' }, limitFees: [{ percent: '1', when: 'issue' }, { percent: '0.5', when: 'issue' }, { percent: '1', when: 'year' }] };
    expect([taxOnInterest(card, usd(10_000)), taxOnFees(card, usd(10_000))]).toStrictEqual([usd(350), usd(1600)]);
    const plain: Card = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [] };
    expect([taxOnInterest(plain, usd(10_000)), taxOnFees(plain, usd(10_000))]).toStrictEqual([usd(0), usd(0)]);
    expect([taxOnInterest({ ...card, tax: { fees: '16' } }, usd(10_000)), taxOnFees({ ...card, tax: { interest: '3.5' } }, usd(10_000))]).toStrictEqual([usd(0), usd(0)]);
    expect([limitFee(card, usd(100_000), 'issue'), limitFee(card, usd(100_000), 'year'), limitFee(card, usd(100_000), 'raise'), limitFee(plain, usd(100_000), 'issue')]).toStrictEqual([usd(1500), usd(1000), usd(0), usd(0)]);
  });

  it('waive a fee for its first periods', () => {
    const fee: Fee = { fee: usd(10_000), per: 'year', waived: [{ first: 1 }] };
    expect([1, 2].map((period) => feeFor(fee, { ...standing, period }, '2026-11-01'))).toStrictEqual([usd(0), usd(10_000)]);
    expect(monthly({ percent: '12', per: 'year' }, usd(-1))).toStrictEqual(usd(0));
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('cards.unkept');
    expect(aboutCards('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutCards('AQ')).toBe("The credit cards of Antarctica aren't known to this game yet.");
    expect(aboutCards('US')).toBeUndefined();
  });
});
