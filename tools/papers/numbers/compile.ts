import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, type Money } from '../../../src/core/money/money.ts';
import { isCheck, type CheckId } from '../../../src/papers/numbers/checks.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { UNITS, type Unit } from '../passports/compile.ts';

/**
 * Compiles the national numbers the papers engine reads (src/papers/numbers/numbers.json) from the research's files,
 * one per country (research/sources/papers/numbers/<CC>.json, register fact papers.numbers.<CC>), each checked against
 * the SHA-256 its register entry cites before a byte of it is read. A country that gives its people a number (the
 * United States' Social Security number, the United Kingdom's National Insurance number, Canada's SIN, Brazil's CPF)
 * names it as the government does, its issuer, its form (its length, or the fewest and most where it varies, a pattern
 * it matches with no spaces or separators, and the check digits it carries, by an algorithm src/papers/numbers/checks.ts
 * computes), when it is given and to whom, and what the research states of its fee, its time and what needs one. A
 * country that gives none says so (`none`); a territory whose people hold another country's says whose (`issuedBy`), as
 * the identity documents do. A term a source doesn't state is left out, never guessed. No file was written when the engine was built (2026-10-30), so the
 * directory may not be there yet; then nothing is compiled.
 */
export const SOURCES = 'research/sources/papers/numbers';
export const OUTPUT = 'src/papers/numbers/numbers.json';

export const WHEN = ['birth', 'registration', 'application', 'work'] as const;
export const WHO = ['citizens', 'residents', 'workers', 'anyone'] as const;
export const NEEDED = ['work', 'bank', 'pay', 'tax', 'health'] as const;

export interface Within {
  n: number;
  unit: Unit;
}

export interface Format {
  /** Its characters, with no spaces or separators: the most, where its length varies. */
  length: number;
  /** The fewest, where its length varies (Panama's cédula, whose parts run one to two, four and four digits). */
  min?: number;
  /** A regular expression the whole number matches, written as the research reads the issuer's form. */
  pattern: string;
  check?: CheckId;
}

export interface NationalNumber {
  /** As the government names it. */
  name: string;
  issuer: string;
  format: Format;
  when: (typeof WHEN)[number];
  /** The youngest it is given to, where the law sets an age. */
  from?: number;
  who: (typeof WHO)[number][];
  /** What it costs where the research states it (nothing is a fee of 0). */
  fee?: Money;
  /** The longest it takes as the issuer publishes it. */
  within?: Within;
  /** What the law or the issuer says needs one. */
  needed?: (typeof NEEDED)[number][];
}

export interface None {
  none: true;
}

export interface Issued {
  issuedBy: string;
}

export type Entry = NationalNumber | None | Issued;

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isWhole = (v: unknown, min: number): v is number => Number.isSafeInteger(v) && (v as number) >= min;

/** Refuses a key the form doesn't have, so a misspelt term isn't read as one the source doesn't state. */
export function only(o: Record<string, unknown>, keys: readonly string[], what: string): void {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${what} has no term ${k}`);
}

/** The file is the country's, and the country is on the map. */
export function checkCountry(code: string, file: Record<string, unknown>): void {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
}

/** The currency a file's amounts are in: the one it names, else its country's. */
export function currencyIn(code: string, file: Record<string, unknown>): string {
  const currency = String(file['currency'] ?? countries[code as keyof typeof countries].currency);
  if (!isCurrency(currency)) throw new Error(`${code}'s fees are in ${currency}, not a currency in use`);
  return currency;
}

/** An amount written out in the currency's major units, nothing or more. */
export function amount(text: unknown, currency: string, what: string): Money {
  if (typeof text !== 'string' || !/^\d+(\.\d+)?$/.test(text)) throw new Error(`${what} is an amount written out in major units`);
  try {
    return fromMajor(currency as never, text);
  } catch {
    throw new Error(`${what} has more decimals than ${currency} has`);
  }
}

/** A time the office publishes: a whole number of one of the passports' units. */
export function within(w: unknown, what: string): Within {
  if (!(isRecord(w) && isWhole(w['n'], 0) && UNITS.includes(w['unit'] as Unit) && Object.keys(w).length === 2)) {
    throw new Error(`${what} is a whole number of minutes, hours, days, working days, weeks or months`);
  }
  return { n: w['n'] as number, unit: w['unit'] as Unit };
}

/** A list of distinct terms from a closed list, at least one. */
export function terms<T extends string>(list: unknown, allowed: readonly T[], what: string): T[] {
  if (!Array.isArray(list) || list.length === 0 || list.some((x) => !allowed.includes(x as T)) || new Set(list).size !== list.length) {
    throw new Error(`${what} is a list of distinct terms from ${allowed.join(', ')}`);
  }
  return list as T[];
}

function format(f: unknown, at: string): Format {
  if (!isRecord(f)) throw new Error(`${at}'s format is not an object`);
  only(f, ['length', 'min', 'pattern', 'check'], `${at}'s format`);
  const { length, min, pattern, check } = f;
  if (!isWhole(length, 1)) throw new Error(`${at}'s number is a whole number of characters long`);
  if (min !== undefined && !(isWhole(min, 1) && min < length)) throw new Error(`${at}'s number is ${String(min)} characters long at the fewest, fewer than its ${length} at the most`);
  if (typeof pattern !== 'string' || pattern === '') throw new Error(`${at}'s number has a pattern`);
  try {
    new RegExp(pattern);
  } catch {
    throw new Error(`${at}'s pattern isn't a regular expression (${pattern})`);
  }
  const out: Format = min === undefined ? { length, pattern } : { length, min, pattern };
  if (check === undefined) return out;
  if (!isCheck(check)) throw new Error(`${at}'s number is checked by ${String(check)}, which the game doesn't compute`);
  return { ...out, check };
}

const TERMS = ['country', 'name', 'issuer', 'format', 'when', 'from', 'who', 'fee', 'within', 'needed', 'currency', 'note', 'sources'];

/** One country's national number, checked through. */
export function compileNumber(code: string, file: Record<string, unknown>): NationalNumber {
  checkCountry(code, file);
  only(file, TERMS, code);
  const { name, issuer, when, from, who, fee, needed } = file;
  if (typeof name !== 'string' || name === '') throw new Error(`${code}'s number needs its name`);
  if (typeof issuer !== 'string' || issuer === '') throw new Error(`${code}'s number needs its issuer`);
  if (!WHEN.includes(when as NationalNumber['when'])) throw new Error(`${code}'s number is given at ${WHEN.join(', ')}`);
  const out: NationalNumber = { name, issuer, format: format(file['format'], code), when: when as NationalNumber['when'], who: terms(who, WHO, `${code}'s who`) };
  if (from !== undefined) {
    if (!isWhole(from, 0)) throw new Error(`${code}'s number is given from a whole age`);
    out.from = from;
  }
  if (fee !== undefined) out.fee = amount(fee, currencyIn(code, file), `${code}'s fee`);
  if (file['within'] !== undefined) out.within = within(file['within'], `${code}'s within`);
  if (needed !== undefined) out.needed = terms(needed, NEEDED, `${code}'s needed`);
  return out;
}

/** A country that gives no national number, checked through. */
export function compileNone(code: string, file: Record<string, unknown>): None {
  checkCountry(code, file);
  if (file['none'] !== true) throw new Error(`${code}'s file says it gives none only as none: true`);
  only(file, ['country', 'none', 'note', 'sources'], `${code}, which gives no number,`);
  return { none: true };
}

/** A territory's file naming the country whose papers its people hold (its `what`: numbers, permits, licences). */
export function compileIssued(code: string, file: Record<string, unknown>, what: string): Issued {
  checkCountry(code, file);
  const issuedBy = String(file['issuedBy']);
  if (!Object.hasOwn(countries, issuedBy) || issuedBy === code) throw new Error(`${code}'s ${what} are given by another country on the map, not ${issuedBy}`);
  only(file, ['country', 'issuedBy', 'note', 'sources'], `${code}, whose ${what} are ${issuedBy}'s,`);
  return { issuedBy };
}

/** Every issuer named keeps its own number, or says it gives none. */
export function checkIssuers(entries: Readonly<Record<string, object>>, what: string): void {
  for (const [code, e] of Object.entries(entries)) {
    if (!('issuedBy' in e)) continue;
    const by = e.issuedBy as string;
    const issuer = entries[by];
    if (issuer === undefined || 'issuedBy' in issuer) throw new Error(`${code}'s ${what} are ${by}'s, which the game doesn't keep in its own right`);
  }
}

/**
 * The research files of an engine the register cites, by the name before `.json`, each checked against the SHA-256
 * its entry cites (facts starting `fact`); none where the directory isn't there yet.
 */
export function readCited(root: string, sources: string, fact: string): [string, Record<string, unknown>][] {
  if (!existsSync(join(root, sources))) return [];
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { fact: string; value?: { file?: string; sha256?: string } }[] };
  const cited = new Map(register.entries.flatMap((e) => (e.fact.startsWith(fact) && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  return readdirSync(join(root, sources)).filter((n) => n.endsWith('.json')).sort().map((name) => {
    const path = `${sources}/${name}`;
    const bytes = readFileSync(join(root, path));
    const sha = cited.get(path);
    if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
    return [name.slice(0, -'.json'.length), JSON.parse(bytes.toString('utf8')) as Record<string, unknown>];
  });
}

/** The national numbers of every file the register cites and checks. */
export function readNumbers(root: string): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [code, file] of readCited(root, SOURCES, 'papers.numbers.')) {
    out[code] = 'issuedBy' in file ? compileIssued(code, file, 'numbers') : 'none' in file ? compileNone(code, file) : compileNumber(code, file);
  }
  checkIssuers(out, 'numbers');
  return out;
}

export const serialize = (entries: Record<string, unknown>) => `${JSON.stringify(entries, null, 1)}\n`;
