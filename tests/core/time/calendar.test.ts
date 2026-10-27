import { describe, expect, it } from 'vitest';
import {
  civilFromDays,
  daysFromCivil,
  daysInMonth,
  isLeapYear,
  lastWeekdayOfMonth,
  weekdayFromDays,
  weekdayOnOrAfter,
  weekdayOnOrBefore,
} from '../../../src/core/time/calendar.ts';

/**
 * The calendar's arithmetic against ECMAScript's Date, which ECMA-262 defines on the same proleptic Gregorian calendar
 * (§21.4.1, "Time Values and Time Range"): every day from 1600 to 2400, both ways, with its weekday.
 */
const FIRST = Date.UTC(1600, 0, 1) / 86_400_000;
const LAST = Date.UTC(2400, 11, 31) / 86_400_000;

describe('the calendar, against ECMAScript Date for every day from 1600 to 2400', () => {
  it('days-from-civil: a date gives the day count Date gives', () => {
    for (let days = FIRST; days <= LAST; days += 1) {
      const d = new Date(days * 86_400_000);
      if (daysFromCivil(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) !== days) throw new Error(`days-from-civil is wrong at ${d.toISOString()}`);
    }
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(2000, 3, 1)).toBe(11_017);
    expect(daysFromCivil(1600, 1, 1)).toBe(FIRST);
  });
  it('civil-from-days: a day count gives the date Date gives', () => {
    for (let days = FIRST; days <= LAST; days += 1) {
      const d = new Date(days * 86_400_000);
      const c = civilFromDays(days);
      if (c.year !== d.getUTCFullYear() || c.month !== d.getUTCMonth() + 1 || c.day !== d.getUTCDate()) throw new Error(`civil-from-days is wrong at ${d.toISOString()}`);
    }
    expect(civilFromDays(0)).toEqual({ year: 1970, month: 1, day: 1 });
    expect(civilFromDays(-1)).toEqual({ year: 1969, month: 12, day: 31 });
    expect(civilFromDays(11_016)).toEqual({ year: 2000, month: 2, day: 29 });
  });
  it('weekday: every day falls on the weekday Date gives', () => {
    for (let days = FIRST; days <= LAST; days += 1) {
      if (weekdayFromDays(days) !== new Date(days * 86_400_000).getUTCDay()) throw new Error(`weekday is wrong at day ${days}`);
    }
    expect([weekdayFromDays(0), weekdayFromDays(-1), weekdayFromDays(-7), weekdayFromDays(3)]).toEqual([4, 3, 4, 0]);
  });
  it('leap years and month lengths: as Date counts them', () => {
    for (let year = 1600; year <= 2400; year += 1) {
      expect(isLeapYear(year)).toBe(new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1);
      for (let month = 1; month <= 12; month += 1) expect(daysInMonth(year, month)).toBe(new Date(Date.UTC(year, month, 0)).getUTCDate());
    }
    expect([1900, 2000, 2024, 2100, 2023].map(isLeapYear)).toEqual([false, true, true, false, false]);
  });
  it('weekday rules: the last, the first on or after, and the last on or before a day, across month ends', () => {
    const find = (from: number, step: number, weekday: number) => {
      let d = from;
      while (weekdayFromDays(d) !== weekday) d += step;
      return d;
    };
    for (let year = 1890; year <= 2110; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (let weekday = 0; weekday < 7; weekday += 1) {
          expect(lastWeekdayOfMonth(year, month, weekday)).toBe(find(daysFromCivil(year, month, daysInMonth(year, month)), -1, weekday));
          for (const day of [1, 8, 15, 25, 29]) {
            if (day > daysInMonth(year, month)) continue;
            expect(weekdayOnOrAfter(year, month, day, weekday)).toBe(find(daysFromCivil(year, month, day), 1, weekday));
            expect(weekdayOnOrBefore(year, month, day, weekday)).toBe(find(daysFromCivil(year, month, day), -1, weekday));
          }
        }
      }
    }
    // 2026: the last Sunday of March is the 29th; the second Sunday of March (Sun>=8) the 8th; Sun>=29 in March 2025
    // rolls into April.
    expect(civilFromDays(lastWeekdayOfMonth(2026, 3, 0))).toEqual({ year: 2026, month: 3, day: 29 });
    expect(civilFromDays(weekdayOnOrAfter(2026, 3, 8, 0))).toEqual({ year: 2026, month: 3, day: 8 });
    expect(civilFromDays(weekdayOnOrAfter(2025, 3, 31, 2))).toEqual({ year: 2025, month: 4, day: 1 });
    expect(civilFromDays(weekdayOnOrBefore(2026, 3, 1, 6))).toEqual({ year: 2026, month: 2, day: 28 });
  });
});
