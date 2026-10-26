import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads NOAA NCEI's Global Historical Climatology Network daily (GHCN-Daily) records of the stations of the countries
 * whose published normals lack a month's maximum or minimum temperature, precipitation or days of at least 1 mm: each
 * station's file of daily observations as NCEI serves it, kept for 1991 to 2020 (the days the normals are computed
 * from: each day's date and its precipitation, maximum and minimum temperature, each with its flags, the fields of a day split by semicolons), with the hash of
 * the whole file read, its place from the file's own columns, and the date read. Each station's country is the one its
 * GHCN identifier names (the first two letters, FIPS 10-4 as ghcnd-countries.txt lists them).
 */
export const STATIONS = [
  { id: 'BC000068032', country: 'BW' },
  { id: 'BC008382520', country: 'BW' },
  { id: 'BC008948490', country: 'BW' },
  { id: 'BC012192590', country: 'BW' },
  { id: 'BCM00068030', country: 'BW' },
  { id: 'FKM00088889', country: 'FK' },
  { id: 'KU000405820', country: 'KW' },
  { id: 'KUM00040570', country: 'KW' },
  { id: 'KUM00040572', country: 'KW' },
  { id: 'KUM00040586', country: 'KW' },
  { id: 'LEE00147734', country: 'LB' },
  { id: 'LEM00040100', country: 'LB' },
  { id: 'LEM00040101', country: 'LB' },
  { id: 'LEM00040103', country: 'LB' },
  { id: 'WZ004455110', country: 'SZ' },
  { id: 'NEM00091824', country: 'NU' },
  { id: 'NH000091554', country: 'VU' },
  { id: 'NH000091568', country: 'VU' },
  { id: 'NHM00091551', country: 'VU' },
  { id: 'NHM00091555', country: 'VU' },
  { id: 'NHM00091557', country: 'VU' },
  { id: 'NHM00091565', country: 'VU' },
  { id: 'NSM00081225', country: 'SR' },
  { id: 'PC000919640', country: 'PN' },
  { id: 'SXM00088903', country: 'GS' },
] as const;
export const fileUrl = (id: string) => `https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/${id}.csv`;
export const FROM = '1991-01-01';
export const TO = '2020-12-31';
export const COLUMNS = ['DATE', 'PRCP', 'PRCP_ATTRIBUTES', 'TMAX', 'TMAX_ATTRIBUTES', 'TMIN', 'TMIN_ATTRIBUTES'] as const;
export const OUTPUT = 'research/sources/ghcnd-daily.json';

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt += 1) {
    const body = await fetch(url, { signal: AbortSignal.timeout(120_000) })
      .then(async (res) => (res.ok ? res.text() : undefined))
      .catch(() => undefined);
    if (body !== undefined) return body;
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

/** One line of NCEI's CSV: its quoted fields, each unquoted. */
const fields = (line: string) => [...line.matchAll(/"([^"]*)"|(?<=^|,)(?=,|$)/g)].map((m) => m[1] ?? '');

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'ghcnd.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const stations = [];
  for (const s of STATIONS) {
    const csv = await get(fileUrl(s.id));
    const [head, ...lines] = csv.split('\n').filter((l) => l !== '');
    const names = fields(head as string);
    const rows = lines.map(fields).filter((f) => (f[1] as string) >= FROM && (f[1] as string) <= TO);
    const first = rows[0] as string[];
    const at = (row: string[], c: string) => (names.includes(c) ? (row[names.indexOf(c)] as string).trim() : '');
    stations.push({
      ...s,
      sha256: createHash('sha256').update(csv).digest('hex'),
      name: at(first, 'NAME'),
      latitude: Number(at(first, 'LATITUDE')),
      longitude: Number(at(first, 'LONGITUDE')),
      elevation: Number(at(first, 'ELEVATION')),
      days: rows.map((r) => COLUMNS.map((c) => at(r, c)).join(';')).join('\n'),
    });
  }
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'NOAA NCEI, Global Historical Climatology Network daily (GHCN-Daily)', url: fileUrl('{id}'), read, from: FROM, to: TO, columns: COLUMNS, stations })}\n`);
  console.log(`${stations.length} stations -> ${OUTPUT}`);
}
