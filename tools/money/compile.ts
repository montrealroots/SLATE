import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Compiles ISO 4217's list one, as its maintenance agency (SIX) publishes it (register R-0026), into the currencies the
 * money engine knows: every currency in use, with its numeric code and its minor units. Left out, by the list's own
 * markings: funds (IsFund="true"), the codes held for no single country (entries named "ZZ..": metals, bond units,
 * testing, "no currency"), and units without minor units ("N.A.": the SDR, the Sucre, the ADB unit of account).
 */
export const LIST_ONE = { file: 'vendor/iso4217/list-one.xml', sha256: '33139b438657d1cee116ba737807ea71d19d6de4b90f799a09c56f0cc6a1b0ff', published: '2026-09-17' } as const;
export const OUTPUT = 'src/core/money/currencies.json';

export interface CurrencyEntry {
  name: string;
  number: string;
  minorUnits: number;
}
export interface Currencies {
  published: string;
  currencies: Record<string, CurrencyEntry>;
}

const field = (entry: string, tag: string): string | undefined => new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(entry)?.[1]?.trim();

export function parseListOne(xml: string): Currencies {
  const published = /<ISO_4217 Pblshd="(\d{4}-\d{2}-\d{2})">/.exec(xml)?.[1];
  if (published === undefined) throw new Error('the list has no publication date');
  const byCode = new Map<string, { entries: string[] }>();
  for (const [, entry = ''] of xml.matchAll(/<CcyNtry>([\s\S]*?)<\/CcyNtry>/g)) {
    const code = field(entry, 'Ccy');
    if (code === undefined) continue;
    const seen = byCode.get(code) ?? { entries: [] };
    seen.entries.push(entry);
    byCode.set(code, seen);
  }
  const currencies: Record<string, CurrencyEntry> = {};
  for (const [code, { entries }] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) {
    if (entries.some((e) => /<CcyNm IsFund="true">/.test(e))) continue;
    if (entries.every((e) => (field(e, 'CtryNm') ?? '').startsWith('ZZ'))) continue;
    const units = new Set(entries.map((e) => field(e, 'CcyMnrUnts')));
    if (units.has('N.A.')) continue;
    const [name, number, minor] = [new Set(entries.map((e) => field(e, 'CcyNm'))), new Set(entries.map((e) => field(e, 'CcyNbr'))), [...units]];
    if (name.size !== 1 || number.size !== 1 || minor.length !== 1) throw new Error(`${code} is listed two ways`);
    currencies[code] = { name: [...name][0] as string, number: [...number][0] as string, minorUnits: Number(minor[0]) };
  }
  return { published, currencies };
}

export function readListOne(root: string): Currencies {
  const xml = readFileSync(join(root, LIST_ONE.file));
  const sha = createHash('sha256').update(xml).digest('hex');
  if (sha !== LIST_ONE.sha256) throw new Error(`${LIST_ONE.file} is not the list the register cites (sha256 ${sha})`);
  const parsed = parseListOne(xml.toString('utf8'));
  if (parsed.published !== LIST_ONE.published) throw new Error(`the list says it was published ${parsed.published}`);
  return parsed;
}

export const serialize = (c: Currencies) => `${JSON.stringify(c, null, 1)}\n`;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'compile.ts')) {
  const root = resolve(import.meta.dirname, '../..');
  const c = readListOne(root);
  writeFileSync(join(root, OUTPUT), serialize(c));
  console.log(`ISO 4217 list one of ${c.published}: ${Object.keys(c.currencies).length} currencies in use -> ${OUTPUT}`);
}
