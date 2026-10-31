import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { indexStations, loadStations, sourcesFor, weatherOn } from '../../../src/world/weather/weather.ts';

/**
 * The weather, every one of the map's 171,654 places: held by the gate's test run on every commit, and left out of mutation
 * testing (vitest.stryker.config.ts), which reruns the suite for each mutant; the unit tests beside it stand in there.
 */

const SEED = '0123456789abcdef';

describe('the weather at real towns', () => {
  it('at every place on the map', async () => {
    const index = indexStations(await loadStations());
    let read = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const s = sourcesFor(p, index);
        const w = weatherOn(SEED, p, s, { year: 2026, month: 8, day: 24 });
        expect(Number.isFinite(w.high) && Number.isFinite(w.low) && w.precipitation >= 0, p.id).toBe(true);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 300_000);
});
