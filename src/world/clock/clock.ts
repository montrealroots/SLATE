import { defineCommand, dispatch, pass, type Item, type Life } from '../../core/frame/frame.ts';
import { civilFromDays, daysFromCivil, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { daylight, julianCentury, julianDay, sunApparentLong, type Daylight } from '../../core/time/sun.ts';
import { instantOf, localTime, type LocalTime } from '../../core/time/time.ts';
import seasons from './seasons.json';

/**
 * The clock as the player meets it (BUILD-ORDER layer 2, KEEP entry 18): real time, in the town's own local time.
 * While playing, a second of the life passes for each real second; paused, none does. Advancing jumps ahead. Either
 * way time stops at the first commitment that wants the player, and the clock is paused there. What the player reads
 * is the town's local date and time in its IANA zone, the season by its hemisphere, and the day's sunrise and sunset.
 *
 * The clock reads no real time itself: the screen hands it the real milliseconds that passed (from a monotonic
 * source), so a life plays the same however it's driven, and a test can drive it.
 */
export interface ClockSlice {
  playing: boolean;
  /** Real milliseconds played and not yet a whole second of the life. */
  carryMs: number;
  /** Real milliseconds played in all, which the life's card shows as the time played. */
  playedMs: number;
}

export const CLOCK_START: ClockSlice = { playing: false, carryMs: 0, playedMs: 0 };

type Clocked = { clock: ClockSlice };

const startPlaying = (s: Clocked) => {
  s.clock.playing = true;
};
const stopPlaying = (s: Clocked) => {
  s.clock.playing = false;
};
/** The clock's own count of real time played, and its pause at a commitment. */
const count = (s: Clocked, a: { carryMs: number; playedMs: number; stopped: boolean }) => {
  s.clock.carryMs = a.carryMs;
  s.clock.playedMs += a.playedMs;
  if (a.stopped) s.clock.playing = false;
};

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice, and Stryker 10.0.0 counts a module that fails to load as surviving
// (10.1.0 fixes it). The declarations are held by the test that lists each with what it reads and writes; what each
// does is mutated above.
export const play = defineCommand<Clocked, null>({ id: 'clock.play', reads: [], writes: ['clock'], run: startPlaying });
export const pause = defineCommand<Clocked, null>({ id: 'clock.pause', reads: [], writes: ['clock'], run: stopPlaying });
const counted = defineCommand<Clocked, { carryMs: number; playedMs: number; stopped: boolean }>({ id: 'clock.counted', reads: [], writes: ['clock'], run: count });
// Stryker restore all

export interface Moved<S extends Clocked> {
  life: Life<S>;
  /** The commitment time stopped at, if one wanted the player. */
  stoppedAt: Item | null;
}

/** Real milliseconds have passed: while playing, the life moves on by as many whole seconds, and counts them played. */
export function elapse<S extends Clocked>(life: Life<S>, realMs: number): Moved<S> {
  if (!Number.isFinite(realMs) || realMs < 0) throw new RangeError(`real time passes forward (${realMs} ms)`);
  if (!life.slices.clock.playing) return { life, stoppedAt: null };
  const carry = life.slices.clock.carryMs + realMs;
  const seconds = Math.floor(carry / 1000);
  const moved = pass(life, life.frame.now + seconds);
  const stopped = moved.stoppedAt !== null;
  // At a commitment the clock stops, and the part of a second it was carrying goes with the time it didn't pass.
  return { life: dispatch(moved.life, counted, { carryMs: stopped ? 0 : carry - seconds * 1000, playedMs: realMs, stopped }), stoppedAt: moved.stoppedAt };
}

/** The life jumps ahead, stopping (and pausing) at a commitment that wants the player. */
export function advance<S extends Clocked>(life: Life<S>, seconds: number): Moved<S> {
  if (!Number.isSafeInteger(seconds) || seconds < 0) throw new RangeError(`the clock advances by whole seconds (${seconds})`);
  const moved = pass(life, life.frame.now + seconds);
  if (moved.stoppedAt === null) return moved;
  return { life: dispatch(moved.life, counted, { carryMs: 0, playedMs: 0, stopped: true }), stoppedAt: moved.stoppedAt };
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** USNO's years (register R-0036); outside them the moments are computed. */
export const USNO_SEASONS = { first: seasons.first, last: seasons.last } as const;

/** The months a year's equinoxes and solstices fall in, and the sun's apparent longitude at each. */
const MONTHS = [3, 6, 9, 12] as const;

/** An angle brought within half a turn of zero. */
const wrap180 = (deg: number) => deg - 360 * Math.round(deg / 360);

/**
 * An equinox or solstice computed from the sun's apparent longitude (NOAA's formulas, register R-0004) reaching 0°,
 * 90°, 180° or 270°: within 12 minutes 39 seconds of USNO's times over 1800 to 2100 (measured), for the years
 * USNO doesn't give.
 */
export function computedStart(year: number, quarter: 0 | 1 | 2 | 3): number {
  const near = daysFromCivil(year, MONTHS[quarter], 21) * SECONDS_PER_DAY;
  // Stryker disable next-line EqualityOperator: the sun exactly on the line at a whole second ends the search the same.
  const behind = (t: number) => wrap180(sunApparentLong(julianCentury(julianDay(t))) - quarter * 90) < 0;
  let lo = near - 5 * SECONDS_PER_DAY;
  let hi = near + 5 * SECONDS_PER_DAY;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (behind(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** A year's March equinox, June solstice, September equinox and December solstice, in seconds UT. */
export function seasonStarts(year: number): readonly [number, number, number, number] {
  if (year >= seasons.first && year <= seasons.last) return seasons.starts[year - seasons.first] as [number, number, number, number];
  return [computedStart(year, 0), computedStart(year, 1), computedStart(year, 2), computedStart(year, 3)];
}

const NORTH: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SOUTH: readonly Season[] = ['autumn', 'winter', 'spring', 'summer'];

/**
 * The season at an instant, astronomically: spring begins at the March equinox in the north and at the September one
 * in the south, and so round. The equator reckons as the north.
 */
export function seasonAt(instant: number, latitude: number): Season {
  const year = civilFromDays(Math.floor(instant / SECONDS_PER_DAY)).year;
  const names = latitude < 0 ? SOUTH : NORTH;
  const starts = seasonStarts(year);
  for (let q = 3; q >= 0; q -= 1) if (instant >= (starts[q] as number)) return names[q] as Season;
  // Before the March equinox, it's still the season the last December solstice began.
  return names[3] as Season;
}

export interface Reading {
  local: LocalTime;
  season: Season;
  /** Sunrise and sunset within the local day, or the polar day or night. */
  daylight: Daylight;
}

/** What the clock shows at a place, at an instant. */
export function reading(instant: number, place: { zone: string; latitude: number; longitude: number }): Reading {
  const local = localTime(place.zone, instant);
  const { year, month, day } = local.date;
  const start = instantOf(place.zone, local.date, 0).instant;
  const end = instantOf(place.zone, civilFromDays(daysFromCivil(year, month, day) + 1), 0).instant;
  return { local, season: seasonAt(instant, place.latitude), daylight: daylight(start, end, place.latitude, place.longitude) };
}
