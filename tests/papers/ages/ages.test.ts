import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutAges, majorityAt, UNKEPT_LINE, workAge } from '../../../src/papers/ages/ages.ts';

/**
 * The ages on the compiled form: the United States with Alabama's own majority and Mississippi's unread, Canada with
 * one province's read and its own unread, a country with its working age unknown, one with its majority unknown.
 */
vi.mock('../../../src/papers/ages/ages.json', () => ({
  default: {
    US: { majority: 18, regions: { 'US.AL': 19, 'US.MS': null }, work: { from: 14, performers: 'permit', permit: 'Entertainment work permit', permitFrom: { years: 0, days: 15 } } },
    KR: { majority: 19, work: { from: 15, performers: 'free' } },
    FR: { majority: 18, work: null },
    CA: { majority: null, regions: { 'CA.02': 19 }, work: { from: 14, performers: 'free' } },
    DE: { majority: null, work: { from: 15, performers: 'free' } },
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
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('ages.unkept');
    const at = (country: string, region = '') => aboutAges({ country: country as never, region });
    expect([at('US', 'US.NY'), at('US', 'US.AL'), at('KR'), at('CA', 'CA.02')]).toEqual([undefined, undefined, undefined, undefined]);
    // A region whose majority is unknown is told, though its country's other regions aren't.
    expect([at('US', 'US.MS'), at('CA', 'CA.08')]).toEqual([t(UNKEPT_LINE, { country: 'United States' }), t(UNKEPT_LINE, { country: 'Canada' })]);
    // Either unknown: the working age, the majority; a country the game doesn't keep.
    expect([at('FR'), at('DE')]).toEqual([t(UNKEPT_LINE, { country: 'France' }), t(UNKEPT_LINE, { country: 'Germany' })]);
    expect(at('AQ')).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
  });
});
