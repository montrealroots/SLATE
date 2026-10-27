/**
 * The calendar's arithmetic: the proleptic Gregorian calendar as days counted from 1970-01-01, by Howard Hinnant's
 * algorithms ("chrono-Compatible Low-Level Date Algorithms", howardhinnant.github.io/date_algorithms.html; register
 * R-0002). Months are 1 to 12, weekdays 0 (Sunday) to 6 (Saturday). Pure integer arithmetic, so it is exact for every
 * date a life can reach.
 */

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export const SECONDS_PER_DAY = 86_400;

/** Floor division, as the algorithms' integer division of a possibly negative numerator requires. */
const div = (a: number, b: number) => Math.floor(a / b);

/** Days from 1970-01-01 to the date (negative before it). Hinnant's days_from_civil. */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = div(y, 400);
  const yoe = y - era * 400;
  const doy = div(153 * (month > 2 ? month - 3 : month + 9) + 2, 5) + day - 1;
  const doe = yoe * 365 + div(yoe, 4) - div(yoe, 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** The date a count of days from 1970-01-01 falls on. Hinnant's civil_from_days. */
export function civilFromDays(days: number): CivilDate {
  const z = days + 719_468;
  const era = div(z, 146_097);
  const doe = z - era * 146_097;
  const yoe = div(doe - div(doe, 1460) + div(doe, 36_524) - div(doe, 146_096), 365);
  const doy = doe - (365 * yoe + div(yoe, 4) - div(yoe, 100));
  const mp = div(5 * doy + 2, 153);
  const day = doy - div(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** The weekday of a day count: 0 Sunday to 6 Saturday (1970-01-01 was a Thursday). Hinnant's weekday_from_days. */
export function weekdayFromDays(days: number): number {
  return ((days % 7) + 11) % 7;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  return daysFromCivil(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - daysFromCivil(year, month, 1);
}

/** The day count of the last given weekday of a month ("lastSun"). */
export function lastWeekdayOfMonth(year: number, month: number, weekday: number): number {
  const last = daysFromCivil(year, month, daysInMonth(year, month));
  return last - ((weekdayFromDays(last) - weekday + 7) % 7);
}

/** The day count of the first given weekday on or after a date ("Sun>=8"); it may fall in the next month. */
export function weekdayOnOrAfter(year: number, month: number, day: number, weekday: number): number {
  const from = daysFromCivil(year, month, day);
  return from + ((weekday - weekdayFromDays(from) + 7) % 7);
}

/** The day count of the last given weekday on or before a date ("Sun<=25"); it may fall in the month before. */
export function weekdayOnOrBefore(year: number, month: number, day: number, weekday: number): number {
  const from = daysFromCivil(year, month, day);
  return from - ((weekdayFromDays(from) - weekday + 7) % 7);
}
