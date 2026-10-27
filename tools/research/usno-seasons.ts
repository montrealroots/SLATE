import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads the equinoxes and solstices from the U.S. Naval Observatory's Astronomical Applications API
 * (aa.usno.navy.mil, the "seasons" service, times in UT to the minute) for every year from 1800, where the game's
 * clock begins, to 2100, the last year the service gives. The answers are kept whole, with the page and the date they
 * were read, as the source the clock's seasons are compiled from.
 */
export const FIRST = 1800;
export const LAST = 2100;
export const OUTPUT = 'research/sources/usno-seasons.json';
export const urlFor = (year: number) => `https://aa.usno.navy.mil/api/seasons?year=${year}`;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'usno-seasons.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const years: Record<string, { phenom: string; year: number; month: number; day: number; time: string }[]> = {};
  let apiversion = '';
  for (let year = FIRST; year <= LAST; year += 1) {
    let body: { apiversion: string; data: { phenom: string; year: number; month: number; day: number; time: string }[] } | undefined;
    for (let attempt = 0; body === undefined; attempt += 1) {
      const res = await fetch(urlFor(year)).catch(() => undefined);
      if (res?.ok === true) body = (await res.json()) as typeof body;
      else if (attempt === 4) throw new Error(`${urlFor(year)}: no answer`);
      else await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
    apiversion = (body as { apiversion: string }).apiversion;
    years[String(year)] = (body as { data: { phenom: string; year: number; month: number; day: number; time: string }[] }).data.filter((d) => d.phenom === 'Equinox' || d.phenom === 'Solstice');
  }
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'U.S. Naval Observatory, Astronomical Applications API, seasons', url: 'https://aa.usno.navy.mil/api/seasons?year=YYYY', read, apiversion, tz: 0, years }, null, 1)}\n`);
  console.log(`${LAST - FIRST + 1} years -> ${OUTPUT}`);
}
