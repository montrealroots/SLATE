import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutVisits, keepsVisits, visit } from '../../../src/papers/visits/visits.ts';

/**
 * What a visitor needs for the country of every one of the map's 171,654 places: held by the gate's test run on every
 * commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('visits', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const kept = keepsVisits(code);
      const visitors = COUNTRY_CODES.map((from) => visit(from, code));
      const native = visit(code, code);
      for (const p of await placesOf(code)) {
        // Every passport meets a rule where the list is kept, and someone born there is home; otherwise the player is told.
        if (kept) {
          expect(visitors.includes(undefined), p.id).toBe(false);
          expect(native, p.id).toBe('home');
        } else expect([visitors.every((v) => v === undefined || v === 'home'), aboutVisits(p.country)], p.id).toEqual([true, expect.any(String)]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
