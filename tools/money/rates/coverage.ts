import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';

/**
 * The exchange rates' coverage matrix (coverage/rates-countries.json), by the country whose money a life is kept in: a
 * country whose currency has rates compiled is researched, citing its currency's file (money.rates.<CUR>); one in US
 * dollars is proven by the test that the dollar is the unit; one whose currency has none is blocked where the register
 * holds its currency's blocker (money.rates.blocked.<CUR>), else pending; a country with no place of its own is proven by
 * the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/rates-countries.json';

const T = 'tests/money/rates/rates.test.ts';
export const TESTS = [`${T}::rates > give each currency's rate against the dollar on a day, from the rates its source gives`, 'tests/money/rates/rates.places.test.ts::rates > for every place on the map'];
/** A dollar country's: the test that the dollar is the unit. */
export const UNIT = `${T}::rates > keep the dollar as the unit`;
/** And a blocked row's: the test that shows the player told the rate isn't known. */
export const TOLD = `${T}::rates > tell the player what the game doesn't know`;

export function ratesCoverage(countries: { readonly [key: string]: string }, withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return Object.entries(countries).map(([key, currency]): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    if (currency === 'USD') return { key, status: 'proven', tests: [UNIT] };
    const own = facts.get(`money.rates.${currency}`);
    if (compiled.has(currency) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.rates.blocked.${currency}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.rates', axis: 'country', rows }, null, 1)}\n`;

/** The rates' coverage from the compiled rates, the gazetteer's countries, currencies and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.fromEntries(Object.entries(read('src/world/gazetteer/countries.json') as { [k: string]: { currency: string } }).map(([k, v]) => [k, v.currency]));
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const rates = read('src/money/rates/rates.json') as { currencies: Record<string, unknown> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(ratesCoverage(countries, withPlaces, new Set(Object.keys(rates.currencies)), facts));
}
