import { civilFromDays } from '../../core/time/calendar.ts';
import data from './calendars.json' with { type: 'json' };

export type CalendarId = 'islamic-umalqura' | 'hebrew' | 'chinese' | 'dangi' | 'persian' | 'ethiopic';
/** The first and last days the calendars are compiled for, as days from 1970-01-01 (2000-01-01 and 2150-12-31). */
export const CALENDAR_FROM: number = data.from;
export const CALENDAR_TO: number = data.to;

export interface Month {
  first: number;
  last: number;
}
let index: Map<CalendarId, Map<string, Month[]>> | undefined;

/** A calendar's months by their number or name ("9", "Adar II", "6bis"), each its first and last day, in order. */
function monthsOf(calendar: CalendarId): Map<string, Month[]> {
  index ??= new Map(Object.entries(data.calendars).map(([c, months]) => [c as CalendarId, monthIndex(months, data.to)]));
  return index.get(calendar) as Map<string, Month[]>;
}

/** A calendar's months ("1447/9": its first day) by their number or name, each to the day before the next's first, the last to the table's end. */
export function monthIndex(months: Record<string, number>, to: number): Map<string, Month[]> {
  const out = new Map<string, Month[]>();
  const entries = Object.entries(months);
  entries.forEach(([key, first], i) => {
    const m = { first, last: (entries[i + 1]?.[1] ?? to + 1) - 1 };
    const month = key.split('/')[1] as string;
    const list = out.get(month);
    if (list === undefined) out.set(month, [m]);
    else list.push(m);
  });
  return out;
}

/**
 * The days of a Gregorian year that are the given day of the given month of a calendar: none, one or (for the Islamic
 * year, shorter than the Gregorian) two. A day past the month's end is none; a month the calendar hasn't is an error.
 */
export function daysIn(calendar: CalendarId, month: string, day: number, year: number): number[] {
  const months = monthsOf(calendar).get(month);
  if (months === undefined) throw new RangeError(`the ${calendar} calendar has no month ${month}`);
  const out: number[] = [];
  for (const m of months) {
    const d = m.first + day - 1;
    if (day >= 1 && d <= m.last && civilFromDays(d).year === year) out.push(d);
  }
  return out;
}
