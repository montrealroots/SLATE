import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { civilFromDays, daysFromCivil } from '../../../src/core/time/calendar.ts';
import { isLine, t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES, isCountry, placesOf, regionName, type CountryCode } from '../../../src/world/gazetteer/gazetteer.ts';
import { CALENDAR_FROM, CALENDAR_TO, daysIn, monthIndex } from '../../../src/world/holidays/calendars.ts';
import {
  FIRST_YEAR,
  LAST_YEAR,
  LOCAL_LINE,
  REGION_UNKEPT_LINE,
  UNANNOUNCED_LINE,
  UNKEPT_LINE,
  aboutHolidays,
  aboutLocalHolidays,
  holidayOn,
  holidaysOf,
  keepsHolidays,
  type Kept,
} from '../../../src/world/holidays/holidays.ts';
import { daysOf, easter, holidaysIn, julianToDays, type CountryRules, type Rule, type Substitute } from '../../../src/world/holidays/rules.ts';
import rules from '../../../src/world/holidays/countries.json';
import compiled from '../../../src/world/holidays/calendars.json';

const ROOT = join(import.meta.dirname, '../../..');
const iso = (d: number) => {
  const c = civilFromDays(d);
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
};
const day = (s: string) => daysFromCivil(Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10)));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "April 5" or "Apr 12" in a year, as days from 1970-01-01. */
const dated = (year: number, text: string) => {
  const [m, d] = text.split(' ') as [string, string];
  return daysFromCivil(year, MONTHS.findIndex((n) => n.startsWith(m)) + 1, Number(d));
};

interface Lists {
  country: string;
  lists: { regions?: string[]; year: number; days: [string, string][] }[];
}
const LISTS: Lists[] = readdirSync(join(ROOT, 'research/sources/holidays'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'research/sources/holidays', f), 'utf8')) as Lists);
const RULES = rules as unknown as Record<string, Kept>;

describe('the holidays of every country kept', () => {
  it('are the days its official lists name, list by list', () => {
    let read = 0;
    for (const { country, lists } of LISTS) {
      for (const list of lists) {
        for (const region of list.regions ?? [undefined]) {
          const kept = holidaysOf(country as CountryCode, list.year, region).filter((h) => h.moved !== true);
          expect(kept.map((h) => iso(h.day)).sort(), `${country} ${region ?? ''} ${list.year}`).toEqual(list.days.map(([d]) => d).sort());
          read += 1;
        }
      }
    }
    expect(read).toBe(319);
  });
  it('are each a country of the map with its lists, their regions its own, their substitutes the engine reckons', () => {
    expect(Object.keys(RULES).sort()).toEqual(LISTS.map((l) => l.country).sort());
    for (const [country, r] of Object.entries(RULES)) {
      expect(isCountry(country) && keepsHolidays(country), country).toBe(true);
      if ('of' in r) {
        // A country keeping another's keeps that one's days, which has its own rules and no regions of its own to name.
        expect(RULES[r.of] !== undefined && 'holidays' in (RULES[r.of] as Kept), country).toBe(true);
        expect(holidaysOf(country as CountryCode, 2026)).toEqual(holidaysOf(r.of as CountryCode, 2026));
        continue;
      }
      for (const region of [...r.holidays.flatMap((h) => h.regions ?? []), ...(r.regional ?? [])]) expect(region.startsWith(`${country}.`) && regionName(region) !== undefined, region).toBe(true);
      // A substitute goes to the next day or the one before, from days of the week: the JSON isn't held to the type.
      // It must leave some weekday to land on, or the search for its day never ends (its skip is its own days unless given).
      for (const s of [...(r.substitute ?? []), ...r.holidays.flatMap((h) => h.move ?? [])]) {
        expect(['next', 'previous'].includes(s.to) && [s.on, s.skip ?? []].every((ds) => ds.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)), country).toBe(true);
        expect(new Set(s.skip ?? s.on).size < 7, country).toBe(true);
      }
    }
    expect(keepsHolidays('AQ')).toBe(false);
  });
  it('are named each, in order of day, within the year asked', () => {
    for (const country of Object.keys(RULES) as CountryCode[]) {
      for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
        const hs = holidaysOf(country, year);
        expect(hs.every((h, i) => h.name !== '' && civilFromDays(h.day).year === year && (i === 0 || (hs[i - 1] as { day: number }).day <= h.day)), `${country} ${year}`).toBe(true);
      }
    }
  });
});

describe('the reckonings', () => {
  const easters = JSON.parse(readFileSync(join(ROOT, 'research/sources/easter.json'), 'utf8')) as { western: Record<string, string>; orthodox: Record<string, string> };
  it("put Easter where the Naval Observatory does, every year from 2000 to 2150", () => {
    expect(Object.keys(easters.western)).toHaveLength(151);
    for (const [year, text] of Object.entries(easters.western)) expect(easter(Number(year)), year).toBe(dated(Number(year), text));
  });
  it("put Orthodox Easter where the Diocese does, every year from 2000 to 2037", () => {
    expect(Object.keys(easters.orthodox)).toHaveLength(38);
    for (const [year, text] of Object.entries(easters.orthodox)) expect(easter(Number(year), true), year).toBe(dated(Number(year), text));
  });
  it('put Easter where the anonymous Gregorian computus (Meeus, Jones, Butcher) does, every year from 1583 to 9999', () => {
    for (let year = 1583; year <= 9999; year += 1) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
      const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      expect(easter(year), String(year)).toBe(daysFromCivil(year, month, ((h + l - 7 * m + 114) % 31) + 1));
    }
  });
  it('carry a Julian date to the Gregorian calendar', () => {
    expect([julianToDays(2026, 4, 12), julianToDays(2000, 1, 1), julianToDays(2100, 2, 29), julianToDays(2026, 12, 25)].map(iso)).toEqual(['2026-04-25', '2000-01-14', '2100-03-14', '2027-01-07']);
  });
  it('find a day of a month of another calendar in a Gregorian year', () => {
    expect(daysIn('islamic-umalqura', '10', 1, 2026).map(iso)).toEqual(['2026-03-20']);
    expect(daysIn('islamic-umalqura', '10', 1, 2033).map(iso)).toEqual(['2033-01-03', '2033-12-23']);
    expect(daysIn('islamic-umalqura', '9', 29, 2026).map(iso)).toEqual(['2026-03-18']);
    expect(daysIn('islamic-umalqura', '9', 30, 2026).map(iso)).toEqual(['2026-03-19']);
    expect(daysIn('islamic-umalqura', '8', 30, 2026)).toEqual([]);
    expect(daysIn('islamic-umalqura', '8', 29, 2026).map(iso)).toEqual(['2026-02-17']);
    expect(daysIn('islamic-umalqura', '10', 0, 2026)).toEqual([]);
    expect(daysIn('hebrew', 'Tishri', 1, 2026).map(iso)).toEqual(['2026-09-12']);
    expect(daysIn('hebrew', 'Adar II', 14, 2027).map(iso)).toEqual(['2027-03-23']);
    expect(daysIn('chinese', '1', 1, 2026).map(iso)).toEqual(['2026-02-17']);
    expect(daysIn('dangi', '1', 1, 2026).map(iso)).toEqual(['2026-02-17']);
    expect(daysIn('persian', '1', 1, 2026).map(iso)).toEqual(['2026-03-21']);
    expect(daysIn('ethiopic', '1', 1, 2026).map(iso)).toEqual(['2026-09-11']);
    expect(() => daysIn('chinese', '13', 1, 2026)).toThrow(new RangeError('the chinese calendar has no month 13'));
  });
  it("index a calendar's months by name, each to the day before the next's first, the last to the table's end", () => {
    expect(monthIndex({ '1/a': 10, '1/b': 20, '2/a': 30 }, 39)).toEqual(
      new Map([
        ['a', [{ first: 10, last: 19 }, { first: 30, last: 39 }]],
        ['b', [{ first: 20, last: 29 }]],
      ]),
    );
  });
  it('end the last month compiled where the table ends', () => {
    expect([CALENDAR_FROM, CALENDAR_TO].map(iso)).toEqual(['2000-01-01', '2100-12-31']);
    expect(daysIn('islamic-umalqura', '1', 1, 1999)).toEqual([]);
    const lastFirst = Math.max(...Object.values(compiled.calendars.ethiopic));
    const [key] = Object.entries(compiled.calendars.ethiopic).find(([, d]) => d === lastFirst) as [string, number];
    const month = key.split('/')[1] as string;
    const length = CALENDAR_TO - lastFirst + 1;
    expect(daysIn('ethiopic', month, length, 2100).map(iso)).toEqual(['2100-12-31']);
    // The same month a year before reaches into 2100 by that day; this year's doesn't reach past the table.
    expect(daysIn('ethiopic', month, length + 1, 2100).every((d) => d < lastFirst)).toBe(true);
  });
  it("give the day of an equinox at an offset from Universal Time, the clock's", () => {
    // 2026's March equinox is 14:46 UT, its September 00:05 on the 23rd (the Naval Observatory's, R-0036).
    expect(daysOf({ equinox: [3, 540] }, 2026).map(iso)).toEqual(['2026-03-20']);
    expect(daysOf({ equinox: [3, 554] }, 2026).map(iso)).toEqual(['2026-03-21']);
    expect(daysOf({ equinox: [3, 553] }, 2026).map(iso)).toEqual(['2026-03-20']);
    expect(daysOf({ equinox: [9, 540] }, 2026).map(iso)).toEqual(['2026-09-23']);
    expect(daysOf({ equinox: [9, -5] }, 2026).map(iso)).toEqual(['2026-09-23']);
    expect(daysOf({ equinox: [9, -6] }, 2026).map(iso)).toEqual(['2026-09-22']);
    expect(daysOf({ equinox: [3, 540] }, 2100).map(iso)[0]?.slice(0, 7)).toBe('2100-03');
  });
});

describe('a rule', () => {
  const r = (over: Partial<Rule> & Pick<Rule, 'when'>): Rule => ({ name: 'H', ...over });
  const one = (rule: Rule, year = 2026, region?: string) => holidaysIn({ holidays: [rule] }, year, region).map((h) => iso(h.day));
  it('gives its day by each kind of reckoning', () => {
    expect(daysOf({ fixed: [7, 14] }, 2026).map(iso)).toEqual(['2026-07-14']);
    expect(daysOf({ easter: -2 }, 2026).map(iso)).toEqual(['2026-04-03']);
    expect(daysOf({ easter: 1, orthodox: true }, 2026).map(iso)).toEqual(['2026-04-13']);
    expect(daysOf({ nth: [5, 1, 1] }, 2026).map(iso)).toEqual(['2026-05-04']);
    expect(daysOf({ nth: [11, 4, 4] }, 2026).map(iso)).toEqual(['2026-11-26']);
    expect(daysOf({ nth: [5, 1, -1] }, 2026).map(iso)).toEqual(['2026-05-25']);
    expect(daysOf({ after: [6, 20, 6] }, 2026).map(iso)).toEqual(['2026-06-20']);
    expect(daysOf({ after: [6, 21, 6] }, 2026).map(iso)).toEqual(['2026-06-27']);
    expect(daysOf({ before: [5, 24, 1] }, 2026).map(iso)).toEqual(['2026-05-18']);
    expect(daysOf({ before: [5, 25, 1] }, 2026).map(iso)).toEqual(['2026-05-25']);
    expect(daysOf({ lunar: ['islamic-umalqura', '12', 10] }, 2026).map(iso)).toEqual(['2026-05-27']);
    expect(daysOf({ dates: ['2026-06-15', '2027-06-14', '2025-12-31'] }, 2026).map(iso)).toEqual(['2026-06-15']);
  });
  it('holds in its years and regions, and moves by its own terms', () => {
    expect(one(r({ when: { fixed: [1, 2] }, plus: 1 }))).toEqual(['2026-01-03']);
    expect([one(r({ when: { fixed: [1, 2] }, from: 2027 })), one(r({ when: { fixed: [1, 2] }, from: 2026 }))]).toEqual([[], ['2026-01-02']]);
    expect([one(r({ when: { fixed: [1, 2] }, until: 2025 })), one(r({ when: { fixed: [1, 2] }, until: 2026 }))]).toEqual([[], ['2026-01-02']]);
    expect([one(r({ when: { fixed: [1, 2] }, except: [2026] })), one(r({ when: { fixed: [1, 2] }, except: [2027] }))]).toEqual([[], ['2026-01-02']]);
    const regional = r({ when: { fixed: [1, 2] }, regions: ['GB.SCT'] });
    expect([one(regional), one(regional, 2026, 'GB.ENG'), one(regional, 2026, 'GB.SCT')]).toEqual([[], [], ['2026-01-02']]);
    // Ireland's February holiday: the first Monday, or the 1st when it's a Friday (2030's).
    const brigid = r({ when: { nth: [2, 1, 1] }, instead: { on: [2, 1], weekday: 5 } });
    expect([one(brigid), one(brigid, 2030)]).toEqual([['2026-02-02'], ['2030-02-01']]);
    // Held only when 1 January is a Sunday (2023), or not when Christmas is a Monday or a Friday (2026's is a Friday).
    const second = r({ when: { fixed: [1, 2] }, when_: { on: [1, 1], weekdays: [0] } });
    expect([one(second), one(second, 2028), one(second, 2034)]).toEqual([[], [], ['2034-01-02']]);
    const stephen = r({ when: { fixed: [12, 26] }, when_: { on: [12, 25], weekdays: [1, 5], not: true } });
    expect([one(stephen), one(stephen, 2027)]).toEqual([[], ['2027-12-26']]);
    // Glarus' Näfelser Fahrt, the first Thursday of April, a week later when it falls from Palm Sunday to Easter Monday
    // (2026's 2 April, Maundy Thursday); 2027's and 2029's are after Easter Monday.
    const fahrt = r({ when: { nth: [4, 4, 1] }, shift: { easter: [-7, 1], plus: 7 } });
    expect([one(fahrt), one(fahrt, 2027), one(fahrt, 2029)]).toEqual([['2026-04-09'], ['2027-04-01'], ['2029-04-05']]);
    expect(one(r({ when: { nth: [4, 4, 1] }, shift: { easter: [-7, -3], plus: 7 } }))).toEqual(['2026-04-09']);
    expect(one(r({ when: { nth: [4, 4, 1] }, shift: { easter: [-2, 1], plus: 7 } }))).toEqual(['2026-04-02']);
    expect(one(r({ when: { nth: [4, 4, 1] }, shift: { easter: [-6, -4], plus: 7 } }))).toEqual(['2026-04-02']);
    expect(one(r({ when: { nth: [4, 4, 1] }, shift: { easter: [-3, 1], plus: 7 } }))).toEqual(['2026-04-09']);
  });
  it("is moved off the country's weekdays to the first day free (or shared), unless it's fixed or has its own", () => {
    // 2026-12-26 is a Saturday, 2026-12-27 a Sunday; 2027-12-25 a Saturday, 2027-12-26 a Sunday.
    const weekend: Substitute = { on: [6, 0], to: 'next' };
    const christmas = (over: Partial<Rule> = {}): Rule[] => [r({ name: 'Christmas', when: { fixed: [12, 25] }, ...over }), r({ name: 'Boxing', when: { fixed: [12, 26] } })];
    const at = (rs: CountryRules, year: number) => holidaysIn(rs, year).map((h) => `${iso(h.day)} ${h.name}${h.substitute === true ? ' (instead)' : ''}${h.moved === true ? ' (moved)' : ''}`);
    expect(at({ holidays: christmas(), substitute: [weekend] }, 2027)).toEqual(['2027-12-25 Christmas (moved)', '2027-12-26 Boxing (moved)', '2027-12-27 Christmas (instead)', '2027-12-28 Boxing (instead)']);
    expect(at({ holidays: christmas({ fixed: true }), substitute: [weekend] }, 2027)).toEqual(['2027-12-25 Christmas', '2027-12-26 Boxing (moved)', '2027-12-27 Boxing (instead)']);
    expect(at({ holidays: christmas(), substitute: [{ on: [0], to: 'next', as: 'well' }] }, 2027)).toEqual(['2027-12-25 Christmas', '2027-12-26 Boxing', '2027-12-27 Boxing (instead)']);
    expect(at({ holidays: christmas({ move: [{ on: [6], to: 'previous' }] }) }, 2027)).toEqual(['2027-12-24 Christmas (instead)', '2027-12-25 Christmas (moved)', '2027-12-26 Boxing']);
    expect(at({ holidays: christmas({ move: [{ on: [6], to: 'previous' }] }), substitute: [{ on: [0], to: 'next' }] }, 2027)).toEqual(['2027-12-24 Christmas (instead)', '2027-12-25 Christmas (moved)', '2027-12-26 Boxing (moved)', '2027-12-27 Boxing (instead)']);
    // In order of the days they stand for, whatever the order of the rules.
    expect(at({ holidays: christmas().reverse(), substitute: [weekend] }, 2027)).toEqual(['2027-12-25 Christmas (moved)', '2027-12-26 Boxing (moved)', '2027-12-27 Christmas (instead)', '2027-12-28 Boxing (instead)']);
    expect(at({ holidays: christmas(), substitute: [weekend] }, 2026)).toEqual(['2026-12-25 Christmas', '2026-12-26 Boxing (moved)', '2026-12-28 Boxing (instead)']);
    // A substitute that falls in the next year isn't this year's: 2028-12-31 is a Sunday.
    expect(at({ holidays: [r({ name: 'Eve', when: { fixed: [12, 31] } })], substitute: [weekend] }, 2028)).toEqual(['2028-12-31 Eve (moved)']);
    expect(at({ holidays: [r({ name: 'Eve', when: { fixed: [12, 31] } })], substitute: [{ on: [0], to: 'previous' }] }, 2028)).toEqual(['2028-12-30 Eve (instead)', '2028-12-31 Eve (moved)']);
    // Onto another holiday's day, where each is kept by its own date: 2026-06-20 is a Saturday, its Friday a holiday too.
    const june = (shared?: true): CountryRules => ({ holidays: [r({ name: 'A', when: { fixed: [6, 19] } }), r({ name: 'B', when: { fixed: [6, 20] } })], substitute: [{ on: [6, 0], to: 'previous', ...(shared && { shared }) }] });
    expect(at(june(true), 2026)).toEqual(['2026-06-19 A', '2026-06-19 B (instead)', '2026-06-20 B (moved)']);
    expect(at(june(), 2026)).toEqual(['2026-06-18 B (instead)', '2026-06-19 A', '2026-06-20 B (moved)']);
    // Over another's day on a weekday, the later rule's off the next free day as well; one alone isn't. 2026-05-05 is a Tuesday.
    const weekdays: Substitute = { on: [1, 2, 3, 4, 5], to: 'next', as: 'well', over: true, skip: [6, 0] };
    const may = (...days: number[]): CountryRules => ({ holidays: days.map((d, i) => r({ name: 'AB'[i] as string, when: { fixed: [5, d] } })), substitute: [{ on: [6, 0], to: 'next', as: 'well' }, weekdays] });
    expect(at(may(5, 5), 2026)).toEqual(['2026-05-05 A', '2026-05-05 B', '2026-05-06 B (instead)']);
    expect(at(may(5, 6), 2026)).toEqual(['2026-05-05 A', '2026-05-06 B']);
    // Passing over weekdays besides those it's for: 2026-03-01 is a Sunday, the Saturday before passed over too.
    const sunday = (skip?: number[]): CountryRules => ({ holidays: [r({ name: 'A', when: { fixed: [3, 1] } })], substitute: [{ on: [0], to: 'previous', ...(skip && { skip }) }] });
    expect(at(sunday([6, 0]), 2026)).toEqual(['2026-02-27 A (instead)', '2026-03-01 A (moved)']);
    expect(at(sunday(), 2026)).toEqual(['2026-02-28 A (instead)', '2026-03-01 A (moved)']);
  });
  it("makes a day between two holidays one too, by the country's name for it", () => {
    const hs: Rule[] = [r({ name: 'A', when: { fixed: [9, 21] } }), r({ name: 'B', when: { fixed: [9, 23] } }), r({ name: 'C', when: { fixed: [9, 25] } })];
    expect(holidaysIn({ holidays: hs, between: 'Between' }, 2026).map((h) => `${iso(h.day)} ${h.name}`)).toEqual(['2026-09-21 A', '2026-09-22 Between', '2026-09-23 B', '2026-09-24 Between', '2026-09-25 C']);
    expect(holidaysIn({ holidays: hs }, 2026)).toHaveLength(3);
    // Not where the day is already off, nor between a holiday and a substitute: 2027-09-25 is a Saturday.
    const subbed: CountryRules = { holidays: [r({ name: 'A', when: { fixed: [9, 25] } }), r({ name: 'B', when: { fixed: [9, 28] } })], substitute: [{ on: [6, 0], to: 'next' }], between: 'Between' };
    expect(holidaysIn(subbed, 2027).map((h) => `${iso(h.day)} ${h.name}`)).toEqual(['2027-09-25 A', '2027-09-27 A', '2027-09-28 B']);
    const taken: CountryRules = { holidays: [r({ name: 'A', when: { fixed: [9, 21] } }), r({ name: 'B', when: { fixed: [9, 22] } }), r({ name: 'C', when: { fixed: [9, 23] } })], between: 'Between' };
    expect(holidaysIn(taken, 2026).map((h) => h.name)).toEqual(['A', 'B', 'C']);
  });
  it("keeps a region's own days in place of the country's, where the region keeps its own law's", () => {
    // 2026-01-01 is a Thursday. Each day is moved by its own rule, though two have one name.
    const ca: CountryRules = { regional: ['XX.01', 'XX.03'], holidays: [r({ name: 'A', when: { fixed: [1, 1] } }), r({ name: 'A', when: { fixed: [1, 1] }, regions: ['XX.01'], move: [{ on: [4], to: 'next' }] }), r({ name: 'B', when: { fixed: [3, 1] }, regions: ['XX.01'] })] };
    const at = (rs: CountryRules, region?: string) => holidaysIn(rs, 2026, region).map((h) => `${iso(h.day)} ${h.name}${h.substitute === true ? ' (instead)' : ''}${h.moved === true ? ' (moved)' : ''}`);
    expect(at(ca)).toEqual(['2026-01-01 A']);
    expect(at(ca, 'XX.01')).toEqual(['2026-01-01 A (moved)', '2026-01-02 A (instead)', '2026-03-01 B']);
    // A region not among them keeps the country's; one among them with none of its own, none.
    expect(at(ca, 'XX.02')).toEqual(['2026-01-01 A']);
    expect(at(ca, 'XX.03')).toEqual([]);
    expect(at({ holidays: ca.holidays }, 'XX.01')).toEqual(['2026-01-01 A', '2026-01-01 A (moved)', '2026-01-02 A (instead)', '2026-03-01 B']);
    expect(at({ holidays: ca.holidays }, 'XX.02')).toEqual(['2026-01-01 A']);
  });
  it('holds every so many years, counted from a year it holds in', () => {
    const election = r({ when: { after: [11, 2, 2] }, cycle: [2, 2026] });
    expect([one(election), one(election, 2027), one(election, 2028), one(election, 2025)]).toEqual([['2026-11-03'], [], ['2028-11-07'], []]);
    expect(one(r({ when: { fixed: [1, 2] }, cycle: [3, 2026] }), 2029)).toEqual(['2029-01-02']);
    expect(one(r({ when: { fixed: [1, 2] }, cycle: [3, 2026] }), 2028)).toEqual([]);
  });
  it('takes a substitute across the year: a Saturday 1 January kept on the 31 December before, a 31 December Sunday on the 1 January after', () => {
    // 2022-01-01 and 2028-01-01 are Saturdays; 2028-12-31 a Sunday.
    const us: CountryRules = { holidays: [r({ name: 'New Year', when: { fixed: [1, 1] } })], substitute: [{ on: [6], to: 'previous' }, { on: [0], to: 'next' }] };
    expect(holidaysIn(us, 2021).map((h) => `${iso(h.day)}${h.substitute === true ? ' (instead)' : ''}`)).toEqual(['2021-01-01', '2021-12-31 (instead)']);
    expect(holidaysIn(us, 2022).map((h) => `${iso(h.day)}${h.moved === true ? ' (moved)' : ''}`)).toEqual(['2022-01-01 (moved)']);
    const eve: CountryRules = { holidays: [r({ name: 'Eve', when: { fixed: [12, 31] } })], substitute: [{ on: [0], to: 'next' }] };
    expect(holidaysIn(eve, 2029).map((h) => `${iso(h.day)} ${h.name}${h.substitute === true ? ' (instead)' : ''}`)).toEqual(['2029-01-01 Eve (instead)', '2029-12-31 Eve']);
    // And a day after a holiday at the year's end lands in the next.
    expect(one(r({ when: { fixed: [12, 31] }, plus: 1 }))).toEqual(['2026-01-01']);
  });
  it('orders two holidays on one day by name', () => {
    expect(holidaysIn({ holidays: [r({ name: 'B', when: { fixed: [5, 1] } }), r({ name: 'A', when: { fixed: [5, 1] } })] }, 2026).map((h) => h.name)).toEqual(['A', 'B']);
  });
});

/** The days of the whole kingdom, which every part of it keeps (2026's Boxing Day, a Saturday, taken on the Monday). */
const NATIONAL_GB = ['New Year’s Day', 'Good Friday', 'Early May bank holiday', 'Spring bank holiday', 'Christmas Day', 'Boxing Day', 'Boxing Day'];

describe('the holidays', () => {
  it('at every place on the map', async () => {
    let read = 0;
    const seen = new Map<string, string>();
    for (const code of COUNTRY_CODES) {
      for (const p of await placesOf(code)) {
        const key = `${p.country} ${p.region}`;
        if (!seen.has(key)) {
          const hs = holidaysOf(p.country, 2026, p.region === '' ? undefined : p.region);
          // Ukraine's martial law makes 2026 a year without days off (its law's come back after): its rules still give days.
          const none = p.country === 'UA';
          expect(keepsHolidays(p.country) && !none ? hs.length > 0 : hs.length === 0, key).toBe(true);
          if (none) expect(holidaysOf(p.country, 2027).length, key).toBeGreaterThan(0);
          expect(hs.every((h) => civilFromDays(h.day).year === 2026), key).toBe(true);
          expect(aboutHolidays(p.country, 2026) === undefined, key).toBe(keepsHolidays(p.country));
          seen.set(key, hs.map((h) => h.name).join());
        }
        read += 1;
      }
    }
    expect(read).toBe(171_654);
    // Each region of a country with regional holidays keeps its own and the country's.
    expect(seen.get('CH CH.ZH')).not.toBe(seen.get('CH CH.TI'));
  }, 300_000);
  it('keep a region of its own as the country does, and its own days besides', () => {
    expect(holidaysOf('GB', 2026, 'GB.SCT').map((h) => iso(h.day))).toContain('2026-11-30');
    expect(holidaysOf('GB', 2026, 'GB.ENG').map((h) => iso(h.day))).not.toContain('2026-11-30');
    expect(holidaysOf('GB', 2026).map((h) => h.name)).toEqual(NATIONAL_GB);
  });
  it("are the game's years only, from its first to the last the Naval Observatory gives the equinoxes for", () => {
    expect([FIRST_YEAR, LAST_YEAR]).toEqual([2026, 2100]);
    expect(holidaysOf('FR', 2025)).toEqual([]);
    expect(holidaysOf('FR', 2101)).toEqual([]);
    expect(holidaysOf('FR', 2026).length).toBeGreaterThan(0);
    expect(holidaysOf('JP', 2100).map((h) => h.name)).toContain('Vernal Equinox Day');
    expect(holidaysOf('AQ', 2026)).toEqual([]);
  });
  it("give the holiday a day is, where it's off: none where its day off moved", () => {
    expect(holidayOn('GB', day('2026-12-25'), 'GB.ENG')?.name).toBe('Christmas Day');
    expect(holidayOn('GB', day('2026-12-26'), 'GB.ENG')).toBeUndefined();
    expect(holidayOn('GB', day('2026-12-28'), 'GB.ENG')).toEqual({ day: day('2026-12-28'), name: 'Boxing Day', substitute: true });
    expect(holidayOn('GB', day('2026-12-29'), 'GB.ENG')).toBeUndefined();
    expect(holidayOn('GB', day('2026-11-30'), 'GB.SCT')?.name).toBe('St Andrew’s Day');
    expect(holidayOn('GB', day('2026-11-30'))).toBeUndefined();
    expect(holidayOn('JP', day('2026-09-22'))?.name).toBe('Citizens’ Holiday');
  });
  it("tell the player where a country's aren't kept", () => {
    expect(UNKEPT_LINE).toBe('holidays.unkept');
    expect(aboutHolidays('AQ', 2026)).toBe(t(UNKEPT_LINE, { country: 'Antarctica' }));
    expect(aboutHolidays('AQ', 2026)).toBe("Antarctica's public holidays aren't on this calendar, so every day there is kept as an ordinary one.");
  });
  it('tell the player where only the law\'s are kept, past the last year announced', () => {
    expect(UNANNOUNCED_LINE).toBe('holidays.unannounced');
    expect(aboutHolidays('ES', 2027)).toBeUndefined();
    expect(aboutHolidays('ES', 2028)).toBe(t(UNANNOUNCED_LINE, { place: 'Spain', year: '2027' }));
    expect(aboutHolidays('ES', 2028)).toBe("Spain hasn't announced its holidays after 2027 yet, so the calendar keeps only those its law fixes.");
    expect(aboutHolidays('FR', 2100)).toBeUndefined();
    expect(aboutHolidays('ES', 2028, 'ES.51')).toBe(t(UNANNOUNCED_LINE, { place: 'Spain', year: '2027' }));
    // A region whose own are set year by year is told by its own name and year; the country's others by the country's.
    expect(aboutHolidays('US', 2028, 'US.GA')).toBe("Georgia hasn't announced its holidays after 2027 yet, so the calendar keeps only those its law fixes.");
    expect(aboutHolidays('US', 2027, 'US.GA')).toBeUndefined();
    expect(aboutHolidays('US', 2028, 'US.CA')).toBeUndefined();
    expect(aboutHolidays('US', 2028)).toBeUndefined();
  });
  it("tell the player where a region's own aren't kept", () => {
    expect(REGION_UNKEPT_LINE).toBe('holidays.region-unkept');
    // Prince Edward Island's own aren't read (the register's blocker), so it keeps Canada's; Quebec keeps its own law's.
    expect(aboutHolidays('CA', 2026, 'CA.09')).toBe(t(REGION_UNKEPT_LINE, { region: 'Prince Edward Island', country: 'Canada' }));
    expect(aboutHolidays('CA', 2026, 'CA.09')).toBe("Prince Edward Island's own holidays aren't on this calendar yet, so it keeps Canada's national ones.");
    expect(holidaysOf('CA', 2026, 'CA.09')).toEqual(holidaysOf('CA', 2026));
    expect(aboutHolidays('CA', 2026, 'CA.10')).toBeUndefined();
    expect(aboutHolidays('CA', 2026)).toBeUndefined();
    expect(aboutHolidays('US', 2026, 'US.CA')).toBeUndefined();
    expect(isLine(REGION_UNKEPT_LINE)).toBe(true);
  });
  it("tell the player a town's own aren't kept", () => {
    expect(LOCAL_LINE).toBe('holidays.local');
    expect([UNKEPT_LINE, UNANNOUNCED_LINE, LOCAL_LINE].every(isLine)).toBe(true);
    expect(aboutLocalHolidays()).toBe(t(LOCAL_LINE));
  });
});
