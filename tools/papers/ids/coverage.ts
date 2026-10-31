import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../passports/coverage.ts';

/**
 * The identity documents' coverage matrix (coverage/ids-countries.json), from the compiled documents and the
 * register: a country compiled is researched, citing its own file (papers.ids.<code>); one not compiled is blocked
 * where the register holds its blocker (papers.ids.blocked.<code>), else pending; a country with no place of its own
 * is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/ids-countries.json';

const T = 'tests/papers/ids/ids.test.ts';
export const TESTS = [`${T}::the identity documents > are each country's own, by age and route`, 'tests/papers/ids/ids.places.test.ts::the identity documents > for every place on the map'];
/** And a blocked row's: the test that shows the player told its identity documents aren't kept. */
export const TOLD = `${T}::the identity documents > tell the player what the game doesn't know`;

export function idsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`papers.ids.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`papers.ids.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'papers.ids', axis: 'country', rows }, null, 1)}\n`;

/** The identity documents' coverage from the compiled documents, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const compiled = new Set(Object.keys(read('src/papers/ids/ids.json') as object));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(idsCoverage(countries, withPlaces, compiled, facts));
}
