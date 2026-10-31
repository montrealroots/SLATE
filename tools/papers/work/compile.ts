import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };

/**
 * Compiles what a performer needs to live and work in each country (src/papers/work/work.json), from the research's
 * files, one per country (research/sources/papers/work/<CC>.json, register fact papers.work.<CC>), and one per shared
 * list of free movement (research/sources/papers/work/groups/<name>.json, register fact papers.work.group.<name>, as
 * the European Economic Area's), each checked against the SHA-256 its register entry cites before a byte of it is read.
 * A rule gives, by the passport the worker carries, either a right to live and work there with no permission asked
 * (`free`), or a permission to apply for (`permit`), named by the route a performer takes (`route`, as the government
 * names it), with the days a performer may work without it where the law allows a short engagement (`days`, within a
 * period of `within` days where it counts them so). A shared list names its passports and may give the rule for every
 * other (`others`, as the United States' does for its territories); a country names the shared list it keeps
 * (`group`, or several in order), with rules of its own for the passports it treats otherwise, and its own rule for every other passport
 * where the list gives none or it differs. The compiled country holds every passport and its rule for every other, so
 * the engine reads one list; the lists it keeps are named for the coverage.
 */
export const SOURCES = 'research/sources/papers/work';
export const GROUPS = `${SOURCES}/groups`;
export const OUTPUT = 'src/papers/work/work.json';

export const RIGHTS = ['free', 'permit'] as const;
export type Right = (typeof RIGHTS)[number];

export interface Rule {
  right: Right;
  route?: string;
  days?: number;
  within?: number;
}

const whole = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

/** One rule: free, or the permit's route with the days a short engagement may be worked without it. */
export function rule(r: unknown, what: string): Rule {
  if (typeof r !== 'object' || r === null) throw new Error(`${what} is not an object`);
  const { right, route, days, within } = r as Record<string, unknown>;
  if (!RIGHTS.includes(right as Right)) throw new Error(`${what} is free or a permit, not ${String(right)}`);
  if (right === 'free') {
    if (route !== undefined || days !== undefined || within !== undefined) throw new Error(`${what} is free, so it names no route and no days`);
    return { right };
  }
  if (typeof route !== 'string' || route.trim() !== route || route === '') throw new Error(`${what} names the route a performer takes`);
  const out: Rule = { right: 'permit', route };
  if (days === undefined) {
    if (within !== undefined) throw new Error(`${what}'s days are counted within a whole number of days above them`);
    return out;
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

/** A shared list: the passports it names, and the rule for every other where the countries keeping it share one. */
export interface Group {
  passports: Record<string, Rule>;
  others?: Rule;
}

/** A country's list: the shared lists it keeps if any, every passport named (its own and the shared lists'), and the rule for every other. */
export interface Compiled {
  groups?: string[];
  passports: Record<string, Rule>;
  others: Rule;
}

/** A shared list's file: its passports, and its rule for every other where it gives one. */
export const compileGroup = (file: Record<string, unknown>, what: string): Group =>
  'others' in file ? { passports: named(file['rules'], what), others: rule(file['others'], `${what}'s others`) } : { passports: named(file['rules'], what) };

/**
 * A country's file: its own rules, the shared list it keeps (`group`, a name, or several in order, the first naming a
 * passport giving its rule, as the OECS's free movement before the CSME's Skills Certificate), and the rule for every
 * passport none names: its own, else the first kept list's that gives one.
 */
export function compileCountry(code: string, file: Record<string, unknown>, groups: ReadonlyMap<string, Group>): Compiled {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const passports = 'rules' in file ? named(file['rules'], code) : {};
  if (!('group' in file)) return { passports, others: rule(file['others'], `${code}'s others`) };
  const names = (Array.isArray(file['group']) ? file['group'] : [file['group']]).map(String);
  if (names.length === 0) throw new Error(`${code} keeps no shared list by name`);
  const kept = names.map((name, i) => {
    const shared = groups.get(name);
    if (shared === undefined) throw new Error(`${code} keeps a shared list the game doesn't keep (${name})`);
    if (names.indexOf(name) !== i) throw new Error(`${code} keeps the ${name} list twice`);
    return [name, shared] as const;
  });
  for (const p of Object.keys(passports)) {
    const by = kept.find(([, shared]) => Object.hasOwn(shared.passports, p));
    if (by !== undefined) throw new Error(`${code} names ${p}'s passport, which the ${by[0]} list already names`);
  }
  const listed = kept.find(([, shared]) => shared.others !== undefined);
  if (!('others' in file) && listed === undefined) throw new Error(`${code} keeps the ${names.join(' and ')} list${names.length > 1 ? 's, which give' : ', which gives'} no rule for other passports, and gives none of its own`);
  const others = 'others' in file ? rule(file['others'], `${code}'s others`) : (listed?.[1].others as Rule);
  // The first list naming a passport gives its rule: the later lists are spread first.
  const shared = Object.assign({}, ...kept.map(([, list]) => list.passports).reverse()) as Record<string, Rule>;
  return { groups: names, passports: { ...shared, ...passports }, others };
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
export function readWork(root: string): { groups: Record<string, Group>; countries: Record<string, Compiled> } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('papers.work.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const groups: Record<string, Group> = {};
  if (existsSync(join(root, GROUPS))) {
    for (const name of jsonIn(join(root, GROUPS))) {
      const group = name.slice(0, -'.json'.length);
      const file = cited(root, `${GROUPS}/${name}`, shas);
      if (file['group'] !== group) throw new Error(`${GROUPS}/${name} is for ${String(file['group'])}`);
      groups[group] = compileGroup(file, `the ${group} list`);
    }
  }
  const out: Record<string, Compiled> = {};
  const shared = new Map(Object.entries(groups));
  for (const name of jsonIn(join(root, SOURCES))) {
    const code = name.slice(0, -'.json'.length);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas), shared);
  }
  return { groups, countries: out };
}

export const serialize = (work: ReturnType<typeof readWork>) => `${JSON.stringify(work, null, 1)}\n`;
