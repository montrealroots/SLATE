import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { begin, commandIndex, defineKind, dispatch, type Life } from '../../../src/core/frame/frame.ts';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { instantOf } from '../../../src/core/time/time.ts';
import { CLOCK_START, USNO_SEASONS, advance, computedStart, elapse, pause, play, reading, seasonAt, seasonStarts, type ClockSlice } from '../../../src/world/clock/clock.ts';
import { readSeasons, serialize, OUTPUT } from '../../../tools/seasons/compile.ts';

const ROOT = join(import.meta.dirname, '../../..');
const T0 = daysFromCivil(2026, 10, 26) * 86_400 + 12 * 3600;
type S = { clock: ClockSlice };
const life = (clock: Partial<ClockSlice> = {}): Life<S> => begin('0123456789abcdef', T0, { clock: { ...CLOCK_START, ...clock } });
let declared: string | undefined;
/** A commitment kind for the tests, declared on first use inside a test. */
const meeting = () => (declared ??= defineKind<S>({ kind: 'test.clock.meeting', wants: true }).kind);
const withMeeting = (l: Life<S>, at: number): Life<S> => ({ ...l, frame: { ...l.frame, next: 2, schedule: [{ id: 1, at, kind: meeting(), data: null }] } });

describe('the clock\'s commands', () => {
  it('are declared with what they read and write', () => {
    const own = commandIndex().filter((c) => c.id.startsWith('clock.'));
    expect(own).toEqual([
      { id: 'clock.play', reads: [], writes: ['clock'] },
      { id: 'clock.pause', reads: [], writes: ['clock'] },
      { id: 'clock.counted', reads: [], writes: ['clock'] },
    ]);
  });
});

describe('playing and pausing', () => {
  it('start paused, and play and pause by command', () => {
    expect(CLOCK_START).toEqual({ playing: false, carryMs: 0, playedMs: 0 });
    const on = dispatch(life(), play, null);
    expect(on.slices.clock.playing).toBe(true);
    expect(dispatch(on, pause, null).slices.clock.playing).toBe(false);
  });
  it('while paused, real time passes and the life doesn\'t', () => {
    const l = life();
    expect(elapse(l, 60_000)).toEqual({ life: l, stoppedAt: null });
  });
  it('while playing, a second of the life for every real second, the part of a second carried', () => {
    let l = life({ playing: true });
    l = elapse(l, 1500).life;
    expect([l.frame.now - T0, l.slices.clock.carryMs, l.slices.clock.playedMs]).toEqual([1, 500, 1500]);
    l = elapse(l, 600).life;
    expect([l.frame.now - T0, l.slices.clock.carryMs, l.slices.clock.playedMs]).toEqual([2, 100, 2100]);
    l = elapse(l, 0).life;
    expect([l.frame.now - T0, l.slices.clock.carryMs]).toEqual([2, 100]);
    l = elapse(l, 3_600_000).life;
    expect([l.frame.now - T0, l.slices.clock.carryMs, l.slices.clock.playedMs]).toEqual([3602, 100, 3_602_100]);
    expect(l.slices.clock.playing).toBe(true);
  });
  it('one long stretch or many short ones end at the same moment', () => {
    let many = life({ playing: true });
    for (let i = 0; i < 100; i += 1) many = elapse(many, 333).life;
    const once = elapse(life({ playing: true }), 33_300).life;
    expect([many.frame.now, many.slices.clock.carryMs]).toEqual([once.frame.now, once.slices.clock.carryMs]);
    expect(many.slices.clock.playedMs).toBe(33_300);
  });
  it('refuses real time going backwards or not a number', () => {
    for (const bad of [-1, Number.NaN, Infinity]) expect(() => elapse(life({ playing: true }), bad)).toThrow(`real time passes forward (${bad} ms)`);
    expect(() => elapse(life(), -1)).toThrow('real time passes forward');
  });
});

describe('stopping at a commitment', () => {
  it('while playing: time stops at it, the clock pauses, and the part of a second is dropped', () => {
    const l = withMeeting(life({ playing: true, carryMs: 900 }), T0 + 10);
    const { life: after, stoppedAt } = elapse(l, 60_000);
    expect(stoppedAt?.id).toBe(1);
    expect([after.frame.now - T0, after.slices.clock.playing, after.slices.clock.carryMs, after.slices.clock.playedMs]).toEqual([10, false, 0, 60_000]);
    // Before it comes, playing goes on.
    const before = elapse(l, 9_000);
    expect([before.stoppedAt, before.life.frame.now - T0, before.life.slices.clock.playing, before.life.slices.clock.carryMs]).toEqual([null, 9, true, 900]);
  });
  it('advancing: the jump stops at it and pauses; without one, it lands where asked and leaves the clock as it was', () => {
    const l = withMeeting(life({ playing: true, carryMs: 400 }), T0 + 3600);
    const stopped = advance(l, 86_400);
    expect([stopped.stoppedAt?.id, stopped.life.frame.now - T0, stopped.life.slices.clock.playing, stopped.life.slices.clock.carryMs]).toEqual([1, 3600, false, 0]);
    const clear = advance(life({ playing: true, carryMs: 400 }), 86_400);
    expect([clear.stoppedAt, clear.life.frame.now - T0, clear.life.slices.clock]).toEqual([null, 86_400, { playing: true, carryMs: 400, playedMs: 0 }]);
    expect(advance(life(), 0).life.frame.now).toBe(T0);
    for (const bad of [-1, 1.5, Number.NaN]) expect(() => advance(life(), bad)).toThrow(`the clock advances by whole seconds (${bad})`);
  });
});

describe('the seasons', () => {
  it('are USNO\'s equinoxes and solstices for 1800 to 2100, compiled as read', () => {
    expect(serialize(readSeasons(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(USNO_SEASONS).toEqual({ first: 1800, last: 2100 });
    const utc = (y: number, mo: number, d: number, h: number, mi: number) => daysFromCivil(y, mo, d) * 86_400 + h * 3600 + mi * 60;
    expect(seasonStarts(2026)).toEqual([utc(2026, 3, 20, 14, 46), utc(2026, 6, 21, 8, 24), utc(2026, 9, 23, 0, 5), utc(2026, 12, 21, 20, 50)]);
    const source = JSON.parse(readFileSync(join(ROOT, 'research/sources/usno-seasons.json'), 'utf8')) as { years: Record<string, { month: number; day: number; time: string }[]> };
    for (const year of [1800, 1900, 2000, 2100]) {
      const starts = seasonStarts(year);
      source.years[String(year)]?.forEach((e, q) => {
        const [h, m] = e.time.split(':').map(Number) as [number, number];
        expect(starts[q], `${year} ${q}`).toBe(utc(year, e.month, e.day, h, m));
      });
    }
  });
  it('outside USNO\'s years are computed from the sun\'s place, within 12 minutes 39 seconds of USNO\'s inside them', () => {
    const source = JSON.parse(readFileSync(join(ROOT, 'research/sources/usno-seasons.json'), 'utf8')) as { years: Record<string, unknown[]> };
    expect(Object.keys(source.years)).toHaveLength(301);
    let worst = 0;
    for (let year = 1800; year <= 2100; year += 1) {
      const table = seasonStarts(year);
      for (const q of [0, 1, 2, 3] as const) worst = Math.max(worst, Math.abs(computedStart(year, q) - (table[q] as number)));
    }
    expect(worst).toBe(759);
    expect(seasonStarts(2150)).toEqual([computedStart(2150, 0), computedStart(2150, 1), computedStart(2150, 2), computedStart(2150, 3)]);
    expect(seasonStarts(1799)[3]).toBe(computedStart(1799, 3));
    // The computed moments run in order through the year, a season apart.
    const s = seasonStarts(2200);
    for (let q = 1; q < 4; q += 1) expect((s[q] as number) - (s[q - 1] as number)).toBeGreaterThan(88 * 86_400);
  });
  it('turn at each equinox and solstice, the south the opposite of the north', () => {
    const [mar, jun, sep, dec] = seasonStarts(2026) as [number, number, number, number];
    const at = (t: number) => [seasonAt(t, 45), seasonAt(t, -33)];
    expect(at(mar - 1)).toEqual(['winter', 'summer']);
    expect(at(mar)).toEqual(['spring', 'autumn']);
    expect(at(jun - 1)).toEqual(['spring', 'autumn']);
    expect(at(jun)).toEqual(['summer', 'winter']);
    expect(at(sep)).toEqual(['autumn', 'spring']);
    expect(at(dec - 1)).toEqual(['autumn', 'spring']);
    expect(at(dec)).toEqual(['winter', 'summer']);
    expect(at(daysFromCivil(2026, 1, 1) * 86_400)).toEqual(['winter', 'summer']);
    expect(seasonAt(jun, 0)).toBe('summer');
    expect(seasonAt(jun, -0.01)).toBe('winter');
  });
});

describe('what the clock shows', () => {
  it('the local date, time and zone, the season, and the local day\'s sunrise and sunset', () => {
    const paris = { zone: 'Europe/Paris', latitude: 48.85341, longitude: 2.3488 };
    const r = reading(T0, paris);
    expect(r.local.date).toEqual({ year: 2026, month: 10, day: 26 });
    expect(r.local.seconds).toBe(13 * 3600);
    expect(r.local.type).toEqual({ utoff: 3600, isdst: false, abbr: 'CET' });
    expect(r.season).toBe('autumn');
    const start = instantOf('Europe/Paris', { year: 2026, month: 10, day: 26 }, 0).instant;
    expect(r.daylight.sunrise !== undefined && r.daylight.sunrise > start + 7 * 3600 && r.daylight.sunrise < start + 8 * 3600).toBe(true);
    expect(r.daylight.sunset !== undefined && r.daylight.sunset > start + 17 * 3600 && r.daylight.sunset < start + 18 * 3600).toBe(true);
    // The day the clocks go back has 25 hours, and the day is read whole.
    const back = reading(daysFromCivil(2026, 10, 25) * 86_400 + 12 * 3600, paris);
    expect(back.local.type.abbr).toBe('CET');
    expect(back.daylight.sunset).toBeDefined();
    // Sydney is in spring in October.
    expect(reading(T0, { zone: 'Australia/Sydney', latitude: -33.86785, longitude: 151.20732 }).season).toBe('spring');
    // Polar night at Longyearbyen in December.
    expect(reading(daysFromCivil(2026, 12, 21) * 86_400, { zone: 'Arctic/Longyearbyen', latitude: 78.22334, longitude: 15.64689 }).daylight).toEqual({ polar: 'down' });
  });
  it('a day whose midnight the clocks skip begins when the day does', () => {
    // Havana springs forward at midnight: 2026-03-08 begins at 01:00.
    const havana = { zone: 'America/Havana', latitude: 23.13302, longitude: -82.38304 };
    const r = reading(daysFromCivil(2026, 3, 8) * 86_400 + 18 * 3600, havana);
    expect(r.local.date).toEqual({ year: 2026, month: 3, day: 8 });
    expect(r.daylight.sunrise).toBeDefined();
  });
});
