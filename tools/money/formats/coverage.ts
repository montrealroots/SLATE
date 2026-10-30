import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';

/**
 * The account formats' coverage matrix (coverage/formats-countries.json), from the compiled formats and the register: a
 * country compiled is researched, citing its own file (money.formats.<code>), a country under another's IBAN prefix its
 * own (which says so); one not compiled is blocked where the register holds its blocker (money.formats.blocked.<code>),
 * else pending; a country with no place of its own is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/formats-countries.json';

const T = 'tests/money/formats/formats.test.ts';
export const TESTS = [`${T}::account numbers > are drawn and checked in each country's own form`, 'tests/money/formats/formats.places.test.ts::account numbers > for every place on the map'];
/** And a blocked row's: the test that shows the player told its account numbers aren't kept. */
export const TOLD = `${T}::account numbers > tell the player what the game doesn't know`;

export function formatsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`money.formats.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.formats.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.formats', axis: 'country', rows }, null, 1)}\n`;

/** The account formats' coverage from the compiled formats, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const formats = read('src/money/formats/formats.json') as { countries: Record<string, unknown> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(formatsCoverage(countries, withPlaces, new Set(Object.keys(formats.countries)), facts));
}
