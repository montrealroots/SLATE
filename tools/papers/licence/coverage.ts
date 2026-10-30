import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../passports/coverage.ts';
import { inputsOf, serializeBy } from '../numbers/coverage.ts';

/**
 * The licences' coverage matrix (coverage/licence-countries.json), by country: researched where the country's own file
 * is compiled and cited (papers.licence.<CC>), or every one of its first-level regions' is (papers.licence.<CC>.<region>,
 * citing them all); blocked where the register holds the country's blocker (papers.licence.blocked.<CC>), else pending
 * (a country with some of its regions read and not all is pending); proven where it has no place of its own.
 */
export const COVERAGE = 'coverage/licence-countries.json';

const T = 'tests/papers/licence/licence.test.ts';
export const TESTS = [`${T}::the licences > are each office's own`, 'tests/papers/licence/licence.places.test.ts::the licences > for every place on the map'];
export const TOLD = `${T}::the licences > tell the player what the game doesn't know`;

export function licenceCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, regions: readonly string[], compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  const read = (key: string) => (compiled.has(key) ? facts.get(`papers.licence.${key}`) : undefined);
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = read(key);
    if (own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const byRegion = regions.filter((r) => r.startsWith(`${key}.`)).map(read);
    if (byRegion.length > 0 && byRegion.every((id) => id !== undefined)) return { key, status: 'researched', register: byRegion as string[], tests: TESTS };
    const blocker = facts.get(`papers.licence.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export function coverageOf(root: string): string {
  const { countries, withPlaces, compiled, facts } = inputsOf(root, 'src/papers/licence/licence.json');
  const regions = Object.keys(JSON.parse(readFileSync(join(root, 'src/world/gazetteer/regions.json'), 'utf8')) as object);
  return serializeBy('papers.licence', licenceCoverage(countries, withPlaces, regions, compiled, facts));
}
