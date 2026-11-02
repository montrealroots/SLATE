import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutWork, keepsWork, work } from '../../../src/papers/work/work.ts';
import { aboutPermit, permitOf } from '../../../src/person/permits/permits.ts';

/**
 * The work permit of the country of every one of the map's 171,654 places: held by the gate's test run on every
 * commit, and left out of mutation testing (vitest.stryker.config.ts); the unit tests beside it stand in there.
 */

describe('the permits', () => {
  it('for every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      const needed = keepsWork(code) && COUNTRY_CODES.some((p) => { const w = work(p, code); return w !== 'home' && w?.right === 'permit'; });
      const permit = permitOf(code);
      const told = aboutPermit(code);
      for (const p of await placesOf(code)) {
        // A permit known whole where one is needed, or the player told what of it isn't known; none where none is needed;
        // where papers.work keeps no rules, its own line tells the player.
        if (!keepsWork(p.country)) expect([permit, told, typeof aboutWork(p.country)], p.id).toEqual([undefined, undefined, 'string']);
        else if (!needed) expect([permit, told], p.id).toEqual([undefined, undefined]);
        else expect(permit?.unknown.length === 0 ? told === undefined : typeof told === 'string', p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
