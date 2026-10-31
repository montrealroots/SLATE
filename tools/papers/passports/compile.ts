import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency } from '../../../src/core/money/money.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };

/**
 * Compiles the passports the papers engine reads (src/papers/passports/passports.json) from the research's files,
 * one per issuing country (research/sources/papers/passports/<CC>.json, register fact papers.passports.<CC>), each
 * checked against the SHA-256 its register entry cites before a byte of it is read. A file is compiled once its
 * research is in the engine's form: its `routes` (where the passport is applied for, at what speed, and the longest
 * it takes as published) and, by age band, the `pay` for each route as the total the applicant pays, in the
 * country's currency or the currency the office sets it in. A file still in the research's own words (a `fees` map
 * instead of `pay`, or fees in a unit that isn't a currency, as Uruguay's indexed units) isn't compiled: its row
 * stays pending until it is. A territory whose people hold another country's passport says so (`issuedBy`), with
 * the routes of that country's open to it where not all are (`onlyRoutes`, as French Guiana's own fee).
 *
 * From 2026-10-30 (the lead's forms, FORMS.md "papers.passports (extended)"), a route may be one that renews a passport
 * held (`renewal`, as the US's DS-82 by mail) or replaces a lost or stolen one (`replacement`), each paid by the bands
 * as any route is; a file whose missions abroad set their fee in another currency says which (`abroad.currency`, and
 * every route abroad is paid in it); and a country that issues a passport card says so (`card`: its name and its bands,
 * in the passports' band form). A route's or a band's key the form doesn't have is refused, so a misspelt `renewal`
 * isn't read as an ordinary route. A route's `label` is the research's gloss of the route ("in person, expedited (USD
 * 60 more)") and the file's `office` its account of who takes the application; neither is compiled. Decided
 * 2026-10-30: the labels repeat the fee and the time the route already compiles, as prose that could drift from them
 * (a second copy of a fact), and neither is a name a screen could show as a label in the game's voice; a screen tells
 * routes apart by where, speed, time and season, and where those don't (the UK's paper and online forms) the research
 * owes the route's own name.
 */
export const SOURCES = 'research/sources/papers/passports';
export const OUTPUT = 'src/papers/passports/passports.json';

export const UNITS = ['minute', 'hour', 'day', 'working day', 'week', 'month'] as const;
export type Unit = (typeof UNITS)[number];

export interface Route {
  id: string;
  /** Applied for in the issuing country, or at one of its missions abroad. */
  where: 'home' | 'abroad';
  speed: 'standard' | 'urgent';
  /** The longest it takes as the office publishes it, or null where it publishes none. */
  within: { n: number; unit: Unit } | null;
  /** The months of the year the route is offered in, where it isn't all year. */
  months?: number[];
  /** The route renews a document held (the US's passport renewal by mail); only a holder renewing takes it. */
  renewal?: true;
  /** The route replaces a lost or stolen document; only a holder who lost it takes it. */
  replacement?: true;
}

export interface Band {
  /** The age the band starts at (inclusive) and ends before, where it is bounded. */
  from?: number;
  under?: number;
  pages?: number;
  validYears: number | null;
  /** By route, the total in the currency's minor units, or null where the fee isn't known. */
  pay: Record<string, number | null>;
}

/** A passport card (the US's): its name, and by age band its validity and the total paid for each route. */
export interface PassportCard {
  name: string;
  bands: Band[];
}

export interface Passport {
  currency: string;
  /** The currency the missions abroad set their fee in, where it isn't the country's: every route abroad is paid in it. */
  abroad?: { currency: string };
  routes: Route[];
  bands: Band[];
  card?: PassportCard;
}

export interface Issued {
  issuedBy: string;
  onlyRoutes?: string[];
}

export type Entry = Passport | Issued;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isWhole = (v: unknown, min: number): v is number => Number.isSafeInteger(v) && (v as number) >= min;

/** Whether a research file is in the engine's form (it has routes, or names its issuer); one that isn't stays pending. */
export const isCompilable = (file: Record<string, unknown>) => 'routes' in file || 'issuedBy' in file;

/** A route's keys: the form's, and the research's `label`, accepted and not compiled. */
const ROUTE_TERMS = ['id', 'where', 'speed', 'within', 'months', 'renewal', 'replacement', 'label'];
/** A band's keys: the form's, and the research's `for` (whom the band is for, in its words), accepted and not compiled. */
const BAND_TERMS = ['for', 'from', 'under', 'pages', 'validYears', 'pay'];

const isNamed = (v: unknown): v is string => typeof v === 'string' && v !== '';
/** Refuses a key the form doesn't have, left over once an object's own keys are taken. */
export const nothingElse = (rest: Record<string, unknown>, what: string) => {
  const [k] = Object.keys(rest);
  if (k !== undefined) throw new Error(`${what} has no term ${k}`);
};

/** Whether a route is one for a renewal or a replacement, not a first issue. */
export const isOwnRoute = (r: Route) => r.renewal === true || r.replacement === true;

export function route(r: unknown, at: string): Route {
  if (!isRecord(r)) throw new Error(`${at} is not an object`);
  const { id, where, speed, within, months, renewal, replacement } = r;
  if (!isNamed(id)) throw new Error(`${at} needs an id`);
  for (const k of Object.keys(r)) if (!ROUTE_TERMS.includes(k)) throw new Error(`${at} (${id}) has no term ${k}`);
  if (where !== 'home' && where !== 'abroad') throw new Error(`${at} (${id}) is applied for at home or abroad`);
  if (speed !== 'standard' && speed !== 'urgent') throw new Error(`${at} (${id}) is standard or urgent`);
  if (within !== null && !(isRecord(within) && isWhole(within['n'], 0) && UNITS.includes(within['unit'] as Unit))) {
    throw new Error(`${at} (${id}) takes a whole number of minutes, hours, days, working days, weeks or months, or null`);
  }
  const out: Route = { id, where, speed, within: within === null ? null : { n: within['n'] as number, unit: within['unit'] as Unit } };
  if (months !== undefined) {
    if (!Array.isArray(months) || months.length === 0 || months.some((m) => !isWhole(m, 1) || (m as number) > 12) || new Set(months).size !== months.length) {
      throw new Error(`${at} (${id}) is offered in distinct months 1 to 12`);
    }
    out.months = months as number[];
  }
  if (renewal !== undefined && renewal !== true) throw new Error(`${at} (${id}) is a renewal only as renewal: true`);
  if (replacement !== undefined && replacement !== true) throw new Error(`${at} (${id}) is a replacement only as replacement: true`);
  if (renewal === true && replacement === true) throw new Error(`${at} (${id}) renews a document held or replaces a lost one, not both`);
  if (renewal === true) out.renewal = true;
  if (replacement === true) out.replacement = true;
  return out;
}

/** A band, its fees read in the currency of the route each pays for (`routes`: each route's id to its currency). */
export function band(b: unknown, at: string, routes: ReadonlyMap<string, string>): Band {
  if (!isRecord(b)) throw new Error(`${at} is not an object`);
  for (const k of Object.keys(b)) if (!BAND_TERMS.includes(k)) throw new Error(`${at} has no term ${k}`);
  const { from, under, pages, validYears, pay } = b;
  if (from !== undefined && !isWhole(from, 0)) throw new Error(`${at} starts at a whole age`);
  if (under !== undefined && !isWhole(under, 1)) throw new Error(`${at} ends before a whole age`);
  if ((from ?? 0) >= (under ?? Infinity)) throw new Error(`${at} starts at ${from} and ends before ${under}`);
  if (pages !== undefined && !isWhole(pages, 1)) throw new Error(`${at} has a whole number of pages`);
  if (validYears !== null && !isWhole(validYears, 1)) throw new Error(`${at} is valid a whole number of years, or null`);
  if (!isRecord(pay) || Object.keys(pay).length === 0) throw new Error(`${at} pays by route`);
  const out: Band = { validYears, pay: {} };
  if (from !== undefined) out.from = from;
  if (under !== undefined) out.under = under;
  if (pages !== undefined) out.pages = pages;
  for (const [id, fee] of Object.entries(pay)) {
    const currency = routes.get(id);
    if (currency === undefined) throw new Error(`${at} pays for a route there is none of (${id})`);
    if (fee !== null && typeof fee !== 'string') throw new Error(`${at} pays ${id} as an amount written out, or null`);
    out.pay[id] = fee === null ? null : fromMajor(currency as never, fee).minor;
  }
  return out;
}

/** Two bands meet the same applicant with the same passport: the same pages and validity, and ages that overlap. */
export function overlap(a: Band, b: Band): boolean {
  if (a.pages !== b.pages || a.validYears !== b.validYears) return false;
  return (a.from ?? 0) < (b.under ?? Infinity) && (b.from ?? 0) < (a.under ?? Infinity);
}

/** One research file in the engine's form, checked through. */
export function compilePassport(code: string, file: Record<string, unknown>): Passport {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const currency = String(file['currency']);
  if (!isCurrency(currency)) throw new Error(`${code}'s fees are in ${currency}, not a currency in use`);
  if ('unit' in file) throw new Error(`${code}'s fees are in ${String(file['unit'])}, not in its currency`);
  if (!Array.isArray(file['routes']) || file['routes'].length === 0) throw new Error(`${code} has no routes`);
  const routes = file['routes'].map((r, i) => route(r, `${code}'s route ${i}`));
  const ids = new Set(routes.map((r) => r.id));
  if (ids.size !== routes.length) throw new Error(`${code} has two routes of one id`);
  if (routes.every(isOwnRoute)) throw new Error(`${code} has no route for a first passport`);
  const abroad = file['abroad'] === undefined ? undefined : abroadCurrency(code, file['abroad'], currency, routes);
  const paidIn = new Map(routes.map((r) => [r.id, r.where === 'abroad' ? (abroad ?? currency) : currency]));
  if (!Array.isArray(file['passports']) || file['passports'].length === 0) throw new Error(`${code} has no passports`);
  const bands = file['passports'].map((b, i) => band(b, `${code}'s passport ${i}`, paidIn));
  for (const r of ids) if (!bands.some((b) => r in b.pay)) throw new Error(`${code}'s route ${r} is paid for by no passport`);
  apart(bands, `${code}'s passports`);
  const out: Passport = abroad === undefined ? { currency, routes, bands } : { currency, abroad: { currency: abroad }, routes, bands };
  if (file['card'] !== undefined) out.card = passportCard(code, file['card'], paidIn);
  return out;
}

/** No two bands meet the same applicant with the same document. */
function apart(bands: readonly Band[], what: string): void {
  bands.forEach((a, i) => bands.slice(i + 1).forEach((b, j) => {
    if (overlap(a, b)) throw new Error(`${what} ${i} and ${i + 1 + j} meet the same applicant`);
  }));
}

/** The currency a file's missions abroad set their fee in: one in use, not the country's own, and paid by a route abroad. */
function abroadCurrency(code: string, a: unknown, currency: string, routes: readonly Route[]): string {
  if (!isRecord(a)) throw new Error(`${code}'s abroad is not an object`);
  const { currency: c, ...rest } = a;
  nothingElse(rest, `${code}'s abroad`);
  if (typeof c !== 'string' || !isCurrency(c)) throw new Error(`${code}'s fees abroad are in ${String(c)}, not a currency in use`);
  if (c === currency) throw new Error(`${code}'s fees abroad are in its own currency, which needs no abroad`);
  if (!routes.some((r) => r.where === 'abroad')) throw new Error(`${code} has no route abroad to pay in ${c}`);
  return c;
}

/** A country's passport card: its name and its bands, a card's (no pages), paid for by the file's routes. */
function passportCard(code: string, c: unknown, paidIn: ReadonlyMap<string, string>): PassportCard {
  const what = `${code}'s passport card`;
  if (!isRecord(c)) throw new Error(`${what} is not an object`);
  const { name, bands, ...rest } = c;
  nothingElse(rest, what);
  if (!isNamed(name)) throw new Error(`${what} needs its name`);
  if (!Array.isArray(bands) || bands.length === 0) throw new Error(`${what} has no bands`);
  const out = bands.map((b, i) => band(b, `${what} ${i}`, paidIn));
  out.forEach((b, i) => {
    if (b.pages !== undefined) throw new Error(`${what} ${i} is a card, with no pages`);
  });
  apart(out, `${code}'s passport cards`);
  return { name, bands: out };
}

/** A territory's file naming the country whose passport its people hold, checked through (the issuer is checked against the others once all are read). */
export function compileIssued(code: string, file: Record<string, unknown>): Issued {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const issuedBy = String(file['issuedBy']);
  const onlyRoutes = file['onlyRoutes'];
  if (!Object.hasOwn(countries, issuedBy) || issuedBy === code) throw new Error(`${code}'s passports are issued by another country on the map, not ${issuedBy}`);
  if (['routes', 'passports', 'abroad', 'card'].some((k) => k in file)) throw new Error(`${code}'s passports are ${issuedBy}'s, so it has no routes, passports, fees abroad or passport card of its own`);
  if (onlyRoutes === undefined) return { issuedBy };
  if (!Array.isArray(onlyRoutes) || onlyRoutes.length === 0 || onlyRoutes.some((r) => typeof r !== 'string' || r === '') || new Set(onlyRoutes).size !== onlyRoutes.length) {
    throw new Error(`${code} is open to distinct routes of ${issuedBy}'s by id`);
  }
  return { issuedBy, onlyRoutes: onlyRoutes as string[] };
}

/** Every issuer named is a country compiled in its own right, and every route a territory is open to is one of the issuer's. */
export function checkIssuers(passports: Readonly<Record<string, Entry>>): void {
  for (const [code, e] of Object.entries(passports)) {
    if (!('issuedBy' in e)) continue;
    const issuer = passports[e.issuedBy];
    if (issuer === undefined || 'issuedBy' in issuer) throw new Error(`${code}'s passports are ${e.issuedBy}'s, which the game doesn't keep in its own right`);
    const ids = new Set(issuer.routes.map((r) => r.id));
    for (const r of e.onlyRoutes ?? []) if (!ids.has(r)) throw new Error(`${code} is open to a route ${e.issuedBy} has none of (${r})`);
  }
}

/**
 * The passports of every file the register cites and checks, compiled where in the engine's form; `pending` names
 * the ones still in the research's own words.
 */
export function readPassports(root: string): { passports: Record<string, Entry>; pending: string[] } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { fact: string; value?: { file?: string; sha256?: string } }[] };
  const cited = new Map(register.entries.flatMap((e) => (e.fact.startsWith('papers.passports.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const passports: Record<string, Entry> = {};
  const pending: string[] = [];
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const path = `${SOURCES}/${name}`;
    const bytes = readFileSync(join(root, path));
    const sha = cited.get(path);
    if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
    const code = name.slice(0, -'.json'.length);
    const file = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
    if ('issuedBy' in file) passports[code] = compileIssued(code, file);
    else if (isCompilable(file)) passports[code] = compilePassport(code, file);
    else pending.push(code);
  }
  checkIssuers(passports);
  return { passports, pending };
}

export const serialize = (passports: Record<string, Entry>) => `${JSON.stringify(passports, null, 1)}\n`;
