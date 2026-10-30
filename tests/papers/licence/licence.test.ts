import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { aboutLicence, licenceAt, UNKEPT_LINE } from '../../../src/papers/licence/licence.ts';

/**
 * No office's research was written when the engine was built (2026-10-30), so its reads are held here on a few
 * entries in the compiled form; the test is rewritten on the research's own as it lands.
 */
const { NY, DE } = vi.hoisted(() => ({
  NY: { issuer: 'New York State Department of Motor Vehicles', card: { name: 'Non-driver ID card', fee: { currency: 'USD', minor: 1400 }, validYears: 8 } },
  DE: { issuer: 'Fahrerlaubnisbehörde', licence: { name: 'Führerschein Klasse B', from: 18, fee: null, validYears: 15 } },
}));
vi.mock('../../../src/papers/licence/licence.json', () => ({ default: { 'US.NY': NY, DE, AT: { issuedBy: 'DE' } } }));

describe('the licences', () => {
  it("are each office's own", () => {
    expect(licenceAt({ country: 'US', region: 'US.NY' })).toEqual(NY);
    expect(licenceAt({ country: 'DE', region: 'DE.16' })).toEqual(DE);
    expect(licenceAt({ country: 'DE', region: '' })).toEqual(DE);
    expect(licenceAt({ country: 'AT', region: 'AT.09' })).toEqual(DE);
    expect(licenceAt({ country: 'AT', region: '' })).toEqual(DE);
    expect(licenceAt({ country: 'US', region: 'US.NJ' })).toBeUndefined();
    expect(licenceAt({ country: 'US', region: '' })).toBeUndefined();
    expect(licenceAt({ country: 'LY', region: 'LY.77' })).toBeUndefined();
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('licence.unkept');
    // A country whose regions issue their own is told by the region; one not, and a place in no region, by the country.
    expect(aboutLicence({ country: 'US', region: 'US.NJ' })).toBe(t(UNKEPT_LINE, { place: 'New Jersey' }));
    expect(aboutLicence({ country: 'US', region: '' })).toBe(t(UNKEPT_LINE, { place: 'United States' }));
    expect(aboutLicence({ country: 'LY', region: 'LY.77' })).toBe(t(UNKEPT_LINE, { place: 'Libya' }));
    expect([aboutLicence({ country: 'US', region: 'US.NY' }), aboutLicence({ country: 'AT', region: '' })]).toEqual([undefined, undefined]);
  });
});
