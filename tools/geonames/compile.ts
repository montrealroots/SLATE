import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readZip } from './zip.ts';

/**
 * Compiles the gazetteer from GeoNames' daily dump as published on 2026-10-26 (register R-0032 to R-0034): its 252
 * countries and territories, its first-level subdivisions, and its populated places (cities1000: places of a
 * thousand people or more, and the seats of administrative divisions). The owner chose that release on 2026-10-26.
 * Each file is checked against its pinned SHA-256 before a byte of it is read.
 *
 * What's kept of each place is what the engines read: its name (and its plain-letter spelling, where it differs,
 * for the search), its region, its coordinates (the sun, the weather, the map), its IANA time zone (the clock) and
 * its population (the order the search lists towns in), and its height (the weather's correction for it). The places are written a country to a file, so the app
 * fetches a country's towns only when someone looks at that country.
 */
export const SOURCES = {
  countries: { file: 'vendor/geonames/countryInfo.txt', sha256: 'c55f638cfaafb4fe45a9aa15120a0f1f78e8a34a8e1847d7b9320cf740fbc9ab' },
  regions: { file: 'vendor/geonames/admin1CodesASCII.txt', sha256: '2e4867f5397acb056ea26377601b57af37cb4c81399770225018e9e439e91ad3' },
  places: { file: 'vendor/geonames/cities1000.zip', sha256: '289fa72adcf173bdd3ae23b12f2e4a63d29c096877eb3eba54a595fa26abc73f', entry: 'cities1000.txt' },
} as const;

export const OUT = 'src/world/gazetteer';

export interface Country {
  name: string;
}
export interface Region {
  name: string;
}
/** A place as the compiled file holds it, its fields in this order. */
export interface Place {
  id: string;
  name: string;
  /** Its plain-letter spelling, where it differs from its name; otherwise empty. */
  ascii: string;
  /** Its region's key ("US.CA"), or empty where GeoNames gives it none that's listed. */
  region: string;
  latitude: string;
  longitude: string;
  zone: string;
  population: number;
  /** Metres above sea level: the elevation model's value, or the recorded elevation where the model has none; empty where neither is known. */
  elevation: string;
}

export interface Gazetteer {
  countries: Record<string, Country>;
  regions: Record<string, Region>;
  /** Each country's places, by id; a country with none has no entry. */
  places: Record<string, Place[]>;
}

const lines = (text: string) => text.split('\n').filter((l) => l !== '' && !l.startsWith('#'));

/** countryInfo.txt: ISO, ISO3, ISO-Numeric, fips, Country, Capital, ... (GeoNames' readme and the file's header). */
export function parseCountries(text: string): Record<string, Country> {
  const out: Record<string, Country> = {};
  for (const line of lines(text)) {
    const f = line.split('\t');
    const [code, , , , name] = f;
    if (f.length !== 19 || !/^[A-Z]{2}$/.test(code as string) || !name) throw new Error(`a country line the compiler doesn't know: ${line}`);
    if (Object.hasOwn(out, code as string)) throw new Error(`the country ${code} is listed twice`);
    out[code as string] = { name };
  }
  return out;
}

/** admin1CodesASCII.txt: "CC.code", name, ASCII name, geonameid. */
export function parseRegions(text: string, countries: Record<string, Country>): Record<string, Region> {
  const out: Record<string, Region> = {};
  for (const line of lines(text)) {
    const f = line.split('\t');
    const [key, name] = f;
    const m = /^([A-Z]{2})\.[0-9A-Z]+$/.exec(key as string);
    if (f.length !== 4 || m === null || !name) throw new Error(`a region line the compiler doesn't know: ${line}`);
    if (!Object.hasOwn(countries, m[1] as string)) throw new Error(`the region ${key} is in no listed country`);
    if (Object.hasOwn(out, key as string)) throw new Error(`the region ${key} is listed twice`);
    out[key as string] = { name };
  }
  return out;
}

const COORD = /^-?\d{1,3}(\.\d+)?$/;

/**
 * cities1000.txt, the geoname table's 19 fields: geonameid, name, asciiname, alternatenames, latitude, longitude,
 * feature class, feature code, country code, cc2, admin1 code, admin2, admin3, admin4, population, elevation, dem,
 * timezone, modification date.
 */
export function parsePlaces(text: string, countries: Record<string, Country>, regions: Record<string, Region>): Record<string, Place[]> {
  const out: Record<string, Place[]> = {};
  const seen = new Set<string>();
  for (const line of lines(text)) {
    const f = line.split('\t');
    const [id, name, ascii, , lat, lon, featureClass, , country, , admin1, , , , population, recorded, dem, zone] = f as string[];
    const ok =
      f.length === 19 &&
      /^\d+$/.test(id as string) &&
      name !== '' &&
      featureClass === 'P' &&
      COORD.test(lat as string) &&
      Math.abs(Number(lat)) <= 90 &&
      COORD.test(lon as string) &&
      Math.abs(Number(lon)) <= 180 &&
      /^\d+$/.test(population as string) &&
      /^(-?\d+)?$/.test(recorded as string) &&
      /^-?\d+$/.test(dem as string) &&
      zone !== '';
    if (!ok) throw new Error(`a place line the compiler doesn't know: ${line}`);
    if (!Object.hasOwn(countries, country as string)) throw new Error(`the place ${id} is in no listed country (${country})`);
    if (seen.has(id as string)) throw new Error(`the place ${id} is listed twice`);
    seen.add(id as string);
    const key = `${country}.${admin1}`;
    (out[country as string] ??= []).push({
      id: id as string,
      name: name as string,
      ascii: ascii === name ? '' : (ascii as string),
      region: Object.hasOwn(regions, key) ? key : '',
      latitude: lat as string,
      longitude: lon as string,
      zone: zone as string,
      population: Number(population),
      // The elevation model marks a point it has no value for with -9999 (over water, mostly).
      elevation: dem === '-9999' ? (recorded as string) : (dem as string),
    });
  }
  for (const list of Object.values(out)) list.sort((a, b) => Number(a.id) - Number(b.id));
  return out;
}

function pinned(root: string, file: string, sha256: string): Buffer {
  const bytes = readFileSync(join(root, file));
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== sha256) throw new Error(`${file} is not the file the register cites (sha256 ${sha})`);
  return bytes;
}

/** Reads the pinned dump, refusing any file that isn't the one the register cites. */
export function readGazetteer(root: string): Gazetteer {
  const countries = parseCountries(pinned(root, SOURCES.countries.file, SOURCES.countries.sha256).toString('utf8'));
  const regions = parseRegions(pinned(root, SOURCES.regions.file, SOURCES.regions.sha256).toString('utf8'), countries);
  // The archive is pinned by its hash, and the pinned one holds the entry.
  const text = readZip(pinned(root, SOURCES.places.file, SOURCES.places.sha256)).get(SOURCES.places.entry) as Buffer;
  return { countries, regions, places: parsePlaces(text.toString('utf8'), countries, regions) };
}

const sortedObject = <T>(o: Record<string, T>) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k] as T]));

/** The files written under OUT, by path relative to it: the data the engine reads, and the place axis's index. */
export function serialize(g: Gazetteer): Map<string, string> {
  const files = new Map<string, string>();
  files.set('countries.json', `${JSON.stringify(sortedObject(g.countries), null, 1)}\n`);
  files.set('regions.json', `${JSON.stringify(sortedObject(g.regions), null, 1)}\n`);
  const ids: string[] = [];
  for (const country of Object.keys(g.places).sort()) {
    const rows = (g.places[country] as Place[]).map((p) => {
      ids.push(p.id);
      return [p.id, p.name, p.ascii, p.region, p.latitude, p.longitude, p.zone, String(p.population), p.elevation].join('\t');
    });
    files.set(`places/${country}.tsv`, `${rows.join('\n')}\n`);
  }
  files.set('place-ids.json', `${JSON.stringify(ids)}\n`);
  return files;
}
