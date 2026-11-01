import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, FACT } from './compile.ts';

/**
 * The markets' coverage matrix (coverage/markets-countries.json), a row for every country and territory of the map:
 * the US, the UK and Canada on the minimums the engine keeps itself (R-4614, person.work.actor.calibration); every
 * other one whose research the register cites (person.markets.<code>) with nothing blocked is researched, compiled or
 * read as saying why not; one with blockers (person.markets.blocked.<code>) is blocked, citing them and its research,
 * the player told what isn't known; one with neither is pending.
 */
export const COVERAGE = 'coverage/markets-countries.json';
export const COUNTRIES = 'src/world/gazetteer/countries.json';
/** The countries whose agreements the engine keeps itself, and the research they stand on. */
export const KEPT_COUNTRIES = ['CA', 'GB', 'US'] as const;
export const KEPT_FACT = 'person.work.actor.calibration';

const T = 'tests/person/acting/markets.test.ts';
const A = 'tests/person/acting/acting.test.ts';
export const TESTS = [
  `${T}::the markets > are each country's own, every minimum as the research gives it`,
  `${T}::the markets > read every country the register cites, or say why not`,
  `${T}::a market's part > is paid at its agreement's minimum, by medium, role, term and tier`,
];
/** And a blocked row's: the test that shows the player told what of a market isn't known. */
export const TOLD = `${T}::a market's part > tells the player what of a market isn't known`;
/** The kept agreements' rows: the tests of their pay. */
export const KEPT_TESTS = [
  `${A}::a part's pay > is SAG-AFTRA's day or week minimum for the date, refused before the tables, the last kept after`,
  `${A}::a part's pay > is Pact/Equity's for a UK feature of £3 million and over, refused under it`,
  `${A}::a part's pay > is UK Theatre's commercial week by the venue's seats, rehearsal weeks at the rehearsal rate`,
  `${A}::a part's pay > is ACTRA's principal by the day or week, a part of five lines or fewer by the day`,
];

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

export function marketsCoverage(countries: readonly string[], facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    const kept = facts.get(KEPT_FACT);
    if ((KEPT_COUNTRIES as readonly string[]).includes(key) && kept !== undefined) return { key, status: 'researched', register: [kept], tests: KEPT_TESTS };
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.acting', axis: 'country', rows }, null, 1)}\n`;

/** The coverage of every country of the map from the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read(COUNTRIES) as object);
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(marketsCoverage(countries, facts));
}
