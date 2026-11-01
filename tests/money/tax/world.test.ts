import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Context, Item, Json } from '../../../src/core/frame/frame.ts';
import { fromMajor, money, type CurrencyCode } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { t } from '../../../src/core/text/text.ts';
import { aboutTax, earn, MISSING, reckon, RECKON_KIND, residentTax, TAX, taxOf, UNKEPT_LINE, type Band, type Country, type EarnArgs, type Earning } from '../../../src/money/tax/tax.ts';
import { readTax } from '../../../tools/money/tax/compile.ts';
import { ACCOUNT, purse } from '../../support/purse.ts';

const root = resolve(import.meta.dirname, '../../..');
const DAY = SECONDS_PER_DAY;
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * DAY;
const AUGUST = day(2026, 8, 1);
const of = (c: string) => TAX[c] as Country;
const m = (c: string, n: string) => fromMajor(c as CurrencyCode, n);
const tax = (c: string, income: string, year: string) => residentTax(of(c), m(of(c).currency, income), year);

function ctx(now: number) {
  const scheduled: { kind: string; at: number; data: Json }[] = [];
  const c: Context = {
    now,
    draws: () => {
      throw new Error('no draws');
    },
    items: () => [],
    schedule: (kind, at, data = null) => scheduled.push({ kind, at, data }),
    cancel: () => undefined,
    notices: () => [],
    notify: () => 0,
    markRead: () => undefined,
  };
  return { c, scheduled };
}
const life = (currency: string): Earning => purse(currency, 100_000_000);
const pay = (cc: string, o: Partial<EarnArgs>, s = life(of(cc).currency), at = AUGUST) => ({ s, p: earn(s, { account: ACCOUNT, payer: 'production', country: cc, home: cc, work: 'performer', gross: m(of(cc).currency, '10000'), what: 'pay', ...o }, ctx(at).c) });
const item = (country: string, year: string): Item => ({ id: 1, at: 0, kind: RECKON_KIND, data: { country, year } });

type Ref = { fig: number; path: (string | number)[]; [flag: string]: unknown };
const isRef = (v: unknown): v is Ref => typeof v === 'object' && v !== null && 'fig' in v && 'path' in v;
const plain = (r: Ref) => Object.keys(r).every((k) => k === 'fig' || k === 'path');
const research = (cc: string) => JSON.parse(readFileSync(join(root, `research/sources/money/tax/${cc}.json`), 'utf8')) as { figures: { value: unknown }[] };
const atRef = (cc: string, r: Ref) => r.path.reduce<unknown>((v, k) => (v as Record<string | number, unknown>)[k], research(cc).figures[r.fig]?.value);
const readings = JSON.parse(readFileSync(join(root, 'tools/money/tax/readings.json'), 'utf8')) as Record<string, Record<string, unknown>>;

describe('every country read', () => {
  it('holds each figure the research gives, at its place', () => {
    // A scale read whole is the research's, band by band; a band built of figures, each figure the research's.
    const bandsOf = (cc: string, r: unknown, compiled: readonly Band[] | undefined): number => {
      if (isRef(r)) {
        if (!plain(r)) return 0;
        const list = atRef(cc, r) as { from: number; to: number | null; rate: number }[];
        expect(compiled, `${cc} ${r.path.join('.')}`).toEqual(list.map((b, k) => ({ from: String(k === 0 ? b.from : list[k - 1]?.to), to: b.to === null ? null : String(b.to), rate: String(b.rate) })));
        return list.length;
      }
      (r as { rate: unknown }[]).forEach((b, k) => isRef(b.rate) && plain(b.rate) && expect(compiled?.[k]?.rate, `${cc} band ${k}`).toBe(String(atRef(cc, b.rate))));
      return (r as unknown[]).length;
    };
    let read = 0;
    for (const [cc, r] of Object.entries(readings)) {
      // A territory's followed items are its sovereign's (held below); a place with no state has none.
      if (r['follows'] !== undefined || r['noState'] !== undefined || taxOf(cc) === undefined) continue;
      const c = of(cc);
      if (isRef(r['currency'])) expect(c.currency, cc).toBe(atRef(cc, r['currency']));
      (r['residents'] as { layers?: { bands?: unknown }[] }[]).forEach((s, i) => s.layers?.forEach((l, j) => l.bands !== undefined && (read += bandsOf(cc, l.bands, c.residents[i]?.layers[j]?.bands))));
      for (const side of ['employee', 'self'] as const) ((r['social'] as Record<string, unknown[]>)[side] ?? []).forEach((b, i) => (read += bandsOf(cc, b, c.social[side][i])));
      for (const kind of ['withholding', 'nonResident'] as const) for (const [w, s] of Object.entries(r[kind] as Record<string, { bands?: unknown }>)) if (s.bands !== undefined) read += bandsOf(cc, s.bands, c[kind][w as keyof Country['withholding']]?.bands);
      const v = r['vat'] as { rate: Ref } | null;
      if (v !== null && plain(v.rate)) expect(c.vat?.rate, `${cc} VAT`).toBe(String(atRef(cc, v.rate)));
    }
    expect(read).toBeGreaterThan(1500);
  });

  it("is a territory's sovereign's where its research says the sovereign's law applies there", () => {
    const parts: Record<string, (keyof Country)[]> = { residents: ['residents'], year: ['year'], social: ['social'], withholding: ['withholding', 'employed'], nonResident: ['nonResident'], vat: ['vat'], authors: [] };
    const followers = Object.entries(readings).filter(([, r]) => r['follows'] !== undefined);
    expect(followers.map(([cc]) => cc)).toEqual(['AS', 'AX', 'CC', 'CS', 'CX', 'EH', 'GF', 'GP', 'GU', 'HM', 'MC', 'MP', 'MQ', 'NF', 'PR', 'RE', 'UM', 'VI', 'YT']);
    for (const [cc, r] of followers) {
      const f = r['follows'] as { country: Ref; items: string[] };
      const sovereign = of(atRef(cc, f.country) as string);
      for (const i of f.items) for (const k of parts[i] ?? []) expect(of(cc)[k], `${cc} ${k}`).toEqual(sovereign[k]);
    }
    // Guam takes the United States' scale, its contributions, its year; its business privilege tax is its own.
    expect([of('GU').residents, of('GU').social, of('GU').year]).toEqual([of('US').residents, of('US').social, of('US').year]);
    expect([of('GU').turnover, of('US').turnover]).toEqual([{ rate: '0.05', threshold: null }, undefined]);
    // Åland keeps its own state scale and the municipal average; its year, withholding, non-residents' tax and VAT are Finland's.
    expect(of('AX').residents).not.toEqual(of('FI').residents);
    expect([of('AX').year, of('AX').vat, of('AX').nonResident]).toEqual([of('FI').year, of('FI').vat, of('FI').nonResident]);
    // Serbia and Montenegro is Serbia's; the Heard and McDonald Islands are Australia's, GST apart.
    expect({ ...of('CS'), unknown: [] }).toEqual({ ...of('RS'), unknown: [] });
    expect([of('HM').residents, of('HM').vat, of('HM').unknown]).toEqual([of('AU').residents, null, ['credits', 'wages', 'nonResident', 'authors', 'vat']]);
  });

  it('is read the same every time', () => {
    expect(readTax(root)).toEqual(readTax(root));
    const twice = () => pay('EE', {}).p;
    expect(twice()).toEqual(twice());
  });
});

describe("the world's shapes", () => {
  it('reads no income tax as a scale of none, and tells nothing untold where nothing is', () => {
    // The UAE, Bahrain, Monaco, the Cayman Islands: no layers, no return.
    for (const cc of ['AE', 'BH', 'BS', 'KW', 'KY', 'MC', 'QA', 'SA', 'VU']) expect([of(cc).residents.map((r) => r.layers), tax(cc, '1000000', '2026-01-01').minor], cc).toEqual([[[]], 0]);
    expect([of('AE').year, of('KY').unknown, aboutTax('KY')]).toEqual([{ start: '01-01', due: null }, [], undefined]);
    // Oman: none in 2026, 5% above OMR 42,000 from 2028.
    expect([tax('OM', '100000', '2026-01-01'), tax('OM', '100000', '2028-01-01')]).toEqual([m('OMR', '0'), m('OMR', '2900')]);
    // A scale the research couldn't read is no tax charged, and told.
    expect([tax('AO', '1000000', '2026-01-01'), of('AO').unknown.includes('residents')]).toEqual([m('AOA', '0'), true]);
  });

  it('reads flat taxes, surtaxes and solidarity levies, a cap on the share, and the lower of two reckonings', () => {
    // Estonia's 22% after €8,400; Bulgaria's 10%; Ukraine's 18% and the 5% military tax.
    expect([tax('EE', '50000', '2026-01-01'), tax('BG', '50000', '2026-01-01'), tax('UA', '100000', '2026-01-01')]).toEqual([m('EUR', '9152'), m('EUR', '5000'), m('UAH', '23000')]);
    // Portugal's scale and its 2.5% solidarity above €80,000; Liechtenstein's municipalities adding 150% of the national tax; Jordan's 1% above JOD 200,000.
    expect([tax('PT', '100000', '2026-01-01'), tax('LI', '100000', '2026-01-01'), tax('JO', '300000', '2026-01-01').minor - tax('JO', '200000', '2026-01-01').minor]).toEqual([m('EUR', '37112.73'), m('CHF', '8139.85'), (100000 * 0.25 + 1000) * 1000]);
    // Congo's IPR never above 30% of the base.
    expect([tax('CD', '100000000', '2026-01-01'), tax('CD', '10000000', '2026-01-01')]).toEqual([m('CDF', '30000000'), m('CDF', '1266720')]);
    // Hong Kong: the lower of the progressive scale and the standard rate; 2025-26's HK$3,000 reduction off either.
    expect([tax('HK', '3000000', '2026-04-01'), tax('HK', '3000000', '2025-04-01'), tax('HK', '300000', '2026-04-01')]).toEqual([m('HKD', '447300'), m('HKD', '444300'), m('HKD', '8000')]);
    // Jersey: 20% of the income, or 26% above the exemption limit, whichever is less.
    expect([tax('JE', '100000', '2026-01-01'), tax('JE', '30000', '2026-01-01')]).toEqual([m('GBP', '20000'), m('GBP', '2275')]);
  });

  it('reads figures written in an indexed unit, by the quarter, the week or the thousand, an allowance of several', () => {
    // Kazakhstan's 10% band in MCI is the research's own KZT figure; the Isle of Man's weekly floor over the year is Class 4's.
    expect(of('KZ').residents[0]?.layers[0]?.bands?.[0]?.to).toBe(String((research('KZ').figures[0]?.value as { band10UpToKZT: number }).band10UpToKZT));
    expect(of('IM').social.employee[0]?.[0]?.from).toBe(of('IM').social.self[0]?.[0]?.from);
    expect([of('CO').residents[0]?.layers[0]?.bands?.[1]?.from, of('FM').social.employee[0]?.[0]?.to, of('GR').residents[0]?.layers[0]?.taper, of('TW').residents[0]?.layers[0]?.less]).toEqual(['57087660', '28000', { from: '12000', rate: '0.02' }, '237000']);
  });

  it('withholds nothing where the research says nothing is withheld, and tells where a place has no taxing state', () => {
    expect([pay('NC', {}).p.tax, pay('AE', {}).p.tax, pay('HK', { work: 'author' }).p.tax]).toEqual([0, 0, 0]);
    expect([taxOf('AN'), taxOf('AQ'), aboutTax('AQ')]).toEqual([undefined, undefined, t(UNKEPT_LINE, { country: 'Antarctica', missing: `${Object.values(MISSING).slice(0, -1).join(', ')} and ${MISSING.year}` })]);
    expect(aboutTax('AG')).toBe(t(UNKEPT_LINE, { country: 'Antigua and Barbuda', missing: `${MISSING.business}, ${MISSING.social} and ${MISSING.nonResident}` }));
  });
});

describe('pay and the reckoning, around the world', () => {
  it('in a country with no income tax: nothing withheld, nothing due', () => {
    const { s, p } = pay('AE', { gross: m('AED', '100000') });
    expect(p).toMatchObject({ currency: 'AED', gross: 10_000_000, tax: 0, social: 0, vat: 0 });
    const { c, scheduled } = ctx(day(2027, 1, 1));
    reckon(s, item('AE', '2026-01-01'), c);
    expect([s.tax.returns[0]?.tax, s.tax.returns[0]?.balance, s.tax.returns[0]?.due, scheduled]).toEqual([0, 0, null, []]);
  });

  it("in a territory that follows its sovereign: the sovereign's contributions and scale, its own receipts tax", () => {
    const { s, p } = pay('GU', { gross: m('USD', '10000') });
    expect([p.social, p.tax]).toEqual([76_500, 0]);
    pay('GU', { work: 'producer', gross: m('USD', '10000') }, s);
    const { c, scheduled } = ctx(day(2027, 1, 1));
    reckon(s, item('GU', '2026-01-01'), c);
    const r = s.tax.returns[0];
    // The year's $20,000 at the US scale after its standard deduction; self-employment tax and the 5% on the producer's fee.
    expect(r).toMatchObject({ income: 2_000_000, tax: residentTax(of('US'), money('USD', 2_000_000), '2026-01-01').minor, social: 153_000, turnover: 50_000, due: day(2027, 4, 15) });
    expect(r?.balance).toBe((r?.tax as number) + 153_000 + 50_000);
    expect(scheduled[0]?.at).toBe(day(2027, 4, 15));
  });

  it('under a flat tax: 22% withheld, refunded past the year\'s tax on the due date', () => {
    const { s, p } = pay('EE', {});
    expect([p.tax, p.social]).toEqual([220_000, 36_000]);
    reckon(s, item('EE', '2026-01-01'), ctx(day(2027, 1, 1)).c);
    expect(s.tax.returns[0]).toMatchObject({ tax: 35_200, withheld: 220_000, balance: 35_200 - 220_000, due: day(2027, 10, 1) });
  });

  it('on a progressive scale with capped contributions: the cap reached, the scale climbed', () => {
    const { s, p } = pay('AT', { gross: m('EUR', '100000') });
    const second = pay('AT', { gross: m('EUR', '10000') }, s).p;
    expect([p.social, second.social]).toEqual([1_502_701, 0]);
    reckon(s, item('AT', '2026-01-01'), ctx(day(2027, 1, 1)).c);
    expect(s.tax.returns[0]).toMatchObject({ income: 11_000_000, tax: 3_872_082, social: 0, balance: 3_872_082, due: day(2027, 4, 30) });
  });

  it("charges VAT on a self-employed worker's fees, whatever the work, and a receipts tax past its threshold", () => {
    // Portugal's actors are paid as self-employed: 23% withheld, and VAT once the year's fees pass €15,000.
    const pt = life('EUR');
    expect(pay('PT', { gross: m('EUR', '10000') }, pt).p).toMatchObject({ tax: 230_000, vat: 0, social: 0 });
    expect(pay('PT', { gross: m('EUR', '10000') }, pt).p.vat).toBe(230_000);
    // The US Virgin Islands' 5% on all of a year's receipts once they reach USD 225,000, nothing below (told).
    const vi = (n: string) => {
      const s = life('USD');
      pay('VI', { work: 'producer', gross: m('USD', n) }, s);
      reckon(s, item('VI', '2026-01-01'), ctx(day(2027, 1, 1)).c);
      return s.tax.returns[0]?.turnover;
    };
    expect([vi('225000'), vi('225001')]).toEqual([0, 1_125_005]);
  });
});
