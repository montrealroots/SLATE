import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, minorUnits, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the markets a producer works in beyond the UK (src/person/producing/markets.json), from the research's files,
 * one per country (research/sources/person/markets/producer-<CC>.json, register fact person.markets.producer.<CC>) and
 * the producer's calibration (research/sources/person/work/producer-calibration.json, R-4612: Telefilm's, the CNC's
 * and Screen Australia's terms), each checked against the SHA-256 its register entry cites before a byte of it is read,
 * and the game's reading of them (tools/person/markets-producer/readings.json): where in the research each term stands.
 *
 * A market gives its currency and what a project there can draw on, each by the project's budget where the research
 * sets it by budget (a tier, its bounds counted): the public fund (how often it says yes, and what it awards: a share
 * of the budget, at most so much, or a fixed sum), the cap on all public aid a film may take (the fund's award holds
 * to what the cap leaves after the credit), the production incentive (its rate, a band at a time where it pays one rate
 * on the first so much and another on the rest; the share of the budget it counts; its most), each cap a funder sets on
 * the producer's fee and the company's overheads, and how often a film reaches cinemas. Every rate, share and amount is
 * read from the research at its place, or written in the reading and found standing in the research's figure, as every
 * bound of a tier or a band is; every amount's figure names the market's currency. A term the research doesn't give is
 * none (null): the engine refuses what rests on it and tells the player; an incentive the research says doesn't exist
 * pays nothing.
 */
export const SOURCES = 'research/sources/person/markets';
export const CALIBRATION = 'research/sources/person/work/producer-calibration.json';
export const READINGS = 'tools/person/markets-producer/readings.json';
export const OUTPUT = 'src/person/producing/markets.json';
/** The register's facts: a market's research, its blockers, and the calibration. */
export const FACT = 'person.markets.producer.';
export const BLOCKED = 'person.markets.producer.blocked.';
export const CALIBRATED = 'person.work.producer.calibration';
/** The market the producer's engine keeps itself (R-4612). */
export const KEPT = 'GB';
/** What a market's research can leave unknown, as its blockers name it. */
export const ITEMS = ['fund', 'incentive', 'feecap', 'outcomes', 'market', 'union', 'language'] as const;

export type Item = (typeof ITEMS)[number];
/** From one amount to another, both counted; to none, without end. */
export type Range = readonly [number, number | null];

/** A rate paid on the part of what is counted from one amount to another (to none: the rest). */
export interface Band {
  from: number;
  to: number | null;
  rate: number;
}
/** What a term gives a project whose budget is in its range: a fixed sum, or its bands on the share counted, at most so much. */
export interface Tier {
  budget: Range;
  bands: Band[];
  /** The share of the budget counted. */
  base: number;
  /** Counted net of its own share (a fee of so much of the costs without it, as the research's example counts it). */
  net: boolean;
  most: number | null;
  sum: number | null;
}
export interface Fund {
  rate: number;
  tiers: Tier[];
}
export interface Market {
  currency: CurrencyCode;
  fund: Fund | null;
  /** The cap on all public aid together, the credit with it; where no tier holds the budget, none. */
  aid: Tier[];
  /** The incentive; none where the research says there is none, null where it doesn't give it. */
  credit: Tier[] | null;
  /** Each cap on the producer's fee or the company's overheads. */
  fees: Tier[][];
  release: { budget: Range; rate: number }[] | null;
  unknown: Item[];
}
export type Markets = Record<string, Market>;

interface Figure {
  item: string;
  value: unknown;
}
export interface Research {
  country: string;
  figures: Figure[];
  blockers: { item: string }[];
}
/** The figures a reading may point into: the market's own, and the calibration's. */
export interface Sources {
  country: string;
  own: Research;
  calibration: Research;
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

const record = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what} is not an object`);
  return v as Record<string, unknown>;
};

const only = (m: Record<string, unknown>, keys: readonly string[], what: string) => {
  for (const k of Object.keys(m)) if (!keys.includes(k)) throw new Error(`${what} names ${k}, which the game doesn't read`);
};

/** The figure a reading points at: the market's own, or (`in: "calibration"`) the calibration's. */
export function figureOf(s: Sources, at: Record<string, unknown>): Figure {
  const calibrated = at['in'] === 'calibration';
  if (at['in'] !== undefined && !calibrated) throw new Error(`a figure is the market's own or the calibration's, not ${String(at['in'])}'s`);
  const f = typeof at['fig'] === 'number' ? (calibrated ? s.calibration : s.own).figures[at['fig']] : undefined;
  if (f === undefined) throw new Error(`${s.country} has no ${calibrated ? 'calibration ' : ''}figure ${String(at['fig'])}`);
  return f;
}

/** What stands at a path in a figure's value. */
export function at(v: unknown, path: readonly (string | number)[]): unknown {
  let here = v;
  for (const key of path) {
    if (typeof here !== 'object' || here === null || !Object.hasOwn(here, key)) throw new Error(`has nothing at ${path.join('.')}`);
    here = (here as Record<string, unknown>)[key];
  }
  return here;
}

/** Every number a value holds. */
export function numbersIn(v: unknown): number[] {
  if (typeof v === 'number') return [v];
  if (typeof v !== 'object' || v === null) return [];
  return Object.values(v).flatMap(numbersIn);
}

/** A number as a figure's words may write it: with its thousands, in millions or billions, or as a percentage. */
export function written(n: number): string[] {
  return [n.toLocaleString('en-US'), `${n / 1e6}m`, `${n / 1e6} million`, `${n / 1e9}bn`, `${n / 1e9} billion`, `${Math.round(n * 1e6) / 1e4}%`];
}

/**
 * Whether a number stands in a figure: nought always; else among its value's numbers, or written in its words (not
 * inside a longer number, its thousands' commas counted, nor a count of millions or billions); a bound may stand one minor unit off it (one "under" or "over" a figure, written inside it).
 */
export function stands(f: Figure, n: number, decimals: number, bound: boolean): boolean {
  if (n === 0) return true;
  const scale = 10 ** decimals;
  const nums = numbersIn(f.value);
  const text = JSON.stringify(f);
  const m = Math.round(n * scale);
  return (bound ? [m, m + 1, m - 1] : [m]).some((c) => {
    const x = c / scale;
    return nums.includes(x) || written(x).some((w) => new RegExp(`(?<![\\d.]|\\d,)${w.replace(/\./g, '\\.')}(?![\\d]|[,.]\\d|\\s?(?:m|bn|million|billion)\\b)`).test(text));
  });
}

/** The context a tier is read in: the market, its currency, the figure its values stand in by default. */
interface Reading {
  s: Sources;
  currency: CurrencyCode;
  fig: Figure | null;
}

const figureFor = (r: Reading, what: string): Figure => {
  if (r.fig === null) throw new Error(`${r.s.country}'s ${what} names no figure`);
  return r.fig;
};

/**
 * A number a reading gives: a path in its figure's value (or `{fig, in, path}` in another's), or a number written in
 * the reading that stands in the figure. Read as a rate (0 to 1) or an amount (above nought, in the market's currency,
 * its figure naming it).
 */
export function valueOf(r: Reading, v: unknown, kind: 'rate' | 'amount', what: string): number {
  let fig: Figure;
  let n: unknown;
  if (typeof v === 'number') {
    fig = figureFor(r, what);
    if (!stands(fig, v, kind === 'rate' ? 4 : minorUnits(r.currency), false)) throw new Error(`${r.s.country}'s ${what} ${v} doesn't stand in its figure`);
    n = v;
  } else if (Array.isArray(v)) {
    fig = figureFor(r, what);
    n = at(fig.value, v as (string | number)[]);
  } else {
    const ref = record(v, `${r.s.country}'s ${what}`);
    only(ref, ['fig', 'in', 'path'], `${r.s.country}'s ${what}`);
    fig = figureOf(r.s, ref);
    n = at(fig.value, ref['path'] as (string | number)[]);
  }
  if (typeof n !== 'number') throw new Error(`${r.s.country}'s ${what} isn't a number`);
  if (kind === 'rate' && !(n >= 0 && n <= 1)) throw new Error(`${r.s.country}'s ${what} ${n} isn't a rate`);
  if (kind === 'amount') {
    if (!(n > 0)) throw new Error(`${r.s.country}'s ${what} ${n} isn't an amount`);
    fromMajor(r.currency, String(n));
    if (!JSON.stringify(fig).includes(r.currency)) throw new Error(`${r.s.country}'s ${what} stands in a figure that doesn't name ${r.currency}`);
  }
  return n;
}

/** A bound of a tier or band: an amount in the currency, standing in its figure (nought, or none, always does). */
export function boundOf(r: Reading, v: unknown, what: string): number {
  if (typeof v !== 'number' || !(v >= 0)) throw new Error(`${r.s.country}'s ${what} ${String(v)} isn't a bound`);
  fromMajor(r.currency, String(v));
  if (v === 0) return 0;
  const fig = figureFor(r, what);
  if (!stands(fig, v, minorUnits(r.currency), true)) throw new Error(`${r.s.country}'s ${what} ${v} doesn't stand in its figure`);
  if (!JSON.stringify(fig).includes(r.currency)) throw new Error(`${r.s.country}'s ${what} stands in a figure that doesn't name ${r.currency}`);
  return v;
}

/** A range of budgets, from one bound to a greater one or none; given bare (in the tier's figure) or as `{fig, in, range}`. */
export function rangeOf(r: Reading, v: unknown): Range {
  let here = r;
  let pair = v;
  if (!Array.isArray(v)) {
    const ref = record(v, `${r.s.country}'s budget`);
    only(ref, ['fig', 'in', 'range'], `${r.s.country}'s budget`);
    here = { ...r, fig: figureOf(r.s, ref) };
    pair = ref['range'];
  }
  if (!Array.isArray(pair) || pair.length !== 2) throw new Error(`${r.s.country}'s budget is a pair`);
  const lo = boundOf(here, pair[0], 'budget');
  const hi = pair[1] === null ? null : boundOf(here, pair[1], 'budget');
  if (hi !== null && hi < lo) throw new Error(`${r.s.country}'s budget runs from ${lo} down to ${hi}`);
  return [lo, hi];
}

const TIER_KEYS = ['fig', 'in', 'budget', 'share', 'bands', 'base', 'net', 'most', 'sum'];

/** One tier: its budgets, and a fixed sum, or a share or bands of the share counted, at most so much; or (`bare`) none of them. */
export function tierOf(s: Sources, currency: CurrencyCode, reading: unknown, bare = false): Tier {
  const t = record(reading, `${s.country}'s tier`);
  only(t, TIER_KEYS, `${s.country}'s tier`);
  const r: Reading = { s, currency, fig: t['fig'] === undefined ? null : figureOf(s, t) };
  const budget = rangeOf(r, t['budget']);
  const net = t['net'] === true;
  if (t['sum'] !== undefined) {
    if (t['share'] !== undefined || t['bands'] !== undefined || t['base'] !== undefined || t['most'] !== undefined || net) throw new Error(`${s.country}'s tier is a sum or a share, not both`);
    return { budget, bands: [], base: 1, net: false, most: null, sum: valueOf(r, t['sum'], 'amount', 'sum') };
  }
  if (t['share'] !== undefined && t['bands'] !== undefined) throw new Error(`${s.country}'s tier is a share or bands, not both`);
  const bands: Band[] = [];
  if (t['share'] !== undefined) bands.push({ from: 0, to: null, rate: valueOf(r, t['share'], 'rate', 'share') });
  if (t['bands'] !== undefined) {
    if (!Array.isArray(t['bands']) || t['bands'].length < 2) throw new Error(`${s.country}'s bands are two or more`);
    for (const b of t['bands'] as unknown[]) {
      const band = record(b, `${s.country}'s band`);
      only(band, ['from', 'to', 'rate'], `${s.country}'s band`);
      const from = boundOf(r, band['from'], 'band');
      const to = band['to'] === null ? null : boundOf(r, band['to'], 'band');
      const last = bands.at(-1);
      if (from !== (last === undefined ? 0 : last.to) || (to !== null && to <= from)) throw new Error(`${s.country}'s bands run from nought, each from where the last ends`);
      bands.push({ from, to, rate: valueOf(r, band['rate'], 'rate', 'band rate') });
    }
  }
  if (bands.length === 0 && !bare) throw new Error(`${s.country}'s tier gives nothing`);
  if (net && bands.length !== 1) throw new Error(`${s.country}'s tier is counted net of one share`);
  const most = t['most'] === undefined ? null : valueOf(r, t['most'], 'amount', 'most');
  return { budget, bands, base: t['base'] === undefined ? 1 : valueOf(r, t['base'], 'rate', 'base'), net, most, sum: null };
}

/** Whether two ranges of budgets meet. */
export const meet = (a: Range, b: Range): boolean => a[0] <= (b[1] ?? Infinity) && b[0] <= (a[1] ?? Infinity);

/** A term's tiers, none of whose budgets meet another's, in the order of their budgets. */
export function tiersOf(s: Sources, currency: CurrencyCode, reading: unknown, what: string, bare = false): Tier[] {
  if (!Array.isArray(reading)) throw new Error(`${s.country}'s ${what} is a list of tiers`);
  const tiers = reading.map((t) => tierOf(s, currency, t, bare)).sort((a, b) => a.budget[0] - b.budget[0]);
  for (const [i, t] of tiers.entries()) if (i > 0 && meet((tiers[i - 1] as Tier).budget, t.budget)) throw new Error(`${s.country}'s ${what} has two tiers for one budget`);
  return tiers;
}

/** How often a fund says yes: a rate at its place, or so many funded of so many applied. */
export function rateOf(s: Sources, reading: unknown): number {
  const r = record(reading, `${s.country}'s rate`);
  only(r, ['fig', 'in', 'path', 'of'], `${s.country}'s rate`);
  const fig = figureOf(s, r);
  if (r['of'] === undefined) {
    const n = at(fig.value, r['path'] as (string | number)[]);
    if (typeof n !== 'number' || !(n > 0 && n <= 1)) throw new Error(`${s.country}'s rate isn't a chance`);
    return n;
  }
  const of = r['of'];
  if (r['path'] !== undefined || !Array.isArray(of) || of.length !== 2) throw new Error(`${s.country}'s rate is so many of so many`);
  const [yes, all] = (of as (string | number)[][]).map((p) => at(fig.value, p));
  if (!Number.isSafeInteger(yes) || !Number.isSafeInteger(all) || !((yes as number) > 0 && (yes as number) <= (all as number))) throw new Error(`${s.country}'s rate isn't so many of so many`);
  return (yes as number) / (all as number);
}

/** A market's fund: how often it says yes, and its tiers; none where the reading gives none. */
export function fundOf(s: Sources, currency: CurrencyCode, reading: unknown, aid: readonly Tier[]): Fund | null {
  if (reading === null) return null;
  const f = record(reading, `${s.country}'s fund`);
  only(f, ['rate', 'tiers'], `${s.country}'s fund`);
  const tiers = tiersOf(s, currency, f['tiers'], 'fund', aid.length > 0);
  return { rate: rateOf(s, f['rate']), tiers };
}

/** A market's incentive: its tiers; none (no tiers) where the research says there's none; null where it isn't given. */
export function creditOf(s: Sources, currency: CurrencyCode, reading: unknown): Tier[] | null {
  if (reading === null) return null;
  if (Array.isArray(reading)) return tiersOf(s, currency, reading, 'incentive');
  const n = record(reading, `${s.country}'s incentive`);
  only(n, ['none'], `${s.country}'s incentive`);
  const none = record(n['none'], `${s.country}'s none`);
  only(none, ['fig', 'in', 'path'], `${s.country}'s none`);
  if (at(figureOf(s, none).value, none['path'] as (string | number)[]) !== false) throw new Error(`${s.country}'s research doesn't say it has no incentive`);
  return [];
}

/** A market's chance of a release by budget. */
export function releaseOf(s: Sources, currency: CurrencyCode, reading: unknown): { budget: Range; rate: number }[] | null {
  if (reading === null) return null;
  if (!Array.isArray(reading) || reading.length === 0) throw new Error(`${s.country}'s release is a list of tiers`);
  const tiers = reading.map((x) => {
    const t = record(x, `${s.country}'s release`);
    only(t, ['fig', 'in', 'budget', 'rate'], `${s.country}'s release`);
    const r: Reading = { s, currency, fig: figureOf(s, t) };
    return { budget: rangeOf(r, t['budget']), rate: valueOf(r, t['rate'], 'rate', 'release rate') };
  });
  tiers.sort((a, b) => a.budget[0] - b.budget[0]);
  for (const [i, t] of tiers.entries()) if (i > 0 && meet((tiers[i - 1] as { budget: Range }).budget, t.budget)) throw new Error(`${s.country}'s release has two tiers for one budget`);
  return tiers;
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

/** A market, as its reading reads its research. */
export function marketOf(s: Sources, reading: unknown): Market {
  const m = record(reading, `the reading of ${s.country}`);
  only(m, ['currency', 'fund', 'aid', 'credit', 'fees', 'release'], `the reading of ${s.country}`);
  const currency = String(m['currency']);
  if (!isCurrency(currency)) throw new Error(`${s.country} pays in ${currency}, which isn't a currency`);
  const aid = m['aid'] === undefined ? [] : tiersOf(s, currency, m['aid'], 'aid');
  const fund = fundOf(s, currency, m['fund'] ?? null, aid);
  if (fund === null && aid.length > 0) throw new Error(`${s.country}'s cap on public aid holds no fund`);
  const fees = m['fees'] ?? [];
  if (!Array.isArray(fees)) throw new Error(`${s.country}'s fees are a list`);
  return { currency, fund, aid, credit: creditOf(s, currency, m['credit'] ?? null), fees: fees.map((f) => tiersOf(s, currency, f, 'fee')), release: releaseOf(s, currency, m['release'] ?? null), unknown: unknownOf(s.own.blockers) };
}

/** A file the register cites by a fact, checked against its SHA-256 before a byte is read. */
export function cited(root: string, register: Register, fact: string, file: string): Research {
  // Stryker disable next-line OptionalChaining: the entry found names the file, so it has a value.
  const sha = register.entries.find((e) => e.fact === fact && e.value?.file === file)?.value?.sha256;
  if (sha === undefined) throw new Error(`${file} isn't cited by the register`);
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${file} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as Research;
}

/** A market's research, and whether the register holds its blockers. */
export function readResearch(root: string, register: Register, cc: string): { research: Research; blocked: boolean } {
  const file = `${SOURCES}/producer-${cc}.json`;
  const research = cited(root, register, `${FACT}${cc}`, file);
  if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
  return { research, blocked: register.entries.some((e) => e.fact === `${BLOCKED}${cc}`) };
}

/** Every market the research holds, read as the readings say; a file without a reading, or a reading without a file, is refused. */
export function readMarkets(root: string): Markets {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const readings = record(read(READINGS), 'the readings');
  const register = read('research/register.json') as Register;
  const calibration = cited(root, register, CALIBRATED, CALIBRATION);
  // Stryker disable next-line MethodExpression: the directory's order is sorted on the file systems the gate runs on; the sort holds it on any other.
  const files = existsSync(join(root, SOURCES)) ? readdirSync(join(root, SOURCES)).filter((f) => /^producer-[A-Z]{2}\.json$/.test(f)).map((f) => f.slice(9, 11)).sort() : [];
  for (const cc of Object.keys(readings).filter((c) => !files.includes(c))) throw new Error(`${cc} has a reading and no research`);
  const out: Markets = {};
  for (const cc of files) {
    if (cc === KEPT) throw new Error(`${KEPT} is the market the engine keeps itself`);
    if (!Object.hasOwn(readings, cc)) throw new Error(`${SOURCES}/producer-${cc}.json has no reading`);
    const { research, blocked } = readResearch(root, register, cc);
    const market = marketOf({ country: cc, own: research, calibration }, readings[cc]);
    if (blocked !== market.unknown.length > 0) throw new Error(blocked ? `the register holds ${cc}'s blockers, which its research doesn't` : `${cc}'s research has blockers the register doesn't hold`);
    out[cc] = market;
  }
  return out;
}

export const serialize = (m: Markets) => `${JSON.stringify(m, null, 1)}\n`;
