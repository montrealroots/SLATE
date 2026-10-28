import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutIds, idDocument, idOffers, keepsIds } from '../../../src/papers/ids/ids.ts';

/**
 * The identity documents for a citizen of the country of every one of the map's 171,654 places, as an adult: held by
 * the gate's test run on every commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests
 * beside it stand in there.
 */

describe('the identity documents', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const offers = idOffers(code, 30);
      const doc = idDocument(code);
      const kept = keepsIds(code);
      for (const p of await placesOf(code)) {
        expect(offers === undefined, p.id).toBe(!kept);
        // A country that issues a document offers an adult at least one way to get it; one that issues none, or isn't kept, says so.
        expect(doc !== undefined && doc !== 'none' ? (offers?.length ?? 0) > 0 : aboutIds(p.country) !== undefined, p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
