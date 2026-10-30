import type { Money } from '../../../src/core/money/money.ts';
import { amount, checkCountry, checkIssuers, compileIssued, currencyIn, isRecord, isWhole, only, readCited, type Issued, type Within, within } from '../numbers/compile.ts';

/**
 * Compiles the residence permissions the papers engine reads (src/papers/residence/residence.json) from the research's
 * files, one per country (research/sources/papers/residence/<CC>.json, register fact papers.residence.<CC>), each
 * checked against the SHA-256 its register entry cites. A country gives the routes by which someone who isn't its
 * citizen may live there, each named as the government names it: what it is for, where it is applied for, whether it
 * lets its holder work (each left out where the source doesn't say: until 2026-10-30 both were required, and a page
 * naming a permit and its terms without them kept the country out), and what the research states of its fee, its time,
 * its term, its renewal, whether its years count toward naturalisation and after how many it leads to permanent
 * residence. The routes a performer could use come first in the research (work, self-employed or talent, free movement,
 * permanent), then family and means. A free movement route names the groups whose citizens it is for. A territory whose
 * permits are another country's says whose (`issuedBy`); a place needing no permit at all says so (`free`), and one
 * where no one from abroad may come to live by any route says that (`none`). A residence card a country gives for any
 * purpose, not tied to one, is `general` (Senegal's carte d'identité d'étranger). A term a source doesn't state is left
 * out, never guessed. No file was written when the engine was built (2026-10-30); then nothing is compiled.
 */
export const SOURCES = 'research/sources/papers/residence';
export const OUTPUT = 'src/papers/residence/residence.json';

export const FOR = ['work', 'self-employed', 'talent', 'family', 'study', 'means', 'retirement', 'permanent', 'free movement', 'general'] as const;
export const APPLY = ['abroad', 'in country', 'either'] as const;
export const WORK = ['any', 'sponsor', 'none'] as const;
export const TERM_UNITS = ['day', 'week', 'month', 'year'] as const;

export interface Route {
  id: string;
  /** As the government names it. */
  name: string;
  for: (typeof FOR)[number];
  /** Where it is applied for; left out where the source doesn't say. */
  apply?: (typeof APPLY)[number];
  fee?: Money;
  /** The longest a decision takes as the office publishes it. */
  within?: Within;
  /** How long a grant lasts. */
  term?: { n: number; unit: (typeof TERM_UNITS)[number] };
  renewable?: true;
  /** The work it allows: any, only for the sponsor named, or none; left out where the source doesn't say. */
  work?: (typeof WORK)[number];
  /** Its years count toward naturalisation's. */
  counts?: true;
  /** The years on it after which permanent residence may be asked for. */
  permanentAfter?: number;
  /** A free movement route's: the groups (or countries) whose citizens it is for. */
  groups?: string[];
}

export interface Residence {
  routes: Route[];
}

/** A place where anyone may live and work with no permit of any kind (Svalbard, by its Governor). */
export interface Free {
  free: true;
}

/** A place where no one from abroad may come to live by any route (one with no population of its own to join). */
export interface Closed {
  none: true;
}

export type Entry = Residence | Issued | Free | Closed;

const ROUTE = ['id', 'name', 'for', 'apply', 'fee', 'within', 'term', 'renewable', 'work', 'counts', 'permanentAfter', 'groups'];

function oneOf<T extends string>(v: unknown, list: readonly T[], what: string): T {
  if (!list.includes(v as T)) throw new Error(`${what} is one of ${list.join(', ')}`);
  return v as T;
}

function route(r: unknown, at: string, currency: () => string): Route {
  if (!isRecord(r)) throw new Error(`${at} is not an object`);
  only(r, ROUTE, at);
  const { id, name, fee, term, renewable, counts, permanentAfter, groups } = r;
  if (typeof id !== 'string' || id === '') throw new Error(`${at} needs an id`);
  if (typeof name !== 'string' || name === '') throw new Error(`${at} (${id}) needs its name`);
  const out: Route = { id, name, for: oneOf(r['for'], FOR, `${at} (${id})'s for`) };
  if (r['apply'] !== undefined) out.apply = oneOf(r['apply'], APPLY, `${at} (${id})'s apply`);
  if (r['work'] !== undefined) out.work = oneOf(r['work'], WORK, `${at} (${id})'s work`);
  if (fee !== undefined) out.fee = amount(fee, currency(), `${at} (${id})'s fee`);
  if (r['within'] !== undefined) out.within = within(r['within'], `${at} (${id})'s within`);
  if (term !== undefined) {
    if (!(isRecord(term) && isWhole(term['n'], 1) && TERM_UNITS.includes(term['unit'] as never) && Object.keys(term).length === 2)) throw new Error(`${at} (${id})'s term is a whole number of days, weeks, months or years`);
    out.term = { n: term['n'] as number, unit: term['unit'] as (typeof TERM_UNITS)[number] };
  }
  if (renewable !== undefined) {
    if (renewable !== true) throw new Error(`${at} (${id}) says it is renewable only as renewable: true`);
    out.renewable = true;
  }
  if (counts !== undefined) {
    if (counts !== true) throw new Error(`${at} (${id}) says its years count only as counts: true`);
    out.counts = true;
  }
  if (permanentAfter !== undefined) {
    if (!isWhole(permanentAfter, 1) || out.for === 'permanent') throw new Error(`${at} (${id}) leads to permanent residence after a whole number of years, unless it is permanent`);
    out.permanentAfter = permanentAfter;
  }
  if ((groups !== undefined) !== (out.for === 'free movement')) throw new Error(`${at} (${id}) names groups if and only if it is free movement`);
  if (groups !== undefined) {
    if (!Array.isArray(groups) || groups.length === 0 || groups.some((g) => typeof g !== 'string' || g === '') || new Set(groups).size !== groups.length) throw new Error(`${at} (${id})'s groups are distinct names`);
    out.groups = groups as string[];
  }
  return out;
}

/** One country's residence routes, checked through. */
export function compileResidence(code: string, file: Record<string, unknown>): Residence {
  checkCountry(code, file);
  only(file, ['country', 'routes', 'currency', 'note', 'sources'], code);
  if (!Array.isArray(file['routes']) || file['routes'].length === 0) throw new Error(`${code} has no routes`);
  const routes = file['routes'].map((r, i) => route(r, `${code}'s route ${i}`, () => currencyIn(code, file)));
  if (new Set(routes.map((r) => r.id)).size !== routes.length) throw new Error(`${code} has two routes of one id`);
  return { routes };
}

/** A file saying that no permit of any kind is needed to live or work there. */
export function compileFree(code: string, file: Record<string, unknown>): Free {
  checkCountry(code, file);
  if (file['free'] !== true) throw new Error(`${code}'s file says no permit is needed only as free: true`);
  only(file, ['country', 'free', 'note', 'sources'], `${code}, where no permit is needed,`);
  return { free: true };
}

/** A file saying that no one from abroad may come to live there by any route. */
export function compileClosed(code: string, file: Record<string, unknown>): Closed {
  checkCountry(code, file);
  if (file['none'] !== true) throw new Error(`${code}'s file says no one may come to live there only as none: true`);
  only(file, ['country', 'none', 'note', 'sources'], `${code}, where no one may come to live,`);
  return { none: true };
}

/** The residence routes of every file the register cites and checks. */
export function readResidence(root: string): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [code, file] of readCited(root, SOURCES, 'papers.residence.')) out[code] = 'issuedBy' in file ? compileIssued(code, file, 'permits') : 'free' in file ? compileFree(code, file) : 'none' in file ? compileClosed(code, file) : compileResidence(code, file);
  checkIssuers(out, 'permits');
  return out;
}

export { serialize } from '../numbers/compile.ts';
