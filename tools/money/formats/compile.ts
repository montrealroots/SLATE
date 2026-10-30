import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { refusal, type Check, type Format, type Iban, type Kind, type National, type Part, type Span } from '../../../src/money/formats/number.ts';

/**
 * Compiles how each country's banks number their accounts (src/money/formats/formats.json), from the research's files,
 * one per country (research/sources/money/formats/<CC>.json, register fact money.formats.<CC>), each checked against
 * the SHA-256 its register entry cites before a byte of it is read. A file gives one form:
 *
 * - `iban`, from SWIFT's IBAN Registry: the IBAN's `length`, its BBAN's structure in the registry's notation (`bban`,
 *   "4!n4!n12!c": four digits, four digits, twelve letters or digits), where the bank's own code sits in the BBAN
 *   (`bank`, characters from..to, where the registry gives it) and the branch's (`branch`, checked and kept in the
 *   research: nothing draws a branch of its own yet), and the registry's own example IBAN (`example`), which must pass
 *   the form it's given with, so a structure misread is caught on the registry's own number. A country the registry
 *   folds into another's prefix (Guadeloupe into France's) gives only that `prefix`, and takes that country's form.
 * - `national`, from the country's central bank or bankers' association, where it has no IBAN: the number's `name`,
 *   its `parts` (each a name, a length and a kind; where a part's length varies, as an account number's often does,
 *   `min`, the fewest it takes, and `drawn`, the lengths the bank's own numbers are drawn at), where the bank's code
 *   sits in it (`bank`), the checks inside it as the central bank publishes them (`checks`, each the digits it's worked
 *   `over` and their `weights`, or `mod97`, `key97` or `rest97`), and the publisher's own worked number (`example`),
 *   which must pass, so a check misread is caught on it. The bank's code and the checks sit before any part whose
 *   length varies.
 * - `follows`, a territory whose banks number accounts in another country's own form (the Cocos Islands' in
 *   Australia's), named by its source as that country's; it takes that form.
 *
 * Until 2026-10-30 a national check was left out and the form took none; Argentina's, Nigeria's and Angola's were the
 * first read.
 */
export const SOURCES = 'research/sources/money/formats';
export const OUTPUT = 'src/money/formats/formats.json';

export const KINDS = ['n', 'a', 'c'] as const satisfies readonly Kind[];

/** A file's form before a folded prefix, or a territory following another's own number, is resolved to its country's. */
export type Read = Format | { prefix: string } | { follows: string };

const object = (o: unknown, what: string): Record<string, unknown> => {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error(`${what} is not an object`);
  return o as Record<string, unknown>;
};
/** Refuses a key the form doesn't have, so a misspelt term isn't read as one the source doesn't give. */
const only = (o: Record<string, unknown>, keys: readonly string[], what: string) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${what} has no term ${k}`);
};
const count = (n: unknown, what: string): number => {
  if (!Number.isInteger(n) || (n as number) < 1) throw new Error(`${what} is a whole number above nothing`);
  return n as number;
};

/** Characters from..to of a number `length` long, counted from 1. */
export function span(s: unknown, length: number, what: string): Span {
  if (!Array.isArray(s) || s.length !== 2) throw new Error(`${what} is characters from..to, written [from, to]`);
  const [from, to] = [count(s[0], what), count(s[1], what)];
  if (from > to || to > length) throw new Error(`${what} is characters ${from} to ${to} of a number ${length} long`);
  return [from, to];
}

/** The registry's notation for a BBAN, part by part: "4!n" is four digits, exactly. */
export function structure(text: unknown, what: string): Part[] {
  if (typeof text !== 'string' || !/^(\d+![nac])+$/.test(text)) throw new Error(`${what} is a structure in the registry's notation, such as 4!a6!n8!n`);
  return [...text.matchAll(/(\d+)!([nac])/g)].map((m) => ({ length: count(Number(m[1]), what), kind: m[2] as Kind }));
}

/** A country's IBAN, from its column in the registry, or the prefix of the country whose IBAN covers it. */
export function iban(code: string, o: unknown): Read {
  const what = `${code}'s IBAN`;
  const f = object(o, what);
  if ('prefix' in f) {
    only(f, ['prefix'], `${what}, under another's prefix,`);
    if (typeof f['prefix'] !== 'string' || !/^[A-Z]{2}$/.test(f['prefix']) || f['prefix'] === code) throw new Error(`${what}'s prefix is another country's two letters`);
    return { prefix: f['prefix'] };
  }
  only(f, ['length', 'bban', 'bank', 'branch', 'example'], what);
  const bban = structure(f['bban'], `${what}'s bban`);
  const long = bban.reduce((sum, p) => sum + p.length, 0);
  if (f['length'] !== long + 4) throw new Error(`${what} is ${long + 4} characters long by its structure, not ${String(f['length'])}`);
  const out: { -readonly [K in keyof Iban]: Iban[K] } = { prefix: code, length: long + 4, bban };
  if (f['bank'] !== undefined) out.bank = span(f['bank'], long, `${what}'s bank`);
  if (f['branch'] !== undefined) span(f['branch'], long, `${what}'s branch`);
  // Anything but the text of an IBAN (a number, nothing) fails as one of the wrong length.
  const why = refusal({ iban: out }, String(f['example']));
  if (why !== undefined) throw new Error(`${what}'s example ${String(f['example'])} doesn't pass its form (${why})`);
  return { iban: out };
}

/** A country's own account number, part by part. */
export function national(code: string, o: unknown): Format {
  const what = `${code}'s national number`;
  const f = object(o, what);
  only(f, ['name', 'parts', 'bank', 'checks', 'example'], what);
  const named = (s: unknown) => typeof s === 'string' && s !== '' && s.trim() === s;
  if (!named(f['name'])) throw new Error(`${what} is named as the country's banks name it`);
  if (!Array.isArray(f['parts']) || f['parts'].length === 0) throw new Error(`${what}'s parts are a list`);
  const parts = f['parts'].map((p: unknown, i) => {
    const part = object(p, `${what}'s part ${i}`);
    only(part, ['name', 'length', 'kind', 'min', 'drawn'], `${what}'s part ${i}`);
    if (!named(part['name'])) throw new Error(`${what}'s part ${i} is named`);
    if (!(KINDS as readonly unknown[]).includes(part['kind'])) throw new Error(`${what}'s part ${i} is digits (n), letters (a) or either (c)`);
    const out: { -readonly [K in keyof National['parts'][number]]: National['parts'][number][K] } = {
      name: part['name'] as string,
      length: count(part['length'], `${what}'s part ${i}'s length`),
      kind: part['kind'] as Kind,
    };
    if (part['min'] !== undefined) {
      out.min = count(part['min'], `${what}'s part ${i}'s min`);
      if (out.min >= out.length) throw new Error(`${what}'s part ${i} takes ${out.min} characters at the fewest, fewer than its ${out.length} at the most`);
    }
    if (part['drawn'] !== undefined) {
      if (out.min === undefined) throw new Error(`${what}'s part ${i} is drawn at lengths of its own only where its length varies (min)`);
      out.drawn = span(part['drawn'], out.length, `${what}'s part ${i}'s drawn`);
      if (out.drawn[0] < out.min) throw new Error(`${what}'s part ${i} is drawn at lengths it takes`);
    }
    return out;
  });
  // Where a part's length varies, the characters after it have no fixed place: the bank's code and the checks sit before.
  const varies = parts.findIndex((p) => p.min !== undefined);
  const fixed = parts.slice(0, varies === -1 ? parts.length : varies).reduce((sum, p) => sum + p.length, 0);
  const before = (end: number, which: string) => {
    if (end > fixed) throw new Error(`${what}'s ${which} sits after a part whose length varies`);
  };
  const long = parts.reduce((sum, p) => sum + p.length, 0);
  const out: { -readonly [K in keyof National]: National[K] } = { name: f['name'] as string, parts };
  if (f['bank'] !== undefined) {
    out.bank = span(f['bank'], long, `${what}'s bank`);
    before(out.bank[1], 'bank');
  }
  if (f['checks'] !== undefined) {
    if (!Array.isArray(f['checks']) || f['checks'].length === 0) throw new Error(`${what}'s checks are a list`);
    const kinds = parts.flatMap((p) => Array<Kind>(p.length).fill(p.kind));
    out.checks = f['checks'].map((c: unknown, i) => check(c, kinds, `${what}'s check ${i}`));
    out.checks.forEach((c, i) => before(c.over[1] + ('weights' in c ? 1 : 2), `check ${i}`));
  }
  if (f['example'] !== undefined) {
    const why = refusal({ national: out }, String(f['example']));
    if (why !== undefined) throw new Error(`${what}'s example ${String(f['example'])} doesn't pass its form (${why})`);
  }
  return { national: out };
}

/** A check inside a national number, over digits of the number whose characters' kinds are `kinds`, its own digits after them. */
export function check(o: unknown, kinds: readonly Kind[], what: string): Check {
  const c = object(o, what);
  only(c, ['over', 'weights', 'mod97', 'key97', 'rest97'], what);
  const over = span(c['over'], kinds.length, `${what}'s over`);
  const two = (['mod97', 'key97', 'rest97'] as const).filter((k) => k in c);
  const digits = two.length > 0 ? 2 : 1;
  if (over[1] + digits > kinds.length) throw new Error(`${what}'s digits don't fit after characters ${over[0]} to ${over[1]}`);
  if (kinds.slice(over[0] - 1, over[1] + digits).some((k) => k !== 'n')) throw new Error(`${what} is worked over digits, into digits`);
  const [rule] = two;
  if (rule !== undefined) {
    if (two.length > 1 || c[rule] !== true || 'weights' in c) throw new Error(`${what} is one of mod97, key97 or rest97: true, with no weights`);
    return { over, [rule]: true } as Check;
  }
  const weights = c['weights'];
  if (!Array.isArray(weights) || weights.length !== over[1] - over[0] + 1 || !weights.every((w) => Number.isInteger(w) && w >= 0))
    throw new Error(`${what}'s weights are a whole number for each of characters ${over[0]} to ${over[1]}`);
  return { over, weights };
}

/** A country's file: one form, an IBAN or a national number. */
export function compileCountry(code: string, file: Record<string, unknown>): Read {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  if ('follows' in file) {
    only(file, ['country', 'follows', 'note', 'sources'], `${code}'s file, following another's,`);
    if (typeof file['follows'] !== 'string' || !Object.hasOwn(countries, file['follows']) || file['follows'] === code) throw new Error(`${code} follows another country on the map`);
    return { follows: file['follows'] };
  }
  only(file, ['country', 'iban', 'national', 'note', 'sources'], `${code}'s file`);
  if ((file['iban'] === undefined) === (file['national'] === undefined)) throw new Error(`${code} gives one form, an IBAN or a national number`);
  return file['iban'] === undefined ? national(code, file['national']) : iban(code, file['iban']);
}

/**
 * Every file's form, a folded prefix taken to the form of the country that owns it, and a territory that follows
 * another's own number (Australia's, at the Cocos Islands) to that country's form.
 */
export function resolve(read: Readonly<Record<string, Read>>): Record<string, Format> {
  const out: Record<string, Format> = {};
  for (const [code, form] of Object.entries(read)) {
    if ('follows' in form) {
      const owner = read[form.follows];
      if (owner === undefined || 'prefix' in owner || 'follows' in owner) throw new Error(`${code} follows ${form.follows}, whose own form the research doesn't give`);
      out[code] = owner;
      continue;
    }
    if (!('prefix' in form)) {
      out[code] = form;
      continue;
    }
    const owner = read[form.prefix];
    if (owner === undefined || !('iban' in owner)) throw new Error(`${code}'s prefix ${form.prefix} is no IBAN the research gives`);
    out[code] = owner;
  }
  return out;
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

/** The bytes of a research file, checked against what the register cites. */
function cited(root: string, path: string, shas: ReadonlyMap<string, string | undefined>): Record<string, unknown> {
  const bytes = readFileSync(join(root, path));
  const sha = shas.get(path);
  if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
}

/** Every country's form, of the files the register cites and checks. */
export function readFormats(root: string): { countries: Record<string, Format> } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.formats.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const read: Record<string, Read> = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    read[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas));
  }
  return { countries: resolve(read) };
}

export const serialize = (formats: ReturnType<typeof readFormats>) => `${JSON.stringify(formats, null, 1)}\n`;
