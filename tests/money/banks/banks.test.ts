import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/banks/banks.json';
import { aboutBanks, banksIn, feeFor, keepsBanks, UNKEPT_LINE, type Fee } from '../../../src/money/banks/banks.ts';

const usd = (minor: number) => money('USD', minor);
const standing = { age: 30, deposits: usd(0), lowest: usd(0), average: usd(0) };

describe('banks', () => {
  it("name each country's banks and what their everyday account costs", () => {
    expect(COUNTRY_CODES.filter(keepsBanks)).toEqual(Object.keys(data.countries).sort());
    expect([keepsBanks('US'), keepsBanks('AQ')]).toEqual([true, false]);
    expect(banksIn('AQ')).toEqual([]);
    // Barclays charges nothing; Deutsche Bank's AktivKonto 6.90 euros a month whatever the holder does.
    expect(banksIn('GB')).toStrictEqual([{ bank: 'Barclays', account: 'Flexible', fees: [] }]);
    expect(banksIn('DE')).toStrictEqual([{ bank: 'Deutsche Bank', account: 'AktivKonto', fees: [{ fee: money('EUR', 690), per: 'month' }] }]);
    const deutsche = banksIn('DE')[0]?.fees[0] as Fee;
    expect(feeFor(deutsche, { age: 70, deposits: money('EUR', 1_000_000), lowest: money('EUR', 1_000_000), average: money('EUR', 1_000_000) })).toStrictEqual(money('EUR', 690));
    // Chase Total Checking: $15 a month, waived by $500 paid in, a balance never under $1,500, or an average of $5,000.
    const [account] = banksIn('US');
    expect([account?.bank, account?.account, account?.fees.length]).toStrictEqual(['Chase', 'Chase Total Checking', 1]);
    const chase = account?.fees[0] as Fee;
    expect([chase?.fee, chase?.per]).toStrictEqual([usd(1500), 'month']);
    expect(feeFor(chase, standing)).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, deposits: usd(49_999) })).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, deposits: usd(50_000) })).toStrictEqual(usd(0));
    expect(feeFor(chase, { ...standing, lowest: usd(149_999) })).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, lowest: usd(150_000) })).toStrictEqual(usd(0));
    expect(feeFor(chase, { ...standing, average: usd(499_999) })).toStrictEqual(usd(1500));
    expect(feeFor(chase, { ...standing, average: usd(500_000) })).toStrictEqual(usd(0));
  });

  it('waive a fee by the age the account names', () => {
    const young = { fee: usd(500), per: 'month' as const, waived: [{ under: 26 }] };
    const old = { fee: usd(500), per: 'month' as const, waived: [{ from: 60 }] };
    expect([25, 26].map((age) => feeFor(young, { ...standing, age }))).toStrictEqual([usd(0), usd(500)]);
    expect([59, 60].map((age) => feeFor(old, { ...standing, age }))).toStrictEqual([usd(500), usd(0)]);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('banks.unkept');
    expect(aboutBanks('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutBanks('AQ')).toBe("The banks of Antarctica aren't known to this game yet.");
    expect(aboutBanks('US')).toBeUndefined();
  });
});
