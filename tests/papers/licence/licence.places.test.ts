import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutLicence, licenceAt } from '../../../src/papers/licence/licence.ts';

/**
 * The licence and card of the office of every one of the map's 171,654 places: held by the gate's test run on every
 * commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('the licences', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const at = licenceAt(p);
        // An office kept issues a licence or a card; a place whose office isn't kept says so.
        expect(at !== undefined ? at.licence !== undefined || at.card !== undefined : aboutLicence(p) !== undefined, p.id).toBe(true);
        expect(at === undefined || aboutLicence(p) === undefined, p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
