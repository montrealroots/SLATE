import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCurrency, rational, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the index units fees are set in (src/money/units/units.json), from the research's files, one per unit
 * (research/sources/money/units/<UNIT>.json, register fact money.units.<UNIT>), each checked against the SHA-256 its
 * register entry cites before a byte of it is read. A unit's file gives its name as its publisher gives it, the
 * currency it is worth an amount of, and its official values (`values`: the amount one unit is worth, from the day the
 * publisher says it applies, each holding until the next): Mexico's UMA as INEGI publishes it, Uruguay's UR as its INE
 * republishes the Banco Hipotecario's. Made on 2026-10-30, when fees set in such a unit (a Mexican state's licence at 6
 * UMA) stood null: a peso figure worked from this year's value is a number typed where a sum belongs, and goes stale
 * when the unit moves.
 */
export const SOURCES = 'research/sources/money/units';
export const OUTPUT = 'src/money/units/units.json';

export interface Step {
  /** The day the value applies from (YYYY-MM-DD); it holds until the next. */
  from: string;
  /** What one unit is worth in its currency, as a decimal written out. */
  value: string;
}

export interface Unit {
  /** The register fact the values come from. */
  fact: string;
  name: string;
  currency: CurrencyCode;
  values: Step[];
  /**
   * The amount a fee worked from it is rounded down to a multiple of, where its law sets one (the Northern Territory's
   * whole dollar).
   */
  roundDown?: string;
}

const DECIMAL = /^\d+(\.\d+)?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A decimal written out, above nothing. */
export const positive = (s: unknown): s is string => typeof s === 'string' && DECIMAL.test(s) && rational(s).num > 0n;

/** A unit's file: its name, its currency and its values in day order. */
export function compileUnit(key: string, file: { [key: string]: unknown }): Unit {
  if (!/^[A-Z]{2,4}$/.test(key) || file['unit'] !== key) throw new Error(`${key}'s file is for ${String(file['unit'])}`);
  for (const k of Object.keys(file)) if (!['unit', 'name', 'currency', 'values', 'roundDown', 'note', 'sources'].includes(k)) throw new Error(`${key}'s file has no term ${k}`);
  const { name, currency, values, roundDown } = file;
  if (typeof name !== 'string' || name === '') throw new Error(`${key} is named as its publisher names it`);
  if (typeof currency !== 'string' || !isCurrency(currency)) throw new Error(`${key} is worth an amount of a currency`);
  if (!Array.isArray(values) || values.length === 0) throw new Error(`${key} gives at least one value`);
  let last = '';
  const steps = values.map((v: { from?: unknown; value?: unknown }): Step => {
    if (!DAY.test(String(v.from)) || (v.from as string) <= last) throw new Error(`${key}'s values are each from a day (YYYY-MM-DD), in order`);
    if (!positive(v.value)) throw new Error(`${key}'s value from ${v.from} is a decimal above 0`);
    last = v.from as string;
    return { from: last, value: v.value };
  });
  const out: Unit = { fact: `money.units.${key}`, name, currency, values: steps };
  if (roundDown !== undefined) {
    if (!positive(roundDown)) throw new Error(`${key} rounds a fee down to a multiple of a decimal above 0`);
    out.roundDown = roundDown;
  }
  return out;
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

/** Every unit's values, of the files the register cites and checks; none where the directory isn't there yet. */
export function readUnits(root: string): { units: Record<string, Unit> } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.units.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const out: Record<string, Unit> = {};
  if (!existsSync(join(root, SOURCES))) return { units: out };
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const path = `${SOURCES}/${name}`;
    const bytes = readFileSync(join(root, path));
    const sha = shas.get(path);
    if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
    out[name.slice(0, -'.json'.length)] = compileUnit(name.slice(0, -'.json'.length), JSON.parse(bytes.toString('utf8')) as { [key: string]: unknown });
  }
  return { units: out };
}

export const serialize = (units: { units: Record<string, Unit> }) => `${JSON.stringify(units, null, 1)}\n`;
