import { civilFromDays, daysFromCivil, lastWeekdayOfMonth, weekdayFromDays, weekdayOnOrAfter, weekdayOnOrBefore } from '../../core/time/calendar.ts';
import { SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { seasonStarts } from '../clock/clock.ts';
import { daysIn, type CalendarId } from './calendars.ts';

/**
 * Easter Sunday, as days from 1970-01-01: the Western churches' by the Gregorian computus, as the U.S. Naval
 * Observatory gives it (R-0107); the Orthodox churches' by the Julian computus, its Julian date carried to the
 * Gregorian calendar (R-0108).
 */
export function easter(year: number, orthodox = false): number {
  if (orthodox) {
    const a = year % 4;
    const b = year % 7;
    const c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day = ((d + e + 114) % 31) + 1;
    return julianToDays(year, month, day);
  }
  // J.-M. Oudin's algorithm (1940), as the Naval Observatory gives it: integer division throughout.
  const q = (x: number, y: number) => Math.trunc(x / y);
  const c = q(year, 100);
  const n = year - 19 * q(year, 19);
  const k = q(c - 17, 25);
  let i = c - q(c, 4) - q(c - k, 3) + 19 * n + 15;
  i -= 30 * q(i, 30);
  i -= q(i, 28) * (1 - q(i, 28) * q(29, i + 1) * q(21 - n, 11));
  let j = year + q(year, 4) + i + 2 - c + q(c, 4);
  j -= 7 * q(j, 7);
  const l = i - j;
  const month = 3 + q(l + 40, 44);
  const day = l + 28 - 31 * q(month, 4);
  return daysFromCivil(year, month, day);
}

/** A Julian calendar date as days from 1970-01-01 (by its Julian Day Number: 1970-01-01 is JDN 2,440,588). */
export function julianToDays(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32_083 - 2_440_588;
}

/** When a holiday falls in a year. Months 1 to 12, weekdays 0 (Sunday) to 6. */
export type When =
  /** A day of a month. */
  | { fixed: [month: number, day: number] }
  /** Days from Easter Sunday (Good Friday -2, Easter Monday 1, Ascension 39, Whit Monday 50). */
  | { easter: number; orthodox?: true }
  /** The nth weekday of a month (n 1 to 5), or its last (-1). */
  | { nth: [month: number, weekday: number, n: number] }
  /** The weekday on or after, or on or before, a day. */
  | { after: [month: number, day: number, weekday: number] }
  | { before: [month: number, day: number, weekday: number] }
  /** A day of a month of another calendar ("islamic-umalqura", "10", 1 is Eid al-Fitr). */
  | { lunar: [calendar: CalendarId, month: string, day: number] }
  /** The day of the March (3) or September (9) equinox at a UTC offset in minutes (Japan's equinox days, +540), the clock's (R-0036). */
  | { equinox: [month: 3 | 9, offset: number] }
  /** The days a government announced, as YYYY-MM-DD. */
  | { dates: string[] };

export interface Rule {
  name: string;
  when: When;
  /** Days after the day the rule gives (the second day of a feast is 1). */
  plus?: number;
  /** Instead, a day of the month itself when it falls on a weekday (Ireland's February holiday: 1 February when a Friday). */
  instead?: { on: [month: number, day: number]; weekday: number };
  /**
   * Held only when another day of the year falls (or, with not, doesn't fall) on one of these weekdays (Neuchâtel's 2
   * January only when 1 January is a Sunday; Uri's St Stephen's Day not when Christmas is a Monday or a Friday).
   */
  when_?: { on: [month: number, day: number]; weekdays: number[]; not?: true };
  /** Moved by days when it falls within days of Easter (Glarus' Näfelser Fahrt: a week later in Holy Week). */
  shift?: { easter: [from: number, to: number]; plus: number };
  /** The first and last years it holds, where the law has changed. */
  from?: number;
  until?: number;
  /** Years it doesn't hold in, by a transitional law (Slovakia's 8 May and 15 September in 2026). */
  except?: number[];
  /** Held only every so many years, counted from a year it holds in (Illinois' general election day: every 2 from 2026). */
  cycle?: [every: number, year: number];
  /** Not moved off a weekend, where the country's rule would move others. */
  fixed?: true;
  /** Its own rule for falling on given weekdays, in place of the country's (the Netherlands' King's Day: a Sunday's is the Saturday before). */
  move?: Substitute[];
  /** Only in these first-level regions (the gazetteer's codes), where it isn't the whole country's. */
  regions?: string[];
}

/**
 * A country's rule for a holiday falling on given weekdays: off instead is the next (or the previous) day that is
 * neither one of them nor a holiday, or, where the holiday keeps its day as one off (Japan's), off as well.
 */
export interface Substitute {
  on: number[];
  to: 'next' | 'previous';
  as?: 'well';
  /** The day may be another holiday's: each is kept by its own date (the United States': a Saturday's is the Friday before, whatever else falls on it). */
  shared?: true;
}

export interface CountryRules {
  holidays: Rule[];
  substitute?: Substitute[];
  /**
   * The last year whose holidays are all announced, where some are set year by year (Spain's communities choose theirs
   * by decree): later years have only the holidays the law fixes.
   */
  announcedTo?: number;
  /** The same, for a first-level region whose own holidays are set year by year (Georgia's, by its governor). */
  regionsAnnouncedTo?: Record<string, number>;
  /**
   * The first-level regions that keep their own law's days in place of the country's (Canada's provinces and
   * territories, each by its employment standards law); any other region keeps the country's.
   */
  regional?: string[];
  /** A day between two holidays (not substitutes) is one too, by this name (Japan's Act on National Holidays, article 3(3)). */
  between?: string;
}

export interface Holiday {
  /** Days from 1970-01-01. */
  day: number;
  name: string;
  /** A day off in place of a holiday that fell on a weekend; its name the holiday's. */
  substitute?: true;
  /** A holiday whose day off moved to a substitute: still its day, but not the day off. */
  moved?: true;
}

/** The days a rule gives in a Gregorian year (an Islamic feast may fall twice in one). */
export function daysOf(when: When, year: number): number[] {
  if ('fixed' in when) return [daysFromCivil(year, when.fixed[0], when.fixed[1])];
  if ('easter' in when) return [easter(year, when.orthodox === true) + when.easter];
  if ('nth' in when) {
    const [month, weekday, n] = when.nth;
    return [n === -1 ? lastWeekdayOfMonth(year, month, weekday) : weekdayOnOrAfter(year, month, 1, weekday) + 7 * (n - 1)];
  }
  if ('after' in when) return [weekdayOnOrAfter(year, ...when.after)];
  if ('before' in when) return [weekdayOnOrBefore(year, ...when.before)];
  if ('lunar' in when) return daysIn(...when.lunar, year);
  if ('equinox' in when) {
    const [month, offset] = when.equinox;
    return [Math.floor(((seasonStarts(year)[month === 3 ? 0 : 2] as number) + offset * 60) / SECONDS_PER_DAY)];
  }
  return when.dates.map((d) => daysFromCivil(Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10)))).filter((d) => civilFromDays(d).year === year);
}

/** The day of the month a rule gives instead, in a year it falls on its weekday (Ireland's 1 February on a Friday). */
function insteadOf(rule: Rule, year: number): number | undefined {
  if (rule.instead === undefined) return undefined;
  const d = daysFromCivil(year, ...rule.instead.on);
  return weekdayFromDays(d) === rule.instead.weekday ? d : undefined;
}

/** The days a country's rules give in a Gregorian year, in a region of it or nationwide, before any substitute, each with its rule. */
function ruleDays(rules: CountryRules, year: number, region?: string): [Holiday, Rule][] {
  // Stryker disable next-line ArrayDeclaration: an entry that is no holiday's day falls out with the year's filter.
  const out: [Holiday, Rule][] = [];
  for (const rule of rules.holidays) {
    if (year < (rule.from ?? -Infinity) || year > (rule.until ?? Infinity) || rule.except?.includes(year) === true) continue;
    if (rule.cycle !== undefined && (year - rule.cycle[1]) % rule.cycle[0] !== 0) continue;
    if (rule.regions?.includes(region as string) === false) continue;
    if (rule.regions === undefined && rules.regional?.includes(region as string) === true) continue;
    if (rule.when_ !== undefined && rule.when_.weekdays.includes(weekdayFromDays(daysFromCivil(year, ...rule.when_.on))) === (rule.when_.not === true)) continue;
    const instead = insteadOf(rule, year);
    const days = instead === undefined ? daysOf(rule.when, year) : [instead];
    for (const d of days) {
      const shifted = rule.shift !== undefined && d - easter(year) >= rule.shift.easter[0] && d - easter(year) <= rule.shift.easter[1] ? rule.shift.plus : 0;
      out.push([{ day: d + (rule.plus ?? 0) + shifted, name: rule.name }, rule]);
    }
  }
  return out;
}

/**
 * A country's holidays in a Gregorian year, in a region of it or nationwide (no region), in order of day: each rule's
 * days, then its substitutes and the days between.
 */
export function holidaysIn(rules: CountryRules, year: number, region?: string): Holiday[] {
  // The years either side too: a substitute may cross into this one (the United States' Saturday 1 January, kept on
  // the 31 December before).
  const days = [year - 1, year, year + 1].flatMap((y) => ruleDays(rules, y, region));
  const out = days.map(([h]) => h);
  const taken = new Set(out.map((h) => h.day));
  // Substitutes, in order of the holidays they stand for, each taking the first day free of the weekdays and (unless
  // shared) of holidays.
  for (const [h, rule] of days.sort((a, b) => a[0].day - b[0].day)) {
    const sub = (rule.move ?? rules.substitute)?.find((s) => s.on.includes(weekdayFromDays(h.day)));
    if (sub === undefined || rule.fixed === true) continue;
    const step = sub.to === 'next' ? 1 : -1;
    let d = h.day + step;
    while (sub.on.includes(weekdayFromDays(d)) || (taken.has(d) && sub.shared !== true)) d += step;
    taken.add(d);
    if (sub.as === undefined) h.moved = true;
    out.push({ day: d, name: h.name, substitute: true });
  }
  if (rules.between !== undefined) {
    const own = new Set(out.filter((h) => h.substitute !== true).map((h) => h.day));
    for (const d of own) if (own.has(d + 2) && !taken.has(d + 1)) out.push({ day: d + 1, name: rules.between });
  }
  return out.filter((h) => civilFromDays(h.day).year === year).sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
}

