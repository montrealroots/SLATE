import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalZone, instantOf, localTime } from '../../../src/core/time/time.ts';
import { daylight } from '../../../src/core/time/sun.ts';
import { COUNTRY_CODES, placesOf, regionName } from '../../../src/world/gazetteer/gazetteer.ts';

/**
 * The gazetteer, every one of the map's 171,654 places: held by the gate's test run on every commit, and left out of mutation
 * testing (vitest.stryker.config.ts), which reruns the suite for each mutant; the unit tests beside it stand in there.
 */

const ROOT = join(import.meta.dirname, '../../..');

describe('every place on the map', () => {
  it('is in its country, with a region of that country or none, coordinates on the globe, and a time zone the clock and the sun answer for', async () => {
    const ids: string[] = [];
    const solstice = (zone: string) => instantOf(zone, { year: 2026, month: 6, day: 21 }, 0).instant;
    let checked = 0;
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        ids.push(p.id);
        expect(p.country).toBe(code);
        if (p.region !== '') expect(p.region.startsWith(`${code}.`) && regionName(p.region) !== undefined, p.id).toBe(true);
        expect(Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180, p.id).toBe(true);
        expect(Number.isSafeInteger(p.population) && p.population >= 0, p.id).toBe(true);
        expect(p.elevation === null || (Number.isSafeInteger(p.elevation) && p.elevation > -500 && p.elevation < 6000), p.id).toBe(true);
        expect(canonicalZone(p.zone), `${p.id} ${p.zone}`).toBeDefined();
        const start = solstice(p.zone);
        const end = instantOf(p.zone, { year: 2026, month: 6, day: 22 }, 0).instant;
        expect(localTime(p.zone, start).date, p.id).toEqual({ year: 2026, month: 6, day: 21 });
        const d = daylight(start, end, p.latitude, p.longitude);
        expect(d.sunrise !== undefined || d.sunset !== undefined || d.polar !== undefined, p.id).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBe(171_654);
    expect(ids).toEqual(JSON.parse(readFileSync(join(ROOT, 'src/world/gazetteer/place-ids.json'), 'utf8')));
  }, 120_000);
});
