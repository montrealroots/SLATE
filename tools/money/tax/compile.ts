import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { isCurrency, rational } from '../../../src/core/money/money.ts';

/**
 * Compiles the tax a screen worker's pay bears in each country the research reads (src/money/tax/tax.json), from the
 * research's files, one per country (research/sources/money/tax/<CC>.json, register fact money.tax.<CC>), each checked
 * against the SHA-256 its register entry cites before a byte of it is read, and the game's reading of them
 * (tools/money/tax/readings.json): where in the research each figure stands. Every figure is read from the research at
 * its place, never written here; the readings say only where, and how a figure the research states another way is
 * read (a monthly ceiling over a year, the employee's and the employer's shares both, a percent written in words).
 *
 * A country gives its currency; its tax year (the day it starts, and the day the return's balance is due, so many years
 * after the year's end); the resident's tax, year by year, as layers summed (each a scale of bands or Germany's zones of
 * § 32a, on the income less an allowance and shares the law deducts, above a floor where it taxes nothing below one, less
 * credits, with a surtax on the layer's tax); the social contributions an employee and a self-employed worker pay, each
 * a scale on the year's pay; what is withheld at source from a resident's and a non-resident's pay of each kind of work
 * (a performer's, a director's, a producer's, an author's), and whether a non-resident's is final; VAT's rate and
 * threshold, an author's apart where the law sets one; and what of it the research couldn't find or the game doesn't
 * model (`unknown`), which the engine tells the player.
 */
export const SOURCES = 'research/sources/money/tax';
export const READINGS = 'tools/money/tax/readings.json';
export const OUTPUT = 'src/money/tax/tax.json';
export const FACT = 'money.tax.';
export const BLOCKED = 'money.tax.blocked.';

export const WORKS = ['performer', 'director', 'producer', 'author'] as const;
export type Work = (typeof WORKS)[number];
/** What a country's tax can leave untold, in the order the player is told it. */
export const ITEMS = ['residents', 'credits', 'regional', 'social', 'wages', 'withholding', 'nonResident', 'authors', 'scheme', 'vat', 'year'] as const;
export type Item = (typeof ITEMS)[number];
/** The kinds of work paid as an employee's wages, where the readings name none. */
export const EMPLOYED: readonly Work[] = ['performer', 'director'];

export interface Band {
  from: string;
  to: string | null;
  rate: string;
}
/** One of § 32a's zones: `(a·y + b)·y + c` with y the ten-thousandths of the income above the zone's start, or `rate·x − minus`. */
export type Zone = { from: string; to: string | null; quad: [string, string, string] } | { from: string; to: string | null; rate: string; minus: string };
export interface Layer {
  bands?: Band[];
  zones?: Zone[];
  less?: string;
  shares?: { rate: string; max: string | null }[];
  over?: string;
  credit?: string;
  creditUpTo?: string;
  taper?: { from: string; rate: string };
  minimum?: string;
  surtax?: { rate: string; over?: string; cap?: string };
}
export interface Scheme {
  bands: Band[];
  deduct?: string;
  over?: string;
  yearly?: true;
  surtax?: string;
  final: boolean;
}
export interface Country {
  currency: string;
  year: { start: string; due: { on: string; after: number } | null };
  residents: { from: string; layers: Layer[] }[];
  employed: Work[];
  social: { employee: Band[][]; self: Band[][] };
  withholding: Partial<Record<Work, Scheme>>;
  nonResident: Partial<Record<Work, Scheme>>;
  vat: { rate: string; threshold: string | null; authors?: { rate: string; threshold?: string | null } } | null;
  unknown: Item[];
}
export interface Tax {
  countries: Record<string, Country>;
}

type Q = { num: bigint; den: bigint };
type Figure = { item: string; value: unknown };
type Ref = { fig: number; path: (string | number)[]; twice?: true; half?: true; months?: true; percent?: true; fraction?: true; part?: number; of?: Ref };
type Raw = { [k: string]: unknown };

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Where a reference points, as a message names it. */
const named = (ref: Ref): string => ref.path.join('.');

/** A decimal written out exactly: a fraction whose denominator has no factor but 2 and 5. */
export function decimal(q: Q): string {
  if (q.den <= 0n) throw new Error('a decimal has a positive denominator');
  let scale = 0;
  let den = q.den;
  let num = q.num;
  for (; den % 2n === 0n; den /= 2n, scale += 1) num *= 5n;
  for (; den % 5n === 0n; den /= 5n, scale += 1) num *= 2n;
  if (den !== 1n) throw new Error(`${q.num}/${q.den} isn't a decimal`);
  const neg = num < 0n;
  const digits = (neg ? -num : num).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac === '' ? '' : `.${frac}`}`;
}

const times = (a: Q, b: Q): Q => ({ num: a.num * b.num, den: a.den * b.den });
const q = (n: number | string): Q => rational(String(n));

/** The value a reference names in a country's figures. */
export function at(code: string, figures: readonly Figure[], ref: Ref): unknown {
  const fig = figures[ref.fig];
  if (fig === undefined) throw new Error(`${code} has no figure ${ref.fig}`);
  let v: unknown = fig.value;
  for (const k of ref.path) {
    v = (v as Record<string | number, unknown> | null)?.[k];
    if (v === undefined) throw new Error(`${code}'s figure ${ref.fig} has no ${named(ref)}`);
  }
  return v;
}

/** A figure read as a number: the research's own, or the percent or the fraction its words write, and as the reference reads it. */
export function num(code: string, figures: readonly Figure[], ref: Ref): string {
  const v = at(code, figures, ref);
  let out: Q;
  if (ref.percent === true || ref.fraction === true) {
    const m = (ref.percent === true ? /(\d+(?:\.\d+)?)%/ : /(\d+)\/(\d+)/).exec(String(v));
    if (m === null) throw new Error(`${code}'s ${named(ref)} writes no ${ref.percent === true ? 'percent' : 'fraction'}`);
    out = ref.percent === true ? times(q(m[1] as string), { num: 1n, den: 100n }) : { num: BigInt(m[1] as string), den: BigInt(m[2] as string) };
  } else {
    // JSON holds no infinity: a number is finite.
    if (typeof v !== 'number' || v < 0) throw new Error(`${code}'s ${named(ref)} is a number, not below nothing`);
    out = q(v);
  }
  if (ref.twice === true) out = times(out, { num: 2n, den: 1n });
  if (ref.half === true) out = times(out, { num: 1n, den: 2n });
  if (ref.months === true) out = times(out, { num: 12n, den: 1n });
  if (ref.of !== undefined) out = times(out, rational(num(code, figures, { ...ref.of, percent: true })));
  return decimal(out);
}

/** a − b, written out. */
const minus = (a: string, b: string): string => {
  const x = rational(a);
  const y = rational(b);
  return decimal({ num: x.num * y.den - y.num * x.den, den: x.den * y.den });
};

const less = (a: string, b: string) => {
  const x = rational(a);
  const y = rational(b);
  return x.num * y.den < y.num * x.den;
};

/** A rate: a share from nothing to the whole. */
const share = (code: string, what: string, r: string): string => {
  if (less('1', r)) throw new Error(`${code}'s ${what} is a rate above the whole`);
  return r;
};
const rate = (code: string, figures: readonly Figure[], ref: Ref): string => share(code, named(ref), num(code, figures, ref));

const isRef = (v: unknown): v is Ref => isRaw(v) && typeof v['fig'] === 'number' && Array.isArray(v['path']);

/**
 * A scale of bands: the research's own (each running on from where the last stopped, from nothing or the floor the
 * first starts at, to no end or the ceiling the last stops at; a table written a centavo apart, as Mexico's is, read as running on), read through a reference (a monthly scale over
 * the year where it says so), or built of bands each of whose figures the readings place.
 */
export function bands(code: string, figures: readonly Figure[], r: unknown): Band[] {
  if (isRef(r)) {
    const list = at(code, figures, r);
    const where = named(r);
    if (!Array.isArray(list) || list.length === 0) throw new Error(`${code}'s ${where} is a scale of bands`);
    const scaled = (n: number) => decimal(r.months === true ? times(q(n), { num: 12n, den: 1n }) : q(n));
    return list.map((b: unknown, i) => {
      const { from, to, rate: rt } = (isRaw(b) ? b : {}) as Raw;
      if (typeof from !== 'number' || typeof rt !== 'number' || !(to === null || typeof to === 'number')) throw new Error(`${code}'s ${where} band ${i} has a from, a to and a rate`);
      // The band before was read whole already, with an end.
      const was = i === 0 ? from : ((list[i - 1] as Raw)['to'] as number);
      if (from !== was && minus(decimal(q(from)), decimal(q(was))) !== '0.01') throw new Error(`${code}'s ${where} band ${i} runs on from ${was}`);
      if (to === null && i !== list.length - 1) throw new Error(`${code}'s ${where} has no end only in its last band`);
      const band: Band = { from: scaled(was), to: to === null ? null : scaled(to), rate: share(code, where, decimal(q(rt))) };
      if (band.to !== null && !less(band.from, band.to)) throw new Error(`${code}'s ${where} band ${i} runs forward`);
      return band;
    });
  }
  if (!Array.isArray(r) || r.length === 0) throw new Error(`${code} reads a scale of bands`);
  return r.map((b: unknown) => {
    const { from, to, rate: rt } = (isRaw(b) ? b : {}) as Raw;
    if (!(from === 0 || isRef(from)) || !(to === null || isRef(to)) || !isRef(rt)) throw new Error(`${code}'s band reads its from, its to and its rate from the research`);
    const band: Band = { from: from === 0 ? '0' : num(code, figures, from), to: to === null ? null : num(code, figures, to), rate: rate(code, figures, rt) };
    if (band.to !== null && !less(band.from, band.to)) throw new Error(`${code}'s band from ${band.from} runs forward`);
    return band;
  });
}

/** § 32a's zones, each read from its formula as the law writes it. */
export function zones(code: string, figures: readonly Figure[], r: Ref): Zone[] {
  const list = at(code, figures, r);
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${code}'s ${named(r)} is a list of zones`);
  const n = '(\\d+(?:\\.\\d+)?)';
  return list.map((z: unknown, i): Zone => {
    const { from, to, formula } = (isRaw(z) ? z : {}) as Raw;
    if (typeof from !== 'number' || !(to === null || typeof to === 'number') || typeof formula !== 'string') throw new Error(`${code}'s zone ${i} has a from, a to and a formula`);
    const span = { from: decimal(q(from)), to: to === null ? null : decimal(q(to)) };
    if (formula === '0') return { ...span, rate: '0', minus: '0' };
    const quad = new RegExp(`^\\(${n}\\*([yz]) \\+ ${n}\\)\\*\\2(?: \\+ ${n})?, \\2=\\(zvE-${n}\\)/10000$`).exec(formula);
    if (quad !== null) {
      if (quad[5] !== span.from) throw new Error(`${code}'s zone ${i} counts from ${String(quad[5])}, not its start`);
      return { ...span, quad: [quad[1] as string, quad[3] as string, quad[4] ?? '0'] };
    }
    const line = new RegExp(`^${n}\\*x - ${n}$`).exec(formula);
    if (line === null) throw new Error(`${code}'s zone ${i} has a formula the law's forms don't write`);
    return { ...span, rate: line[1] as string, minus: line[2] as string };
  });
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LAST = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const two = (n: number) => String(n).padStart(2, '0');

/**
 * A day of the year (MM-DD) as the research writes it: a date, a day and month in words ("1 July"), its own MM-DD, a
 * window's part, or a month alone, read as the month's last day (the game's reading, money.tax.model); and its year
 * where it writes one.
 */
export function day(code: string, figures: readonly Figure[], ref: Ref): { on: string; year: number | null } {
  const v = at(code, figures, ref);
  if (typeof v !== 'string') throw new Error(`${code}'s ${named(ref)} is a day written`);
  const text = ref.part === undefined ? v : String(v.split('/')[ref.part]);
  const full = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (full !== null) return { on: `${full[2]}-${full[3]}`, year: Number(full[1]) };
  const short = /^(\d{2})-(\d{2})/.exec(text);
  if (short !== null) return { on: `${short[1]}-${short[2]}`, year: null };
  const words = /^(\d{1,2}) ([A-Z][a-z]+)$/.exec(text);
  if (words !== null && MONTHS.includes(words[2] as string)) return { on: `${two(MONTHS.indexOf(words[2] as string) + 1)}-${two(Number(words[1]))}`, year: null };
  const month = /^(\d{2})$/.exec(text);
  if (month !== null && Number(month[1]) >= 1 && Number(month[1]) <= 12) return { on: `${month[1]}-${two(LAST[Number(month[1]) - 1] as number)}`, year: null };
  throw new Error(`${code}'s ${named(ref)} writes no day`);
}

/** Whether a non-resident's withholding is final, as the research says it: yes, no, or a sentence that starts "yes". */
function final(code: string, figures: readonly Figure[], ref: unknown): boolean {
  if (ref === undefined) return false;
  const v = at(code, figures, ref as Ref);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return /^yes\b/i.test(v);
  throw new Error(`${code}'s ${named(ref as Ref)} says whether it is final`);
}

function scheme(code: string, figures: readonly Figure[], r: Raw): Scheme {
  const out: Scheme = { bands: bands(code, figures, r['bands']), final: final(code, figures, r['final']) };
  if (r['deduct'] !== undefined) out.deduct = rate(code, figures, r['deduct'] as Ref);
  if (r['over'] !== undefined) out.over = num(code, figures, r['over'] as Ref);
  if (r['yearly'] === true) out.yearly = true;
  if (r['surtax'] !== undefined) out.surtax = rate(code, figures, r['surtax'] as Ref);
  return out;
}

function layer(code: string, figures: readonly Figure[], r: Raw): Layer {
  const out: Layer = {};
  if ((r['bands'] === undefined) === (r['zones'] === undefined)) throw new Error(`${code}'s layer is a scale of bands or of zones`);
  if (r['bands'] !== undefined) out.bands = bands(code, figures, r['bands']);
  else out.zones = zones(code, figures, r['zones'] as Ref);
  if (r['less'] !== undefined) out.less = num(code, figures, r['less'] as Ref);
  if (r['shares'] !== undefined) out.shares = (r['shares'] as Raw[]).map((s) => ({ rate: rate(code, figures, s['rate'] as Ref), max: s['max'] === undefined ? null : num(code, figures, s['max'] as Ref) }));
  if (r['over'] !== undefined) out.over = num(code, figures, r['over'] as Ref);
  if (r['credit'] !== undefined) out.credit = (r['credit'] as Ref[]).map((c) => num(code, figures, c)).reduce((a, b) => minus(a, minus('0', b)));
  if (r['creditUpTo'] !== undefined) out.creditUpTo = num(code, figures, r['creditUpTo'] as Ref);
  if (r['taper'] !== undefined) out.taper = { from: num(code, figures, (r['taper'] as Raw)['from'] as Ref), rate: rate(code, figures, (r['taper'] as Raw)['rate'] as Ref) };
  if (r['minimum'] !== undefined) out.minimum = num(code, figures, r['minimum'] as Ref);
  if (r['surtax'] !== undefined) {
    const s = r['surtax'] as Raw;
    out.surtax = { rate: rate(code, figures, s['rate'] as Ref) };
    if (s['over'] !== undefined) out.surtax.over = num(code, figures, s['over'] as Ref);
    if (s['cap'] !== undefined) out.surtax.cap = rate(code, figures, s['cap'] as Ref);
  }
  return out;
}

const works = (code: string, figures: readonly Figure[], r: unknown): Partial<Record<Work, Scheme>> => {
  if (!isRaw(r)) throw new Error(`${code} names a scheme per kind of work`);
  const out: Partial<Record<Work, Scheme>> = {};
  for (const [w, s] of Object.entries(r)) {
    if (!(WORKS as readonly string[]).includes(w)) throw new Error(`${code} names a kind of work there isn't (${w})`);
    out[w as Work] = scheme(code, figures, s as Raw);
  }
  return out;
};

/** A country's tax, from its research's figures and blockers, as the readings place them. */
export function compileCountry(code: string, file: Raw, reading: Raw): Country {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const figures = file['figures'] as Figure[];
  const currency = at(code, figures, reading['currency'] as Ref) as string;
  if (!isCurrency(String(currency))) throw new Error(`${code} names its currency`);
  const y = reading['year'] as Raw;
  const start = day(code, figures, y['start'] as Ref).on;
  let due: Country['year']['due'] = null;
  if (at(code, figures, y['due'] as Ref) !== null) {
    const d = day(code, figures, y['due'] as Ref);
    const end = y['end'] === undefined ? null : day(code, figures, y['end'] as Ref).year;
    // A year missing on either side leaves NaN, which is no count of years.
    const after = typeof y['after'] === 'number' ? y['after'] : (d.year ?? NaN) - (end ?? NaN);
    if (!(after >= 0)) throw new Error(`${code} gives how many years after the year's end the return is due`);
    due = { on: d.on, after };
  }
  const residents = (reading['residents'] as Raw[]).map((r) => {
    const f = r['from'];
    const from =
      // A year (2025) or a date (2025-04-06) the research gives starts the scale at that year's tax year.
      f === undefined ? '0000-01-01' : typeof f === 'string' ? f : `${String(at(code, figures, f as Ref)).slice(0, 4)}-${start}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error(`${code}'s scale starts on a date`);
    return { from, layers: (r['layers'] as Raw[]).map((l) => layer(code, figures, l)) };
  });
  if (residents.some((r, i) => i > 0 && (residents[i - 1] as { from: string }).from >= r.from)) throw new Error(`${code}'s scales come in their order`);
  const employed = (reading['employed'] ?? EMPLOYED) as Work[];
  const social = reading['social'] as Raw;
  const withholding = works(code, figures, reading['withholding']);
  const nonResident = works(code, figures, reading['nonResident']);
  const v = reading['vat'] as Raw | null;
  let vat: Country['vat'] = null;
  if (v !== null) {
    const th = at(code, figures, v['threshold'] as Ref);
    vat = { rate: rate(code, figures, v['rate'] as Ref), threshold: th === null ? null : num(code, figures, v['threshold'] as Ref) };
    const a = v['authors'] as Raw | undefined;
    if (a !== undefined && a['exempt'] !== undefined) {
      const e = at(code, figures, a['exempt'] as Ref);
      if (e !== true && !/^exempt\b/i.test(String(e))) throw new Error(`${code}'s authors aren't exempt where the readings say so`);
      vat.authors = { rate: '0' };
    } else if (a !== undefined) {
      vat.authors = { rate: rate(code, figures, a['rate'] as Ref) };
      if (a['threshold'] !== undefined) vat.authors.threshold = num(code, figures, a['threshold'] as Ref);
    }
  }
  // What's untold: the research's blockers, the readings' own, and what the reading itself leaves out.
  const told = new Set<string>([...(file['blockers'] as { item: string }[]).map((b) => b.item), ...(reading['unmodeled'] as string[])]);
  if (Object.values(nonResident).some((s) => !s.final)) told.add('nonResident');
  if (due === null) told.add('year');
  if (employed.some((w) => withholding[w] === undefined)) told.add('wages');
  for (const t of told) if (!(ITEMS as readonly string[]).includes(t)) throw new Error(`${code} leaves untold an item there isn't (${t})`);
  return {
    currency,
    year: { start, due },
    residents,
    employed,
    social: { employee: (social['employee'] as unknown[]).map((b) => bands(code, figures, b)), self: (social['self'] as unknown[]).map((b) => bands(code, figures, b)) },
    withholding,
    nonResident,
    vat,
    unknown: ITEMS.filter((i) => told.has(i)),
  };
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

/** The bytes of a research file, checked against what the register cites. */
function cited(root: string, path: string, shas: ReadonlyMap<string, string | undefined>): Raw {
  const bytes = readFileSync(join(root, path));
  const sha = shas.get(path);
  if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as Raw;
}

/** Every country's tax, of the files the register cites and checks, as the readings place it. */
export function readTax(root: string): Tax {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith(FACT) && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const readings = JSON.parse(readFileSync(join(root, READINGS), 'utf8')) as Record<string, Raw>;
  const out: Record<string, Country> = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    const reading = readings[code];
    if (reading === undefined) throw new Error(`${code}'s research has no reading`);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas), reading);
  }
  for (const code of Object.keys(readings)) if (out[code] === undefined) throw new Error(`${code} is read with no research`);
  return { countries: out };
}

export const serialize = (tax: Tax) => `${JSON.stringify(tax, null, 1)}\n`;
