import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, currencyOf, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutRate, knowsRate, rateOn } from '../../../src/money/rates/rates.ts';

/**
 * The exchange rate of the money of every one of the map's 171,654 places, on the life's first day: held by the gate's
 * test run on every commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand
 * in there.
 */

describe('rates', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const currency = currencyOf(code);
      for (const p of await placesOf(code)) {
        // A known currency has a rate (North Korea's from 15 January 2026, every other from the first day); otherwise
        // the player is told.
        if (currency !== undefined && knowsRate(currency)) expect(rateOn(currency, '2026-01-15'), p.id).toBeDefined();
        else expect(aboutRate(p.country), p.id).toEqual(expect.any(String));
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
