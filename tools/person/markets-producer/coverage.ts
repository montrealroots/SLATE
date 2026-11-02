import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, CALIBRATED, FACT, KEPT } from './compile.ts';

/**
 * The producer's markets' coverage matrix (coverage/markets-producer-countries.json), a row per country of the map (the
 * gazetteer's 252): one whose research the register cites (person.markets.producer.<code>) with nothing blocked is
 * researched; one with blockers (person.markets.producer.blocked.<code>) is blocked, citing them and its research where
 * the register cites one, the player told what isn't known; the UK, the market the engine keeps itself, is researched on
 * the producer's calibration (R-4612); a country with none of these is pending.
 */
export const COVERAGE = 'coverage/markets-producer-countries.json';
export const COUNTRIES = 'src/world/gazetteer/countries.json';

const T = 'tests/person/producing/markets.test.ts';
export const TESTS = [`${T}::the markets > are each country's own, every term as the research gives it`, `${T}::a market's project > is planned, funded and released on its market's terms`];
/** And a blocked row's: the test that shows the player told what of the market isn't known. */
export const TOLD = `${T}::a market's project > tells the player what of a market isn't known`;

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

export function marketsCoverage(countries: readonly string[], facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    const [own, blocker] = [facts.get(key === KEPT ? CALIBRATED : `${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.producing', axis: 'country', rows }, null, 1)}\n`;

/** The coverage from the map's countries and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read(COUNTRIES) as object);
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(marketsCoverage(countries, facts));
}
