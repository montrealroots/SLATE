import { SECONDS_PER_DAY } from './calendar.ts';

/**
 * Sunrise and sunset, by the NOAA Global Monitoring Laboratory's solar calculator (gml.noaa.gov/grad/solcalc, its
 * main.js; register R-0004), which follows Jean Meeus's Astronomical Algorithms: the sun's declination and the
 * equation of time for the Julian century, the hour angle at which its centre sits 0.833° below the horizon
 * (refraction and the solar disc), and a second pass at the first estimate's time. NOAA gives its accuracy as within a
 * minute between latitudes 72° north and south and within ten minutes beyond; the engine is held to that against the
 * U.S. Naval Observatory (tests/core/time/sun.test.ts, register R-0006 to R-0023).
 */

const rad = (deg: number) => (Math.PI * deg) / 180;
const deg = (r: number) => (180 * r) / Math.PI;

/** The Julian Day of an instant (seconds since 1970-01-01 UT). */
export const julianDay = (instant: number) => instant / SECONDS_PER_DAY + 2_440_587.5;
const julianCentury = (jd: number) => (jd - 2_451_545) / 36_525;

function geomMeanLongSun(t: number): number {
  const l0 = 280.46646 + t * (36_000.76983 + t * 0.0003032);
  return ((l0 % 360) + 360) % 360;
}
const geomMeanAnomalySun = (t: number) => 357.52911 + t * (35_999.05029 - 0.0001537 * t);
const eccentricityEarthOrbit = (t: number) => 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

function sunEqOfCenter(t: number): number {
  const m = rad(geomMeanAnomalySun(t));
  return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m) * (0.019993 - 0.000101 * t) + Math.sin(3 * m) * 0.000289;
}

const omega = (t: number) => 125.04 - 1934.136 * t;
const sunApparentLong = (t: number) => geomMeanLongSun(t) + sunEqOfCenter(t) - 0.00569 - 0.00478 * Math.sin(rad(omega(t)));

function obliquityCorrection(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const e0 = 23 + (26 + seconds / 60) / 60;
  return e0 + 0.00256 * Math.cos(rad(omega(t)));
}

/** The sun's declination, in degrees. */
export const sunDeclination = (t: number) => deg(Math.asin(Math.sin(rad(obliquityCorrection(t))) * Math.sin(rad(sunApparentLong(t)))));

/** The equation of time, in minutes. */
export function equationOfTime(t: number): number {
  const epsilon = obliquityCorrection(t);
  const l0 = rad(geomMeanLongSun(t));
  const e = eccentricityEarthOrbit(t);
  const m = rad(geomMeanAnomalySun(t));
  const y = Math.tan(rad(epsilon) / 2) ** 2;
  const eTime = y * Math.sin(2 * l0) - 2 * e * Math.sin(m) + 4 * e * y * Math.sin(m) * Math.cos(2 * l0) - 0.5 * y * y * Math.sin(4 * l0) - 1.25 * e * e * Math.sin(2 * m);
  return deg(eTime) * 4;
}

/** The cosine of the hour angle at sunrise; beyond ±1 the sun doesn't cross the horizon that day. */
export function hourAngleArg(latitude: number, declination: number): number {
  const lat = rad(latitude);
  const dec = rad(declination);
  return Math.cos(rad(90.833)) / (Math.cos(lat) * Math.cos(dec)) - Math.tan(lat) * Math.tan(dec);
}

export type SunEvent = { kind: 'rise' | 'set'; at: number } | { kind: 'up' | 'down' };

/**
 * The sunrise or sunset NOAA's calculator finds for a day starting at a UT midnight, as an instant; or, where the sun
 * stays above or below the horizon, which one. Latitude north-positive, longitude east-positive, both in degrees, as
 * NOAA's calculator takes them.
 */
export function sunEventUT(dayStart: number, latitude: number, longitude: number, rise: boolean): SunEvent {
  const minutesUT = (jd: number): number | undefined => {
    const t = julianCentury(jd);
    const arg = hourAngleArg(latitude, sunDeclination(t));
    if (arg < -1 || arg > 1) return undefined;
    const hourAngle = deg(Math.acos(arg)) * (rise ? 1 : -1);
    return 720 - 4 * (longitude + hourAngle) - equationOfTime(t);
  };
  const jd = julianDay(dayStart);
  const first = minutesUT(jd);
  const second = first === undefined ? undefined : minutesUT(jd + first / 1440);
  if (second === undefined) {
    const t = julianCentury(jd);
    return { kind: hourAngleArg(latitude, sunDeclination(t)) < -1 ? 'up' : 'down' };
  }
  return { kind: rise ? 'rise' : 'set', at: Math.round(dayStart + second * 60) };
}

export interface Daylight {
  /** The instant the sun rises within the day, if it does. */
  sunrise?: number;
  sunset?: number;
  /** 'up' when the sun never sets that day, 'down' when it never rises; absent on an ordinary day. */
  polar?: 'up' | 'down';
}

/**
 * The daylight of a local day, given the instants it starts and ends (from the place's time zone): the sunrise and
 * sunset that fall within it, computed from the UT days that overlap it, or the polar day or night.
 */
export function daylight(localStart: number, localEnd: number, latitude: number, longitude: number): Daylight {
  const firstDay = Math.floor(localStart / SECONDS_PER_DAY) - 1;
  const lastDay = Math.floor(localEnd / SECONDS_PER_DAY) + 1;
  const out: Daylight = {};
  let polarSeen: 'up' | 'down' | undefined;
  for (let day = firstDay; day <= lastDay; day += 1) {
    const noon = day * SECONDS_PER_DAY + SECONDS_PER_DAY / 2;
    for (const rise of [true, false]) {
      const e = sunEventUT(day * SECONDS_PER_DAY, latitude, longitude, rise);
      if (!('at' in e)) {
        // A UT day without the event speaks for the local day when its noon falls in it.
        if (noon >= localStart && noon < localEnd) polarSeen = e.kind;
      } else if (e.at >= localStart && e.at < localEnd) {
        if (e.kind === 'rise') out.sunrise ??= e.at;
        else out.sunset ??= e.at;
      }
    }
  }
  if (out.sunrise === undefined && out.sunset === undefined && polarSeen !== undefined) out.polar = polarSeen;
  return out;
}
