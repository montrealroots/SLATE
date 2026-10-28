import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/papers/ids/ids.json';
import { aboutIds, COMPULSORY_UNKNOWN_LINE, FEE_UNKNOWN_LINE, idDocument, idIssuer, idOfferGaps, idOffers, keepsIds, NONE_LINE, TIME_UNKNOWN_LINE, UNKEPT_LINE, VALIDITY_UNKNOWN_LINE } from '../../../src/papers/ids/ids.ts';
import type { Offer } from '../../../src/papers/passports/passports.ts';

/** An offer as the player meets it, in a few words: the route, the fee in minor units, the validity. */
const brief = (offers: Offer[] | undefined) => offers?.map((o) => [o.route.id, o.fee === null ? null : o.fee.minor, o.validYears]);

describe('the identity documents', () => {
  it("are each country's own, by age and route", () => {
    expect(COUNTRY_CODES.filter(keepsIds)).toEqual(Object.keys(data).sort());
    expect(keepsIds('DE')).toBe(true);
    expect(keepsIds('KP')).toBe(false);
    expect([idOffers('KP', 30), idDocument('KP'), idIssuer('KP')]).toEqual([undefined, undefined, undefined]);
    // Germany: compulsory from 16; ten years from 24, six under; at home or at a mission abroad, which costs more.
    expect(idDocument('DE')).toStrictEqual({ name: 'Personalausweis', compulsory: { from: 16 } });
    const de = idOffers('DE', 30);
    expect(de?.[0]).toStrictEqual({ route: { id: 'home', where: 'home', speed: 'standard', within: null }, fee: money('EUR', 4600), validYears: 10 });
    expect(brief(de)).toEqual([['home', 4600, 10], ['abroad', 8900, 10]]);
    expect(brief(idOffers('DE', 24))).toEqual([['home', 4600, 10], ['abroad', 8900, 10]]);
    expect(brief(idOffers('DE', 23))).toEqual([['home', 2760, 6], ['abroad', 7060, 6]]);
    expect(brief(idOffers('DE', 0))).toEqual([['home', 2760, 6], ['abroad', 7060, 6]]);
    // France: not compulsory, free at any age, at home or abroad, ten years; Guyane's people hold France's.
    expect(idDocument('FR')).toStrictEqual({ name: "carte nationale d'identité", compulsory: false });
    expect(brief(idOffers('FR', 5))).toEqual([['home', 0, 10], ['abroad', 0, 10]]);
    expect(idOffers('GF', 40)).toStrictEqual(idOffers('FR', 40));
    expect(idDocument('GF')).toStrictEqual(idDocument('FR'));
    // The United Kingdom and the United States issue none; Guam's people are the United States', so hold none.
    expect([idDocument('GB'), idDocument('US'), idDocument('GU')]).toEqual(['none', 'none', 'none']);
    expect([idOffers('GB', 30), idOffers('US', 30), idOffers('GU', 30)]).toEqual([[], [], []]);
    expect([idIssuer('GU'), idIssuer('US'), idIssuer('DE'), idIssuer('GF')]).toEqual(['US', 'US', 'DE', 'FR']);
  });

  it("tell the player what the game doesn't know", () => {
    expect([UNKEPT_LINE, NONE_LINE, COMPULSORY_UNKNOWN_LINE, FEE_UNKNOWN_LINE, VALIDITY_UNKNOWN_LINE, TIME_UNKNOWN_LINE]).toEqual(['ids.unkept', 'ids.none', 'ids.compulsory-unknown', 'ids.fee-unknown', 'ids.validity-unknown', 'ids.time-unknown']);
    expect(aboutIds('KP')).toBe(t(UNKEPT_LINE, { country: 'North Korea' }));
    expect(aboutIds('KP')).toBe("Whether North Korea issues an identity card, and what one costs, aren't known to this game yet.");
    expect(aboutIds('GB')).toBe('United Kingdom issues no national identity card.');
    expect(aboutIds('GU')).toBe(t(NONE_LINE, { country: 'Guam' }));
    expect([aboutIds('DE'), aboutIds('FR'), aboutIds('GF')]).toEqual([undefined, undefined, undefined]);
    const home = idOffers('DE', 30)?.[0] as Offer;
    expect(idOfferGaps(home)).toEqual([t(TIME_UNKNOWN_LINE)]);
    expect(idOfferGaps({ ...home, route: { ...home.route, within: { n: 3, unit: 'week' } } })).toEqual([]);
    expect(idOfferGaps({ ...home, fee: null, validYears: null })).toEqual([t(FEE_UNKNOWN_LINE), t(VALIDITY_UNKNOWN_LINE), t(TIME_UNKNOWN_LINE)]);
  });
});
