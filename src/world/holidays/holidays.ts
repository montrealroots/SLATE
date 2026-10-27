import { civilFromDays } from '../../core/time/calendar.ts';
import { t } from '../../core/text/text.ts';
import { USNO_SEASONS } from '../clock/clock.ts';
import { countryName, type CountryCode } from '../gazetteer/gazetteer.ts';
import data from './countries.json' with { type: 'json' };
import { holidaysIn, type CountryRules, type Holiday } from './rules.ts';

/**
 * The holidays of every country kept (src/world/holidays/countries.json, each one's rules read from its law or its
 * government's list, R-0110 on): its national ones and, given a first-level region, that region's. The years kept are
 * the game's own, from its first (2026, the owner's start date) to 2100, the last the Naval Observatory gives the
 * equinoxes for (Japan's equinox days; the clock computes later ones, near enough for its seasons but not for a day).
 */
export const FIRST_YEAR = 2026;
export const LAST_YEAR = USNO_SEASONS.last;
const RULES = data as unknown as Record<string, CountryRules>;

/** Whether the game keeps a country's holidays. */
export const keepsHolidays = (country: CountryCode) => Object.hasOwn(RULES, country);

/** A country's holidays (and, given one, a region's) in a year, in order of day; none for a country not kept or a year outside the game's. */
export function holidaysOf(country: CountryCode, year: number, region?: string): Holiday[] {
  const rules = RULES[country];
  if (rules === undefined || year < FIRST_YEAR || year > LAST_YEAR) return [];
  return holidaysIn(rules, year, region);
}

/** The holiday a day is in a country (or a region of it), as a day off: none where it's an ordinary day or the holiday's day off moved. */
export function holidayOn(country: CountryCode, day: number, region?: string): Holiday | undefined {
  return holidaysOf(country, civilFromDays(day).year, region).find((h) => h.day === day && h.moved !== true);
}

export const UNANNOUNCED_LINE = 'holidays.unannounced';
export const UNKEPT_LINE = 'holidays.unkept';

/**
 * What the player is told about a country's holidays in a year: where the game doesn't keep them, that every day there
 * is an ordinary one; past the last year its government has announced (Spain's communities choose theirs year by
 * year), that only those its law fixes are kept. Nothing where they're all kept.
 */
export function aboutHolidays(country: CountryCode, year: number): string | undefined {
  const rules = RULES[country];
  if (rules === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  const last = rules.announcedTo;
  return last !== undefined && year > last ? t(UNANNOUNCED_LINE, { country: countryName(country), year: String(last) }) : undefined;
}

export const LOCAL_LINE = 'holidays.local';

/** What the player is told under a town's holidays: that a town's or a district's own aren't kept (KEEP entry 19's map stops at regions). */
export const aboutLocalHolidays = () => t(LOCAL_LINE);
