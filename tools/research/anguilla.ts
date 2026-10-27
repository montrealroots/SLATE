import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readZip } from '../geonames/zip.ts';

/**
 * Reads the Anguilla Statistics Department's climate statistics (its workbook 3.1.1 Climate Statistics, from the
 * Meteorological Office at Clayton J. Lloyd International Airport): the rainfall tables, each month's rainfall in
 * inches for each year from 1973. Kept as each table's cells as the workbook gives them (a formula's cell by the value
 * the workbook holds for it), with the hash of the workbook read and the date read.
 */
export const URL = 'https://statistics.gov.ai/AllDocuments/3.1.1%20Climate%20Statistics.xlsx';
export const PAGE = 'https://statistics.gov.ai/StatisticsDept/Climate3_1_1';
export const TABLES = /^Table 3\.1\.1-R\d$/;
export const OUTPUT = 'research/sources/anguilla-climate.json';

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

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** A workbook's sheets by name, each as rows of cells from column A ('' where a cell is empty). */
export function sheets(xlsx: Buffer): Map<string, string[][]> {
  const files = readZip(xlsx);
  const text = (name: string) => (files.get(name) as Buffer).toString('utf8');
  const strings = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unescape([...(m[1] as string).matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('')));
  const targets = new Map([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1] as string, `xl/${m[2] as string}`]));
  const out = new Map<string, string[][]>();
  for (const m of text('xl/workbook.xml').matchAll(/<sheet name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const rows: string[][] = [];
    for (const c of text(targets.get(m[2] as string) as string).matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const v = /<v>([^<]*)<\/v>/.exec(c[4] ?? '')?.[1];
      if (v === undefined) continue;
      const col = [...(c[1] as string)].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const row = (rows[Number(c[2]) - 1] ??= []);
      row[col] = / t="s"/.test(c[3] as string) ? (strings[Number(v)] as string) : unescape(v);
    }
    out.set(unescape(m[1] as string), Array.from(rows, (r) => Array.from(r ?? [], (cell) => cell ?? '')));
  }
  return out;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'anguilla.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const xlsx = await get(URL);
  const tables = Object.fromEntries([...sheets(xlsx)].filter(([name]) => TABLES.test(name)));
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Anguilla Statistics Department, 3.1.1 Climate Statistics (source: Clayton J. Lloyd International Airport)', url: URL, page: PAGE, read, sha256: createHash('sha256').update(xlsx).digest('hex'), tables })}\n`);
  console.log(`${Object.keys(tables).length} tables -> ${OUTPUT}`);
}
