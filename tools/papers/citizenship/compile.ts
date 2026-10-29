import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };

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
 */
export const SOURCES = 'research/sources/papers/citizenship';
export const OUTPUT = 'src/papers/citizenship/citizenship.json';

export interface State {
  years: number | 'none';
  renounce: boolean | null;
  lapses: boolean | null;
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
  return { years: years as State['years'], renounce, lapses: flag(file['lapses'], `${code}'s loss on taking another citizenship`) };
}

/** A territory's file naming the state whose nationality its people hold. */
export function compileOf(code: string, file: Record<string, unknown>): Of {
  checkCountry(code, file);
  const of = String(file['nationalityOf']);
  if (!Object.hasOwn(countries, of) || of === code) throw new Error(`${code}'s people hold another country's nationality on the map, not ${of}`);
  if ('years' in file || 'renounce' in file || 'lapses' in file) throw new Error(`${code}'s people hold ${of}'s nationality, so its rules are ${of}'s`);
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
