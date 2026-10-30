import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { money } from '../../../src/core/money/money.ts';
import { aboutLicence, feeOn, licenceAt, termFeeOn, UNKEPT_LINE } from '../../../src/papers/licence/licence.ts';

/**
 * No office's research was written when the engine was built (2026-10-30), so its reads are held here on a few
 * entries in the compiled form; the test is rewritten on the research's own as it lands.
 */
const { NY, DE } = vi.hoisted(() => ({
  NY: { issuer: 'New York State Department of Motor Vehicles', card: { name: 'Non-driver ID card', fee: { currency: 'USD', minor: 1400 }, validYears: 8 } },
  DE: { issuer: 'Fahrerlaubnisbehörde', licence: { name: 'Führerschein Klasse B', from: 18, fee: null, validYears: 15 } },
}));
vi.mock('../../../src/papers/licence/licence.json', () => ({ default: { 'US.NY': NY, DE, AT: { issuedBy: 'DE' }, CX: { issuedBy: 'US.NY' } } }));

describe('the licences', () => {
  it('charge a fee as it stands, or a count of an index unit at its value on the day, with what the office adds', () => {
    expect(feeOn(money('EUR', 1000), '2026-10-30')).toStrictEqual(money('EUR', 1000));
    expect([feeOn(null, '2026-10-30'), feeOn(undefined, '2026-10-30')]).toEqual([undefined, undefined]);
    // Nayarit's 8.5 UMA in 2026 and in 2025; Cerro Largo's 1.25 UR with its $333 of stamps.
    expect(feeOn({ count: '8.5', unit: 'UMA' }, '2026-10-30')).toStrictEqual(money('MXN', 99_714));
    expect(feeOn({ count: '8.5', unit: 'UMA' }, '2025-06-01')).toStrictEqual(money('MXN', 96_169));
    expect(feeOn({ count: '1.25', unit: 'UR', plus: money('UYU', 33_300) }, '2026-10-30')).toStrictEqual(money('UYU', 275_896));
    // Before a unit's first value, or a unit the game doesn't hold, the fee isn't known.
    expect([feeOn({ count: '1', unit: 'UR', plus: money('UYU', 100) }, '2023-01-01'), feeOn({ count: '1', unit: 'UF' }, '2026-10-30')]).toEqual([undefined, undefined]);
  });

  it("charge a term its fee, a non-citizen's where it differs, times its years where it's by the year", () => {
    const usd = (minor: number) => money('USD', minor);
    expect(termFeeOn({ years: 8, fee: usd(400), perYear: true }, '2026-10-30')).toStrictEqual(usd(3200));
    expect(termFeeOn({ years: 8, fee: usd(6000) }, '2026-10-30')).toStrictEqual(usd(6000));
    expect(termFeeOn({ years: 10, fee: usd(20_000), foreignFee: usd(75_000) }, '2026-10-30', true)).toStrictEqual(usd(75_000));
    expect(termFeeOn({ years: 10, fee: usd(20_000), foreignFee: usd(75_000) }, '2026-10-30')).toStrictEqual(usd(20_000));
    expect(termFeeOn({ years: 10, fee: usd(20_000) }, '2026-10-30', true)).toStrictEqual(usd(20_000));
    expect(termFeeOn({ years: 3, fee: { count: '2', unit: 'UMA' }, perYear: true }, '2026-10-30')).toStrictEqual(money('MXN', 70_386));
    expect(termFeeOn({ years: 3, fee: { count: '2', unit: 'UF' }, perYear: true }, '2026-10-30')).toBeUndefined();
  });

  it("are each office's own", () => {
    expect(licenceAt({ country: 'US', region: 'US.NY' })).toEqual(NY);
    expect(licenceAt({ country: 'DE', region: 'DE.16' })).toEqual(DE);
    expect(licenceAt({ country: 'DE', region: '' })).toEqual(DE);
    expect(licenceAt({ country: 'AT', region: 'AT.09' })).toEqual(DE);
    expect(licenceAt({ country: 'AT', region: '' })).toEqual(DE);
    // A territory holding a region's licences takes that region's.
    expect(licenceAt({ country: 'CX', region: '' })).toEqual(NY);
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
