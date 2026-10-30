import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutNumbers, keepsNumbers, nationalNumber } from '../../../src/papers/numbers/numbers.ts';

/**
 * The national number of the country of every one of the map's 171,654 places: held by the gate's test run on every
 * commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('the national numbers', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const number = nationalNumber(code);
      const kept = keepsNumbers(code);
      for (const p of await placesOf(code)) {
        expect(number === undefined, p.id).toBe(!kept);
        // A country that gives a number names it; one that gives none, or isn't kept, says so.
        expect(number !== undefined && number !== 'none' ? number.name !== '' : aboutNumbers(p.country) !== undefined, p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
