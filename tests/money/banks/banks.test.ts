import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/banks/banks.json';
import { aboutBanks, banksIn, feeFor, feeOn, keepsBanks, UNKEPT_LINE, type Fee } from '../../../src/money/banks/banks.ts';

const usd = (minor: number) => money('USD', minor);
const standing = { age: 30, deposits: usd(0), lowest: usd(0), average: usd(0), national: false, period: 2 };

describe('banks', () => {
  it("name each country's banks and what their everyday account costs", () => {
    expect(COUNTRY_CODES.filter(keepsBanks)).toEqual(Object.keys(data.countries).sort());
    expect([keepsBanks('US'), keepsBanks('AQ')]).toEqual([true, false]);
    expect(banksIn('AQ')).toEqual([]);
    // Barclays charges nothing to keep the account and refuses a payment past the balance (no unarranged overdraft);
    // Deutsche Bank's AktivKonto 6.90 euros a month whatever the holder does, a tolerated overdraft at 13.30% a year.
    const gbp = (minor: number) => money('GBP', minor);
    const eur = (minor: number) => money('EUR', minor);
    expect(banksIn('GB')).toStrictEqual([
      { bank: 'Barclays', account: 'Flexible', currency: 'GBP', fees: [], overdraft: false, returned: gbp(0), debit: { fx: '2.99' }, atm: { own: gbp(0), other: gbp(0), abroad: { percent: '2.99' } }, transfers: { domestic: gbp(0), abroad: { percent: '0' } } },
    ]);
    expect(banksIn('DE')).toStrictEqual([
      {
        bank: 'Deutsche Bank',
        account: 'AktivKonto',
        currency: 'EUR',
        fees: [{ fee: eur(690), per: 'month' }],
        overdraft: { rate: { percent: '13.30', per: 'year' } },
        returned: eur(68),
        debit: { fx: '1' },
        atm: { own: eur(0), abroad: { percent: '1', min: eur(599) } },
        transfers: { domestic: eur(0) },
      },
    ]);
    const deutsche = banksIn('DE')[0]?.fees[0] as Fee;
    expect(feeFor(deutsche, { age: 70, deposits: money('EUR', 1_000_000), lowest: money('EUR', 1_000_000), average: money('EUR', 1_000_000), national: true, period: 1 }, '2026-11-01')).toStrictEqual(money('EUR', 690));
    // Chase Total Checking: $15 a month, waived by $500 paid in, a balance never under $1,500, or an average of $5,000.
    const [account] = banksIn('US');
    expect([account?.bank, account?.account, account?.fees.length]).toStrictEqual(['Chase', 'Chase Total Checking', 1]);
    const chase = account?.fees[0] as Fee;
    expect([chase?.fee, chase?.per]).toStrictEqual([usd(1500), 'month']);
    expect(feeFor(chase, standing, '2026-11-01')).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, deposits: usd(49_999) }, '2026-11-01')).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, deposits: usd(50_000) }, '2026-11-01')).toStrictEqual(usd(0));
    expect(feeFor(chase, { ...standing, lowest: usd(149_999) }, '2026-11-01')).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, lowest: usd(150_000) }, '2026-11-01')).toStrictEqual(usd(0));
    expect(feeFor(chase, { ...standing, average: usd(499_999) }, '2026-11-01')).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, average: usd(500_000) }, '2026-11-01')).toStrictEqual(usd(0));
  });

  it('waive a fee by the age the account names', () => {
    const young = { fee: usd(500), per: 'month' as const, waived: [{ under: 26 }] };
    const old = { fee: usd(500), per: 'month' as const, waived: [{ from: 60 }] };
    expect([25, 26].map((age) => feeFor(young, { ...standing, age }, '2026-11-01'))).toStrictEqual([usd(0), usd(500)]);
    expect([59, 60].map((age) => feeFor(old, { ...standing, age }, '2026-11-01'))).toStrictEqual([usd(500), usd(0)]);
  });

  it("waive a fee for a citizen of the bank's country where the bank says so", () => {
    const nationals = { fee: usd(2625), per: 'month' as const, waived: [{ national: true as const }] };
    expect([false, true].map((national) => feeFor(nationals, { ...standing, national }, '2026-11-01'))).toStrictEqual([usd(2625), usd(0)]);
  });

  it("waive a fee for the account's first periods where the bank says so", () => {
    const opening = { fee: usd(500), per: 'month' as const, waived: [{ first: 3 }] };
    expect([1, 3, 4].map((period) => feeFor(opening, { ...standing, period }, '2026-11-01'))).toStrictEqual([usd(0), usd(0), usd(500)]);
  });

  it('charge the figure a price list gives from the day it takes effect', () => {
    const rising = { fee: money('EUR', 3700), per: 'quarter' as const, changes: [{ from: '2027-01-01', fee: money('EUR', 3818) }, { from: '2028-01-01', fee: money('EUR', 0) }], waived: [{ from: 65 }] };
    expect(['2026-12-31', '2027-01-01', '2027-12-31', '2028-01-01'].map((on) => feeOn(rising, on))).toStrictEqual([money('EUR', 3700), money('EUR', 3818), money('EUR', 3818), money('EUR', 0)]);
    expect(feeFor(rising, { age: 30, deposits: money('EUR', 0), lowest: money('EUR', 0), average: money('EUR', 0), national: false, period: 2 }, '2027-06-30')).toStrictEqual(money('EUR', 3818));
    expect(feeFor(rising, { age: 65, deposits: money('EUR', 0), lowest: money('EUR', 0), average: money('EUR', 0), national: false, period: 2 }, '2027-06-30')).toStrictEqual(money('EUR', 0));
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('banks.unkept');
    expect(aboutBanks('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutBanks('AQ')).toBe("The banks of Antarctica aren't known to this game yet.");
    expect(aboutBanks('US')).toBeUndefined();
  });
});
