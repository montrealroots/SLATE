import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../passports/coverage.ts';

/**
 * The citizenship rules' coverage matrix (coverage/citizenship-countries.json), from the compiled rules and the
 * register: a country compiled is researched, citing its own file (papers.citizenship.<code>); one not compiled is
 * blocked where the register holds its blocker (papers.citizenship.blocked.<code>), else pending; a country with no
 * place of its own is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/citizenship-countries.json';

const T = 'tests/papers/citizenship/citizenship.test.ts';
export const TESTS = [`${T}::citizenship > is each state's own, and a territory's is its state's`, 'tests/papers/citizenship/citizenship.places.test.ts::citizenship > for every place on the map'];
/** And a blocked row's: the test that shows the player told its rules aren't kept. */
export const TOLD = `${T}::citizenship > tells the player what the game doesn't know`;

export function citizenshipCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`papers.citizenship.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`papers.citizenship.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'papers.citizenship', axis: 'country', rows }, null, 1)}\n`;

/** The citizenship rules' coverage from the compiled rules, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const compiled = new Set(Object.keys(read('src/papers/citizenship/citizenship.json') as object));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(citizenshipCoverage(countries, withPlaces, compiled, facts));
}
