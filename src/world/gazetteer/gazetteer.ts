import type { CurrencyCode } from '../../core/money/money.ts';
import countries from './countries.json';
import regions from './regions.json';

/**
 * The gazetteer (BUILD-ORDER layer 2, KEEP entries 5 and 19): every country and territory, every first-level
 * region and every populated place on the map, as GeoNames published them on 2026-10-26 (register R-0032 to R-0034;
 * compiled by tools/geonames/). Every engine that reads a place reads it here. A country's places are fetched when
 * someone looks at that country, not with the app.
 */
export type CountryCode = keyof typeof countries;
export const COUNTRY_CODES = Object.keys(countries) as CountryCode[];

export interface Place {
  /** GeoNames' id for it. */
  id: string;
  country: CountryCode;
  name: string;
  /** Its plain-letter spelling, where it differs from its name; otherwise empty. */
  ascii: string;
  /** Its region's key ("US.CA"), or empty where it has none listed. */
  region: string;
  latitude: number;
  longitude: number;
  /** Its IANA time zone, as GeoNames names it. */
  zone: string;
  /** Its population as GeoNames records it; 0 where none is recorded. */
  population: number;
  /** Its height above sea level in metres, or null where none is recorded. */
  elevation: number | null;
}

export function isCountry(code: string): code is CountryCode {
  return Object.hasOwn(countries, code);
}

export const countryName = (code: CountryCode): string => countries[code].name;

/** The currency a country's prices are in (GeoNames', held to ISO 4217's current list), or none for one that has none. */
export function currencyOf(code: CountryCode): CurrencyCode | undefined {
  const c = countries[code].currency;
  return c === '' ? undefined : (c as CurrencyCode);
}

export function regionName(key: string): string | undefined {
  return Object.hasOwn(regions, key) ? regions[key as keyof typeof regions].name : undefined;
}

/** A country's first-level regions, by name (the sort being stable, two of one name keep their codes' order). */
export function regionsOf(code: CountryCode): { key: string; name: string }[] {
  const prefix = `${code}.`;
  const { compare } = new Intl.Collator('en');
  return Object.entries(regions)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, r]) => ({ key, name: r.name }))
    .sort((a, b) => compare(a.name, b.name));
}

/** The compiled files of places, a loader for each, by path. */
export type PlaceFiles = Record<string, () => Promise<string>>;

/** A country's places from its compiled file. */
export function readPlaces(country: CountryCode, text: string): Place[] {
  return text
    .split('\n')
    .filter((l) => l !== '')
    .map((line) => {
      const [id, name, ascii, region, lat, lon, zone, population, elevation] = line.split('\t') as [string, string, string, string, string, string, string, string, string];
      return { id, country, name, ascii, region, latitude: Number(lat), longitude: Number(lon), zone, population: Number(population), elevation: elevation === '' ? null : Number(elevation) };
    });
}

/** The places over a set of files: which countries have any, and each country's, fetched once. */
export function placeIndex(files: PlaceFiles) {
  const fileOf = (code: CountryCode) => `./places/${code}.tsv`;
  const loaded = new Map<CountryCode, Promise<readonly Place[]>>();
  const placesOf = (code: CountryCode): Promise<readonly Place[]> => {
    let p = loaded.get(code);
    if (p === undefined) {
      const load = files[fileOf(code)];
      p = load === undefined ? Promise.resolve([]) : load().then((text) => readPlaces(code, text));
      // A fetch that failed is tried again the next time.
      p.catch(() => loaded.delete(code));
      loaded.set(code, p);
    }
    return p;
  };
  return {
    /** Whether the country has a populated place of its own on the map (six don't: Antarctica, Bouvet Island and the like). */
    hasPlaces: (code: CountryCode): boolean => Object.hasOwn(files, fileOf(code)),
    placesOf,
    /** A place by its country and id. */
    findPlace: async (code: CountryCode, id: string): Promise<Place | undefined> => (await placesOf(code)).find((p) => p.id === id),
  };
}

// Stryker disable next-line all: Vite reads import.meta.glob's arguments as written, at build time, so a mutated one
// isn't a glob at all; the test over every place holds what it loads.
const FILES = import.meta.glob<string>('./places/*.tsv', { query: '?raw', import: 'default' });
let shared: ReturnType<typeof placeIndex> | undefined;
const index = () => (shared ??= placeIndex(FILES));

export const hasPlaces = (code: CountryCode): boolean => index().hasPlaces(code);
export const placesOf = (code: CountryCode): Promise<readonly Place[]> => index().placesOf(code);
export const findPlace = (code: CountryCode, id: string): Promise<Place | undefined> => index().findPlace(code, id);

/** Text as the search compares it: no accents, no case, and hyphens, apostrophes and the like read as spaces. */
export function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The places a search finds, best first: the name itself, then names that start with it, then names with a word
 * that starts with it, then names that hold it; within each, the larger place first, then by name. A place matches
 * by its name or its plain-letter spelling. An empty search lists them all, largest first; a region narrows it.
 */
export function search(places: readonly Place[], query: string, region?: string): Place[] {
  const q = fold(query);
  const { compare } = new Intl.Collator('en');
  const rank = (p: Place): number => {
    if (q === '') return 0;
    // An empty plain spelling matches no search that isn't empty, so it needs no case of its own.
    const names = [p.name, p.ascii].map(fold);
    if (names.includes(q)) return 0;
    if (names.some((n) => n.startsWith(q))) return 1;
    if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) return 2;
    return names.some((n) => n.includes(q)) ? 3 : 4;
  };
  return places
    .filter((p) => region === undefined || p.region === region)
    .map((p) => ({ p, r: rank(p) }))
    .filter((x) => x.r < 4)
    .sort((a, b) => a.r - b.r || b.p.population - a.p.population || compare(a.p.name, b.p.name) || Number(a.p.id) - Number(b.p.id))
    .map((x) => x.p);
}
