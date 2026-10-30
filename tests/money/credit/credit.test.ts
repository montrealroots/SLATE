import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/credit/credit.json';
import { aboutCredit, clear, CREDIT_START, creditIn, keepsCredit, MARK, NONE_LINE, record, reportAfter, standingOf, UNKEPT_LINE, type CreditSlice } from '../../../src/money/credit/credit.ts';

const YEAR = Math.round(365.25 * 86_400);

describe('credit', () => {
  it("name each country's credit bureau, when it reports a late payment and how long it keeps it", () => {
    expect(COUNTRY_CODES.filter(keepsCredit)).toEqual(Object.keys(data.countries).sort());
    expect(creditIn('US')).toStrictEqual({ bureau: 'Equifax, Experian and TransUnion', report: 30, keep: 7 });
    expect([reportAfter('US'), reportAfter('GB'), reportAfter('AQ')]).toEqual([30, 30, undefined]);
    expect(creditIn('AQ')).toBeUndefined();
    // Luxembourg's central bank: no register of consumer credit, so nothing to report to.
    expect([keepsCredit('LU'), creditIn('LU'), reportAfter('LU')]).toStrictEqual([true, { none: true }, undefined]);
    // Honduras lifts a consumer debt's mark 90 days after it's paid.
    expect(creditIn('HN')).toStrictEqual({ bureau: 'Central de Información Crediticia (CNBS)', report: 30, keep: 2, clears: 90 });
    expect(CREDIT_START).toStrictEqual({ marks: [] });
  });

  it("mark a late payment on the record for the country's years, and stand the record by the marks still kept", () => {
    const credit: CreditSlice = { marks: [] };
    expect(standingOf(credit, 0)).toBe(1000);
    record(credit, 'US', 1000, 'd');
    expect(credit.marks).toStrictEqual([{ country: 'US', at: 1000, until: 1000 + 7 * YEAR }]);
    expect([standingOf(credit, 999), standingOf(credit, 1000), standingOf(credit, 1000 + 7 * YEAR - 1), standingOf(credit, 1000 + 7 * YEAR)]).toEqual([1000, 750, 750, 1000]);
    record(credit, 'GB', 2000, 'd');
    expect(credit.marks[1]).toStrictEqual({ country: 'GB', at: 2000, until: 2000 + 6 * YEAR });
    expect(standingOf(credit, 2000)).toBe(1000 - 2 * MARK);
    // A country whose records the game doesn't keep marks nothing.
    record(credit, 'AQ', 3000, 'd');
    // Nor does one where no bureau keeps a record.
    record(credit, 'LU', 3000, 'd');
    expect(credit.marks).toHaveLength(2);
    for (let i = 0; i < 4; i += 1) record(credit, 'US', 4000, 'd');
    expect([MARK, standingOf(credit, 4000)]).toEqual([250, 0]);
  });

  it('lift a mark once its debt is paid, where the record lifts it then', () => {
    const credit: CreditSlice = { marks: [] };
    const DAY = 86_400;
    record(credit, 'HN', 5000, '0:9');
    record(credit, 'HN', 5000, '1:9');
    expect(credit.marks[0]).toStrictEqual({ country: 'HN', at: 5000, until: 5000 + 2 * YEAR, debt: '0:9', lift: 90 * DAY });
    // A mark that doesn't lift isn't tied to its debt, and paying it changes nothing.
    record(credit, 'US', 5000, '0:9');
    expect(credit.marks[2]).toStrictEqual({ country: 'US', at: 5000, until: 5000 + 7 * YEAR });
    clear(credit, '0:9', 6000);
    expect(credit.marks.map((m) => m.until)).toStrictEqual([6000 + 90 * DAY, 5000 + 2 * YEAR, 5000 + 7 * YEAR]);
    expect([standingOf(credit, 6000 + 90 * DAY - 1), standingOf(credit, 6000 + 90 * DAY)]).toEqual([1000 - 3 * MARK, 1000 - 2 * MARK]);
    // Paid again later, it doesn't come back; paid when its keeping has run out, it doesn't run longer.
    clear(credit, '0:9', 9000);
    expect(credit.marks[0]?.until).toBe(6000 + 90 * DAY);
    clear(credit, '1:9', 5000 + 2 * YEAR);
    expect(credit.marks[1]?.until).toBe(5000 + 2 * YEAR);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('credit.unkept');
    expect(aboutCredit('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutCredit('AQ')).toBe("The credit records of Antarctica aren't known to this game yet.");
    expect(aboutCredit('US')).toBeUndefined();
    expect(NONE_LINE).toBe('credit.none');
    expect(aboutCredit('LU')).toBe(t(NONE_LINE, { country: 'Luxembourg' }));
    expect(aboutCredit('LU')).toBe("No bureau in Luxembourg keeps a record of anyone's credit, so a late payment there leaves no mark.");
  });
});
