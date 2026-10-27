import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Reads Météo-France's climatological fiches (Fiches climatologiques: each station's 1991-2020 statistics, its mean
 * daily maximum and minimum temperature, precipitation, days with at least 1 mm and sunshine) for every station
 * Météo-France lists in the overseas departments and territories and abroad (Andorra, Monaco), where the WMO's normals
 * lack them. The station lists are Météo-France's own (meteo.data.gouv.fr), the fiches its public-data portal's. Kept
 * whole, each fiche as published, with the date read.
 */
export const LISTS = ['971', '972', '973', '974', '975', '984', '985', '986', '987', '988', '99'];
export const listUrl = (d: string) => `https://object.files.data.gouv.fr/meteofrance/data/stations/stations_${d}.geojson`;
export const ficheUrl = (id: string) => `https://donneespubliques.meteofrance.fr/FichesClim/FICHECLIM_${id}.data`;
export const OUTPUT = 'research/sources/meteofrance-fiches.json';

/** The text of a page, or null where there's none (a 404, or a redirect away to the portal); anything else is tried again. */
async function get(url: string): Promise<string | null> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
    if (res?.ok === true) return res.text();
    if (res !== undefined && (res.status === 404 || (res.status >= 300 && res.status < 400))) return null;
    if (attempt === 4) throw new Error(`${url}: no answer`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'meteofrance.ts')) {
  const read = new Date().toISOString().slice(0, 10);
  const cache = process.env['MF_CACHE'] ?? join(tmpdir(), `meteofrance-${read}`);
  mkdirSync(cache, { recursive: true });
  const stations: { list: string; properties: Record<string, unknown>; coordinates: unknown }[] = [];
  for (const d of LISTS) {
    const text = await get(listUrl(d));
    if (text === null) throw new Error(`${listUrl(d)}: not found`);
    for (const f of (JSON.parse(text) as { features: { properties: Record<string, unknown>; geometry: { coordinates: unknown } }[] }).features) {
      stations.push({ list: d, properties: f.properties, coordinates: f.geometry.coordinates });
    }
  }
  const fiches = new Map<string, string | null>();
  let next = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < stations.length) {
        const id = String((stations[next++] as (typeof stations)[number]).properties['NUM_POSTE']);
        const file = join(cache, `${id}.data`);
        const none = join(cache, `${id}.none`);
        if (!existsSync(file) && !existsSync(none)) {
          const text = await get(ficheUrl(id));
          if (text === null) writeFileSync(none, '');
          else writeFileSync(file, text);
        }
        // A station with no fiche is answered with the portal's own page, not a 404.
        const text = existsSync(file) ? readFileSync(file, 'utf8') : null;
        fiches.set(id, text?.startsWith('FICHE CLIMATOLOGIQUE') === true ? text : null);
      }
    }),
  );
  const out = stations.map((s) => ({ ...s, fiche: fiches.get(String(s.properties['NUM_POSTE'])) ?? null }));
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), `${JSON.stringify({ source: 'Météo-France, Fiches climatologiques', lists: LISTS.map(listUrl), url: ficheUrl('{NUM_POSTE}'), read, stations: out })}\n`);
  console.log(`${out.length} stations, ${out.filter((s) => s.fiche !== null).length} with a fiche -> ${OUTPUT}`);
}
