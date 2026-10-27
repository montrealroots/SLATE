import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Reads the Tonga Meteorological Service's climatological information for its six stations (each a sheet of each
 * month's mean daily maximum and minimum temperature, mean total rainfall and rain days, and the period), as its
 * Climate page links them, and each station's place from the Bureau of Meteorology's list of Pacific stations (its
 * Pacific Climate Change Data Portal's, by WMO number), the sheets not giving one. Kept as each sheet's text
 * (pdftotext -layout) with the hash of the PDF it was read from, the station's entry and the date read.
 */
export const PAGE = 'https://met.gov.to/climate/';
export const sheetUrl = (name: string) => `https://met.gov.to/wp-content/uploads/2023/06/${name}.pdf`;
export const STATIONS_URL = 'https://www.bom.gov.au/cgi-bin/ws/gis/ncc/pidp/picpp?service=WFS&version=1.0.0&request=GetFeature&typeName=PI-STATIONS';
export const SHEETS = [
  { sheet: 'fuaamotu', wmo: '91792' },
  { sheet: 'nukualofa', wmo: '91789' },
  { sheet: 'vavau', wmo: '91779' },
  { sheet: 'haapai', wmo: '91784' },
  { sheet: 'niuafoou', wmo: '91772' },
  { sheet: 'niuatoputapu', wmo: '91776' },
] as const;
export const OUTPUT = 'research/sources/tonga-climate.json';

async function get(url: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt += 1) {
    const body = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      .then(async (res) => (res.ok ? Buffer.from(await res.arrayBuffer()) : undefined))
      .catch(() => undefined);
    if (body !== undefined) return body;
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'tonga.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const list = (await get(STATIONS_URL)).toString('latin1');
  const dir = mkdtempSync(join(tmpdir(), 'tonga-'));
  const sheets = [];
  for (const { sheet, wmo } of SHEETS) {
    const entry = [...list.matchAll(/<ms:PI-STATIONS>([\s\S]*?)<\/ms:PI-STATIONS>/g)].map((m) => m[1] as string).find((e) => e.includes(`<ms:wmo_num>${wmo}</ms:wmo_num>`));
    if (entry === undefined) throw new Error(`${wmo}: not in the Bureau's list of Pacific stations`);
    const field = (name: string) => new RegExp(`<ms:${name}>([^<]*)</ms:${name}>`).exec(entry)?.[1] as string;
    const pdf = await get(sheetUrl(sheet));
    const file = join(dir, `${sheet}.pdf`);
    writeFileSync(file, pdf);
    const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8' });
    sheets.push({ sheet, wmo, url: sheetUrl(sheet), sha256: createHash('sha256').update(pdf).digest('hex'), name: field('name'), latitude: Number(field('latitude')), longitude: Number(field('dlongitude')), text });
  }
  rmSync(dir, { recursive: true });
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Tonga Meteorological Service, Climatological Information', page: PAGE, stationsUrl: STATIONS_URL, read, sheets })}\n`);
  console.log(`${sheets.length} sheets -> ${OUTPUT}`);
}
