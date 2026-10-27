import { civilFromDays, daysFromCivil } from '../../src/core/time/calendar.ts';

/**
 * The calendars the holidays are kept in, other than the Gregorian (R-0106): the Umm al-Qura Islamic calendar, the
 * Hebrew, the Chinese and the Korean (dangi) lunisolar calendars, the Persian (Solar Hijri) and the Ethiopian, as ICU
 * computes them, compiled to each month's first day from 2000 to 2150, so the game never asks the browser's own ICU.
 */
export const CALENDARS = ['islamic-umalqura', 'hebrew', 'chinese', 'dangi', 'persian', 'ethiopic'] as const;
export type CalendarId = (typeof CALENDARS)[number];
export const FROM = daysFromCivil(2000, 1, 1);
export const TO = daysFromCivil(2150, 12, 31);
export const OUTPUT = 'src/world/holidays/calendars.json';

/** A day in a calendar: its year, its month (a number, a name as the Hebrew's, a number with "bis" for a leap month), its day. */
export interface CalendarDay {
  year: string;
  month: string;
  day: number;
}

/** Each calendar's months, by their year and month ("1447/9", "5787/Adar II", "2025/6bis"), each its first day, as days from 1970-01-01. */
export type Calendars = Record<CalendarId, Record<string, number>>;

/**
 * Walks every day from FROM to TO in each calendar and keeps each month's first day. A month must begin on its day 1
 * and each day follow the one before it in the same month or begin the next; anything else stops the compile.
 */
export function compileCalendars(dayIn: (calendar: CalendarId, days: number) => CalendarDay): Calendars {
  const out = {} as Calendars;
  for (const calendar of CALENDARS) {
    const months: Record<string, number> = {};
    let previous: CalendarDay | undefined;
    for (let days = FROM; days <= TO; days += 1) {
      const d = dayIn(calendar, days);
      const key = `${d.year}/${d.month}`;
      const same = previous !== undefined && `${previous.year}/${previous.month}` === key;
      if (same ? d.day !== (previous as CalendarDay).day + 1 : previous !== undefined && d.day !== 1) {
        const c = civilFromDays(days);
        throw new Error(`${calendar}: ${c.year}-${c.month}-${c.day} is day ${d.day} of ${key}, after day ${(previous as CalendarDay).day} of ${(previous as CalendarDay).year}/${(previous as CalendarDay).month}`);
      }
      if (d.day === 1) months[key] = days;
      previous = d;
    }
    out[calendar] = months;
  }
  return out;
}

export const serialize = (c: Calendars) => `${JSON.stringify({ from: FROM, to: TO, calendars: c })}\n`;
