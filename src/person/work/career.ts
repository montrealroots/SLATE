import { defineCommand, type Context } from '../../core/frame/frame.ts';
import { compare, fromMajor, money, multiply, roundHalfEven, subtract, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t, type LineId } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { dateOf } from '../acting/acting.ts';
import { componentOf, componentValues, facetSkill, practise, skillOf, type AttributesSlice } from '../attributes/attributes.ts';
import { inTheBusiness, personOf, speaks, type IdentitySlice, type Level } from '../identity/identity.ts';
import compiled from './markets.json' with { type: 'json' };
import { mayVisit, whyNoVisit } from '../permits/permits.ts';
import { partScore, PARTS, scriptOf, spread, type Form, type Script, type ScriptsSlice } from './work.ts';

/**
 * Getting the work out: the screenwriter's attributes that work with people (workbench/plans/screenwriter-attributes.md,
 * 13 and 21 to 26), each acting through the facets the sources name (R-4607) and read where the research says it is
 * judged, on the trade's own figures where it publishes them (R-4608, R-4241).
 *
 * - A script's documents (Synopsis): the ten the sources name, logline to scriptment, each written on its own.
 * - Networking (Networking, Speaking, Social Perceptiveness): the contacts days among the trade make. The studios read
 *   nothing unsolicited (Netflix's and Disney's own terms), so every meeting comes through a contact. A family in the
 *   business brings one from the first day: someone it knows who sponsors the writer (the game's reading of Gorji,
 *   Carney and Prakash's network sponsorship in show-business families, R-4622); the trade is the family's.
 * - Sending a script out (Promotion, the query documents, the script's grade): a contact approached may ask to read it;
 *   a stranger queried cold asks about once in sixty-six times (query services' 1 to 2%).
 * - A pitch on a request (Pitching, Speaking, Persuasion, the pitch documents): a third of the specs agents took out sold
 *   in 2012 (the Scoggins Report), the share for a script at the market's level, better scripts and meetings selling
 *   more. A script sold pays the WGA's minimum for its form (R-4241), goes off the market, and leaves its buyer a contact.
 * - Offering a script in a market (src/person/work/markets.json, compiled by tools/person/markets-writer from the
 *   research, register facts person.markets.writer.<CC>): under one of its agreements, for a production of a budget and
 *   a running time where its minimums turn on them, in the agreement's language, which the writer must write (identity's
 *   languages). A sale there pays the agreement's minimum for the form and tier on the day it sells, less what the
 *   agreement holds for the first day of photography (which the game doesn't reach: a script sold isn't shot in it);
 *   none where the research says no agreement sets the pay, left to negotiation; refused, and told, where an agreement
 *   sets it and its figures aren't known. Where the agreement sets an option's price, a pitch can take an option for a
 *   year at it instead (negotiated where the research says nothing sets it): the script comes back on the market when it
 *   lapses, as it does here, no film being made of it. What a market's research couldn't find is told.

 * The writer works alone (the owner, 2026-11-01: "just get rid of all the team stuff because I will be a solo writer"):
 * no writers' room, staffing or ladder of titles; a pilot or an episode is written and sold as a spec.
 *
 * What the trade doesn't publish (how likely a contact is made in a day, or asks to read) is the game's own until the owner balances it (person.career.model).
 */

/**
 * What the buyer pays for a script of each form, at the 2026 MBA's first-year minimum (R-4241): a feature as an
 * original screenplay with treatment at high budget, an episode a 60-minute network prime time story and teleplay, a
 * pilot 150% of that. The MBA binds the WGA's signatories, the US's buyers; a script offered in another market is paid
 * by that market's agreement (markets.json).
 */
// Stryker disable next-line StringLiteral: a mutant here throws as the module loads, which Stryker 10.0.0 reports as
// surviving (HANDOFF, blockers); the test holds each fee to the cent.
export const FEES: Readonly<Record<Form, Money | null>> = {
  // Stryker disable next-line StringLiteral: as above.
  feature: fromMajor('USD', '173215'),
  // Stryker disable next-line StringLiteral: as above.
  pilot: fromMajor('USD', '71190'),
  // Stryker disable next-line StringLiteral: as above.
  episode: fromMajor('USD', '47460'),
  short: null,
};

/**
 * The days each document needs from a writer at 100 in Writing and Time Management, twice that from one at 0. The
 * treatment is half the MBA's 6.1 weeks for the treatment step at high budget (43 days), so the slowest writer takes all
 * of it (R-4608). shortcut: the others' times aren't published (R-4608 blockers); they're the game's own until found.
 */
export const DOCUMENT_DAYS = {
  logline: 1,
  'short-synopsis': 1,
  'one-page-synopsis': 2,
  outline: 5,
  treatment: 21.5,
  'scene-breakdown': 10,
  'series-bible': 14,
  'pitch-document': 3,
  'statement-of-intent': 1,
  scriptment: 21,
} as const;

export type Document = keyof typeof DOCUMENT_DAYS;

/** What a query carries, and what a pitch leaves behind. */
export const QUERY: readonly Document[] = ['logline', 'short-synopsis', 'one-page-synopsis'];
export const PITCH: readonly Document[] = ['pitch-document', 'one-page-synopsis', 'treatment'];

export interface Out {
  /** Each document written, by its quality, 0 to 100. */
  documents: { [document: string]: number };
  /** Requests to read it not yet met in a meeting. */
  requests: number;
  sold: { at: number; fee: Money | null } | null;
}

/** An option a buyer took on a script: when, the day it lapses, and its price (none where it is negotiated). */
export interface Optioned {
  at: number;
  until: string;
  fee: Money | null;
}

/** Where a script is offered: an agreement, and the production's budget and running time where its minimums turn on them. */
export interface Offer {
  agreement: string;
  budget: number | null;
  minutes: number | null;
  options: Optioned[];
}

export interface CareerSlice {
  contacts: number;
  out: { [script: string]: Out };
  /** The scripts offered in a market; one not offered is sold under the WGA's terms. */
  offered: { [script: string]: Offer };
}

export const CAREER_START: CareerSlice = { contacts: 0, out: {}, offered: {} };

/** The agreement this engine keeps itself: the WGA's MBA (R-4241), the US's. */
export const KEPT = 'wga';

/** A market's minimum as compiled (tools/person/markets-writer/compile.ts). */
type Tier = 'budget' | 'minutes' | 'hourly';
export interface Fee {
  readonly forms: readonly Form[];
  readonly when: Readonly<Partial<Record<Tier, readonly [number, number | null]>>>;
  readonly per: 'script' | 'minute' | 'hour' | null;
  readonly from: string;
  readonly amount: string | null;
  readonly share: string | null;
  readonly cap: string | null;
  readonly held: { readonly share: string } | { readonly amount: string } | null;
}
export interface MarketAgreement {
  readonly country: CountryCode;
  readonly language: string;
  readonly currency: CurrencyCode | null;
  readonly forms: readonly Form[];
  readonly none: boolean;
  readonly unknown: boolean;
  readonly fees: readonly Fee[];
  readonly option: readonly { readonly forms: readonly Form[]; readonly share: string; readonly base: string | null }[] | 'negotiated' | null;
}
/** What a market's research couldn't find, by the item its blockers name. */
export type Unknown = 'agreement' | 'fees' | 'option' | 'language' | 'union';
export interface Market {
  readonly agreements: readonly string[];
  readonly unknown: readonly Unknown[];
}
export const MARKETS = (compiled as unknown as { markets: Readonly<Record<string, Market>> }).markets;
const COMPILED = (compiled as unknown as { agreements: Readonly<Record<string, MarketAgreement>> }).agreements;

/** A market's agreement as compiled; none for the WGA's, kept here; refused where there is none of that id. */
export function marketOf(agreement: string): MarketAgreement | null {
  if (agreement === KEPT) return null;
  if (!Object.hasOwn(COMPILED, agreement)) throw new Error(`there's no agreement ${agreement}`);
  return COMPILED[agreement] as MarketAgreement;
}

/** The country an agreement's scripts are sold in, and the language they're written in: the WGA's the US's and English. */
export const countryOf = (agreement: string): CountryCode => marketOf(agreement)?.country ?? 'US';
export const languageOf = (agreement: string): string => marketOf(agreement)?.language ?? 'en';

/** How well a writer must write a language to offer a script in it, the game's own (person.markets.writer.model). */
export const WRITES_IN: Level = 'C1';

/** The line that tells the player what of a market isn't known. */
export const UNKEPT_LINE: LineId = 'writing.unkept';
/** Each item a market's research couldn't find, as the player is told it. */
export const MISSING: Readonly<Record<Unknown, string>> = {
  agreement: 'whether any agreement sets what a script is paid',
  fees: 'some of the minimums a script is paid',
  option: "the terms of an option on a script",
  language: 'the language scripts are written in',
  union: "the guild's fees or whom it takes",
};

/** What the player is told of an agreement's market where its research couldn't find all of it: "a, b and c"; nothing where it is known whole. */
export function aboutMarket(agreement: string): string | undefined {
  const a = marketOf(agreement);
  if (a === null) return undefined;
  const missing = (MARKETS[a.country] as Market).unknown.map((u) => MISSING[u]);
  if (missing.length === 0) return undefined;
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1) as string}` : (missing[0] as string);
  return t(UNKEPT_LINE, { country: countryName(a.country), missing: list });
}

type Terms = Pick<Offer, 'agreement' | 'budget' | 'minutes'>;

/** What a tier turns on, for the production: its budget, the script's minutes, the budget an hour of it; refused where the production doesn't say. */
function tierOf(k: Tier, o: Terms, form: Form): number {
  if (k !== 'minutes' && o.budget === null) throw new Error(`a ${form} under ${o.agreement} names its production's budget`);
  if (k !== 'budget' && o.minutes === null) throw new Error(`a ${form} under ${o.agreement} names its running time`);
  const [budget, minutes] = [o.budget as number, o.minutes as number];
  return k === 'budget' ? budget : k === 'minutes' ? minutes : Math.floor((budget * 60) / minutes);
}

/** Whether a minimum's tiers hold for the production. */
function holds(f: Fee, o: Terms, form: Form): boolean {
  return (Object.entries(f.when) as [Tier, readonly [number, number | null]][]).every(([k, [lo, hi]]) => {
    const v = tierOf(k, o, form);
    return v >= lo && (hi === null || v <= hi);
  });
}

/** An amount an hour, for so many minutes: rounded half to even to a minor unit. */
const forMinutes = (m: Money, minutes: number): Money => money(m.currency, Number(roundHalfEven(BigInt(m.minor) * BigInt(minutes), 60n)));

/** A minimum's amount for the production: by the script, the minute or the hour; at least its share of the budget, at most its ceiling. */
function amountOf(currency: CurrencyCode, f: Fee, o: Terms, form: Form): Money {
  const base = fromMajor(currency, f.amount as string);
  if (f.per === 'script') return base;
  if (o.minutes === null) throw new Error(`a ${form} under ${o.agreement} names its running time`);
  const minutes = o.minutes;
  let m = f.per === 'minute' ? multiply(base, String(minutes)) : forMinutes(base, minutes);
  if (f.share !== null) {
    const share = multiply(fromMajor(currency, String(o.budget)), f.share);
    // Stryker disable next-line EqualityOperator: where the two are equal, either is the same amount.
    if (compare(share, m) > 0) m = share;
  }
  if (f.cap !== null) {
    const cap = forMinutes(fromMajor(currency, f.cap), minutes);
    // Stryker disable next-line EqualityOperator: where the two are equal, either is the same amount.
    if (compare(cap, m) < 0) m = cap;
  }
  return m;
}

/**
 * The minimum a script of a form is sold for under an agreement on a date, and what of it waits for photography: the
 * WGA's for the form; a market's for the form and tier, the latest begun by then; none where it is left to negotiation.
 * Refused where the agreement sets no terms for the form or the tier, the production doesn't say what its tier turns
 * on, no minimum is known by the date, or its figures aren't known (told).
 */
export function minimumOf(o: Terms, form: Form, date: string): { minimum: Money | null; held: Money | null } {
  const a = marketOf(o.agreement);
  if (a === null) return { minimum: FEES[form], held: null };
  if (a.unknown) throw new Error(aboutMarket(o.agreement) as string);
  if (!a.forms.includes(form)) throw new Error(`${o.agreement} sets no terms for a ${form}`);
  if (a.none) return { minimum: null, held: null };
  const fit = a.fees.filter((f) => f.forms.includes(form) && holds(f, o, form));
  if (fit.length === 0) throw new Error(`${o.agreement} sets no minimum for that ${form}`);
  const fee = fit.findLast((f) => f.from <= date);
  if (fee === undefined) throw new Error(`no minimum under ${o.agreement} is known before ${(fit[0] as Fee).from}`);
  if (fee.amount === null) return { minimum: null, held: null };
  const currency = a.currency as CurrencyCode;
  const minimum = amountOf(currency, fee, o, form);
  if (fee.held === null) return { minimum, held: null };
  return { minimum, held: 'share' in fee.held ? multiply(minimum, fee.held.share) : fromMajor(currency, fee.held.amount) };
}

/** What a sale pays when it is made: the minimum, less what waits for photography. */
export function paidOf(o: Terms, form: Form, date: string): Money | null {
  const { minimum, held } = minimumOf(o, form, date);
  // Only a minimum holds anything back.
  return held === null ? minimum : subtract(minimum as Money, held);
}

/** The years an option runs: the Norwegian film agreement's first period (no other sets one); the game's for every agreement (person.markets.writer.model). */
export const OPTION_YEARS = 1;

/** An option's price for a year: its share of the script's minimum or of the base its agreement names; none where negotiated. Refused where the agreement sets no option. */
export function optionOf(o: Terms, form: Form, date: string): Money | null {
  const { minimum } = minimumOf(o, form, date);
  const a = marketOf(o.agreement);
  if (a === null) throw new Error("the WGA's option terms aren't kept by the game");
  if (a.option === null) throw new Error((MARKETS[a.country] as Market).unknown.includes('option') ? (aboutMarket(o.agreement) as string) : `${o.agreement} sets no option`);
  if (a.option === 'negotiated') return null;
  const p = a.option.find((x) => x.forms.includes(form)) as { share: string; base: string | null };
  const base = p.base === null ? minimum : fromMajor(a.currency as CurrencyCode, p.base);
  return base === null ? null : multiply(base, p.share);
}

type Values = Readonly<Record<string, number>>;
type Career = { attributes: AttributesSlice; scripts: ScriptsSlice; career: CareerSlice };
type Promoting = Career & { identity: IdentitySlice };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const of = (v: Values, id: string) => skillOf(v, 'screenwriter', id);
const wholeDays = (days: number) => {
  if (!Number.isInteger(days) || days < 1) throw new RangeError(`the days given are a whole number of at least 1 (${days})`);
};
const outOf = (s: CareerSlice, script: number): Out => (s.out[String(script)] ??= { documents: {}, requests: 0, sold: null });
const onTheMarket = (s: Career, id: number, now: number): { script: Script; out: Out } => {
  const script = scriptOf(s.scripts, id);
  const out = outOf(s.career, id);
  if (out.sold !== null) throw new Error(`script ${id} is sold`);
  // @slate:consumer script.pitch
  const option = s.career.offered[String(id)]?.options.at(-1);
  if (option !== undefined && dateOf(now) < option.until) throw new Error(`script ${id} is under option until ${option.until}`);
  return { script, out };
};

/** A script's quality as a buyer weighs it: its last grade out of 10, or the mean of its parts where none has graded it. */
export function quality(script: Script): number {
  const last = script.reads.at(-1);
  if (last !== undefined) return last.overall * 10;
  return PARTS.reduce((t, p) => t + partScore(script, p), 0) / PARTS.length;
}

/** The best of the documents written among those given, 0 where none is: what a query or a pitch puts forward. */
export const bestOf = (out: Out, among: readonly Document[]): number => Math.max(0, ...among.map((d) => out.documents[d] ?? 0));

export interface DocumentArgs {
  [key: string]: number | string;
  script: number;
  document: Document;
  days: number;
}

/** What a writer can do in a document: the Synopsis facet it is (with what a source ties to it), and Writing. */
export function documentSkill(values: Values, document: Document): number {
  const facet = componentOf('screenwriter', 'synopsis').facets.find((f) => f.id === document);
  if (facet === undefined) throw new Error(`there's no document ${document}`);
  return 0.7 * facetSkill(values, facet, 'synopsis') + 0.3 * of(values, 'writing');
}

/** Writes one of a script's documents. */
function summarise(s: Career, a: DocumentArgs, c: Context): void {
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const k = documentSkill(values, a.document);
  const { script, out } = onTheMarket(s, a.script, c.now);
  const needed = Math.ceil(DOCUMENT_DAYS[a.document] / (0.5 + (0.5 * (0.6 * of(values, 'writing') + 0.4 * of(values, 'time-management'))) / 100));
  const effort = Math.min(1, a.days / needed);
  // @slate:consumer script.write
  out.documents[a.document] = clamp(k * (0.5 + 0.5 * effort) + spread(k) * (2 * c.draws('work.career', 'document', script.id, a.document, c.now).float() - 1), 0, 100);
  practise(s.attributes, 'screenwriter', ['synopsis', 'writing'], a.days);
}

export interface DaysArgs {
  [key: string]: number;
  days: number;
}

/** A contact a day's networking makes, at the most: a twentieth of the days for a writer at 0, half for one at 100. */
export const contactChance = (v: Values): number => 0.05 + (0.45 * (0.6 * of(v, 'networking') + 0.2 * of(v, 'speaking') + 0.2 * of(v, 'social-perceptiveness'))) / 100;

/** Days spent among the trade: festivals, panels, the people a writer already knows. */
function network(s: Career, a: DaysArgs, c: Context): void {
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const p = contactChance(values);
  const d = c.draws('work.career', 'network', c.now);
  for (let day = 0; day < a.days; day += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() < p) s.career.contacts += 1;
  }
  practise(s.attributes, 'screenwriter', ['networking', 'speaking', 'social-perceptiveness'], a.days);
}

/** How well the query sells the script, 0.5 to 1.5: Promotion and the best query document. */
export const pull = (v: Values, out: Out): number => 0.5 + (0.5 * of(v, 'promotion') + 0.5 * bestOf(out, QUERY)) / 100;

/** A cold query's chance of a request: 1.5%, the middle of the query services' 1 to 2%, as the query sells it. */
export const COLD = 0.015;

/** A stranger's chance of asking to read, on a cold query: the sourced 1.5% as the query sells it. */
export const coldChance = (v: Values, out: Out): number => COLD * pull(v, out);

/** A contact's chance of asking to read: a tenth to nine tenths, by how the query sells it and the script's grade. */
export const requestChance = (v: Values, out: Out, q: number): number => 0.4 * pull(v, out) * (0.5 + (0.5 * q) / 100);

export interface ScriptDaysArgs {
  [key: string]: number;
  script: number;
  days: number;
}

/** Sends a script out: a contact approached each day while there are contacts (the family's among them), a stranger queried cold each day after. */
function promote(s: Promoting, a: ScriptDaysArgs, c: Context): void {
  wholeDays(a.days);
  const values = componentValues(s.attributes, 'screenwriter');
  const { script, out } = onTheMarket(s, a.script, c.now);
  // @slate:consumer network.meet
  // @slate:consumer script.pitch
  // @slate:consumer identity.make
  const known = Math.min(a.days, s.career.contacts + (inTheBusiness(personOf(s.identity)) === null ? 0 : 1));
  // @slate:consumer script.summarise
  const warm = requestChance(values, out, quality(script));
  const cold = coldChance(values, out);
  const d = c.draws('work.career', 'promote', script.id, c.now);
  for (let i = 0; i < a.days; i += 1) {
    // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
    if (d.float() < (i < known ? warm : cold)) out.requests += 1;
  }
  practise(s.attributes, 'screenwriter', ['promotion'], a.days);
}

/** How a writer does in a meeting, 0 to 100: Pitching, Speaking and Persuasion, and the best pitch document. */
export const pitchSkill = (v: Values, out: Out): number => 0.5 * of(v, 'pitching') + 0.2 * of(v, 'speaking') + 0.2 * of(v, 'persuasion') + 0.1 * bestOf(out, PITCH);

/** The share of specs taken out that sold, 2012 (the Scoggins Report: 112 of 338 sent out that year; R-4608). */
export const MARKET_SHARE = 112 / 338;

/** A script at the market's level: one a Black List reader scores 7 or 8, which few reach (3.8% score 8 or more). */
export const MARKET_LEVEL = 75;

/** The chance a pitch sells: the market's share for a script at its level and a middling meeting, more for better (88% at best). */
export const saleChance = (q: number, meeting: number): number => MARKET_SHARE * (q / MARKET_LEVEL) ** 2 * (0.5 + meeting / 100);

export interface OfferArgs {
  [key: string]: string | number;
  script: number;
  agreement: string;
  /** The production's budget, in the agreement's currency, where its minimums turn on it. */
  budget?: number;
  /** The script's running time, where its minimums turn on it. */
  minutes?: number;
}

const whole = (n: number | undefined, what: string, least: number): number | null => {
  if (n === undefined) return null;
  if (!Number.isSafeInteger(n) || n < least) throw new RangeError(`${what} is a whole number of at least ${least} (${n})`);
  return n;
};

/** Offers a script in a market: under an agreement, in its language, for a production its minimums can price. */
function offer(s: Career & { identity: IdentitySlice }, a: OfferArgs, c: Context): void {
  const { script } = onTheMarket(s, a.script, c.now);
  const terms: Terms = { agreement: a.agreement, budget: whole(a.budget, 'a budget', 1), minutes: whole(a.minutes, 'a running time', 1) };
  minimumOf(terms, script.form, dateOf(c.now));
  const language = languageOf(a.agreement);
  // @slate:consumer identity.make
  if (!speaks(personOf(s.identity), language, WRITES_IN)) throw new Error(`a script under ${a.agreement} is written in ${language}, which the writer doesn't write well enough`);
  s.career.offered[String(a.script)] = { ...terms, options: s.career.offered[String(a.script)]?.options ?? [] };
}

/** The days a sale takes where it is made: the meeting's (for the permit, which reads where the work is and for how long). */
export const MEETING_DAYS = 1;

/** Where a script is sold and the days its sale takes there. */
export const saleIn = (s: CareerSlice, script: number): { country: CountryCode; days: number } => ({ country: countryOf(s.offered[String(script)]?.agreement ?? KEPT), days: MEETING_DAYS });

export const DEALS = ['sale', 'option'] as const;
export type Deal = (typeof DEALS)[number];

export interface ScriptArgs {
  [key: string]: string | number;
  script: number;
  /** A sale (the default), or an option for a year where the agreement sets its price. */
  deal?: Deal;
}

const yearsOn = (date: string, by: number) => `${Number(date.slice(0, 4)) + by}${date.slice(4)}`;

/** A pitch meeting with someone who asked to read the script: a sale or an option, at the terms of the market it is offered in. */
function pitch(s: Promoting, a: ScriptArgs, c: Context): void {
  const deal = a.deal ?? 'sale';
  if (!DEALS.includes(deal)) throw new Error(`there's no deal ${String(deal)}`);
  const values = componentValues(s.attributes, 'screenwriter');
  const { script, out } = onTheMarket(s, a.script, c.now);
  // The meeting is a visit to the market's country, not work there (the script was written at home): refused where the
  // person's passports can't visit (papers.visits).
  const where = saleIn(s.career, a.script).country;
  // @slate:consumer identity.make
  if (!mayVisit(personOf(s.identity), where)) throw new Error(whyNoVisit(where));
  // @slate:consumer script.promote
  if (out.requests < 1) throw new Error(`no one has asked to read script ${a.script}`);
  // @slate:consumer script.offer
  const terms: Terms = s.career.offered[String(a.script)] ?? { agreement: KEPT, budget: null, minutes: null };
  const date = dateOf(c.now);
  const fee = deal === 'sale' ? paidOf(terms, script.form, date) : optionOf(terms, script.form, date);
  out.requests -= 1;
  const chance = saleChance(quality(script), pitchSkill(values, out));
  // Stryker disable next-line EqualityOperator: a draw is continuous, so it equals the chance with no probability.
  if (c.draws('work.career', 'pitch', script.id, c.now, out.requests).float() < chance) {
    if (deal === 'sale') out.sold = { at: c.now, fee };
    // An option is priced only under a market's agreement, so the script is offered.
    else (s.career.offered[String(a.script)] as Offer).options.push({ at: c.now, until: yearsOn(date, OPTION_YEARS), fee });
    s.career.contacts += 1;
  }
  practise(s.attributes, 'screenwriter', ['pitching', 'speaking', 'persuasion'], MEETING_DAYS);
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const summariseScript = defineCommand<Career, DocumentArgs>({ id: 'script.summarise', reads: ['scripts'], writes: ['attributes', 'career'], run: summarise });
export const meetPeople = defineCommand<Career, DaysArgs>({ id: 'network.meet', reads: [], writes: ['attributes', 'career'], run: network });
export const offerScript = defineCommand<Career & { identity: IdentitySlice }, OfferArgs>({ id: 'script.offer', reads: ['scripts', 'identity'], writes: ['career'], run: offer });
export const promoteScript = defineCommand<Promoting, ScriptDaysArgs>({ id: 'script.promote', reads: ['scripts', 'identity'], writes: ['attributes', 'career'], run: promote });
export const pitchScript = defineCommand<Promoting, ScriptArgs>({ id: 'script.pitch', reads: ['scripts', 'identity'], writes: ['attributes', 'career'], run: pitch });
