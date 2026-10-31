import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutAges, majorityAt, serviceIn, workAge } from '../../../src/papers/ages/ages.ts';

/**
 * The ages of the country of every one of the map's 171,654 places: held by the gate's test run on every commit, and
 * left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('the ages', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const known = workAge(code) !== undefined && serviceIn(code) !== undefined;
      for (const p of await placesOf(code)) {
        // Where all three are known the player is told nothing; otherwise they're told.
        if (known && majorityAt(p) !== undefined) expect(aboutAges(p.country), p.id).toBeUndefined();
        else expect(aboutAges(p.country), p.id).toEqual(expect.any(String));
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
