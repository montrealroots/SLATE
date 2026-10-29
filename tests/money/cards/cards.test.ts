import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/cards/cards.json';
import { aboutCards, cardsIn, feeFor, interestFor, keepsCards, paidInFull, root12, UNKEPT_LINE, type Card, type Fee } from '../../../src/money/cards/cards.ts';

const usd = (minor: number) => money('USD', minor);
const standing = { age: 30, deposits: usd(0), lowest: usd(0), average: usd(0), national: false, spent: usd(0) };

describe('cards', () => {
  it("name each country's credit cards, their interest and their fees", () => {
    expect(COUNTRY_CODES.filter(keepsCards)).toEqual(Object.keys(data.countries).sort());
    expect([keepsCards('US'), keepsCards('AQ')]).toEqual([true, false]);
    expect(cardsIn('AQ')).toEqual([]);
    // Chase's Freedom Unlimited: no annual fee, 27.99% a year at the top of its range, a twelfth a month.
    const [chase] = cardsIn('US') as [Card];
    expect(chase).toStrictEqual({ bank: 'Chase', card: 'Chase Freedom Unlimited', rate: { percent: '27.99', per: 'year' }, fees: [] });
    expect(paidInFull(chase)).toBe(false);
    // 1,000 dollars at 27.99% a year is 23.325 a month, rounded half to even.
    expect(interestFor(chase, usd(100_000))).toStrictEqual(usd(2332));
    expect(interestFor(chase, usd(100_002))).toStrictEqual(usd(2333));
    expect(interestFor(chase, usd(1))).toStrictEqual(usd(0));
    // Nothing on a balance in the holder's favour, or none.
    expect([interestFor(chase, usd(0)), interestFor(chase, usd(-50_000))]).toStrictEqual([usd(0), usd(0)]);
    const [amazon] = cardsIn('GB') as [Card];
    expect(interestFor(amazon, money('GBP', 100_000))).toStrictEqual(money('GBP', 2408));
    // Deutsche Bank's Mastercard: 39 euros a year, its balance taken from the account each month.
    const [db] = cardsIn('DE') as [Card];
    expect(db).toStrictEqual({ bank: 'Deutsche Bank', card: 'Mastercard oder VISA', rate: 'in full', fees: [{ fee: money('EUR', 3900), per: 'year' }] });
    expect(paidInFull(db)).toBe(true);
    expect(() => interestFor(db, money('EUR', 100))).toThrow("Deutsche Bank's Mastercard oder VISA carries nothing: it's paid in full each month");
    expect(feeFor(db.fees[0] as Fee, { ...standing, age: 70, spent: money('EUR', 9_999_999) }, '2026-11-01')).toStrictEqual(money('EUR', 3900));
  });

  it('charge interest by the month where the bank states it so', () => {
    const monthly: Card = { bank: 'B', card: 'C', rate: { percent: '3.5', per: 'month' }, fees: [] };
    expect(interestFor(monthly, money('XOF', 100_000))).toStrictEqual(money('XOF', 3500));
    expect(interestFor({ ...monthly, rate: { percent: '0', per: 'year' } }, usd(100_000))).toStrictEqual(usd(0));
  });

  it('charge an effective yearly rate as the month that, compounded twelve times, makes it', () => {
    const effective = (percent: string): Card => ({ bank: 'B', card: 'C', rate: { percent, per: 'year', effective: true }, fees: [] });
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

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('cards.unkept');
    expect(aboutCards('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutCards('AQ')).toBe("The credit cards of Antarctica aren't known to this game yet.");
    expect(aboutCards('US')).toBeUndefined();
  });
});
