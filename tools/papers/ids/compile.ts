import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCurrency } from '../../../src/core/money/money.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { band, overlap, route, type Band, type Route } from '../passports/compile.ts';

/**
 * Compiles the national identity documents the papers engine reads (src/papers/ids/ids.json) from the research's
 * files, one per country (research/sources/papers/ids/<CC>.json, register fact papers.ids.<CC>), each checked against
 * the SHA-256 its register entry cites before a byte of it is read. A country that issues a national identity
 * document names it (`document`) and gives the ways the office takes an application (`routes`, the passports' form)
 * and, by age band, the total paid for each and the years it is valid (`cards`, the passports' bands). A country
 * that issues none says so (`none`); a territory whose people hold another country's says whose (`issuedBy`), with
 * the routes open to it where not all are (`onlyRoutes`).
 */
export const SOURCES = 'research/sources/papers/ids';
export const OUTPUT = 'src/papers/ids/ids.json';

export interface Card {
  document: string;
  currency: string;
  routes: Route[];
  bands: Band[];
}

export interface None {
  none: true;
}

export interface Issued {
  issuedBy: string;
  onlyRoutes?: string[];
}

export type Entry = Card | None | Issued;

function checkCountry(code: string, file: Record<string, unknown>): void {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
}

/** One country's identity document, checked through. */
export function compileCard(code: string, file: Record<string, unknown>): Card {
  checkCountry(code, file);
  const { document } = file;
  if (typeof document !== 'string' || document === '') throw new Error(`${code}'s identity document needs its name`);
  const currency = String(file['currency']);
  if (!isCurrency(currency)) throw new Error(`${code}'s fees are in ${currency}, not a currency in use`);
  if (!Array.isArray(file['routes']) || file['routes'].length === 0) throw new Error(`${code} has no routes`);
  const routes = file['routes'].map((r, i) => route(r, `${code}'s route ${i}`));
  routes.forEach((r) => {
    if (r.months !== undefined) throw new Error(`${code}'s route ${r.id} is offered all year round`);
  });
  const ids = new Set(routes.map((r) => r.id));
  if (ids.size !== routes.length) throw new Error(`${code} has two routes of one id`);
  if (!Array.isArray(file['cards']) || file['cards'].length === 0) throw new Error(`${code} has no cards`);
  const bands = file['cards'].map((b, i) => band(b, `${code}'s card ${i}`, currency, ids));
  bands.forEach((b, i) => {
    if (b.pages !== undefined) throw new Error(`${code}'s card ${i} is a card, with no pages`);
  });
  for (const r of ids) if (!bands.some((b) => r in b.pay)) throw new Error(`${code}'s route ${r} is paid for by no card`);
  bands.forEach((a, i) => bands.slice(i + 1).forEach((b, j) => {
    if (overlap(a, b)) throw new Error(`${code}'s cards ${i} and ${i + 1 + j} meet the same applicant`);
  }));
  return { document, currency, routes, bands };
}

/** A country that issues no national identity document, checked through. */
export function compileNone(code: string, file: Record<string, unknown>): None {
  checkCountry(code, file);
  if (file['none'] !== true) throw new Error(`${code}'s file says it issues none only as none: true`);
  if ('routes' in file || 'cards' in file || 'document' in file) throw new Error(`${code} issues no identity document, so it has no routes, cards or name`);
  return { none: true };
}

/** A territory's file naming the country whose identity document its people hold. */
export function compileIssued(code: string, file: Record<string, unknown>): Issued {
  checkCountry(code, file);
  const issuedBy = String(file['issuedBy']);
  const onlyRoutes = file['onlyRoutes'];
  if (!Object.hasOwn(countries, issuedBy) || issuedBy === code) throw new Error(`${code}'s identity documents are issued by another country on the map, not ${issuedBy}`);
  if ('routes' in file || 'cards' in file) throw new Error(`${code}'s identity documents are ${issuedBy}'s, so it has no routes or cards of its own`);
  if (onlyRoutes === undefined) return { issuedBy };
  if (!Array.isArray(onlyRoutes) || onlyRoutes.length === 0 || onlyRoutes.some((r) => typeof r !== 'string' || r === '') || new Set(onlyRoutes).size !== onlyRoutes.length) {
    throw new Error(`${code} is open to distinct routes of ${issuedBy}'s by id`);
  }
  return { issuedBy, onlyRoutes: onlyRoutes as string[] };
}

/** Every issuer named is compiled in its own right, and every route a territory is open to is one of the issuer's. */
export function checkIssuers(ids: Readonly<Record<string, Entry>>): void {
  for (const [code, e] of Object.entries(ids)) {
    if (!('issuedBy' in e)) continue;
    const issuer = ids[e.issuedBy];
    if (issuer === undefined || 'issuedBy' in issuer) throw new Error(`${code}'s identity documents are ${e.issuedBy}'s, which the game doesn't keep in its own right`);
    if (e.onlyRoutes === undefined) continue;
    if ('none' in issuer) throw new Error(`${code} is open to routes of ${e.issuedBy}'s, which issues none`);
    const routes = new Set(issuer.routes.map((r) => r.id));
    for (const r of e.onlyRoutes) if (!routes.has(r)) throw new Error(`${code} is open to a route ${e.issuedBy} has none of (${r})`);
  }
}

/** The identity documents of every file the register cites and checks. */
export function readIds(root: string): Record<string, Entry> {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { fact: string; value?: { file?: string; sha256?: string } }[] };
  const cited = new Map(register.entries.flatMap((e) => (e.fact.startsWith('papers.ids.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const ids: Record<string, Entry> = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const path = `${SOURCES}/${name}`;
    const bytes = readFileSync(join(root, path));
    const sha = cited.get(path);
    if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
    const code = name.slice(0, -'.json'.length);
    const file = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    ids[code] = 'issuedBy' in file ? compileIssued(code, file) : 'none' in file ? compileNone(code, file) : compileCard(code, file);
  }
  checkIssuers(ids);
  return ids;
}

export const serialize = (ids: Record<string, Entry>) => `${JSON.stringify(ids, null, 1)}\n`;
