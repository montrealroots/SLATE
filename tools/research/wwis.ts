import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Reads the climate of every city in the WMO's World Weather Information Service (worldweather.wmo.int), whose
 * figures each Member's national meteorological service supplies: for each city, its station, its coordinates, the
 * Member and its service, and for each month the mean daily maximum and minimum temperature, the rainfall and the rain
 * days, with the periods they cover and how a rain day is defined. Kept whole, with the page and the date read, as the
 * source the weather's stations take what the WMO's normals lack.
 */
export const LIST = 'https://worldweather.wmo.int/en/json/full_city_list.txt';
export const urlFor = (id: string) => `https://worldweather.wmo.int/en/json/${id}_en.json`;
export const OUTPUT = 'research/sources/wwis-climate.json';

/** The list's cities: country, city and id on each line after the header; its last line says when it was updated. */
export function listRows(text: string): [string, string, string][] {
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(';').map((f) => f.replace(/^"|"$/g, '')))
    .filter((f): f is [string, string, string] => f.length === 3 && /^\d+$/.test(f[2] as string));
}

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    if (res?.ok === true) return res.text();
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'wwis.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  // Each city's page is kept as it's read, so a run that's stopped picks up where it left off.
  const cache = process.env['WWIS_CACHE'] ?? join(tmpdir(), `wwis-${read}`);
  mkdirSync(cache, { recursive: true });
  const rows = listRows(await get(LIST));
  const pages = new Map<string, string>();
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < rows.length) {
        const id = (rows[next++] as [string, string, string])[2];
        const file = join(cache, `${id}.json`);
        if (!existsSync(file)) writeFileSync(file, await get(urlFor(id)));
        pages.set(id, readFileSync(file, 'utf8'));
      }
    }),
  );
  const cities = rows.map(([country, city, id]) => {
    const { forecast: _forecast, ...rest } = (JSON.parse(pages.get(id) as string) as { city: Record<string, unknown> }).city;
    return { listCountry: country, listCity: city, ...rest };
  });
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'WMO World Weather Information Service', list: LIST, url: 'https://worldweather.wmo.int/en/json/{cityId}_en.json', read, cities })}\n`);
  console.log(`${cities.length} cities -> ${OUTPUT}`);
}
