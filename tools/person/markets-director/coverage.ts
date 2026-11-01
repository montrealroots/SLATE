import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, FACT, OUTPUT, type Markets } from './compile.ts';

/**
 * The director's markets' coverage matrix (coverage/markets-director-countries.json), a row per market the director's
 * engine reads beyond the US: one whose research the register cites (person.markets.director.<code>) with nothing
 * blocked is researched; one with blockers (person.markets.director.blocked.<code>) is blocked, citing them and its
 * research, the player told what isn't known; a market compiled with neither cited is pending.
 */
export const COVERAGE = 'coverage/markets-director-countries.json';

const T = 'tests/person/directing/markets.test.ts';
export const TESTS = [`${T}::the director's markets > are each country's own, every fee and period as the research gives it`, `${T}::a film in a market > is paid its agreement's minimum, by form, tier, date and the days it works`];
/** And a blocked row's: the test that shows the player told what of the market isn't known. */
export const TOLD = `${T}::a film in a market > tells the player what of a market isn't known`;

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

export function marketsCoverage(markets: readonly string[], facts: ReadonlyMap<string, string>): Row[] {
  return markets.map((key): Row => {
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.directing', axis: 'market', universe: { keys: rows.map((r) => r.key) }, rows }, null, 1)}\n`;

/** The coverage from the compiled markets and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const markets = Object.keys((read(OUTPUT) as Markets).markets);
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(marketsCoverage(markets, facts));
}
