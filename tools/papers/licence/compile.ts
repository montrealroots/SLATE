import type { Money } from '../../../src/core/money/money.ts';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import regions from '../../../src/world/gazetteer/regions.json' with { type: 'json' };
import { amount, checkIssuers, compileIssued, currencyIn, isRecord, isWhole, only, readCited, type Issued } from '../numbers/compile.ts';

/**
 * Compiles the driving licences and identity cards a licensing office issues, as photo ID (nothing in the game drives),
 * which the papers engine reads (src/papers/licence/licence.json), from the research's files (register fact
 * papers.licence.<key>), each checked against the SHA-256 its register entry cites. A file is a country's
 * (research/sources/papers/licence/<CC>.json) or, where the country's first-level regions issue their own (the United
 * States' states and DC, Canada's provinces, Australia's states), a region's, by the gazetteer's key for it
 * (<CC>.<region>.json, as US.CA.json); a country is kept one way or the other, never both. Each names its issuer and
 * gives the full licence (its name, the age it is held from, its fee (a non-citizen's too where it differs, and whether
 * it's charged by the year), the years it lasts and the age it ends at, where one is set) and the identity card the
 * office issues to someone who doesn't drive, either or both, with the licences it exchanges without a test. A fee or
 * a term the research hasn't read is null. A territory whose licences are another country's says whose (`issuedBy`).
 * No file was written when the engine was built (2026-10-30); then nothing is compiled.
 */
export const SOURCES = 'research/sources/papers/licence';
export const OUTPUT = 'src/papers/licence/licence.json';

export interface Document {
  /** As the office names it. */
  name: string;
  /** The youngest it is issued to (for a licence, a full one). */
  from?: number;
  /** In the currency's minor units, or null where it isn't known: a citizen's, where a non-citizen pays another. */
  fee: Money | null;
  /** What a non-citizen pays, where the office charges one more (Malaysia's, Cayman's). */
  foreignFee?: Money;
  /** The fee is charged for each year the licence is held for (Malaysia's, bought for one to five years). */
  perYear?: true;
  validYears: number | null;
  /** The age at which it ends, whichever comes first with its years (Taiwan's runs to 70, Slovakia's to 70 at most). */
  untilAge?: number;
}

export interface Licence {
  issuer: string;
  licence?: Document & { from: number };
  card?: Document;
  /** The countries and regions whose licences it exchanges without a test. */
  exchange?: string[];
}

export type Entry = Licence | Issued;

const onMap = (key: unknown) => Object.hasOwn(countries, key as PropertyKey) || Object.hasOwn(regions, key as PropertyKey);

function document(d: unknown, at: string, currency: () => string, needsAge: boolean): Document {
  if (!isRecord(d)) throw new Error(`${at} is not an object`);
  only(d, ['name', 'from', 'fee', 'foreignFee', 'perYear', 'validYears', 'untilAge'], at);
  const { name, from, fee, foreignFee, perYear, validYears, untilAge } = d;
  if (typeof name !== 'string' || name === '') throw new Error(`${at} needs its name`);
  if (from === undefined ? needsAge : !isWhole(from, 0)) throw new Error(`${at} is issued from a whole age`);
  if (validYears !== null && !isWhole(validYears, 1)) throw new Error(`${at} is valid a whole number of years, or null`);
  const out: Document = { name, fee: fee === null ? null : amount(fee, currency(), `${at}'s fee`), validYears };
  if (foreignFee !== undefined) {
    if (out.fee === null) throw new Error(`${at} charges a non-citizen another fee only beside a citizen's`);
    out.foreignFee = amount(foreignFee, currency(), `${at}'s foreign fee`);
  }
  if (perYear !== undefined) {
    if (perYear !== true || out.fee === null) throw new Error(`${at}'s fee is by the year only as perYear: true, beside a fee`);
    out.perYear = true;
  }
  if (untilAge !== undefined) {
    if (!isWhole(untilAge, 1) || untilAge <= ((from as number | undefined) ?? 0)) throw new Error(`${at} ends at a whole age above the one it's issued from`);
    out.untilAge = untilAge;
  }
  return from === undefined ? out : { ...out, from: from as number };
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
  if (file['licence'] !== undefined) out.licence = document(file['licence'], `${key}'s licence`, currency, true) as Document & { from: number };
  if (file['card'] !== undefined) out.card = document(file['card'], `${key}'s card`, currency, false);
  if (exchange !== undefined) {
    if (!Array.isArray(exchange) || exchange.length === 0 || !exchange.every(onMap) || exchange.includes(key) || new Set(exchange).size !== exchange.length) {
      throw new Error(`${key} exchanges the licences of distinct other countries and regions on the map`);
    }
    out.exchange = exchange as string[];
  }
  return out;
}

/** A country is kept whole or by its regions, never both; every issuer named keeps its own. */
export function checkLicences(entries: Readonly<Record<string, Entry>>): void {
  for (const key of Object.keys(entries)) {
    if (key.length > 2 && Object.hasOwn(entries, key.slice(0, 2))) throw new Error(`${key.slice(0, 2)} is kept whole and by its regions (${key})`);
  }
  checkIssuers(entries, 'licences');
}

/** The licences and cards of every file the register cites and checks. */
export function readLicences(root: string): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const [key, file] of readCited(root, SOURCES, 'papers.licence.')) out[key] = 'issuedBy' in file ? compileIssued(key, file, 'licences') : compileLicence(key, file);
  checkLicences(out);
  return out;
}

export { serialize } from '../numbers/compile.ts';
