import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { daysFromCivil } from '../../src/core/time/calendar.ts';
import { icuDay } from '../../tools/calendars/build.ts';
import { CALENDARS, compileCalendars, FROM, OUTPUT, serialize, TO, type CalendarDay } from '../../tools/calendars/compile.ts';
import { coverageOf } from '../../tools/holidays/build.ts';
import { holidaysCoverage, NO_PLACES, OUTPUT as COVERAGE, RECKONINGS, serializeCoverage, TESTS, TOLD } from '../../tools/holidays/coverage.ts';
import type { CountryRules } from '../../src/world/holidays/rules.ts';

const ROOT = join(import.meta.dirname, '../..');

describe('the calendar compiler', () => {
  it('reproduces the calendars the engine reads, byte for byte, from ICU', () => {
    expect(process.versions.icu).toBe('77.1');
    expect(serialize(compileCalendars(icuDay()))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
  }, 120_000);
  it('keeps the calendars of the holidays, 2000 to 2150', () => {
    expect(CALENDARS).toEqual(['islamic-umalqura', 'hebrew', 'chinese', 'dangi', 'persian', 'ethiopic']);
    expect([FROM, TO]).toEqual([daysFromCivil(2000, 1, 1), daysFromCivil(2150, 12, 31)]);
    expect(OUTPUT).toBe('src/world/holidays/calendars.json');
  });
  it("keeps each month's first day, and stops where a day doesn't follow the one before", () => {
    // A calendar of ten-day months counted from FROM.
    const tens = (_: string, days: number): CalendarDay => ({ year: '1', month: String(Math.floor((days - FROM) / 10)), day: ((days - FROM) % 10) + 1 });
    const c = compileCalendars(tens);
    expect(Object.keys(c)).toEqual([...CALENDARS]);
    expect(Object.entries(c.hebrew).slice(0, 2)).toEqual([['1/0', FROM], ['1/1', FROM + 10]]);
    expect(Object.keys(c.hebrew)).toHaveLength(Math.floor((TO - FROM) / 10) + 1);
    // Starting mid-month is fine; skipping a day, or a month not beginning on its first, is not.
    expect(() => compileCalendars((cal, days) => ({ ...tens(cal, days + 3) }))).not.toThrow();
    expect(() => compileCalendars((cal, days) => (days === FROM + 5 ? { year: '1', month: '0', day: 7 } : tens(cal, days)))).toThrow('islamic-umalqura: 2000-1-6 is day 7 of 1/0, after day 5 of 1/0');
    expect(() => compileCalendars((cal, days) => (days === FROM + 10 ? { year: '1', month: '1', day: 2 } : tens(cal, days)))).toThrow('islamic-umalqura: 2000-1-11 is day 2 of 1/1, after day 10 of 1/0');
    // The last day is walked too: a month beginning on it is kept.
    expect(compileCalendars((cal, days) => (days === TO ? { year: '2', month: 'x', day: 1 } : tens(cal, days))).ethiopic['2/x']).toBe(TO);
    // A month of eleven days, then ten-day months again, a day later.
    const longer = compileCalendars((cal, days) => (cal !== 'dangi' ? tens(cal, days) : days <= FROM + 10 ? { year: '1', month: '0', day: days - FROM + 1 } : tens(cal, days - 1)));
    expect(Object.entries(longer.dangi).slice(0, 2)).toEqual([['1/0', FROM], ['1/1', FROM + 11]]);
  }, 60_000);
  it('writes the calendars with the days they run from and to', () => {
    expect(serialize({ hebrew: { '1/1': 3 } } as never)).toBe(`{"from":${FROM},"to":${TO},"calendars":{"hebrew":{"1/1":3}}}\n`);
  });
});

describe('the holidays\' coverage', () => {
  it('is what the build writes from the rules, the gazetteer and the register', () => {
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(COVERAGE).toBe('coverage/holidays-countries.json');
  });
  it('cites a country\'s lists and the reckonings its rules stand on; else its blocker; else it is pending', () => {
    expect(RECKONINGS).toEqual({ lunar: 'R-0106', easter: 'R-0107', orthodox: 'R-0108', equinox: 'R-0036' });
    const rules: Record<string, CountryRules> = {
      AA: { holidays: [{ name: 'a', when: { fixed: [1, 1] } }] },
      BB: { holidays: [{ name: 'a', when: { easter: 1 } }, { name: 'b', when: { easter: 0, orthodox: true } }, { name: 'c', when: { lunar: ['hebrew', 'Nisan', 15] } }, { name: 'd', when: { equinox: [3, 540] } }] },
      CC: { holidays: [{ name: 'a', when: { nth: [4, 4, 1] }, shift: { easter: [-7, 1], plus: 7 } }] },
      DD: { holidays: [] },
    };
    const facts = new Map([
      ['world.holidays.AA', 'R-1'],
      ['world.holidays.BB', 'R-2'],
      ['world.holidays.CC', 'R-3'],
      ['world.holidays.blocked.DD', 'R-4'],
      ['world.holidays.blocked.EE', 'R-5'],
      ['world.holidays.FF', 'R-6'],
    ]);
    const rows = holidaysCoverage(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH'], new Set(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG']), rules, facts);
    expect(rows).toEqual([
      { key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'BB', status: 'researched', register: ['R-0036', 'R-0106', 'R-0107', 'R-0108', 'R-2'], tests: TESTS },
      { key: 'CC', status: 'researched', register: ['R-0107', 'R-3'], tests: TESTS },
      { key: 'DD', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'EE', status: 'blocked', register: ['R-5'], tests: [...TESTS, TOLD] },
      { key: 'FF', status: 'pending' },
      { key: 'GG', status: 'pending' },
      { key: 'HH', status: 'proven', tests: [NO_PLACES] },
    ]);
    expect(TESTS).toEqual([
      'tests/world/holidays/holidays.test.ts::the holidays of every country kept > are the days its official lists name, list by list',
      'tests/world/holidays/holidays.test.ts::the holidays > at every place on the map',
    ]);
    expect(TOLD).toBe("tests/world/holidays/holidays.test.ts::the holidays > tell the player where a country's aren't kept");
    expect(NO_PLACES).toBe('tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own');
    expect(serializeCoverage([{ key: 'HH', status: 'pending' }])).toBe('{\n "engine": "world.holidays",\n "axis": "country",\n "rows": [\n  {\n   "key": "HH",\n   "status": "pending"\n  }\n ]\n}\n');
  });
});
