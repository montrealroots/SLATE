import { describe, expect, it } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/papers/passports/passports.json';
import { aboutPassports, FEE_UNKNOWN_LINE, keepsPassports, offerGaps, passportIssuer, passportOffers, TIME_UNKNOWN_LINE, UNKEPT_LINE, VALIDITY_UNKNOWN_LINE, type Offer } from '../../../src/papers/passports/passports.ts';

/** An offer as the player meets it, in a few words: the route, the fee in minor units, the validity, the pages. */
const brief = (offers: Offer[] | undefined) => offers?.map((o) => [o.route.id, o.fee === null ? null : o.fee.minor, o.validYears, o.pages]);

describe('the passports', () => {
  it("are each office's own, by age, route and month", () => {
    expect(COUNTRY_CODES.filter(keepsPassports)).toEqual(Object.keys(data).sort());
    expect(keepsPassports('SK')).toBe(true);
    expect(keepsPassports('KP')).toBe(false);
    expect(passportOffers('KP', { age: 30, month: 1 })).toBeUndefined();
    // Slovakia: four routes in the office's order, the band by age (16 and over; 6 to 15; under 6).
    const sk = passportOffers('SK', { age: 30, month: 5 });
    expect(sk?.[0]).toStrictEqual({ route: { id: 'standard', where: 'home', speed: 'standard', within: { n: 30, unit: 'day' } }, fee: money('EUR', 5000), validYears: 10 });
    expect(brief(sk)).toEqual([['standard', 5000, 10, undefined], ['urgent-10', 10000, 10, undefined], ['urgent-2', 15000, 10, undefined], ['abroad', 6000, 10, undefined]]);
    expect(sk?.[3]?.route).toEqual({ id: 'abroad', where: 'abroad', speed: 'standard', within: null });
    expect(brief(passportOffers('SK', { age: 16, month: 5 }))?.[0]).toEqual(['standard', 5000, 10, undefined]);
    expect(brief(passportOffers('SK', { age: 15, month: 5 }))?.[0]).toEqual(['standard', 2000, 5, undefined]);
    expect(brief(passportOffers('SK', { age: 6, month: 5 }))?.[0]).toEqual(['standard', 2000, 5, undefined]);
    expect(brief(passportOffers('SK', { age: 5, month: 5 }))?.[0]).toEqual(['standard', 1200, 2, undefined]);
    expect(brief(passportOffers('SK', { age: 0, month: 5 }))?.[0]).toEqual(['standard', 1200, 2, undefined]);
    // Malta: the fee from 16 is seasonal; under 16 it isn't.
    expect(brief(passportOffers('MT', { age: 40, month: 4 }))).toEqual([['normal-summer', 8000, 10, undefined], ['urgent', 16000, 10, undefined]]);
    expect(brief(passportOffers('MT', { age: 40, month: 8 }))?.[0]).toEqual(['normal-summer', 8000, 10, undefined]);
    expect(brief(passportOffers('MT', { age: 40, month: 3 }))).toEqual([['normal-winter', 7000, 10, undefined], ['urgent', 16000, 10, undefined]]);
    expect(brief(passportOffers('MT', { age: 40, month: 9 }))?.[0]).toEqual(['normal-winter', 7000, 10, undefined]);
    expect(brief(passportOffers('MT', { age: 12, month: 6 }))).toEqual([['normal', 4000, 5, undefined], ['urgent', 8000, 5, undefined]]);
    // Guatemala: an adult chooses five or ten years, at home or abroad; a minor has five.
    expect(brief(passportOffers('GT', { age: 18, month: 1 }))).toEqual([['home', 5000, 5, undefined], ['home', 8500, 10, undefined], ['abroad', 6500, 5, undefined], ['abroad', 10000, 10, undefined]]);
    expect(brief(passportOffers('GT', { age: 17, month: 1 }))).toEqual([['home', 5000, 5, undefined], ['abroad', 6500, 5, undefined]]);
    // The Maldives: the electronic passport in 32 or 48 pages from 10 to 65, the non-electronic one under 10 and from 66.
    expect(passportOffers('MV', { age: 65, month: 1 })?.[0]?.pages).toBe(32);
    expect(brief(passportOffers('MV', { age: 65, month: 1 }))).toEqual([['electronic', 100000, 5, 32], ['electronic', 150000, 5, 48]]);
    expect(brief(passportOffers('MV', { age: 66, month: 1 }))).toEqual([['non-electronic', 60000, 5, 32]]);
    expect(brief(passportOffers('MV', { age: 9, month: 1 }))).toEqual([['non-electronic', 60000, 5, 32]]);
    // A fee the game doesn't know (Serbia's urgent issue), a validity it doesn't (Ecuador's), in currencies without minor units.
    expect(brief(passportOffers('RS', { age: 30, month: 1 }))).toEqual([['police', 450000, 10, undefined], ['urgent', null, 10, undefined], ['mission', null, 10, undefined]]);
    expect(passportOffers('IS', { age: 30, month: 1 })?.[0]?.fee).toEqual(money('ISK', 19000));
    expect(brief(passportOffers('EC', { age: 30, month: 1 }))).toEqual([['agency', 9000, null, undefined]]);
    // A territory's people hold another country's passport: Guam's the United States' in full, French Guiana's France's at the fee in Guyane or abroad.
    expect(passportOffers('GU', { age: 30, month: 1 })).toStrictEqual(passportOffers('US', { age: 30, month: 1 }));
    expect(brief(passportOffers('GF', { age: 30, month: 1 }))).toEqual([['guyane', 4300, 10, undefined], ['abroad', 9600, 10, undefined]]);
    expect([passportIssuer('GU'), passportIssuer('GF'), passportIssuer('US'), passportIssuer('KP')]).toEqual(['US', 'FR', 'US', undefined]);
  });

  it("tell the player what the game doesn't know", () => {
    expect([UNKEPT_LINE, FEE_UNKNOWN_LINE, VALIDITY_UNKNOWN_LINE, TIME_UNKNOWN_LINE]).toEqual(['passports.unkept', 'passports.fee-unknown', 'passports.validity-unknown', 'passports.time-unknown']);
    expect(aboutPassports('KP')).toBe(t(UNKEPT_LINE, { country: 'North Korea' }));
    expect(aboutPassports('KP')).toBe("What a passport from North Korea costs, how long it takes to get and how long it lasts aren't known to this game yet.");
    expect(aboutPassports('SK')).toBeUndefined();
    const [standard, , , abroad] = passportOffers('SK', { age: 30, month: 1 }) ?? [];
    expect(offerGaps(standard as Offer)).toEqual([]);
    expect(offerGaps(abroad as Offer)).toEqual(['How long this takes isn\'t known to this game yet.']);
    expect(offerGaps(passportOffers('EC', { age: 30, month: 1 })?.[0] as Offer)).toEqual([t(VALIDITY_UNKNOWN_LINE)]);
    const mission = passportOffers('RS', { age: 30, month: 1 })?.[2] as Offer;
    expect(offerGaps(mission)).toEqual([t(FEE_UNKNOWN_LINE)]);
    expect(offerGaps({ ...mission, validYears: null, route: { ...mission.route, within: null } })).toEqual(["What this costs isn't known to this game yet.", "How long this passport lasts isn't known to this game yet.", t(TIME_UNKNOWN_LINE)]);
  });
});
