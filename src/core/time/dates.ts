import { civilFromDays, daysFromCivil, daysInMonth, type CivilDate } from './calendar.ts';
import { instantOf, localTime } from './time.ts';

/**
 * A life's calendar, read in a place's own zone: when its day starts, the same time days or months on, how many days lie
 * between two moments, and a person's age. Before 2026-10-30 the core had none of these and the cards engine counted
 * its days and ages in UT, so a life in Tokyo turned a year older nine hours late (the core audit of that day).
 *
 * A local time the clock skips (the hour it jumps forward) is read as instantOf reads it, as far past the jump as it was
 * into the gap; a time it shows twice is the earlier.
 */

/** The instant a local date begins in a zone: its midnight, or its first moment where the clock skips midnight. */
export const dayStart = (zone: string, date: CivilDate): number => instantOf(zone, date, 0).instant;

/** The instant the local day of a moment began. */
export const startOfDay = (zone: string, instant: number): number => dayStart(zone, localTime(zone, instant).date);

/** The same local time a number of days later (earlier, below zero). */
export function addDays(zone: string, instant: number, days: number): number {
  const { date, seconds } = localTime(zone, instant);
  return instantOf(zone, civilFromDays(daysFromCivil(date.year, date.month, date.day) + days), seconds).instant;
}

/**
 * The same local time a number of months later (earlier, below zero), on the same day of the month, or the month's
 * last day where it has fewer: 31 January and a month is 28 or 29 February. A year is twelve months.
 */
export function addMonths(zone: string, instant: number, months: number): number {
  const { date, seconds } = localTime(zone, instant);
  const index = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return instantOf(zone, { year, month, day: Math.min(date.day, daysInMonth(year, month)) }, seconds).instant;
}

/** The whole local days from one moment's date to another's: 1 from any time one evening to any time the next morning. */
export function daysBetween(zone: string, from: number, to: number): number {
  const [a, b] = [localTime(zone, from).date, localTime(zone, to).date];
  return daysFromCivil(b.year, b.month, b.day) - daysFromCivil(a.year, a.month, a.day);
}

/**
 * A person's age in whole years at a moment, in the zone they live in: a birthday comes at that zone's local midnight,
 * not at UT's.
 *
 * Someone born on 29 February turns a year older on 1 March in a year without one, the day after 28 February. This is
 * the game's reading, decided on 2026-10-30, not a researched one: the law differs by country (the core audit of that
 * day named New Zealand's 28 February, unverified), and a per-country rule from each country's statute, when the papers'
 * research reaches it, replaces it.
 */
export function ageOn(born: CivilDate, instant: number, zone: string): number {
  const { year, month, day } = localTime(zone, instant).date;
  return year - born.year - (month < born.month || (month === born.month && day < born.day) ? 1 : 0);
}
