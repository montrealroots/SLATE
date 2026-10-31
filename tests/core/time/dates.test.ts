import { describe, expect, it } from 'vitest';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { addDays, addMonths, ageOn, dayStart, daysBetween, startOfDay } from '../../../src/core/time/dates.ts';

const utc = (y: number, m: number, d: number, h = 0, min = 0) => daysFromCivil(y, m, d) * 86_400 + h * 3600 + min * 60;
const NY = 'America/New_York';
const TOKYO = 'Asia/Tokyo';
// Chile moves its clocks at 24:00 local, so the first Sunday of its daylight time (6 September 2026) has no midnight.
const SANTIAGO = 'America/Santiago';

describe('a local day', () => {
  it('starts at the zone\'s midnight, not UT\'s', () => {
    expect(dayStart(TOKYO, { year: 2026, month: 5, day: 10 })).toBe(utc(2026, 5, 9, 15));
    expect(dayStart(NY, { year: 2026, month: 7, day: 1 })).toBe(utc(2026, 7, 1, 4));
    expect(dayStart(NY, { year: 2026, month: 1, day: 1 })).toBe(utc(2026, 1, 1, 5));
    expect(startOfDay(TOKYO, utc(2026, 5, 9, 23))).toBe(utc(2026, 5, 9, 15));
    expect(startOfDay(TOKYO, utc(2026, 5, 9, 14, 59))).toBe(utc(2026, 5, 8, 15));
    expect(startOfDay(NY, utc(2026, 7, 2, 3, 59))).toBe(utc(2026, 7, 1, 4));
  });
  it('starts at its first moment where the clock skips midnight', () => {
    expect(dayStart(SANTIAGO, { year: 2026, month: 9, day: 6 })).toBe(utc(2026, 9, 6, 4));
    expect(startOfDay(SANTIAGO, utc(2026, 9, 6, 12))).toBe(utc(2026, 9, 6, 4));
    expect(startOfDay(SANTIAGO, utc(2026, 9, 6, 3, 59))).toBe(utc(2026, 9, 5, 4));
  });
});

describe('days and months on', () => {
  it('keep the local time across a change of the clocks, so a day is 23 or 25 hours there', () => {
    // New York went forward on 8 March 2026 and back on 1 November.
    expect(addDays(NY, utc(2026, 3, 7, 15), 1)).toBe(utc(2026, 3, 8, 14));
    expect(addDays(NY, utc(2026, 10, 31, 14), 1)).toBe(utc(2026, 11, 1, 15));
    expect(addDays(NY, utc(2026, 3, 8, 14), -1)).toBe(utc(2026, 3, 7, 15));
    expect(addDays(TOKYO, utc(2026, 12, 31, 3), 1)).toBe(utc(2027, 1, 1, 3));
    expect(addDays(TOKYO, utc(2026, 12, 31, 3), 0)).toBe(utc(2026, 12, 31, 3));
    // A time the clock skips is read past the jump.
    expect(addDays(NY, utc(2026, 3, 7, 7, 30), 1)).toBe(utc(2026, 3, 8, 7, 30));
  });
  it('keep the day of the month, or the month\'s last where it has fewer, across years both ways', () => {
    const jan31 = utc(2026, 1, 31, 3);
    expect(addMonths(TOKYO, jan31, 1)).toBe(utc(2026, 2, 28, 3));
    expect(addMonths(TOKYO, utc(2028, 1, 31, 3), 1)).toBe(utc(2028, 2, 29, 3));
    expect(addMonths(TOKYO, utc(2026, 3, 31, 3), -1)).toBe(utc(2026, 2, 28, 3));
    expect(addMonths(TOKYO, utc(2026, 3, 30, 3), 1)).toBe(utc(2026, 4, 30, 3));
    expect(addMonths(TOKYO, utc(2026, 12, 15, 3), 1)).toBe(utc(2027, 1, 15, 3));
    expect(addMonths(TOKYO, utc(2026, 1, 15, 3), -1)).toBe(utc(2025, 12, 15, 3));
    expect(addMonths(TOKYO, utc(2026, 1, 15, 3), -13)).toBe(utc(2024, 12, 15, 3));
    expect(addMonths(TOKYO, utc(2028, 2, 29, 3), 12)).toBe(utc(2029, 2, 28, 3));
    expect(addMonths(TOKYO, jan31, 0)).toBe(jan31);
    // The local date and time, not UT's: 31 January in Tokyo is still the 30th in UT.
    expect(addMonths(TOKYO, utc(2026, 1, 30, 20), 1)).toBe(utc(2026, 2, 27, 20));
    // And across a change of the clocks, the local time.
    expect(addMonths(NY, utc(2026, 2, 15, 17), 1)).toBe(utc(2026, 3, 15, 16));
  });
  it('count the local dates between two moments, not the hours', () => {
    expect(daysBetween(NY, utc(2026, 3, 8, 3), utc(2026, 3, 8, 6))).toBe(1);
    expect(daysBetween(NY, utc(2026, 3, 8, 6), utc(2026, 3, 8, 3))).toBe(-1);
    expect(daysBetween(TOKYO, utc(2026, 5, 9, 14), utc(2026, 5, 9, 16))).toBe(1);
    expect(daysBetween(TOKYO, utc(2026, 5, 9, 16), utc(2026, 5, 10, 14))).toBe(0);
    expect(daysBetween(TOKYO, utc(2026, 1, 1, 3), utc(2027, 1, 1, 3))).toBe(365);
  });
});

describe('an age', () => {
  const born = { year: 2000, month: 5, day: 10 };
  it('turns at the local midnight of the zone the person lives in', () => {
    // 08:00 on 10 May 2026 in Tokyo is 23:00 on the 9th in UT, which would say 25.
    expect(ageOn(born, utc(2026, 5, 9, 23), TOKYO)).toBe(26);
    expect(ageOn(born, utc(2026, 5, 9, 23), 'Etc/UTC')).toBe(25);
    expect(ageOn(born, utc(2026, 5, 9, 14, 59), TOKYO)).toBe(25);
    expect(ageOn(born, utc(2026, 5, 10, 3), NY)).toBe(25);
    expect(ageOn(born, utc(2026, 5, 10, 4), NY)).toBe(26);
  });
  it('is whole years, before and after the birthday in its month and either side of it', () => {
    expect([[2026, 4, 30], [2026, 5, 9], [2026, 5, 10], [2026, 5, 11], [2026, 6, 1], [2027, 1, 1]].map(([y, m, d]) => ageOn(born, utc(y as number, m as number, d as number, 12), 'Etc/UTC'))).toEqual([25, 25, 26, 26, 26, 26]);
    expect(ageOn(born, utc(2000, 5, 10, 12), 'Etc/UTC')).toBe(0);
  });
  it('turns on 1 March for someone born on 29 February, in a year without one (the game\'s reading)', () => {
    const leap = { year: 2004, month: 2, day: 29 };
    expect([[2027, 2, 28], [2027, 3, 1], [2028, 2, 28], [2028, 2, 29]].map(([y, m, d]) => ageOn(leap, utc(y as number, m as number, d as number, 12), 'Etc/UTC'))).toEqual([22, 23, 23, 24]);
  });
});
