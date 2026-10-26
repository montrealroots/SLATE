import { describe, expect, it } from 'vitest';
import { civilFromDays, daysFromCivil } from '../../../src/core/time/calendar.ts';
import { TZDB_VERSION, ZONE_IDS, canonicalZone, historyOf, instantOf, localTime, typeAt } from '../../../src/core/time/time.ts';
import { FIRST_YEAR_START, LAST_YEAR_END } from '../../../src/core/time/zones.ts';

const utc = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => daysFromCivil(y, m, d) * 86_400 + h * 3600 + min * 60 + s;
const NY = 'America/New_York';

describe('zones by name', () => {
  it('holds the release\'s 344 zones, and follows an alias to its zone', () => {
    expect(TZDB_VERSION).toBe('2026e');
    expect(ZONE_IDS).toHaveLength(344);
    expect(ZONE_IDS).toContain(NY);
    expect(canonicalZone(NY)).toBe(NY);
    expect(canonicalZone('US/Eastern')).toBe(NY);
    expect(canonicalZone('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(canonicalZone('Mars/Olympus')).toBeUndefined();
  });
  it('computes a zone\'s history once, by its canonical name', () => {
    expect(historyOf('US/Eastern')).toBe(historyOf(NY));
    expect(() => historyOf('Mars/Olympus')).toThrow('"Mars/Olympus" is not a time zone');
  });
});

describe('the type in effect at an instant', () => {
  it('changes at the transition, to the second', () => {
    expect(typeAt(NY, utc(2026, 3, 8, 6, 59, 59))).toEqual({ utoff: -18_000, isdst: false, abbr: 'EST' });
    expect(typeAt(NY, utc(2026, 3, 8, 7))).toEqual({ utoff: -14_400, isdst: true, abbr: 'EDT' });
    expect(typeAt(NY, utc(2026, 11, 1, 5, 59, 59)).abbr).toBe('EDT');
    expect(typeAt(NY, utc(2026, 11, 1, 6)).abbr).toBe('EST');
  });
  it('is the zone\'s first type before its first transition, and holds from 1800 to the end of 2200', () => {
    expect(typeAt(NY, FIRST_YEAR_START)).toEqual({ utoff: -17_762, isdst: false, abbr: 'LMT' });
    expect(typeAt(NY, LAST_YEAR_END - 1).abbr).toBe('EST');
    expect(typeAt('Etc/UTC', utc(2026, 1, 1))).toEqual({ utoff: 0, isdst: false, abbr: 'UTC' });
    expect(() => typeAt(NY, FIRST_YEAR_START - 1)).toThrow('the clock covers 1800 to 2200');
    expect(() => typeAt(NY, LAST_YEAR_END)).toThrow('the clock covers 1800 to 2200');
    expect(() => typeAt(NY, 0.5)).toThrow('an instant is a whole number of seconds (0.5)');
  });
  it('finds the right transition in a long history', () => {
    const { transitions } = historyOf('Europe/London');
    for (const t of transitions.filter((_, i) => i % 7 === 0)) {
      expect(typeAt('Europe/London', t.at)).toEqual({ utoff: t.utoff, isdst: t.isdst, abbr: t.abbr });
    }
  });
});

describe('local time', () => {
  it('is the date, the seconds since midnight, the weekday and the type', () => {
    expect(localTime(NY, utc(2026, 8, 24, 11, 30))).toEqual({ date: { year: 2026, month: 8, day: 24 }, seconds: 7 * 3600 + 30 * 60, weekday: 1, type: { utoff: -14_400, isdst: true, abbr: 'EDT' } });
    expect(localTime('Asia/Tokyo', utc(2026, 8, 24, 20)).date).toEqual({ year: 2026, month: 8, day: 25 });
    expect(localTime('Pacific/Honolulu', utc(2026, 1, 1, 5)).date).toEqual({ year: 2025, month: 12, day: 31 });
  });
});

describe('the instant a local time names', () => {
  it('is exact when the time happens once', () => {
    expect(instantOf(NY, { year: 2026, month: 8, day: 24 }, 7 * 3600 + 30 * 60)).toEqual({ instant: utc(2026, 8, 24, 11, 30), resolution: 'exact' });
    expect(instantOf('Asia/Kolkata', { year: 2026, month: 1, day: 1 }, 0)).toEqual({ instant: utc(2025, 12, 31, 18, 30), resolution: 'exact' });
  });
  it('is the earlier of two when the clock goes back, or the later when asked', () => {
    const day = { year: 2026, month: 11, day: 1 };
    expect(instantOf(NY, day, 1.5 * 3600)).toEqual({ instant: utc(2026, 11, 1, 5, 30), resolution: 'repeated' });
    expect(instantOf(NY, day, 1.5 * 3600, 'later')).toEqual({ instant: utc(2026, 11, 1, 6, 30), resolution: 'repeated' });
    expect(instantOf('Australia/Lord_Howe', { year: 2026, month: 4, day: 5 }, 1 * 3600 + 45 * 60, 'later').instant - instantOf('Australia/Lord_Howe', { year: 2026, month: 4, day: 5 }, 1 * 3600 + 45 * 60).instant).toBe(1800);
  });
  it('lands as far past the jump as it was into the gap when the clock goes forward', () => {
    expect(instantOf(NY, { year: 2026, month: 3, day: 8 }, 2.5 * 3600)).toEqual({ instant: utc(2026, 3, 8, 7, 30), resolution: 'skipped' });
    // Samoa skipped the whole of 2011-12-30.
    expect(instantOf('Pacific/Apia', { year: 2011, month: 12, day: 30 }, 12 * 3600)).toEqual({ instant: utc(2011, 12, 30, 22), resolution: 'skipped' });
    expect(localTime('Pacific/Apia', utc(2011, 12, 30, 22)).date).toEqual({ year: 2011, month: 12, day: 31 });
  });
  it('reads a gap at a zone\'s first transition with the zone\'s first type', () => {
    const zone = ZONE_IDS.find((z) => {
      const h = historyOf(z);
      return h.transitions[0] !== undefined && h.transitions[0].utoff > h.initial.utoff;
    }) as string;
    const { initial, transitions } = historyOf(zone);
    const jump = transitions[0] as { at: number; utoff: number };
    const local = jump.at + initial.utoff + 1;
    const days = Math.floor(local / 86_400);
    expect(instantOf(zone, civilFromDays(days), local - days * 86_400)).toEqual({ instant: local - initial.utoff, resolution: 'skipped' });
  });
  it('round-trips every instant near every transition from 1990 to 2030, in every zone', () => {
    const lo = utc(1990, 1, 1);
    const hi = utc(2030, 1, 1);
    for (const zone of ZONE_IDS) {
      const { transitions, initial } = historyOf(zone);
      for (const [i, t] of transitions.entries()) {
        if (t.at < lo || t.at >= hi) continue;
        for (const instant of [t.at - 3601, t.at - 1, t.at, t.at + 1, t.at + 3600]) {
          const l = localTime(zone, instant);
          const back = [instantOf(zone, l.date, l.seconds), instantOf(zone, l.date, l.seconds, 'later')];
          if (!back.some((b) => b.instant === instant) || back.some((b) => b.resolution === 'skipped')) throw new Error(`${zone} ${instant} doesn't round-trip`);
        }
        // A forward jump's gap: its middle never happens, and lands past the jump by as much as it was into the gap.
        const before = (i === 0 ? initial : (transitions[i - 1] as typeof t)).utoff;
        if (t.utoff > before) {
          const local = t.at + before + Math.floor((t.utoff - before) / 2);
          const days = Math.floor(local / 86_400);
          const r = instantOf(zone, civilFromDays(days), local - days * 86_400);
          if (r.resolution !== 'skipped' || r.instant !== local - before) throw new Error(`${zone} gap at ${t.at} isn't skipped`);
        }
      }
    }
  });
});
