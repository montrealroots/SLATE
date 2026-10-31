import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutAges, calls, majorityAt, serviceIn, UNKEPT_LINE, workAge } from '../../../src/papers/ages/ages.ts';

/**
 * The ages on the compiled form, until the research lands: the United States with Alabama's own majority, South Korea's
 * service for men, Israel's for both, a country with one of the three unknown.
 */
vi.mock('../../../src/papers/ages/ages.json', () => ({
  default: {
    US: { majority: 18, regions: { 'US.AL': 19 }, work: { from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } }, service: 'none' },
    KR: { majority: 19, work: { from: 15, performers: 'free' }, service: { sexes: ['male'], from: 18, until: 28, months: 18 } },
    IL: { majority: 18, work: { from: 15, performers: 'barred' }, service: { sexes: ['male', 'female'], from: 18, until: 29, months: null } },
    FR: { majority: 18, work: null, service: 'none' },
    DE: { majority: null, work: { from: 15, performers: 'free' }, service: 'none' },
    IT: { majority: 18, work: { from: 16, performers: 'free' }, service: null },
  },
}));

describe('the ages', () => {
  it("are each country's own", () => {
    // A region's own majority where its law sets one, else the country's.
    expect([majorityAt({ country: 'US', region: 'US.AL' }), majorityAt({ country: 'US', region: 'US.NY' }), majorityAt({ country: 'AQ', region: '' }), majorityAt({ country: 'KR', region: 'KR.11' })]).toEqual([19, 18, undefined, 19]);
    expect(workAge('US')).toStrictEqual({ from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } });
    expect([workAge('FR'), workAge('AQ')]).toEqual([undefined, undefined]);
    // Service by sex: men only in South Korea, both in Israel, none in the United States; unknown where the game doesn't know.
    expect([calls('KR', 'male'), calls('KR', 'female'), calls('IL', 'female'), calls('US', 'male'), calls('AQ', 'male')]).toEqual([true, false, true, false, undefined]);
    expect(serviceIn('KR')).toStrictEqual({ sexes: ['male'], from: 18, until: 28, months: 18 });
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('ages.unkept');
    expect([aboutAges('US'), aboutAges('KR')]).toEqual([undefined, undefined]);
    expect(aboutAges('FR')).toBe(t(UNKEPT_LINE, { country: 'France' }));
    // Any of the three unknown: the majority, the service.
    expect([aboutAges('DE'), aboutAges('IT')]).toEqual([t(UNKEPT_LINE, { country: 'Germany' }), t(UNKEPT_LINE, { country: 'Italy' })]);
    expect(aboutAges('AQ')).toBe("What a person may do at what age in Antarctica, and what their sex changes there, isn't fully known to this game yet.");
  });
});
