import { describe, expect, it } from 'vitest';
import { compileSeasons } from '../../tools/seasons/compile.ts';

const year = (y: number, over: Partial<Record<number, Partial<{ phenom: string; year: number; month: number; day: number; time: string }>>> = {}) =>
  [
    { phenom: 'Equinox', year: y, month: 3, day: 20, time: '14:46' },
    { phenom: 'Solstice', year: y, month: 6, day: 21, time: '08:24' },
    { phenom: 'Equinox', year: y, month: 9, day: 23, time: '00:05' },
    { phenom: 'Solstice', year: y, month: 12, day: 21, time: '20:50' },
  ].map((e, i) => ({ ...e, ...over[i] }));

describe('the seasons compiler', () => {
  it('turns each year\'s four events into seconds UT, in order', () => {
    const s = compileSeasons({ years: { '2026': year(2026), '2027': year(2027) } });
    expect([s.first, s.last]).toEqual([2026, 2027]);
    expect(s.starts[0]).toEqual([Date.UTC(2026, 2, 20, 14, 46), Date.UTC(2026, 5, 21, 8, 24), Date.UTC(2026, 8, 23, 0, 5), Date.UTC(2026, 11, 21, 20, 50)].map((ms) => ms / 1000));
    expect(s.starts[1]?.[0]).toBe(Date.UTC(2027, 2, 20, 14, 46) / 1000);
  });
  it('refuses a missing year, a year without its four, and an event out of place', () => {
    expect(() => compileSeasons({ years: { '2026': year(2026), '2028': year(2028) } })).toThrow('the source has no year 2027');
    expect(() => compileSeasons({ years: { '2026': year(2026).slice(0, 3) } })).toThrow('2026 has 3 equinoxes and solstices, not 4');
    for (const [i, over] of [[0, { phenom: 'Solstice' }], [1, { month: 7 }], [2, { year: 2025 }], [3, { time: '8:50' }], [3, { time: '20:50x' }], [0, { time: 'x14:46' }]] as const) {
      expect(() => compileSeasons({ years: { '2026': year(2026, { [i]: over }) } })).toThrow(`2026's event ${i + 1} isn't the`);
    }
  });
});
