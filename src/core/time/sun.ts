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
export const julianCentury = (jd: number) => (jd - 2_451_545) / 36_525;

/** NOAA's chain of quantities for a Julian century t, each in NOAA's own units (degrees unless said). */
export function geomMeanLongSun(t: number): number {
  const l0 = 280.46646 + t * (36_000.76983 + t * 0.0003032);
  return ((l0 % 360) + 360) % 360;
}
export const geomMeanAnomalySun = (t: number) => 357.52911 + t * (35_999.05029 - 0.0001537 * t);
export const eccentricityEarthOrbit = (t: number) => 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

export function sunEqOfCenter(t: number): number {
  const m = rad(geomMeanAnomalySun(t));
  return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m) * (0.019993 - 0.000101 * t) + Math.sin(3 * m) * 0.000289;
}

const omega = (t: number) => 125.04 - 1934.136 * t;
export const sunApparentLong = (t: number) => geomMeanLongSun(t) + sunEqOfCenter(t) - 0.00569 - 0.00478 * Math.sin(rad(omega(t)));

export function meanObliquityOfEcliptic(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
}
export const obliquityCorrection = (t: number) => meanObliquityOfEcliptic(t) + 0.00256 * Math.cos(rad(omega(t)));

/** The sun's declination, in degrees. */
export const sunDeclination = (t: number) => deg(Math.asin(Math.sin(rad(obliquityCorrection(t))) * Math.sin(rad(sunApparentLong(t)))));

/** The equation of time, in minutes. */
export function equationOfTime(t: number): number {
  const l0 = rad(geomMeanLongSun(t));
  const e = eccentricityEarthOrbit(t);
  const m = rad(geomMeanAnomalySun(t));
  const y = Math.tan(rad(obliquityCorrection(t)) / 2) ** 2;
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

/** Beyond ±1 the sun doesn't cross the horizon: it stays up (below -1) or down (above 1). */
function polarOf(arg: number): 'up' | 'down' | undefined {
  // Stryker disable next-line EqualityOperator: exactly ±1 is the sun grazing the horizon at midnight or noon, a
  // single instant either reading gives; no day of the span at any place a test can name lands on it.
  return arg < -1 ? 'up' : arg > 1 ? 'down' : undefined;
}

/**
 * The sunrise or sunset NOAA's calculator finds for a day starting at a UT midnight, as an instant: computed at the
 * day's start and again at that first estimate. Where the sun doesn't cross the horizon at either pass, it stays above
 * ('up', the hour angle's cosine below -1) or below ('down', above 1). Latitude north-positive, longitude
 * east-positive, both in degrees, as NOAA's calculator takes them.
 */
export function sunEventUT(dayStart: number, latitude: number, longitude: number, rise: boolean): SunEvent {
  const jd = julianDay(dayStart);
  /** The event's minutes after the day's start, reckoned with the sun where it is that many minutes in. */
  const reckon = (minutes: number): number | 'up' | 'down' => {
    const t = julianCentury(jd + minutes / 1440);
    const arg = hourAngleArg(latitude, sunDeclination(t));
    const polar = polarOf(arg);
    if (polar !== undefined) return polar;
    const hourAngle = rise ? deg(Math.acos(arg)) : -deg(Math.acos(arg));
    return 720 - 4 * (longitude + hourAngle) - equationOfTime(t);
  };
  const first = reckon(0);
  if (typeof first === 'string') return { kind: first };
  const second = reckon(first);
  if (typeof second === 'string') return { kind: second };
  return { kind: rise ? 'rise' : 'set', at: Math.round(dayStart + second * 60) };
}

export interface Daylight {
  /** The instant the sun rises within the day, if it does. */
  sunrise?: number;
  sunset?: number;
  /** 'up' when the sun stays above the horizon all day, 'down' when it stays below. */
  polar?: 'up' | 'down';
}

/**
 * The daylight of a local day, given the instants it starts and ends (from the place's time zone): the sunrise and
 * sunset that fall within it, from the UT days around it; or, when neither does, the polar day or night that the
 * sun's place at the day's middle shows.
 */
export function daylight(localStart: number, localEnd: number, latitude: number, longitude: number): Daylight {
  const out: Daylight = {};
  let found = false;
  // Stryker disable next-line all: one UT day either side covers every event NOAA's day-based reckoning can place in the local day.
  for (let day = Math.floor(localStart / SECONDS_PER_DAY) - 1; day <= Math.floor(localEnd / SECONDS_PER_DAY) + 1; day += 1) {
    for (const rise of [true, false]) {
      const e = sunEventUT(day * SECONDS_PER_DAY, latitude, longitude, rise);
      if ('at' in e && e.at >= localStart && e.at < localEnd) {
        found = true;
        if (e.kind === 'rise') out.sunrise ??= e.at;
        else out.sunset ??= e.at;
      }
    }
  }
  if (found) return out;
  const polar = polarOf(hourAngleArg(latitude, sunDeclination(julianCentury(julianDay((localStart + localEnd) / 2)))));
  return polar === undefined ? out : { polar };
}
