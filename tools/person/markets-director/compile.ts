import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, type CurrencyCode } from '../../../src/core/money/money.ts';
import { at, dated, figureOf, range, type Range, type Research } from '../markets/compile.ts';

/**
 * Compiles the markets a director works in beyond the US (src/person/directing/markets.json), from the research's
 * files, one per country (research/sources/person/markets/director-<CC>.json, register fact
 * person.markets.director.<CC>), each checked against the SHA-256 its register entry cites before a byte of it is
 * read, and the game's reading of them (tools/person/markets-director/readings.json): the agreements a film or an
 * episode is directed under there, and where in the research each figure stands.
 *
 * An agreement gives the forms it covers (a feature, an hour or a half-hour episode), its currency, its minimum fees
 * and the periods it guarantees. A fee is paid by the job, as a share of the budget, by the minute of the film, or by
 * the day, half-day, week, month or hour of the engagement's prep, shoot or cut; it holds in a tier (the budget, the
 * director's years, the film's minutes, the engagement's days) and may pay only some units of its count (the 61st minute
 * on); its amounts step by date. A period is the prep and shoot together, the cut, or the prep alone, in days. Every amount, share,
 * date and tier edge is read from the research or checked to stand in it, never written here alone. An agreement whose
 * research says none sets the pay (`none`) leaves it to negotiation; one whose terms the research couldn't find
 * (`unknown`, a blocker standing for it) has none the game can pay. Neither has fees.
 *
 * A market gives its agreements and what its research couldn't find (its blockers' items), which the engine tells the
 * player. A territory whose research says a director's work there follows its sovereign's terms takes the sovereign's
 * market as compiled.
 */
export const SOURCES = 'research/sources/person/markets';
export const PREFIX = 'director-';
export const READINGS = 'tools/person/markets-director/readings.json';
export const OUTPUT = 'src/person/directing/markets.json';
export const FACT = 'person.markets.director.';
export const BLOCKED = 'person.markets.director.blocked.';
/** The agreement the director's engine keeps itself (R-4613); a market's may not take its id. */
export const KEPT = 'dga';

export const FORMS = ['feature', 'hour', 'half-hour'] as const;
export const PERS = ['job', 'share', 'minute', 'day', 'half-day', 'week', 'month', 'hour'] as const;
/** The pays whose units are counted whole, so a fee may pay only some of them. */
export const BANDED = ['minute', 'day', 'half-day'] as const;
export const PHASES = ['prep', 'shoot', 'cut'] as const;
export const TIERS = ['budget', 'years', 'minutes', 'days'] as const;
/** The tiers whose edges the research writes as figures. */
export const EDGED = ['budget', 'minutes'] as const;
/** The prep and shoot together, the cut, or the prep alone (where an agreement guarantees prep apart from the shoot). */
export const PERIODS = ['prep-shoot', 'cut', 'prep'] as const;
/** What a market's research can leave unknown, as its blockers name it; the items that leave an agreement's terms unknown. */
export const ITEMS = ['agreement', 'fees', 'periods', 'union', 'language', 'none', 'terms'] as const;
export const UNKNOWING = ['agreement', 'fees', 'union', 'none', 'terms'] as const;
/** The figures a fee may stand in: a market's fees, its agreement, its periods, or a statutory floor of a director's pay (rates). */
export const PRICED = ['fees', 'agreement', 'periods', 'rates'] as const;
/** The figures whose value may say, at a place, that nothing sets a director's pay. */
export const SAYING = ['none', 'agreement', 'fees', 'union', 'rules', 'rates'] as const;
/** A week of the engagement is five of its days, as the actor's engine counts them. */
export const WEEK = 5;

export type Form = (typeof FORMS)[number];
export type Per = (typeof PERS)[number];
export type Phase = (typeof PHASES)[number];
export type Tier = (typeof TIERS)[number];
export type Item = (typeof ITEMS)[number];

export interface Fee {
  form: Form;
  per: Per;
  /** The parts of the engagement whose days it pays (a pay by the day, half-day, week, month or hour). */
  phases: Phase[];
  when: Partial<Record<Tier, Range>>;
  /** The units of its count it pays; every one where none. */
  band: Range | null;
  /** A share's least amount. */
  floor: string | null;
  /** What it is cut to on a director's first job. */
  first: string | null;
  steps: [string, string][];
}

export interface Period {
  form: Form;
  part: (typeof PERIODS)[number];
  when: Partial<Record<Tier, Range>>;
  days: number;
}

export interface Agreement {
  country: string;
  forms: Form[];
  /** None where it sets no fee. */
  currency: string | null;
  none: boolean;
  /** The days a month of the engagement is, where the agreement says. */
  month: number | null;
  /** An engagement of so many days or fewer is paid this much more by the time it works. */
  short: { upTo: number; share: string } | null;
  fees: Fee[];
  periods: Period[];
}

export interface Market {
  agreements: string[];
  unknown: Item[];
}

export interface Markets {
  markets: Record<string, Market>;
  agreements: Record<string, Agreement>;
}

interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string }; attempts?: { result?: string }[] }[];
}

const record = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what} is not an object`);
  return v as Record<string, unknown>;
};
const only = (o: Record<string, unknown>, keys: readonly string[], what: string) => {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${what} names ${k}, which the game doesn't read`);
};

/** The numbers a figure writes: digits, with thousands' commas, and "1.5M" or "900K" as their millions and thousands. */
export function numbers(text: string): Set<number> {
  const out = new Set<number>();
  for (const [, n, x] of text.replaceAll(/(\d),(?=\d{3})/g, '$1').matchAll(/(\d+(?:\.\d+)?)([KM])?/g)) out.add(x === undefined ? Number(n) : Math.round(Number(n) * (x === 'M' ? 1e6 : 1e3)));
  return out;
}

/** Whether a tier's edges stand in the research: its start (or the number before it), its end (or the one after it). */
export function edged(r: Range, written: ReadonlySet<number>): boolean {
  const [lo, hi] = r;
  return (lo === 0 || written.has(lo) || written.has(lo - 1)) && (hi === null || written.has(hi) || written.has(hi + 1));
}

/** A tier read: its keys the game's, its ranges whole, its budget's and minutes' edges standing in the research. */
export function tiersOf(v: unknown, written: ReadonlySet<number>): Partial<Record<Tier, Range>> {
  const when: Partial<Record<Tier, Range>> = {};
  for (const [k, x] of Object.entries(record(v ?? {}, 'a tier'))) {
    if (!TIERS.includes(k as Tier)) throw new Error(`a tier turns on ${k}, which the game doesn't read`);
    const r = range(x);
    if ((EDGED as readonly string[]).includes(k) && !edged(r, written)) throw new Error(`the research doesn't write the ${k} tier ${JSON.stringify(r)}`);
    when[k as Tier] = r;
  }
  return when;
}

/** "up to 25%" as what the fee is cut to: 0.75. */
export function cutTo(text: unknown): string {
  const m = /up to (\d{1,2})%/.exec(String(text));
  if (m === null) throw new Error(`${String(text)} isn't a cut of a fee`);
  return String((100 - Number(m[1])) / 100);
}

/** "1-5 days: +10%" as the days an engagement is short and what it is paid more. */
export function shortOf(text: unknown): { upTo: number; share: string } {
  const m = /^1-(\d+) days: \+(\d+)%$/.exec(String(text));
  if (m === null) throw new Error(`${String(text)} isn't a short engagement's pay`);
  return { upTo: Number(m[1]), share: String(Number(m[2]) / 100) };
}

/** A period's days: a number of its unit, or a guaranteed day and the ones more ("1 + up to 1": 2). */
export function daysOf(v: unknown, unit: unknown): number {
  if (unit !== 'week' && unit !== 'day') throw new Error(`a period is in weeks or days, not ${String(unit)}`);
  if (Number.isSafeInteger(v) && (v as number) > 0) return (v as number) * (unit === 'week' ? WEEK : 1);
  if (unit === 'day' && typeof v === 'string' && /^\d+( \+ up to \d+)?$/.test(v)) return (v.match(/\d+/g) as string[]).reduce((t, n) => t + Number(n), 0);
  throw new Error(`a period of ${JSON.stringify(v)} isn't whole ${unit}s`);
}

export interface Evidence {
  research: Research;
  /** The agreement's own figure, which may date and price a fee its figure doesn't. */
  own: Research['figures'][number] | null;
  currency: CurrencyCode;
  forms: readonly Form[];
}

const texts = (e: Evidence, fig: number): string => JSON.stringify([e.research.figures[fig], e.own]);

/** One fee, read from the research at its places. */
export function feeOf(e: Evidence, reading: unknown): Fee {
  const f = record(reading, 'a fee');
  only(f, ['form', 'per', 'phases', 'when', 'band', 'floor', 'first', 'fig', 'steps'], 'a fee');
  const figure = figureOf(e.research, f['fig'], PRICED);
  const fig = f['fig'] as number;
  const text = texts(e, fig);
  if (!e.forms.includes(f['form'] as Form)) throw new Error(`a fee's form ${String(f['form'])} isn't its agreement's`);
  const per = f['per'] as Per;
  if (!PERS.includes(per)) throw new Error(`a fee is paid by ${String(per)}, which the game doesn't pay by`);
  const timed = !['job', 'share', 'minute'].includes(per);
  const phases = f['phases'] ?? (timed ? [...PHASES] : []);
  if (!Array.isArray(phases) || (timed ? phases.length === 0 : phases.length > 0) || !phases.every((p) => PHASES.includes(p as Phase))) throw new Error(`a fee by the ${per} pays ${timed ? 'some' : 'none'} of the engagement's days`);
  const band = f['band'] === undefined ? null : range(f['band']);
  if (band !== null && !(BANDED as readonly string[]).includes(per)) throw new Error(`a fee by the ${per} pays every unit`);
  const amountAt = (path: unknown): string => {
    const v = at(figure.value, path as (string | number)[]);
    if (typeof v !== 'number' || !(v > 0) || (per === 'share' && v >= 1)) throw new Error(`${e.research.country}'s figure ${fig} has no ${per === 'share' ? 'share' : 'amount'} at ${(path as unknown[]).join('.')}`);
    if (per !== 'share') fromMajor(e.currency, String(v));
    return String(v);
  };
  if (f['floor'] !== undefined && per !== 'share') throw new Error('only a share has a floor');
  const floor = f['floor'] === undefined ? null : String(at(figure.value, f['floor'] as (string | number)[]));
  if (floor !== null) fromMajor(e.currency, floor);
  const first = f['first'] === undefined ? null : cutTo(at(figure.value, f['first'] as (string | number)[]));
  if (!text.includes(e.currency)) throw new Error(`${e.research.country}'s figure ${fig} doesn't name ${e.currency}`);
  if (!Array.isArray(f['steps']) || f['steps'].length === 0) throw new Error('a fee has no steps');
  const steps = f['steps'].map((s): [string, string] => {
    const step = record(s, 'a step');
    const from = String(step['from']);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !dated(text, from)) throw new Error(`${e.research.country}'s figure ${fig} doesn't date a fee from ${from}`);
    return [from, amountAt(step['path'])];
  });
  for (const [i, [from]] of steps.entries()) if (i > 0 && !(from > (steps[i - 1] as [string, string])[0])) throw new Error("a fee's steps run by date");
  const when = tiersOf(f['when'], numbers(text));
  // The engine asks a job's budget and running time where a tier turns on them, so a share's and a minute's pay name theirs.
  if ((per === 'share' && when.budget === undefined) || (per === 'minute' && when.minutes === undefined)) throw new Error(`a fee by the ${per} holds in a tier of the ${per === 'share' ? 'budget' : 'minutes'}`);
  return { form: f['form'] as Form, per, phases: phases as Phase[], when, band, floor, first, steps };
}

/** One period, read from the research at its place. */
export function periodOf(e: Evidence, reading: unknown): Period {
  const p = record(reading, 'a period');
  only(p, ['form', 'part', 'when', 'fig', 'path', 'unit'], 'a period');
  const figure = figureOf(e.research, p['fig'], ['fees', 'periods', 'cut']);
  if (!e.forms.includes(p['form'] as Form)) throw new Error(`a period's form ${String(p['form'])} isn't its agreement's`);
  if (!PERIODS.includes(p['part'] as Period['part'])) throw new Error(`a period is the prep and shoot, the cut or the prep, not ${String(p['part'])}`);
  const days = daysOf(at(figure.value, p['path'] as (string | number)[]), p['unit']);
  return { form: p['form'] as Form, part: p['part'] as Period['part'], when: tiersOf(p['when'], numbers(texts(e, p['fig'] as number))), days };
}

/** One agreement: its pay left to negotiation, its terms unknown, or its fees and periods. */
export function agreementOf(id: string, r: Research, reading: unknown): Agreement {
  const a = record(reading, `the reading of ${id}`);
  only(a, ['forms', 'none', 'unknown', 'currency', 'fig', 'month', 'short', 'fees', 'periods'], `the reading of ${id}`);
  const forms = a['forms'];
  if (!Array.isArray(forms) || forms.length === 0 || !forms.every((x) => FORMS.includes(x as Form)) || new Set(forms).size !== forms.length) throw new Error(`${id} covers features, hours or half-hours`);
  const bare = { country: r.country, forms: forms as Form[], currency: null, month: null, short: null, fees: [], periods: [] };
  if (a['none'] !== undefined) {
    const none = record(a['none'], 'none');
    const figure = figureOf(r, none['fig'], none['path'] === undefined ? ['none'] : SAYING);
    // At its place the research writes no agreement or minimum (null, false), or a fee left free in its own word ("freie Vereinbarung (none)").
    const v = none['path'] === undefined ? null : at(figure.value, none['path'] as (string | number)[]);
    if (!(v === null || v === false || (typeof v === 'string' && v.endsWith('(none)')))) throw new Error(`${r.country}'s figure ${String(none['fig'])} doesn't say nothing sets the pay`);
    return { ...bare, none: true };
  }
  if (a['unknown'] !== undefined) {
    if (a['unknown'] !== true || !r.blockers.some((b) => (UNKNOWING as readonly string[]).includes(b.item))) throw new Error(`${r.country}'s research holds no blocker for ${id}'s terms`);
    return { ...bare, none: false };
  }
  const currency = String(a['currency']);
  if (!isCurrency(currency)) throw new Error(`${id} pays in ${currency}, which isn't a currency`);
  const own = a['fig'] === undefined ? null : figureOf(r, a['fig'], ['agreement', 'fees']);
  const e: Evidence = { research: r, own, currency, forms: forms as Form[] };
  if (!Array.isArray(a['fees']) || a['fees'].length === 0) throw new Error(`${id} sets no fees`);
  const fees = a['fees'].map((f) => feeOf(e, f));
  const periods = ((a['periods'] ?? []) as unknown[]).map((p) => periodOf(e, p));
  for (const form of forms as Form[]) if (periods.some((p) => p.form === form && p.part === 'prep') && periods.some((p) => p.form === form && p.part === 'prep-shoot')) throw new Error(`${id} guarantees a ${form}'s prep both alone and with its shoot`);
  let month: number | null = null;
  if (a['month'] !== undefined) {
    const m = record(a['month'], 'a month');
    const v = at(figureOf(r, m['fig'], ['fees', 'agreement']).value, m['path'] as (string | number)[]);
    if (typeof m['days'] !== 'number' || !(m['days'] > 0) || !String(v).includes(String(m['days']))) throw new Error(`${r.country}'s figure ${String(m['fig'])} doesn't make a month ${String(m['days'])} days`);
    month = m['days'];
  }
  const s = a['short'] === undefined ? null : record(a['short'], 'a short engagement');
  const short = s === null ? null : shortOf(at(figureOf(r, s['fig'], ['fees', 'agreement']).value, s['path'] as (string | number)[]));
  return { country: r.country, forms: forms as Form[], currency, none: false, month, short, fees, periods };
}

/** The items a file's blockers name, each once, in the research's order. */
export function unknownOf(blockers: readonly { item: string }[]): Item[] {
  const out: Item[] = [];
  for (const { item } of blockers) {
    if (!ITEMS.includes(item as Item)) throw new Error(`a blocker names ${item}, which isn't a fact the research seeks`);
    if (!out.includes(item as Item)) out.push(item as Item);
  }
  return out;
}

/**
 * A market: its agreements, one at least, and what isn't known; or, where its research says a director's work there
 * follows another country's terms (a territory's sovereign's), that country's agreements as compiled (`done`), each as
 * the territory's own, and what isn't known of them with what isn't known of its own.
 */
export function marketOf(r: Research, reading: unknown, done: Markets = { markets: {}, agreements: {} }): { market: Market; agreements: Record<string, Agreement> } {
  const m = record(reading, `the reading of ${r.country}`);
  const agreements: Record<string, Agreement> = {};
  const unknown = unknownOf(r.blockers);
  if (m['follows'] !== undefined) {
    only(m, ['follows'], `the reading of ${r.country}`);
    const f = record(m['follows'], 'what a market follows');
    const cc = String(f['market']);
    if (record(figureOf(r, f['fig'], ['follows', 'none']).value, 'a figure')['follows'] !== cc) throw new Error(`${r.country}'s figure ${String(f['fig'])} doesn't say a director's work there follows ${cc}'s terms`);
    // Only a market read on its own is followed: one that follows another isn't in `done`.
    if (!Object.hasOwn(done.markets, cc)) throw new Error(`${cc} isn't a market to follow`);
    const followed = done.markets[cc] as Market;
    for (const id of followed.agreements) agreements[`${r.country.toLowerCase()}-${id}`] = { ...(done.agreements[id] as Agreement), country: r.country };
    for (const u of followed.unknown) if (!unknown.includes(u)) unknown.push(u);
    return { market: { agreements: Object.keys(agreements), unknown }, agreements };
  }
  only(m, ['agreements'], `the reading of ${r.country}`);
  for (const [id, a] of Object.entries(record(m['agreements'], 'the agreements'))) agreements[id] = agreementOf(id, r, a);
  if (Object.keys(agreements).length === 0) throw new Error(`${r.country} has no agreements`);
  return { market: { agreements: Object.keys(agreements), unknown }, agreements };
}

/** What a blocker in the register couldn't find, as each of its attempts names it ("not found: fees, terms"), each once. */
export function blockedItems(entry: Register['entries'][number]): { item: string }[] {
  const items: string[] = [];
  for (const { result } of entry.attempts ?? []) {
    const m = /^not found: (.+)$/.exec(String(result));
    if (m === null) throw new Error(`${entry.fact} has an attempt whose result names nothing not found`);
    for (const item of (m[1] as string).split(', ')) if (!items.includes(item)) items.push(item);
  }
  if (items.length === 0) throw new Error(`${entry.fact} names nothing not found`);
  return items.map((item) => ({ item }));
}

/**
 * A market's research, checked against the register's SHA-256 before a byte is read, and whether the register holds its
 * blockers. Where the research found nothing, the register cites no file and holds the blocker alone: the market is
 * read from it, what isn't known as its attempts name it, and the file beside it isn't read.
 */
export function readResearch(root: string, register: Register, cc: string): { research: Research; blocked: boolean } {
  const file = `${SOURCES}/${PREFIX}${cc}.json`;
  // Stryker disable next-line OptionalChaining: the entry found names the file, so it has a value.
  const sha = register.entries.find((e) => e.fact === `${FACT}${cc}` && e.value?.file === file)?.value?.sha256;
  const blocker = register.entries.find((e) => e.fact === `${BLOCKED}${cc}`);
  if (blocker !== undefined && !register.entries.some((e) => e.fact === `${FACT}${cc}`)) return { research: { country: cc, figures: [], blockers: blockedItems(blocker) }, blocked: true };
  if (sha === undefined) throw new Error(`${file} isn't cited by the register`);
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${file} isn't the file the register cites`);
  const research = JSON.parse(bytes.toString('utf8')) as Research;
  if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
  return { research, blocked: blocker !== undefined };
}

/** Every director's market the research holds, read as the readings say; a file without a reading, or a reading without a file, is refused. */
export function readMarkets(root: string): Markets {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const readings = record(read(READINGS), 'the readings');
  const register = read('research/register.json') as Register;
  // Stryker disable next-line MethodExpression: the directory's order is sorted on the file systems the gate runs on; the sort holds it on any other.
  const files = existsSync(join(root, SOURCES)) ? readdirSync(join(root, SOURCES)).filter((f) => f.startsWith(PREFIX) && f.endsWith('.json')).map((f) => f.slice(PREFIX.length, -5)).sort() : [];
  const out: Markets = { markets: {}, agreements: {} };
  for (const cc of Object.keys(readings).filter((c) => !files.includes(c))) throw new Error(`${cc} has a reading and no research`);
  for (const cc of files) if (!Object.hasOwn(readings, cc)) throw new Error(`${SOURCES}/${PREFIX}${cc}.json has no reading`);
  // The markets read on their own first, so a territory follows its sovereign's as compiled; then all in the countries' order.
  const follows = (cc: string) => Object.hasOwn(record(readings[cc], `the reading of ${cc}`), 'follows');
  const own: Markets = { markets: {}, agreements: out.agreements };
  for (const cc of [...files.filter((c) => !follows(c)), ...files.filter(follows)]) {
    const { research, blocked } = readResearch(root, register, cc);
    const { market, agreements } = marketOf(research, readings[cc], own);
    if (blocked !== research.blockers.length > 0) throw new Error(blocked ? `the register holds ${cc}'s blockers, which its research doesn't` : `${cc}'s research has blockers the register doesn't hold`);
    for (const id of market.agreements) if (id === KEPT || Object.hasOwn(out.agreements, id)) throw new Error(`${id} is another agreement's id`);
    if (!follows(cc)) own.markets[cc] = market;
    out.markets[cc] = market;
    Object.assign(out.agreements, agreements);
  }
  return { markets: Object.fromEntries(files.map((cc) => [cc, out.markets[cc] as Market])), agreements: out.agreements };
}

export const serialize = (m: Markets) => `${JSON.stringify(m, null, 1)}\n`;
