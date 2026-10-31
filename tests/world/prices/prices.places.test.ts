import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, currencyOf, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutPrices, keepsPrices, priceIn } from '../../../src/world/prices/prices.ts';

/**
 * The prices, every one of the map's 171,654 places: held by the gate's test run on every commit, and left out of mutation
 * testing (vitest.stryker.config.ts), which reruns the suite for each mutant; the unit tests beside it stand in there.
 */

describe('the prices', () => {
  it('at every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const price = priceIn(p.country, '1');
        expect(price === undefined ? undefined : price.currency, p.id).toBe(keepsPrices(p.country) ? currencyOf(p.country) : undefined);
        expect(aboutPrices(p.country) === undefined, p.id).toBe(keepsPrices(p.country));
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
