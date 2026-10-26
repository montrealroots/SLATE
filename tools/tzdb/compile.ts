import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { TzData, TzOn, TzRule, TzUntil, TzZoneLine } from '../../src/core/time/tzdb-types.ts';
import { readTarGz } from './tar.ts';

/**
 * Compiles IANA's time zone database, as released, into the data the time engine reads. The release is the primary
 * source (register R-0001): the tarball is checked against its pinned SHA-256 before a byte of it is read. The format
 * is zic's, as zic itself reads it (register R-0003); only what the data uses is accepted, and anything else
 * stops the compile rather than being guessed at.
 */
export const RELEASE = {
  version: '2026e',
  tarball: 'vendor/tzdb/tzdata2026e.tar.gz',
  sha256: 'b26882805f26aac59d5b222978e6580484b834ccdc98be89df2f05a6dc53a652',
} as const;

/** The source files that hold the world's zones and links ("factory" is a placeholder, not a place). */
export const SOURCES = ['africa', 'antarctica', 'asia', 'australasia', 'europe', 'northamerica', 'southamerica', 'etcetera', 'backward'] as const;

export const OUTPUT = 'src/core/time/tzdb.json';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** An unambiguous prefix of one of the names, as zic accepts it; its index. */
function byPrefix(names: readonly string[], word: string, what: string): number {
  const w = word.toLowerCase();
  const hits = names.flatMap((n, i) => (n.startsWith(w) ? [i] : []));
  if (hits.length !== 1 || w === '') throw new Error(`not a ${what}: "${word}"`);
  return hits[0] as number;
}

/** A time of day or an offset: [-]h[:mm[:ss[.frac]]], or "-" for zero; in seconds, a fraction rounded as zic does. */
export function parseSeconds(field: string): number {
  if (field === '-') return 0;
  const m = /^(-)?(\d+)(?::(\d{1,2}))?(?::(\d{1,2})(?:\.(\d+))?)?$/.exec(field);
  if (m === null) throw new Error(`not a time: "${field}"`);
  const [, minus, h, mm = '0', ss = '0', frac = ''] = m;
  let seconds = Number(h) * 3600 + Number(mm) * 60 + Number(ss);
  // zic rounds to the nearest second, ties to even.
  const f = Number(`0.${frac || '0'}`);
  if (f > 0.5 || (f === 0.5 && seconds % 2 === 1)) seconds += 1;
  return minus === '-' ? -seconds : seconds;
}

/** A time with its kind: wall clock (w, the default), standard (s), or universal (u, g or z). */
export function parseAt(field: string): { at: number; atType: 'w' | 's' | 'u' } {
  const m = /^(.*?)([wsugz])?$/.exec(field);
  const suffix = m?.[2];
  return { at: parseSeconds(m?.[1] ?? field), atType: suffix === undefined || suffix === 'w' ? 'w' : suffix === 's' ? 's' : 'u' };
}

/** A day of the month: "5", "lastSun", "Sun>=8" or "Sun<=25". */
export function parseOn(field: string): TzOn {
  if (/^\d+$/.test(field)) return { kind: 'dom', day: Number(field) };
  const last = /^last(.+)$/.exec(field);
  if (last !== null) return { kind: 'last', weekday: byPrefix(WEEKDAYS, last[1] ?? '', 'weekday') };
  const rel = /^([A-Za-z]+)(>=|<=)(\d+)$/.exec(field);
  if (rel === null) throw new Error(`not a day: "${field}"`);
  return { kind: rel[2] === '>=' ? 'geq' : 'leq', weekday: byPrefix(WEEKDAYS, rel[1] ?? '', 'weekday'), day: Number(rel[3]) };
}

function parseYear(field: string, from: number | null): number | null {
  const f = field.toLowerCase();
  if (/^-?\d+$/.test(f)) return Number(f);
  if (from !== null && 'only'.startsWith(f) && f.length > 0) return from;
  if ('maximum'.startsWith(f) && f.length >= 2) return null;
  throw new Error(`not a year: "${field}"`);
}

/** The fields of a line, comments stripped. Quoted fields aren't used by the data, so a quote stops the compile. */
function fields(line: string): string[] {
  const body = line.replace(/#.*$/, '');
  if (body.includes('"')) throw new Error(`quoted fields aren't handled: ${line}`);
  return body.trim() === '' ? [] : body.trim().split(/\s+/);
}

function parseUntil(f: readonly string[]): TzUntil | undefined {
  if (f.length === 0) return undefined;
  const [year, month = 'Jan', on = '1', at = '0'] = f;
  return { year: Number(year), month: byPrefix(MONTHS, month, 'month') + 1, on: parseOn(on), ...parseAt(at) };
}

function parseZoneLine(f: readonly string[]): TzZoneLine {
  const [stdoff = '', rules = '', format = '', ...until] = f;
  let rule: TzZoneLine['rule'];
  if (rules === '-') rule = { kind: 'none' };
  else if (/^-?\d/.test(rules)) {
    const save = parseSeconds(rules);
    rule = { kind: 'fixed', save, isdst: save !== 0 };
  } else rule = { kind: 'named', name: rules };
  const u = parseUntil(until);
  return u === undefined ? { stdoff: parseSeconds(stdoff), rule, format } : { stdoff: parseSeconds(stdoff), rule, format, until: u };
}

/** Parses the source files into rules, zones and links, in the files' order. */
export function parseTzdb(sources: ReadonlyMap<string, string>, version: string): TzData {
  const data: TzData = { version, rules: {}, zones: {}, links: {} };
  let zone: TzZoneLine[] | undefined;
  for (const name of SOURCES) {
    const text = sources.get(name);
    if (text === undefined) throw new Error(`the release has no "${name}"`);
    for (const line of text.split('\n')) {
      const f = fields(line);
      if (f.length === 0) continue;
      const head = f[0] as string;
      const continuing = /^\s/.test(line) && zone !== undefined && !/^(rule|zone|link)$/i.test(head);
      if (continuing) {
        zone?.push(parseZoneLine(f));
      } else if (/^rule$/i.test(head)) {
        zone = undefined;
        const [, ruleName = '', fromF = '', toF = '', , inF = '', onF = '', atF = '', saveF = '', letters = ''] = f;
        const from = parseYear(fromF, null) as number;
        const save = parseSeconds(saveF);
        const rule: TzRule = { from, to: parseYear(toF, from), month: byPrefix(MONTHS, inF, 'month') + 1, on: parseOn(onF), ...parseAt(atF), save, isdst: save !== 0, letters: letters === '-' ? '' : letters };
        (data.rules[ruleName] ??= []).push(rule);
      } else if (/^zone$/i.test(head)) {
        const [, zoneName = '', ...rest] = f;
        if (zoneName in data.zones) throw new Error(`the zone ${zoneName} is defined twice`);
        zone = [parseZoneLine(rest)];
        data.zones[zoneName] = zone;
      } else if (/^link$/i.test(head)) {
        zone = undefined;
        const [, target = '', alias = ''] = f;
        data.links[alias] = target;
      } else throw new Error(`a line the compiler doesn't know: ${line}`);
    }
  }
  return data;
}

/** Reads the pinned release, refusing a tarball that isn't the one the register cites. */
export function readRelease(root: string): { files: Map<string, Buffer>; data: TzData } {
  const archive = readFileSync(join(root, RELEASE.tarball));
  const sha = createHash('sha256').update(archive).digest('hex');
  if (sha !== RELEASE.sha256) throw new Error(`${RELEASE.tarball} is not the release the register cites (sha256 ${sha})`);
  const files = readTarGz(archive);
  const version = files.get('version')?.toString('utf8').trim();
  if (version !== RELEASE.version) throw new Error(`the tarball says it is ${String(version)}, not ${RELEASE.version}`);
  const sources = new Map(SOURCES.map((s) => [s, files.get(s)?.toString('utf8') ?? '']));
  return { files, data: parseTzdb(sources, version) };
}

export const serialize = (data: TzData) => `${JSON.stringify(data)}\n`;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'compile.ts')) {
  const root = resolve(import.meta.dirname, '../..');
  const { data } = readRelease(root);
  writeFileSync(join(root, OUTPUT), serialize(data));
  console.log(`tzdb ${data.version}: ${Object.keys(data.zones).length} zones, ${Object.keys(data.links).length} links, ${Object.keys(data.rules).length} rule sets -> ${OUTPUT}`);
}
