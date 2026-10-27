import { SECONDS_PER_DAY, daysFromCivil, lastWeekdayOfMonth, weekdayOnOrAfter, weekdayOnOrBefore } from './calendar.ts';
import type { TzData, TzOn, TzRule, TzUntil, TzZoneLine } from './tzdb-types.ts';

/**
 * Time zones from IANA's time zone database, read the way its reference compiler zic reads it (register R-0001,
 * R-0003): for each zone, the clock's history as a list of transitions, each the instant a new UT offset,
 * abbreviation and daylight-saving flag take effect. Computed from the rules, not taken from the browser's tables
 * (KEEP entry 18), and proven against zic and zdump for every zone (tests/core/time/zones.oracle.test.ts).
 *
 * The span covered: 1800 to 2200 (LAST_YEAR), past any life's reach; outside it the engine refuses to answer.
 */
export const FIRST_YEAR = 1800;
export const LAST_YEAR = 2200;

export interface TimeType {
  /** Seconds east of UT. */
  utoff: number;
  isdst: boolean;
  abbr: string;
}

export interface Transition extends TimeType {
  /** The instant it takes effect, in seconds since 1970-01-01 UT. */
  at: number;
}

export interface ZoneHistory {
  /** The type in effect before the first transition. */
  initial: TimeType;
  transitions: Transition[];
}

/** The instant a rule's day and time fall on, as local seconds of the given kind (before conversion to UT). */
export function dayOf(year: number, month: number, on: TzOn): number {
  switch (on.kind) {
    case 'dom':
      return daysFromCivil(year, month, on.day);
    case 'last':
      return lastWeekdayOfMonth(year, month, on.weekday);
    case 'geq':
      return weekdayOnOrAfter(year, month, on.day, on.weekday);
    case 'leq':
      return weekdayOnOrBefore(year, month, on.day, on.weekday);
  }
}

/** A UT offset as zic's %z writes it: sign, hours, and minutes and seconds only when they aren't zero. */
export function formatOffset(utoff: number): string {
  const sign = utoff < 0 ? '-' : '+';
  const a = Math.abs(utoff);
  const hh = String(Math.floor(a / 3600)).padStart(2, '0');
  const mm = String(Math.floor((a % 3600) / 60)).padStart(2, '0');
  const ss = String(a % 60).padStart(2, '0');
  return a % 60 !== 0 ? `${sign}${hh}${mm}${ss}` : a % 3600 !== 0 ? `${sign}${hh}${mm}` : `${sign}${hh}`;
}

/** A zone line's abbreviation for a type: "A/B" by daylight saving, %s the rule's letters, %z the offset. */
export function abbreviation(format: string, letters: string, isdst: boolean, utoff: number): string {
  const [standard, daylight] = format.split('/');
  if (daylight !== undefined) return isdst ? daylight : (standard as string);
  return format.replace('%s', letters).replace('%z', formatOffset(utoff));
}

/** The local seconds of an "until" or a rule's moment, before it is turned into UT. */
const localMoment = (year: number, u: { month: number; on: TzOn; at: number }) => dayOf(year, u.month, u.on) * SECONDS_PER_DAY + u.at;

/** Turns local seconds of the given kind into UT, given the standard offset and the save in effect. */
function toUT(local: number, atType: 'w' | 's' | 'u', stdoff: number, save: number): number {
  if (atType === 'u') return local;
  return atType === 's' ? local - stdoff : local - stdoff - save;
}

const untilUT = (u: TzUntil, stdoff: number, save: number) => toUT(localMoment(u.year, u), u.atType, stdoff, save);

const sameType = (a: TimeType, b: TimeType) => a.utoff === b.utoff && a.isdst === b.isdst && a.abbr === b.abbr;

/**
 * The zone's history, as zic's outzone computes it: line by line, each line's rules taken in the order their moments
 * fall in UT (a moment read with the save in effect just before it); a line ends at its "until", read with the save in
 * effect then, and the next line starts there, in the state the last rule moment before it (or at it) set, or else in
 * standard time named by the first standard-time rule after it. A transition that changes nothing is dropped.
 */
export function zoneHistory(data: TzData, lines: readonly TzZoneLine[]): ZoneHistory {
  const raw: Transition[] = [];
  /** A transition, kept only inside the span the engine answers for. */
  const add = (t: Transition) => {
    if (t.at < LAST_YEAR_END) raw.push(t);
  };
  let initial: TimeType | undefined;
  /** Where the line being read starts; the first line runs from the beginning of time. */
  let start = -Infinity;
  for (const [i, line] of lines.entries()) {
    const { stdoff, rule, format } = line;
    if (rule.kind !== 'named') {
      const save = rule.kind === 'fixed' ? rule.save : 0;
      const isdst = rule.kind === 'fixed' && rule.isdst;
      const type = { utoff: stdoff + save, isdst, abbr: abbreviation(format, '', isdst, stdoff + save) };
      if (i === 0) initial = type;
      else add({ at: start, ...type });
      start = line.until === undefined ? Infinity : untilUT(line.until, stdoff, save);
      continue;
    }
    const rules = data.rules[rule.name];
    if (rules === undefined) throw new Error(`the rule set ${rule.name} doesn't exist`);
    const typeOf = (r: TzRule): TimeType => ({ utoff: stdoff + r.save, isdst: r.isdst, abbr: abbreviation(format, r.letters, r.isdst, stdoff + r.save) });

    // The state at the line's start is the one the last rule moment at or before it set (a moment exactly at the start
    // and one before it come to the same transition); without one, standard time, named by the first moment after it
    // that saves nothing.
    let save = 0;
    let startType: TimeType | undefined;
    let standardAbbr: string | undefined;
    let firstStandard: TimeType | undefined;
    outer: for (let year = Math.min(...rules.map((r) => r.from)); year <= LAST_YEAR; year += 1) {
      const todo = rules.filter((r) => r.from <= year && (r.to === null || r.to >= year));
      while (todo.length > 0) {
        // The earliest rule left this year, its moment read with the save in effect now.
        const timed = todo.map((r) => ({ r, at: toUT(localMoment(year, r), r.atType, stdoff, save) }));
        // Stryker disable next-line EqualityOperator: zic refuses two rules at one instant, so no two moments tie.
        const { r: next, at } = timed.reduce((a, b) => (b.at < a.at ? b : a));
        todo.splice(todo.indexOf(next), 1);
        const ends = line.until !== undefined && at >= untilUT(line.until, stdoff, save);
        if (next.save === 0) standardAbbr ??= typeOf(next).abbr;
        if (!next.isdst) firstStandard ??= typeOf(next);
        if (ends) break outer;
        save = next.save;
        if (at <= start) startType = typeOf(next);
        else add({ at, ...typeOf(next) });
      }
    }
    // A zone that opens on rules is, before its first moment, in the first standard time they give (zic's default type).
    if (i === 0) initial = firstStandard;
    else {
      if (startType === undefined && standardAbbr === undefined && format.includes('%s')) throw new Error(`no abbreviation can be found for the start of a ${rule.name} line`);
      // Stryker disable next-line StringLiteral: a format with %s was refused above, so no letters are read here.
      add({ at: start, ...(startType ?? { utoff: stdoff, isdst: false, abbr: standardAbbr ?? abbreviation(format, '', false, stdoff) }) });
    }
    start = line.until === undefined ? Infinity : untilUT(line.until, stdoff, save);
  }
  if (initial === undefined) throw new Error('the zone has no standard time to start in');
  return { initial, transitions: optimize(initial, raw.sort((a, b) => a.at - b.at)) };
}

/**
 * zic's "optimize" pass (writezone): a transition whose local time is not later than the one before it, read in the
 * types each leaves, takes that one's place (or undoes it, when it returns to the type before both); and a transition
 * that changes nothing is dropped.
 */
export function optimize(initial: TimeType, raw: readonly Transition[]): Transition[] {
  const out: Transition[] = [];
  for (const t of raw) {
    const prev = out.at(-1);
    if (prev !== undefined) {
      const before = out.at(-2) ?? initial;
      if (t.at + prev.utoff <= prev.at + before.utoff) {
        if (sameType(t, before)) out.pop();
        else out[out.length - 1] = { ...t, at: prev.at };
        continue;
      }
    }
    if (!sameType(prev ?? initial, t)) out.push(t);
  }
  return out;
}

/** The end of the span the engine answers for: the start of 2201 UT. */
export const LAST_YEAR_END = daysFromCivil(LAST_YEAR + 1, 1, 1) * SECONDS_PER_DAY;
/** The start of the span: 1800-01-01 UT. */
export const FIRST_YEAR_START = daysFromCivil(FIRST_YEAR, 1, 1) * SECONDS_PER_DAY;
