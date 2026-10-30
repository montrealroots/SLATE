import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, type CurrencyCode, type Money } from '../../../src/core/money/money.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { nothingElse, UNITS, type Unit } from '../passports/compile.ts';

/**
 * Compiles the citizenship rules the papers engine reads (src/papers/citizenship/citizenship.json) from the research's
 * files, one per country (research/sources/papers/citizenship/<CC>.json, register fact papers.citizenship.<CC>), each
 * checked against the SHA-256 its register entry cites before a byte of it is read. A state gives its ordinary
 * naturalisation, the years of residence it asks (`years`, or "none" where it naturalises no one by residence; a state
 * whose years aren't known is a blocker, not a file) and whether the applicant must give up every other citizenship
 * (`renounce`), and whether its own citizens lose its citizenship on voluntarily taking another (`lapses`); what the
 * research couldn't read of those two is null. A territory whose
 * people hold a state's nationality says whose (`nationalityOf`), and that state's rules are its own, except that
 * living there may not count towards that state's naturalisation (`residenceCounts: false`, as Svalbard).
 *
 * From 2026-10-30 (the lead's forms, FORMS.md "papers.citizenship (extended)"), a state may also give how citizenship
 * comes at birth (`atBirth`: by birth in its territory unconditionally, on a condition the law states in `soilIf`, or
 * not at all; by descent from either parent, from the father only, or not at all, with any limit on a child born abroad
 * in `descentAbroad`), and for its naturalisation the fee (`fee` in `currency`'s major units), the longest it takes
 * (`within`, the passports' units) and the tests it asks (`test`, language and civics; empty where it asks none). A
 * state that naturalises no one by residence has no fee, time or test; a territory has none of these, its state's
 * being its own.
 */
export const SOURCES = 'research/sources/papers/citizenship';
export const OUTPUT = 'src/papers/citizenship/citizenship.json';

export const SOIL = ['unconditional', 'conditional', 'none'] as const;
export const DESCENT = ['either parent', 'father', 'none'] as const;
export const TEST_KINDS = ['language', 'civics'] as const;
export type Test = (typeof TEST_KINDS)[number];

/** How citizenship comes at birth: by birth in the territory, and by descent. */
export interface AtBirth {
  soil: (typeof SOIL)[number];
  /** The condition birth in the territory gives citizenship on, as the law states it. */
  soilIf?: string;
  descent: (typeof DESCENT)[number];
  /** The limit on citizenship by descent for a child born abroad, as the law states it. */
  descentAbroad?: string;
}

export interface State {
  years: number | 'none';
  renounce: boolean | null;
  lapses: boolean | null;
  atBirth?: AtBirth;
  /** Naturalisation's fee, in the currency the state sets it in. */
  fee?: Money;
  /** The longest naturalisation takes, as published. */
  within?: { n: number; unit: Unit };
  /** The tests naturalisation asks, none where empty. */
  test?: Test[];
}

export interface Of {
  nationalityOf: string;
  residenceCounts?: false;
}

export type Entry = State | Of;

function checkCountry(code: string, file: Record<string, unknown>): void {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
}

const flag = (v: unknown, what: string): boolean | null => {
  if (v === null || typeof v === 'boolean') return v;
  throw new Error(`${what} is true, false or null`);
};

/** One state's rules, checked through. */
export function compileState(code: string, file: Record<string, unknown>): State {
  checkCountry(code, file);
  const { years } = file;
  if (!(years === 'none' || (Number.isInteger(years) && (years as number) > 0 && (years as number) <= 50))) {
    throw new Error(`${code}'s years of residence are a whole number from 1 to 50, or "none"`);
  }
  const renounce = flag(file['renounce'], `${code}'s renunciation`);
  if (years === 'none' && renounce !== null) throw new Error(`${code} naturalises no one by residence, so asks no one to renounce`);
  const out: State = { years: years as State['years'], renounce, lapses: flag(file['lapses'], `${code}'s loss on taking another citizenship`) };
  if (file['atBirth'] !== undefined) out.atBirth = atBirth(file['atBirth'], `${code}'s citizenship at birth`);
  const { currency, fee, within, test } = file;
  if (years === 'none' && [currency, fee, within, test].some((v) => v !== undefined)) throw new Error(`${code} naturalises no one by residence, so has no fee, time or test`);
  if (fee !== undefined) {
    if (typeof currency !== 'string' || !isCurrency(currency)) throw new Error(`${code}'s naturalisation fee is in ${String(currency)}, not a currency in use`);
    if (typeof fee !== 'string' || !/^\d+(\.\d+)?$/.test(fee)) throw new Error(`${code}'s naturalisation fee is an amount written out in major units`);
    out.fee = fromMajor(currency as CurrencyCode, fee);
  } else if (currency !== undefined) throw new Error(`${code} names a currency only for its naturalisation fee`);
  if (within !== undefined) {
    if (!(isRecord(within) && Number.isSafeInteger(within['n']) && (within['n'] as number) >= 0 && UNITS.includes(within['unit'] as Unit) && Object.keys(within).length === 2)) {
      throw new Error(`${code}'s naturalisation takes a whole number of minutes, hours, days, working days, weeks or months`);
    }
    out.within = { n: within['n'] as number, unit: within['unit'] as Unit };
  }
  if (test !== undefined) {
    if (!Array.isArray(test) || !test.every((t) => (TEST_KINDS as readonly unknown[]).includes(t)) || new Set(test).size !== test.length) {
      throw new Error(`${code}'s naturalisation tests are distinct of ${TEST_KINDS.join(', ')}, or none`);
    }
    out.test = test as Test[];
  }
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** How citizenship comes at birth, checked through: a condition stated only for a conditional soil, a limit abroad only for a descent. */
export function atBirth(a: unknown, what: string): AtBirth {
  if (!isRecord(a)) throw new Error(`${what} is not an object`);
  const { soil, soilIf, descent, descentAbroad, ...rest } = a;
  nothingElse(rest, what);
  if (!(SOIL as readonly unknown[]).includes(soil)) throw new Error(`${what} by birth in the territory is ${SOIL.join(', ')}, not ${String(soil)}`);
  if (!(DESCENT as readonly unknown[]).includes(descent)) throw new Error(`${what} by descent is ${DESCENT.join(', ')}, not ${String(descent)}`);
  const out: AtBirth = { soil: soil as AtBirth['soil'], descent: descent as AtBirth['descent'] };
  if (soil === 'conditional') {
    if (!isText(soilIf)) throw new Error(`${what} by birth in the territory is conditional, so states its condition (soilIf)`);
    out.soilIf = soilIf;
  } else if (soilIf !== undefined) throw new Error(`${what} states a condition only for a conditional birth in the territory`);
  if (descentAbroad !== undefined) {
    if (descent === 'none' || !isText(descentAbroad)) throw new Error(`${what} states a limit abroad only as text, and only for a descent`);
    out.descentAbroad = descentAbroad;
  }
  return out;
}

/** A territory's file naming the state whose nationality its people hold. */
export function compileOf(code: string, file: Record<string, unknown>): Of {
  checkCountry(code, file);
  const of = String(file['nationalityOf']);
  if (!Object.hasOwn(countries, of) || of === code) throw new Error(`${code}'s people hold another country's nationality on the map, not ${of}`);
  if (['years', 'renounce', 'lapses', 'atBirth', 'currency', 'fee', 'within', 'test'].some((k) => k in file)) throw new Error(`${code}'s people hold ${of}'s nationality, so its rules are ${of}'s`);
  if (!('residenceCounts' in file)) return { nationalityOf: of };
  if (file['residenceCounts'] !== false) throw new Error(`${code}'s file says living there doesn't count towards ${of}'s naturalisation only as residenceCounts: false`);
  return { nationalityOf: of, residenceCounts: false };
}

/** Every state named is compiled in its own right. */
export function checkNationalities(rules: Readonly<Record<string, Entry>>): void {
  for (const [code, e] of Object.entries(rules)) {
    if (!('nationalityOf' in e)) continue;
    const state = rules[e.nationalityOf];
    if (state === undefined || 'nationalityOf' in state) throw new Error(`${code}'s people hold ${e.nationalityOf}'s nationality, which the game doesn't keep in its own right`);
  }
}

/** The citizenship rules of every file the register cites and checks. */
export function readCitizenship(root: string): Record<string, Entry> {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { fact: string; value?: { file?: string; sha256?: string } }[] };
  const cited = new Map(register.entries.flatMap((e) => (e.fact.startsWith('papers.citizenship.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const rules: Record<string, Entry> = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const path = `${SOURCES}/${name}`;
    const bytes = readFileSync(join(root, path));
    const sha = cited.get(path);
    if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
    const code = name.slice(0, -'.json'.length);
    const file = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    rules[code] = 'nationalityOf' in file ? compileOf(code, file) : compileState(code, file);
  }
  checkNationalities(rules);
  return rules;
}

export const serialize = (rules: Record<string, Entry>) => `${JSON.stringify(rules, null, 1)}\n`;
