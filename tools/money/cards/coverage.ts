import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';

/**
 * The cards' coverage matrix (coverage/cards-countries.json), from the compiled cards and the register: a country
 * compiled is researched, citing its own file (money.cards.<code>); one not compiled is blocked where the register holds
 * its blocker (money.cards.blocked.<code>), else pending; a country with no place of its own is proven by the
 * gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/cards-countries.json';

const T = 'tests/money/cards/cards.test.ts';
export const TESTS = [`${T}::cards > name each country's credit cards, their interest and their fees`, 'tests/money/cards/cards.places.test.ts::cards > for every place on the map'];
/** And a blocked row's: the test that shows the player told its cards aren't kept. */
export const TOLD = `${T}::cards > tell the player what the game doesn't know`;

export function cardsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`money.cards.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.cards.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.cards', axis: 'country', rows }, null, 1)}\n`;

/** The cards' coverage from the compiled cards, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const cards = read('src/money/cards/cards.json') as { countries: Record<string, unknown> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(cardsCoverage(countries, withPlaces, new Set(Object.keys(cards.countries)), facts));
}
