import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCurrency } from '../../../src/core/money/money.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { band, isOwnRoute, overlap, route, type Band as PassportBand, type Route } from '../passports/compile.ts';

/**
 * Compiles the national identity documents the papers engine reads (src/papers/ids/ids.json) from the research's
 * files, one per country (research/sources/papers/ids/<CC>.json, register fact papers.ids.<CC>), each checked against
 * the SHA-256 its register entry cites before a byte of it is read. A country that issues a national identity
 * document names it (`document`) and gives the ways the office takes an application (`routes`, the passports' form)
 * and, by age band, the total paid for each and the years it is valid (`cards`, the passports' bands, where a card that
 * never expires is `"validYears": "permanent"`). A country
 * that issues none says so (`none`); a territory whose people hold another country's says whose (`issuedBy`), on all
 * of that country's routes (no territory's card is limited to some, as French Guiana's passport fee is).
 *
 * From 2026-10-30 (the lead's forms, FORMS.md "papers.ids (extended)"), a card may also give the age from which it
 * must be held (`must`, Germany's 16), the youngest it's issued to (`from`, Mexico's INE at 18), and where it serves as
 * a travel document (`travel`: the groups EU/EEA, GCC, Mercosur and ECOWAS, or countries by code); its renewal and its
 * replacement are routes, marked as the passports' are. A region issuing its own card (the form's `issuers`) isn't
 * taken: the case the form names, the US states' cards, goes to the licence engine, and no file or form gives what a
 * region's entry would hold, so the key is refused until one does.
 */
export const SOURCES = 'research/sources/papers/ids';
export const OUTPUT = 'src/papers/ids/ids.json';

/** A card's band: the passports', and `permanent` where the card never expires (its validYears then null). */
export type Band = PassportBand & { permanent?: true };

/** The groups whose members take each other's cards at the border; anything else in `travel` is a country by code. */
export const TRAVEL_GROUPS = ['EU/EEA', 'GCC', 'Mercosur', 'ECOWAS'] as const;

export interface Card {
  document: string;
  currency: string;
  routes: Route[];
  bands: Band[];
  /** The age from which the card must be held. */
  must?: number;
  /** The youngest age the card is issued at. */
  from?: number;
  /** The groups (TRAVEL_GROUPS) and countries where the card serves as a travel document. */
  travel?: string[];
}

export interface None {
  none: true;
}

export interface Issued {
  issuedBy: string;
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
  if ('issuers' in file) throw new Error(`${code}'s regions' own cards aren't in the form yet (the US states' go to the licence engine)`);
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
  if (routes.every(isOwnRoute)) throw new Error(`${code} has no route for a first card`);
  const paidIn = new Map(routes.map((r) => [r.id, currency]));
  if (!Array.isArray(file['cards']) || file['cards'].length === 0) throw new Error(`${code} has no cards`);
  const bands = file['cards'].map((b: unknown, i): Band => {
    const permanent = (b as { validYears?: unknown } | null)?.validYears === 'permanent';
    const out = band(permanent ? { ...(b as object), validYears: null } : b, `${code}'s card ${i}`, paidIn);
    return permanent ? { ...out, permanent: true } : out;
  });
  bands.forEach((b, i) => {
    if (b.pages !== undefined) throw new Error(`${code}'s card ${i} is a card, with no pages`);
  });
  for (const r of ids) if (!bands.some((b) => r in b.pay)) throw new Error(`${code}'s route ${r} is paid for by no card`);
  bands.forEach((a, i) => bands.slice(i + 1).forEach((b, j) => {
    if (overlap(a, b)) throw new Error(`${code}'s cards ${i} and ${i + 1 + j} meet the same applicant`);
  }));
  const out: Card = { document, currency, routes, bands };
  const { must, from, travel } = file;
  if (must !== undefined) {
    if (!isAge(must)) throw new Error(`${code}'s card must be held from a whole age`);
    out.must = must;
  }
  if (from !== undefined) {
    if (!isAge(from)) throw new Error(`${code}'s card is issued from a whole age`);
    if (from > (out.must ?? from)) throw new Error(`${code}'s card must be held from ${must}, before it's issued at ${from}`);
    out.from = from;
  }
  if (travel !== undefined) {
    const place = (t: unknown) => (TRAVEL_GROUPS as readonly unknown[]).includes(t) || (typeof t === 'string' && t !== code && Object.hasOwn(countries, t));
    if (!Array.isArray(travel) || travel.length === 0 || !travel.every(place) || new Set(travel).size !== travel.length) {
      throw new Error(`${code}'s card travels to distinct groups (${TRAVEL_GROUPS.join(', ')}) or other countries on the map`);
    }
    out.travel = travel as string[];
  }
  return out;
}

const isAge = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 120;

/** A country that issues no national identity document, checked through. */
export function compileNone(code: string, file: Record<string, unknown>): None {
  checkCountry(code, file);
  if (file['none'] !== true) throw new Error(`${code}'s file says it issues none only as none: true`);
  if (['routes', 'cards', 'document', 'must', 'from', 'travel'].some((k) => k in file)) throw new Error(`${code} issues no identity document, so it has no routes, cards, name, ages or travel`);
  return { none: true };
}

/** A territory's file naming the country whose identity document its people hold. */
export function compileIssued(code: string, file: Record<string, unknown>): Issued {
  checkCountry(code, file);
  const issuedBy = String(file['issuedBy']);
  if (!Object.hasOwn(countries, issuedBy) || issuedBy === code) throw new Error(`${code}'s identity documents are issued by another country on the map, not ${issuedBy}`);
  if (['routes', 'cards', 'onlyRoutes', 'must', 'from', 'travel'].some((k) => k in file)) throw new Error(`${code}'s identity documents are ${issuedBy}'s, on all its routes, so it has no routes, cards, route limits, ages or travel of its own`);
  return { issuedBy };
}

/** Every issuer named is compiled in its own right. */
export function checkIssuers(ids: Readonly<Record<string, Entry>>): void {
  for (const [code, e] of Object.entries(ids)) {
    if (!('issuedBy' in e)) continue;
    const issuer = ids[e.issuedBy];
    if (issuer === undefined || 'issuedBy' in issuer) throw new Error(`${code}'s identity documents are ${e.issuedBy}'s, which the game doesn't keep in its own right`);
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
