import { PARAMS, type Param, type Station } from './compile.ts';

/**
 * The weather's coverage matrix (coverage/weather-countries.json), from the stations and the register: a country with
 * places whose own stations give all five normals is researched, citing the sets they come from; one lacking some is
 * blocked where the register holds its blocker (world.weather.blocked.<code>), else pending with what it lacks; a
 * country with no place of its own is proven by the gazetteer's test that it has none.
 */
export const OUTPUT = 'coverage/weather-countries.json';

/** The register entry each set's stations come from, by the start of their id. */
export const SETS: Readonly<Record<string, string>> = { '9120': 'R-0037', '6190': 'R-0038', '8110': 'R-0044', mf: 'R-0043', cwa: 'R-0045', metoffice: 'R-0048', bws: 'R-0049', dhm: 'R-0057', rnsm: 'R-0060', meteocw: 'R-0074', anguilla: 'R-0075', tms: 'R-0076', rhmz: 'R-4115', jica: 'R-4116', vms: 'R-4117', svgmet: 'R-4235', dwd: 'R-0062', kt: 'R-0063', wwis: 'R-0042', ghcnd: 'R-0073' };
/** Every row's model: the lapse rate and the rain-snow threshold. */
export const MODEL = ['R-0039', 'R-0040'];

const T = 'tests/world/weather/weather.test.ts';
export const TESTS = [
  "tests/tools/wmo.test.ts::the station compiler > reproduces the stations the engine reads, byte for byte, from the WMO's files",
  'tests/world/weather/weather.places.test.ts::the weather at real towns > at every place on the map',
  `${T}::a day's weather > comes back, over thirty years, to the normals it's drawn around`,
];
/** And a blocked row's: the test that shows the player told where the weather is borrowed from. */
export const TOLD = `${T}::the weather at real towns > reads each town's nearest station of its own country, and says where it has none`;
export const NO_PLACES = 'tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own';

export type Row =
  | { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] }
  | { key: string; status: 'pending'; missing: Param[] }
  | { key: string; status: 'proven'; tests: string[] };

export function weatherCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, stations: readonly Station[], blockers: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = stations.filter((s) => s.country === key);
    const missing = PARAMS.filter((p) => !own.some((s) => s.normals[p] !== undefined));
    const sets = Object.entries(SETS)
      .filter(([prefix]) => own.some((s) => s.id.startsWith(`${prefix}:`)))
      .map(([, id]) => id);
    const blocker = blockers.get(key);
    if (missing.length === 0) return { key, status: 'researched', register: [...sets, ...MODEL].sort(), tests: TESTS };
    if (blocker === undefined) return { key, status: 'pending', missing };
    return { key, status: 'blocked', register: [...sets, ...MODEL, blocker].sort(), tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'world.weather', axis: 'country', rows }, null, 1)}\n`;
