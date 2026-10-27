import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads the Met Office's location-specific long-term averages for its climate stations in the Channel Islands, whose
 * own services' published averages the WMO's sets lack: each station's page (the monthly maximum and minimum
 * temperature, sunshine, rainfall and days of rainfall of at least 1 mm, by climate period) and its place from the
 * page's list of stations. Kept whole, each page as published, with the date read.
 */
export const STATIONS = [
  { geohash: 'gby1hyu4q', country: 'GG' },
  { geohash: 'gby6tx9ek', country: 'GG' },
  { geohash: 'gbwryn0cm', country: 'JE' },
] as const;
export const pageUrl = (geohash: string) => `https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages/${geohash}`;
export const OUTPUT = 'research/sources/metoffice-averages.json';

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    if (res?.ok === true) return res.text();
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'metoffice.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const pages = [];
  for (const s of STATIONS) {
    const html = await get(pageUrl(s.geohash));
    // The station's own entry in the page's list: its name and place.
    const entry = new RegExp(`\\{"name":"([^"]*)","latitude":([-0-9.]+),"longitude":([-0-9.]+),"geohash":"${s.geohash}"`).exec(html);
    if (entry === null) throw new Error(`${s.geohash}: not in the page's list of stations`);
    // Only the station's own tables of averages, from its first heading to the national averages after them.
    const from = html.indexOf('Station:');
    const to = html.indexOf('Climate period:', html.indexOf('Climate period:', from) + 1);
    pages.push({ ...s, name: entry[1], latitude: Number(entry[2]), longitude: Number(entry[3]), tables: html.slice(from, to) });
  }
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Met Office, Location-specific long-term averages', url: pageUrl('{geohash}'), read, stations: pages })}\n`);
  console.log(`${pages.length} stations -> ${OUTPUT}`);
}
