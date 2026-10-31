import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutAges, majorityAt, serviceIn, termFor, UNKEPT_LINE, workAge } from '../../../src/papers/ages/ages.ts';

/**
 * The ages on the compiled form, until the research lands: the United States with Alabama's own majority, South Korea's
 * service for men, Israel's for both, Myanmar's for each sex its own span, a country with one of the three unknown.
 */
vi.mock('../../../src/papers/ages/ages.json', () => ({
  default: {
    US: { majority: 18, regions: { 'US.AL': 19, 'US.MS': null }, work: { from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } }, service: 'none' },
    KR: { majority: 19, work: { from: 15, performers: 'free' }, service: [{ sexes: ['male'], from: 18, until: 28, months: 18 }] },
    IL: { majority: 18, work: { from: 15, performers: 'barred' }, service: [{ sexes: ['male', 'female'], from: 18, until: 29, months: null }] },
    MM: { majority: 18, work: { from: 14, performers: 'free' }, service: [{ sexes: ['male'], from: 18, until: 35, months: 24 }, { sexes: ['female'], from: 18, until: 27, months: 24 }] },
    FR: { majority: 18, work: null, service: 'none' },
    CA: { majority: null, regions: { 'CA.02': 19 }, work: { from: 14, performers: 'free' }, service: 'none' },
    DE: { majority: null, work: { from: 15, performers: 'free' }, service: 'none' },
    IT: { majority: 18, work: { from: 16, performers: 'free' }, service: null },
  },
}));

describe('the ages', () => {
  it("are each country's own", () => {
    // A region's own majority where its law sets one, else the country's.
    expect([majorityAt({ country: 'US', region: 'US.AL' }), majorityAt({ country: 'US', region: 'US.NY' }), majorityAt({ country: 'AQ', region: '' }), majorityAt({ country: 'KR', region: 'KR.11' })]).toEqual([19, 18, undefined, 19]);
    // A region the research names unknown is unknown, not the country's; a country's own unknown leaves its other regions unknown.
    expect([majorityAt({ country: 'US', region: 'US.MS' }), majorityAt({ country: 'CA', region: 'CA.02' }), majorityAt({ country: 'CA', region: 'CA.08' })]).toEqual([undefined, 19, undefined]);
    expect(workAge('US')).toStrictEqual({ from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } });
    expect([workAge('FR'), workAge('AQ')]).toEqual([undefined, undefined]);
    // Service by sex: men only in South Korea, both in Israel, each its own span in Myanmar, none in the United States;
    // unknown where the game doesn't know.
    const kr = { sexes: ['male'], from: 18, until: 28, months: 18 };
    expect([termFor('KR', 'male'), termFor('KR', 'female'), termFor('US', 'male'), termFor('AQ', 'male')]).toStrictEqual([kr, 'none', 'none', undefined]);
    const il = { sexes: ['male', 'female'], from: 18, until: 29, months: null };
    expect([termFor('IL', 'female'), termFor('IL', 'male')]).toStrictEqual([il, il]);
    expect([termFor('MM', 'male'), termFor('MM', 'female')]).toStrictEqual([
      { sexes: ['male'], from: 18, until: 35, months: 24 },
      { sexes: ['female'], from: 18, until: 27, months: 24 },
    ]);
    expect(serviceIn('KR')).toStrictEqual([kr]);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('ages.unkept');
    const at = (country: string, region = '') => aboutAges({ country: country as never, region });
    expect([at('US', 'US.NY'), at('US', 'US.AL'), at('KR')]).toEqual([undefined, undefined, undefined]);
    // A region whose majority is unknown is told, though its country's other regions aren't.
    expect([at('US', 'US.MS'), at('CA', 'CA.08'), at('CA', 'CA.02')]).toEqual([t(UNKEPT_LINE, { country: 'United States' }), t(UNKEPT_LINE, { country: 'Canada' }), undefined]);
    expect(at('FR')).toBe(t(UNKEPT_LINE, { country: 'France' }));
    // Any of the three unknown: the majority, the service.
    expect([at('DE'), at('IT')]).toEqual([t(UNKEPT_LINE, { country: 'Germany' }), t(UNKEPT_LINE, { country: 'Italy' })]);
    expect(at('AQ')).toBe("What a person may do at what age in Antarctica, and what their sex changes there, isn't fully known to this game yet.");
  });
});
