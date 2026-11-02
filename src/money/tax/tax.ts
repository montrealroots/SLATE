import { defineKind, defineNotice, type Context, type Item, type Json } from '../../core/frame/frame.ts';
import { minorUnits, money, rational, roundHalfEven, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { civilFromDays, daysFromCivil, SECONDS_PER_DAY } from '../../core/time/calendar.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { charge, converted, heldOf, type Holding } from '../accounts/accounts.ts';
import { move, WORLD, type Leg } from '../ledger/ledger.ts';
import { exchangeOn } from '../rates/rates.ts';
import data from './tax.json' with { type: 'json' };

/**
 * The tax on a screen worker's pay (BUILD-ORDER layer 3; the owner, 2026-11-01: "Build those first 3 starting with
 * ledger first"), on each country's own terms as the research reads them (src/money/tax/tax.json, compiled by
 * tools/money/tax from research/sources/money/tax, register facts money.tax.<CC>).
 *
 * Pay: what the person earns (a part played, a director's fee, a producer's fee, a script sold or optioned) is paid
 * from the payer's world account into the account the person names, less what the work's country withholds at source:
 * from a resident's pay of that kind at the rate its law sets; from a non-resident's at the artistes' or the
 * non-residents' rate, above any threshold, with any surtax; and, from an employee's wages, the employee's social
 * contributions on the year's pay so far. The withheld part goes to the country's tax authority, the contributions to
 * its social insurance, each a world account. A resident freelancer's fee bears VAT once the year's fees pass the
 * threshold. The pay is made in the country's currency, at the day's rate where the agreement pays in another, and
 * carried into an account kept in another at the day's rate with the bank's share for it.
 *
 * Where the person lives is where they're resident, named by the engine that pays them (the person's own reading:
 * until the residence is held, the country of their first citizenship, money.tax.model).
 *
 * The year's reckoning: at the end of each tax year of the country the person lives in, the year's income from
 * everywhere, at the day's rate of each payment, is taxed at the resident's scale; less what that country withheld,
 * less what was withheld abroad (up to the tax, as a treaty's credit gives it: the game's reading), plus a
 * self-employed worker's contributions on their fees, the VAT collected and a tax on their gross receipts where the
 * country levies one; the balance is paid or refunded on the
 * return's due date, and where the account can't pay it, it is owed and the player told. What the research couldn't find
 * or the game doesn't model isn't charged, and the player is told what (`aboutTax`).
 */

const DAY = SECONDS_PER_DAY;

export const WORKS = ['performer', 'director', 'producer', 'author'] as const;
export type Work = (typeof WORKS)[number];
/** What a country's tax can leave untold, as the compile names it. */
export type Unknown = 'residents' | 'business' | 'credits' | 'regional' | 'social' | 'wages' | 'withholding' | 'nonResident' | 'authors' | 'scheme' | 'vat' | 'year';

export interface Band {
  readonly from: string;
  readonly to: string | null;
  readonly rate: string;
}
export type Zone = { readonly from: string; readonly to: string | null; readonly quad: readonly [string, string, string] } | { readonly from: string; readonly to: string | null; readonly rate: string; readonly minus: string };
export interface Layer {
  readonly bands?: readonly Band[];
  readonly zones?: readonly Zone[];
  readonly less?: string;
  readonly shares?: readonly { readonly rate: string; readonly max: string | null }[];
  readonly over?: string;
  readonly credit?: string;
  readonly creditUpTo?: string;
  readonly taper?: { readonly from: string; readonly rate: string };
  readonly minimum?: string;
  readonly surtax?: { readonly rate: string; readonly over?: string; readonly cap?: string };
  readonly most?: string;
  readonly or?: Layer;
}
export interface Scheme {
  readonly bands: readonly Band[];
  readonly deduct?: string;
  readonly over?: string;
  readonly yearly?: true;
  readonly surtax?: string;
  readonly final: boolean;
}
export interface Country {
  readonly currency: string;
  readonly year: { readonly start: string; readonly due: { readonly on: string; readonly after: number } | null };
  readonly residents: readonly { readonly from: string; readonly layers: readonly Layer[] }[];
  readonly employed: readonly Work[];
  readonly social: { readonly employee: readonly (readonly Band[])[]; readonly self: readonly (readonly Band[])[] };
  readonly withholding: Readonly<Partial<Record<Work, Scheme>>>;
  readonly nonResident: Readonly<Partial<Record<Work, Scheme>>>;
  readonly vat: { readonly rate: string; readonly threshold: string | null; readonly authors?: { readonly rate: string; readonly threshold?: string | null } } | null;
  readonly turnover?: { readonly rate: string; readonly threshold: string | null };
  readonly unknown: readonly Unknown[];
}

export const TAX = (data as unknown as { countries: Readonly<Record<string, Country>> }).countries;

/** A country's tax, where the research reads it. */
export const taxOf = (country: string): Country | undefined => (Object.hasOwn(TAX, country) ? TAX[country] : undefined);

// Exact arithmetic in major units: a fraction of whole numbers.
type Q = { readonly num: bigint; readonly den: bigint };
const Z: Q = { num: 0n, den: 1n };
const r = (text: string): Q => rational(text);
const plus = (a: Q, b: Q): Q => ({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
const sub = (a: Q, b: Q): Q => ({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
const mul = (a: Q, b: Q): Q => ({ num: a.num * b.num, den: a.den * b.den });
const cmp = (a: Q, b: Q): number => Math.sign(Number(a.num * b.den - b.num * a.den));
// Stryker disable next-line EqualityOperator: of two equal, either is the least.
const min = (a: Q, b: Q): Q => (cmp(a, b) < 0 ? a : b);
// Stryker disable next-line EqualityOperator: of two equal, either is the most.
const max = (a: Q, b: Q): Q => (cmp(a, b) > 0 ? a : b);

/** An amount in major units, exactly. */
export const major = (m: Money): Q => ({ num: BigInt(m.minor), den: 10n ** BigInt(minorUnits(m.currency as CurrencyCode)) });
/** An amount of a currency from major units, rounded half to even to its minor unit. */
export const minor = (currency: string, q: Q): Money => money(currency as CurrencyCode, Number(roundHalfEven(q.num * 10n ** BigInt(minorUnits(currency as CurrencyCode)), q.den)));

/** The tax a scale of bands takes on an amount: each band's rate on the part of it the band spans. */
export function onBands(bands: readonly Band[], x: Q): Q {
  let out = Z;
  for (const b of bands) {
    const top = b.to === null ? x : min(x, r(b.to));
    const part = sub(top, r(b.from));
    // Stryker disable next-line EqualityOperator: a part of nothing adds nothing.
    if (cmp(part, Z) > 0) out = plus(out, mul(r(b.rate), part));
  }
  return out;
}

/** The tax § 32a's zones take on an income: the zone it falls in, by its formula. */
export function onZones(zones: readonly Zone[], x: Q): Q {
  const z = zones.findLast((zone) => cmp(x, r(zone.from)) >= 0) as Zone;
  if ('quad' in z) {
    const y = mul(sub(x, r(z.from)), { num: 1n, den: 10000n });
    const [a, b, c] = z.quad.map(r) as [Q, Q, Q];
    return plus(mul(plus(mul(a, y), b), y), c);
  }
  return max(Z, sub(mul(r(z.rate), x), r(z.minus)));
}

/** A layer's tax on an income: on what's left after its allowance and the shares it deducts, less its credits, with its surtax; or the other reckoning the law allows, where it comes to less. */
export function onLayer(l: Layer, income: Q): Q {
  return l.or === undefined ? reckoned(l, income) : min(reckoned(l, income), onLayer(l.or, income));
}

function reckoned(l: Layer, income: Q): Q {
  if (l.over !== undefined && cmp(income, r(l.over)) <= 0) return Z;
  let base = sub(income, r(l.less ?? '0'));
  for (const s of l.shares ?? []) base = sub(base, s.max === null ? mul(r(s.rate), income) : min(mul(r(s.rate), income), r(s.max)));
  base = max(Z, base);
  let tax = l.bands === undefined ? onZones(l.zones as readonly Zone[], base) : onBands(l.bands, base);
  let credit = l.creditUpTo === undefined || cmp(income, r(l.creditUpTo)) <= 0 ? r(l.credit ?? '0') : Z;
  if (l.taper !== undefined) credit = max(Z, sub(credit, mul(r(l.taper.rate), max(Z, sub(income, r(l.taper.from))))));
  if (l.minimum !== undefined) credit = plus(credit, onBands(l.bands as readonly Band[], r(l.minimum)));
  tax = max(Z, sub(tax, credit));
  if (l.most !== undefined) tax = min(tax, mul(r(l.most), base));
  const s = l.surtax;
  if (s === undefined) return tax;
  const over = r(s.over ?? '0');
  if (cmp(tax, over) <= 0) return tax;
  const surtax = mul(r(s.rate), tax);
  return plus(tax, s.cap === undefined ? surtax : min(surtax, mul(r(s.cap), sub(tax, over))));
}

/** The resident's tax on a year's income, at the scale in force from the year's start (the earliest where none was by then); nothing where the research gives no scale (told). */
export function residentTax(c: Country, income: Money, year: string): Money {
  const scale = c.residents.findLast((x) => x.from <= year) ?? c.residents[0];
  return minor(c.currency, (scale?.layers ?? []).reduce((s, l) => plus(s, onLayer(l, major(income))), Z));
}

/** Contributions on a year's pay: each scale's, summed. */
export const contributions = (scales: readonly (readonly Band[])[], pay: Q): Q => scales.reduce((s, b) => plus(s, onBands(b, pay)), Z);

/** What a scheme withholds from a payment, after what was paid before in the year where its threshold is the year's. */
export function withheldOn(s: Scheme, gross: Q, before: Q): Q {
  if (s.over !== undefined && cmp(s.yearly === true ? plus(before, gross) : gross, r(s.over)) <= 0) return Z;
  const tax = onBands(s.bands, mul(gross, sub({ num: 1n, den: 1n }, r(s.deduct ?? '0'))));
  return s.surtax === undefined ? tax : plus(tax, mul(r(s.surtax), tax));
}

export const dateOf = (at: number): string => {
  const c = civilFromDays(Math.floor(at / DAY));
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
};

/** The tax year a day falls in: the day it starts and the moment the next starts. */
export function yearOf(c: Country, day: string): { start: string; ends: number } {
  const y = Number(day.slice(0, 4));
  const from = day.slice(5) >= c.year.start ? y : y - 1;
  const [m, d] = c.year.start.split('-').map(Number) as [number, number];
  return { start: `${from}-${c.year.start}`, ends: daysFromCivil(from + 1, m, d) * DAY };
}

/** The moment a year's return is due: its day, so many years after the year's end; none where the research gives none. */
export function dueOf(c: Country, start: string): number | null {
  if (c.year.due === null) return null;
  const { ends } = yearOf(c, start);
  const [m, d] = c.year.due.on.split('-').map(Number) as [number, number];
  return daysFromCivil(civilFromDays(Math.floor((ends - 1) / DAY)).year + c.year.due.after, m, d) * DAY;
}

/** One payment for work: where, of what kind, its gross in the country's currency, and what was taken from it. */
export interface Paid {
  [key: string]: Json;
  at: number;
  what: string;
  country: string;
  home: string;
  work: Work;
  account: string;
  currency: string;
  gross: number;
  tax: number;
  social: number;
  vat: number;
  /** The gross and the tax withheld in the home country's currency, at the day's rate. */
  counted: number;
  credited: number;
}

/** A year's reckoning where the person lives, in that country's currency. */
export interface Return {
  [key: string]: Json;
  country: string;
  year: string;
  account: string;
  income: number;
  tax: number;
  social: number;
  withheld: number;
  credit: number;
  vat: number;
  /** The tax on the year's gross fees where the country levies one on a self-employed worker's receipts. */
  turnover: number;
  /** Due above nothing, refunded below. */
  balance: number;
  due: number | null;
  settled: 'paid' | 'refunded' | 'owed' | null;
}

export interface TaxSlice {
  paid: Paid[];
  returns: Return[];
}

export const TAX_START: TaxSlice = { paid: [], returns: [] };

export type Earning = Holding & { tax: TaxSlice };

export interface EarnArgs {
  /** The account it's paid into. */
  account: string;
  /** Who pays, by name: their world account. */
  payer: string;
  country: string;
  /** Where the person lives. */
  home: string;
  work: Work;
  gross: Money;
  what: string;
}

/** An amount carried into a currency at the day's rate; refused where the rate isn't known. */
export function inCurrency(m: Money, to: string, day: string): Money {
  if (m.currency === to) return m;
  const out = exchangeOn(m, to as CurrencyCode, day)?.money;
  if (out === undefined) throw new Error(`the rate between ${m.currency} and ${to} isn't known to this game`);
  return out;
}

const sumOf = (list: readonly Paid[], k: 'gross' | 'counted' | 'credited' | 'vat'): number => list.reduce((s, p) => s + p[k], 0);

/**
 * Pays the person for work: the gross from the payer, less what the work's country withholds, into the account named.
 * The payment's record.
 */
export function earn(s: Earning, a: EarnArgs, c: Context): Paid {
  const h = heldOf(s.accounts, a.account);
  if (a.gross.minor <= 0) throw new Error(`${a.what} is paid above nothing`);
  const day = dateOf(c.now);
  const home = a.home;
  const where = taxOf(a.country);
  const cur = where?.currency ?? a.gross.currency;
  const gross = inCurrency(a.gross, cur, day);
  const g = major(gross);
  const resident = home === a.country;
  let tax = Z;
  let social = Z;
  let vat = Z;
  if (where !== undefined) {
    const year = yearOf(where, day).start;
    const there = s.tax.paid.filter((p) => p.country === a.country && yearOf(where, dateOf(p.at)).start === year);
    const scheme = resident ? where.withholding[a.work] : where.nonResident[a.work];
    if (scheme !== undefined) tax = withheldOn(scheme, g, major(money(cur as CurrencyCode, sumOf(there, 'gross'))));
    if (resident && where.employed.includes(a.work)) {
      const before = major(money(cur as CurrencyCode, sumOf(there.filter((p) => p.home === a.country && where.employed.includes(p.work)), 'gross')));
      social = sub(contributions(where.social.employee, plus(before, g)), contributions(where.social.employee, before));
    }
    const v = where.vat;
    // A fee is a self-employed worker's: work the country's employees don't do.
    if (resident && v !== null && !where.employed.includes(a.work)) {
      const own = a.work === 'author' ? v.authors : undefined;
      const threshold = own?.threshold === undefined ? v.threshold : own.threshold;
      const turnover = plus(major(money(cur as CurrencyCode, sumOf(there.filter((p) => p.home === a.country && !where.employed.includes(p.work)), 'gross'))), g);
      if (threshold === null || cmp(turnover, r(threshold)) > 0) vat = mul(g, r(own?.rate ?? v.rate));
    }
  }
  const [taxed, socialed, vatted] = [minor(cur, tax), minor(cur, social), minor(cur, vat)];
  const net = money(cur as CurrencyCode, gross.minor - taxed.minor - socialed.minor + vatted.minor);
  const into = h.currency === cur ? h.id : `${WORLD}${h.bank}`;
  const legs: Leg[] = [
    { account: `${WORLD}${a.payer}`, amount: money(cur as CurrencyCode, -(gross.minor + vatted.minor)) },
    { account: into, amount: net },
    { account: `${WORLD}tax:${a.country}`, amount: taxed },
    { account: `${WORLD}social:${a.country}`, amount: socialed },
  ];
  move(s.ledger, c.now, a.what, legs.filter((l) => l.amount.minor !== 0));
  if (into !== h.id) {
    const { amount, fee } = converted(h, net, day);
    move(s.ledger, c.now, a.what, [{ account: into, amount: money(h.currency as CurrencyCode, -amount.minor) }, { account: h.id, amount }]);
    if (fee.minor > 0) move(s.ledger, c.now, 'fees', [{ account: h.id, amount: money(fee.currency as CurrencyCode, -fee.minor) }, { account: into, amount: fee }]);
  }
  const at = taxOf(home);
  const counted = at === undefined ? 0 : inCurrency(gross, at.currency, day).minor;
  const credited = at === undefined ? 0 : inCurrency(taxed, at.currency, day).minor;
  const paid: Paid = { at: c.now, what: a.what, country: a.country, home, work: a.work, account: h.id, currency: cur, gross: gross.minor, tax: taxed.minor, social: socialed.minor, vat: vatted.minor, counted, credited };
  if (at !== undefined) {
    const year = yearOf(at, day);
    if (!s.tax.paid.some((p) => p.home === home && yearOf(at, dateOf(p.at)).start === year.start)) c.schedule(RECKON_KIND, year.ends, { country: home, year: year.start });
  }
  s.tax.paid.push(paid);
  return paid;
}

/** The year's reckoning where the person lives: the year's income taxed, what was withheld and credited taken off, the balance's due date scheduled. */
export function reckon(s: { tax: TaxSlice }, item: Item, c: Context): void {
  const { country, year } = item.data as { country: string; year: string };
  const where = taxOf(country) as Country;
  // @slate:consumer acting.perform
  // @slate:consumer directing.prep
  // @slate:consumer script.pitch
  // @slate:consumer producing.shoot
  const list = s.tax.paid.filter((p) => p.home === country && yearOf(where, dateOf(p.at)).start === year);
  const cur = where.currency as CurrencyCode;
  const income = money(cur, sumOf(list, 'counted'));
  const tax = residentTax(where, income, year);
  const own = list.filter((p) => p.country === country);
  const withheld = sumOf(own, 'credited');
  const credit = Math.min(sumOf(list, 'credited') - withheld, tax.minor);
  const social = minor(cur, contributions(where.social.self, major(money(cur, sumOf(list.filter((p) => !where.employed.includes(p.work)), 'counted'))))).minor;
  const vat = sumOf(own, 'vat');
  const fees = sumOf(own.filter((p) => !where.employed.includes(p.work)), 'gross');
  const t = where.turnover;
  const turnover = t === undefined || (t.threshold !== null && cmp(major(money(cur, fees)), r(t.threshold)) <= 0) ? 0 : minor(cur, mul(major(money(cur, fees)), r(t.rate))).minor;
  const balance = tax.minor - credit - withheld + social + vat + turnover;
  const due = dueOf(where, year);
  s.tax.returns.push({ country, year, account: (list.at(-1) as Paid).account, income: income.minor, tax: tax.minor, social, withheld, credit, vat, turnover, balance, due, settled: null });
  if (due !== null && balance !== 0) c.schedule(SETTLE_KIND, Math.max(due, c.now), { country, year });
}

/** A return's balance on its due date: paid from the account the year's last pay went into, or refunded to it; owed where it can't be paid. */
export function settle(s: Holding & { tax: TaxSlice }, item: Item, c: Context): void {
  const { country, year } = item.data as { country: string; year: string };
  // @slate:consumer tax.reckon
  const ret = s.tax.returns.find((x) => x.country === country && x.year === year) as Return;
  const cur = (taxOf(country) as Country).currency as CurrencyCode;
  const authority = `${WORLD}tax:${country}`;
  // Stryker disable next-line EqualityOperator: a balance of nothing is never scheduled (reckon).
  if (ret.balance > 0) {
    ret.settled = charge(s, ret.account, authority, money(cur, ret.balance), 'tax', c.now) ? 'paid' : 'owed';
    if (ret.settled === 'owed') c.notify(OWED, { country, year, balance: ret.balance });
    return;
  }
  const h = heldOf(s.accounts, ret.account);
  const refund = money(cur, -ret.balance);
  const into = h.currency === cur ? h.id : `${WORLD}${h.bank}`;
  move(s.ledger, c.now, 'tax refund', [{ account: authority, amount: money(cur, ret.balance) }, { account: into, amount: refund }]);
  if (into !== h.id) {
    const { amount, fee } = converted(h, refund, dateOf(c.now));
    move(s.ledger, c.now, 'tax refund', [{ account: into, amount: money(h.currency as CurrencyCode, -amount.minor) }, { account: h.id, amount }]);
    if (fee.minor > 0) move(s.ledger, c.now, 'fees', [{ account: h.id, amount: money(fee.currency as CurrencyCode, -fee.minor) }, { account: into, amount: fee }]);
  }
  ret.settled = 'refunded';
}

export const UNKEPT_LINE = 'tax.unkept';
/** The line that tells the player which readings of the tax rules are the game's own (money.tax.model). */
export const MODEL_LINE: LineId = 'tax.model';

/** Each item a country's tax can leave untold, as the player is told it. */
export const MISSING: Readonly<Record<Unknown, string>> = {
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
};

/** What the player is told of a country's tax where the game doesn't know all of it ("a, b and c"): everything where it knows none of it. */
export function aboutTax(country: CountryCode): string | undefined {
  const unknown = taxOf(country)?.unknown ?? (Object.keys(MISSING) as Unknown[]);
  if (unknown.length === 0) return undefined;
  const missing = unknown.map((u) => MISSING[u]);
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1) as string}` : (missing[0] as string);
  return t(UNKEPT_LINE, { country: countryName(country), missing: list });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each with what it reads and writes; what each does is mutated above.
export const OWED = defineNotice('tax.owed');
export const RECKON_KIND = 'tax.reckon';
export const SETTLE_KIND = 'tax.settle';
defineKind<{ tax: TaxSlice }>({ kind: RECKON_KIND, wants: false, reads: [], writes: ['tax', 'schedule'], happen: reckon });
defineKind<Holding & { tax: TaxSlice }>({ kind: SETTLE_KIND, wants: false, reads: [], writes: ['tax', 'accounts', 'ledger', 'notices'], happen: settle });
