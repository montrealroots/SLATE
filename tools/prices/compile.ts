import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import money from '../../src/core/money/currencies.json' with { type: 'json' };
import { rational, roundHalfEven } from '../../src/core/money/money.ts';

/**
 * Compiles the price levels the prices engine reads (src/world/prices/levels.json) from the World Bank's World
 * Development Indicators as last updated on 2026-10-08 (register R-0373): the PPP conversion factor for households'
 * final consumption (PA.NUS.PRVT.PP), in a country's own currency per international dollar, which the International
 * Comparison Program measured for 2021 and the World Bank carries to later years. A country's level is its latest
 * year from 2024 on. A country the World Bank last priced at the Program's 2021 benchmark (or that only the Program's own
 * database prices, R-0374) has its level carried from
 * that benchmark to 2025 as the World Bank carries its own (R-0374): by its consumer price index's change against the
 * United States' over the same years, the index read from its own statistics office (research/sources/prices/,
 * world.prices.<code>) and the United States' from the Bureau of Labor Statistics (R-0375). Each file is checked
 * against its pinned SHA-256, or the one the register cites, before a byte of it is read.
 */
export const SOURCES = {
  ppp: { file: 'vendor/worldbank/PA.NUS.PRVT.PP.json', sha256: '475c4daef315d46d208e212d630ed8a163087520b6a09e068e44080e6fb72af8' },
  economies: { file: 'vendor/worldbank/countries.json', sha256: 'c9acf3932785191a649cbc04c3056af4cf64a236e5c3b49d49be25ddb0440bce' },
  metadata: { file: 'vendor/worldbank/country-metadata.json', sha256: '8c5d4e28e2e368999d1e16301b19cef7b9be1a7d8cf81c75602d14f481ebcf71' },
  benchmark: { file: 'vendor/worldbank/PA.NUS.PRVT.PP-2021.json', sha256: 'ce5f050f50ca4dec3c2943bd62df76008fe872c05f9445ddd700d40292ac2f6c' },
  icp: { file: 'vendor/worldbank/ICP2021-9100000-PPPGlob.json', sha256: 'e056aa7ee4a6a359bfee5dc28da5022c0f3180f41b1915f48c10eddd3be0933f' },
  icpMetadata: { file: 'vendor/worldbank/ICP2021-metadata.json', sha256: '97d651a60f09057ff52963f162f273d0ce3fd655ac310b7fddd2f08a8dc096af' },
  geonames: { file: 'vendor/geonames/countryInfo.txt', sha256: 'c55f638cfaafb4fe45a9aa15120a0f1f78e8a34a8e1847d7b9320cf740fbc9ab' },
} as const;
/** The indices a level is carried by: each country's file, and the United States'. */
export const INDICES = 'research/sources/prices';
export const US_INDEX = 'us-cpi';

export const OUTPUT = 'src/world/prices/levels.json';
/** The first year a level is kept from: older ones are too far behind the prices the game opens on (2026). */
export const FROM = 2024;
/** The International Comparison Program's last benchmark, and the year a level from it is carried to (the World Bank's latest). */
export const BENCHMARK = 2021;
export const CARRIED_TO = 2025;
/** The places a carried level is written to (the World Bank's own run to fifteen digits). */
export const PLACES = 12;

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

/** A price index's values in a year as its office publishes them (its months, its quarters, or its annual average alone). */
export interface Year {
  year: number;
  values: string[];
}
export interface Indices {
  from: Year;
  to: Year;
}

/** A year's mean, exactly; a year that isn't the one wanted, or a value that isn't a decimal above zero, is refused. */
export function mean(y: Year, year: number, what: string): { num: bigint; den: bigint } {
  if (y.year !== year) throw new Error(`${what}'s index is for ${y.year}, not ${year}`);
  if (y.values.length === 0) throw new Error(`${what}'s index for ${year} has no values`);
  let num = 0n;
  let den = 1n;
  for (const v of y.values) {
    const r = rational(v);
    if (r.num <= 0n) throw new Error(`${what}'s index for ${year} has ${v}, not above zero`);
    num = num * r.den + r.num * den;
    den *= r.den;
  }
  return { num, den: den * BigInt(y.values.length) };
}

/** A decimal written out to PLACES places, half to even, without trailing zeros. */
export function decimal(num: bigint, den: bigint): string {
  const digits = roundHalfEven(num * 10n ** BigInt(PLACES), den).toString().padStart(PLACES + 1, '0');
  const fraction = digits.slice(-PLACES).replace(/0+$/, '');
  return `${digits.slice(0, -PLACES)}${fraction === '' ? '' : `.${fraction}`}`;
}

/** A benchmark level carried forward: times the country's index's change, over the United States'. */
export function carryForward(ppp: string, own: Indices, us: Indices, code: string): string {
  const p = rational(ppp);
  const [of, ot, uf, ut] = [mean(own.from, BENCHMARK, code), mean(own.to, CARRIED_TO, code), mean(us.from, BENCHMARK, 'US'), mean(us.to, CARRIED_TO, 'US')];
  return decimal(p.num * ot.num * of.den * uf.num * ut.den, p.den * ot.den * of.num * uf.den * ut.num);
}

/**
 * The levels with the carried ones added: each country with indices of its own, its benchmark level carried to
 * CARRIED_TO. A country the World Bank already prices from FROM on, or one without a benchmark, is refused, as is a
 * benchmark in a currency not the country's.
 */
export function withCarried(levels: Readonly<Record<string, Level>>, benchmark: readonly Row[], us: Indices, own: Readonly<Record<string, Indices>>, units: ReadonlyMap<string, string>, currencies: Readonly<Record<string, string>>): Record<string, Level> {
  const out: Record<string, Level> = { ...levels };
  for (const [code, indices] of Object.entries(own)) {
    if (Object.hasOwn(levels, code)) throw new Error(`the World Bank prices ${code} from ${FROM} on; its own index isn't needed`);
    const value = benchmark.find((r) => r.country.id === code && r.date === String(BENCHMARK))?.value ?? null;
    if (value === null) throw new Error(`the World Bank has no ${BENCHMARK} level for ${code}`);
    const unit = units.get(code) ?? '';
    if (!sameCurrency(unit, String(currencies[code]))) throw new Error(`the World Bank prices ${code} in ${unit === '' ? 'no currency it names' : unit}, not ${currencies[code] ?? 'none'}`);
    out[code] = { ppp: carryForward(String(value), indices, us, code), year: CARRIED_TO };
  }
  return Object.fromEntries(Object.keys(out).sort().map((code) => [code, out[code] as Level]));
}

interface IcpData {
  source: { data: { variable: { concept: string; id: string }[]; value: number | null }[] };
}
interface IcpMetadata {
  source: { concept: { variable: { id: string; metatype: { id: string; value: string }[] }[] }[] }[];
}

/** GeoNames' three-letter codes, to the two-letter ones the map keys its countries by (countryInfo.txt's first two fields). */
export function threeLetterCodes(countryInfo: string): Map<string, string> {
  return new Map(countryInfo.split('\n').filter((l) => l !== '' && !l.startsWith('#')).map((l) => { const [two, three] = l.split('\t'); return [three as string, two as string]; }));
}

/**
 * The International Comparison Program's own 2021 benchmark (the World Bank's ICP 2021 database) for the economies
 * its indicators leave out (Anguilla, Montserrat, Taiwan): their household consumption PPP as a 2021 row and their
 * currency as the Program names it. The two agree wherever both price an economy outside the Eurostat-OECD
 * programme, and the indicators' own come first where both do; an economy the map has no country for (Bonaire, a
 * part of one) is left out.
 */
export function icpBenchmark(data: IcpData, metadata: IcpMetadata, codes: ReadonlyMap<string, string>): { rows: Row[]; units: Map<string, string> } {
  const rows: Row[] = [];
  const units = new Map<string, string>();
  const named = new Map((metadata.source[0]?.concept[0]?.variable ?? []).map((v) => [v.id, v.metatype.find((t) => t.id === 'CurrencyUnit')?.value ?? ''] as const));
  for (const d of data.source.data) {
    const three = d.variable.find((v) => v.concept === 'Country')?.id ?? '';
    const code = codes.get(three);
    if (code === undefined || d.value === null) continue;
    rows.push({ country: { id: code }, date: String(BENCHMARK), value: d.value });
    units.set(code, named.get(three) ?? '');
  }
  return { rows, units };
}

function pinned(root: string, file: string, sha256: string): string {
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error(`${file} isn't the file the register cites`);
  return bytes.toString('utf8');
}

/** An index file of research/sources/prices/, checked against the SHA-256 the register's entry for its fact cites. */
function cited(root: string, name: string, fact: string, register: readonly { fact: string; value: { sha256?: string } }[]): Indices {
  const file = `${INDICES}/${name}.json`;
  const sha256 = register.find((e) => e.fact === fact)?.value.sha256;
  return JSON.parse(pinned(root, file, sha256 ?? '')) as Indices;
}

/** The levels from the vendored files, the indices the register cites, and the gazetteer's currencies. */
export function readLevels(root: string): { levels: Record<string, Level>; unmapped: string[] } {
  const ppp = JSON.parse(pinned(root, SOURCES.ppp.file, SOURCES.ppp.sha256)) as [unknown, Row[]];
  const economies = JSON.parse(pinned(root, SOURCES.economies.file, SOURCES.economies.sha256)) as [unknown, Economy[]];
  const metadata = JSON.parse(pinned(root, SOURCES.metadata.file, SOURCES.metadata.sha256)) as MetadataPage[];
  const benchmark = JSON.parse(pinned(root, SOURCES.benchmark.file, SOURCES.benchmark.sha256)) as [unknown, Row[]];
  const gazetteer = JSON.parse(readFileSync(join(root, 'src/world/gazetteer/countries.json'), 'utf8')) as Record<string, { currency: string }>;
  const register = (JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { fact: string; value: { sha256?: string } }[] }).entries;
  const currencies = Object.fromEntries(Object.entries(gazetteer).map(([code, c]) => [code, c.currency]));
  const units = currencyUnits(metadata);
  const { levels, unmapped } = compileLevels(ppp[1], economies[1], units, currencies);
  const icp = icpBenchmark(
    JSON.parse(pinned(root, SOURCES.icp.file, SOURCES.icp.sha256)) as IcpData,
    JSON.parse(pinned(root, SOURCES.icpMetadata.file, SOURCES.icpMetadata.sha256)) as IcpMetadata,
    threeLetterCodes(pinned(root, SOURCES.geonames.file, SOURCES.geonames.sha256)),
  );
  const codes = readdirSync(join(root, INDICES)).map((f) => basename(f, '.json')).filter((n) => n !== US_INDEX);
  const own = Object.fromEntries(codes.map((code) => [code, cited(root, code, `world.prices.${code}`, register)]));
  return { levels: withCarried(levels, [...benchmark[1], ...icp.rows], cited(root, US_INDEX, 'world.prices.us-cpi', register), own, new Map([...icp.units, ...units]), currencies), unmapped };
}

export const serialize = (levels: Readonly<Record<string, Level>>) => `${JSON.stringify(levels, null, 1)}\n`;
