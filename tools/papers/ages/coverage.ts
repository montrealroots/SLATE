import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverageBy, inputsOf, serializeBy } from '../numbers/coverage.ts';

/**
 * The ages' coverage matrix (coverage/ages-countries.json), from the compiled ages and the register: a country compiled
 * with its majority, work and service all read is researched, citing its own file (papers.ages.<code>); one not
 * compiled, or with any of the three null, is blocked where the register holds its blocker (papers.ages.blocked.<code>),
 * else pending; a country with no place of its own is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/ages-countries.json';

const T = 'tests/papers/ages/ages.test.ts';
export const TESTS = [`${T}::the ages > are each country's own`, 'tests/papers/ages/ages.places.test.ts::the ages > for every place on the map'];
/** And a blocked row's: the test that shows the player told what the game doesn't know. */
export const TOLD = `${T}::the ages > tell the player what the game doesn't know`;

export const agesCoverage = coverageBy('papers.ages', TESTS, TOLD);

/** Only a country whose three are all read is held compiled for the matrix. */
export const whole = (ages: Readonly<Record<string, { majority: unknown; work: unknown; service: unknown }>>): Set<string> =>
  new Set(Object.entries(ages).flatMap(([code, a]) => (a.majority !== null && a.work !== null && a.service !== null ? [code] : [])));

export function coverageOf(root: string): string {
  const { countries, withPlaces, facts } = inputsOf(root, 'src/papers/ages/ages.json');
  const ages = JSON.parse(readFileSync(join(root, 'src/papers/ages/ages.json'), 'utf8')) as Parameters<typeof whole>[0];
  return serializeBy('papers.ages', agesCoverage(countries, withPlaces, whole(ages), facts));
}
