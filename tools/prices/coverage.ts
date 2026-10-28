import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The prices' coverage matrix (coverage/prices-countries.json), from the levels and the register: a country with a
 * level is researched, citing the World Bank's levels (world.prices.ppp) and the currency the gazetteer and ISO 4217
 * give it; one without is blocked where the register holds its blocker (world.prices.blocked.<code>), else pending; a
 * country with no place of its own is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/prices-countries.json';

const T = 'tests/world/prices/prices.test.ts';
export const TESTS = [`${T}::the prices > are the World Bank's levels, in each country's own currency`, `${T}::the prices > at every place on the map`];
/** And a blocked row's: the test that shows the player told its prices aren't kept. */
export const TOLD = `${T}::the prices > tell the player where a country's aren't kept`;
export const NO_PLACES = 'tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own';
/** The facts a level stands on besides its own: the gazetteer's currencies (R-0032) and ISO 4217's (R-0026). */
export const CURRENCY_FACTS = ['world.gazetteer.countries', 'money.iso4217.list-one'];

export type Row =
  | { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] }
  | { key: string; status: 'pending' }
  | { key: string; status: 'proven'; tests: string[] };

export function pricesCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, levels: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const ppp = facts.get('world.prices.ppp');
    if (levels.has(key) && ppp !== undefined) return { key, status: 'researched', register: [ppp, ...CURRENCY_FACTS.map((f) => facts.get(f) as string)].sort(), tests: TESTS };
    const blocker = facts.get(`world.prices.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'world.prices', axis: 'country', rows }, null, 1)}\n`;

/** The prices' coverage from the levels, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const levels = new Set(Object.keys(read('src/world/prices/levels.json') as object));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(pricesCoverage(countries, withPlaces, levels, facts));
}
