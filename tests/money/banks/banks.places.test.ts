import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutBanks, banksIn, keepsBanks } from '../../../src/money/banks/banks.ts';

/**
 * The banks of the country of every one of the map's 171,654 places: held by the gate's test run on every commit, and
 * left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('banks', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const banks = banksIn(code);
      for (const p of await placesOf(code)) {
        // A kept country has a bank to open an account at; otherwise the player is told.
        if (keepsBanks(code)) expect(banks.length, p.id).toBeGreaterThan(0);
        else expect([banks, aboutBanks(p.country)], p.id).toEqual([[], expect.any(String)]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
