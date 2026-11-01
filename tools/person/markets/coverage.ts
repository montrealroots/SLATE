import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, FACT, OUTPUT, type Markets } from './compile.ts';

/**
 * The markets' coverage matrix (coverage/markets-countries.json), a row per market the actor's engine reads beyond the
 * US, the UK and Canada: one whose research the register cites (person.markets.<code>) with nothing blocked is
 * researched; one with blockers (person.markets.blocked.<code>) is blocked, citing them and its research, the player
 * told what isn't known; a market compiled with neither cited is pending.
 */
export const COVERAGE = 'coverage/markets-countries.json';

const T = 'tests/person/acting/markets.test.ts';
export const TESTS = [`${T}::the markets > are each country's own, every minimum as the research gives it`, `${T}::a market's part > is paid at its agreement's minimum, by medium, role, term and tier`];
/** And a blocked row's: the test that shows the player told what of the market isn't known. */
export const TOLD = `${T}::a market's part > tells the player what of a market isn't known`;

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

export function marketsCoverage(markets: readonly string[], facts: ReadonlyMap<string, string>): Row[] {
  return markets.map((key): Row => {
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.acting', axis: 'market', universe: { keys: rows.map((r) => r.key) }, rows }, null, 1)}\n`;

/** The coverage from the compiled markets and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const markets = Object.keys((read(OUTPUT) as Markets).markets);
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(marketsCoverage(markets, facts));
}
