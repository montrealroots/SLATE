import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { begin, pass, type Context, type Item, type Json } from '../../../src/core/frame/frame.ts';
import { fromMajor, money, type CurrencyCode } from '../../../src/core/money/money.ts';
import { daysFromCivil, SECONDS_PER_DAY } from '../../../src/core/time/calendar.ts';
import { t } from '../../../src/core/text/text.ts';
import { exchangeOn } from '../../../src/money/rates/rates.ts';
import {
  aboutTax,
  contributions,
  dateOf,
  dueOf,
  earn,
  inCurrency,
  major,
  minor,
  MISSING,
  onBands,
  onLayer,
  onZones,
  OWED,
  reckon,
  RECKON_KIND,
  residentTax,
  settle,
  SETTLE_KIND,
  TAX,
  TAX_START,
  taxOf,
  UNKEPT_LINE,
  withheldOn,
  yearOf,
  type Country,
  type EarnArgs,
  type Earning,
  type Layer,
} from '../../../src/money/tax/tax.ts';
import { readTax } from '../../../tools/money/tax/compile.ts';
import { falsifyAny } from '../../support/falsify-core.ts';
import { ACCOUNT, bank, minorIn, purse } from '../../support/purse.ts';

const root = resolve(import.meta.dirname, '../../..');
const DAY = SECONDS_PER_DAY;
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d) * DAY;
const AUGUST = day(2026, 8, 1);
const q = (n: string) => major(fromMajor('USD', n));
const of = (c: string) => TAX[c] as Country;
const m = (c: string, n: string) => fromMajor(c as CurrencyCode, n);

function ctx(now: number) {
  const scheduled: { kind: string; at: number; data: Json }[] = [];
  const notices: { kind: string; data: Json }[] = [];
  const c: Context = {
    now,
    draws: () => {
      throw new Error('no draws');
    },
    items: () => [],
    schedule: (kind, at, data = null) => scheduled.push({ kind, at, data }),
    cancel: () => undefined,
    notices: () => [],
    notify: (kind, data = null) => notices.push({ kind, data }),
    markRead: () => undefined,
  };
  return { c, scheduled, notices };
}

const life = (currency = 'USD', minorUnits = 100_000_000, terms = bank(currency)): Earning => purse(currency, minorUnits, terms);
const args = (o: Partial<EarnArgs> = {}): EarnArgs => ({ account: ACCOUNT, payer: 'production', country: 'US', home: 'US', work: 'performer', gross: m('USD', '3849'), what: 'pay', ...o });
const research = (cc: string) => JSON.parse(readFileSync(join(root, `research/sources/money/tax/${cc}.json`), 'utf8')) as { figures: { value: Record<string, unknown> }[] };

describe("a country's tax", () => {
  it('is each country\'s own, every figure as the research gives it', () => {
    // The compiled figures are the research's, read where the readings place them, from the files the register cites.
    const read = readTax(root);
    expect(TAX).toEqual(read.countries);
    // Every place of the map but the two with no taxing state and the six whose research found nothing (their register entries blockers).
    expect([Object.keys(TAX).length, read.noState]).toEqual([244, ['AN', 'AQ']]);
    for (const cc of ['CU', 'ER', 'IR', 'ST', 'SY', 'TJ', 'AN', 'AQ']) expect(taxOf(cc), cc).toBeUndefined();
    // Every scale read whole from the research: each band's from, to and rate, exactly.
    const gb = research('GB').figures[0]?.value['brackets'] as { from: number; to: number | null; rate: number }[];
    expect(of('GB').residents[0]?.layers[0]?.bands).toEqual(gb.map((b) => ({ from: String(b.from), to: b.to === null ? null : String(b.to), rate: String(b.rate) })));
    expect(of('US').residents[0]?.layers[0]).toEqual({ less: '16100', bands: (research('US').figures[0]?.value['brackets'] as { from: number; to: number | null; rate: number }[]).map((b) => ({ from: String(b.from), to: b.to === null ? null : String(b.to), rate: String(b.rate) })) });
    // A monthly scale over the year (Brazil's INSS), an employee's and an employer's shares both (Canada's self-employed CPP).
    expect(of('BR').social.employee[0]?.at(-1)).toEqual({ from: '52251.24', to: '101706.6', rate: '0.14' });
    expect(of('CA').social.self[0]).toEqual([{ from: '3500', to: '74600', rate: '0.119' }]);
    // A rate on a share of the pay, as the research writes it in words (France's CSG on 98.25%).
    expect(of('FR').social.employee[2]).toEqual([{ from: '0', to: null, rate: '0.09039' }]);
    // Germany's § 32a, zone by zone, and its solidarity surcharge's cap.
    expect(of('DE').residents[0]?.layers[0]?.zones?.[2]).toEqual({ from: '17799', to: '69878', quad: ['173.10', '2397', '1034.87'] });
    expect(of('DE').residents[0]?.layers[0]?.surtax).toEqual({ rate: '0.055', over: '20350', cap: '0.119' });
    // The year, and when its return is due.
    expect([of('GB').year, of('AU').year, of('ZA').year, of('FR').year, of('MX').year, of('DK').year]).toEqual([
      { start: '04-06', due: { on: '01-31', after: 1 } },
      { start: '07-01', due: { on: '10-31', after: 0 } },
      { start: '03-01', due: { on: '10-23', after: 0 } },
      { start: '01-01', due: null },
      { start: '01-01', due: { on: '04-30', after: 1 } },
      { start: '01-01', due: { on: '07-01', after: 1 } },
    ]);
    // The resident's tax at incomes worked by hand from each country's scale.
    const cases: [string, string, string, string][] = [
      ['US', '100000', '2026-01-01', '13170.00'], // (100,000 - 16,100): 10% of 12,400 + 12% of 38,000 + 22% of 33,500
      ['GB', '60000', '2026-04-06', '11432.00'], // 20% of 37,700 + 40% of 9,730
      ['DE', '50000', '2026-01-01', '10548.33'], // zone 3: (173.10z + 2397)z + 1034.87, z = 3.2201
      ['DE', '400000', '2026-01-01', '169358.75'], // 0.45x - 19,470.38, and 5.5% on it
      ['JP', '5000000', '2026-01-01', '1084522'], // 572,500 and 2.1% on it, and the resident tax's 10%
      ['CA', '80000', '2026-01-01', '10292.72'], // 14% and 20.5%, less 14% of 16,452
      ['ES', '40000', '2026-01-01', '4723.50'], // the state scale less its tax on the 5,550 minimum
      ['ZA', '400000', '2026-03-01', '67417.00'], // the 2027 scale less the 17,820 rebate
      ['ZA', '400000', '2025-03-01', '69272.00'], // the 2026 scale less the 17,235 rebate
      ['NL', '50000', '2026-01-01', '16257.71'], // less the general credit, 3,115 less 6.398% above 29,736
      ['IN', '1200000', '2026-04-01', '0.00'], // the rebate takes the 60,000 to nothing up to 12 lakh
      ['IN', '1300000', '2026-04-01', '78000.00'], // no rebate above it, and 4% cess
      ['DK', '500000', '2026-01-01', '128882.73'], // state and Copenhagen, after am-bidrag and the work deduction
      ['NO', '600000', '2026-01-01', '98582.60'], // 22% after the minimum deduction and personal allowance, and trinnskatt
      ['MX', '300000', '2026-01-01', '41419.92'], // 22,282.14 and 21.36% above 210,403.70
      ['BR', '100000', '2026-01-01', '16595.34'], // 27.5% less 10,904.66
      ['IE', '60000', '2026-01-01', '12532.82'], // 20% and 40% less 4,000 of credits, and USC
      ['AU', '100000', '2026-07-01', '22520.00'], // 15% and 30%, and the 2% Medicare levy
      ['AU', '28011', '2026-07-01', '1471.65'], // no levy at the threshold
      ['AU', '100000', '2025-07-01', '22788.00'], // 2025-26's 16%
      ['KR', '50000000', '2026-01-01', '6616500'], // after the 1.5m deduction, and a tenth of it locally
      ['FR', '40000', '2026-01-01', '5103.99'], // 11% and 30%
      ['IT', '40000', '2026-01-01', '10892.00'], // 23% and 33%, and the regional 1.23%
      ['SE', '700000', '2026-01-01', '238060.00'], // the municipal average and 20% above 643,000
      ['NG', '5000000', '2026-01-01', '690000.00'], // 15% to 3m, 18% above
      ['NZ', '100000', '2026-04-01', '22877.50'], // 10.5%, 17.5%, 30% and 33%
    ];
    for (const [c, income, year, tax] of cases) expect(residentTax(of(c), m(of(c).currency, income), year), `${c} ${income}`).toEqual(m(of(c).currency, tax));
  });

  it("tells the player what of it isn't known", () => {
    expect(UNKEPT_LINE).toBe('tax.unkept');
    expect(aboutTax('GB')).toBe(t(UNKEPT_LINE, { country: 'United Kingdom', missing: "some of the allowances and credits, the region's or the town's own tax, what an employer withholds from wages, what a non-resident owes beyond what is withheld and the relief an author's earnings are given" }));
    expect(MISSING).toStrictEqual({
      residents: 'the rates a resident pays this year',
      business: "the tax on a freelancer's business profits",
      credits: 'some of the allowances and credits',
      regional: "the region's or the town's own tax",
      social: 'some of the social contributions',
      wages: 'what an employer withholds from wages',
      withholding: 'some of what is withheld at source',
      nonResident: 'what a non-resident owes beyond what is withheld',
      authors: "the relief an author's earnings are given",
      scheme: 'the flat-rate scheme for small freelancers',
      vat: "the VAT on a freelancer's fee",
      year: "when the year's return is due",
    });
    expect(aboutTax('ZA')).toBe("Some of how South Africa taxes a screen worker's pay isn't known to this game yet: what an employer withholds from wages.");
    // The research's own blockers are told: France's 2026 scale, India's VAT.
    expect(of('FR').unknown).toEqual(['residents', 'credits', 'social', 'wages', 'nonResident', 'authors', 'year']);
    expect(of('IN').unknown).toContain('vat');
    // A country whose research found nothing: all of it.
    expect(aboutTax('CU')).toBe(t(UNKEPT_LINE, { country: 'Cuba', missing: `${Object.values(MISSING).slice(0, -1).join(', ')} and ${MISSING.year}` }));
    expect([taxOf('CU'), taxOf('toString'), taxOf('US')?.currency]).toEqual([undefined, undefined, 'USD']);
    // A country whose tax is all known: nothing to tell.
    expect([of('KY').unknown, aboutTax('KY')]).toEqual([[], undefined]);
  });
});

describe('the arithmetic', () => {
  const bands = [{ from: '0', to: '100', rate: '0.1' }, { from: '100', to: null, rate: '0.2' }];
  it('takes each band on the part it spans, a zone by its formula, a layer after its allowances and less its credits', () => {
    expect([onBands(bands, q('50')), onBands(bands, q('100')), onBands(bands, q('150'))].map((x) => minor('USD', x))).toEqual([m('USD', '5'), m('USD', '10'), m('USD', '20')]);
    expect(minor('USD', onBands([{ from: '10', to: '20', rate: '0.5' }], q('5')))).toEqual(m('USD', '0'));
    const zones = of('DE').residents[0]?.layers[0]?.zones ?? [];
    expect([minor('EUR', onZones(zones, q('12348'))), minor('EUR', onZones(zones, q('12349'))), minor('EUR', onZones(zones, q('69878'))), minor('EUR', onZones(zones, q('100000')))]).toEqual([m('EUR', '0'), m('EUR', '0.14'), m('EUR', '18213.13'), m('EUR', '30864.37')]);
    const layer = (l: Partial<Layer>, income: string) => minor('USD', onLayer({ bands, ...l }, q(income)));
    expect(layer({ over: '100' }, '100')).toEqual(m('USD', '0'));
    expect(layer({ over: '100' }, '101')).toEqual(m('USD', '10.2'));
    expect(layer({ less: '50' }, '150')).toEqual(m('USD', '10'));
    expect(layer({ less: '500' }, '150')).toEqual(m('USD', '0'));
    expect(layer({ shares: [{ rate: '0.5', max: null }] }, '200')).toEqual(m('USD', '10'));
    expect(layer({ shares: [{ rate: '0.5', max: '20' }] }, '200')).toEqual(m('USD', '26'));
    expect(layer({ credit: '3' }, '150')).toEqual(m('USD', '17'));
    expect(layer({ credit: '30' }, '150')).toEqual(m('USD', '0'));
    expect([layer({ credit: '3', creditUpTo: '150' }, '150'), layer({ credit: '3', creditUpTo: '150' }, '151')]).toEqual([m('USD', '17'), m('USD', '20.2')]);
    expect([layer({ credit: '3', taper: { from: '100', rate: '0.02' } }, '150'), layer({ credit: '3', taper: { from: '100', rate: '0.02' } }, '90'), layer({ credit: '3', taper: { from: '100', rate: '0.1' } }, '150')]).toEqual([m('USD', '18'), m('USD', '6'), m('USD', '20')]);
    expect(layer({ minimum: '50' }, '150')).toEqual(m('USD', '15'));
    expect(layer({ surtax: { rate: '0.1' } }, '150')).toEqual(m('USD', '22'));
    expect([layer({ surtax: { rate: '0.1', over: '20' } }, '150'), layer({ surtax: { rate: '0.1', over: '19' } }, '150')]).toEqual([m('USD', '20'), m('USD', '22')]);
    expect([layer({ surtax: { rate: '0.1', over: '19', cap: '0.5' } }, '150'), layer({ surtax: { rate: '0.1', over: '10', cap: '0.5' } }, '150')]).toEqual([m('USD', '20.5'), m('USD', '22')]);
    // A layer of zones takes them; one of bands its minimum's tax on them.
    expect(minor('EUR', onLayer({ zones }, q('12349')))).toEqual(m('EUR', '0.14'));
  });

  it('sums the contributions of every scale, and withholds a scheme above its threshold, on its share, with its surtax', () => {
    expect(minor('USD', contributions([bands, [{ from: '0', to: '50', rate: '0.5' }]], q('150')))).toEqual(m('USD', '45'));
    expect(minor('USD', contributions([], q('150')))).toEqual(m('USD', '0'));
    const s = { bands, final: true };
    expect(minor('USD', withheldOn(s, q('150'), q('0')))).toEqual(m('USD', '20'));
    expect([withheldOn({ ...s, over: '150' }, q('150'), q('1000')), withheldOn({ ...s, over: '149' }, q('150'), q('0'))].map((x) => minor('USD', x))).toEqual([m('USD', '0'), m('USD', '20')]);
    expect([withheldOn({ ...s, over: '200', yearly: true }, q('150'), q('50')), withheldOn({ ...s, over: '200', yearly: true }, q('150'), q('51'))].map((x) => minor('USD', x))).toEqual([m('USD', '0'), m('USD', '20')]);
    expect(minor('USD', withheldOn({ ...s, deduct: '0.5' }, q('150'), q('0')))).toEqual(m('USD', '7.5'));
    expect(minor('USD', withheldOn({ ...s, surtax: '0.5' }, q('150'), q('0')))).toEqual(m('USD', '30'));
  });

  it('keeps the year each country keeps, and its return\'s due date', () => {
    expect([yearOf(of('GB'), '2026-04-05'), yearOf(of('GB'), '2026-04-06')]).toEqual([
      { start: '2025-04-06', ends: day(2026, 4, 6) },
      { start: '2026-04-06', ends: day(2027, 4, 6) },
    ]);
    expect([dueOf(of('GB'), '2026-04-06'), dueOf(of('AU'), '2026-07-01'), dueOf(of('ZA'), '2025-03-01'), dueOf(of('US'), '2026-01-01'), dueOf(of('FR'), '2026-01-01')]).toEqual([day(2028, 1, 31), day(2027, 10, 31), day(2026, 10, 23), day(2027, 4, 15), null]);
    expect(dateOf(AUGUST + DAY - 1)).toBe('2026-08-01');
    expect(inCurrency(m('USD', '1'), 'USD', '2026-08-01')).toEqual(m('USD', '1'));
    expect(inCurrency(m('USD', '1000'), 'GBP', '2026-08-01')).toEqual(m('GBP', '756'));
    expect(() => inCurrency(m('USD', '1'), 'GBP', '2025-01-01')).toThrow("the rate between USD and GBP isn't known to this game");
  });
});

describe('pay', () => {
  it("is paid into the ledger less what the work's country withholds", () => {
    // A US performer at home: Social Security and Medicare withheld; the year's reckoning scheduled at its end.
    const s = life();
    const { c, scheduled } = ctx(AUGUST);
    const p = earn(s, args(), c);
    expect(p).toEqual({ at: AUGUST, what: 'pay', country: 'US', home: 'US', work: 'performer', account: ACCOUNT, currency: 'USD', gross: 384_900, tax: 0, social: 29_445, vat: 0, counted: 384_900, credited: 0 });
    expect([minorIn(s.ledger, ACCOUNT), minorIn(s.ledger, 'world:production:USD'), minorIn(s.ledger, 'world:social:US:USD')]).toEqual([100_000_000 + 384_900 - 29_445, -384_900, 29_445]);
    expect(s.ledger.accounts.map((a) => a.id)).not.toContain('world:tax:US:USD');
    expect(scheduled).toEqual([{ kind: RECKON_KIND, at: day(2027, 1, 1), data: { country: 'US', year: '2026-01-01' } }]);
    // Again in the year: no second reckoning; Social Security stops at its wage base.
    earn(s, args({ gross: m('USD', '184000') }), c);
    const third = earn(s, args({ gross: m('USD', '10000') }), c);
    expect(scheduled).toHaveLength(1);
    // Past $184,500 in the year: Medicare's 1.45% alone.
    expect(third.social).toBe(14_500);
    expect(s.tax.paid).toHaveLength(3);
    // The next year is reckoned apart, and so is a year lived elsewhere.
    const next = ctx(day(2027, 1, 1));
    earn(s, args(), next.c);
    expect(next.scheduled).toEqual([{ kind: RECKON_KIND, at: day(2028, 1, 1), data: { country: 'US', year: '2027-01-01' } }]);
    const moved = life();
    earn(moved, args({ home: 'GB' }), ctx(AUGUST).c);
    const home = ctx(AUGUST);
    earn(moved, args(), home.c);
    expect(home.scheduled).toEqual([{ kind: RECKON_KIND, at: day(2027, 1, 1), data: { country: 'US', year: '2026-01-01' } }]);
  });

  it("withholds a non-resident's at the artistes' rate, and carries the rest into the account's currency with the bank's share", () => {
    const s = life('USD', 0, bank('USD', { debit: { fx: '3' } }));
    const { c, scheduled } = ctx(AUGUST);
    const p = earn(s, args({ country: 'CA', gross: m('CAD', '1000') }), c);
    expect(p).toMatchObject({ country: 'CA', home: 'US', currency: 'CAD', gross: 100_000, tax: 23_000, social: 0, counted: exchangeOn(m('CAD', '1000'), 'USD', '2026-08-01')?.money.minor, credited: exchangeOn(m('CAD', '230'), 'USD', '2026-08-01')?.money.minor });
    expect([minorIn(s.ledger, 'world:production:CAD'), minorIn(s.ledger, 'world:tax:CA:CAD'), minorIn(s.ledger, 'world:Test Bank:CAD'), minorIn(s.ledger, 'world:Test Bank:USD')]).toEqual([-100_000, 23_000, 77_000, -54_073 + 1_622]);
    expect(minorIn(s.ledger, ACCOUNT)).toBe(54_073 - 1_622);
    // The home country's reckoning, not the work's.
    expect(scheduled).toEqual([{ kind: RECKON_KIND, at: day(2027, 1, 1), data: { country: 'US', year: '2026-01-01' } }]);
    // No share where the bank states none.
    const plain = life('USD', 0);
    earn(plain, args({ country: 'CA', gross: m('CAD', '1000') }), ctx(AUGUST).c);
    expect(minorIn(plain.ledger, ACCOUNT)).toBe(54_073);
    expect(plain.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.map((x) => x.what)).toEqual(['pay']);
    expect(s.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.map((x) => x.what)).toEqual(['pay', 'fees']);
    // Withheld abroad while living where the research hasn't read: nothing to credit at home.
    expect(earn(life(), args({ country: 'CA', home: 'CU', gross: m('CAD', '1000') }), ctx(AUGUST).c)).toMatchObject({ tax: 23_000, counted: 0, credited: 0 });
  });

  it('pays in the country\'s currency, at the day\'s rate, where the agreement pays in another', () => {
    const s = life('GBP', 0);
    const p = earn(s, args({ country: 'GB', home: 'GB', gross: m('USD', '1000') }), ctx(AUGUST).c);
    expect([p.currency, p.gross, minorIn(s.ledger, 'world:production:GBP'), minorIn(s.ledger, ACCOUNT)]).toEqual(['GBP', 75_600, -75_600, 75_600]);
  });

  it('withholds by each country\'s scheme: by the payment, by the year, on a share, with a surtax', () => {
    const at = (cc: string, o: Partial<EarnArgs>) => earn(life(of(cc).currency), args({ country: cc, home: cc, ...o }), ctx(AUGUST).c);
    // Japan: 10.21% to a million yen, 20.42% above, from a resident's pay of every kind; no social at source.
    expect(at('JP', { gross: m('JPY', '1500000') })).toMatchObject({ tax: 204_200, social: 0 });
    expect(at('JP', { work: 'author', gross: m('JPY', '1000000') })).toMatchObject({ tax: 102_100 });
    // Italy: 20% on an author's taxable 75%.
    expect(at('IT', { work: 'author', gross: m('EUR', '1000') })).toMatchObject({ tax: 15_000 });
    // Korea: 3% from a freelance performer, nothing more at source.
    expect(at('KR', { gross: m('KRW', '1000000') })).toMatchObject({ tax: 30_000, social: 0 });
    // Germany: a non-resident's 15% and the 5.5% surcharge on it, from a payment above 250 euros only.
    const de = (n: string) => earn(life(), args({ country: 'DE', gross: m('EUR', n) }), ctx(AUGUST).c).tax;
    expect([de('250'), de('1000')]).toEqual([0, 15_825]);
    // The UK: a non-resident's 20% once the year's payments pass the personal allowance.
    const gb = life();
    const uk = (n: string) => earn(gb, args({ country: 'GB', gross: m('GBP', n) }), ctx(AUGUST).c).tax;
    expect([uk('10000'), uk('2570'), uk('5000')]).toEqual([0, 0, 100_000]);
    // Only the year's payments in that country count: not another country's, nor the last year's.
    const fresh = life();
    earn(fresh, args({ country: 'GB', gross: m('GBP', '12300') }), ctx(day(2026, 4, 5)).c);
    earn(fresh, args({ country: 'US', gross: m('USD', '20000') }), ctx(AUGUST).c);
    expect(earn(fresh, args({ country: 'GB', gross: m('GBP', '500') }), ctx(AUGUST).c).tax).toBe(0);
    // An employee's contributions run on the year's wages there as a resident: not a fee's, nor a non-resident's pay.
    const us = life();
    earn(us, args({ work: 'producer', gross: m('USD', '184500') }), ctx(AUGUST).c);
    earn(us, args({ home: 'GB', gross: m('USD', '184500') }), ctx(AUGUST).c);
    expect(earn(us, args({ gross: m('USD', '1000') }), ctx(AUGUST).c).social).toBe(7_650);
    // A country the research hasn't read withholds nothing, its pay counted at home at the day's rate.
    const cuba = earn(life(), args({ country: 'CU', gross: m('CUP', '100000') }), ctx(AUGUST).c);
    expect(cuba).toMatchObject({ currency: 'CUP', tax: 0, social: 0, counted: exchangeOn(m('CUP', '100000'), 'USD', '2026-08-01')?.money.minor });
    // Living where the research hasn't read: nothing counted, no reckoning.
    const away = ctx(AUGUST);
    expect(earn(life(), args({ home: 'CU' }), away.c)).toMatchObject({ tax: 0, social: 0, counted: 0, credited: 0 });
    expect(away.scheduled).toEqual([]);
  });

  it("charges VAT on a resident freelancer's fee once the year's fees pass the threshold, an author's at its own rate", () => {
    const s = life('GBP');
    const fee = (n: string, work: EarnArgs['work'] = 'producer') => earn(s, args({ country: 'GB', home: 'GB', work, gross: m('GBP', n) }), ctx(AUGUST).c);
    expect([fee('90000').vat, fee('10000').vat, fee('100', 'performer').vat]).toEqual([0, 200_000, 0]);
    expect(minorIn(s.ledger, 'world:production:GBP')).toBe(-(9_000_000 + 1_000_000 + 200_000 + 10_000));
    // The turnover is a resident's fees there: a part played, or a fee earned before living there, isn't.
    const t = life('GBP');
    earn(t, args({ country: 'GB', home: 'GB', work: 'performer', gross: m('GBP', '95000') }), ctx(AUGUST).c);
    earn(t, args({ country: 'GB', home: 'US', work: 'producer', gross: m('GBP', '95000') }), ctx(AUGUST).c);
    expect(earn(t, args({ country: 'GB', home: 'GB', work: 'producer', gross: m('GBP', '1000') }), ctx(AUGUST).c).vat).toBe(0);
    expect(earn(t, args({ country: 'GB', home: 'GB', work: 'author', gross: m('GBP', '89000') }), ctx(AUGUST).c).vat).toBe(0);
    expect(earn(t, args({ country: 'GB', home: 'GB', work: 'author', gross: m('GBP', '1000') }), ctx(AUGUST).c).vat).toBe(20_000);
    // The VAT collected is paid with the year's return.
    reckon(s, { id: 1, at: 0, kind: RECKON_KIND, data: { country: 'GB', year: '2026-04-06' } }, ctx(day(2027, 4, 6)).c);
    expect(s.tax.returns[0]?.vat).toBe(200_000);
    expect(s.tax.returns[0]?.balance).toBe((s.tax.returns[0]?.tax as number) + (s.tax.returns[0]?.social as number) + 200_000);
    // Spain's from the first euro, its authors exempt; France's authors at 10% above their own threshold.
    const es = (work: EarnArgs['work']) => earn(life('EUR'), args({ country: 'ES', home: 'ES', work, gross: m('EUR', '1000') }), ctx(AUGUST).c);
    expect([es('producer').vat, es('author').vat, es('producer').tax, es('author').tax]).toEqual([21_000, 0, 15_000, 15_000]);
    const fr = life('EUR');
    const author = (n: string) => earn(fr, args({ country: 'FR', home: 'FR', work: 'author', gross: m('EUR', n) }), ctx(AUGUST).c).vat;
    expect([author('40000'), author('10000'), author('1000')]).toEqual([0, 0, 10_000]);
    // A non-resident's fee bears none, nor a resident's where the country levies none.
    expect(earn(life(), args({ country: 'GB', work: 'producer', gross: m('GBP', '100000') }), ctx(AUGUST).c).vat).toBe(0);
    expect(earn(life(), args({ work: 'producer', gross: m('USD', '100000') }), ctx(AUGUST).c).vat).toBe(0);
  });

  it('is refused where no account is held, nothing is paid, or the rate isn\'t known', () => {
    expect(() => earn(life(), args({ account: 'everyday:9' }), ctx(AUGUST).c)).toThrow('no account everyday:9 is held at a bank');
    expect(() => earn(life(), args({ gross: m('USD', '0') }), ctx(AUGUST).c)).toThrow('pay is paid above nothing');
    expect(() => earn(life(), args({ country: 'CA', gross: m('CAD', '1') }), ctx(day(2025, 1, 1)).c)).toThrow("the rate between CAD and USD isn't known to this game");
  });
});

describe("the year's reckoning", () => {
  const item = (country: string, year: string, kind = RECKON_KIND): Item => ({ id: 1, at: 0, kind, data: { country, year } });

  it("taxes the year's income at the resident's scale less what was withheld", () => {
    const s = life();
    const { c } = ctx(AUGUST);
    earn(s, args({ gross: m('USD', '100000') }), c);
    earn(s, args({ country: 'CA', gross: m('CAD', '1000') }), c);
    earn(s, args({ work: 'author', gross: m('USD', '10000') }), c);
    // Pay while living elsewhere isn't this country's to reckon, nor the next year's.
    earn(s, args({ home: 'GB', gross: m('USD', '7000') }), c);
    earn(s, args({ gross: m('USD', '5000') }), ctx(day(2027, 2, 1)).c);
    const end = ctx(day(2027, 1, 1));
    reckon(s, item('US', '2026-01-01'), end.c);
    const canada = exchangeOn(m('CAD', '1000'), 'USD', '2026-08-01')?.money.minor as number;
    const income = 11_000_000 + canada;
    const tax = residentTax(of('US'), money('USD', income), '2026-01-01').minor;
    const self = Math.round(1_000_000 * (0.124 + 0.029));
    const credit = exchangeOn(m('CAD', '230'), 'USD', '2026-08-01')?.money.minor as number;
    expect(s.tax.returns).toEqual([{ country: 'US', year: '2026-01-01', account: ACCOUNT, income, tax, social: self, withheld: 0, credit, vat: 0, turnover: 0, balance: tax - credit + self, due: day(2027, 4, 15), settled: null }]);
    expect(end.scheduled).toEqual([{ kind: SETTLE_KIND, at: day(2027, 4, 15), data: { country: 'US', year: '2026-01-01' } }]);
    // Paid on the due date from the account the year's last pay went into.
    const before = minorIn(s.ledger, ACCOUNT);
    const paid = ctx(day(2027, 4, 15));
    settle(s, item('US', '2026-01-01', SETTLE_KIND), paid.c);
    expect([s.tax.returns[0]?.settled, before - minorIn(s.ledger, ACCOUNT), minorIn(s.ledger, 'world:tax:US:USD'), paid.notices]).toEqual(['paid', tax - credit + self, tax - credit + self, []]);
    expect(s.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.at(-1)?.what).toBe('tax');
  });

  it('credits tax withheld abroad up to the tax at home, and refunds what was withheld past it', () => {
    // A Korean performer's 3% withheld from a year's pay under the basic deduction comes back on the due date.
    const s = life('KRW');
    earn(s, args({ country: 'KR', home: 'KR', gross: m('KRW', '1000000') }), ctx(AUGUST).c);
    const { c, scheduled } = ctx(day(2027, 1, 1));
    reckon(s, item('KR', '2026-01-01'), c);
    const r = s.tax.returns[0];
    expect(r).toMatchObject({ income: 1_000_000, tax: 0, withheld: 30_000, credit: 0, social: Math.round(1_000_000 * 0.095), balance: 95_000 - 30_000 });
    expect(scheduled[0]?.at).toBe(day(2027, 5, 31));
    // Japan's withholding past the year's tax: a refund.
    const jp = life('JPY');
    earn(jp, args({ country: 'JP', home: 'JP', work: 'author', gross: m('JPY', '2000000') }), ctx(AUGUST).c);
    reckon(jp, item('JP', '2026-01-01'), ctx(day(2027, 1, 1)).c);
    const back = jp.tax.returns[0];
    expect(back).toMatchObject({ withheld: 306_300, tax: 304_652, balance: 304_652 - 306_300 });
    settle(jp, item('JP', '2026-01-01', SETTLE_KIND), ctx(day(2027, 3, 15)).c);
    expect([back?.settled, minorIn(jp.ledger, ACCOUNT), minorIn(jp.ledger, 'world:tax:JP:JPY')]).toEqual(['refunded', 100_000_000 + 2_000_000 - 306_300 + 1_648, 306_300 - 1_648]);
    // Straight into an account in the country's currency: no bank between.
    expect(jp.ledger.accounts.map((a) => a.id)).not.toContain('world:Test Bank:JPY');
    expect(jp.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.map((x) => x.what)).toEqual(['the family', 'pay', 'tax refund']);
    // Through the bank, with no share where it states none.
    const usd = life('USD', 0);
    earn(usd, args({ country: 'JP', home: 'JP', work: 'author', gross: m('JPY', '2000000') }), ctx(AUGUST).c);
    reckon(usd, item('JP', '2026-01-01'), ctx(day(2027, 1, 1)).c);
    settle(usd, item('JP', '2026-01-01', SETTLE_KIND), ctx(day(2027, 3, 15)).c);
    expect(usd.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.map((x) => x.what)).toEqual(['pay', 'tax refund']);
    // Tax withheld abroad beyond the tax at home is credited only up to it.
    const big = life();
    earn(big, args({ country: 'CA', gross: m('CAD', '100') }), ctx(AUGUST).c);
    earn(big, args({ country: 'CA', gross: m('CAD', '100000') }), ctx(AUGUST).c);
    reckon(big, item('US', '2026-01-01'), ctx(day(2027, 1, 1)).c);
    expect(big.tax.returns[0]).toMatchObject({ credit: big.tax.returns[0]?.tax, balance: 0 });
  });

  it("is owed, and the player told, where the account can't pay it; refunded into an account in another currency", () => {
    const s = life('USD', 0);
    earn(s, args({ work: 'author', gross: m('USD', '100000') }), ctx(AUGUST).c);
    const settles = ctx(day(2027, 1, 1));
    reckon(s, item('US', '2026-01-01'), settles.c);
    s.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.push({ at: day(2027, 2, 1), tx: 0, what: 'spent', amount: -100_000_00 });
    const { c, notices } = ctx(day(2027, 4, 15));
    settle(s, item('US', '2026-01-01', SETTLE_KIND), c);
    expect([s.tax.returns[0]?.settled, notices]).toEqual(['owed', [{ kind: OWED, data: { country: 'US', year: '2026-01-01', balance: s.tax.returns[0]?.balance as number } }]]);
    // A refund carried into the account's currency at the day's rate, with the bank's share.
    const abroad = life('USD', 0, bank('USD', { debit: { fx: '3' } }));
    earn(abroad, args({ country: 'JP', home: 'JP', work: 'author', gross: m('JPY', '2000000') }), ctx(AUGUST).c);
    reckon(abroad, item('JP', '2026-01-01'), ctx(day(2027, 1, 1)).c);
    const before = minorIn(abroad.ledger, ACCOUNT);
    settle(abroad, item('JP', '2026-01-01', SETTLE_KIND), ctx(day(2027, 3, 15)).c);
    const dollars = exchangeOn(m('JPY', '1648'), 'USD', '2027-03-15')?.money.minor as number;
    expect([abroad.tax.returns[0]?.settled, minorIn(abroad.ledger, ACCOUNT) - before]).toEqual(['refunded', dollars - Math.round(dollars * 0.03)]);
    expect(abroad.ledger.accounts.find((a) => a.id === ACCOUNT)?.postings.slice(-2).map((x) => x.what)).toEqual(['tax refund', 'fees']);
    // A return due nowhere the research says, or with nothing to settle, schedules nothing.
    const fr = life('EUR');
    earn(fr, args({ country: 'FR', home: 'FR', work: 'author', gross: m('EUR', '1000') }), ctx(AUGUST).c);
    const none = ctx(day(2027, 1, 1));
    reckon(fr, item('FR', '2026-01-01'), none.c);
    expect([fr.tax.returns[0]?.due, none.scheduled]).toEqual([null, []]);
    const zero = life();
    earn(zero, args({ gross: m('USD', '100') }), ctx(AUGUST).c);
    const nil = ctx(day(2027, 1, 1));
    reckon(zero, item('US', '2026-01-01'), nil.c);
    expect([zero.tax.returns[0]?.balance, nil.scheduled]).toEqual([0, []]);
  });

  it('runs through the frame as declared: the reckoning at the year\'s end, the balance on its due date', () => {
    const s = life();
    earn(s, args({ work: 'author', gross: m('USD', '50000') }), ctx(AUGUST).c);
    const l = begin('0123456789abcdef', AUGUST, s);
    const scheduled = { ...l, frame: { ...l.frame, next: 2, schedule: [{ id: 1, at: day(2027, 1, 1), kind: RECKON_KIND, data: { country: 'US', year: '2026-01-01' } }] } };
    const done = pass(scheduled, day(2027, 5, 1)).life;
    expect(done.slices.tax.returns[0]?.settled).toBe('paid');
    expect(minorIn(done.slices.ledger, 'world:tax:US:USD')).toBe(done.slices.tax.returns[0]?.balance);
    expect(TAX_START).toEqual({ paid: [], returns: [] });
  });

  it('tax.reckon: more income in the year is more tax due', () => {
    const due = (n: string) => {
      const s = life();
      earn(s, args({ gross: m('USD', n) }), ctx(AUGUST).c);
      reckon(s, item('US', '2026-01-01'), ctx(day(2027, 1, 1)).c);
      return s.tax.returns[0]?.balance;
    };
    falsifyAny({ feature: 'tax.reckon', claim: 'bites', says: "a year's pay of $200,000 leaves more tax due than one of $50,000", base: '50000', twin: '200000', outcome: due });
  });

  it('tax.settle: the balance due leaves the account on the due date', () => {
    const left = (n: string) => {
      const s = life();
      earn(s, args({ work: 'author', gross: m('USD', n) }), ctx(AUGUST).c);
      reckon(s, item('US', '2026-01-01'), ctx(day(2027, 1, 1)).c);
      settle(s, item('US', '2026-01-01', SETTLE_KIND), ctx(day(2027, 4, 15)).c);
      return minorIn(s.ledger, ACCOUNT);
    };
    falsifyAny({ feature: 'tax.settle', claim: 'bites', says: 'a larger balance due takes more from the account', base: '20000', twin: '80000', outcome: left });
  });
});

describe('the line for the game\'s own readings', () => {
  it("tells the player its own readings are the game's", async () => {
    const { MODEL_LINE } = await import('../../../src/money/tax/tax.ts');
    const { t } = await import('../../../src/core/text/text.ts');
    expect(MODEL_LINE).toBe('tax.model');
    expect(t(MODEL_LINE)).toContain("SLATE's own");
  });
});
