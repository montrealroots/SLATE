import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads Taiwan's normals from its Central Weather Administration: the monthly means of 1991-2020 of each of its
 * staffed stations (Climate Statistics, Monthly Mean: the mean daily maximum and minimum temperature, the precipitation,
 * the days with at least 0.1 mm and the sunshine), and the list of those stations with their place and height (the
 * CWA's open data, C-B0074-001, as data.gov.tw publishes its link). Kept whole, each page as published, with the date read.
 */
export const ITEMS = ['meantxmax', 'meantxmin', 'precp', 'precpday', 'sunshine'] as const;
export const itemUrl = (item: string) => `https://www.cwa.gov.tw/V8/E/C/Statistics/MonthlyMean/MOD/Taiwan_${item}.html`;
export const STATIONS = 'https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/C-B0074-001?Authorization=rdec-key-123-45678-011121314&format=JSON';
export const OUTPUT = 'research/sources/cwa-normals.json';

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    if (res?.ok === true) return res.text();
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'cwa.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const items: Record<string, string> = {};
  for (const item of ITEMS) items[item] = await get(itemUrl(item));
  const stations = JSON.parse(await get(STATIONS)) as unknown;
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Central Weather Administration (Taiwan), Climate Statistics: Monthly Mean', items: Object.fromEntries(ITEMS.map((i) => [i, itemUrl(i)])), stationsUrl: STATIONS, read, pages: items, stations })}\n`);
  console.log(`${ITEMS.length} tables and the station list -> ${OUTPUT}`);
}
