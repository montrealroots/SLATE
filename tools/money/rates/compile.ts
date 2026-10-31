import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCurrency, rational, roundHalfEven, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the exchange rates the life's money is estimated at (src/money/rates/rates.json), from the research's files,
 * one per currency (research/sources/money/rates/<CUR>.json, register fact money.rates.<CUR>), each checked against the
 * SHA-256 its register entry cites before a byte of it is read. A currency's file gives its rates against the US dollar
 * (`rates`: how many units one dollar buys, from the day the source gives it, each holding until the next), as the US
 * Treasury's Reporting Rates of Exchange or the issuing central bank states them; or its fixed parity with another
 * currency (`peg`: how many units one unit of the anchor buys, or `units` for `per` of the anchor's where the authority
 * states it so), as the issuing authority states it, which is compiled to the anchor's rates times the parity, the
 * anchor's days kept; a parity with no finite decimal (1,000 CFP francs for 8.38 euros) is written to six places, half to
 * even. The dollar itself is the unit and has no file.
 */
export const SOURCES = 'research/sources/money/rates';
export const OUTPUT = 'src/money/rates/rates.json';

export interface Step {
  /** The day the rate is given for (YYYY-MM-DD); it holds until the next. */
  from: string;
  /** Units of the currency one US dollar buys, as a decimal written out. */
  perUSD: string;
}

export interface Series {
  /** The register fact the rates come from. */
  fact: string;
  rates: Step[];
}

/** A currency's own rates, or its parity with an anchor, as its file gives them. */
export type Read = { rates: Step[] } | { peg: { currency: CurrencyCode; units: string; per?: string } };

const DECIMAL = /^\d+(\.\d+)?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const positive = (s: unknown): s is string => typeof s === 'string' && DECIMAL.test(s) && rational(s).num > 0n;

/** A currency's file: its rates against the dollar, in day order, or its parity with another currency. */
export function compileCurrency(code: string, file: { [key: string]: unknown }): Read {
  if (!isCurrency(code) || code === 'USD') throw new Error(`${code} is not a currency with a rate against the dollar`);
  if (file['currency'] !== code) throw new Error(`${code}'s file is for ${String(file['currency'])}`);
  const { rates, peg } = file;
  if ((rates === undefined) === (peg === undefined)) throw new Error(`${code} gives its rates or its peg, one of them`);
  if (peg !== undefined) {
    const p = peg as { currency?: unknown; units?: unknown; per?: unknown };
    const anchor = String(p.currency);
    if (!isCurrency(anchor) || anchor === code) throw new Error(`${code}'s peg names another currency`);
    if (!positive(p.units)) throw new Error(`${code}'s peg gives the units one ${anchor} buys, a decimal above 0`);
    if (p.per === undefined) return { peg: { currency: anchor, units: p.units } };
    if (!positive(p.per)) throw new Error(`${code}'s peg gives the ${anchor} its units buy, a decimal above 0`);
    return { peg: { currency: anchor, units: p.units, per: p.per } };
  }
  if (!Array.isArray(rates) || rates.length === 0) throw new Error(`${code} gives at least one rate`);
  let last = '';
  const steps = rates.map((r: { from?: unknown; perUSD?: unknown }): Step => {
    if (!DAY.test(String(r.from)) || (r.from as string) <= last) throw new Error(`${code}'s rates are each from a day (YYYY-MM-DD), in order`);
    if (!positive(r.perUSD)) throw new Error(`${code}'s rate from ${r.from} is a decimal above 0`);
    last = r.from as string;
    return { from: last, perUSD: r.perUSD };
  });
  return { rates: steps };
}

/** Two decimals multiplied, written out exactly (a product of finite decimals is one). */
export function times(a: string, b: string): string {
  const x = rational(a);
  const y = rational(b);
  const digits = (x.den * y.den).toString().length - 1;
  const whole = (x.num * y.num).toString().padStart(digits + 1, '0');
  const fraction = whole.slice(whole.length - digits).replace(/0+$/, '');
  const integer = whole.slice(0, whole.length - digits);
  return fraction === '' ? integer : `${integer}.${fraction}`;
}

/** A rate times a parity of units for per, written to six places, half to even. */
export function scaled(rate: string, units: string, per: string): string {
  const [r, u, p] = [rational(rate), rational(units), rational(per)];
  const millionths = roundHalfEven(r.num * u.num * p.den * 1_000_000n, r.den * u.den * p.num).toString().padStart(7, '0');
  return times(`${millionths.slice(0, -6)}.${millionths.slice(-6)}`, '1');
}

/** The currencies' series: a peg's from its anchor's rates (or the dollar's, a single step), its own fact kept. */
export function resolve(read: { readonly [code: string]: Read }): { [code: string]: Series } {
  const out: { [code: string]: Series } = {};
  for (const [code, r] of Object.entries(read)) {
    if ('rates' in r) {
      out[code] = { fact: `money.rates.${code}`, rates: r.rates };
      continue;
    }
    const { currency, units, per } = r.peg;
    const at = (perUSD: string) => (per === undefined ? times(perUSD, units) : scaled(perUSD, units, per));
    if (currency === 'USD') {
      out[code] = { fact: `money.rates.${code}`, rates: [{ from: FIRST, perUSD: at('1') }] };
      continue;
    }
    const anchor = read[currency];
    if (anchor === undefined || !('rates' in anchor)) throw new Error(`${code} is pegged to ${currency}, which has no rates of its own`);
    out[code] = { fact: `money.rates.${code}`, rates: anchor.rates.map((s) => ({ from: s.from, perUSD: at(s.perUSD) })) };
  }
  return out;
}

/** The day a parity with the dollar is held from: the first day of the sources' rates. */
export const FIRST = '2025-12-31';

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

/** Every currency's rates, of the files the register cites and checks. */
export function readRates(root: string): { currencies: { [code: string]: Series } } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.rates.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const read: { [code: string]: Read } = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    read[code] = compileCurrency(code, cited(root, `${SOURCES}/${name}`, shas));
  }
  return { currencies: resolve(read) };
}

export const serialize = (rates: ReturnType<typeof readRates>) => `${JSON.stringify(rates, null, 1)}\n`;
