import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../passports/coverage.ts';

/**
 * The national numbers' coverage matrix (coverage/numbers-countries.json), from the compiled numbers and the
 * register: a country compiled is researched, citing its own file (papers.numbers.<code>); one not compiled is blocked
 * where the register holds its blocker (papers.numbers.blocked.<code>), else pending; a country with no place of its
 * own is proven by the gazetteer's test that it has none. Residence reads its matrix through the same rows.
 */
export const COVERAGE = 'coverage/numbers-countries.json';

const T = 'tests/papers/numbers/numbers.test.ts';
export const TESTS = [`${T}::the national numbers > are each country's own`, 'tests/papers/numbers/numbers.places.test.ts::the national numbers > for every place on the map'];
/** And a blocked row's: the test that shows the player told its number isn't kept. */
export const TOLD = `${T}::the national numbers > tell the player what the game doesn't know`;

/** A matrix by country, of an engine whose register facts are `<fact>.<code>` and `<fact>.blocked.<code>`. */
export const coverageBy = (fact: string, tests: readonly string[], told: string) =>
  (countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] =>
    countries.map((key): Row => {
      if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
      const own = facts.get(`${fact}.${key}`);
      if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: [...tests] };
      const blocker = facts.get(`${fact}.blocked.${key}`);
      return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...tests, told] };
    });

export const numbersCoverage = coverageBy('papers.numbers', TESTS, TOLD);

/** A matrix as the gate holds it. */
export const serializeBy = (engine: string, rows: readonly Row[]) => `${JSON.stringify({ engine, axis: 'country', rows }, null, 1)}\n`;

/** What every country matrix is read from: the gazetteer's countries and places, an engine's compiled keys, the register's facts. */
export function inputsOf(root: string, output: string) {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  return {
    countries: Object.keys(read('src/world/gazetteer/countries.json') as object),
    withPlaces: new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2))),
    compiled: new Set(Object.keys(read(output) as object)),
    facts: new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const)),
  };
}

/** The national numbers' coverage from the repository. */
export function coverageOf(root: string): string {
  const { countries, withPlaces, compiled, facts } = inputsOf(root, 'src/papers/numbers/numbers.json');
  return serializeBy('papers.numbers', numbersCoverage(countries, withPlaces, compiled, facts));
}
