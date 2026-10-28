import { describe, expect, it } from 'vitest';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { reading } from '../../../src/world/clock/clock.ts';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';

/**
 * The clock, every one of the map's 171,654 places: held by the gate's test run on every commit, and left out of mutation
 * testing (vitest.stryker.config.ts), which reruns the suite for each mutant; the unit tests beside it stand in there.
 */

const T0 = daysFromCivil(2026, 10, 26) * 86_400 + 12 * 3600;

describe('what the clock shows', () => {
  it('at every place on the map', async () => {
    let read = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const r = reading(T0, p);
        expect(r.local.date.year, p.id).toBe(2026);
        expect(['spring', 'summer', 'autumn', 'winter']).toContain(r.season);
        read += 1;
      }
    }
    expect(read).toBe(171_654);
  }, 180_000);
});
