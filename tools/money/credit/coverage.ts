import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';

/**
 * The credit records' coverage matrix (coverage/credit-countries.json), from the compiled records and the register: a country
 * compiled is researched, citing its own file (money.credit.<code>); one not compiled is blocked where the register holds
 * its blocker (money.credit.blocked.<code>), else pending; a country with no place of its own is proven by the
 * gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/credit-countries.json';

const T = 'tests/money/credit/credit.test.ts';
export const TESTS = [`${T}::credit > name each country's credit bureau, when it reports a late payment and how long it keeps it`, 'tests/money/credit/credit.places.test.ts::credit > for every place on the map'];
/** And a blocked row's: the test that shows the player told its credit records aren't kept. */
export const TOLD = `${T}::credit > tell the player what the game doesn't know`;

export function creditCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`money.credit.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.credit.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.credit', axis: 'country', rows }, null, 1)}\n`;

/** The credit records' coverage from the compiled records, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const credit = read('src/money/credit/credit.json') as { countries: Record<string, unknown> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(creditCoverage(countries, withPlaces, new Set(Object.keys(credit.countries)), facts));
}
