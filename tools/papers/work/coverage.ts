import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../passports/coverage.ts';

/**
 * The work rules' coverage matrix (coverage/work-countries.json), from the compiled rules and the register: a
 * country compiled is researched, citing its own file (papers.work.<code>, and the shared list it keeps,
 * papers.work.group.<name>); one not compiled is blocked where the register holds its blocker
 * (papers.work.blocked.<code>), else pending; a country with no place of its own is proven by the gazetteer's test
 * that it has none.
 */
export const COVERAGE = 'coverage/work-countries.json';

const T = 'tests/papers/work/work.test.ts';
export const TESTS = [`${T}::work > ask each country's own, or the list it shares, of each passport`, 'tests/papers/work/work.places.test.ts::work > for every place on the map'];
/** And a blocked row's: the test that shows the player told its rules aren't kept. */
export const TOLD = `${T}::work > tell the player what the game doesn't know`;

/** By country compiled, the shared list it keeps, or null for a list of its own. */
export function workCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlyMap<string, string | null>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const group = compiled.get(key);
    // A country keeping a shared list cites that list's fact too; one not compiled names no list the register holds.
    const register = [facts.get(`papers.work.${key}`), ...(group === null ? [] : [facts.get(`papers.work.group.${String(group)}`)])];
    if (!register.includes(undefined)) return { key, status: 'researched', register: register as string[], tests: TESTS };
    const blocker = facts.get(`papers.work.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'papers.work', axis: 'country', rows }, null, 1)}\n`;

/** The work rules' coverage from the compiled rules, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const work = read('src/papers/work/work.json') as { countries: Record<string, { group?: string }> };
  const compiled = new Map(Object.entries(work.countries).map(([code, c]) => [code, c.group ?? null] as const));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(workCoverage(countries, withPlaces, compiled, facts));
}
