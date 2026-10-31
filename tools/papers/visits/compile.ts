import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };

/**
 * Compiles what a visitor needs to enter each country (src/papers/visits/visits.json) from the research's files, one
 * per country (research/sources/papers/visits/<CC>.json, register fact papers.visits.<CC>), and one per shared list
 * (research/sources/papers/visits/groups/<name>.json, register fact papers.visits.group.<name>, as the Schengen
 * states' common list of the EU's visa regulation), each checked against the SHA-256 its register entry cites before a
 * byte of it is read. A list gives, by the passport the visitor carries (the country whose passport it is, as the
 * passports engine names it), what entry asks: nothing (`free`), an electronic travel authorisation (`eta`), a visa
 * applied for online (`evisa`), one given at the border (`arrival`), or one applied for beforehand (`visa`), with the
 * stay it allows where the source sets one (`days`, and the period they're counted in, `within`; or `months`); every
 * passport the list doesn't name meets its `others` rule. A country keeping a shared list names it (`group`), with
 * rules of its own for the passports it treats otherwise (Guam's waiver on top of the United States').
 */
export const SOURCES = 'research/sources/papers/visits';
export const GROUPS = `${SOURCES}/groups`;
export const OUTPUT = 'src/papers/visits/visits.json';

export const ENTRIES = ['free', 'eta', 'evisa', 'arrival', 'visa'] as const;
export type Entry = (typeof ENTRIES)[number];

export interface Rule {
  entry: Entry;
  days?: number;
  within?: number;
  months?: number;
}

export interface List {
  /** By passport, the rule the list names it in. */
  passports: Record<string, Rule>;
  others: Rule;
}

const whole = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

/** One rule: its entry, and the stay it allows where the source sets one, in days (within a period of days) or months. */
export function rule(r: unknown, what: string): Rule {
  if (typeof r !== 'object' || r === null) throw new Error(`${what} is not an object`);
  const { entry, days, within, months } = r as Record<string, unknown>;
  if (!ENTRIES.includes(entry as Entry)) throw new Error(`${what} asks free, eta, evisa, arrival or visa, not ${String(entry)}`);
  const out: Rule = { entry: entry as Entry };
  if (days === undefined && months === undefined) {
    if (within !== undefined) throw new Error(`${what}'s days are counted within a whole number of days above them`);
    return out;
  }
  if (entry === 'visa') throw new Error(`${what} asks a visa, whose stay is the visa's, not the list's`);
  if (months !== undefined) {
    if (days !== undefined || within !== undefined) throw new Error(`${what}'s stay is in days or in months, not both`);
    if (!whole(months)) throw new Error(`${what}'s months are a whole number above 0`);
    return { ...out, months: months as number };
  }
  if (!whole(days)) throw new Error(`${what}'s days are a whole number above 0`);
  out.days = days as number;
  if (within !== undefined) {
    if (!Number.isInteger(within) || (within as number) <= out.days) throw new Error(`${what}'s days are counted within a whole number of days above them`);
    out.within = within as number;
  }
  return out;
}

/** Each rule with the passports it names, none named twice. */
export function named(rules: unknown, what: string): Record<string, Rule> {
  if (!Array.isArray(rules)) throw new Error(`${what} has no rules`);
  const passports: Record<string, Rule> = {};
  rules.forEach((r: unknown, i) => {
    const { passports: names, ...rest } = (r ?? {}) as Record<string, unknown>;
    if (!Array.isArray(names) || names.length === 0) throw new Error(`${what}'s rule ${i} names no passports`);
    const out = rule(rest, `${what}'s rule ${i}`);
    for (const p of names) {
      if (!Object.hasOwn(countries, String(p))) throw new Error(`${what}'s rule ${i} names a passport of no country on the map (${String(p)})`);
      if (Object.hasOwn(passports, p)) throw new Error(`${what} names ${p}'s passport twice`);
      passports[p as string] = out;
    }
  });
  return passports;
}

/** A list: its rules, and the rule for every passport they don't name. */
export const list = (file: Record<string, unknown>, what: string): List => ({ passports: named(file['rules'], what), others: rule(file['others'], `${what}'s others`) });

/** A country's own list, or the shared one it keeps, with the passports it treats otherwise than that list does. */
export type Compiled = List | { group: string; passports?: Record<string, Rule> };

function checkCountry(code: string, file: Record<string, unknown>): void {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
}

/** A country's file: its own list, or the shared list it keeps, with any rules of its own for passports it treats otherwise. */
export function compileCountry(code: string, file: Record<string, unknown>, groups: ReadonlySet<string>): Compiled {
  checkCountry(code, file);
  if (!('group' in file)) return list(file, code);
  const group = String(file['group']);
  if (!groups.has(group)) throw new Error(`${code} keeps a shared list the game doesn't keep (${group})`);
  if ('others' in file) throw new Error(`${code} keeps the ${group} list, so its other passports are that list's`);
  return 'rules' in file ? { group, passports: named(file['rules'], code) } : { group };
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

const jsonIn = (dir: string) =>
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  readdirSync(dir).filter((n) => n.endsWith('.json')).sort();

/** The shared lists and every country's, of the files the register cites and checks. */
export function readVisits(root: string): { groups: Record<string, List>; countries: Record<string, Compiled> } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('papers.visits.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const groups: Record<string, List> = {};
  if (existsSync(join(root, GROUPS))) {
    for (const name of jsonIn(join(root, GROUPS))) {
      const group = name.slice(0, -'.json'.length);
      const file = cited(root, `${GROUPS}/${name}`, shas);
      if (file['group'] !== group) throw new Error(`${GROUPS}/${name} is for ${String(file['group'])}`);
      groups[group] = list(file, `the ${group} list`);
    }
  }
  const out: Record<string, Compiled> = {};
  for (const name of jsonIn(join(root, SOURCES))) {
    const code = name.slice(0, -'.json'.length);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas), new Set(Object.keys(groups)));
  }
  return { groups, countries: out };
}

export const serialize = (visits: ReturnType<typeof readVisits>) => `${JSON.stringify(visits, null, 1)}\n`;
