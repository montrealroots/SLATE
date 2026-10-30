import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutFormats, accountNumber, keepsFormat, payeeRefusal } from '../../../src/money/formats/formats.ts';

/**
 * The account number at a bank in the country of every one of the map's 171,654 places: held by the gate's test run on
 * every commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('account numbers', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const number = accountNumber(0x5eedn, code, 'A Bank', 0);
      for (const p of await placesOf(code)) {
        // A kept country gives a number that passes its own form; otherwise the player is told.
        if (keepsFormat(code)) expect([typeof number, payeeRefusal(p.country, number as string)], p.id).toEqual(['string', undefined]);
        else expect([number, aboutFormats(p.country)], p.id).toEqual([undefined, expect.any(String)]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
