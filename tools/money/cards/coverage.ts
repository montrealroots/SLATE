import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';
import { noBankIn } from '../formats/coverage.ts';

/**
 * The cards' coverage matrix (coverage/cards-countries.json), from the compiled cards and the register: a country
 * compiled is researched, citing its own file (money.cards.<code>), its cards or its source's word that no bank there
 * offers one; a place with no bank at all is researched on the banks' fact that says so (money.banks.<code>), no card
 * being had where no account is (from 2026-10-31; Pitcairn's row was blocked until then); one not compiled is blocked
 * where the register holds its blocker (money.cards.blocked.<code>), else pending; a country with no place of its own
 * is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/cards-countries.json';

const T = 'tests/money/cards/cards.test.ts';
export const TESTS = [`${T}::cards > name each country's credit cards, their interest and their fees`, 'tests/money/cards/cards.places.test.ts::cards > for every place on the map'];
/** And a blocked row's: the test that shows the player told its cards aren't kept. */
export const TOLD = `${T}::cards > tell the player what the game doesn't know`;
/** And a row with no card to be had: the test that shows the player told. */
export const NO_CARD = 'tests/money/cards/cards.none.test.ts::a place where no bank offers a card > has none to take out, and the player is told';

export function cardsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>, noCard: ReadonlySet<string>, noBank: ReadonlySet<string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const own = facts.get(`money.cards.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: noCard.has(key) ? [...TESTS, NO_CARD] : TESTS };
    const banks = facts.get(`money.banks.${key}`);
    if (noBank.has(key) && banks !== undefined) return { key, status: 'researched', register: [banks], tests: [...TESTS, NO_CARD] };
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
  const cards = read('src/money/cards/cards.json') as { countries: Record<string, readonly unknown[]> };
  const banks = read('src/money/banks/banks.json') as { countries: Record<string, readonly unknown[]> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(cardsCoverage(countries, withPlaces, new Set(Object.keys(cards.countries)), facts, noBankIn(cards.countries), noBankIn(banks.countries)));
}
