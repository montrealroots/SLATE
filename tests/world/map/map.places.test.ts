import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { markerIn, projectPoint, wholeWorld } from '../../../src/world/map/map.ts';

/**
 * The map, every one of the map's 171,654 places: held by the gate's test run on every commit, and left out of mutation
 * testing (vitest.stryker.config.ts), which reruns the suite for each mutant; the unit tests beside it stand in there.
 */

const S = { width: 2000, height: 1000 };

describe('every place on the map', () => {
  it('is marked on the whole world\'s view, where its coordinates put it', async () => {
    let marked = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const m = markerIn(wholeWorld(S), S, p.latitude, p.longitude);
        expect(m, p.id).toEqual(projectPoint(p.latitude, p.longitude, S));
        marked += 1;
      }
    }
    expect(marked).toBe(171_654);
  }, 120_000);
});
