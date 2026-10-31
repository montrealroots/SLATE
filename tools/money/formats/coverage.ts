import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES, type Row } from '../../papers/passports/coverage.ts';

/**
 * The account formats' coverage matrix (coverage/formats-countries.json), from the compiled formats and the register: a
 * country compiled is researched, citing its own file (money.formats.<code>), a country under another's IBAN prefix its
 * own (which says so); one not compiled is blocked where the register holds its blocker (money.formats.blocked.<code>),
 * else pending; a country with no place of its own is proven by the gazetteer's test that it has none, and one with no
 * bank of its own (the banks' `none`) is researched on the banks' fact (money.banks.<code>), with nothing to number.
 */
export const COVERAGE = 'coverage/formats-countries.json';

const T = 'tests/money/formats/formats.test.ts';
export const TESTS = [`${T}::account numbers > are drawn and checked in each country's own form`, 'tests/money/formats/formats.places.test.ts::account numbers > for every place on the map'];
/** And a blocked row's: the test that shows the player told its account numbers aren't kept. */
export const TOLD = `${T}::account numbers > tell the player what the game doesn't know`;
/** A no-bank country's: the banks' test that it has none and the player is told. */
export const NO_BANK = "tests/money/banks/banks.none.test.ts::a place with no bank > has no bank to open an account at, and the player is told; its account numbers aren't missing, there are none";

export function formatsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>, noBank: ReadonlySet<string> = new Set()): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const banks = facts.get(`money.banks.${key}`);
    if (noBank.has(key) && banks !== undefined) return { key, status: 'researched', register: [banks], tests: [NO_BANK] };
    const own = facts.get(`money.formats.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.formats.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

/** The countries the compiled banks hold with no bank of their own. */
export const noBankIn = (countries: Readonly<Record<string, readonly unknown[]>>): Set<string> => new Set(Object.entries(countries).flatMap(([k, v]) => (v.length === 0 ? [k] : [])));

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.formats', axis: 'country', rows }, null, 1)}\n`;

/** The account formats' coverage from the compiled formats, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const formats = read('src/money/formats/formats.json') as { countries: Record<string, unknown> };
  const noBank = noBankIn((read('src/money/banks/banks.json') as { countries: Record<string, readonly unknown[]> }).countries);
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(formatsCoverage(countries, withPlaces, new Set(Object.keys(formats.countries)), facts, noBank));
}
