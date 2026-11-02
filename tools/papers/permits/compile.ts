import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import countries from '../../../src/world/gazetteer/countries.json' with { type: 'json' };
import { fromMajor, isCurrency, minorUnits, rational, roundHalfEven, type Money } from '../../../src/core/money/money.ts';

/**
 * Compiles the work permit a foreign performer holds in each country (src/person/permits/permits.json), from the
 * research's files, one per country (research/sources/papers/permits/<CC>.json, register fact papers.permits.<CC>),
 * each checked against the SHA-256 its register entry cites before a byte of it is read. A country's permit gives who
 * applies (`by`: the engager, or the worker), each government fee as Money (whether it is the premium service's, and
 * whether it is asked at the first grant, at a renewal or at both), the standard and the premium processing as a span,
 * the term it is granted for and whether it renews, and the union consultation, the eligibility and the pay rule in
 * the research's words. A field the research leaves blocked is null; a field written in a form the game can't read
 * (an amount that is a range, a fee in an index unit, a term in no unit of time) is null too, and named in `unread`,
 * so the build says what to correct and the coverage holds the country pending until its core facts are read.
 *
 * Which passports need the permit, by what route, and the days a short engagement is worked without it are
 * papers.work's (layer 3), the one copy: a country whose every passport works there freely there compiles to no
 * permit, and one papers.work doesn't keep compiles to none (nothing says who needs it).
 */
export const SOURCES = 'research/sources/papers/permits';
export const OUTPUT = 'src/person/permits/permits.json';
export const WORK = 'src/papers/work/work.json';
/** The register's facts for a country whose permit is blocked, whole or in part. */
export const BLOCKED = 'papers.permits.blocked.';

/** The units a processing time is given in; a term is given in the calendar's. */
export const UNITS = ['hours', 'days', 'business-days', 'weeks', 'months', 'years'] as const;
export const TERMS = ['days', 'weeks', 'months', 'years'] as const;
export type Unit = (typeof UNITS)[number];

export interface Span {
  n: number;
  unit: Unit;
}

export type Term = Span | 'engagement';

/** Who applies: the engager (the employer, the producer, the sponsor or petitioner), or the worker. */
export type By = 'engager' | 'worker';
/** When a fee is asked: at the first grant, at a renewal, or at both. */
export type When = 'grant' | 'renewal' | 'both';

/** A fee set on the worker's pay: months of the gross pay (fewer for a citizen of a country named), less an abatement. */
export interface Salary {
  currency: string;
  months: string;
  monthsAfrican: string;
  abatement: string;
  african: string[];
}

export interface Fee {
  what: string;
  /** The amount; none where it is set on the pay (`salary`), which the engine prices from the engagement's. */
  money: Money | null;
  salary?: Salary;
  premium: boolean;
  when: When;
}

export interface Permit {
  by: By | null;
  fees: Fee[] | null;
  standard: Span | null;
  premium: Span | null;
  /** The term a grant is for: a span, or the engagement's own (the permit lasts as long as the engagement booked). */
  term: Term | null;
  renews: boolean | null;
  /** A renewal's term, where the research gives one apart from the first grant's. */
  renewal: Span | null;
  union: string | null;
  eligibility: string | null;
  pay: string | null;
  /** What the research couldn't find, by the facts sought (its blockers' fields), each once. */
  unknown: Field[];
}

/** The facts the research seeks of a permit, as its blockers name them ("validity.renewable" is the validity's). */
export const FIELDS = ['route', 'applies', 'first', 'fees', 'processing', 'validity', 'union', 'eligibility', 'pay', 'exempt', 'country', 'all'] as const;
export type Field = (typeof FIELDS)[number];

/** The facts a file's blockers name, each once, in the research's order. */
export function unknownOf(blockers: unknown): Field[] {
  if (!Array.isArray(blockers)) throw new Error('is not a list');
  const out: Field[] = [];
  for (const b of blockers) {
    const field = String(record(b)['field']).split('.')[0] as Field;
    if (!FIELDS.includes(field)) throw new Error(`name ${field}, which isn't a fact the research seeks`);
    if (!out.includes(field)) out.push(field);
  }
  return out;
}

/** A field read as the research writes it, or null; anything else is not a field the game can read. */
const text = (v: unknown): string | null => {
  if (v === null) return null;
  if (typeof v !== 'string' || v.trim() === '') throw new Error('is not words');
  return v;
};

/** Only the keys a field is read by, and notes (prose for the reader, which the game doesn't read). */
function only(o: Record<string, unknown>, keys: readonly string[]): void {
  for (const k of Object.keys(o)) if (k !== 'note' && !keys.includes(k)) throw new Error(`names ${k}, which the game doesn't read`);
}

const record = (v: unknown): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('is not an object');
  return v as Record<string, unknown>;
};

/**
 * Who applies, the game's reading of the research's sentence (papers.permits.model): the party it names first, the
 * engager (an employer, engager, producer, promoter, organiser, sponsor, petitioner, company, institution or firm) or
 * the worker (the worker, performer, artist, applicant, foreigner ...); none where it names neither, or says the law
 * doesn't say.
 */
export const ENGAGER = /\b(employers?|engager|employing|engaging|hiring|organi[sz]er|organi[sz]ing|promoter|producer|sponsor|petitioner|company|institution|entity|firm|hosting party|convener|referent)\b/i;
export const WORKER = /\b(worker|performer|foreigner|foreign national|foreign citizen|artiste?|entertainer|applicant|person|alien|noncitizen|third-country national|employee|employed person|candidate)\b/i;
export const UNSAID = /\b(does not|doesn't) say\b/i;

export function whoApplies(v: unknown): By | null {
  const said = text(v);
  if (said === null || UNSAID.test(said)) return null;
  const engager = said.search(ENGAGER);
  const worker = said.search(WORKER);
  if (engager === -1 && worker === -1) return null;
  // Stryker disable next-line EqualityOperator: the two lists share no word, so they never match at the same place.
  return worker === -1 || (engager !== -1 && engager < worker) ? 'engager' : 'worker';
}

/**
 * Which service and which grant a fee is asked at, the game's reading of its name (papers.permits.model): the premium
 * service's where it names one (premium, priority, express, expedited, urgent, fast track, immediate, a decision within
 * so many working days); a renewal's where it names a renewal or an extension, both where it names the first grant
 * with it ("application or renewal", "also renewals").
 */
export const PREMIUM = /premium|priority|express|expedit|urgent|fast.?track|immediate|within \d+ (working|business) days/i;
export const RENEWAL = /renew|extension|extend|jatkolupa/i;
export const BOTH = /\b(or|and) (its |the |a )?(renew|extension|extend)|\b(renew\w*|extension) or\b|also renewals|issued or renewed/i;

export const whenAsked = (what: string): When => (RENEWAL.test(what) ? (BOTH.test(what) ? 'both' : 'renewal') : 'grant');

const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * A fee: its name, an amount in a currency of ISO 4217's list; where the law sets it in an index unit (a base unit, a
 * minimum wage, an indexed unit), the units and the unit's value with it, the amount their product to the currency's
 * minor unit, half to even. `maximum` marks a fee the law sets as a ceiling, its name saying so.
 */
export function fee(v: unknown): Fee {
  const f = record(v);
  only(f, ['what', 'amount', 'currency', 'units', 'unitValue', 'maximum', 'salary']);
  const what = text(f['what']);
  if (what === null) throw new Error('names no fee');
  const currency = String(f['currency']);
  if (!isCurrency(currency)) throw new Error(`is in ${currency}, which isn't a currency of ISO 4217's list`);
  if ('salary' in f) return { what, money: null, salary: salary(f['salary'], currency, 'amount' in f), premium: PREMIUM.test(what), when: whenAsked(what) };
  const amount = String(f['amount']);
  if (!DECIMAL.test(amount)) throw new Error(`"${amount}" is not an amount`);
  if ('maximum' in f && f['maximum'] !== true) throw new Error(`says maximum ${String(f['maximum'])}, not true`);
  if ('units' in f || 'unitValue' in f) {
    const [units, value] = [String(f['units']), String(f['unitValue'])];
    if (!DECIMAL.test(units) || !DECIMAL.test(value)) throw new Error(`gives ${units} units of ${value}, not two amounts`);
    const [a, b] = [rational(units), rational(value)];
    const minor = roundHalfEven(a.num * b.num * 10n ** BigInt(minorUnits(currency)), a.den * b.den);
    if (minor !== BigInt(fromMajor(currency, amount.replace(/\.0+$/, '')).minor)) throw new Error(`is ${amount}, not ${units} units of ${value}`);
  }
  // A whole amount written with zero decimals ("100000.00" Rwandan francs) is the same amount.
  return { what, money: fromMajor(currency, amount.replace(/\.0+$/, '')), premium: PREMIUM.test(what), when: whenAsked(what) };
}

/**
 * A fee set on the pay (Cameroon's contract visa: two months' gross pay, one for an African worker, less half): the months
 * and the abatement as amounts, the abatement below 1, the countries whose citizens pay the fewer months; it has no amount.
 */
export function salary(v: unknown, currency: string, amount: boolean): Salary {
  const o = record(v);
  only(o, ['months', 'monthsAfrican', 'abatement', 'african']);
  if (amount) throw new Error('is set on the pay, so it names no amount');
  const [months, monthsAfrican, abatement] = [o['months'], o['monthsAfrican'], o['abatement']].map(String) as [string, string, string];
  if (![months, monthsAfrican, abatement].every((x) => DECIMAL.test(x))) throw new Error(`gives ${months} months, ${monthsAfrican} for an African worker, less ${abatement}, not three amounts`);
  const cut = rational(abatement);
  if (cut.num >= cut.den) throw new Error(`takes off ${abatement} of the fee, not less than all of it`);
  const african = o['african'];
  if (!Array.isArray(african) || african.length === 0 || african.some((c) => !Object.hasOwn(countries, String(c)))) throw new Error('names its African countries by codes on the map');
  return { currency, months, monthsAfrican, abatement, african: african as string[] };
}

/** The fees; none known where the research gives none. */
export function fees(v: unknown): Fee[] | null {
  if (v === null) return null;
  if (!Array.isArray(v)) throw new Error('is not a list');
  return v.map((f, i) => {
    try {
      return fee(f);
    } catch (e) {
      throw new Error(`fee ${i} ${(e as Error).message}`, { cause: e });
    }
  });
}

/** A span of time: a whole number above 0 of one of the units given; null where the research gives none. */
export function span(v: unknown, units: readonly string[]): Span | null {
  if (v === null || v === undefined) return null;
  const s = record(v);
  only(s, ['n', 'unit']);
  if (!units.includes(s['unit'] as string)) throw new Error(`is in ${String(s['unit'])}, not ${units.join(', ')}`);
  if (!Number.isSafeInteger(s['n']) || (s['n'] as number) < 1) throw new Error(`is ${String(s['n'])}, not a whole number above 0`);
  return { n: s['n'] as number, unit: s['unit'] as Unit };
}

/** The term and whether it renews; a term of neither number nor unit is blocked, and so null. */
/**
 * The term, whether it renews, and a renewal's term where the research gives one apart; a term of neither number nor
 * unit is blocked, and so null; one in the unit `engagement` (and no number) is the engagement's own.
 */
export function validity(v: unknown): { term: Term | null; renews: boolean | null; renewal: Span | null } {
  if (v === null) return { term: null, renews: null, renewal: null };
  const o = record(v);
  only(o, ['n', 'unit', 'renewable', 'renewal']);
  if (![true, false, null].includes(o['renewable'] as boolean | null)) throw new Error(`says it renews ${String(o['renewable'])}, not true, false or null`);
  const own = o['n'] === null && o['unit'] === 'engagement';
  const term = own ? 'engagement' : o['n'] === null && o['unit'] === null ? null : span({ n: o['n'], unit: o['unit'] }, TERMS);
  return { term, renews: o['renewable'] as boolean | null, renewal: span(o['renewal'], TERMS) };
}

/** Each field read, or null and named in `unread` where the research writes it in a form the game can't read. */
export function compilePermit(code: string, p: Record<string, unknown>, blockers: unknown, unread: string[]): Permit {
  const read = <T>(field: string, f: () => T, otherwise: T): T => {
    try {
      return f();
    } catch (e) {
      unread.push(`${code}'s ${field} ${(e as Error).message}`);
      return otherwise;
    }
  };
  const processing = read(
    'processing',
    () => {
      if (p['processing'] === null) return {};
      const o = record(p['processing']);
      only(o, ['standard', 'premium']);
      return o;
    },
    {} as Record<string, unknown>,
  );
  const { term, renews, renewal } = read('validity', () => validity(p['validity']), { term: null, renews: null, renewal: null });
  return {
    by: read('applies', () => whoApplies(p['applies']), null),
    fees: read('fees', () => fees(p['fees']), null),
    standard: read('standard processing', () => span(processing['standard'], UNITS), null),
    premium: read('premium processing', () => span(processing['premium'], UNITS), null),
    term,
    renews,
    renewal,
    union: read('union', () => text(p['union']), null),
    eligibility: read('eligibility', () => text(p['eligibility']), null),
    pay: read('pay', () => text(p['pay']), null),
    unknown: read('blockers', () => unknownOf(blockers), [...FIELDS]),
  };
}

/** papers.work's compiled list for a country: what each passport needs there. */
export interface Kept {
  passports: Record<string, { right: string }>;
  others: { right: string };
}

/** Whether every passport works in a country freely, by papers.work's list. */
export const freeToAll = (kept: Kept): boolean => [kept.others, ...Object.values(kept.passports)].every((r) => r.right === 'free');

/**
 * A country's file: its permit, where papers.work says a passport needs one there; none where every passport works
 * there freely, or papers.work keeps no rules for it (named in `unread`).
 */
export function compileCountry(code: string, file: Record<string, unknown>, work: Readonly<Record<string, Kept>>, unread: string[]): Permit | undefined {
  if (!Object.hasOwn(countries, code)) throw new Error(`${code} is not a country on the map`);
  if (file['country'] !== code) throw new Error(`${code}'s file is for ${String(file['country'])}`);
  const kept = work[code];
  if (kept === undefined) {
    unread.push(`${code} has no permit compiled: papers.work keeps no rules for it, so nothing says who needs one`);
    return undefined;
  }
  if (freeToAll(kept)) return undefined;
  if (typeof file['permit'] !== 'object' || file['permit'] === null) throw new Error(`${code}'s file holds no permit, though papers.work says a passport needs one there`);
  return compilePermit(code, file['permit'] as Record<string, unknown>, file['blockers'], unread);
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string } }[];
}

/** Every country's permit, of the files the register cites and checks, and what of them the game couldn't read. */
export function readPermits(root: string): { countries: Record<string, Permit>; unread: string[] } {
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as Register;
  const shas = new Map(register.entries.flatMap((e) => (e.fact.startsWith('papers.permits.') && e.value?.file !== undefined ? [[e.value.file, e.value.sha256] as const] : [])));
  const blocked = new Set(register.entries.filter((e) => e.fact.startsWith(BLOCKED)).map((e) => e.fact.slice(BLOCKED.length)));
  const work = (JSON.parse(readFileSync(join(root, WORK), 'utf8')) as { countries: Record<string, Kept> }).countries;
  const out: Record<string, Permit> = {};
  const unread: string[] = [];
  const dir = join(root, SOURCES);
  // Stryker disable next-line MethodExpression: the filesystems this runs on list a directory in name order already; the sort keeps the output the same on one that doesn't.
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.json')).sort() : [];
  for (const name of names) {
    const path = `${SOURCES}/${name}`;
    const code = name.slice(0, -'.json'.length);
    const sha = shas.get(path);
    // A country whose permit is blocked whole: its file is the blocker's record, cited by it, and holds nothing to read.
    if (sha === undefined && blocked.has(code)) continue;
    if (sha === undefined) throw new Error(`${path} isn't cited by the register`);
    const bytes = readFileSync(join(root, path));
    if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${path} isn't the file the register cites`);
    const permit = compileCountry(code, JSON.parse(bytes.toString('utf8')) as Record<string, unknown>, work, unread);
    if (permit !== undefined) out[code] = permit;
  }
  return { countries: out, unread };
}

export const serialize = (countries: Readonly<Record<string, Permit>>) => `${JSON.stringify({ countries }, null, 1)}\n`;
