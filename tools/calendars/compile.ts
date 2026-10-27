import { civilFromDays, daysFromCivil } from '../../src/core/time/calendar.ts';

/**
 * The calendars the holidays are kept in, other than the Gregorian (R-0106): the Umm al-Qura Islamic calendar, the
 * Hebrew, the Chinese and the Korean (dangi) lunisolar calendars, the Persian (Solar Hijri) and the Ethiopian, compiled
 * to each month's first day from 2000 to 2100 (the game's years end in 2100), so the game never asks the browser's own
 * ICU: the Chinese from the Hong Kong Observatory's tables, the others as ICU computes them.
 */
export const CALENDARS = ['islamic-umalqura', 'hebrew', 'chinese', 'dangi', 'persian', 'ethiopic'] as const;
export type CalendarId = (typeof CALENDARS)[number];
export const FROM = daysFromCivil(2000, 1, 1);
export const TO = daysFromCivil(2100, 12, 31);
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

/**
 * The Chinese calendar's days from the Hong Kong Observatory's tables (research/sources/hko-lunar.json), a table a
 * Gregorian year: a row a day, its lunar day, or "1st Lunar Month" (to "12th") where a month begins; a month whose
 * number repeats the one before is that one's leap month ("6bis"); a lunar year is the Gregorian year its first month
 * begins in (those before the tables' first first month, the year before).
 */
export function hkoChinese(tables: Readonly<Record<string, string>>): Map<number, CalendarDay> {
  const out = new Map<number, CalendarDay>();
  let year: number | undefined;
  let month: number | undefined;
  let leap = false;
  for (const text of Object.values(tables)) {
    for (const [, y, m, d, first, day] of text.matchAll(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(?:(\d+)(?:st|nd|rd|th) Lunar [Mm]onth|(\d+))\s/gm)) {
      if (first !== undefined) {
        const n = Number(first);
        leap = n === month;
        month = n;
        year = n === 1 ? Number(y) : (year ?? Number(y) - 1);
      }
      // Days before the first month's beginning have no month to be in.
      if (month === undefined) continue;
      out.set(daysFromCivil(Number(y), Number(m), Number(d)), { year: String(year), month: `${month}${leap ? 'bis' : ''}`, day: first === undefined ? Number(day) : 1 });
    }
  }
  // A day a table leaves out between two days of one month is the day between them (2069's 30 December).
  for (const [days, before] of [...out]) {
    const after = out.get(days + 2);
    if (!out.has(days + 1) && after?.year === before.year && after.month === before.month && after.day === before.day + 2) out.set(days + 1, { ...before, day: before.day + 1 });
  }
  return out;
}

export const serialize = (c: Calendars) => `${JSON.stringify({ from: FROM, to: TO, calendars: c })}\n`;
