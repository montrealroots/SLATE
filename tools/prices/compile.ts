import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import money from '../../src/core/money/currencies.json' with { type: 'json' };

/**
 * Compiles the price levels the prices engine reads (src/world/prices/levels.json) from the World Bank's World
 * Development Indicators as last updated on 2026-10-08 (register R-0373): the PPP conversion factor for households'
 * final consumption (PA.NUS.PRVT.PP), in a country's own currency per international dollar, which the International
 * Comparison Program measured for 2021 and the World Bank carries to later years. A country's level is its latest
 * year from 2024 on; a country with none since is left to research of its own. Each file is checked against its
 * pinned SHA-256 before a byte of it is read.
 */
export const SOURCES = {
  ppp: { file: 'vendor/worldbank/PA.NUS.PRVT.PP.json', sha256: '475c4daef315d46d208e212d630ed8a163087520b6a09e068e44080e6fb72af8' },
  economies: { file: 'vendor/worldbank/countries.json', sha256: 'c9acf3932785191a649cbc04c3056af4cf64a236e5c3b49d49be25ddb0440bce' },
  metadata: { file: 'vendor/worldbank/country-metadata.json', sha256: '8c5d4e28e2e368999d1e16301b19cef7b9be1a7d8cf81c75602d14f481ebcf71' },
} as const;

export const OUTPUT = 'src/world/prices/levels.json';
/** The first year a level is kept from: older ones are too far behind the prices the game opens on (2026). */
export const FROM = 2024;

/** The World Bank's word for a currency where it isn't ISO 4217's last (the same currency, spelled another way). */
export const UNIT_WORDS: Record<string, string> = { XOF: 'cfa franc', XAF: 'cfa franc', BYN: 'rubel', CNY: 'yuan', ILS: 'shekel', NIO: 'cordoba', QAR: 'riyal', UYU: 'peso', UZS: 'som' };

export interface Level {
  /** Units of the country's currency an international dollar buys the same in, as a decimal written out. */
  ppp: string;
  year: number;
}

interface Row {
  country: { id: string };
  date: string;
  value: number | null;
}
interface Economy {
  iso2Code: string;
  region: { value: string };
}
interface MetadataPage {
  source: { concept: { variable: { id: string; metatype: { id: string; value: string }[] }[] }[] }[];
}

/** Each economy's currency unit as the World Bank names it, by its two-letter code (an economy's fields may run across two pages). */
export function currencyUnits(pages: readonly MetadataPage[]): Map<string, string> {
  const fields = new Map<string, Map<string, string>>();
  for (const page of pages) {
    for (const v of page.source[0]?.concept[0]?.variable ?? []) {
      const m = fields.get(v.id) ?? new Map<string, string>();
      for (const t of v.metatype) m.set(t.id, t.value);
      fields.set(v.id, m);
    }
  }
  const out = new Map<string, string>();
  for (const m of fields.values()) {
    const code = m.get('2-alphacode');
    const unit = m.get('CurrencyUnit');
    if (code !== undefined && unit !== undefined) out.set(code, unit);
  }
  return out;
}

/** Whether the World Bank's name for a currency names the one the gazetteer gives the country. */
export function sameCurrency(unit: string, currency: string): boolean {
  if (!Object.hasOwn(money.currencies, currency)) return false;
  const name = (money.currencies as Record<string, { name: string }>)[currency]?.name as string;
  // Letters only: the two spell a name's apostrophes and spaces their own ways (Pa’anga, pa'anga).
  const letters = (text: string) => text.toLowerCase().replace(/[^a-z]/g, '');
  return letters(unit).includes(letters(UNIT_WORDS[currency] ?? (name.split(' ').pop() as string)));
}

/**
 * The levels: each country of the gazetteer's latest value from FROM on, the World Bank's aggregates (regions,
 * income groups) left out and its economies the map has no country for set aside; a level whose currency isn't the
 * one the gazetteer gives the country is refused.
 */
export function compileLevels(rows: readonly Row[], economies: readonly Economy[], units: ReadonlyMap<string, string>, currencies: Readonly<Record<string, string>>): { levels: Record<string, Level>; unmapped: string[] } {
  const aggregates = new Set(economies.filter((e) => e.region.value === 'Aggregates').map((e) => e.iso2Code));
  const levels: Record<string, Level> = {};
  const unmapped = new Set<string>();
  for (const r of rows) {
    const code = r.country.id;
    const year = Number(r.date);
    if (r.value === null || aggregates.has(code) || year < FROM) continue;
    if (!Object.hasOwn(currencies, code)) {
      unmapped.add(code);
      continue;
    }
    const ppp = String(r.value);
    // The engine reads a level as a decimal written out (core money's rational), so none may be written as a power of ten.
    if (r.value <= 0 || !/^\d+(\.\d+)?$/.test(ppp)) throw new Error(`the World Bank's level for ${code} in ${r.date} isn't a decimal more than zero (${ppp})`);
    const unit = units.get(code) ?? '';
    if (!sameCurrency(unit, currencies[code] as string)) throw new Error(`the World Bank prices ${code} in ${unit === '' ? 'no currency it names' : unit}, not ${currencies[code] as string}`);
    const kept = levels[code];
    if (kept === undefined || year > kept.year) levels[code] = { ppp, year };
  }
  return { levels: Object.fromEntries(Object.keys(levels).sort().map((code) => [code, levels[code] as Level])), unmapped: [...unmapped].sort() };
}

function pinned(root: string, file: string, sha256: string): string {
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`${file} isn't the file the register cites`);
  return bytes.toString('utf8');
}

/** The levels from the vendored files and the gazetteer's currencies. */
export function readLevels(root: string): { levels: Record<string, Level>; unmapped: string[] } {
  const ppp = JSON.parse(pinned(root, SOURCES.ppp.file, SOURCES.ppp.sha256)) as [unknown, Row[]];
  const economies = JSON.parse(pinned(root, SOURCES.economies.file, SOURCES.economies.sha256)) as [unknown, Economy[]];
  const metadata = JSON.parse(pinned(root, SOURCES.metadata.file, SOURCES.metadata.sha256)) as MetadataPage[];
  const gazetteer = JSON.parse(readFileSync(join(root, 'src/world/gazetteer/countries.json'), 'utf8')) as Record<string, { currency: string }>;
  const currencies = Object.fromEntries(Object.entries(gazetteer).map(([code, c]) => [code, c.currency]));
  return compileLevels(ppp[1], economies[1], currencyUnits(metadata), currencies);
}

export const serialize = (levels: Readonly<Record<string, Level>>) => `${JSON.stringify(levels, null, 1)}\n`;
