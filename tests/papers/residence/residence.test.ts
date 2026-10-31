import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutResidence, keepsResidence, needsNoPermit, NONE_LINE, residenceRoutes, UNKEPT_LINE } from '../../../src/papers/residence/residence.ts';

/**
 * No country's research was written when the engine was built (2026-10-30), so its reads are held here on a few
 * entries in the compiled form; the test is rewritten on the research's own as it lands.
 */
vi.mock('../../../src/papers/residence/residence.json', () => ({
  default: {
    GB: { routes: [{ id: 'talent', name: 'Global Talent visa', for: 'talent', apply: 'either', work: 'any', fee: { currency: 'GBP', minor: 76600 } }] },
    GI: { issuedBy: 'GB' },
    SJ: { free: true },
    TF: { none: true },
  },
}));

describe('the residence permissions', () => {
  it("are each country's own", () => {
    expect([keepsResidence('GB'), keepsResidence('GI'), keepsResidence('LY')]).toEqual([true, true, false]);
    expect(residenceRoutes('GB')).toEqual([{ id: 'talent', name: 'Global Talent visa', for: 'talent', apply: 'either', work: 'any', fee: { currency: 'GBP', minor: 76600 } }]);
    expect(residenceRoutes('GI')).toBe(residenceRoutes('GB'));
    expect(residenceRoutes('LY')).toBeUndefined();
    // Where no permit is needed, there's no route to take.
    expect([residenceRoutes('SJ'), needsNoPermit('SJ'), needsNoPermit('GB'), needsNoPermit('GI'), needsNoPermit('LY')]).toEqual([[], true, false, false, undefined]);
    // Where no one may come to live there's no route either, and it isn't a place needing no permit.
    expect([residenceRoutes('TF'), needsNoPermit('TF'), keepsResidence('TF')]).toEqual([[], false, true]);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('residence.unkept');
    expect(aboutResidence('LY')).toBe(t(UNKEPT_LINE, { country: 'Libya' }));
    expect([aboutResidence('GB'), aboutResidence('GI'), aboutResidence('SJ')]).toEqual([undefined, undefined, undefined]);
    expect(NONE_LINE).toBe('residence.none');
    expect(aboutResidence('TF')).toBe(t(NONE_LINE, { country: 'French Southern Territories' }));
    expect(aboutResidence('TF')).toBe('No one from abroad can settle in French Southern Territories.');
  });
});
