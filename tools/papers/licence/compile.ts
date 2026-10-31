import type { Money } from '../../../src/core/money/money.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import regions from '../../../src/world/gazetteer/regions.json' with { type: 'json' };
import { unitCurrency } from '../../../src/money/units/units.ts';
import { positive } from '../../money/units/compile.ts';
import { amount, checkIssuers, compileIssued, currencyIn, isRecord, isWhole, only, readCited, type Issued } from '../numbers/compile.ts';

/**
 * Compiles the driving licences and identity cards a licensing office issues, as photo ID (nothing in the game drives),
 * which the papers engine reads (src/papers/licence/licence.json), from the research's files (register fact
 * papers.licence.<key>), each checked against the SHA-256 its register entry cites. A file is a country's
 * (research/sources/papers/licence/<CC>.json) or, where the country's first-level regions issue their own (the United
 * States' states and DC, Canada's provinces, Australia's states), a region's, by the gazetteer's key for it
 * (<CC>.<region>.json, as US.CA.json); a country is kept one way or the other, never both. Each names its issuer and
 * gives the full licence (its name, the age it is held from, its fee (a non-citizen's too where it differs, and whether
 * it's charged by the year), the years it lasts and the age it ends at (or the ages, at the first of which the holder
 * reaches it ends), where one is set, or that it lasts for life, or the terms the holder chooses among, each with its
 * own fee) and the identity card the office issues to someone who doesn't drive, either or both, with the licences it
 * exchanges without a test. A fee or a term the research hasn't read is null. A territory whose licences are another
 * country's says whose (`issuedBy`), a region's where that country keeps its licences by region (Christmas Island's are
 * Western Australia's). No file was written when the engine was built (2026-10-30); then nothing is compiled.
 */
export const SOURCES = 'research/sources/papers/licence';
export const OUTPUT = 'src/papers/licence/licence.json';

/**
 * A fee set in an index unit (a Mexican state's licence at 6 UMA, a Uruguayan department's at 1.25 UR): so many of the
 * unit, worth their value on the day paid (src/money/units), and any amount in the currency the office adds (`plus`,
 * Cerro Largo's stamps). Until 2026-10-30 such a fee stood null: a figure worked from the unit's value then would go
 * stale.
 */
export interface UnitFee {
  count: string;
  unit: string;
  plus?: Money;
}

export type Fee = Money | UnitFee;

/** A fee as the research writes it: an amount in major units, or a count of an index unit the game holds in the same currency. */
export function feeOf(f: unknown, currency: string, what: string): Fee {
  if (typeof f !== 'object' || f === null) return amount(f, currency, what);
  const o = f as Record<string, unknown>;
  only(o, ['count', 'unit', 'plus'], what);
  if (!positive(o['count'])) throw new Error(`${what} is a count of its unit, a decimal above 0`);
  if (typeof o['unit'] !== 'string' || unitCurrency(o['unit']) !== currency) throw new Error(`${what} is in a unit the game holds, worth an amount of ${currency}`);
  const out: UnitFee = { count: o['count'], unit: o['unit'] };
  if (o['plus'] !== undefined) out.plus = amount(o['plus'], currency, `${what}'s plus`);
  return out;
}

export interface Term {
  /** Its years; or none where it lasts for life, or to an age (Arizona's to 65, its fee falling with the holder's age). */
  years?: number;
  forLife?: true;
  untilAge?: number;
  fee: Fee;
  /** What a non-citizen pays for it, where the office charges one more (Cayman's CI$750 for ten years). */
  foreignFee?: Fee;
  /** Whom alone it's sold to, where the office limits it so (Tamaulipas's permanent licence not to foreigners). */
  for?: 'citizens' | 'foreigners';
  /** Its fee is charged for each of its years (Iowa's $4 a year), so the term costs its years times the fee. */
  perYear?: true;
  /**
   * The ages it's sold to, from `from` and under `under`, where the office limits it (New South Wales's ten years to
   * holders of 21 to 44; Argentina's five years to 17 to 65, three to 66 to 70).
   */
  from?: number;
  under?: number;
}

/**
 * An age: whole years, or years and months (1 to 11), or years and days (1 to 364), where the law or the stages it
 * sets put the youngest holder between birthdays (Jamaica's 17½, Prince Edward Island's 18 years and 275 days). Until
 * 2026-10-31 only whole years were held, and those places stood blocked.
 */
export type Age = number | { years: number; months: number } | { years: number; days: number };

/** An age as the form holds it, or none where it isn't one. */
export function ageOf(v: unknown): Age | undefined {
  if (isWhole(v, 0)) return v;
  if (!isRecord(v) || !isWhole(v['years'], 0)) return undefined;
  const keys = Object.keys(v).sort().join();
  if (keys === 'months,years' && isWhole(v['months'], 1) && (v['months'] as number) <= 11) return { years: v['years'], months: v['months'] as number };
  if (keys === 'days,years' && isWhole(v['days'], 1) && (v['days'] as number) <= 364) return { years: v['years'], days: v['days'] as number };
  return undefined;
}

/** The whole years of an age. */
const yearsOf = (a: Age) => (typeof a === 'number' ? a : a.years);

export interface Document {
  /** As the office names it. */
  name: string;
  /** The youngest it is issued to (for a licence, a full one). */
  from?: Age;
  /** In the currency's minor units, or null where it isn't known: a citizen's, where a non-citizen pays another. */
  fee: Fee | null;
  /** What a non-citizen pays, where the office charges one more (Malaysia's, Cayman's). */
  foreignFee?: Fee;
  /** The fee is charged for each year the licence is held for (Malaysia's, bought for one to five years). */
  perYear?: true;
  validYears: number | null;
  /**
   * The age at which it ends, whichever comes first with its years (Taiwan's runs to 70, Slovakia's to 70 at most); or
   * the ages, in order, at the first of which the holder reaches it ends (San Marino's at 30, 40, 50 ...; Macau's at
   * 40, 50, 60, 65 and 70).
   */
  untilAge?: number | number[];
  /**
   * The terms the licence is sold for, each with its own fee and, where the office limits it, the ages it's sold to;
   * a holder chooses among those their age allows (Papua New Guinea's one to five years), and where only one does,
   * that one is theirs (Argentina's by age). In order of their first age, then shortest first, a term for life last
   * where one is sold (Mexico City's permanent licence); the licence's years and fee are then null, each term holding
   * its own.
   */
  terms?: Term[];
  /** It never ends, where its source says so (Benin's "indéterminée", Pitcairn's for life); its years are then null. */
  forLife?: true;
}

export interface Licence {
  issuer: string;
  licence?: Document & { from: Age };
  card?: Document;
  /** The countries and regions whose licences it exchanges without a test. */
  exchange?: string[];
}

/** A place that issues no driving licence of its own (the British Indian Ocean Territory, whose drivers hold another country's). */
export interface NoLicence {
  none: true;
}

export type Entry = Licence | Issued | NoLicence;

const onMap = (key: unknown) => Object.hasOwn(countries, key as PropertyKey) || Object.hasOwn(regions, key as PropertyKey);

function document(d: unknown, at: string, currency: () => string, needsAge: boolean): Document {
  if (!isRecord(d)) throw new Error(`${at} is not an object`);
  only(d, ['name', 'from', 'fee', 'foreignFee', 'perYear', 'validYears', 'untilAge', 'forLife', 'terms'], at);
  const { name, from, fee, foreignFee, perYear, validYears, untilAge, forLife, terms } = d;
  if (typeof name !== 'string' || name === '') throw new Error(`${at} needs its name`);
  const age = ageOf(from);
  if (from === undefined ? needsAge : age === undefined) throw new Error(`${at} is issued from an age: whole years, or years and months (1 to 11) or days (1 to 364)`);
  if (validYears !== null && !isWhole(validYears, 1)) throw new Error(`${at} is valid a whole number of years, or null`);
  const out: Document = { name, fee: fee === null ? null : feeOf(fee, currency(), `${at}'s fee`), validYears };
  if (foreignFee !== undefined) {
    if (out.fee === null) throw new Error(`${at} charges a non-citizen another fee only beside a citizen's`);
    out.foreignFee = feeOf(foreignFee, currency(), `${at}'s foreign fee`);
  }
  if (perYear !== undefined) {
    if (perYear !== true || out.fee === null) throw new Error(`${at}'s fee is by the year only as perYear: true, beside a fee`);
    out.perYear = true;
  }
  if (untilAge !== undefined) {
    const ages = Array.isArray(untilAge) ? untilAge : [untilAge];
    // A whole age above the years of the one it's issued from is above that age too, its months or days under a year.
    const above = age === undefined ? 0 : yearsOf(age);
    if (ages.length === 0 || !ages.every((a, i) => isWhole(a, 1) && (a as number) > (i === 0 ? above : (ages[i - 1] as number))))
      throw new Error(`${at} ends at a whole age above the one it's issued from, or at ages in order above it`);
    out.untilAge = untilAge as number | number[];
  }
  if (terms !== undefined) {
    // A non-citizen's fee and a fee by the year each stand beside a fee, which terms leave null, so neither is
    // checked here; a non-citizen's fee for a term is the term's own.
    if (!Array.isArray(terms) || terms.length < 2 || out.fee !== null || validYears !== null)
      throw new Error(`${at} gives two or more terms to choose among, each with its fee, its own years and fee then null`);
    out.terms = terms.map((t: unknown, i) => term(t, currency, `${at}'s term ${i}`));
    // In order of first age, then years, a term for life (no years) after any with years at the same first age.
    const key = (t: Term) => [t.from ?? 0, t.years ?? Infinity] as const;
    out.terms.forEach((t, i, all) => {
      const [a, b] = [key(all[i - 1] ?? { fee: t.fee, from: -1 }), key(t)];
      if (b[0] < a[0] || (b[0] === a[0] && b[1] <= a[1])) throw new Error(`${at}'s terms are in order of the ages they're sold to, then shortest first`);
    });
  }
  if (forLife !== undefined) {
    if (forLife !== true || validYears !== null || untilAge !== undefined) throw new Error(`${at} lasts for life only as forLife: true, with no years and no age it ends at`);
    out.forLife = true;
  }
  return age === undefined ? out : { ...out, from: age };
}

/**
 * A term the licence is sold for: its years or for life, its fee (a non-citizen's too where it differs), and whom and
 * the ages it's sold to where limited.
 */
function term(t: unknown, currency: () => string, at: string): Term {
  if (!isRecord(t)) throw new Error(`${at} is not an object`);
  only(t, ['years', 'forLife', 'untilAge', 'fee', 'foreignFee', 'for', 'perYear', 'from', 'under'], at);
  if (t['fee'] === null || t['fee'] === undefined) throw new Error(`${at} gives its fee`);
  const fee = feeOf(t['fee'], currency(), `${at}'s fee`);
  const ages: Pick<Term, 'foreignFee' | 'for' | 'perYear' | 'from' | 'under'> = {};
  if (t['foreignFee'] !== undefined) ages.foreignFee = feeOf(t['foreignFee'], currency(), `${at}'s foreign fee`);
  if (t['for'] !== undefined) {
    if (t['for'] !== 'citizens' && t['for'] !== 'foreigners') throw new Error(`${at} is sold to citizens or foreigners alone, or to anyone`);
    ages.for = t['for'];
  }
  if (t['from'] !== undefined) {
    if (!isWhole(t['from'], 0)) throw new Error(`${at} is sold from a whole age`);
    ages.from = t['from'] as number;
  }
  if (t['under'] !== undefined) {
    if (!isWhole(t['under'], 1) || (t['under'] as number) <= (ages.from ?? 0)) throw new Error(`${at} is sold under a whole age above the one it's sold from`);
    ages.under = t['under'] as number;
  }
  if (t['perYear'] !== undefined) {
    if (t['perYear'] !== true || t['years'] === undefined) throw new Error(`${at}'s fee is by the year only as perYear: true, for a term of years`);
    ages.perYear = true;
  }
  if (t['untilAge'] !== undefined) {
    if (!isWhole(t['untilAge'], 1) || (t['untilAge'] as number) <= (ages.from ?? 0) || t['years'] !== undefined || t['forLife'] !== undefined)
      throw new Error(`${at} lasts to a whole age above the ones it's sold to, with no years and not for life`);
    return { untilAge: t['untilAge'] as number, fee, ...ages };
  }
  if (t['forLife'] !== undefined) {
    if (t['forLife'] !== true || t['years'] !== undefined) throw new Error(`${at} lasts for life only as forLife: true, with no years`);
    return { forLife: true, fee, ...ages };
  }
  if (!isWhole(t['years'], 1)) throw new Error(`${at} lasts a whole number of years, for life, or to an age`);
  return { years: t['years'] as number, fee, ...ages };
}

/** One country's or region's licence and card, checked through. */
export function compileLicence(key: string, file: Record<string, unknown>): Licence {
  const code = key.slice(0, 2);
  if (!Object.hasOwn(countries, code)) throw new Error(`${key} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${key}'s file is for ${String(file['country'])}`);
  if (key === code ? 'region' in file : file['region'] !== key || !Object.hasOwn(regions, key)) throw new Error(`${key}'s region is the one its file is named for, a region of ${code} on the map`);
  only(file, ['country', 'region', 'issuer', 'licence', 'card', 'exchange', 'currency', 'note', 'sources'], key);
  const { issuer, exchange } = file;
  if (typeof issuer !== 'string' || issuer === '') throw new Error(`${key} needs its issuer`);
  if (file['licence'] === undefined && file['card'] === undefined) throw new Error(`${key} gives a licence, a card or both`);
  const currency = () => currencyIn(code, file);
  const out: Licence = { issuer };
  if (file['licence'] !== undefined) out.licence = document(file['licence'], `${key}'s licence`, currency, true) as Document & { from: Age };
  if (file['card'] !== undefined) out.card = document(file['card'], `${key}'s card`, currency, false);
  if (exchange !== undefined) {
    if (!Array.isArray(exchange) || exchange.length === 0 || !exchange.every(onMap) || exchange.includes(key) || new Set(exchange).size !== exchange.length) {
      throw new Error(`${key} exchanges the licences of distinct other countries and regions on the map`);
    }
    out.exchange = exchange as string[];
  }
  return out;
}

/** A file saying a place issues no driving licence of its own. */
export function compileNoLicence(key: string, file: Record<string, unknown>): NoLicence {
  if (!Object.hasOwn(countries, key) || file['country'] !== key) throw new Error(`${key}'s file is for ${String(file['country'])}, a country on the map`);
  if (file['none'] !== true) throw new Error(`${key}'s file says it issues no licence only as none: true`);
  only(file, ['country', 'none', 'note', 'sources'], `${key}, which issues no licence,`);
  return { none: true };
}

/** A country is kept whole or by its regions, never both; every issuer named keeps its own, and issues one. */
export function checkLicences(entries: Readonly<Record<string, Entry>>): void {
  for (const key of Object.keys(entries)) {
    if (key.length > 2 && Object.hasOwn(entries, key.slice(0, 2))) throw new Error(`${key.slice(0, 2)} is kept whole and by its regions (${key})`);
  }
  for (const [key, e] of Object.entries(entries)) {
    if ('issuedBy' in e && 'none' in (entries[e.issuedBy] ?? {})) throw new Error(`${key}'s licences are ${e.issuedBy}'s, which issues none`);
  }
  checkIssuers(entries, 'licences');
}

/** The licences and cards of every file the register cites and checks. */
export function readLicences(root: string): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [key, file] of readCited(root, SOURCES, 'papers.licence.')) out[key] = 'issuedBy' in file ? compileIssued(key, file, 'licences', regions) : 'none' in file ? compileNoLicence(key, file) : compileLicence(key, file);
  checkLicences(out);
  return out;
}

export { serialize } from '../numbers/compile.ts';
