import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutResidence, keepsResidence, needsNoPermit, residenceRoutes } from '../../../src/papers/residence/residence.ts';

/**
 * The residence routes of the country of every one of the map's 171,654 places: held by the gate's test run on every
 * commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('the residence permissions', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const routes = residenceRoutes(code);
      const kept = keepsResidence(code);
      for (const p of await placesOf(code)) {
        expect(routes === undefined, p.id).toBe(!kept);
        // A country kept offers at least one route, or needs no permit at all; one not kept says so.
        expect(routes !== undefined ? routes.length > 0 || needsNoPermit(code) === true : aboutResidence(p.country) !== undefined, p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
