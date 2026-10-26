import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads sunrise and sunset from the U.S. Naval Observatory's Astronomical Applications API (aa.usno.navy.mil, the
 * "rstt/oneday" service, times in UT) over a grid: every ten-degree band of latitude from 85°S to 85°N, six dates from
 * 1926 to 2099 (the solstices and equinoxes of 2026 among them), at longitudes spread round the globe. The answers are
 * kept whole, with the page and the date they were read, as the evidence the sun engine is proven against.
 */
export const LATITUDES = Array.from({ length: 18 }, (_, i) => -85 + i * 10);
export const DATES = ['2026-03-20', '2026-06-21', '2026-09-23', '2026-12-21', '1926-02-14', '2099-08-30'];
export const OUTPUT = 'research/sources/usno-sun.json';

export const longitudeFor = (latIndex: number, dateIndex: number) => ((latIndex * 47 + dateIndex * 61) % 360) - 180;
export const urlFor = (date: string, lat: number, lon: number) => `https://aa.usno.navy.mil/api/rstt/oneday?date=${date}&coords=${lat},${lon}&tz=0`;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'usno-sun.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const observations = [];
  for (const [li, lat] of LATITUDES.entries()) {
    for (const [di, date] of DATES.entries()) {
      const lon = longitudeFor(li, di);
      const url = urlFor(date, lat, lon);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const body = (await res.json()) as { apiversion: string; properties: { data: { sundata: { phen: string; time: string | null }[] } } };
      observations.push({ url, read, date, latitude: lat, longitude: lon, apiversion: body.apiversion, sundata: body.properties.data.sundata });
    }
  }
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'U.S. Naval Observatory, Astronomical Applications API, rstt/oneday', read, observations }, null, 1)}\n`);
  console.log(`${observations.length} observations -> ${OUTPUT}`);
}
