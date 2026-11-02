import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the markets a screenwriter sells a script in beyond the WGA's (src/person/work/markets.json), from the
 * research's files, one per country (research/sources/person/markets/writer-<CC>.json, register fact
 * person.markets.writer.<CC>), each checked against the SHA-256 its register entry cites before a byte of it is read
 * (a file with no figures, which the register holds only as a blocker, person.markets.writer.blocked.<CC>, is read for
 * its blockers alone, each of them one the register's attempts name), and the game's reading of them
 * (tools/person/markets-writer/readings.json): the agreements a script can be sold under in the country, and where in
 * the research each minimum stands.
 *
 * A market gives its agreements; or, where its research says a writer there is engaged on another market's terms (a
 * French overseas department on France's, an Australian territory on Australia's), it follows that market, whose
 * agreements a script is sold under there; or none, where no one is there to buy (a territory with no people, a
 * country that no longer exists) or the research names no terms and no blocker.
 *
 * An agreement gives its country, the languages its scripts are written in (each one a person can be made to speak:
 * identity's languages; read from the writer's research or the country's own, the actor's, where they name it; none
 * where its figures aren't known), the forms it sets terms for (a feature, a pilot, an episode, a short), and either:
 * - none, where the research says no agreement sets a writer's pay (it is left to negotiation);
 * - unknown, where the research couldn't find whether an agreement sets it, or its figures (the blockers say so), which
 *   the engine refuses and tells;
 * - its minimums: each for the forms it names, for a kind of script where it sets one by kind (fiction, documentary,
 *   animation), by the tier it sets (the production's budget, the script's running time, the budget an hour of it),
 *   from the date it applies, in the agreement's currency, paid by the script, the minute, the hour or each day the
 *   script was written (a wage floor the research's source says reaches the writer); a share of the budget where the
 *   agreement sets its floor so, under a ceiling an hour; and what of it waits for the first day of photography. A tier
 *   the research leaves to negotiation (a budget under the agreement's floor) is read as such, never given a figure.
 * And its option's terms: a share of the script's minimum (or of the minimum the research names) for a year, as the
 * research sets it; negotiated where the research's own finding on options says nothing sets its price; none where the
 * research gives no option, which the engine refuses.
 *
 * Every amount is read from the research at its place, never written here; every date and currency is checked to stand
 * in the research's figure. A market gives its agreements and what its research couldn't find (its blockers' items),
 * which the engine tells the player.
 */
export const SOURCES = 'research/sources/person/markets';
export const READINGS = 'tools/person/markets-writer/readings.json';
export const OUTPUT = 'src/person/work/markets.json';
export const LANGUAGES = 'src/person/identity/languages.json';
/** The research's files: the screenwriter's, one per country. */
export const PREFIX = 'writer-';
/** The register's facts: a market's research, and its blockers. */
export const FACT = 'person.markets.writer.';
export const BLOCKED = 'person.markets.writer.blocked.';
/** The register's fact for a country's own research (the actor's file, which gives the country's languages). */
export const COUNTRY_FACT = 'person.markets.';
/** The agreement the screenwriter's engine keeps itself (R-4241, the WGA's MBA); a market's may not take its id. */
export const KEPT = ['wga'] as const;

export const FORMS = ['feature', 'pilot', 'episode', 'short'] as const;
/** What a minimum is paid by: the script, each minute of it, each hour of it, each day it was written. */
export const PERS = ['script', 'minute', 'hour', 'day'] as const;
/** The kinds of script a minimum can be set for, where an agreement sets one by kind. */
export const KINDS = ['fiction', 'documentary', 'animation'] as const;
/** What a minimum's tier turns on: the production's budget, the script's minutes, the budget an hour of it. */
export const TIERS = ['budget', 'minutes', 'hourly'] as const;
/** What a market's research can leave unknown, as its blockers name it. */
export const ITEMS = ['agreement', 'fees', 'option', 'language', 'union', 'terms', 'none', 'follows'] as const;
/** The blockers that leave an agreement's figures unknown: its fees, whether there is one, whether anything sets the terms, whether another market's reach it. */
export const UNKNOWING: readonly Item[] = ['agreement', 'fees', 'terms', 'none', 'follows'];

export type Form = (typeof FORMS)[number];
export type Per = (typeof PERS)[number];
export type Tier = (typeof TIERS)[number];
export type Kind = (typeof KINDS)[number];
export type Item = (typeof ITEMS)[number];
/** From one whole number to another, both counted; to none, without end. */
export type Range = readonly [number, number | null];

export interface Fee {
  forms: Form[];
  /** The kind of script it is set for; none where the agreement doesn't set it by kind. */
  kind: Kind | null;
  when: Partial<Record<Tier, Range>>;
  /** None where the tier is left to negotiation. */
  per: Per | null;
  from: string;
  amount: string | null;
  /** A share of the budget the minimum is at least, where the agreement sets one. */
  share: string | null;
  /** The most the minimum asks, by the same unit as the amount. */
  cap: string | null;
  /** What of it waits for the first day of photography: a share of it, or an amount. */
  held: { share: string } | { amount: string } | null;
}

export interface Priced {
  forms: Form[];
  /** The option's price for a year, as a share of the script's minimum, or of the base the research names. */
  share: string;
  base: string | null;
}

export interface Agreement {
  country: string;
  /** None where the agreement's figures aren't known. */
  languages: string[];
  /** None where no agreement sets the pay, or its figures aren't known. */
  currency: string | null;
  forms: Form[];
  none: boolean;
  unknown: boolean;
  fees: Fee[];
  option: Priced[] | 'negotiated' | null;
}

export interface Market {
  agreements: string[];
  unknown: Item[];
}

export interface Markets {
  markets: Record<string, Market>;
  agreements: Record<string, Agreement>;
}

interface Figure {
  item: string;
  finding?: string;
  value: unknown;
}
export interface Research {
  country: string;
  figures: Figure[];
  blockers: { item: string }[];
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string }; attempts?: { result: string }[] }[];
}

const record = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what} is not an object`);
  return v as Record<string, unknown>;
};

const only = (m: Record<string, unknown>, keys: readonly string[], what: string): void => {
  for (const k of Object.keys(m)) if (!keys.includes(k)) throw new Error(`${what} names ${k}, which the game doesn't read`);
};

/** The research's figure a reading points at, of one of the items it may be (any, where none are named). */
export function figureOf(r: Research, at: unknown, items: readonly string[] | null): Figure {
  const f = typeof at === 'number' ? r.figures[at] : undefined;
  if (f === undefined || (items !== null && !items.includes(f.item))) throw new Error(`${r.country}'s figure ${String(at)} isn't one of its ${items === null ? 'figures' : items.join(' or ')}`);
  return f;
}

/** What stands at a path in a figure's value. */
export function at(v: unknown, path: unknown): unknown {
  if (!Array.isArray(path)) throw new Error('a path is a list');
  let here = v;
  for (const key of path as (string | number)[]) {
    if (typeof here !== 'object' || here === null || !Object.hasOwn(here, key)) throw new Error(`has nothing at ${path.join('.')}`);
    here = (here as Record<string, unknown>)[key];
  }
  return here;
}

/** A positive number at a path in a figure: an amount, a share, a percentage. */
export function numberAt(r: Research, f: Figure, path: unknown): number {
  const n = at(f.value, path);
  if (typeof n !== 'number' || !(n > 0)) throw new Error(`${r.country}'s figure has no figure at ${(path as unknown[]).join('.')}`);
  return n;
}

/** A share, written as a decimal under one: from a percentage, or as the research writes it. */
export function shareOf(n: number, unit: unknown): string {
  if (unit !== 'pct' && unit !== 'share') throw new Error(`a share is read as a pct or a share, not ${String(unit)}`);
  const s = String(unit === 'pct' ? n / 100 : n);
  if (!s.startsWith('0.')) throw new Error(`a share is under one (${s})`);
  return s;
}

/** A tier's range: whole numbers, the first no more than the last. */
export function range(v: unknown): Range {
  if (!Array.isArray(v) || v.length !== 2) throw new Error('a tier is a pair');
  const [lo, hi] = v as unknown[];
  if (!Number.isSafeInteger(lo) || (lo as number) < 0 || (hi !== null && (!Number.isSafeInteger(hi) || (hi as number) < (lo as number)))) throw new Error(`a tier runs from a whole number to a greater one or none (${JSON.stringify(v)})`);
  return [lo as number, hi as number | null];
}

const overlap = (a: Range, b: Range) => a[0] <= (b[1] ?? Infinity) && b[0] <= (a[1] ?? Infinity);

/** Whether two minimums can never both apply to one script: a form they don't share, kinds both set apart, or a tier both set in ranges that don't meet. */
export const apart = (a: Fee, b: Fee): boolean =>
  !a.forms.some((f) => b.forms.includes(f)) || (a.kind !== null && b.kind !== null && a.kind !== b.kind) || TIERS.some((k) => a.when[k] !== undefined && b.when[k] !== undefined && !overlap(a.when[k], b.when[k]));

/** Whether a date stands in a figure: written whole, or (the first of a month) as its month. */
export const dated = (text: string, from: string): boolean => text.includes(from) || (from.endsWith('-01') && text.includes(`"${from.slice(0, 7)}"`));

const formsOf = (v: unknown, of: readonly Form[], what: string): Form[] => {
  if (!Array.isArray(v) || v.length === 0 || !v.every((x) => of.includes(x as Form))) throw new Error(`${what} is for ${of.join(', ')}`);
  return v as Form[];
};

const dateIn = (r: Research, f: Figure, from: unknown): string => {
  const d = String(from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !dated(JSON.stringify(f), d)) throw new Error(`${r.country}'s figure doesn't date a minimum from ${d}`);
  return d;
};

/** One minimum, read from the research at its place; or a tier its research leaves to negotiation. */
export function feeOf(r: Research, reading: unknown, currency: CurrencyCode, forms: readonly Form[]): Fee {
  const m = record(reading, 'a minimum');
  only(m, ['forms', 'kind', 'when', 'per', 'from', 'dated', 'fig', 'path', 'negotiated', 'held', 'share', 'cap'], 'a minimum');
  const own = formsOf(m['forms'], forms, "a minimum's forms");
  if (m['kind'] !== undefined && !KINDS.includes(m['kind'] as Kind)) throw new Error(`a minimum is set for ${String(m['kind'])}, a kind the game doesn't read`);
  const kind = (m['kind'] ?? null) as Kind | null;
  const when: Partial<Record<Tier, Range>> = {};
  for (const [k, v] of Object.entries(record(m['when'] ?? {}, 'a tier'))) {
    if (!TIERS.includes(k as Tier)) throw new Error(`a minimum's tier turns on ${k}, which the game doesn't read`);
    when[k as Tier] = range(v);
  }
  if (m['negotiated'] !== undefined) {
    const f = figureOf(r, record(m['negotiated'], 'negotiated')['fig'], null);
    if (!/negotia|exempt/i.test(JSON.stringify(f))) throw new Error(`${r.country}'s figure doesn't leave the tier to negotiation`);
    const from = dateIn(r, m['dated'] === undefined ? f : figureOf(r, m['dated'], null), m['from']);
    return { forms: own, kind, when, per: null, from, amount: null, share: null, cap: null, held: null };
  }
  const figure = figureOf(r, m['fig'], ['fees', 'agreement', 'rates']);
  if (!PERS.includes(m['per'] as Per)) throw new Error(`a minimum is paid by ${String(m['per'])}, which the game doesn't read`);
  const from = dateIn(r, m['dated'] === undefined ? figure : figureOf(r, m['dated'], null), m['from']);
  if (!JSON.stringify(figure).includes(currency)) throw new Error(`${r.country}'s figure ${String(m['fig'])} doesn't name ${currency}`);
  const amount = numberAt(r, figure, m['path']);
  fromMajor(currency, String(amount));
  let held: Fee['held'] = null;
  if (m['held'] !== undefined) {
    const h = record(m['held'], 'what is held');
    const n = numberAt(r, figure, h['path']);
    if (h['unit'] === 'amount') {
      if (!(n < amount)) throw new Error(`${r.country} holds more than the minimum until photography`);
      held = { amount: String(n) };
    } else held = { share: shareOf(n, h['unit']) };
  }
  const sh = m['share'] === undefined ? null : record(m['share'], 'a share');
  const share = sh === null ? null : shareOf(numberAt(r, figure, sh['path']), sh['unit']);
  const cap = m['cap'] === undefined ? null : numberAt(r, figure, record(m['cap'], 'a cap')['path']);
  if (cap !== null && !(cap > amount)) throw new Error(`${r.country}'s ceiling is under its floor`);
  return { forms: own, kind, when, per: m['per'] as Per, from, amount: String(amount), share, cap: cap === null ? null : String(cap), held };
}

/** Whether an agreement's minimums are one to a script: where two share a form and a date, they are apart by a tier. */
export function checkFees(id: string, all: readonly Fee[]): void {
  for (const [i, a] of all.entries()) for (const b of all.slice(i + 1)) if (a.from === b.from && !apart(a, b)) throw new Error(`${id} sets two minimums for one script (${a.forms.join(', ')} from ${a.from})`);
}

/** An agreement's option: negotiated where the research's finding on options says so, or priced at its share for a year. */
export function optionOf(r: Research, reading: unknown, currency: CurrencyCode | null, forms: readonly Form[]): Agreement['option'] {
  if (reading === undefined) return null;
  const o = record(reading, 'an option');
  only(o, ['negotiated', 'priced'], 'an option');
  if (o['negotiated'] !== undefined) {
    figureOf(r, record(o['negotiated'], 'negotiated')['fig'], ['option']);
    return 'negotiated';
  }
  if (currency === null || !Array.isArray(o['priced']) || o['priced'].length === 0) throw new Error(`${r.country}'s option is priced in the agreement's currency`);
  const priced = o['priced'].map((p): Priced => {
    const x = record(p, 'a price');
    only(x, ['forms', 'fig', 'path', 'unit', 'base'], 'a price');
    const share = shareOf(numberAt(r, figureOf(r, x['fig'], ['option']), x['path']), x['unit']);
    if (x['base'] === undefined) return { forms: formsOf(x['forms'], forms, "an option's forms"), share, base: null };
    const b = record(x['base'], 'a base');
    const f = figureOf(r, b['fig'], ['fees', 'agreement']);
    if (!JSON.stringify(f).includes(currency)) throw new Error(`${r.country}'s base doesn't name ${currency}`);
    const amount = numberAt(r, f, b['path']);
    dateIn(r, f, b['from']);
    return { forms: formsOf(x['forms'], forms, "an option's forms"), share, base: String(amount) };
  });
  for (const f of forms) if (!priced.some((p) => p.forms.includes(f))) throw new Error(`${r.country}'s option sets no price for a ${f}`);
  return priced;
}

/** A language an agreement's scripts are written in: one a person speaks, standing where the reading says the research names it (the writer's figure, or the country's own, the actor's), the game's own where it says none. */
export function languageOf(r: Research, reading: unknown, names: Readonly<Record<string, string>>, country: Research | null): string {
  const lang = record(reading, 'a language');
  only(lang, ['code', 'fig', 'actor'], 'a language');
  const code = String(lang['code']);
  if (!Object.hasOwn(names, code)) throw new Error(`${r.country} writes in ${code}, which a person can't speak`);
  const named = (text: string, whose: string) => {
    if (!new RegExp(`\\b${code}\\b`).test(text) && !text.includes(names[code] as string)) throw new Error(`${whose} language figure doesn't name ${code}`);
  };
  if (lang['fig'] !== undefined && lang['fig'] !== null) named(JSON.stringify(figureOf(r, lang['fig'], null)), `${r.country}'s`);
  if (lang['actor'] !== undefined) {
    if (country === null) throw new Error(`${r.country}'s own research isn't read`);
    named(JSON.stringify(figureOf(country, lang['actor'], ['language'])), `${r.country}'s own`);
  }
  return code;
}

/** What says no agreement sets the pay: a figure of none, a place in a figure that is none, or a figure whose finding says so. */
function noneIn(r: Research, reading: unknown): void {
  const n = record(reading, 'none');
  only(n, ['fig', 'path', 'said'], 'none');
  const f = figureOf(r, n['fig'], null);
  if (n['said'] !== undefined) {
    if (typeof n['said'] !== 'string' || n['said'] === '' || !(f.finding ?? '').includes(n['said'])) throw new Error(`${r.country}'s figure ${String(n['fig'])} doesn't say ${JSON.stringify(n['said'])}`);
    return;
  }
  if (f.item !== 'none' && at(f.value, n['path']) !== null) throw new Error(`${r.country}'s figure ${String(n['fig'])} doesn't say nothing sets the pay`);
}

/** One agreement: its languages and forms, and the pay left to negotiation, unknown, or its minimums; and its option. */
export function agreementOf(id: string, r: Research, reading: unknown, names: Readonly<Record<string, string>>, country: Research | null = null): Agreement {
  const a = record(reading, `the reading of ${id}`);
  only(a, ['forms', 'language', 'currency', 'fees', 'none', 'unknown', 'option'], id);
  const forms = formsOf(a['forms'], FORMS, `${id}'s forms`);
  const listed = a['language'] === undefined ? [] : Array.isArray(a['language']) ? a['language'] : [a['language']];
  const languages = listed.map((l) => languageOf(r, l, names, country));
  if (new Set(languages).size !== languages.length) throw new Error(`${id} names a language twice`);
  const base = { country: r.country, languages, forms };
  if (a['unknown'] === true) return { ...base, currency: null, none: false, unknown: true, fees: [], option: null };
  if (languages.length === 0) throw new Error(`${id} names no language its scripts are written in`);
  if (a['none'] !== undefined) {
    noneIn(r, a['none']);
    return { ...base, currency: null, none: true, unknown: false, fees: [], option: optionOf(r, a['option'], null, forms) };
  }
  const currency = String(a['currency']);
  if (!isCurrency(currency)) throw new Error(`${id} pays in ${currency}, which isn't a currency`);
  if (!Array.isArray(a['fees'])) throw new Error(`${id} sets no minimums`);
  // By date, so each tier's steps run in order (as the engine reads them); the reading's order kept between equals.
  const fees = a['fees'].map((m) => feeOf(r, m, currency, forms)).sort((x, y) => x.from.localeCompare(y.from));
  for (const f of forms) if (!fees.some((x) => x.forms.includes(f))) throw new Error(`${id} sets no minimum for a ${f}`);
  checkFees(id, fees);
  return { ...base, currency, none: false, unknown: false, fees, option: optionOf(r, a['option'], currency, forms) };
}

/** The items a file's blockers name, each once, in the research's order. */
export function unknownOf(blockers: readonly { item: string }[]): Item[] {
  const out: Item[] = [];
  for (const { item } of blockers) {
    if (!ITEMS.includes(item as Item)) throw new Error(`a blocker names ${item}, which isn't a fact the research seeks`);
    if (!out.includes(item as Item)) out.push(item as Item);
  }
  return out;
}

/**
 * A market: its agreements, and what isn't known; an agreement whose figures are unknown stands only where its blockers
 * say so. Or the market it follows, where its research says a writer there is engaged on that market's terms.
 */
export function marketOf(r: Research, reading: unknown, names: Readonly<Record<string, string>>, country: Research | null = null): { market: Market; agreements: Record<string, Agreement>; follows: string | null } {
  const m = record(reading, `the reading of ${r.country}`);
  only(m, ['agreements', 'follows'], r.country);
  const unknown = unknownOf(r.blockers);
  if (m['follows'] !== undefined) {
    if (m['agreements'] !== undefined) throw new Error(`${r.country} follows another market or has its own agreements, not both`);
    const f = record(m['follows'], 'follows');
    only(f, ['market', 'fig'], 'follows');
    const followed = String(f['market']);
    if (at(figureOf(r, f['fig'], null).value, ['follows']) !== followed) throw new Error(`${r.country}'s figure ${String(f['fig'])} doesn't say it follows ${followed}`);
    return { market: { agreements: [], unknown }, agreements: {}, follows: followed };
  }
  const agreements: Record<string, Agreement> = {};
  for (const [id, a] of Object.entries(record(m['agreements'], 'the agreements'))) {
    agreements[id] = agreementOf(id, r, a, names, country);
    if (agreements[id].unknown && !unknown.some((u) => UNKNOWING.includes(u))) throw new Error(`${id}'s figures are unknown, which ${r.country}'s blockers don't say`);
  }
  return { market: { agreements: Object.keys(agreements), unknown }, agreements, follows: null };
}

/** A file the register cites, checked against its SHA-256 before a byte is read. */
function cited(root: string, register: Register, file: string, fact: string): Buffer | null {
  // Stryker disable next-line OptionalChaining: the entry found names the file, so it has a value.
  const sha = register.entries.find((e) => e.fact === fact && e.value?.file === file)?.value?.sha256;
  if (sha === undefined) return null;
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${file} isn't the file the register cites`);
  return bytes;
}

/**
 * A market's research, checked against the register's SHA-256 before a byte is read, and whether the register holds its
 * blockers. A file the register holds only as a blocker (it has no figures to cite) is read for its blockers alone, each
 * one an item the register's attempts didn't find.
 */
export function readResearch(root: string, register: Register, cc: string): { research: Research; blocked: boolean } {
  const file = `${SOURCES}/${PREFIX}${cc}.json`;
  const blocker = register.entries.find((e) => e.fact === `${BLOCKED}${cc}`);
  const bytes = cited(root, register, file, `${FACT}${cc}`);
  if (bytes === null) {
    if (blocker === undefined) throw new Error(`${file} isn't cited by the register`);
    const research = JSON.parse(readFileSync(join(root, file), 'utf8')) as Research;
    if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
    if (research.figures.length > 0) throw new Error(`${file} has figures the register doesn't cite`);
    // Stryker disable next-line ArrayDeclaration: an entry with no attempts seeks nothing, and a placeholder attempt has no result to name an item.
    const sought = (blocker.attempts ?? []).map((a) => /^not found: (\w+)/.exec(a.result)?.[1]);
    for (const { item } of research.blockers) if (!sought.includes(item)) throw new Error(`${file}'s blocker ${item} isn't one the register's attempts sought`);
    return { research, blocked: true };
  }
  const research = JSON.parse(bytes.toString('utf8')) as Research;
  if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
  return { research, blocked: blocker !== undefined };
}

/** A country's own research (the actor's file), checked against the register's SHA-256: where a market's languages are read from. */
export function countryResearch(root: string, register: Register, cc: string): Research {
  const file = `${SOURCES}/${cc}.json`;
  const bytes = cited(root, register, file, `${COUNTRY_FACT}${cc}`);
  if (bytes === null) throw new Error(`${file} isn't cited by the register`);
  const research = JSON.parse(bytes.toString('utf8')) as Research;
  if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
  return research;
}

/** Whether a reading reads the country's own research: a language it names there. */
const readsCountry = (reading: unknown): boolean => JSON.stringify(reading ?? null).includes('"actor":');

/**
 * Every market the research holds, read as the readings say; a file without a reading, or a reading without a file, is
 * refused. A market that follows another sells under the other's agreements (the WGA's, for the US), the other being one
 * that doesn't itself follow.
 */
export function readMarkets(root: string): Markets {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const readings = record(read(READINGS), 'the readings');
  const register = read('research/register.json') as Register;
  const names = (read(LANGUAGES) as { names: Record<string, string> }).names;
  // Stryker disable next-line MethodExpression: the directory's order is sorted on the file systems the gate runs on; the sort holds it on any other.
  const files = existsSync(join(root, SOURCES)) ? readdirSync(join(root, SOURCES)).filter((f) => f.startsWith(PREFIX) && f.endsWith('.json')).map((f) => f.slice(PREFIX.length, -5)).sort() : [];
  const out: Markets = { markets: {}, agreements: {} };
  const follows: [string, string][] = [];
  for (const cc of Object.keys(readings).filter((c) => !files.includes(c))) throw new Error(`${cc} has a reading and no research`);
  for (const cc of files) {
    if (!Object.hasOwn(readings, cc)) throw new Error(`${SOURCES}/${PREFIX}${cc}.json has no reading`);
    const { research, blocked } = readResearch(root, register, cc);
    const country = readsCountry(readings[cc]) ? countryResearch(root, register, cc) : null;
    const { market, agreements, follows: followed } = marketOf(research, readings[cc], names, country);
    if (blocked !== market.unknown.length > 0) throw new Error(blocked ? `the register holds ${cc}'s blockers, which its research doesn't` : `${cc}'s research has blockers the register doesn't hold`);
    for (const id of market.agreements) if ((KEPT as readonly string[]).includes(id) || Object.hasOwn(out.agreements, id)) throw new Error(`${id} is another agreement's id`);
    out.markets[cc] = market;
    Object.assign(out.agreements, agreements);
    if (followed !== null) follows.push([cc, followed]);
  }
  const following = new Set(follows.map(([cc]) => cc));
  for (const [cc, followed] of follows) {
    if (followed === 'US') {
      (out.markets[cc] as Market).agreements = [...KEPT];
      continue;
    }
    const other = out.markets[followed];
    if (other === undefined || following.has(followed)) throw new Error(`${cc} follows ${followed}, which isn't a market of its own`);
    (out.markets[cc] as Market).agreements = [...other.agreements];
  }
  return out;
}

export const serialize = (m: Markets) => `${JSON.stringify(m, null, 1)}\n`;
