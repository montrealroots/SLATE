import { describe, expect, it, vi } from 'vitest';
import { idOffers, idTravel, mustHoldId, type IdOffer } from '../../../src/papers/ids/ids.ts';

/**
 * The forms of 2026-10-30 (the age a card must be held from, the youngest it's issued at, where it travels, its renewal
 * and replacement routes), read from a compiled file of the form's shape: no research file carries them yet.
 */
vi.mock('../../../src/papers/ids/ids.json', () => {
  const r = (id: string, more: object = {}) => ({ id, where: 'home', speed: 'standard', within: null, ...more });
  return {
    default: {
      DE: { document: 'Personalausweis', currency: 'EUR', routes: [r('home'), r('renew', { renewal: true }), r('lost', { replacement: true })], bands: [{ validYears: 10, pay: { home: 4600, renew: 3700, lost: 5000 } }], must: 16, travel: ['EU/EEA', 'CH'] },
      MX: { document: 'credencial para votar', currency: 'MXN', routes: [r('home')], bands: [{ validYears: 10, pay: { home: 0 } }], from: 18 },
      FR: { document: "carte nationale d'identité", currency: 'EUR', routes: [r('home')], bands: [{ validYears: 10, pay: { home: 0 } }] },
      GB: { none: true },
      GF: { issuedBy: 'FR' },
      AT: { issuedBy: 'DE' },
    },
  };
});

const brief = (offers: IdOffer[] | undefined) => offers?.map((o) => [o.route.id, o.fee?.minor]);

describe('the identity documents, held, travelled on, renewed and replaced', () => {
  it('are offered from the youngest age they are issued at, for a first issue, a renewal or a replacement', () => {
    expect(idOffers('MX', 17)).toEqual([]);
    expect(brief(idOffers('MX', 18))).toEqual([['home', 0]]);
    expect(brief(idOffers('FR', 0))).toEqual([['home', 0]]);
    expect(brief(idOffers('DE', 30))).toEqual([['home', 4600]]);
    expect(brief(idOffers('DE', 30, 'renewal'))).toEqual([['renew', 3700]]);
    expect(brief(idOffers('DE', 30, 'replacement'))).toEqual([['lost', 5000]]);
    expect(brief(idOffers('FR', 30, 'renewal'))).toEqual([['home', 0]]);
    expect(idOffers('GB', 30, 'renewal')).toEqual([]);
    expect(idOffers('KP', 30, 'renewal')).toBeUndefined();
  });

  it('must be held from the age the law sets, where it sets one', () => {
    expect([mustHoldId('DE', 15), mustHoldId('DE', 16), mustHoldId('DE', 70), mustHoldId('AT', 16)]).toEqual([false, true, true, true]);
    expect([mustHoldId('MX', 30), mustHoldId('FR', 30), mustHoldId('GF', 30), mustHoldId('GB', 30), mustHoldId('KP', 30)]).toEqual([false, false, false, false, undefined]);
  });

  it('serve as a travel document where the research names', () => {
    expect([idTravel('DE'), idTravel('AT'), idTravel('FR'), idTravel('GF'), idTravel('GB'), idTravel('KP')]).toEqual([['EU/EEA', 'CH'], ['EU/EEA', 'CH'], [], [], [], undefined]);
  });
});
