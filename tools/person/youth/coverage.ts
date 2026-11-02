import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES } from '../../papers/passports/coverage.ts';
import { BLOCKED, FACT } from './compile.ts';

/**
 * The youth coverage matrix (coverage/youth-countries.json), a row for every country and territory of the map: one whose
 * research the register cites (person.ages.<code>) with nothing blocked is researched; one with blockers
 * (person.ages.blocked.<code>) is blocked, citing them and its research where there is one, the player told what
 * isn't known (youth.unkept); one with neither is pending; a country with no place of its own is proven by the
 * gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/youth-countries.json';

const T = 'tests/person/youth/youth.test.ts';
export const TESTS = [`${T}::the youth rules > are each country's own, as the research gives them`, `${T}::a minor's work > is engaged, limited and paid as the work's country's law says`];
/** And a blocked row's: the test that shows the player told what isn't known. */
export const TOLD = `${T}::the youth rules > tell the player what of a country's rules isn't known`;

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' } | { key: string; status: 'proven'; register?: string[]; tests: string[] };

export function youthCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    // A country with no place of its own needs no rule the game reads; what its research sought stays cited.
    const held = [blocker, own].filter((id): id is string => id !== undefined);
    if (!withPlaces.has(key)) return held.length === 0 ? { key, status: 'proven', tests: [NO_PLACES] } : { key, status: 'proven', register: held, tests: [NO_PLACES] };
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.youth', axis: 'country', rows }, null, 1)}\n`;

/** The coverage of every country of the map from the gazetteer's countries and places and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(youthCoverage(countries, withPlaces, facts));
}
