import { civilFromDays } from '../../core/time/calendar.ts';
import data from './calendars.json' with { type: 'json' };

export type CalendarId = 'islamic-umalqura' | 'hebrew' | 'chinese' | 'dangi' | 'persian' | 'ethiopic';
/** The first and last days the calendars are compiled for, as days from 1970-01-01 (2000-01-01 and 2150-12-31). */
export const CALENDAR_FROM: number = data.from;
export const CALENDAR_TO: number = data.to;

/** Each calendar's months by their number or name, each as its year's label and its first and last day, in order. */
const MONTHS = new Map<CalendarId, Map<string, { year: string; first: number; last: number }[]>>();
for (const [calendar, months] of Object.entries(data.calendars) as [CalendarId, Record<string, number>][]) {
  const byMonth = new Map<string, { year: string; first: number; last: number }[]>();
  const entries = Object.entries(months);
  entries.forEach(([key, first], i) => {
    const [year, month] = key.split('/') as [string, string];
    // A month's last day is the day before the next's first; the last month compiled ends where the table does.
    const last = i + 1 < entries.length ? (entries[i + 1] as [string, number])[1] - 1 : data.to;
    const list = byMonth.get(month) ?? [];
    list.push({ year, first, last });
    byMonth.set(month, list);
  });
  MONTHS.set(calendar, byMonth);
}

/**
 * The days of a Gregorian year that are the given day of the given month of a calendar: none, one or (for the Islamic
 * year, shorter than the Gregorian) two. A day past the month's end is none.
 */
export function daysIn(calendar: CalendarId, month: string, day: number, year: number): number[] {
  const out: number[] = [];
  for (const m of (MONTHS.get(calendar) as Map<string, { first: number; last: number }[]>).get(month) ?? []) {
    const d = m.first + day - 1;
    if (day >= 1 && d <= m.last && civilFromDays(d).year === year) out.push(d);
  }
  return out;
}
