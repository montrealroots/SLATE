import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import tzdb from '../../../src/core/time/tzdb.json';
import type { TzData, TzRule, TzZoneLine } from '../../../src/core/time/tzdb-types.ts';
import { FIRST_YEAR_START, LAST_YEAR_END, abbreviation, dayOf, formatOffset, optimize, zoneHistory, type TimeType } from '../../../src/core/time/zones.ts';
import { daysFromCivil } from '../../../src/core/time/calendar.ts';
import { FIXTURE } from '../../../tools/tzdb/zdump-sample.ts';
import { asZdump, ROOT, SAMPLE } from './zdump.ts';

const data = tzdb as TzData;

describe('the sample zones, against the oracle\'s account of them', () => {
  const sample = new Map<string, string[]>();
  let zone = '';
  for (const line of readFileSync(join(ROOT, FIXTURE), 'utf8').trimEnd().split('\n')) {
    if (line.startsWith('# ')) {
      zone = line.slice(2);
      sample.set(zone, []);
    } else sample.get(zone)?.push(line);
  }
  it('holds every sample zone', () => {
    expect([...sample.keys()]).toEqual([...SAMPLE]);
  });
  it.each([...SAMPLE])('%s', (z) => {
    expect(asZdump(zoneHistory(data, data.zones[z] as TzZoneLine[]))).toEqual(sample.get(z));
  });
});

describe('a rule\'s day', () => {
  it('is a fixed day, the last weekday, or the first on or after or last on or before a day', () => {
    expect(dayOf(2026, 3, { kind: 'dom', day: 14 })).toBe(daysFromCivil(2026, 3, 14));
    expect(dayOf(2026, 3, { kind: 'last', weekday: 0 })).toBe(daysFromCivil(2026, 3, 29));
    expect(dayOf(2026, 3, { kind: 'geq', weekday: 0, day: 8 })).toBe(daysFromCivil(2026, 3, 8));
    expect(dayOf(2026, 3, { kind: 'leq', weekday: 0, day: 25 })).toBe(daysFromCivil(2026, 3, 22));
  });
});

describe('offsets and abbreviations, as zic writes them', () => {
  it('writes an offset with minutes and seconds only when they are not zero', () => {
    expect([0, 3600, -18000, 19800, 20700, -16200, -2670, 45900, -3600 * 10 - 30 * 60 - 7].map(formatOffset)).toEqual(['+00', '+01', '-05', '+0530', '+0545', '-0430', '-004430', '+1245', '-103007']);
  });
  it('reads a format by its slash, its %s and its %z', () => {
    expect(abbreviation('GMT/BST', 'x', false, 0)).toBe('GMT');
    expect(abbreviation('GMT/BST', 'x', true, 3600)).toBe('BST');
    expect(abbreviation('E%sT', 'D', true, -14400)).toBe('EDT');
    expect(abbreviation('E%sT', '', false, -18000)).toBe('ET');
    expect(abbreviation('%z', '', false, 19800)).toBe('+0530');
    expect(abbreviation('LMT', '', false, -17762)).toBe('LMT');
  });
});

describe('zic\'s optimize pass', () => {
  const t = (at: number, utoff: number, abbr = String(utoff), isdst = false) => ({ at, utoff, isdst, abbr });
  const init: TimeType = { utoff: 0, isdst: false, abbr: '0' };
  it('keeps transitions that change something, and drops one that changes nothing', () => {
    expect(optimize(init, [t(100, 3600), t(200, 3600), t(300, 0)])).toEqual([t(100, 3600), t(300, 0)]);
    expect(optimize(init, [t(100, 0)])).toEqual([]);
    expect(optimize(init, [t(100, 0, '0', true)])).toEqual([t(100, 0, '0', true)]);
    expect(optimize(init, [t(100, 0, 'other')])).toEqual([t(100, 0, 'other')]);
  });
  it('merges a transition at or before the previous one\'s local time into it', () => {
    // From 0 to -4h at 3h, then to -3h DST at 4h: the second's local midnight is not later than the first's.
    expect(optimize({ utoff: -10800, isdst: false, abbr: 'a' }, [t(10_800, -14400, 'b'), t(14_400, -10800, 'c', true)])).toEqual([t(10_800, -10800, 'c', true)]);
    // ... and when the merge returns to the type before both, both go.
    expect(optimize(init, [t(100, -3600, 'x'), t(3600, 0, '0')])).toEqual([]);
    // ... and a later one stands on its own.
    expect(optimize(init, [t(100, -3600, 'x'), t(3701, 0, '0')])).toEqual([t(100, -3600, 'x'), t(3701, 0, '0')]);
    // Two back: the merge reads the type before the previous one (+2h here), not the zone's first type (0).
    expect(optimize(init, [t(100, 7200), t(10_000, 0), t(13_000, 3600)])).toEqual([t(100, 7200), t(10_000, 3600)]);
  });
});

describe('a zone\'s history', () => {
  const zone = (lines: TzZoneLine[], rules: Record<string, TzRule[]> = {}) => zoneHistory({ version: 'x', rules, zones: {}, links: {} }, lines);
  const rule = (over: Partial<TzRule>): TzRule => ({ from: 2000, to: null, month: 3, on: { kind: 'dom', day: 1 }, at: 0, atType: 'w', save: 3600, isdst: true, letters: 'D', ...over });
  const until = (year: number, over: Partial<NonNullable<TzZoneLine['until']>> = {}) => ({ year, month: 1, on: { kind: 'dom' as const, day: 1 }, at: 0, atType: 'w' as const, ...over });
  const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * 86_400;
  it('starts in its first line\'s type and changes at each line\'s end', () => {
    const h = zone([
      { stdoff: -17_762, rule: { kind: 'none' }, format: 'LMT', until: until(1883, { month: 11, on: { kind: 'dom', day: 18 }, at: 12 * 3600 + 3 * 60 + 58 }) },
      { stdoff: -18_000, rule: { kind: 'fixed', save: 3600, isdst: true }, format: 'E%sT', until: until(1900, { atType: 'u' }) },
      { stdoff: -18_000, rule: { kind: 'none' }, format: '%z', until: until(1910, { atType: 's' }) },
      { stdoff: 0, rule: { kind: 'none' }, format: 'UTC' },
    ]);
    expect(h).toEqual({
      initial: { utoff: -17_762, isdst: false, abbr: 'LMT' },
      transitions: [
        { at: day(1883, 11, 18) + 17 * 3600, utoff: -14_400, isdst: true, abbr: 'ET' },
        { at: day(1900, 1, 1), utoff: -18_000, isdst: false, abbr: '-05' },
        { at: day(1910, 1, 1) + 5 * 3600, utoff: 0, isdst: false, abbr: 'UTC' },
      ],
    });
  });
  it('applies rules in UT order, a wall-clock moment read with the save in effect before it', () => {
    const rules = { R: [rule({ month: 3, at: 2 * 3600 }), rule({ month: 10, at: 2 * 3600, save: 0, isdst: false, letters: 'S' })] };
    const h = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'LMT', until: until(2001) }, { stdoff: 3600, rule: { kind: 'named', name: 'R' }, format: 'X%sT', until: until(2003) }, { stdoff: 3600, rule: { kind: 'none' }, format: 'END' }], rules);
    expect(h.transitions).toEqual([
      // The line starts after the 2000 October moment: in standard time, named by the rule before it.
      { at: day(2001, 1, 1), utoff: 3600, isdst: false, abbr: 'XST' },
      { at: day(2001, 3, 1) + 3600, utoff: 7200, isdst: true, abbr: 'XDT' },
      { at: day(2001, 10, 1), utoff: 3600, isdst: false, abbr: 'XST' },
      { at: day(2002, 3, 1) + 3600, utoff: 7200, isdst: true, abbr: 'XDT' },
      { at: day(2002, 10, 1), utoff: 3600, isdst: false, abbr: 'XST' },
      { at: day(2003, 1, 1) - 3600, utoff: 3600, isdst: false, abbr: 'END' },
    ]);
  });
  it('reads standard-time and UT moments without the save', () => {
    const rules = { R: [rule({ month: 3, at: 2 * 3600, atType: 's' }), rule({ month: 10, at: 2 * 3600, atType: 'u', save: 0, isdst: false, letters: 'S' })] };
    const h = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2001) }, { stdoff: 3600, rule: { kind: 'named', name: 'R' }, format: 'X%sT' }], rules);
    expect(h.transitions.slice(0, 3)).toEqual([
      { at: day(2001, 1, 1), utoff: 3600, isdst: false, abbr: 'XST' },
      { at: day(2001, 3, 1) + 3600, utoff: 7200, isdst: true, abbr: 'XDT' },
      { at: day(2001, 10, 1) + 7200, utoff: 3600, isdst: false, abbr: 'XST' },
    ]);
  });
  it('starts a line in the state a rule before it set, or one at its very start', () => {
    const rules = { R: [rule({ from: 1990, month: 6 }), rule({ from: 1990, month: 9, save: 0, isdst: false, letters: 'S' })] };
    const mid = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000, { month: 7 }) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s' }], rules);
    expect(mid.transitions[0]).toEqual({ at: day(2000, 7, 1), utoff: 3600, isdst: true, abbr: 'YD' });
    const exact = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000, { month: 6 }) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s' }], rules);
    expect(exact.transitions[0]).toEqual({ at: day(2000, 6, 1), utoff: 3600, isdst: true, abbr: 'YD' });
  });
  it('without a rule before the start, names standard time by the first standard-time moment after it', () => {
    const rules = { R: [rule({ from: 2001, month: 3 }), rule({ from: 2001, month: 10, save: 0, isdst: false, letters: 'S' })] };
    const h = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s' }], rules);
    expect(h.transitions[0]).toEqual({ at: day(2000, 1, 1), utoff: 0, isdst: false, abbr: 'YS' });
    // ... or by the moment the line's end cuts off, when that is the first.
    const cut = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s', until: until(2001, { month: 8 }) }, { stdoff: 0, rule: { kind: 'none' }, format: 'Z' }], { R: [rule({ from: 2001, month: 3 }), rule({ from: 2001, month: 10, save: 0, isdst: false, letters: 'S' })] });
    expect(cut.transitions[0]).toEqual({ at: day(2000, 1, 1), utoff: 0, isdst: false, abbr: 'YS' });
    // A format without %s needs no letters.
    const plain = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: '%z', until: until(2001) }, { stdoff: 0, rule: { kind: 'none' }, format: 'Z' }], { R: [rule({ from: 2005 })] });
    expect(plain.transitions).toEqual([{ at: day(2000, 1, 1), utoff: 0, isdst: false, abbr: '+00' }, { at: day(2001, 1, 1), utoff: 0, isdst: false, abbr: 'Z' }]);
  });
  it('refuses what it cannot answer', () => {
    expect(() => zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s', until: until(2001) }, { stdoff: 0, rule: { kind: 'none' }, format: 'Z' }], { R: [rule({ from: 2005 })] })).toThrow('no abbreviation can be found for the start of a R line');
    expect(() => zone([{ stdoff: 0, rule: { kind: 'named', name: 'Gone' }, format: 'Z' }])).toThrow("the rule set Gone doesn't exist");
    expect(() => zone([{ stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s' }], { R: [rule({})] })).toThrow('the zone has no standard time to start in');
  });
  it('starts a zone that opens on rules in the first standard time they give', () => {
    const h = zone([{ stdoff: -18_000, rule: { kind: 'named', name: 'R' }, format: 'E%sT' }], { R: [rule({ from: 1918, to: 1919 }), rule({ from: 1918, to: 1919, month: 10, save: 0, isdst: false, letters: 'S' })] });
    expect(h.initial).toEqual({ utoff: -18_000, isdst: false, abbr: 'EST' });
    expect(h.transitions.map((x) => x.abbr)).toEqual(['EDT', 'EST', 'EDT', 'EST']);
  });
  it('stops at the end of 2200', () => {
    const h = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2000) }, { stdoff: 0, rule: { kind: 'named', name: 'R' }, format: 'Y%s' }], { R: [rule({}), rule({ month: 10, save: 0, isdst: false, letters: 'S' })] });
    // October's moment is wall-clock midnight with an hour of save in effect: 23:00 UT the day before.
    expect(h.transitions.at(-1)?.at).toBe(day(2200, 10, 1) - 3600);
    expect(h.transitions.every((x) => x.at < LAST_YEAR_END)).toBe(true);
    expect(LAST_YEAR_END).toBe(day(2201, 1, 1));
    expect(FIRST_YEAR_START).toBe(day(1800, 1, 1));
    const late = zone([{ stdoff: 0, rule: { kind: 'none' }, format: 'Z', until: until(2300) }, { stdoff: 3600, rule: { kind: 'none' }, format: 'Y' }]);
    expect(late.transitions).toEqual([]);
  });
});
