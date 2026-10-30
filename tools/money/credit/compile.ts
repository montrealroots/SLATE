import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };

/**
 * Compiles each country's credit records (src/money/credit/credit.json), from the research's files, one per country
 * (research/sources/money/credit/<CC>.json, register fact money.credit.<CC>), each checked against the SHA-256 its
 * register entry cites before a byte of it is read: the bureau or registry that keeps a person's record of credit
 * (`bureau`, as it names itself), how many days after a payment's due date it's reported late (`report`), and how many
 * years a late payment stays on the record from then (`keep`), as the law, the regulator or the bureau itself states.
 * Where none of them states the days, the file says so (`reportGame`), and the days are the game's reading: a late
 * payment reaches the record at the bureau's next monthly update, 30 days, said to the player as the game's.
 */
export const SOURCES = 'research/sources/money/credit';
export const OUTPUT = 'src/money/credit/credit.json';

export interface Record {
  bureau: string;
  report: number;
  keep: number;
  /** The days to report are the game's reading, no source stating them. */
  game?: true;
}

/** The game's reading of the days to report, where no source states them: the bureau's next monthly update. */
export const GAME_REPORT = 30;

const named = (s: unknown) => typeof s === 'string' && s !== '' && s.trim() === s;

/** A country's file: its bureau, its days to report, its years kept. */
export function compileCountry(code: string, file: { [key: string]: unknown }): Record {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const { bureau, report, keep, reportGame } = file;
  if (!named(bureau)) throw new Error(`${code} names the bureau that keeps the record`);
  if (!Number.isInteger(keep) || (keep as number) < 1 || (keep as number) > 30) throw new Error(`${code}'s keep is the whole years a late payment stays, from 1 to 30`);
  if (reportGame !== undefined) {
    if (reportGame !== true || report !== undefined) throw new Error(`${code} states its days to report, or marks them the game's (reportGame: true), not both`);
    return { bureau: bureau as string, report: GAME_REPORT, keep: keep as number, game: true };
  }
  if (!Number.isInteger(report) || (report as number) < 1 || (report as number) > 365) throw new Error(`${code}'s report is the days after a due date a late payment is reported, from 1 to 365`);
  return { bureau: bureau as string, report: report as number, keep: keep as number };
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

/** Every country's credit record, of the files the register cites and checks. */
export function readCredit(root: string): { countries: { [code: string]: Record } } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('money.credit.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const out: { [code: string]: Record } = {};
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  for (const name of readdirSync(join(root, SOURCES)).filter((n) => n.endsWith('.json')).sort()) {
    const code = name.slice(0, -'.json'.length);
    out[code] = compileCountry(code, cited(root, `${SOURCES}/${name}`, shas));
  }
  return { countries: out };
}

export const serialize = (credit: ReturnType<typeof readCredit>) => `${JSON.stringify(credit, null, 1)}\n`;
