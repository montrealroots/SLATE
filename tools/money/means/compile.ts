import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { isCurrency, minorUnits, rational, roundHalfEven, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the means each family a life can be born into gives it on the first morning (src/money/means/means.json),
 * from the research's files, one per country (research/sources/money/means/<CC>.json, register fact money.means.<CC>),
 * each checked against the SHA-256 its register entry cites before a byte of it is read. A country's file gives, from
 * the World Inequality Database, the average net personal wealth (`wealth`) and the average post-tax disposable income
 * a year (`income`) per adult, for the bottom 20, 40, 60, 90 and 99 percent (`p0p20` ... `p0p99`) and the top 1 percent
 * (`p99p100`), in the currency (`currency`) of the year (`year`) the database gives them; where that is a currency since
 * replaced, the file names it (`replaced`: the old currency and how many of it one of the new is worth, as the issuer
 * fixed it), and the amounts are carried into the new.
 *
 * The game's reading, said to the player as the game's: each family is a band of the country's adults, Nothing the
 * bottom fifth, Scraping By the next, Modest the middle fifth, Comfortable the 60th to 90th percentiles, Wealthy the
 * 90th to 99th and Inherited the top 1 percent; a band's average is read from the averages below its edges. A family
 * gives the first morning one month of its band's income in checking, and its band's net wealth, where below nothing,
 * as a debt the life starts with.
 *
 * Savings, by the owner's ruling of 2026-10-30, are only what a family holds as deposits and cash: until that day the
 * band's whole net wealth (homes and pensions with it) went into savings, so a US family of modest means started with
 * 96,386 dollars in the bank. A country whose household wealth survey publishes deposits by net wealth band gives them
 * (`liquid`: the survey, the period it's of, its currency, and its bands, each from and to a percentile, contiguous from
 * 0 to 100, with its average deposits per household); a family's savings are the average of the bands its own
 * percentiles cross, each weighed by the width it shares. A country with none gives no savings, and the player is told.
 */
export const SOURCES = 'research/sources/money/means';
export const OUTPUT = 'src/money/means/means.json';

export const FAMILIES = ['nothing', 'scraping', 'modest', 'comfortable', 'wealthy', 'inherited'] as const;
export type Family = (typeof FAMILIES)[number];

/** The percentiles a family's band runs between. */
export const BANDS: { readonly [f in Family]: readonly [number, number] } = { nothing: [0, 20], scraping: [20, 40], modest: [40, 60], comfortable: [60, 90], wealthy: [90, 99], inherited: [99, 100] };

/** The cumulative averages a file gives, the bottom shares and the top 1 percent. */
export const CUTS = ['p0p20', 'p0p40', 'p0p60', 'p0p90', 'p0p99', 'p99p100'] as const;

export interface Means {
  currency: CurrencyCode;
  /** The year the database gives the figures for. */
  year: number;
  /**
   * Each family's first morning, in minor units: a month of its band's income in checking and its negative wealth as
   * a debt, in the database's currency; its deposits in savings, in the survey's, where a survey gives them.
   */
  families: { [f in Family]: { checking: number; debt: number; savings?: number } };
  /** The survey the savings are read from: its currency and the period it's of. */
  liquid?: { currency: CurrencyCode; period: string };
}

/** A family's deposits from the survey's bands: the average over its percentiles, each band weighed by the width shared. */
export function deposits(f: Family, bands: readonly { from: number; to: number; deposits: Q }[]): Q {
  const [a, b] = BANDS[f];
  let num = 0n;
  let den = 1n;
  for (const x of bands) {
    // Percentiles in thousandths, so a band of the top tenth of a percent (the Fed's 99.9 to 100) weighs exactly.
    const width = BigInt(Math.max(0, Math.round(Math.min(b, x.to) * 1000) - Math.round(Math.max(a, x.from) * 1000)));
    // num/den + width * x / (b - a), kept exact.
    num = num * x.deposits.den + den * width * x.deposits.num;
    den = den * x.deposits.den;
  }
  return { num, den: den * BigInt((b - a) * 1000) };
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
type Q = { num: bigint; den: bigint };

/** A band's average from the averages of the bottom shares below its edges (the top 1 percent given as itself). */
export function band(f: Family, avg: { readonly [cut: string]: Q }): Q {
  const [a, b] = BANDS[f];
  if (b === 100) return avg['p99p100'] as Q;
  const top = avg[`p0p${b}`] as Q;
  if (a === 0) return top;
  const bottom = avg[`p0p${a}`] as Q;
  // (b * A(0,b) - a * A(0,a)) / (b - a)
  return { num: BigInt(b) * top.num * bottom.den - BigInt(a) * bottom.num * top.den, den: BigInt(b - a) * top.den * bottom.den };
}

/** A country's file: its currency and year, and each family's checking and savings. */
export function compileCountry(code: string, file: { [key: string]: unknown }): Means {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const { currency, year, wealth, income, replaced } = file;
  if (!isCurrency(String(currency))) throw new Error(`${code} names its figures' currency`);
  const cur = currency as CurrencyCode;
  if (!Number.isInteger(year) || (year as number) < 2000) throw new Error(`${code} gives the year its figures are for`);
  let per: Q = { num: 1n, den: 1n };
  if (replaced !== undefined) {
    const r = replaced as { currency?: unknown; per?: unknown };
    if (typeof r.currency !== 'string' || r.currency === '' || r.currency === cur) throw new Error(`${code}'s figures are in a replaced currency it names`);
    if (typeof r.per !== 'string' || !/^\d+(\.\d+)?$/.test(r.per) || rational(r.per).num === 0n) throw new Error(`${code} gives how many ${r.currency} one ${cur} is worth`);
    per = rational(r.per);
  }
  const read = (what: unknown, name: string) => {
    const out: { [cut: string]: Q } = {};
    for (const cut of CUTS) {
      const v = (what as { [k: string]: unknown } | undefined)?.[cut];
      if (typeof v !== 'string' || !DECIMAL.test(v)) throw new Error(`${code}'s ${name} gives ${cut} as a decimal`);
      const q = rational(v);
      out[cut] = { num: q.num * per.den, den: q.den * per.num };
    }
    return out;
  };
  const w = read(wealth, 'wealth');
  const i = read(income, 'income');
  const scale = 10n ** BigInt(minorUnits(cur));
  const held = file['liquid'] === undefined ? undefined : liquid(code, file['liquid']);
  const families = Object.fromEntries(
    FAMILIES.map((f) => {
      const inc = band(f, i);
      const wea = band(f, w);
      const checking = roundHalfEven(inc.num * scale, inc.den * 12n);
      const worth = roundHalfEven(wea.num * scale, wea.den);
      const out: Means['families'][Family] = { checking: Number(checking < 0n ? 0n : checking), debt: Number(worth < 0n ? -worth : 0n) };
      if (held !== undefined) {
        const d = deposits(f, held.bands);
        out.savings = Number(roundHalfEven(d.num * 10n ** BigInt(minorUnits(held.currency)), d.den));
      }
      return [f, out];
    }),
  ) as Means['families'];
  const out: Means = { currency: cur, year: year as number, families };
  if (held !== undefined) out.liquid = { currency: held.currency, period: held.period };
  return out;
}

/** A survey's deposits by net wealth band: its currency, its period, and bands contiguous from 0 to 100. */
export function liquid(code: string, l: unknown): { currency: CurrencyCode; period: string; bands: { from: number; to: number; deposits: Q }[] } {
  const { survey, period, currency, per, bands, ...rest } = (typeof l === 'object' && l !== null ? l : {}) as { [k: string]: unknown };
  if (typeof l !== 'object' || l === null || Object.keys(rest).length > 0) throw new Error(`${code}'s liquid is the survey, its period, currency, per and bands, nothing else`);
  if (typeof survey !== 'string' || survey === '') throw new Error(`${code}'s liquid names its survey`);
  if (typeof period !== 'string' || period === '') throw new Error(`${code}'s liquid names the period it's of`);
  if (!isCurrency(String(currency))) throw new Error(`${code}'s liquid names its currency`);
  if (per !== 'household') throw new Error(`${code}'s liquid is per household`);
  if (!Array.isArray(bands) || bands.length === 0) throw new Error(`${code}'s liquid has bands`);
  let at = 0;
  const out = bands.map((x: unknown, n) => {
    const { from, to, deposits: d } = (x ?? {}) as { [k: string]: unknown };
    if (from !== at || typeof to !== 'number' || !(to > at) || to > 100) throw new Error(`${code}'s liquid band ${n} runs on from ${at}, up to 100 at most`);
    if (typeof d !== 'string' || !/^\d+(\.\d+)?$/.test(d)) throw new Error(`${code}'s liquid band ${n} gives its deposits as a decimal`);
    at = to;
    return { from, to, deposits: rational(d) };
  });
  if (at !== 100) throw new Error(`${code}'s liquid bands reach 100`);
  return { currency: currency as CurrencyCode, period, bands: out };
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

/** The bytes of a research file, checked against what the register cites. */
function cited(root: string, path: string, shas: ReadonlyMap<string, string | undefined>): { [key: string]: unknown } {
  const bytes = readFileSync(join(root, path));
  const sha = shas.get(path);
  if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
  return JSON.parse(bytes.toString('utf8')) as { [key: string]: unknown };
}

/** Every country's means, of the files the register cites and checks. */
export function readMeans(root: string): { countries: { [code: string]: Means } } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.means.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const out: { [code: string]: Means } = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas));
  }
  return { countries: out };
}

export const serialize = (means: ReturnType<typeof readMeans>) => `${JSON.stringify(means, null, 1)}\n`;
