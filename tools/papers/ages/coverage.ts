import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverageBy, inputsOf, serializeBy } from '../numbers/coverage.ts';
import type { Row } from '../passports/coverage.ts';
import { READINGS } from './person.ts';

/**
 * The ages' coverage matrix (coverage/ages-countries.json), from the compiled ages and the register: a country compiled
 * with its majority (its own, unless a region's is unread; or, where its own is null, every region's) and its working age
 * both read is researched, citing its own file (papers.ages.<code>); one not compiled, or with either unread, is blocked where the register holds its blocker (papers.ages.blocked.<code>),
 * else pending; a country with no place of its own is proven by the gazetteer's test that it has none. A row whose
 * country is read from the person research too (./person.ts) cites that file's entry (person.ages.<code>) beside its own.
 */
export const COVERAGE = 'coverage/ages-countries.json';

const T = 'tests/papers/ages/ages.test.ts';
export const TESTS = [`${T}::the ages > are each country's own`, 'tests/papers/ages/ages.places.test.ts::the ages > for every place on the map'];
/** And a blocked row's: the test that shows the player told what the game doesn't know. */
export const TOLD = `${T}::the ages > tell the player what the game doesn't know`;

export const agesCoverage = coverageBy('papers.ages', TESTS, TOLD);

type Read = { majority: unknown; regions?: Readonly<Record<string, unknown>>; work: unknown };

/** Whether a country's majority is read wherever it holds: its own with no region unread, or every one of its regions'. */
export const majorityRead = (code: string, a: Read, regions: readonly string[]): boolean => {
  const own = Object.values(a.regions ?? {});
  if (own.includes(null)) return false;
  const mine = regions.filter((r) => r.startsWith(`${code}.`));
  return a.majority !== null || (mine.length > 0 && mine.every((r) => a.regions?.[r] !== undefined));
};

/** Only a country whose majority and working age are both read is held compiled for the matrix. */
export const whole = (ages: Readonly<Record<string, Read>>, regions: readonly string[]): Set<string> =>
  new Set(Object.entries(ages).flatMap(([code, a]) => (majorityRead(code, a, regions) && a.work !== null ? [code] : [])));

/** Each row of a country the person research is read for cites its entry too. */
export const withPerson = (rows: readonly Row[], read: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] =>
  rows.map((row) => {
    const person = facts.get(`person.ages.${row.key}`);
    return 'register' in row && read.has(row.key) && person !== undefined ? { ...row, register: [...row.register, person] } : row;
  });

export function coverageOf(root: string): string {
  const { countries, withPlaces, facts } = inputsOf(root, 'src/papers/ages/ages.json');
  const ages = JSON.parse(readFileSync(join(root, 'src/papers/ages/ages.json'), 'utf8')) as Parameters<typeof whole>[0];
  const regions = Object.keys(JSON.parse(readFileSync(join(root, 'src/world/gazetteer/regions.json'), 'utf8')) as object);
  return serializeBy('papers.ages', withPerson(agesCoverage(countries, withPlaces, whole(ages, regions), facts), new Set(Object.keys(READINGS)), facts));
}
