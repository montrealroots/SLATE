import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';

/**
 * The banks' coverage matrix (coverage/banks-countries.json), from the compiled banks and the register: a country
 * compiled is researched, citing its own file (money.banks.<code>); one not compiled is blocked where the register holds
 * its blocker (money.banks.blocked.<code>), else pending; a country with no place of its own is proven by the
 * gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/banks-countries.json';

const T = 'tests/money/banks/banks.test.ts';
export const TESTS = [`${T}::banks > name each country's banks and what their everyday account costs`, 'tests/money/banks/banks.places.test.ts::banks > for every place on the map'];
/** And a blocked row's: the test that shows the player told its banks aren't kept. */
export const TOLD = `${T}::banks > tell the player what the game doesn't know`;

export function banksCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`money.banks.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.banks.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.banks', axis: 'country', rows }, null, 1)}\n`;

/** The banks' coverage from the compiled banks, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const banks = read('src/money/banks/banks.json') as { countries: Record<string, unknown> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(banksCoverage(countries, withPlaces, new Set(Object.keys(banks.countries)), facts));
}
