import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Reads the date of Easter for each year from 2000 from two churches' reckonings as they are published: the Western,
 * to 2150, from the U.S. Naval Observatory's Selected Christian Observances (a page a year), and the Orthodox, to 2037,
 * the last it shows, from the American Carpatho-Russian Orthodox Diocese's (Ecumenical Patriarchate) Listing of
 * Movable Feasts (a page of four years). Kept as each year's date as the page gives it ("April 5", "Apr 12"), with
 * the date read.
 */
export const FIRST = 2000;
export const LAST = 2150;
/** The Diocese's page shows no year after 2037 ("unable to display information for any date in 2038 or later"). */
export const ORTHODOX_LAST = 2037;
export const usnoUrl = (year: number) => `https://aa.usno.navy.mil/calculated/observances/christian?year=${year}`;
export const acrodUrl = (year: number) => `https://www.acrod.org/prayercorner/movablefeasts/?pc_year=${year}`;
export const OUTPUT = 'research/sources/easter.json';

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

const text = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'easter.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const western: Record<string, string> = {};
  const orthodox: Record<string, string> = {};
  for (let year = FIRST; year <= LAST; year += 1) {
    const line = /Easter ([A-Z][a-z]+ \d+)/.exec(text(await get(usnoUrl(year))))?.[1];
    if (line === undefined) throw new Error(`${year}: no Easter in the Observatory's page`);
    western[year] = line;
  }
  for (let year = FIRST; year <= ORTHODOX_LAST; year += 4) {
    const page = text(await get(acrodUrl(year)));
    const years = /Holy Pascha &amp; Other Movable Feasts\s*((?:\d{4}\s*)+)Triodion|Holy Pascha & Other Movable Feasts\s*((?:\d{4}\s*)+)Triodion/.exec(page);
    const row = /Pascha \/ Easter ((?:[A-Z][a-z]{2} \d{2}\s*)+)/.exec(page);
    if (years === null || row === null) throw new Error(`${year}: no Pascha in the Diocese's page`);
    const ys = ((years[1] ?? years[2]) as string).trim().split(/\s+/);
    const ds = (row[1] as string).trim().match(/[A-Z][a-z]{2} \d{2}/g) as string[];
    ys.forEach((y, i) => {
      if (Number(y) <= ORTHODOX_LAST) orthodox[y] = ds[i] as string;
    });
  }
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: { western: 'U.S. Naval Observatory, Selected Christian Observances', orthodox: 'American Carpatho-Russian Orthodox Diocese of North America, Listing of Movable Feasts' }, url: { western: usnoUrl(0).replace('0', '{year}'), orthodox: acrodUrl(0).replace('0', '{year}') }, read, western, orthodox })}\n`);
  console.log(`${Object.keys(western).length} Western and ${Object.keys(orthodox).length} Orthodox Easters -> ${OUTPUT}`);
}
