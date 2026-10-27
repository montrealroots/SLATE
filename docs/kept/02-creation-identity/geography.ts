/**
 * SLATE — Geography and jurisdictions.
 *
 * Countries, states, metros and cities. The geographic facts (a city's
 * country, its IANA time zone) are public reference data. The economic
 * figures attached to each place — cost-of-living index and median rent — are
 * SLATE's own calibrated estimates and are marked as such, because a precise
 * current rent for a real city is not something this game can verify. The
 * neighborhoods, the airports and a median home price were kept here too
 * until 2026-09-27, and nothing read them.
 */

import { Registry, REFERENCE_VERSION, type ReferenceRecord } from './reference';
import {
  WORLD_COUNTRIES, WORLD_REGIONS, WORLD_CITIES, CITY_COUNTS, TOTAL_CITIES,
  type RawCity,
} from './world-data';

export interface Country extends ReferenceRecord {
  type: 'country';
  iso2: string;
  currency: string;
  /** The currency's name: "Dollar", "Yen", "Pound". */
  currencyName: string;
  /** Path segment used by the jurisdiction resolver. */
  jurisdictionCode: string;
  drivesOn: 'left' | 'right';
  capital: string;
  continent: string;
  /** National population, as GeoNames records it. */
  population: number;
  areaKm2: number;
  /** International dialling code, without the plus. */
  phone: string;
  /** Languages as ISO 639 codes, most spoken first. */
  languages: string;
}

export const CONTINENT_NAMES: Record<string, string> = {
  AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania', AN: 'Antarctica',
};

export interface Region extends ReferenceRecord {
  type: 'region';
  /** State, province or equivalent. */
  code: string;
  parentId: string;
  jurisdictionCode: string;
}

export interface City extends ReferenceRecord {
  type: 'city';
  parentId: string;
  countryId: string;
  timeZone: string;
  latitude: number;
  longitude: number;
  /**
   * On the United States' scale, where a hundred is its price level: a
   * published index for a town set by hand, and for the rest SLATE's estimate
   * from the country's price level and the town's size (`deriveCity`). Drives
   * rent, groceries, services. Until 2026-09-27 this said a hundred was the
   * national average, which neither kind is.
   */
  costOfLivingIndex: number;
  /** Median monthly rent for a one-bedroom, in cents. Calibrated estimate. */
  medianRentCents: number;
  population: number;
  // How much film and television work a town had, and the depth of its
  // ordinary job market, were SLATE's hand calibrations, printed on the place
  // card and Home and read by nothing else; they went on 2026-09-27. Where a
  // job filmed came from the trade's own production figures in the career's
  // content, until the career went on 2026-10-09.
  // A median home price (the rent times 320), a primary airport and the
  // neighborhoods of eight cities with their prestige and safety were
  // SLATE's estimates, and nothing owned a home, flew or chose a
  // neighborhood; they went on 2026-09-27, with the airports' table.
  jurisdictionCode: string;
  /**
   * Descriptive tags used by search and lifestyle systems, and shown title-cased on Where You Are (`placeLine`), so
   * spelled as the player reads: until 2026-10-13 two, theater and harbor, were spelled the British way, and a player
   * in New York, Chicago or London read it so (found by that day's evidence pass).
   */
  tags: string[];
  /**
   * A section of a larger city (Hollywood, Brooklyn), a national capital, or
   * the capital of a first-level region. An ordinary town has none.
   */
  kind?: 'section' | 'capital' | 'regional_capital';
}

const V = REFERENCE_VERSION;
const PUB = { source: 'public_reference', confidence: 'high', version: V } as const;

/**
 * Countries where traffic keeps left. Public reference data; the list is short
 * enough to state outright rather than guess from a region.
 */
const DRIVES_LEFT = new Set([
  'AG', 'AU', 'BS', 'BD', 'BB', 'BM', 'BT', 'BW', 'BN', 'KY', 'CX', 'CC', 'CK', 'CY', 'DM',
  'FK', 'FJ', 'GD', 'GG', 'GY', 'HK', 'IN', 'ID', 'IE', 'IM', 'JM', 'JE', 'JP', 'KE', 'KI',
  'LS', 'MO', 'MW', 'MY', 'MV', 'MT', 'MU', 'MS', 'MZ', 'NA', 'NR', 'NP', 'NZ', 'NU', 'NF',
  'PK', 'PG', 'PN', 'WS', 'SC', 'SG', 'SB', 'ZA', 'LK', 'SH', 'KN', 'LC', 'VC', 'SR', 'SZ',
  'TZ', 'TH', 'TL', 'TK', 'TO', 'TT', 'TC', 'TV', 'UG', 'GB', 'VG', 'VI', 'ZM', 'ZW',
]);

/** Names people actually type, where they differ from the official one. */
const COUNTRY_ALIASES: Record<string, string[] | undefined> = {
  us: ['USA', 'America', 'United States of America'],
  uk: ['Britain', 'Great Britain', 'England', 'UK'],
  ae: ['UAE', 'Dubai'],
  kr: ['South Korea'],
  kp: ['North Korea'],
  nl: ['Holland'],
  cz: ['Czech Republic'],
  cd: ['DR Congo'],
};

/**
 * Every country and territory in the world, from the GeoNames public dataset.
 * The geographic and administrative facts are reference data; nothing here is
 * a SLATE invention.
 */
export const COUNTRIES = new Registry<Country>('countries', WORLD_COUNTRIES.map((c) => ({
  id: c.id,
  name: c.name,
  aliases: COUNTRY_ALIASES[c.id],
  type: 'country' as const,
  iso2: c.iso2,
  currency: c.currency,
  currencyName: c.currencyName,
  jurisdictionCode: c.iso2,
  drivesOn: DRIVES_LEFT.has(c.iso2) ? ('left' as const) : ('right' as const),
  capital: c.capital,
  continent: CONTINENT_NAMES[c.continent] ?? c.continent,
  population: c.population,
  areaKm2: c.areaKm2,
  phone: c.phone,
  languages: c.languages,
  ...PUB,
})));



/**
 * Every first-level subdivision on Earth — states, provinces, prefectures,
 * regions, emirates, counties — as published by GeoNames.
 */
export const REGIONS = new Registry<Region>('regions', WORLD_REGIONS.map((r) => ({
  id: r.id,
  name: r.name,
  type: 'region' as const,
  code: r.code,
  parentId: r.countryId,
  jurisdictionCode: `${(COUNTRIES.get(r.countryId)?.jurisdictionCode ?? r.countryId.toUpperCase())}-${r.code}`,
  ...PUB,
})));

interface CitySpec {
  id: string; name: string; region: string; tz: string; lat: number; lon: number;
  col: number; rent: number; pop: number;
  tags: string[]; aliases?: string[];
}

function city(spec: CitySpec): City {
  const reg = REGIONS.require(spec.region);
  return {
    id: spec.id,
    name: spec.name,
    aliases: spec.aliases,
    type: 'city',
    parentId: spec.region,
    countryId: reg.parentId,
    timeZone: spec.tz,
    latitude: spec.lat,
    longitude: spec.lon,
    costOfLivingIndex: spec.col,
    medianRentCents: spec.rent * 100,
    population: spec.pop,
    jurisdictionCode: `${reg.jurisdictionCode}-${spec.id.split('-').pop()}`,
    tags: spec.tags,
    source: 'calibrated_estimate',
    confidence: 'medium',
    version: V,
    note: 'Its location, time zone, region and country are public reference data. Its costs are estimated.',
  };
}

/** The places SLATE simulates in detail, with economics that were actually
 * calibrated rather than derived. Everything else in the world is layered
 * underneath these. */
const CALIBRATED_CITIES: readonly City[] = [
  city({ id: 'us-ca-losangeles', name: 'Los Angeles', aliases: ['LA'], region: 'us-ca', tz: 'America/Los_Angeles', lat: 34.05, lon: -118.24, col: 152, rent: 2450, pop: 3900000, tags: ['film', 'television', 'beach', 'entertainment capital'] }),
  city({ id: 'us-ca-burbank', name: 'Burbank', region: 'us-ca', tz: 'America/Los_Angeles', lat: 34.18, lon: -118.31, col: 148, rent: 2350, pop: 107000, tags: ['studios', 'television', 'production'] }),
  city({ id: 'us-ca-santamonica', name: 'Santa Monica', region: 'us-ca', tz: 'America/Los_Angeles', lat: 34.02, lon: -118.49, col: 178, rent: 3300, pop: 93000, tags: ['beach', 'agencies', 'affluent'] }),
  city({ id: 'us-ca-sanfrancisco', name: 'San Francisco', region: 'us-ca', tz: 'America/Los_Angeles', lat: 37.77, lon: -122.42, col: 178, rent: 3200, pop: 810000, tags: ['tech', 'expensive', 'coastal'] }),
  city({ id: 'us-ca-sandiego', name: 'San Diego', region: 'us-ca', tz: 'America/Los_Angeles', lat: 32.72, lon: -117.16, col: 143, rent: 2500, pop: 1380000, tags: ['beach', 'military', 'relaxed'] }),
  city({ id: 'us-ny-newyork', name: 'New York', aliases: ['NYC', 'Manhattan'], region: 'us-ny', tz: 'America/New_York', lat: 40.71, lon: -74.01, col: 168, rent: 3600, pop: 8300000, tags: ['theater', 'television', 'finance', 'publishing'] }),
  city({ id: 'us-ga-atlanta', name: 'Atlanta', region: 'us-ga', tz: 'America/New_York', lat: 33.75, lon: -84.39, col: 104, rent: 1750, pop: 500000, tags: ['production hub', 'incentives', 'affordable'] }),
  city({ id: 'us-tx-austin', name: 'Austin', region: 'us-tx', tz: 'America/Chicago', lat: 30.27, lon: -97.74, col: 112, rent: 1700, pop: 970000, tags: ['music', 'festival', 'tech'] }),
  city({ id: 'us-tx-dallas', name: 'Dallas', region: 'us-tx', tz: 'America/Chicago', lat: 32.78, lon: -96.80, col: 101, rent: 1500, pop: 1300000, tags: ['business', 'affordable'] }),
  city({ id: 'us-fl-miami', name: 'Miami', region: 'us-fl', tz: 'America/New_York', lat: 25.76, lon: -80.19, col: 128, rent: 2600, pop: 450000, tags: ['beach', 'international', 'nightlife'] }),
  city({ id: 'us-il-chicago', name: 'Chicago', region: 'us-il', tz: 'America/Chicago', lat: 41.88, lon: -87.63, col: 108, rent: 1950, pop: 2700000, tags: ['theater', 'improv', 'architecture'] }),
  city({ id: 'us-nv-lasvegas', name: 'Las Vegas', region: 'us-nv', tz: 'America/Los_Angeles', lat: 36.17, lon: -115.14, col: 105, rent: 1550, pop: 660000, tags: ['no state income tax', 'entertainment', 'hospitality'] }),
  city({ id: 'us-wa-seattle', name: 'Seattle', region: 'us-wa', tz: 'America/Los_Angeles', lat: 47.61, lon: -122.33, col: 148, rent: 2250, pop: 750000, tags: ['tech', 'no state income tax', 'rain'] }),
  city({ id: 'us-or-portland', name: 'Portland', region: 'us-or', tz: 'America/Los_Angeles', lat: 45.51, lon: -122.68, col: 121, rent: 1700, pop: 640000, tags: ['no sales tax', 'creative', 'green'] }),
  city({ id: 'us-co-denver', name: 'Denver', region: 'us-co', tz: 'America/Denver', lat: 39.74, lon: -104.99, col: 115, rent: 1800, pop: 715000, tags: ['mountains', 'outdoors'] }),
  city({ id: 'us-nm-santafe', name: 'Santa Fe', region: 'us-nm', tz: 'America/Denver', lat: 35.69, lon: -105.94, col: 106, rent: 1600, pop: 88000, tags: ['incentives', 'desert', 'arts'] }),
  city({ id: 'us-la-neworleans', name: 'New Orleans', region: 'us-la', tz: 'America/Chicago', lat: 29.95, lon: -90.07, col: 96, rent: 1400, pop: 380000, tags: ['incentives', 'music', 'historic'] }),
  city({ id: 'us-nc-wilmington', name: 'Wilmington', region: 'us-nc', tz: 'America/New_York', lat: 34.23, lon: -77.94, col: 94, rent: 1400, pop: 120000, tags: ['studios', 'coastal', 'affordable'] }),
  city({ id: 'us-tn-nashville', name: 'Nashville', region: 'us-tn', tz: 'America/Chicago', lat: 36.16, lon: -86.78, col: 103, rent: 1650, pop: 690000, tags: ['music', 'no state income tax'] }),
  city({ id: 'us-ma-boston', name: 'Boston', region: 'us-ma', tz: 'America/New_York', lat: 42.36, lon: -71.06, col: 149, rent: 2900, pop: 650000, tags: ['universities', 'historic'] }),
  city({ id: 'us-az-phoenix', name: 'Phoenix', region: 'us-az', tz: 'America/Phoenix', lat: 33.45, lon: -112.07, col: 103, rent: 1550, pop: 1650000, tags: ['no daylight saving', 'desert', 'affordable'] }),
  city({ id: 'us-hi-honolulu', name: 'Honolulu', region: 'us-hi', tz: 'Pacific/Honolulu', lat: 21.31, lon: -157.86, col: 179, rent: 2400, pop: 350000, tags: ['island', 'no daylight saving', 'tourism'] }),
  city({ id: 'ca-bc-vancouver', name: 'Vancouver', region: 'ca-02', tz: 'America/Vancouver', lat: 49.28, lon: -123.12, col: 137, rent: 2400, pop: 675000, tags: ['production hub', 'incentives', 'mountains'] }),
  city({ id: 'ca-on-toronto', name: 'Toronto', region: 'ca-08', tz: 'America/Toronto', lat: 43.65, lon: -79.38, col: 128, rent: 2200, pop: 2900000, tags: ['production hub', 'incentives', 'finance'] }),
  city({ id: 'ca-qc-montreal', name: 'Montreal', region: 'ca-10', tz: 'America/Toronto', lat: 45.50, lon: -73.57, col: 105, rent: 1500, pop: 1760000, tags: ['vfx', 'incentives', 'bilingual'] }),
  city({ id: 'uk-eng-london', name: 'London', region: 'uk-eng', tz: 'Europe/London', lat: 51.51, lon: -0.13, col: 158, rent: 2700, pop: 8900000, tags: ['theater', 'production hub', 'international'] }),
  city({ id: 'uk-eng-manchester', name: 'Manchester', region: 'uk-eng', tz: 'Europe/London', lat: 53.48, lon: -2.24, col: 108, rent: 1350, pop: 553000, tags: ['television', 'affordable', 'music'] }),
  city({ id: 'uk-sct-glasgow', name: 'Glasgow', region: 'uk-sct', tz: 'Europe/London', lat: 55.86, lon: -4.25, col: 98, rent: 1100, pop: 635000, tags: ['incentives', 'locations'] }),
  city({ id: 'ie-lei-dublin', name: 'Dublin', region: 'ie-l', tz: 'Europe/Dublin', lat: 53.35, lon: -6.26, col: 132, rent: 2100, pop: 590000, tags: ['incentives', 'production'] }),
  city({ id: 'fr-idf-paris', name: 'Paris', region: 'fr-11', tz: 'Europe/Paris', lat: 48.86, lon: 2.35, col: 142, rent: 2200, pop: 2100000, tags: ['festival', 'fashion', 'arthouse'] }),
  city({ id: 'fr-paca-cannes', name: 'Cannes', region: 'fr-93', tz: 'Europe/Paris', lat: 43.55, lon: 7.02, col: 138, rent: 1900, pop: 74000, tags: ['festival', 'market', 'riviera'] }),
  city({ id: 'de-be-berlin', name: 'Berlin', region: 'de-16', tz: 'Europe/Berlin', lat: 52.52, lon: 13.40, col: 112, rent: 1450, pop: 3700000, tags: ['festival', 'affordable', 'creative'] }),
  city({ id: 'es-md-madrid', name: 'Madrid', region: 'es-29', tz: 'Europe/Madrid', lat: 40.42, lon: -3.70, col: 102, rent: 1300, pop: 3300000, tags: ['production hub', 'sunny'] }),
  city({ id: 'es-cat-barcelona', name: 'Barcelona', region: 'es-56', tz: 'Europe/Madrid', lat: 41.39, lon: 2.17, col: 108, rent: 1400, pop: 1620000, tags: ['locations', 'beach', 'design'] }),
  city({ id: 'it-laz-rome', name: 'Rome', region: 'it-07', tz: 'Europe/Rome', lat: 41.90, lon: 12.50, col: 104, rent: 1250, pop: 2800000, tags: ['historic studios', 'locations'] }),
  city({ id: 'au-nsw-sydney', name: 'Sydney', region: 'au-02', tz: 'Australia/Sydney', lat: -33.87, lon: 151.21, col: 141, rent: 2400, pop: 5300000, tags: ['southern hemisphere', 'harbor', 'production hub'] }),
  city({ id: 'au-vic-melbourne', name: 'Melbourne', region: 'au-07', tz: 'Australia/Melbourne', lat: -37.81, lon: 144.96, col: 128, rent: 1900, pop: 5000000, tags: ['southern hemisphere', 'arts', 'coffee'] }),
  city({ id: 'au-qld-goldcoast', name: 'Gold Coast', region: 'au-04', tz: 'Australia/Brisbane', lat: -28.02, lon: 153.40, col: 118, rent: 1700, pop: 640000, tags: ['studios', 'incentives', 'beach', 'no daylight saving'] }),
  city({ id: 'nz-wgn-wellington', name: 'Wellington', region: 'nz-g2', tz: 'Pacific/Auckland', lat: -41.29, lon: 174.78, col: 116, rent: 1650, pop: 215000, tags: ['vfx', 'southern hemisphere', 'incentives'] }),
  city({ id: 'nz-akl-auckland', name: 'Auckland', region: 'nz-e7', tz: 'Pacific/Auckland', lat: -36.85, lon: 174.76, col: 122, rent: 1750, pop: 1650000, tags: ['southern hemisphere', 'locations'] }),
  city({ id: 'jp-13-tokyo', name: 'Tokyo', region: 'jp-40', tz: 'Asia/Tokyo', lat: 35.68, lon: 139.69, col: 126, rent: 1500, pop: 13900000, tags: ['international', 'animation', 'dense'] }),
  city({ id: 'kr-11-seoul', name: 'Seoul', region: 'kr-11', tz: 'Asia/Seoul', lat: 37.57, lon: 126.98, col: 118, rent: 1350, pop: 9700000, tags: ['international', 'television', 'music'] }),
  city({ id: 'mx-cmx-mexicocity', name: 'Mexico City', region: 'mx-09', tz: 'America/Mexico_City', lat: 19.43, lon: -99.13, col: 68, rent: 900, pop: 9200000, tags: ['affordable', 'production hub'] }),
  city({ id: 'ae-du-dubai', name: 'Dubai', region: 'ae-03', tz: 'Asia/Dubai', lat: 25.20, lon: 55.27, col: 134, rent: 2200, pop: 3600000, tags: ['no income tax', 'luxury', 'international'] }),
];

// ---------------------------------------------------------------------------
// The rest of the world
// ---------------------------------------------------------------------------

/**
 * Roughly what things cost in a country relative to the United States at 100.
 *
 * These are SLATE calibrations, not published figures, and they are coarse on
 * purpose: they place a country in a band rather than claim to know its prices.
 * A city SLATE actually simulates overrides its country's band entirely.
 */
const COUNTRY_PRICE_LEVEL: Record<string, number> = {
  ch: 155, is: 145, no: 140, bm: 140, ky: 138, sg: 130, dk: 128, ie: 126, lu: 126,
  au: 122, nz: 118, uk: 118, us: 100, ca: 104, nl: 112, se: 112, fi: 112, at: 110,
  be: 110, fr: 110, de: 106, il: 118, jp: 100, kr: 92, ae: 104, qa: 104, hk: 128,
  it: 96, es: 90, pt: 86, gr: 84, cy: 92, mt: 92, si: 86, cz: 80, ee: 88, lt: 78,
  lv: 80, sk: 78, pl: 72, hu: 70, hr: 78, ro: 66, bg: 62, rs: 60, ua: 48, ru: 56,
  tr: 54, cn: 62, tw: 78, my: 56, th: 54, vn: 44, ph: 46, id: 44, in: 38, pk: 34,
  bd: 36, lk: 40, np: 36, mx: 56, br: 54, ar: 50, cl: 62, co: 46, pe: 48, uy: 62,
  za: 52, ng: 40, ke: 46, eg: 34, ma: 50, gh: 44, tz: 42, et: 38, dz: 40, tn: 40,
};

/** Continent fallbacks, for the countries the table above does not name. */
const CONTINENT_PRICE_LEVEL: Record<string, number> = {
  EU: 92, NA: 78, OC: 96, AS: 56, SA: 52, AF: 44, AN: 90,
};

/**
 * Economics for a city nobody has calibrated by hand.
 *
 * Derived from two things SLATE does know: what country it is in and how many
 * people live there. That is enough to tell a capital from a market town, and
 * it is marked as an estimate because that is exactly what it is. Nothing here
 * claims to be a real rent in a real place.
 */
function deriveCity(raw: RawCity): City {
  const country = COUNTRIES.get(raw.countryId);
  const base = COUNTRY_PRICE_LEVEL[raw.countryId]
    ?? CONTINENT_PRICE_LEVEL[WORLD_COUNTRY_BY_ID.get(raw.countryId)?.continent ?? 'EU']
    ?? 70;

  // Big cities cost more than small ones, everywhere, and the curve flattens.
  const scale = Math.log10(Math.max(1_000, raw.population)) - 3;
  const costOfLivingIndex = Math.round(base * (1 + scale * 0.13));
  const monthlyRent = Math.round(costOfLivingIndex * 16.5 * (1 + scale * 0.22));
  const kind = CITY_KIND[raw.kind];

  return {
    ...(kind ? { kind } : {}),
    id: raw.id,
    name: raw.name,
    type: 'city',
    parentId: raw.regionId || raw.countryId,
    countryId: raw.countryId,
    timeZone: raw.timeZone,
    latitude: raw.lat,
    longitude: raw.lon,
    costOfLivingIndex,
    medianRentCents: monthlyRent * 100,
    population: raw.population,
    jurisdictionCode: `${REGIONS.get(raw.regionId)?.jurisdictionCode ?? country?.jurisdictionCode ?? raw.countryId.toUpperCase()}-${raw.id.split('-').pop()}`,
    tags: [],
    source: 'calibrated_estimate',
    confidence: 'low',
    version: V,
    note: 'Its location, time zone, region and country are public reference data. '
      + 'Its costs are estimated from its country and its population, not looked up.',
  };
}

const CITY_KIND: Record<string, City['kind']> = { x: 'section', c: 'capital', a: 'regional_capital' };

const WORLD_COUNTRY_BY_ID = new Map(WORLD_COUNTRIES.map((c) => [c.id, c]));
const CALIBRATED_IDS = new Set(CALIBRATED_CITIES.map((c) => c.id));

/**
 * Every city SLATE can name. The calibrated ones first, then the largest
 * places on Earth; the remaining ${'${'}TOTAL_CITIES.toLocaleString('en-US')} are fetched
 * a country at a time by `loadCountryCities`.
 */
/**
 * Places the game itself stands on, which the bundle rule misses.
 *
 * `tools/build-world-data.mjs` bundles the largest three places in every
 * country plus the largest nine hundred on Earth, and fetches the rest of a
 * country only when somebody looks at it. That is right for a gazetteer and
 * wrong for the one town the save is built on: the engine needs the estate's
 * city at boot, before anything has been fetched, and Iceland's fourth town
 * does not clear the rule.
 *
 * These are real rows, copied out of `public/geo/is.tsv`, and they go through
 * `deriveCity` exactly like every other uncalibrated place: they get the
 * derived economics, and until 2026-09-27 an industry presence of zero,
 * which for Iceland was the fact the premise rested on.
 *
 * New Haven joined them on 2026-09-26, copied out of `public/geo/us.tsv`: a
 * new life begins at the drama school there (`content/school.ts`), and
 * Connecticut's towns aren't bundled.
 *
 * Belfast, Edinburgh and Toluca joined on 2026-09-29, copied out of
 * `public/geo/uk.tsv` and `mx.tsv`: the Enterprise, LNER and El Insurgente
 * run to them (`content/rail.ts`), and Belfast is where Northern Ireland's
 * license path is reached.
 *
 * Hudson, Litchfield, Bakersfield, Naas, Millbrook and Sechelt joined on
 * 2026-09-29, copied out of `public/geo/us.tsv`, `ie.tsv` and `ca.tsv`: a
 * house built on farmland stands in its market's town (`content/land.ts`),
 * not in the city the land was bought from.
 */
const NEEDED_AT_BOOT: readonly RawCity[] = [
  {
    id: 'is-39-mosfellsbr',
    name: 'Mosfellsbær',
    regionId: 'is-39',
    countryId: 'is',
    lat: 64.1667,
    lon: -21.7000,
    timeZone: 'Atlantic/Reykjavik',
    population: 13_715,
    kind: '',
  },
  {
    id: 'us-ct-newhaven',
    name: 'New Haven',
    regionId: 'us-ct',
    countryId: 'us',
    lat: 41.3081,
    lon: -72.9282,
    timeZone: 'America/New_York',
    population: 130_322,
    kind: '',
  },
  { id: 'ca-02-victoria', name: 'Victoria', regionId: 'ca-02', countryId: 'ca', lat: 48.4359, lon: -123.3516, timeZone: 'America/Vancouver', population: 289_625, kind: 'a' },
  { id: 'uk-nir-belfast', name: 'Belfast', regionId: 'uk-nir', countryId: 'uk', lat: 54.5968, lon: -5.9254, timeZone: 'Europe/London', population: 348_005, kind: 'a' },
  { id: 'uk-sct-edinburgh', name: 'Edinburgh', regionId: 'uk-sct', countryId: 'uk', lat: 55.9521, lon: -3.1965, timeZone: 'Europe/London', population: 514_990, kind: 'a' },
  { id: 'us-ny-hudson', name: 'Hudson', regionId: 'us-ny', countryId: 'us', lat: 42.2529, lon: -73.7910, timeZone: 'America/New_York', population: 6_436, kind: '' },
  { id: 'us-ct-litchfield', name: 'Litchfield', regionId: 'us-ct', countryId: 'us', lat: 41.7473, lon: -73.1887, timeZone: 'America/New_York', population: 1_215, kind: '' },
  { id: 'us-ca-bakersfield', name: 'Bakersfield', regionId: 'us-ca', countryId: 'us', lat: 35.3733, lon: -119.0187, timeZone: 'America/Los_Angeles', population: 373_640, kind: '' },
  { id: 'ie-l-naas', name: 'Naas', regionId: 'ie-l', countryId: 'ie', lat: 53.2158, lon: -6.6669, timeZone: 'Europe/Dublin', population: 20_713, kind: '' },
  { id: 'ca-08-millbrook', name: 'Millbrook', regionId: 'ca-08', countryId: 'ca', lat: 44.1501, lon: -78.4495, timeZone: 'America/Toronto', population: 1_695, kind: '' },
  { id: 'ca-02-sechelt', name: 'Sechelt', regionId: 'ca-02', countryId: 'ca', lat: 49.4751, lon: -123.7590, timeZone: 'America/Vancouver', population: 8_832, kind: '' },
  { id: 'mx-15-toluca', name: 'Toluca', regionId: 'mx-15', countryId: 'mx', lat: 19.2879, lon: -99.6532, timeZone: 'America/Mexico_City', population: 489_333, kind: 'a' },
];

const BUNDLED_IDS = new Set(WORLD_CITIES.map((c) => c.id));

export const CITIES = new Registry<City>('cities', [
  ...CALIBRATED_CITIES,
  ...[...WORLD_CITIES, ...NEEDED_AT_BOOT.filter((c) => !BUNDLED_IDS.has(c.id))]
    .filter((c) => !CALIBRATED_IDS.has(c.id))
    .map(deriveCity),
]);

/** Countries whose full city list has already been pulled in. */
const loadedCountries = new Set<string>();

/**
 * Pulls in every city in one country.
 *
 * A picker set to Italy should offer all ten thousand Italian towns, not the
 * three that happened to be big enough to bundle. They are fetched once and
 * kept, and asking twice is free.
 */
export async function loadCountryCities(countryId: string): Promise<number> {
  if (loadedCountries.has(countryId)) return 0;
  const total = CITY_COUNTS[countryId];
  if (!total) {
    loadedCountries.add(countryId);
    return 0;
  }

  const response = await fetch(`${import.meta.env.BASE_URL}geo/${countryId}.tsv`);
  if (!response.ok) {
    throw new Error('This country’s full list of towns couldn’t be loaded, so for now you can only pick from the towns already listed. Check your connection, then choose another country and come back to this one.');
  }
  return addCountryCities(countryId, await response.text());
}

/**
 * Adds every city in one country from its tab-delimited file, as built by
 * `tools/build-world-data.mjs`. The fetch above uses this; so can anything
 * that already has the file in hand.
 */
export function addCountryCities(countryId: string, text: string): number {
  if (loadedCountries.has(countryId)) return 0;
  const parsed: City[] = [];
  // Split on either ending. A checkout that converts line endings would
  // otherwise leave a carriage return stuck to the last field of every row, and
  // the last field is the place kind.
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const [id, name, regionId, lat, lon, timeZone, population, kind] = line.split('\t');
    if (!id || !name || !timeZone) continue;
    if (CITIES.get(id)) continue;
    parsed.push(deriveCity({
      id, name, regionId: regionId ?? '', countryId,
      lat: Number(lat), lon: Number(lon), timeZone, population: Number(population) || 0, kind: kind ?? '',
    }));
  }

  loadedCountries.add(countryId);
  return CITIES.add(parsed);
}

/**
 * The country a place id belongs to, or undefined when it names no real
 * country. A city id carries its country as its first segment, so this works
 * for a town whose country has not been loaded yet.
 */
export function countryOfPlace(placeId: string): string | undefined {
  const code = placeId.split('-')[0];
  return code && COUNTRIES.get(code) ? code : undefined;
}

/** Whether a country's full list is already in memory. */
export function isCountryLoaded(countryId: string): boolean {
  return loadedCountries.has(countryId);
}

/** How many cities SLATE knows in a country, loaded or not. */
export function cityCount(countryId: string): number {
  return CITY_COUNTS[countryId] ?? 0;
}

/** Every city in the world SLATE knows about, loaded or not. */
export const CITIES_IN_THE_WORLD = TOTAL_CITIES;




/** Great-circle distance in kilometers. Used for travel time and cost. */
export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Full jurisdiction path for a city, outermost first. Drives tax resolution. */
export function jurisdictionPath(cityId: string): string[] {
  const c = CITIES.require(cityId);
  // A city-state or a territory with no subdivisions (Singapore, Hong Kong,
  // Macau, Aruba) has the country as its parent. Until 2026-09-26 the path
  // required a region, and every wage, law and tax lookup there threw.
  const r = REGIONS.get(c.parentId);
  if (!r) return [COUNTRIES.require(c.countryId).jurisdictionCode, c.jurisdictionCode];
  const n = COUNTRIES.require(r.parentId);
  return [n.jurisdictionCode, r.jurisdictionCode, c.jurisdictionCode];
}

export function cityTimeZone(cityId: string): string {
  return CITIES.require(cityId).timeZone;
}
