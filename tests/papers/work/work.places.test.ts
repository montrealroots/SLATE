import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutWork, keepsWork, work } from '../../../src/papers/work/work.ts';

/**
 * What a performer needs to work in the country of every one of the map's 171,654 places: held by the gate's test run
 * on every commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('work', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const kept = keepsWork(code);
      const workers = COUNTRY_CODES.map((from) => work(from, code));
      const native = work(code, code);
      for (const p of await placesOf(code)) {
        // Every passport meets a rule where the rules are kept, and someone born there is home; otherwise the player is told.
        if (kept) {
          expect(workers.includes(undefined), p.id).toBe(false);
          expect(native, p.id).toBe('home');
        } else expect([workers.every((w) => w === undefined || w === 'home'), aboutWork(p.country)], p.id).toEqual([true, expect.any(String)]);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
