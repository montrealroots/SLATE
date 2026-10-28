import { describe, expect, it } from 'vitest';
import { civilFromDays } from '../../../src/core/time/calendar.ts';
import { COUNTRY_CODES, placesOf } from '../../../src/world/gazetteer/gazetteer.ts';
import { aboutHolidays, holidaysOf, keepsHolidays } from '../../../src/world/holidays/holidays.ts';

/**
 * The holidays, every one of the map's 171,654 places: held by the gate's test run on every commit, and left out of mutation
 * testing (vitest.stryker.config.ts), which reruns the suite for each mutant; the unit tests beside it stand in there.
 */

describe('the holidays', () => {
  it('at every place on the map', async () => {
    let read = 0;
    const seen = new Map<string, string>();
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const key = `${p.country} ${p.region}`;
        if (!seen.has(key)) {
          const hs = holidaysOf(p.country, 2026, p.region === '' ? undefined : p.region);
          // Ukraine's martial law makes 2026 a year without days off (its law's come back after): its rules still give days.
          const none = p.country === 'UA';
          expect(keepsHolidays(p.country) && !none ? hs.length > 0 : hs.length === 0, key).toBe(true);
          if (none) expect(holidaysOf(p.country, 2027).length, key).toBeGreaterThan(0);
          expect(hs.every((h) => civilFromDays(h.day).year === 2026), key).toBe(true);
          expect(aboutHolidays(p.country, 2026) === undefined, key).toBe(keepsHolidays(p.country));
          seen.set(key, hs.map((h) => h.name).join());
        }
        read += 1;
      }
    }
    expect(read).toBe(171_654);
    // Each region of a country with regional holidays keeps its own and the country's.
    expect(seen.get('CH CH.ZH')).not.toBe(seen.get('CH CH.TI'));
  }, 300_000);
});
