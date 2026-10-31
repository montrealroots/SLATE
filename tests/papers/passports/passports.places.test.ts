import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutPassports, keepsPassports, passportOffers } from '../../../src/papers/passports/passports.ts';

/**
 * The passports for a citizen of the country of every one of the map's 171,654 places, applying at home as an adult
 * in the month the game opens: held by the gate's test run on every commit, and left out of mutation testing
 * (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('the passports', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const offers = passportOffers(code, { age: 30, month: 1 });
      const kept = keepsPassports(code);
      for (const p of await placesOf(code)) {
        expect(offers === undefined, p.id).toBe(!kept);
        // A kept country offers an adult at least one way to get its passport; one not kept says so.
        expect(kept ? (offers?.length ?? 0) > 0 : aboutPassports(p.country) !== undefined, p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
