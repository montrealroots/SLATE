import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/credit/credit.json';
import { aboutCredit, CREDIT_START, creditIn, keepsCredit, MARK, record, reportAfter, standingOf, UNKEPT_LINE, type CreditSlice } from '../../../src/money/credit/credit.ts';

const YEAR = Math.round(365.25 * 86_400);

describe('credit', () => {
  it("name each country's credit bureau, when it reports a late payment and how long it keeps it", () => {
    expect(COUNTRY_CODES.filter(keepsCredit)).toEqual(Object.keys(data.countries).sort());
    expect(creditIn('US')).toStrictEqual({ bureau: 'Equifax, Experian and TransUnion', report: 30, keep: 7 });
    expect([reportAfter('US'), reportAfter('GB'), reportAfter('AQ')]).toEqual([30, 30, undefined]);
    expect(creditIn('AQ')).toBeUndefined();
    expect(CREDIT_START).toStrictEqual({ marks: [] });
  });

  it("mark a late payment on the record for the country's years, and stand the record by the marks still kept", () => {
    const credit: CreditSlice = { marks: [] };
    expect(standingOf(credit, 0)).toBe(1000);
    record(credit, 'US', 1000);
    expect(credit.marks).toStrictEqual([{ country: 'US', at: 1000, until: 1000 + 7 * YEAR }]);
    expect([standingOf(credit, 999), standingOf(credit, 1000), standingOf(credit, 1000 + 7 * YEAR - 1), standingOf(credit, 1000 + 7 * YEAR)]).toEqual([1000, 750, 750, 1000]);
    record(credit, 'GB', 2000);
    expect(credit.marks[1]).toStrictEqual({ country: 'GB', at: 2000, until: 2000 + 6 * YEAR });
    expect(standingOf(credit, 2000)).toBe(1000 - 2 * MARK);
    // A country whose records the game doesn't keep marks nothing.
    record(credit, 'AQ', 3000);
    expect(credit.marks).toHaveLength(2);
    for (let i = 0; i < 4; i += 1) record(credit, 'US', 4000);
    expect([MARK, standingOf(credit, 4000)]).toEqual([250, 0]);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('credit.unkept');
    expect(aboutCredit('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutCredit('AQ')).toBe("The credit records of Antarctica aren't known to this game yet.");
    expect(aboutCredit('US')).toBeUndefined();
  });
});
