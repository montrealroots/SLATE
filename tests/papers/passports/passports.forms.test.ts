import { describe, expect, it, vi } from 'vitest';
import { money } from '../../../src/core/money/money.ts';
import { passportCardName, passportCardOffers, passportOffers, routesFor, type Offer, type Route } from '../../../src/papers/passports/passports.ts';

/**
 * The forms of 2026-10-30 (renewal and replacement routes, fees abroad in the missions' currency, the passport card),
 * read from a compiled file of the form's shape: no research file carries them yet, so the engine's reads are held
 * here on one, and on the real files once the research gives them.
 */
vi.mock('../../../src/papers/passports/passports.json', () => {
  const r = (id: string, more: object = {}) => ({ id, where: 'home', speed: 'standard', within: null, ...more });
  return {
    default: {
      US: {
        currency: 'USD',
        abroad: { currency: 'EUR' },
        routes: [r('in-person'), r('expedited', { speed: 'urgent' }), r('renew', { renewal: true }), r('lost', { replacement: true }), r('mission', { where: 'abroad' })],
        bands: [
          { from: 16, validYears: 10, pay: { 'in-person': 16500, expedited: 22500, renew: 13000, lost: 16500, mission: 15000 } },
          { under: 16, validYears: 5, pay: { 'in-person': 13500 } },
        ],
        card: { name: 'passport card', bands: [{ from: 16, validYears: 10, pay: { 'in-person': 6500, renew: 3000 } }, { under: 16, validYears: 5, pay: { 'in-person': 5000 } }] },
      },
      GU: { issuedBy: 'US' },
      PR: { issuedBy: 'US', onlyRoutes: ['in-person', 'renew'] },
      SK: { currency: 'EUR', routes: [r('standard'), r('abroad', { where: 'abroad' }), r('lost', { replacement: true, months: [6] })], bands: [{ validYears: 10, pay: { standard: 5000, abroad: 6000, lost: 9000 } }] },
    },
  };
});

const brief = (offers: Offer[] | undefined) => offers?.map((o) => [o.route.id, o.fee?.currency, o.fee?.minor, o.validYears]);

describe('the passports, renewed, replaced, paid abroad and as a card', () => {
  it('offer a first issue the ordinary routes, a renewal or a replacement its own where the office has one', () => {
    expect(brief(passportOffers('US', { age: 30, month: 1 }))).toEqual([['in-person', 'USD', 16500, 10], ['expedited', 'USD', 22500, 10], ['mission', 'EUR', 15000, 10]]);
    expect(passportOffers('US', { age: 30, month: 1 })?.[2]?.fee).toEqual(money('EUR', 15000));
    expect(brief(passportOffers('US', { age: 30, month: 1, need: 'renewal' }))).toEqual([['renew', 'USD', 13000, 10]]);
    expect(brief(passportOffers('US', { age: 30, month: 1, need: 'replacement' }))).toEqual([['lost', 'USD', 16500, 10]]);
    // A renewal a band doesn't pay for isn't offered: a child renews nothing by mail.
    expect(brief(passportOffers('US', { age: 10, month: 1, need: 'renewal' }))).toEqual([]);
    expect(passportOffers('US', { age: 10, month: 1, need: 'renewal' })).toEqual([]);
    // Slovakia has no renewal route, so a holder renews by the ordinary ones; its replacement route is June's only, so out of June a lost passport is replaced by them too.
    expect(brief(passportOffers('SK', { age: 30, month: 1, need: 'renewal' }))).toEqual([['standard', 'EUR', 5000, 10], ['abroad', 'EUR', 6000, 10]]);
    expect(brief(passportOffers('SK', { age: 30, month: 1, need: 'replacement' }))).toEqual([['standard', 'EUR', 5000, 10], ['abroad', 'EUR', 6000, 10]]);
    expect(brief(passportOffers('SK', { age: 30, month: 6, need: 'replacement' }))).toEqual([['lost', 'EUR', 9000, 10]]);
    // A territory open to some of the issuer's routes: Puerto Rico's renews by the issuer's own route, replaces by the ordinary one.
    expect(brief(passportOffers('PR', { age: 30, month: 1, need: 'renewal' }))).toEqual([['renew', 'USD', 13000, 10]]);
    expect(brief(passportOffers('PR', { age: 30, month: 1, need: 'replacement' }))).toEqual([['in-person', 'USD', 16500, 10]]);
    expect(passportOffers('KP', { age: 30, month: 1, need: 'renewal' })).toBeUndefined();
  });

  it('keep the routes open to what an application is for', () => {
    const r = (id: string, more: Partial<Route> = {}): Route => ({ id, where: 'home', speed: 'standard', within: null, ...more });
    const routes = [r('a'), r('renew', { renewal: true }), r('lost', { replacement: true })];
    expect(routesFor(routes, undefined).map((x) => x.id)).toEqual(['a']);
    expect(routesFor(routes, 'renewal').map((x) => x.id)).toEqual(['renew']);
    expect(routesFor(routes, 'replacement').map((x) => x.id)).toEqual(['lost']);
    expect(routesFor([r('a'), r('b')], 'renewal').map((x) => x.id)).toEqual(['a', 'b']);
    expect(routesFor([r('a'), r('lost', { replacement: true })], 'renewal').map((x) => x.id)).toEqual(['a']);
    expect(routesFor([r('a'), r('renew', { renewal: true })], 'replacement').map((x) => x.id)).toEqual(['a']);
  });

  it('offer the passport card where the issuer issues one, by the same routes', () => {
    expect([passportCardName('US'), passportCardName('GU'), passportCardName('SK'), passportCardName('KP')]).toEqual(['passport card', 'passport card', undefined, undefined]);
    expect(brief(passportCardOffers('US', { age: 30, month: 1 }))).toEqual([['in-person', 'USD', 6500, 10]]);
    expect(brief(passportCardOffers('US', { age: 30, month: 1, need: 'renewal' }))).toEqual([['renew', 'USD', 3000, 10]]);
    expect(brief(passportCardOffers('US', { age: 15, month: 1 }))).toEqual([['in-person', 'USD', 5000, 5]]);
    expect(passportCardOffers('GU', { age: 30, month: 1 })).toStrictEqual(passportCardOffers('US', { age: 30, month: 1 }));
    expect(passportCardOffers('SK', { age: 30, month: 1 })).toEqual([]);
    expect(passportCardOffers('KP', { age: 30, month: 1 })).toBeUndefined();
  });
});
