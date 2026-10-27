import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { civilFromDays } from '../../../src/core/time/calendar.ts';
import { formatOffset, type TimeType, type ZoneHistory } from '../../../src/core/time/zones.ts';
import { readRelease, SOURCES } from '../../../tools/tzdb/compile.ts';

/**
 * The oracle: the release compiled by the system's zic (with -b fat, as the 2026b release notes advise for zic
 * versions before 2026b) and read back by zdump -i, the reference tools' own account of each zone (register R-0003).
 */
export const SPAN = ['1800', '2201'] as const;
export const ROOT = join(import.meta.dirname, '../../..');

export function compileWithZic(): string {
  const { files } = readRelease(ROOT);
  const src = mkdtempSync(join(tmpdir(), 'slate-tzsrc-'));
  const out = mkdtempSync(join(tmpdir(), 'slate-tzout-'));
  for (const s of SOURCES) writeFileSync(join(src, s), files.get(s) as Buffer);
  execFileSync('zic', ['-b', 'fat', '-d', out, ...SOURCES.map((s) => join(src, s))]);
  return out;
}

/** zdump -i's lines for a zone, without its header. */
export const zdump = (dir: string, zone: string): string[] =>
  execFileSync('zdump', ['-i', '-c', SPAN.join(','), join(dir, zone)], { encoding: 'utf8' }).trim().split('\n').slice(1).filter((l) => l !== '');

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** A local time as zdump -i writes it: the date, then hours, adding minutes and seconds only when needed. */
function localStamp(local: number): string {
  const days = Math.floor(local / 86_400);
  const c = civilFromDays(days);
  const s = local - days * 86_400;
  const [hh, mm, ss] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const time = ss !== 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : mm !== 0 ? `${pad(hh)}:${pad(mm)}` : pad(hh);
  return `${pad(c.year, 4)}-${pad(c.month)}-${pad(c.day)}\t${time}`;
}

/** The engine's history, written as zdump -i writes it (an abbreviation equal to the offset is left out). */
export function asZdump(h: ZoneHistory): string[] {
  const off = (t: TimeType) => (t.abbr === '-00' && t.utoff === 0 ? '-00' : formatOffset(t.utoff));
  const line = (t: TimeType, at?: number) => {
    const named = t.abbr === off(t) ? '' : `\t${t.abbr}`;
    const dst = t.isdst ? (named === '' ? '\t\t1' : '\t1') : '';
    return `${at === undefined ? '-\t-' : localStamp(at + t.utoff)}\t${off(t)}${named}${dst}`;
  };
  return [line(h.initial), ...h.transitions.map((t) => line(t, t.at))];
}

/** Zones chosen for every kind of rule the database uses; their zdump account is kept in fixtures/zdump-sample.txt. */
export const SAMPLE = [
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Vancouver', 'America/Winnipeg', 'America/Edmonton',
  'America/Inuvik', 'America/Argentina/Mendoza', 'America/Argentina/San_Luis', 'America/Sao_Paulo', 'America/Santiago',
  'America/Havana', 'America/Caracas', 'America/Juneau', 'America/Tijuana', 'America/Bogota', 'America/Cambridge_Bay',
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Moscow', 'Europe/Chisinau', 'Africa/Casablanca',
  'Africa/Cairo', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Gaza', 'Asia/Tbilisi', 'Asia/Kathmandu', 'Asia/Kolkata',
  'Australia/Lord_Howe', 'Australia/Adelaide', 'Antarctica/Troll', 'Antarctica/Casey', 'Antarctica/Macquarie',
  'Pacific/Apia', 'Pacific/Kiritimati', 'Pacific/Chatham', 'EST5EDT', 'Etc/GMT-14',
] as const;
