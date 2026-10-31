import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutCredit, creditIn, keepsCredit } from '../../../src/money/credit/credit.ts';

/**
 * The credit records of the country of every one of the map's 171,654 places: held by the gate's test run on every commit, and
 * left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('credit', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const credit = creditIn(code);
      for (const p of await placesOf(code)) {
        // A kept country has its record keeping; otherwise the player is told.
        if (keepsCredit(code)) expect(credit, p.id).toBeDefined();
        else expect([credit, aboutCredit(p.country)], p.id).toEqual([undefined, expect.any(String)]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
