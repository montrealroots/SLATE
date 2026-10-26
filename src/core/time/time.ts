import { SECONDS_PER_DAY, civilFromDays, daysFromCivil, weekdayFromDays, type CivilDate } from './calendar.ts';
import tzdb from './tzdb.json';
import type { TzData } from './tzdb-types.ts';
import { FIRST_YEAR_START, LAST_YEAR_END, zoneHistory, type TimeType, type ZoneHistory } from './zones.ts';

/**
 * Instants and local time. An instant is a whole number of seconds since 1970-01-01 00:00 UT; a place's local time is
 * read through its IANA zone (zones.ts), from the release the register cites (R-0001).
 */
const data = tzdb as TzData;

export const TZDB_VERSION = data.version;

/** Every zone, by its canonical name. */
export const ZONE_IDS: readonly string[] = Object.keys(data.zones);

/** The canonical zone a name stands for, following an alias to its zone; undefined for a name the database lacks. */
export function canonicalZone(id: string): string | undefined {
  if (id in data.zones) return id;
  const target = data.links[id];
  return target !== undefined && target in data.zones ? target : undefined;
}

const histories = new Map<string, ZoneHistory>();

/** A zone's history, computed once. */
export function historyOf(id: string): ZoneHistory {
  const zone = canonicalZone(id);
  if (zone === undefined) throw new RangeError(`"${id}" is not a time zone`);
  let h = histories.get(zone);
  if (h === undefined) {
    h = zoneHistory(data, data.zones[zone] as TzData['zones'][string]);
    histories.set(zone, h);
  }
  return h;
}

function inSpan(instant: number): void {
  if (!Number.isInteger(instant)) throw new RangeError(`an instant is a whole number of seconds (${instant})`);
  if (instant < FIRST_YEAR_START || instant >= LAST_YEAR_END) throw new RangeError(`the clock covers 1800 to 2200 (${instant})`);
}

/** The offset, abbreviation and daylight-saving flag in effect at an instant. */
export function typeAt(id: string, instant: number): TimeType {
  inSpan(instant);
  const { initial, transitions } = historyOf(id);
  let lo = 0;
  let hi = transitions.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((transitions[mid] as { at: number }).at <= instant) lo = mid + 1;
    else hi = mid;
  }
  const t = lo === 0 ? initial : (transitions[lo - 1] as TimeType);
  return { utoff: t.utoff, isdst: t.isdst, abbr: t.abbr };
}

export interface LocalTime {
  date: CivilDate;
  /** Seconds since local midnight. */
  seconds: number;
  /** 0 Sunday to 6 Saturday. */
  weekday: number;
  type: TimeType;
}

/** An instant as the place's clock and calendar show it. */
export function localTime(id: string, instant: number): LocalTime {
  const type = typeAt(id, instant);
  const local = instant + type.utoff;
  const days = Math.floor(local / SECONDS_PER_DAY);
  return { date: civilFromDays(days), seconds: local - days * SECONDS_PER_DAY, weekday: weekdayFromDays(days), type };
}

export type Resolution = 'exact' | 'repeated' | 'skipped';

/**
 * The instant a local date and time name. When the clock goes back, a time happens twice ('repeated'): the earlier is
 * taken unless 'later' is asked for. When it goes forward, a time never happens ('skipped'): it is read with the offset
 * in effect before the jump, so it lands as far past the jump as it was into the gap.
 */
export function instantOf(id: string, date: CivilDate, seconds: number, prefer: 'earlier' | 'later' = 'earlier'): { instant: number; resolution: Resolution } {
  const local = daysFromCivil(date.year, date.month, date.day) * SECONDS_PER_DAY + seconds;
  // The offsets that could apply: those in effect from two days before to two days after, which spans any jump.
  const offsets = new Set<number>();
  for (const probe of [local - 2 * SECONDS_PER_DAY, local, local + 2 * SECONDS_PER_DAY]) offsets.add(typeAt(id, probe).utoff);
  const { transitions } = historyOf(id);
  for (const t of transitions) if (t.at > local - 2 * SECONDS_PER_DAY && t.at < local + 2 * SECONDS_PER_DAY) offsets.add(t.utoff);
  const fits = [...offsets].map((u) => local - u).filter((t) => typeAt(id, t).utoff === local - t).sort((a, b) => a - b);
  if (fits.length > 1) return { instant: (prefer === 'later' ? fits.at(-1) : fits[0]) as number, resolution: 'repeated' };
  if (fits.length === 1) return { instant: fits[0] as number, resolution: 'exact' };
  // Skipped: the jump whose gap holds it (local times from the jump plus the offset before it, up to the jump plus
  // the offset after), read with the offset before.
  for (const [i, t] of transitions.entries()) {
    const before = i === 0 ? historyOf(id).initial.utoff : (transitions[i - 1] as TimeType).utoff;
    if (t.at + before <= local && local < t.at + t.utoff) return { instant: local - before, resolution: 'skipped' };
  }
  throw new RangeError(`no instant fits ${date.year}-${date.month}-${date.day} ${seconds}s in ${id}`);
}
