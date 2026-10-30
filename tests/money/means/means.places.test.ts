import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutMeans, meansOf } from '../../../src/money/means/means.ts';

/**
 * What a family of the country of every one of the map's 171,654 places gives on the first morning: held by the gate's
 * test run on every commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand
 * in there.
 */

describe('means', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const m = meansOf(code, 'modest');
      for (const p of await placesOf(code)) {
        // A known country gives each family's means; otherwise the player is told.
        if (m !== undefined) expect([m.checking.minor >= 0, m.savings.minor >= 0, aboutMeans(p.country)], p.id).toEqual([true, true, undefined]);
        else expect(aboutMeans(p.country), p.id).toEqual(expect.any(String));
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
