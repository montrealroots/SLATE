import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, FACT, OUTPUT, type Tax } from './compile.ts';

/**
 * The tax's coverage matrix (coverage/tax-countries.json), a row per country of the map: one whose research the
 * register cites (money.tax.<code>) with nothing blocked is researched; one with blockers (money.tax.blocked.<code>) is
 * blocked, citing them and its research, the player told what isn't known; a country neither researched nor blocked is
 * pending, and the player is told its tax isn't known to the game.
 */
export const COVERAGE = 'coverage/tax-countries.json';

const T = 'tests/money/tax/tax.test.ts';
export const TESTS = [`${T}::a country's tax > is each country's own, every figure as the research gives it`, `${T}::pay > is paid into the ledger less what the work's country withholds`, `${T}::the year's reckoning > taxes the year's income at the resident's scale less what was withheld`];
/** And a blocked row's: the test that shows the player told what of a country's tax isn't known. */
export const TOLD = `${T}::a country's tax > tells the player what of it isn't known`;

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

export function taxCoverage(all: readonly string[], compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return all.map((key): Row => {
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined || !compiled.has(key) ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'money.tax', axis: 'country', rows }, null, 1)}\n`;

/** The coverage from the compiled tax, the gazetteer's countries and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const all = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const tax = read(OUTPUT) as Tax;
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(taxCoverage(all, new Set([...Object.keys(tax.countries), ...tax.noState]), facts));
}
