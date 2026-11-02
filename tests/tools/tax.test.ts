import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { at, bands, BLOCKED, compileCountry, day, decimal, EMPLOYED, FACT, ITEMS, num, OUTPUT, READINGS, readTax, serialize, SOURCES, WORKS, zones } from '../../tools/money/tax/compile.ts';
import { COVERAGE, coverageOf, serializeCoverage, taxCoverage, TESTS, TOLD } from '../../tools/money/tax/coverage.ts';
import type { Country } from '../../tools/money/tax/compile.ts';

const ROOT = resolve(import.meta.dirname, '../..');
type Figures = Parameters<typeof num>[1];
const F: Figures = [
  {
    item: 'residents',
    value: {
      n: 12570,
      big: 0.5,
      words: 'about 11.9% of it',
      frac: 'rates x 1/10',
      neg: -1,
      text: 'twelve',
      list: [{ from: 0, to: 100, rate: 0.1 }, { from: 100, to: null, rate: 0.2 }],
      gap: [{ from: 0.01, to: 100, rate: 0.1 }, { from: 100.01, to: null, rate: 0.2 }],
      floor: [{ from: 50, to: 100, rate: 0.1 }, { from: 100, to: 200, rate: 0.2 }],
      apart: [{ from: 0, to: 100, rate: 0.1 }, { from: 101, to: null, rate: 0.2 }],
      early: [{ from: 0, to: null, rate: 0.1 }, { from: 100, to: null, rate: 0.2 }],
      back: [{ from: 0, to: 0, rate: 0.1 }],
      bad: [{ from: 0, rate: 0.1 }],
      odd: [7],
      high: [{ from: 0, to: null, rate: 1.5 }],
      empty: [],
      zones: [
        { from: 0, to: 10, formula: '0' },
        { from: 10, to: 20, formula: '(914.51*y + 1400)*y, y=(zvE-10)/10000' },
        { from: 20, to: 30, formula: '(173.10*z + 2397)*z + 1034.87, z=(zvE-20)/10000' },
        { from: 30, to: null, formula: '0.45*x - 19470.38' },
      ],
      offset: [{ from: 10, to: 20, formula: '(1*y + 2)*y, y=(zvE-11)/10000' }],
      strange: [{ from: 0, to: null, formula: 'x squared' }],
      unformed: [{ from: 0, to: null }],
      days: { iso: '2027-01-31', short: '04-01 of the year', words: '1 July', month: '02', window: '2026-07-13/2026-10-23', none: 'soon', thirteen: '13', number: 5, wrong: '31 Julember' },
      yes: 'yes, unless elected',
      no: 'not stated',
      bool: false,
      figure: 7,
      nul: null,
      quarter: 0.25,
      deep: { neg: -1, frac: '12/100 of it', words: 'none', list: [{ from: 0, to: null, rate: 2 }], short: [], zones: [], day: 5, nope: 7, f: { from: 'x', to: null, rate: 0.1 } },
      mixed: [{ from: '0', to: null, rate: 0.1 }],
      wordy: [{ from: 0, to: null, rate: 'x' }],
      toText: [{ from: 0, to: 'x', rate: 0.1 }],
      zoneText: [{ from: '0', to: null, formula: '0' }],
      zoneTo: [{ from: 0, to: 'x', formula: '0' }],
      zoneNoFormula: [{ from: 0, to: null }],
      surely: 'surely yes',
      oneHalf: 1.5,
    },
  },
];
const ref = (...path: (string | number)[]) => ({ fig: 0, path });

describe('the tax compile', () => {
  it('reads every figure where its reference places it, as the reference reads it', () => {
    expect([SOURCES, READINGS, OUTPUT, FACT, BLOCKED, WORKS, EMPLOYED]).toEqual(['research/sources/money/tax', 'tools/money/tax/readings.json', 'src/money/tax/tax.json', 'money.tax.', 'money.tax.blocked.', ['performer', 'director', 'producer', 'author'], ['performer', 'director']]);
    expect(ITEMS).toEqual(['residents', 'business', 'credits', 'regional', 'social', 'wages', 'withholding', 'nonResident', 'authors', 'scheme', 'vat', 'year']);
    expect([decimal({ num: 1n, den: 8n }), decimal({ num: -3n, den: 4n }), decimal({ num: 1200n, den: 100n }), decimal({ num: 7n, den: 1n }), decimal({ num: 0n, den: 5n }), decimal({ num: 3n, den: 40n })]).toEqual(['0.125', '-0.75', '12', '7', '0', '0.075']);
    expect(() => decimal({ num: 1n, den: 3n })).toThrow("1/3 isn't a decimal");
    expect(() => decimal({ num: 1n, den: -1n })).toThrow('a decimal has a positive denominator');
    expect(() => decimal({ num: 1n, den: 0n })).toThrow('a decimal has a positive denominator');
    expect([decimal({ num: 1n, den: 5n }), decimal({ num: 3n, den: 2n }), decimal({ num: 7n, den: 25n })]).toEqual(['0.2', '1.5', '0.28']);
    expect(at('GB', F, ref('list', 1, 'rate'))).toBe(0.2);
    expect(() => at('GB', F, { fig: 3, path: [] })).toThrow('GB has no figure 3');
    expect(() => at('GB', F, ref('nothing'))).toThrow("GB's figure 0 has no nothing");
    expect(() => at('GB', F, ref('n', 'x'))).toThrow("GB's figure 0 has no n.x");
    expect(() => at('GB', F, ref('list', 'x'))).toThrow("GB's figure 0 has no list.x");
    expect(() => at('GB', F, ref('days', 0))).toThrow("GB's figure 0 has no days.0");
    expect(() => at('GB', F, ref('list', 7))).toThrow("GB's figure 0 has no list.7");
    expect(() => at('GB', F, ref('nul', 'x'))).toThrow("GB's figure 0 has no nul.x");
    expect([num('GB', F, ref('n')), num('GB', F, { ...ref('n'), months: true }), num('GB', F, { ...ref('big'), twice: true }), num('GB', F, { ...ref('big'), half: true })]).toEqual(['12570', '150840', '1', '0.25']);
    expect([num('GB', F, { ...ref('words'), percent: true }), num('GB', F, { ...ref('frac'), fraction: true }), num('GB', F, { ...ref('big'), of: ref('words') })]).toEqual(['0.119', '0.1', '0.0595']);
    expect(() => num('GB', F, { ...ref('frac'), percent: true })).toThrow("GB's frac writes no percent");
    expect(() => num('GB', F, { ...ref('words'), fraction: true })).toThrow("GB's words writes no fraction");
    expect(() => num('GB', F, { ...ref('n'), percent: true })).toThrow("GB's n writes no percent");
    for (const k of ['neg', 'text', 'list']) expect(() => num('GB', F, ref(k)), k).toThrow(`GB's ${k} is a number, not below nothing`);
    // Messages name the place whole.
    expect(() => num('GB', F, ref('deep', 'neg'))).toThrow("GB's deep.neg is a number, not below nothing");
    expect(num('GB', F, { ...ref('deep', 'frac'), fraction: true })).toBe('0.12');
    expect(() => num('GB', F, { ...ref('deep', 'words'), percent: true })).toThrow("GB's deep.words writes no percent");
    expect(() => bands('GB', F, ref('deep', 'list'))).toThrow("GB's deep.list is a rate above the whole");
    expect(() => bands('GB', F, ref('deep', 'short'))).toThrow("GB's deep.short is a scale of bands");
    expect(() => bands('GB', F, ref('deep', 'f'))).toThrow("GB's deep.f is a scale of bands");
    expect(() => zones('DE', F, ref('deep', 'zones'))).toThrow("DE's deep.zones is a list of zones");
    expect(() => day('GB', F, ref('deep', 'day'))).toThrow("GB's deep.day is a day written");
    expect(() => compileCountry('GB', { country: 'GB', figures: F, blockers: [] }, { currency: ref('cur') })).toThrow("GB's figure 0 has no cur");
    expect(num('GB', [{ item: '', value: { z: 0 } }], ref('z'))).toBe('0');
  });

  it('reads a scale of bands whole, running on from the last, or built of figures placed', () => {
    expect(bands('GB', F, ref('list'))).toEqual([{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }]);
    expect(bands('GB', F, { ...ref('list'), months: true })).toEqual([{ from: '0', to: '1200', rate: '0.1' }, { from: '1200', to: null, rate: '0.2' }]);
    // A centavo apart, as Mexico writes them, runs on; a scale may start at a floor and stop at a ceiling.
    expect(bands('MX', F, ref('gap'))).toEqual([{ from: '0.01', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }]);
    expect(bands('GB', F, ref('floor'))).toEqual([{ from: '50', to: '100', rate: '0.1' }, { from: '100', to: '200', rate: '0.2' }]);
    expect(() => bands('GB', F, ref('apart'))).toThrow("GB's apart band 1 runs on from 100");
    expect(() => bands('GB', F, ref('early'))).toThrow("GB's early has no end only in its last band");
    expect(() => bands('GB', F, ref('back'))).toThrow("GB's back band 0 runs forward");
    expect(() => bands('GB', F, ref('bad'))).toThrow("GB's bad band 0 has a from, a to and a rate");
    expect(() => bands('GB', F, ref('odd'))).toThrow("GB's odd band 0 has a from, a to and a rate");
    for (const k of ['mixed', 'wordy', 'toText']) expect(() => bands('GB', F, ref(k)), k).toThrow(`GB's ${k} band 0 has a from, a to and a rate`);
    expect(() => bands('GB', F, [{ from: { path: ['n'] }, to: null, rate: ref('big') }])).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, [{ from: 0, to: null, rate: { fig: '0', path: ['big'] } }])).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, [{ from: 0, to: null, rate: { fig: 0, path: 'big' } }])).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, ref('high'))).toThrow("GB's high is a rate above the whole");
    expect(() => bands('GB', F, ref('empty'))).toThrow("GB's empty is a scale of bands");
    expect(() => bands('GB', F, ref('n'))).toThrow("GB's n is a scale of bands");
    // Built: each figure the readings place; from nothing, or a figure.
    expect(bands('GB', F, [{ from: 0, to: ref('n'), rate: ref('big') }, { from: ref('n'), to: null, rate: ref('big') }])).toEqual([{ from: '0', to: '12570', rate: '0.5' }, { from: '12570', to: null, rate: '0.5' }]);
    expect(() => bands('GB', F, [])).toThrow('GB reads a scale of bands');
    expect(() => bands('GB', F, ref('list').path)).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, [{ from: 1, to: null, rate: ref('big') }])).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, [{ from: 0, to: 5, rate: ref('big') }])).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, [{ from: 0, to: null, rate: 0.5 }])).toThrow("GB's band reads its from, its to and its rate from the research");
    expect(() => bands('GB', F, [{ from: ref('n'), to: ref('n'), rate: ref('big') }])).toThrow("GB's band from 12570 runs forward");
    expect(() => bands('GB', F, [{ from: 0, to: null, rate: ref('figure') }])).toThrow("GB's figure is a rate above the whole");
    expect(() => bands('GB', F, [7])).toThrow("GB's band reads its from, its to and its rate from the research");
  });

  it("reads § 32a's zones from their formulas, and a day as the research writes it", () => {
    expect(zones('DE', F, ref('zones'))).toEqual([
      { from: '0', to: '10', rate: '0', minus: '0' },
      { from: '10', to: '20', quad: ['914.51', '1400', '0'] },
      { from: '20', to: '30', quad: ['173.10', '2397', '1034.87'] },
      { from: '30', to: null, rate: '0.45', minus: '19470.38' },
    ]);
    expect(() => zones('DE', F, ref('offset'))).toThrow("DE's zone 0 counts from 11, not its start");
    expect(() => zones('DE', F, ref('strange'))).toThrow("DE's zone 0 has a formula the law's forms don't write");
    expect(() => zones('DE', F, ref('unformed'))).toThrow("DE's zone 0 has a from, a to and a formula");
    for (const k of ['zoneText', 'zoneTo', 'zoneNoFormula']) expect(() => zones('DE', F, ref(k)), k).toThrow("DE's zone 0 has a from, a to and a formula");
    expect(() => zones('DE', F, ref('odd'))).toThrow("DE's zone 0 has a from, a to and a formula");
    expect(() => zones('DE', F, ref('empty'))).toThrow("DE's empty is a list of zones");
    expect(() => zones('DE', F, ref('n'))).toThrow("DE's n is a list of zones");
    const d = (k: string, part?: number) => day('GB', F, part === undefined ? ref('days', k) : { ...ref('days', k), part });
    expect([d('iso'), d('short'), d('words'), d('month'), d('window', 0), d('window', 1)]).toEqual([
      { on: '01-31', year: 2027 },
      { on: '04-01', year: null },
      { on: '07-01', year: null },
      { on: '02-28', year: null },
      { on: '07-13', year: 2026 },
      { on: '10-23', year: 2026 },
    ]);
    for (const k of ['none', 'thirteen', 'wrong']) expect(() => d(k), k).toThrow(`GB's days.${k} writes no day`);
    expect(() => d('window', 2)).toThrow("GB's days.window writes no day");
    expect(() => d('number')).toThrow("GB's days.number is a day written");
    expect(() => day('GB', [{ item: '', value: { m: '00' } }], ref('m'))).toThrow("GB's m writes no day");
    expect(day('GB', [{ item: '', value: { m: '12' } }], ref('m'))).toEqual({ on: '12-31', year: null });
    expect(day('GB', [{ item: '', value: { m: '9 May' } }], ref('m'))).toEqual({ on: '05-09', year: null });
    const said = (m: string) => day('GB', [{ item: '', value: { m } }], ref('m')).on;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    expect(months.map((x) => said(`2 ${x}`))).toEqual(months.map((_, i) => `${String(i + 1).padStart(2, '0')}-02`));
    expect([said('01'), said('04'), said('11')]).toEqual(['01-31', '04-30', '11-30']);
    for (const m of ['x2027-01-31', 'x04-01', 'x1 July', '1 July x', 'x02', '02x', '2 Smarch']) expect(() => said(m), m).toThrow("GB's m writes no day");
  });

  const file = (value: Record<string, unknown>, blockers: { item: string }[] = []) => ({ country: 'GB', figures: [{ item: 'residents', value: { ...(F[0]?.value as object), ...value } }], blockers });
  const reading = (o: Record<string, unknown> = {}) => ({
    currency: ref('cur'),
    year: { start: ref('start'), end: ref('end'), due: ref('due') },
    residents: [{ layers: [{ bands: ref('list') }] }],
    social: { employee: [ref('list')], self: [] },
    withholding: { performer: { bands: ref('list') }, director: { bands: ref('list') } },
    nonResident: { performer: { bands: ref('list'), final: ref('yes') } },
    vat: { rate: ref('big'), threshold: ref('n') },
    unmodeled: [],
    ...o,
  });
  const base = { cur: 'GBP', start: '2026-04-06', end: '2027-04-05', due: '2028-01-31' };

  it("compiles a country's tax from its figures and blockers as the readings place them", () => {
    expect(compileCountry('GB', file(base), reading())).toEqual({
      currency: 'GBP',
      year: { start: '04-06', due: { on: '01-31', after: 1 } },
      residents: [{ from: '0000-01-01', layers: [{ bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }] }] }],
      employed: ['performer', 'director'],
      social: { employee: [[{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }]], self: [] },
      withholding: { performer: { bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }], final: false }, director: { bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }], final: false } },
      nonResident: { performer: { bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }], final: true } },
      vat: { rate: '0.5', threshold: '12570' },
      unknown: [],
    });
    // Every layer's and scheme's term, read where placed.
    const layer = { bands: ref('list'), less: ref('n'), shares: [{ rate: ref('big') }, { rate: ref('big'), max: ref('n') }], over: ref('n'), credit: [ref('n'), ref('figure')], creditUpTo: ref('n'), taper: { from: ref('n'), rate: ref('big') }, minimum: ref('n'), surtax: { rate: ref('big'), over: ref('n'), cap: { ...ref('words'), percent: true } } };
    const scheme = { bands: ref('list'), deduct: ref('big'), over: ref('n'), yearly: true, surtax: ref('big'), final: ref('no') };
    const full = compileCountry('GB', file(base), reading({ residents: [{ layers: [layer, { zones: ref('zones'), surtax: { rate: ref('big') } }] }], withholding: { author: scheme }, nonResident: { producer: { bands: ref('list'), final: ref('bool') } }, employed: [] }));
    expect(full.residents[0]?.layers[0]).toEqual({ bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }], less: '12570', shares: [{ rate: '0.5', max: null }, { rate: '0.5', max: '12570' }], over: '12570', credit: '12577', creditUpTo: '12570', taper: { from: '12570', rate: '0.5' }, minimum: '12570', surtax: { rate: '0.5', over: '12570', cap: '0.119' } });
    expect(full.residents[0]?.layers[1]?.surtax).toEqual({ rate: '0.5' });
    expect(full.residents[0]?.layers[1]?.zones).toHaveLength(4);
    expect(full.withholding.author).toEqual({ bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }], final: false, deduct: '0.5', over: '12570', yearly: true, surtax: '0.5' });
    expect([full.nonResident.producer?.final, full.employed, full.unknown]).toEqual([false, [], ['nonResident']]);
    // A sentence that only ends in yes isn't a yes; credits are summed exactly.
    expect(compileCountry('GB', file(base), reading({ nonResident: { performer: { bands: ref('list'), final: ref('surely') } } })).nonResident.performer?.final).toBe(false);
    expect(compileCountry('GB', file(base), reading({ residents: [{ layers: [{ bands: ref('list'), credit: [ref('big'), ref('quarter')] }] }] })).residents[0]?.layers[0]?.credit).toBe('0.75');
    expect(() => compileCountry('GB', file(base), reading({ nonResident: { performer: { bands: ref('list'), final: ref('deep', 'nope') } } }))).toThrow("GB's deep.nope says whether it is final");
  });

  it('reads the years, the dates scales start from, VAT and what is untold', () => {
    const c = (v: Record<string, unknown>, r: Record<string, unknown> = {}, blockers: { item: string }[] = []) => compileCountry('GB', file({ ...base, ...v }, blockers), reading(r));
    // A due date with no year, so many years after the year's end as the readings say; none where the research gives none.
    expect(c({ due: '31 January' }, { year: { start: ref('start'), due: ref('due'), after: 1 } }).year).toEqual({ start: '04-06', due: { on: '01-31', after: 1 } });
    expect(c({ due: '31 January' }, { year: { start: ref('start'), due: ref('due'), after: 0 } }).year.due).toEqual({ on: '01-31', after: 0 });
    expect(c({ due: null }).year.due).toBeNull();
    expect(c({ due: null }).unknown).toEqual(['year']);
    expect(() => c({ due: '31 January' })).toThrow("GB gives how many years after the year's end the return is due");
    expect(() => c({}, { year: { start: ref('start'), due: ref('due') } })).toThrow("GB gives how many years after the year's end the return is due");
    expect(() => c({ due: '2026-01-31' })).toThrow("GB gives how many years after the year's end the return is due");
    expect(() => c({ due: '31 January' }, { year: { start: ref('start'), due: ref('due'), after: -1 } })).toThrow("GB gives how many years after the year's end the return is due");
    // Scales from a date, from a year (at the tax year's start), or from the date the readings name, in order.
    const from = (f: unknown) => c({ year: 2025, date: '2025-04-06' }, { residents: [{ from: f, layers: [{ bands: ref('list') }] }] }).residents[0]?.from;
    expect([from(ref('year')), from(ref('date')), from('2024-01-01')]).toEqual(['2025-04-06', '2025-04-06', '2024-01-01']);
    for (const f of ['soon', 'x2025-01-01', '2025-01-01x']) expect(() => from(f), f).toThrow("GB's scale starts on a date");
    expect(() => c({}, { residents: [{ from: '2025-01-01', layers: [] }, { from: '2025-01-01', layers: [] }] })).toThrow("GB's scales come in their order");
    expect(c({}, { residents: [{ from: '2025-01-01', layers: [] }, { from: '2025-01-02', layers: [] }] }).residents).toHaveLength(2);
    expect(() => c({}, { residents: [{ layers: [{}] }] })).toThrow("GB's layer is a scale of bands or of zones");
    expect(() => c({}, { residents: [{ layers: [{ bands: ref('list'), zones: ref('zones') }] }] })).toThrow("GB's layer is a scale of bands or of zones");
    // VAT: none, from the first pound, an author's own rate and threshold, or exempt.
    expect([c({}, { vat: null }).vat, c({ n: null }, { vat: { rate: ref('big'), threshold: ref('n') } }).vat]).toEqual([null, { rate: '0.5', threshold: null }]);
    expect(c({}, { vat: { rate: ref('big'), threshold: ref('n'), authors: { rate: ref('big'), threshold: ref('n') } } }).vat?.authors).toEqual({ rate: '0.5', threshold: '12570' });
    expect(c({}, { vat: { rate: ref('big'), threshold: ref('n'), authors: { rate: ref('big') } } }).vat?.authors).toEqual({ rate: '0.5' });
    expect([c({ ex: true }, { vat: { rate: ref('big'), threshold: ref('n'), authors: { exempt: ref('ex') } } }).vat?.authors, c({ ex: 'exempt (§ 3-7)' }, { vat: { rate: ref('big'), threshold: ref('n'), authors: { exempt: ref('ex') } } }).vat?.authors]).toEqual([{ rate: '0' }, { rate: '0' }]);
    for (const ex of [false, 'taxable', 'not exempt'])
      expect(() => c({ ex }, { vat: { rate: ref('big'), threshold: ref('n'), authors: { exempt: ref('ex') } } }), String(ex)).toThrow("GB's authors aren't exempt where the readings say so");
    // Untold: the research's blockers, the readings' own, a non-resident's withholding not final, an employee's wages.
    expect(c({}, { unmodeled: ['regional'], withholding: {} }, [{ item: 'vat' }]).unknown).toEqual(['regional', 'wages', 'vat']);
    expect(() => c({}, { unmodeled: ['nothing'] })).toThrow('GB leaves untold an item there isn\'t (nothing)');
    expect(() => c({}, { withholding: { dancer: { bands: ref('list') } } })).toThrow('GB names a kind of work there isn\'t (dancer)');
    expect(() => c({}, { withholding: [] })).toThrow('GB names a scheme per kind of work');
    expect(() => c({}, { withholding: null })).toThrow('GB names a scheme per kind of work');
    expect(() => c({ cur: 'XYZ' })).toThrow('GB names its currency');
    expect(() => c({ cur: 7 })).toThrow('GB names its currency');
    expect(() => compileCountry('XX', file(base), reading())).toThrow('XX is not a country on the map');
    expect(() => compileCountry('FR', file(base), reading())).toThrow("FR's file is for GB");
    expect(() => compileCountry('GB', { ...file(base), figures: [{ item: '', value: { ...base, cur: 'GBP', n: 1, list: (F[0]?.value as Record<string, unknown>)['list'], yes: 7, big: 0.5 } }] }, reading())).toThrow("GB's yes says whether it is final");
  });

  it("reads the world's shapes: none, a sovereign's, indexed units and periods, a cap, the lower of two, a receipts tax", () => {
    const c = (v: Record<string, unknown>, r: Record<string, unknown> = {}, blockers: { item: string }[] = [], sovereign?: (cc: string) => Country | undefined) =>
      compileCountry('GB', file({ ...base, ...v }, blockers), reading(r), sovereign);
    // No currency named: the map's.
    expect(c({ cur: 'EUR' }, { currency: undefined }).currency).toBe('GBP');
    // No tax year given: from the 1st of January, its return due nowhere and told; a year with no due date the same.
    expect([c({}, { year: null }).year, c({}, { year: null }).unknown]).toEqual([{ start: '01-01', due: null }, ['year']]);
    expect([c({}, { year: { start: ref('start') } }).year, c({}, { year: { start: ref('start') } }).unknown]).toEqual([{ start: '04-06', due: null }, ['year']]);
    // No income tax, as the research says it: no layers, and no return to tell of.
    const untaxed = { residents: [{ none: ref('nul') }], year: { start: ref('start'), due: null } };
    expect(c({}, untaxed)).toMatchObject({ residents: [{ from: '0000-01-01', layers: [] }], year: { start: '04-06', due: null }, unknown: [] });
    expect(c({}, { ...untaxed, year: null }).unknown).toEqual([]);
    expect(c({}, { residents: [], year: null }).unknown).toEqual(['year']);
    expect(() => c({}, { year: { start: ref('start'), due: null } })).toThrow("GB has a return to file: its tax isn't none");
    expect(() => c({}, { residents: [{ none: ref('nul') }, { from: '2027-01-01', layers: [{ bands: ref('list') }] }], year: { start: ref('start'), due: null } })).toThrow("GB has a return to file: its tax isn't none");
    const none = (v: unknown) => c({ v }, { residents: [{ none: ref('v') }] }).residents[0]?.layers;
    for (const v of [true, false, null, 0, [], [{ from: 0, to: null, rate: 0 }], 'no withholding; assessment', 'No tax'] as unknown[]) expect(none(v), JSON.stringify(v)).toEqual([]);
    for (const v of ['yes', 'none', 'not stated', 'NO', 'no;', 'x no tax', ['no tax'], 7, 1, [{ from: 0, to: null, rate: 0.1 }], [{ from: 0, to: null, rate: 0 }, { from: 1, to: null, rate: 0.2 }], [7], 'x no']) expect(() => none(v), JSON.stringify(v)).toThrow("GB's v doesn't say there is none");
    // Nothing withheld: no bands, final unless the research says otherwise.
    expect(c({}, { withholding: { performer: { none: ref('nul') }, director: { none: ref('nul'), final: ref('no') } } }).withholding).toEqual({ performer: { bands: [], final: true }, director: { bands: [], final: false } });
    expect(() => c({}, { withholding: { performer: { none: ref('n') } } })).toThrow("GB's n doesn't say there is none");
    // A finality not stated is not final; the work an employee does, the readings' own.
    expect(c({}, { nonResident: { performer: { bands: ref('list'), final: ref('nul') } } })).toMatchObject({ nonResident: { performer: { final: false } }, unknown: ['nonResident'] });
    expect(c({}, { employed: [], withholding: {} })).toMatchObject({ employed: [], unknown: [] });
    // A blocker on what a territory follows is on its residents' tax; one on VAT's threshold, on VAT.
    expect(c({}, {}, [{ item: 'follows' }, { item: 'vat-threshold' }]).unknown).toEqual(['residents', 'vat']);
    // A receipts tax: its rate, and its threshold where the research gives one.
    expect([c({}, { turnover: { rate: ref('big') } }).turnover, c({}, { turnover: { rate: ref('big'), threshold: ref('n') } }).turnover, c({}, { turnover: { rate: ref('big'), threshold: ref('nul') } }).turnover]).toEqual([
      { rate: '0.5', threshold: null },
      { rate: '0.5', threshold: '12570' },
      { rate: '0.5', threshold: null },
    ]);
    expect(Object.hasOwn(c({}), 'turnover')).toBe(false);
    expect(() => c({}, { turnover: { rate: ref('high') } })).toThrow("GB's high is a number, not below nothing");
    // A layer's cap as a share of its income, the other reckoning the law allows, an allowance of several, a surtax above the tax.
    const l = c({}, { residents: [{ layers: [{ bands: ref('list'), most: ref('quarter'), less: [ref('n'), ref('figure')], or: { bands: ref('floor'), surtax: { rate: ref('oneHalf') } } }] }] }).residents[0]?.layers[0];
    expect(l).toEqual({ bands: [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }], less: '12577', most: '0.25', or: { bands: [{ from: '50', to: '100', rate: '0.1' }, { from: '100', to: '200', rate: '0.2' }], surtax: { rate: '1.5' } } });
    expect(c({}, { residents: [{ layers: [{ bands: ref('list'), less: ref('n') }] }] }).residents[0]?.layers[0]?.less).toBe('12570');
    expect(() => c({}, { residents: [{ layers: [{ bands: ref('list'), most: ref('oneHalf') }] }] })).toThrow("GB's oneHalf is a rate above the whole");
    // A figure in an indexed unit, by the quarter, the week or the thousand.
    expect([num('GB', F, { ...ref('n'), by: ref('big') }), num('GB', F, { ...ref('n'), quarters: true }), num('GB', F, { ...ref('n'), weeks: true }), num('GB', F, { ...ref('n'), permille: true })]).toEqual(['6285', '50280', '653640', '12.57']);
    expect(bands('GB', F, { ...ref('list'), by: ref('quarter') })).toEqual([{ from: '0', to: '25', rate: '0.1' }, { from: '25', to: null, rate: '0.2' }]);
    expect(bands('GB', F, { ...ref('list'), months: true, by: ref('quarter') })).toEqual([{ from: '0', to: '300', rate: '0.1' }, { from: '300', to: null, rate: '0.2' }]);
    // The calendar year, and a day of the following year in words.
    const said = (m: string) => day('GB', [{ item: '', value: { m } }], ref('m'));
    expect([said('calendar year (1 January to 31 December)'), said('calendar'), said('Calendar year'), said('30 April of the following year'), said('1 May of the next year')]).toEqual([
      { on: '01-01', year: null },
      { on: '01-01', year: null },
      { on: '01-01', year: null },
      { on: '04-30', year: null },
      { on: '05-01', year: null },
    ]);
    for (const m of ['calendars', 'the calendar year', '30 April of the year', '30 April of the following year x']) expect(() => said(m), m).toThrow("GB's m writes no day");
  });

  it("takes a territory's items from its sovereign where its research says the sovereign's law applies", () => {
    const sov = compileCountry('GB', file({ ...base, cur: 'EUR' }, [{ item: 'credits' }, { item: 'vat' }]), reading({ withholding: {}, unmodeled: ['nonResident', 'year', 'business', 'regional', 'scheme', 'withholding', 'authors'], residents: [{ layers: [{ zones: ref('zones') }] }], social: { employee: [ref('floor')], self: [ref('list')] } }));
    const seen: string[] = [];
    const look = (cc: string) => (seen.push(cc), cc === 'FR' ? sov : undefined);
    const own = (v: Record<string, unknown>, r: Record<string, unknown>, blockers: { item: string }[] = []) => compileCountry('GB', file({ ...base, cur: 'EUR', sov: 'FR', ...v }, blockers), reading({ follows: { country: ref('sov'), items: ['residents', 'social', 'withholding'] }, ...r }), look);
    const t = own({}, { unmodeled: ['regional'] }, [{ item: 'residents' }]);
    // The items followed are the sovereign's, with what its research leaves untold of them; the rest the territory's own, with what it leaves untold.
    expect(t).toEqual({ ...sov, year: { start: '04-06', due: { on: '01-31', after: 1 }, }, nonResident: t.nonResident, vat: t.vat, unknown: ['residents', 'business', 'credits', 'regional', 'wages', 'withholding', 'scheme'] });
    expect([t.residents, t.social, t.withholding, t.employed]).toEqual([sov.residents, sov.social, sov.withholding, sov.employed]);
    expect(seen).toEqual(['FR']);
    // The territory's own non-final withholding stays told when it follows the sovereign only for the residents' scale; the sovereign's untold items reach it only for what it follows.
    const only = own({}, { follows: { country: ref('sov'), items: ['residents'] }, nonResident: { performer: { bands: ref('list') } } });
    expect(only.unknown).toEqual(['business', 'credits', 'regional', 'nonResident', 'scheme']);
    const lent = own({}, { vat: null, year: { start: ref('start') }, follows: { country: ref('sov'), items: ['vat', 'year', 'nonResident', 'authors'] } });
    expect(lent).toMatchObject({ vat: sov.vat, year: sov.year, unknown: ['nonResident', 'authors', 'vat', 'year'] });
    // Nothing but a country's own parts.
    expect(Object.keys(lent).sort()).toEqual(Object.keys(sov).sort());
    // An employer's withholding the territory takes is the sovereign's, its own want of one no longer told.
    const full = compileCountry('GB', file({ ...base, cur: 'EUR' }), reading());
    const takes = compileCountry('GB', file({ ...base, cur: 'EUR', sov: 'FR' }), reading({ withholding: {}, employed: [], follows: { country: ref('sov'), items: ['withholding'] } }), () => full);
    expect([takes.unknown, takes.employed]).toEqual([[], full.employed]);
    // A sovereign that keeps another currency lends only its year.
    expect(own({ cur: 'GBP' }, { follows: { country: ref('sov'), items: ['year'] } }).year).toEqual(sov.year);
    expect(() => own({ cur: 'GBP' }, {})).toThrow("GB keeps GBP, not its sovereign's EUR");
    expect(() => own({ cur: 'GBP' }, { follows: { country: ref('sov'), items: ['year', 'vat'] } })).toThrow("GB keeps GBP, not its sovereign's EUR");
    expect(() => own({ sov: 'US' }, {})).toThrow("GB follows a country whose tax isn't read (US)");
    expect(() => own({ sov: 7 }, {})).toThrow("GB follows a country whose tax isn't read (7)");
    // A figure that names no country isn't looked up.
    expect(seen.filter((x) => typeof x !== 'string')).toEqual([]);
    expect(() => own({}, { follows: { country: ref('sov'), items: ['dancers'] } })).toThrow('GB follows an item there isn\'t (dancers)');
    expect(() => compileCountry('GB', file({ ...base, sov: 'FR' }), reading({ follows: { country: ref('sov'), items: ['year'] } }))).toThrow("GB follows a country whose tax isn't read (FR)");
  });

  it('reads only the files the register cites, each read', () => {
    const tax = readTax(ROOT);
    expect(serialize(tax)).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    const dir = mkdtempSync(join(tmpdir(), 'tax-'));
    const copy = (register: object, readings: object, files: Record<string, string>) => {
      mkdirSync(join(dir, SOURCES), { recursive: true });
      mkdirSync(join(dir, 'tools/money/tax'), { recursive: true });
      for (const [n, text] of Object.entries(files)) writeFileSync(join(dir, SOURCES, n), text);
      writeFileSync(join(dir, 'tools/money/tax/readings.json'), JSON.stringify(readings));
      writeFileSync(join(dir, 'research/register.json'), JSON.stringify(register));
    };
    mkdirSync(join(dir, 'research'), { recursive: true });
    const gb = readFileSync(join(ROOT, SOURCES, 'GB.json'), 'utf8');
    const sha = createHash('sha256').update(gb).digest('hex');
    const readings = JSON.parse(readFileSync(join(ROOT, READINGS), 'utf8')) as Record<string, unknown>;
    const register = (s: string) => ({ entries: [{ fact: 'money.tax.GB', value: { file: `${SOURCES}/GB.json`, sha256: s } }, { fact: 'other' }] });
    copy(register(sha), { GB: readings['GB'] }, { 'GB.json': gb, 'notes.txt': 'x' });
    expect(readTax(dir)).toEqual({ countries: { GB: tax.countries['GB'] }, noState: [] });
    copy(register('0'.repeat(64)), { GB: readings['GB'] }, { 'GB.json': gb });
    expect(() => readTax(dir)).toThrow(`${SOURCES}/GB.json isn't the file the register cites`);
    copy({ entries: [] }, { GB: readings['GB'] }, { 'GB.json': gb });
    expect(() => readTax(dir)).toThrow(`${SOURCES}/GB.json isn't cited by the register`);
    copy(register(sha), {}, { 'GB.json': gb });
    expect(() => readTax(dir)).toThrow("GB's research has no reading");
    copy(register(sha), { GB: readings['GB'], US: readings['US'] }, { 'GB.json': gb });
    expect(() => readTax(dir)).toThrow('US is read with no research');
  });
});

describe('the tax compile, over the world', () => {
  it('reads a sovereign before its territories, a place with no taxing state as none, and no file of blockers the register cites none of', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tax-world-'));
    mkdirSync(join(dir, SOURCES), { recursive: true });
    mkdirSync(join(dir, 'tools/money/tax'), { recursive: true });
    mkdirSync(join(dir, 'research'), { recursive: true });
    const sha = (t: string) => createHash('sha256').update(t).digest('hex');
    const gb = readFileSync(join(ROOT, SOURCES, 'GB.json'), 'utf8');
    const own = (cc: string, value: Record<string, unknown>) => JSON.stringify({ country: cc, figures: [{ item: 'follows', value }], blockers: [] });
    const follower = { follows: { country: { fig: 0, path: ['sovereign'] }, items: ['year'] }, year: null, residents: [], social: { employee: [], self: [] }, withholding: {}, nonResident: {}, vat: null, unmodeled: [] };
    const readings = JSON.parse(readFileSync(join(ROOT, READINGS), 'utf8')) as Record<string, unknown>;
    const write = (files: Record<string, string>, cites: string[], blocked: string[], r: Record<string, unknown>, extra: string[] = []) => {
      for (const [n, text] of Object.entries(files)) writeFileSync(join(dir, SOURCES, `${n}.json`), text);
      const entries = [...cites.map((n) => ({ fact: `${FACT}${n}`, value: { file: `${SOURCES}/${n}.json`, sha256: sha(files[n] as string) } })), ...blocked.map((n) => ({ fact: `${BLOCKED}${n}` })), ...extra.map((fact) => ({ fact }))];
      writeFileSync(join(dir, 'research/register.json'), JSON.stringify({ entries }));
      writeFileSync(join(dir, READINGS), JSON.stringify(r));
    };
    const files = { AI: own('AI', { sovereign: 'GB' }), AQ: own('AQ', { follows: null }), CU: own('CU', {}), GB: gb };
    write(files, ['AI', 'AQ', 'GB'], ['CU', 'AQ'], { AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'] });
    const out = readTax(dir);
    const gbTax = readTax(ROOT).countries['GB'];
    expect(Object.keys(out.countries)).toEqual(['AI', 'GB']);
    expect([out.countries['GB'], out.countries['AI']?.year, out.countries['AI']?.currency, out.noState]).toEqual([gbTax, gbTax?.year, 'XCD', ['AQ']]);
    // A file of blockers is left unread only where its register entry is a blocker; any other uncited file is refused.
    write({ ...files, ER: own('ER', {}) }, ['AI', 'AQ', 'GB'], ['CU'], { AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'] }, ['money.tax.blocker.ER']);
    expect(() => readTax(dir)).toThrow(`${SOURCES}/ER.json isn't cited by the register`);
    writeFileSync(join(dir, SOURCES, 'ER.json'), 'x');
    rmSync(join(dir, SOURCES, 'ER.json'));
    // A place with no taxing state is one the research says has none.
    write({ ...files, AQ: own('AQ', { follows: 'NO' }) }, ['AI', 'AQ', 'GB'], ['CU'], { AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'] });
    expect(() => readTax(dir)).toThrow("AQ's follows doesn't say there is none");
    // Two territories following each other are refused; so is a reading of a place with no taxing state taken as a sovereign.
    write({ ...files, AQ: own('AQ', { follows: null }), AG: own('AG', { sovereign: 'AI' }), AI: own('AI', { sovereign: 'AG' }) }, ['AG', 'AI', 'AQ', 'GB'], ['CU'], { AG: follower, AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'] });
    expect(() => readTax(dir)).toThrow('AG follows a country that follows it');
    write({ ...files, AG: own('AG', { sovereign: 'AQ' }), AI: own('AI', { sovereign: 'GB' }) }, ['AG', 'AI', 'AQ', 'GB'], ['CU'], { AG: follower, AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'] });
    expect(() => readTax(dir)).toThrow("AG follows a country whose tax isn't read (AQ)");
    // So is a sovereign read with no research.
    write({ ...files, AG: own('AG', { sovereign: 'KY' }), AI: own('AI', { sovereign: 'GB' }) }, ['AG', 'AI', 'AQ', 'GB'], ['CU'], { AG: follower, AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'], KY: follower });
    expect(() => readTax(dir)).toThrow("AG follows a country whose tax isn't read (KY)");
    // A reading with no research, a place with no taxing state among them, is refused.
    write({ ...files, AG: own('AG', { sovereign: 'GB' }) }, ['AG', 'AI', 'AQ', 'GB'], ['CU'], { AG: follower, AI: follower, AQ: { noState: { fig: 0, path: ['follows'] } }, GB: readings['GB'], KY: follower });
    expect(() => readTax(dir)).toThrow('KY is read with no research');
  });
});

describe('the tax coverage', () => {
  it('is a row per country: researched, blocked with its research, or pending', () => {
    const facts = new Map([['money.tax.GB', 'R-1'], ['money.tax.FR', 'R-2'], ['money.tax.blocked.FR', 'R-3'], ['money.tax.blocked.XK', 'R-4'], ['money.tax.US', 'R-5']]);
    expect(taxCoverage(['AQ'], new Set(['AQ']), facts)).toStrictEqual([{ key: 'AQ', status: 'pending' }]);
    expect(taxCoverage(['GB', 'FR', 'XK', 'TD', 'US'], new Set(['GB', 'FR']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'XK', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'TD', status: 'pending' },
      { key: 'US', status: 'pending' },
    ]);
    expect(COVERAGE).toBe('coverage/tax-countries.json');
    expect(TESTS).toEqual([
      "tests/money/tax/tax.test.ts::a country's tax > is each country's own, every figure as the research gives it",
      "tests/money/tax/tax.test.ts::pay > is paid into the ledger less what the work's country withholds",
      "tests/money/tax/tax.test.ts::the year's reckoning > taxes the year's income at the resident's scale less what was withheld",
    ]);
    expect(TOLD).toBe("tests/money/tax/tax.test.ts::a country's tax > tells the player what of it isn't known");
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.tax",\n "axis": "country",\n "rows": []\n}\n');
  });
});
