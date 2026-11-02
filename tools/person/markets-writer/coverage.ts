import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, FACT } from './compile.ts';

/**
 * The screenwriter's markets' coverage matrix (coverage/markets-writer-countries.json), a row per country of the map:
 * the US the WGA's, kept by the engine (its research, person.roles.screenwriter, researched); a country whose research
 * the register cites (person.markets.writer.<code>) with nothing blocked is researched; one with blockers
 * (person.markets.writer.blocked.<code>) is blocked, citing them and its research where the register cites it, the
 * player told what isn't known; a country with neither cited is pending.
 */
export const COVERAGE = 'coverage/markets-writer-countries.json';
export const COUNTRIES = 'src/world/gazetteer/countries.json';
/** The country the engine keeps itself, and the register's fact for its research: the WGA's MBA (R-4241). */
export const KEPT_COUNTRY = 'US';
export const KEPT_FACT = 'person.roles.screenwriter';

const T = 'tests/person/work/markets.test.ts';
export const TESTS = [
  `${T}::the markets > are each country's own, every minimum as the research gives it`,
  `${T}::the markets > cover every country on the map: the WGA the US, each other one its research`,
  `${T}::a script sold in a market > is paid its agreement's minimum, by form and tier, on the day it sells`,
];
/** And a blocked row's: the test that shows the player told what of the market isn't known. */
export const TOLD = `${T}::a script sold in a market > tells the player what of a market isn't known`;
/** The US's: the test that holds the WGA's minimums kept. */
export const KEPT_TESTS = [`${T}::the markets > keeps the WGA's own, the US's, in English, and refuses an agreement there's none of`];

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

export function marketsCoverage(countries: readonly string[], facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    const kept = key === KEPT_COUNTRY ? facts.get(KEPT_FACT) : undefined;
    if (kept !== undefined) return { key, status: 'researched', register: [kept], tests: KEPT_TESTS };
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.work', axis: 'country', rows }, null, 1)}\n`;

/** The coverage from the map's countries and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read(COUNTRIES) as Record<string, unknown>);
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(marketsCoverage(countries, facts));
}
