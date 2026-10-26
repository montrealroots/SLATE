import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Reads the Deutscher Wetterdienst's Klimatafeln (its climate tables of stations abroad: for each, its place and height
 * and each month's mean daily maximum and minimum temperature, precipitation, days with at least 1 mm and daily
 * sunshine, each with the years it covers), every one its index of stations worldwide links, continent by continent,
 * letter by letter, country by country. Kept as each table's text (pdftotext -layout) with the hash of the PDF it was
 * read from, the page that linked it and the date read.
 */
export const SITE = 'https://www.dwd.de';
export const CONTINENTS = ['afrika', 'antarktis', 'asien', 'australien', 'europa', 'namerika', 'samerika'];
export const indexUrl = (continent: string) => `${SITE}/DE/leistungen/klimadatenwelt/${continent}/${continent}_node.html`;
export const OUTPUT = 'research/sources/dwd-klimatafeln.json';

/** A page or file, tried again on any failure, its body included; kept in the cache so a stopped run resumes. */
async function get(url: string, cache: string): Promise<Buffer> {
  const file = join(cache, createHash('sha256').update(url).digest('hex'));
  if (existsSync(file)) return readFileSync(file);
  for (let attempt = 0; ; attempt += 1) {
    const body = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      .then(async (res) => (res.ok ? Buffer.from(await res.arrayBuffer()) : undefined))
      .catch(() => undefined);
    if (body !== undefined) {
      writeFileSync(file, body);
      return body;
    }
    if (attempt === 5) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

/** The links of a page under a path, without their session ids. */
const links = (html: string, under: RegExp) =>
  [...new Set([...html.matchAll(/href="\/?(DE\/leistungen\/klimadatenwelt\/[^"#?;]*)/gi)].map((m) => `${SITE}/${m[1] as string}`))].filter((u) => under.test(u));

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'dwd-klimatafeln.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const cache = process.env['DWD_CACHE'] ?? join(tmpdir(), `dwd-klimatafeln-${read}`);
  mkdirSync(cache, { recursive: true });
  const pages: string[] = [];
  for (const continent of CONTINENTS) {
    const letters = links((await get(indexUrl(continent), cache)).toString('utf8'), new RegExp(`/${continent}/[a-z]+/[a-z]+_node\\.html$`));
    for (const letter of letters) {
      const countries = links((await get(letter, cache)).toString('utf8'), new RegExp(`/${continent}/[a-z]+/[^/]+/[^/]+_node\\.html$`));
      pages.push(...countries);
    }
  }
  const tables: { page: string; url: string; sha256: string; text: string }[] = [];
  for (const page of [...new Set(pages)].sort()) {
    const html = (await get(page, cache)).toString('utf8');
    for (const href of [...new Set([...html.matchAll(/HREF="(\/DWD\/klima\/beratung\/ak\/ak_\d+_kt\.pdf)"/gi)].map((m) => m[1] as string))].sort()) {
      const url = `${SITE}${href}`;
      const file = join(cache, href.split('/').pop() as string);
      if (!existsSync(file)) writeFileSync(file, await get(url, cache));
      const pdf = readFileSync(file);
      const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { encoding: 'utf8' });
      tables.push({ page, url, sha256: createHash('sha256').update(pdf).digest('hex'), text });
    }
  }
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Deutscher Wetterdienst, Klimatafeln (Klimadaten weltweit)', index: CONTINENTS.map(indexUrl), read, tables })}\n`);
  console.log(`${pages.length} country pages, ${tables.length} tables -> ${OUTPUT}`);
}
