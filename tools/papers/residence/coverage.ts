import { coverageBy, inputsOf, serializeBy } from '../numbers/coverage.ts';

/**
 * The residence permissions' coverage matrix (coverage/residence-countries.json), as the national numbers' is read:
 * researched where compiled and cited (papers.residence.<code>), blocked where the register holds the blocker
 * (papers.residence.blocked.<code>), else pending; proven where the country has no place of its own.
 */
export const COVERAGE = 'coverage/residence-countries.json';

const T = 'tests/papers/residence/residence.test.ts';
export const TESTS = [`${T}::the residence permissions > are each country's own`, 'tests/papers/residence/residence.places.test.ts::the residence permissions > for every place on the map'];
export const TOLD = `${T}::the residence permissions > tell the player what the game doesn't know`;

export const residenceCoverage = coverageBy('papers.residence', TESTS, TOLD);

export function coverageOf(root: string): string {
  const { countries, withPlaces, compiled, facts } = inputsOf(root, 'src/papers/residence/residence.json');
  return serializeBy('papers.residence', residenceCoverage(countries, withPlaces, compiled, facts));
}
