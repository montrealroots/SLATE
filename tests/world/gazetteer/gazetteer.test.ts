import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalZone, instantOf, localTime } from '../../../src/core/time/time.ts';
import { daylight } from '../../../src/core/time/sun.ts';
import {
  COUNTRY_CODES,
  countryName,
  currencyOf,
  findPlace,
  fold,
  hasPlaces,
  isCountry,
  placeIndex,
  placesOf,
  readPlaces,
  regionName,
  regionsOf,
  search,
  type CountryCode,
  type Place,
} from '../../../src/world/gazetteer/gazetteer.ts';

import { isCurrency } from '../../../src/core/money/money.ts';

const ROOT = join(import.meta.dirname, '../../..');
const place = (over: Partial<Place>): Place => ({ id: '1', country: 'FR', name: 'Ville', ascii: '', region: '', latitude: 0, longitude: 0, zone: 'Europe/Paris', population: 0, elevation: null, ...over });

describe('countries and regions', () => {
  it('are GeoNames\' 252, by their ISO codes, with their names', () => {
    expect(COUNTRY_CODES).toHaveLength(252);
    expect([countryName('US'), countryName('CI'), countryName('XK')]).toEqual(['United States', 'Ivory Coast', 'Kosovo']);
    expect(['US', 'XK', 'AN', 'CS'].every(isCountry)).toBe(true);
    expect(['us', 'USA', 'ZZ', 'toString', ''].some(isCountry)).toBe(false);
  });
  it('give each country with places the currency its prices are in, and none to one without', () => {
    expect([currencyOf('US'), currencyOf('BG'), currencyOf('SV'), currencyOf('BT'), currencyOf('XK'), currencyOf('AQ'), currencyOf('AN')]).toEqual(['USD', 'EUR', 'USD', 'BTN', 'EUR', undefined, undefined]);
    expect(COUNTRY_CODES.filter((c) => hasPlaces(c) && currencyOf(c) === undefined)).toEqual([]);
    expect(COUNTRY_CODES.every((c) => currencyOf(c) === undefined || isCurrency(currencyOf(c) as string))).toBe(true);
  });
  it('list a country\'s regions by name, and name each', () => {
    const us = regionsOf('US');
    expect(us).toHaveLength(51);
    expect(us.slice(0, 3)).toEqual([{ key: 'US.AL', name: 'Alabama' }, { key: 'US.AK', name: 'Alaska' }, { key: 'US.AZ', name: 'Arizona' }]);
    expect(us.map((r) => r.name)).toContain('District of Columbia');
    expect(regionsOf('AQ')).toEqual([]);
    expect(regionsOf('FR').map((r) => r.name)).toEqual([...regionsOf('FR').map((r) => r.name)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    expect([regionName('US.CA'), regionName('FR.11'), regionName('US.ZZ'), regionName('toString')]).toEqual(['California', 'Île-de-France', undefined, undefined]);
  });
});

describe('places', () => {
  it('are fetched a country at a time, once', async () => {
    const us = await placesOf('US');
    expect(us).toHaveLength(17_343);
    expect(placesOf('US')).toBe(placesOf('US'));
    expect(us[0]).toEqual({ id: '4046255', country: 'US', name: 'Bay Minette', ascii: '', region: 'US.AL', latitude: 30.88296, longitude: -87.77305, zone: 'America/Chicago', population: 9118, elevation: 85 });
    expect(await findPlace('US', '5128581')).toMatchObject({ name: 'New York City', region: 'US.NY', zone: 'America/New_York' });
    expect(await findPlace('US', '0')).toBeUndefined();
  });
  it('are none in the six countries with no populated place of their own', async () => {
    for (const code of ['AN', 'AQ', 'BV', 'CS', 'HM', 'UM'] as CountryCode[]) {
      expect(hasPlaces(code)).toBe(false);
      expect(await placesOf(code)).toEqual([]);
    }
    expect(COUNTRY_CODES.filter(hasPlaces)).toHaveLength(246);
  });
  it('read from their file, field by field', () => {
    expect(readPlaces('FR', '3\tÉvry\tEvry\tFR.11\t48.6\t2.45\tEurope/Paris\t52000\t84\n\n4\tX\t\t\t-1.5\t-2\tEurope/Paris\t0\t\n5\tY\t\t\t0\t0\tEurope/Paris\t0\t-7\n')).toEqual([
      { id: '3', country: 'FR', name: 'Évry', ascii: 'Evry', region: 'FR.11', latitude: 48.6, longitude: 2.45, zone: 'Europe/Paris', population: 52_000, elevation: 84 },
      { id: '4', country: 'FR', name: 'X', ascii: '', region: '', latitude: -1.5, longitude: -2, zone: 'Europe/Paris', population: 0, elevation: null },
      { id: '5', country: 'FR', name: 'Y', ascii: '', region: '', latitude: 0, longitude: 0, zone: 'Europe/Paris', population: 0, elevation: -7 },
    ]);
  });
  it('a fetch that fails is tried again', async () => {
    let calls = 0;
    const index = placeIndex({ './places/FR.tsv': () => (calls += 1) === 1 ? Promise.reject(new Error('offline')) : Promise.resolve('9\tA\t\t\t1\t2\tEurope/Paris\t5\t\n') });
    await expect(index.placesOf('FR')).rejects.toThrow('offline');
    expect(await index.placesOf('FR')).toEqual([place({ id: '9', name: 'A', latitude: 1, longitude: 2, population: 5 })]);
    expect(calls).toBe(2);
    expect(await index.placesOf('DE')).toEqual([]);
    expect([index.hasPlaces('FR'), index.hasPlaces('DE')]).toEqual([true, false]);
    expect(await index.findPlace('FR', '9')).toMatchObject({ name: 'A' });
  });
});

describe('the town search', () => {
  it('compares without accents, case or punctuation', () => {
    expect(fold('a - b')).toBe('a b');
    expect([fold('Saint-Étienne'), fold("L'Haÿ-les-Roses"), fold('  ÅLAND  '), fold('São Paulo'), fold('Ørsta')]).toEqual(['saint etienne', 'l hay les roses', 'aland', 'sao paulo', 'ørsta']);
  });
  it('ranks the name itself, then names starting with it, then a word starting with it, then names holding it; larger first within each', () => {
    const places = [
      place({ id: '1', name: 'Port Paris', population: 50 }),
      place({ id: '2', name: 'Paris', population: 10 }),
      place({ id: '3', name: 'Parisot', population: 100 }),
      place({ id: '4', name: 'Comparisons', population: 999 }),
      place({ id: '5', name: 'Lyon', population: 9999 }),
      place({ id: '6', name: 'Parisville', population: 100 }),
      place({ id: '7', name: 'Pärïs', population: 5 }),
    ];
    expect(search(places, 'paris').map((p) => p.id)).toEqual(['2', '7', '3', '6', '1', '4']);
    expect(search(places, '').map((p) => p.id)).toEqual(['5', '4', '3', '6', '1', '2', '7']);
    expect(search(places, 'xyz')).toEqual([]);
    // A smaller name that starts with it comes before a larger one with a word that does, and that before one only holding it.
    const tiers = [place({ id: '1', name: 'Port Parisien', population: 50 }), place({ id: '2', name: 'Parisot', population: 1 }), place({ id: '3', name: 'Aparisb', population: 900 })];
    expect(search(tiers, 'paris').map((p) => p.id)).toEqual(['2', '1', '3']);
    // An empty search lists everything largest first, a place with a plain spelling no different.
    expect(search([place({ id: '1', name: 'Évry', ascii: 'Evry', population: 2 }), place({ id: '2', name: 'Lyon', population: 1 })], '').map((p) => p.id)).toEqual(['1', '2']);
  });
  it('finds a place by its plain-letter spelling too, and narrows to a region', () => {
    const places = [place({ id: '1', name: 'Zürich', ascii: 'Zurich', region: 'CH.ZH' }), place({ id: '2', name: 'Zurich Lake', region: 'CH.SZ', population: 1 })];
    expect(search(places, 'Zurich').map((p) => p.id)).toEqual(['1', '2']);
    expect(search(places, 'zur', 'CH.SZ').map((p) => p.id)).toEqual(['2']);
    // Either spelling serves at every tier, and the better of the two counts.
    const spelt = [place({ id: '1', name: 'X Øb', ascii: 'X Ob', population: 1 }), place({ id: '2', name: 'Yøbz', population: 100 }), place({ id: '3', name: 'Aøb', ascii: 'Aob', population: 0 })];
    expect(search(spelt, 'øb').map((p) => p.id)).toEqual(['1', '2', '3']);
    expect(search([place({ id: '1', name: 'Øster', ascii: 'Oster' }), place({ id: '2', name: 'Ostend', population: 5 })], 'oster').map((p) => p.id)).toEqual(['1']);
    expect(search([place({ id: '1', name: 'Zz Øster', ascii: 'Zz Oster', population: 1 }), place({ id: '2', name: 'Aosterb', population: 9 })], 'oster').map((p) => p.id)).toEqual(['1', '2']);
    expect(search(places, '', 'CH.XX')).toEqual([]);
    const same = [place({ id: '20', name: 'B' }), place({ id: '10', name: 'B' }), place({ id: '30', name: 'a' })];
    expect(search(same, '').map((p) => p.id)).toEqual(['30', '10', '20']);
  });
  it('finds real towns in real countries', async () => {
    const fr = await placesOf('FR');
    expect(search(fr, 'saint etienne')[0]?.name).toBe('Saint-Étienne');
    expect(search(await placesOf('US'), 'new york')[0]?.name).toBe('New York City');
    expect(search(await placesOf('JP'), 'tokyo')[0]?.zone).toBe('Asia/Tokyo');
  });
});

describe('every place on the map', () => {
  it('is in its country, with a region of that country or none, coordinates on the globe, and a time zone the clock and the sun answer for', async () => {
    const ids: string[] = [];
    const solstice = (zone: string) => instantOf(zone, { year: 2026, month: 6, day: 21 }, 0).instant;
    let checked = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        ids.push(p.id);
        expect(p.country).toBe(code);
        if (p.region !== '') expect(p.region.startsWith(`${code}.`) && regionName(p.region) !== undefined, p.id).toBe(true);
        expect(Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180, p.id).toBe(true);
        expect(Number.isSafeInteger(p.population) && p.population >= 0, p.id).toBe(true);
        expect(p.elevation === null || (Number.isSafeInteger(p.elevation) && p.elevation > -500 && p.elevation < 6000), p.id).toBe(true);
        expect(canonicalZone(p.zone), `${p.id} ${p.zone}`).toBeDefined();
        const start = solstice(p.zone);
        const end = instantOf(p.zone, { year: 2026, month: 6, day: 22 }, 0).instant;
        expect(localTime(p.zone, start).date, p.id).toEqual({ year: 2026, month: 6, day: 21 });
        const d = daylight(start, end, p.latitude, p.longitude);
        expect(d.sunrise !== undefined || d.sunset !== undefined || d.polar !== undefined, p.id).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBe(171_654);
    expect(ids).toEqual(JSON.parse(readFileSync(join(ROOT, 'src/world/gazetteer/place-ids.json'), 'utf8')));
  }, 120_000);
});
