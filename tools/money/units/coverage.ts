import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Row } from '../../papers/passports/coverage.ts';

/**
 * The index units' coverage matrix (coverage/units-units.json): its keys are the units the game's fees are set in (each
 * a `unit` a compiled licence's fee names), so every unit a fee names has a row; a unit compiled is researched, citing
 * its own file (money.units.<UNIT>); one not compiled is blocked where the register holds its blocker
 * (money.units.blocked.<UNIT>), else pending.
 */
export const COVERAGE = 'coverage/units-units.json';

const T = 'tests/money/units/units.test.ts';
export const TESTS = [`${T}::units > give a count of a unit in its currency on a day, from its publisher's values`];
/** And a blocked row's: the test that shows a fee in a unit not held is no amount. */
export const TOLD = `${T}::units > give nothing for a unit the game doesn't hold`;

export function unitsCoverage(named: readonly string[], compiled: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return named.map((key): Row => {
    const own = facts.get(`money.units.${key}`);
    if (compiled.has(key) && own !== undefined) return { key, status: 'researched', register: [own], tests: TESTS };
    const blocker = facts.get(`money.units.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

/** The units a compiled file's fees name: every `unit` beside a `count`, anywhere in it, once each, in order. */
export function unitsNamed(value: unknown): string[] {
  const found = new Set<string>();
  // An array's items are its values, so one walk reads lists and objects alike.
  const walk = (v: unknown): void => {
    if (typeof v !== 'object' || v === null) return;
    const o = v as Record<string, unknown>;
    if (typeof o['unit'] === 'string' && typeof o['count'] === 'string') found.add(o['unit']);
    Object.values(o).forEach(walk);
  };
  walk(value);
  return [...found].sort();
}

export const serializeCoverage = (named: readonly string[], rows: readonly Row[]) =>
  `${JSON.stringify({ engine: 'money.units', axis: 'unit', universe: { keys: named }, rows }, null, 1)}\n`;

/** The units' coverage from the compiled licences' fees, the compiled units and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const named = unitsNamed(read('src/papers/licence/licence.json'));
  const units = read('src/money/units/units.json') as { units: Record<string, unknown> };
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(named, unitsCoverage(named, new Set(Object.keys(units.units)), facts));
}
