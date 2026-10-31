import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The passports' coverage matrix (coverage/passports-countries.json), from the compiled passports and the register:
 * a country whose passports are compiled is researched, citing its own file (papers.passports.<code>); one without is
 * blocked where the register holds its blocker (papers.passports.blocked.<code>), else pending, its file still in the
 * research's own words or not yet written; a country with no place of its own is proven by the gazetteer's test that
 * it has none (no one is born there to be its citizen).
 */
export const COVERAGE = 'coverage/passports-countries.json';

const T = 'tests/papers/passports/passports.test.ts';
export const TESTS = [`${T}::the passports > are each office's own, by age, route and month`, 'tests/papers/passports/passports.places.test.ts::the passports > for every place on the map'];
/** And a blocked row's: the test that shows the player told its passports aren't kept. */
export const TOLD = `${T}::the passports > tell the player what the game doesn't know`;
export const NO_PLACES = 'tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own';

export type Row =
  | { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] }
  | { key: string; status: 'pending' }
  | { key: string; status: 'proven'; tests: string[] };

export function passportsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`papers.passports.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`papers.passports.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'papers.passports', axis: 'country', rows }, null, 1)}\n`;

/** The passports' coverage from the compiled passports, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const compiled = new Set(Object.keys(read('src/papers/passports/passports.json') as object));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(passportsCoverage(countries, withPlaces, compiled, facts));
}
