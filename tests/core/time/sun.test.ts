import { describe, expect, it } from 'vitest';
import usno from '../../../research/sources/usno-sun.json';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  daylight,
  eccentricityEarthOrbit,
  equationOfTime,
  geomMeanAnomalySun,
  geomMeanLongSun,
  hourAngleArg,
  julianCentury,
  julianDay,
  meanObliquityOfEcliptic,
  obliquityCorrection,
  sunApparentLong,
  sunDeclination,
  sunEqOfCenter,
  sunEventUT,
} from '../../../src/core/time/sun.ts';
import { LATITUDES } from '../../../tools/research/usno-sun.ts';

/**
 * The sun against the U.S. Naval Observatory (research/sources/usno-sun.json; register R-0006 to R-0023): for every
 * band of latitude, every sunrise and sunset USNO gives, within NOAA's own stated accuracy (a minute between 72°N and
 * 72°S, ten minutes beyond) plus USNO's rounding to the minute; and the same polar days and nights.
 */
const day = (iso: string) => daysFromCivil(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))) * 86_400;

describe('the sun, against the U.S. Naval Observatory', () => {
  it('holds the observations for every band and date', () => {
    expect(usno.observations).toHaveLength(108);
    expect(new Set(usno.observations.map((o) => o.latitude))).toEqual(new Set(LATITUDES));
  });
  it.each(LATITUDES.map((l) => [String(l)]))('latitude band %s°', (band) => {
    for (const o of usno.observations.filter((x) => x.latitude === Number(band))) {
      const start = day(o.date);
      const mine = daylight(start, start + 86_400, o.latitude, o.longitude);
      const tolerance = (Math.abs(o.latitude) <= 72 ? 1 : 10) * 60 + 30;
      const at = (phen: string) => {
        const t = o.sundata.find((s) => s.phen === phen)?.time;
        return t === undefined || t === null ? undefined : start + Number(t.slice(0, 2)) * 3600 + Number(t.slice(3, 5)) * 60;
      };
      for (const [phen, got] of [['Rise', mine.sunrise], ['Set', mine.sunset]] as const) {
        const want = at(phen);
        expect(got === undefined, `${o.url}: ${phen}`).toBe(want === undefined);
        if (want !== undefined && got !== undefined) expect(Math.abs(got - want), `${o.url}: ${phen}`).toBeLessThanOrEqual(tolerance);
      }
      const polar = o.sundata.some((s) => s.phen === 'Object continuously above the Horizon') ? 'up' : o.sundata.some((s) => s.phen === 'Object continuously below the Horizon') ? 'down' : undefined;
      expect(mine.polar, o.url).toBe(polar);
    }
  });
});

describe('the formulas, against NOAA\'s own computed values', () => {
  // NOAA_Solar_Calculations_day.xls as NOAA publishes it, read to plain values (research/sources/sun/; register R-0004):
  // every six minutes of 2010-06-21 at 40°N 105°W, each quantity of the chain from the row's Julian century.
  const csv = readFileSync(join(import.meta.dirname, '../../../research/sources/sun/noaa-solar-calculations-day-2010-06-21.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const columns: [number, string, (t: number) => number][] = [
    [8, 'geom mean long sun', geomMeanLongSun],
    [9, 'geom mean anomaly sun', geomMeanAnomalySun],
    [10, 'eccentricity of the earth\'s orbit', eccentricityEarthOrbit],
    [11, 'sun\'s equation of centre', sunEqOfCenter],
    [15, 'sun\'s apparent longitude', sunApparentLong],
    [16, 'mean obliquity of the ecliptic', meanObliquityOfEcliptic],
    [17, 'obliquity corrected', obliquityCorrection],
    [19, 'sun\'s declination', sunDeclination],
    [21, 'equation of time', equationOfTime],
    [22, 'hour angle at sunrise', (t) => (Math.acos(hourAngleArg(40, sunDeclination(t))) * 180) / Math.PI],
  ];
  it('holds the day\'s 240 rows', () => {
    expect(csv).toHaveLength(240);
  });
  it.each(columns.map(([c, name]) => [name, c]))('%s, every row, to one part in a hundred billion', (_name, column) => {
    const f = (columns.find(([c]) => c === column) as (typeof columns)[number])[2];
    for (const row of csv) {
      const t = Number(row[6]);
      const want = Number(row[column]);
      expect(Math.abs(f(t) - want) / Math.max(1, Math.abs(want))).toBeLessThan(1e-11);
    }
  });
  it('the Julian century from the Julian day, as the sheet counts it', () => {
    for (const row of csv) expect(julianCentury(Number(row[5]))).toBeCloseTo(Number(row[6]), 12);
  });
});

describe('the formulas', () => {
  it('count Julian days from the epoch', () => {
    expect(julianDay(0)).toBe(2_440_587.5);
    expect(julianDay(day('2000-01-01') + 43_200)).toBe(2_451_545);
  });
  it('give the sun\'s declination and the equation of time as the almanac knows them', () => {
    // J2000.0 and the 2026 June solstice: the declination is about -23° in early January and +23.44° at the solstice;
    // the equation of time is about -3 minutes on 1 January and +16.4 minutes in early November.
    const century = (iso: string) => (julianDay(day(iso) + 43_200) - 2_451_545) / 36_525;
    expect(sunDeclination(century('2000-01-01'))).toBeCloseTo(-23.03, 1);
    expect(sunDeclination(century('2026-06-21'))).toBeCloseTo(23.44, 1);
    expect(equationOfTime(century('2000-01-01'))).toBeCloseTo(-3.3, 0);
    expect(equationOfTime(century('2026-11-03'))).toBeCloseTo(16.4, 0);
  });
  it('find where the sun crosses the horizon, and where it does not', () => {
    expect(hourAngleArg(0, 0)).toBeCloseTo(-0.01454, 4);
    expect(hourAngleArg(80, 23)).toBeLessThan(-1);
    expect(hourAngleArg(80, -23)).toBeGreaterThan(1);
  });
  it('name the polar day and night for a UT day, and a sunrise or sunset otherwise', () => {
    expect(sunEventUT(day('2026-06-21'), 80, 15, true)).toEqual({ kind: 'up' });
    expect(sunEventUT(day('2026-12-21'), 80, 15, false)).toEqual({ kind: 'down' });
    // The first reckoning finds a sunrise; the second, with the sun where it is by then, finds it doesn't rise.
    expect(sunEventUT(day('2026-12-09'), 68, 15, true)).toEqual({ kind: 'down' });
    const rise = sunEventUT(day('2026-06-21'), 0, 0, true);
    const set = sunEventUT(day('2026-06-21'), 0, 0, false);
    expect(rise.kind).toBe('rise');
    expect(set.kind).toBe('set');
    // At the equator and the prime meridian, near 06:00 and 18:00 UT.
    if ('at' in rise && 'at' in set) {
      expect(Math.abs(rise.at - (day('2026-06-21') + 6 * 3600))).toBeLessThan(10 * 60);
      expect(Math.abs(set.at - (day('2026-06-21') + 18 * 3600))).toBeLessThan(10 * 60);
      expect(set.at - rise.at).toBeGreaterThan(12 * 3600);
    }
    // East is earlier: 90°E sees sunrise six hours before the prime meridian.
    const east = sunEventUT(day('2026-06-21'), 0, 90, true);
    if ('at' in east && 'at' in rise) expect(Math.round((rise.at - east.at) / 60)).toBe(360);
  });
  it('take a local day\'s sunrise and sunset from whichever UT days hold them', () => {
    // Tokyo's local day 2026-06-21 runs from 15:00 UT on the 20th; its sunrise (04:25 local) is 19:25 UT on the 20th.
    const start = day('2026-06-21') - 9 * 3600;
    const tokyo = daylight(start, start + 86_400, 35.68, 139.69);
    expect(tokyo.sunrise).toBeDefined();
    expect(tokyo.sunset).toBeDefined();
    expect(Math.abs((tokyo.sunrise as number) - (day('2026-06-20') + 19 * 3600 + 25 * 60))).toBeLessThan(120);
    expect(Math.abs((tokyo.sunset as number) - (day('2026-06-21') + 10 * 3600))).toBeLessThan(300);
    expect(tokyo.polar).toBeUndefined();
    // A polar day has no sunrise or sunset, and says so.
    const svalbard = daylight(day('2026-06-21'), day('2026-06-22'), 78.22, 15.65);
    expect(svalbard).toEqual({ polar: 'up' });
    expect(daylight(day('2026-12-21'), day('2026-12-22'), 78.22, 15.65)).toEqual({ polar: 'down' });
    // The day the sun first sets again keeps its sunset and isn't called polar.
    const edge = daylight(day('2026-08-25'), day('2026-08-26'), 78.22, 15.65);
    expect(edge.polar).toBeUndefined();
    // A day the sun rises in, though by midday it has stopped setting, is a day with a sunrise.
    expect(daylight(day('2026-08-24'), day('2026-08-25'), 78.22, 15)).toStrictEqual({ sunrise: 1_787_614_516 });
  });
  it('count an event at the very start of the span as in it, and one at its very end as not', () => {
    const rise = sunEventUT(day('2026-03-20'), 40, -105, true);
    const at = 'at' in rise ? rise.at : Number.NaN;
    expect(daylight(at, at + 3600, 40, -105)).toEqual({ sunrise: at });
    // A span with neither, on a day the sun crosses the horizon, has neither and is no polar day.
    expect(daylight(at - 3600, at, 40, -105)).toStrictEqual({});
  });
});
