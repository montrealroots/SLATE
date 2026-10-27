import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads the Hong Kong Observatory's Gregorian-Lunar Calendar Conversion Tables, a text table a year ("2027/2/6  1st
 * Lunar Month  Saturday"), from 1999 (the lunar month 2000 begins in) to 2100, the last it publishes. Kept whole, a
 * table a year, with the date read.
 */
export const FIRST = 1999;
export const LAST = 2100;
export const hkoUrl = (year: number) => `https://www.hko.gov.hk/en/gts/time/calendar/text/files/T${year}e.txt`;
export const OUTPUT = 'research/sources/hko-lunar.json';

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const body = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      .then(async (res) => (res.ok ? res.text() : undefined))
      .catch(() => undefined);
    if (body !== undefined) return body;
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'hko.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const tables: Record<string, string> = {};
  for (let year = FIRST; year <= LAST; year += 1) tables[year] = await get(hkoUrl(year));
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Hong Kong Observatory, Gregorian-Lunar Calendar Conversion Table', url: hkoUrl(0).replace('T0', 'T{year}'), read, tables })}\n`);
  console.log(`${Object.keys(tables).length} tables -> ${OUTPUT}`);
}
