import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the markets a screenwriter sells a script in beyond the WGA's (src/person/work/markets.json), from the
 * research's files, one per country (research/sources/person/markets/writer-<CC>.json, register fact
 * person.markets.writer.<CC>), each checked against the SHA-256 its register entry cites before a byte of it is read,
 * and the game's reading of them (tools/person/markets-writer/readings.json): the agreements a script can be sold under
 * in the country, and where in the research each minimum stands.
 *
 * An agreement gives its country, the language its scripts are written in (one a person can be made to speak:
 * identity's languages), the forms it sets terms for (a feature, a pilot, an episode, a short), and either:
 * - none, where the research says no agreement sets a writer's pay (it is left to negotiation);
 * - unknown, where an agreement sets it and the research couldn't find its figures (the blockers say so), which the
 *   engine refuses and tells;
 * - its minimums: each for the forms it names, by the tier it sets (the production's budget, the script's running time,
 *   the budget an hour of it), from the date it applies, in the agreement's currency, paid by the script, the minute or
 *   the hour; a share of the budget where the agreement sets its floor so, under a ceiling an hour; and what of it waits
 *   for the first day of photography. A tier the research leaves to negotiation (a budget under the agreement's floor)
 *   is read as such, never given a figure.
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
/** The agreement the screenwriter's engine keeps itself (R-4241, the WGA's MBA); a market's may not take its id. */
export const KEPT = ['wga'] as const;

export const FORMS = ['feature', 'pilot', 'episode', 'short'] as const;
/** What a minimum is paid by: the script, each minute of it, each hour of it. */
export const PERS = ['script', 'minute', 'hour'] as const;
/** What a minimum's tier turns on: the production's budget, the script's minutes, the budget an hour of it. */
export const TIERS = ['budget', 'minutes', 'hourly'] as const;
/** What a market's research can leave unknown, as its blockers name it. */
export const ITEMS = ['agreement', 'fees', 'option', 'language', 'union'] as const;

export type Form = (typeof FORMS)[number];
export type Per = (typeof PERS)[number];
export type Tier = (typeof TIERS)[number];
export type Item = (typeof ITEMS)[number];
/** From one whole number to another, both counted; to none, without end. */
export type Range = readonly [number, number | null];

export interface Fee {
  forms: Form[];
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
  language: string;
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
  value: unknown;
}
export interface Research {
  country: string;
  figures: Figure[];
  blockers: { item: string }[];
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
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

/** Whether two minimums can never both apply to one script: a form they don't share, or a tier both set in ranges that don't meet. */
export const apart = (a: Fee, b: Fee): boolean => !a.forms.some((f) => b.forms.includes(f)) || TIERS.some((k) => a.when[k] !== undefined && b.when[k] !== undefined && !overlap(a.when[k], b.when[k]));

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
  only(m, ['forms', 'when', 'per', 'from', 'dated', 'fig', 'path', 'negotiated', 'held', 'share', 'cap'], 'a minimum');
  const own = formsOf(m['forms'], forms, "a minimum's forms");
  const when: Partial<Record<Tier, Range>> = {};
  for (const [k, v] of Object.entries(record(m['when'] ?? {}, 'a tier'))) {
    if (!TIERS.includes(k as Tier)) throw new Error(`a minimum's tier turns on ${k}, which the game doesn't read`);
    when[k as Tier] = range(v);
  }
  if (m['negotiated'] !== undefined) {
    const f = figureOf(r, record(m['negotiated'], 'negotiated')['fig'], null);
    if (!/negotia|exempt/i.test(JSON.stringify(f))) throw new Error(`${r.country}'s figure doesn't leave the tier to negotiation`);
    const from = dateIn(r, m['dated'] === undefined ? f : figureOf(r, m['dated'], null), m['from']);
    return { forms: own, when, per: null, from, amount: null, share: null, cap: null, held: null };
  }
  const figure = figureOf(r, m['fig'], ['fees', 'agreement']);
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
  return { forms: own, when, per: m['per'] as Per, from, amount: String(amount), share, cap: cap === null ? null : String(cap), held };
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

/** One agreement: its language and forms, and the pay left to negotiation, unknown, or its minimums; and its option. */
export function agreementOf(id: string, r: Research, reading: unknown, names: Readonly<Record<string, string>>): Agreement {
  const a = record(reading, `the reading of ${id}`);
  only(a, ['forms', 'language', 'currency', 'fees', 'none', 'unknown', 'option'], id);
  const forms = formsOf(a['forms'], FORMS, `${id}'s forms`);
  const lang = record(a['language'], 'a language');
  const code = String(lang['code']);
  if (!Object.hasOwn(names, code)) throw new Error(`${id} is written in ${code}, which a person can't speak`);
  if (lang['fig'] !== null) {
    const text = JSON.stringify(figureOf(r, lang['fig'], null));
    if (!new RegExp(`\\b${code}\\b`).test(text) && !text.includes(names[code] as string)) throw new Error(`${r.country}'s language figure doesn't name ${code}`);
  }
  const base = { country: r.country, language: code, forms };
  if (a['unknown'] === true) return { ...base, currency: null, none: false, unknown: true, fees: [], option: null };
  if (a['none'] !== undefined) {
    const n = record(a['none'], 'none');
    const f = figureOf(r, n['fig'], null);
    if (f.item !== 'none' && at(f.value, n['path']) !== null) throw new Error(`${r.country}'s figure ${String(n['fig'])} doesn't say nothing sets the pay`);
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

/** A market: its agreements, and what isn't known; an agreement whose figures are unknown stands only where its blockers say so. */
export function marketOf(r: Research, reading: unknown, names: Readonly<Record<string, string>>): { market: Market; agreements: Record<string, Agreement> } {
  const m = record(reading, `the reading of ${r.country}`);
  only(m, ['agreements'], r.country);
  const unknown = unknownOf(r.blockers);
  const agreements: Record<string, Agreement> = {};
  for (const [id, a] of Object.entries(record(m['agreements'], 'the agreements'))) {
    agreements[id] = agreementOf(id, r, a, names);
    if (agreements[id].unknown && !unknown.includes('fees') && !unknown.includes('agreement')) throw new Error(`${id}'s figures are unknown, which ${r.country}'s blockers don't say`);
  }
  return { market: { agreements: Object.keys(agreements), unknown }, agreements };
}

/** A market's research, checked against the register's SHA-256 before a byte is read, and whether the register holds its blockers. */
export function readResearch(root: string, register: Register, cc: string): { research: Research; blocked: boolean } {
  const file = `${SOURCES}/${PREFIX}${cc}.json`;
  // Stryker disable next-line OptionalChaining: the entry found names the file, so it has a value.
  const sha = register.entries.find((e) => e.fact === `${FACT}${cc}` && e.value?.file === file)?.value?.sha256;
  if (sha === undefined) throw new Error(`${file} isn't cited by the register`);
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${file} isn't the file the register cites`);
  const research = JSON.parse(bytes.toString('utf8')) as Research;
  if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
  return { research, blocked: register.entries.some((e) => e.fact === `${BLOCKED}${cc}`) };
}

/** Every market the research holds, read as the readings say; a file without a reading, or a reading without a file, is refused. */
export function readMarkets(root: string): Markets {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const readings = record(read(READINGS), 'the readings');
  const register = read('research/register.json') as Register;
  const names = (read(LANGUAGES) as { names: Record<string, string> }).names;
  // Stryker disable next-line MethodExpression: the directory's order is sorted on the file systems the gate runs on; the sort holds it on any other.
  const files = existsSync(join(root, SOURCES)) ? readdirSync(join(root, SOURCES)).filter((f) => f.startsWith(PREFIX) && f.endsWith('.json')).map((f) => f.slice(PREFIX.length, -5)).sort() : [];
  const out: Markets = { markets: {}, agreements: {} };
  for (const cc of Object.keys(readings).filter((c) => !files.includes(c))) throw new Error(`${cc} has a reading and no research`);
  for (const cc of files) {
    if (!Object.hasOwn(readings, cc)) throw new Error(`${SOURCES}/${PREFIX}${cc}.json has no reading`);
    const { research, blocked } = readResearch(root, register, cc);
    const { market, agreements } = marketOf(research, readings[cc], names);
    if (blocked !== market.unknown.length > 0) throw new Error(blocked ? `the register holds ${cc}'s blockers, which its research doesn't` : `${cc}'s research has blockers the register doesn't hold`);
    for (const id of market.agreements) if ((KEPT as readonly string[]).includes(id) || Object.hasOwn(out.agreements, id)) throw new Error(`${id} is another agreement's id`);
    out.markets[cc] = market;
    Object.assign(out.agreements, agreements);
  }
  return out;
}

export const serialize = (m: Markets) => `${JSON.stringify(m, null, 1)}\n`;
