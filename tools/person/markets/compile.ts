import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromMajor, isCurrency, type CurrencyCode } from '../../../src/core/money/money.ts';

/**
 * Compiles the markets an actor is engaged in beyond the US, the UK and Canada (src/person/acting/markets.json), from
 * the research's files, one per country (research/sources/person/markets/<CC>.json, register fact
 * person.markets.<CC>), each checked against the SHA-256 its register entry cites before a byte of it is read, and the
 * game's reading of them (tools/person/markets/readings.json): which agreements a part can be engaged under in the
 * market's city, and where in the research each minimum stands.
 *
 * An agreement gives its country, its currency, the media it covers (film, television, the stage) and its minimums:
 * each by medium, by role where the agreement names roles, by the term it pays (a day, a week, a month, a year, a
 * session, a performance or an episode), by the tier it sets (the budget, the lines, the seats, an episode's minutes,
 * the engagement's length, the actor's years in the work, the day or performance of the engagement it pays), from the
 * date it applies, in the agreement's currency; a rehearsal's apart. Every amount is read from the research at its
 * place, never written here; every date and currency is checked to stand in the research's figure. An agreement whose
 * research says no agreement sets an actor's pay (`none`) leaves it to negotiation, and has no minimums.
 *
 * A market gives the language its parts are cast in (one a person can be made to speak: identity's languages), its
 * city's time zone (one the clock keeps, by its own name or a link; where the research names no city, the zone of the
 * country's most populous place on the map, the game's reading) and its agreements. A territory whose research says its
 * work follows another country's terms (Saint-Barthélemy France's, the Cocos Islands Australia's) is engaged under that
 * country's agreements, each as the territory's own (its id the territory's code before the agreement's), their terms
 * read from the other's research, never copied into this one's. A country whose research gives nothing the engine can
 * read has a reading saying why, and no market.
 *
 * Every country the research holds, compiled or not, gives what its research couldn't find (its blockers' items, or,
 * where the register cites only its blockers, the items they name), which the engine tells the player.
 */
export const SOURCES = 'research/sources/person/markets';
export const READINGS = 'tools/person/markets/readings.json';
export const OUTPUT = 'src/person/acting/markets.json';
export const LANGUAGES = 'src/person/identity/languages.json';
export const ZONES = 'src/core/time/tzdb.json';
export const PLACES = 'src/world/gazetteer/places';
/** The register's facts: a market's research, and its blockers. */
export const FACT = 'person.markets.';
export const BLOCKED = 'person.markets.blocked.';
/** The agreements the actor's engine keeps itself (R-4614); a market's may not take their ids. */
export const KEPT = ['sag-aftra', 'pact-equity', 'uk-theatre', 'actra'] as const;

export const MEDIA = ['film', 'television', 'stage'] as const;
export const TERMS = ['day', 'week', 'month', 'year', 'session', 'performance', 'episode'] as const;
/** What a minimum's tier turns on: the part's budget, lines, seats, an episode's minutes, its length; the actor's years; the unit of the engagement it pays. */
export const TIERS = ['budget', 'lines', 'seats', 'minutes', 'length', 'years', 'nth'] as const;
/** What a market's research can leave unknown, as its blockers name it. */
export const ITEMS = ['agreements', 'rates', 'none', 'union', 'language', 'market', 'terms', 'successors'] as const;

export type Medium = (typeof MEDIA)[number];
export type Term = (typeof TERMS)[number];
export type Tier = (typeof TIERS)[number];
export type Item = (typeof ITEMS)[number];
/** From one whole number to another, both counted; to none, without end. */
export type Range = readonly [number, number | null];

export interface Minimum {
  medium: Medium;
  role: string | null;
  per: Term;
  /** A rehearsal's minimum, paid for each rehearsal unit beside the engagement's. */
  rehearsal: boolean;
  /** The terms of engagement a rehearsal's minimum goes with; every term where none are named. */
  with: Term[] | null;
  when: Partial<Record<Tier, Range>>;
  from: string;
  amount: string;
}

export interface Agreement {
  country: string;
  /** None where no agreement sets the pay. */
  currency: string | null;
  media: Medium[];
  none: boolean;
  minimums: Minimum[];
  /** The agreement whose terms a territory's work follows, where it follows another country's. */
  follows?: string;
}

export interface Market {
  language: string;
  zone: string;
  agreements: string[];
}

export interface Markets {
  markets: Record<string, Market>;
  agreements: Record<string, Agreement>;
  /** What each country's research couldn't find, compiled or not. */
  unknown: Record<string, Item[]>;
}

interface Figure {
  item: string;
  value: unknown;
}
export interface Research {
  country: string;
  figures: Figure[];
  blockers: { item: string }[];
}
interface Register {
  entries: { fact: string; value?: { file?: string; sha256?: string }; attempts?: { result: string }[] }[];
}

const record = (v: unknown, what: string): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`${what} is not an object`);
  return v as Record<string, unknown>;
};

/** The research's figure a reading points at, of one of the items it may be. */
export function figureOf(r: Research, at: unknown, items: readonly string[]): Figure {
  const f = typeof at === 'number' ? r.figures[at] : undefined;
  if (f === undefined || !items.includes(f.item)) throw new Error(`${r.country}'s figure ${String(at)} isn't one of its ${items.join(' or ')}`);
  return f;
}

/** What stands at a path in a figure's value. */
export function at(v: unknown, path: readonly (string | number)[]): unknown {
  let here = v;
  for (const key of path) {
    if (typeof here !== 'object' || here === null || !Object.hasOwn(here, key)) throw new Error(`has nothing at ${path.join('.')}`);
    here = (here as Record<string, unknown>)[key];
  }
  return here;
}

/** A tier's range: whole numbers, the first no more than the last. */
export function range(v: unknown): Range {
  if (!Array.isArray(v) || v.length !== 2) throw new Error('a tier is a pair');
  const [lo, hi] = v as unknown[];
  if (!Number.isSafeInteger(lo) || (lo as number) < 0 || (hi !== null && (!Number.isSafeInteger(hi) || (hi as number) < (lo as number)))) throw new Error(`a tier runs from a whole number to a greater one or none (${JSON.stringify(v)})`);
  return [lo as number, hi as number | null];
}

const overlap = (a: Range, b: Range) => a[0] <= (b[1] ?? Infinity) && b[0] <= (a[1] ?? Infinity);

/** Whether two minimums can never both apply to one part: a tier both set, in ranges that don't meet. */
export const apart = (a: Minimum, b: Minimum): boolean => TIERS.some((k) => a.when[k] !== undefined && b.when[k] !== undefined && !overlap(a.when[k], b.when[k]));

/** Whether a date stands in a figure: written whole, or (the first of a month) as its month, no day after it. */
export const dated = (text: string, from: string): boolean => text.includes(from) || (from.endsWith('-01') && new RegExp(`(?<!\\d)${from.slice(0, 7)}(?!-?\\d)`).test(text));

/** One minimum, read from the research at its place. */
export function minimumOf(r: Research, reading: unknown, currency: CurrencyCode, media: readonly Medium[]): Minimum {
  const m = record(reading, 'a minimum');
  for (const k of Object.keys(m)) if (!['medium', 'role', 'per', 'rehearsal', 'with', 'when', 'from', 'fig', 'path', 'dated'].includes(k)) throw new Error(`a minimum names ${k}, which the game doesn't read`);
  const figure = figureOf(r, m['fig'], ['rates', 'agreements']);
  const text = JSON.stringify(figure);
  if (!media.includes(m['medium'] as Medium)) throw new Error(`a minimum's medium ${String(m['medium'])} isn't its agreement's`);
  if (!TERMS.includes(m['per'] as Term)) throw new Error(`a minimum is paid by ${String(m['per'])}, which isn't a term`);
  const role = m['role'] ?? null;
  if (role !== null && (typeof role !== 'string' || role === '')) throw new Error('a role is named');
  const terms = m['with'] ?? null;
  if (terms !== null && (!Array.isArray(terms) || !terms.every((x) => TERMS.includes(x as Term)))) throw new Error('a rehearsal goes with terms');
  const when: Partial<Record<Tier, Range>> = {};
  for (const [k, v] of Object.entries(record(m['when'] ?? {}, 'a tier'))) {
    if (!TIERS.includes(k as Tier)) throw new Error(`a minimum's tier turns on ${k}, which the game doesn't read`);
    when[k as Tier] = range(v);
  }
  const from = String(m['from']);
  // The date stands in the minimum's own figure, or in the one the reading names (an agreement's, where its rates are undated).
  const since = m['dated'] === undefined ? text : JSON.stringify(figureOf(r, m['dated'], ['rates', 'agreements']));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !dated(since, from)) throw new Error(`${r.country}'s figure ${String(m['fig'])} doesn't date a minimum from ${from}`);
  if (!text.includes(currency)) throw new Error(`${r.country}'s figure ${String(m['fig'])} doesn't name ${currency}`);
  const amount = at(figure.value, m['path'] as (string | number)[]);
  if (typeof amount !== 'number' || !(amount > 0)) throw new Error(`${r.country}'s figure ${String(m['fig'])} has no amount at ${(m['path'] as unknown[]).join('.')}`);
  fromMajor(currency, String(amount));
  return { medium: m['medium'] as Medium, role, per: m['per'] as Term, rehearsal: m['rehearsal'] === true, with: terms as Term[] | null, when, from, amount: String(amount) };
}

const slot = (m: Minimum) => [m.medium, m.role, m.per, m.rehearsal, m.from].join('|');

/**
 * Whether an agreement's minimums are one to a part: where two share a slot (medium, role, term, rehearsal or not, date)
 * they are apart by a tier; a medium's minimums all name a role or none does; its rehearsals are paid by one term; and
 * where a slot's minimums pay the engagement's units in turn, they pay every one, from the first.
 */
export function checkAgreement(id: string, all: readonly Minimum[]): void {
  for (const [i, a] of all.entries()) for (const b of all.slice(i + 1)) if (slot(a) === slot(b) && !apart(a, b)) throw new Error(`${id} sets two minimums for one part (${slot(a)})`);
  for (const medium of MEDIA) {
    const own = all.filter((m) => m.medium === medium);
    if (own.some((m) => m.role === null) && own.some((m) => m.role !== null)) throw new Error(`${id}'s ${medium} minimums name a role and none`);
  }
  if (new Set(all.filter((m) => m.rehearsal).map((m) => m.per)).size > 1) throw new Error(`${id}'s rehearsals are paid by more than one term`);
  for (const m of all) {
    if (m.when.nth === undefined) continue;
    const turns = all.filter((x) => slot(x) === slot(m) && TIERS.every((k) => k === 'nth' || JSON.stringify(x.when[k]) === JSON.stringify(m.when[k]))).map((x) => x.when.nth);
    // Every one has a turn: one without beside one with would be two minimums for one part, refused above.
    const sorted = (turns as Range[]).sort((a, b) => a[0] - b[0]);
    const runs = sorted.every((r, i) => r[0] === (i === 0 ? 1 : ((sorted[i - 1] as Range)[1] as number) + 1));
    if (!runs || (sorted.at(-1) as Range)[1] !== null) throw new Error(`${id}'s minimums by the unit don't pay every unit (${slot(m)})`);
  }
}

/** One agreement: the pay left to negotiation where the research says none sets it, or its minimums. */
export function agreementOf(id: string, r: Research, reading: unknown): Agreement {
  const a = record(reading, `the reading of ${id}`);
  const media = a['media'];
  if (!Array.isArray(media) || media.length === 0 || !media.every((x) => MEDIA.includes(x as Medium))) throw new Error(`${id} covers film, television or the stage`);
  if (a['none'] !== undefined) {
    figureOf(r, record(a['none'], 'none')['fig'], ['none']);
    return { country: r.country, currency: null, media: media as Medium[], none: true, minimums: [] };
  }
  const currency = String(a['currency']);
  if (!isCurrency(currency)) throw new Error(`${id} pays in ${currency}, which isn't a currency`);
  if (!Array.isArray(a['minimums']) || a['minimums'].length === 0) throw new Error(`${id} sets no minimums`);
  // By date, so each slot's steps run in order (as the engine's tables are read); the reading's order kept between equals.
  const minimums = a['minimums'].map((m) => minimumOf(r, m, currency, media as Medium[])).sort((x, y) => x.from.localeCompare(y.from));
  checkAgreement(id, minimums);
  return { country: r.country, currency, media: media as Medium[], none: false, minimums };
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

/** The zone of a country's most populous place on the map (the first of equals), or none where the map has no places for it. */
export function placeZone(root: string, cc: string): string | undefined {
  const file = join(root, PLACES, `${cc}.tsv`);
  if (!existsSync(file)) return undefined;
  let best: { population: number; zone: string } | undefined;
  for (const line of readFileSync(file, 'utf8').split('\n').filter((l) => l !== '')) {
    const cols = line.split('\t');
    const population = Number(cols[7]);
    if (best === undefined || population > best.population) best = { population, zone: cols[6] as string };
  }
  return best?.zone;
}

/** A territory's languages as identity holds them (CLDR 49, R-4618): each with its share of the people and whether it is official. */
export type Spoken = readonly { lang: string; share: number; official: boolean }[];

/**
 * The language a country's work is cast in where its research names none: its most spoken official language by CLDR,
 * where one is most spoken alone and a person can speak it; none (not settled) otherwise.
 */
export function spokenOf(territory: Spoken | undefined, names: Readonly<Record<string, string>>): string | undefined {
  const official = territory?.filter((l) => l.official);
  if (official === undefined) return undefined;
  const most = Math.max(...official.map((l) => l.share));
  const top = official.filter((l) => l.share === most);
  return top.length === 1 && Object.hasOwn(names, (top[0] as Spoken[number]).lang) ? (top[0] as Spoken[number]).lang : undefined;
}

/**
 * A market: its language (one a person speaks, standing in the research's figure where it has one; where it has none,
 * its most spoken official one by CLDR), its city's zone
 * (where the research names no city, its most populous place's), and its agreements: its own, or, where its research
 * says its work follows another country's terms, that country's as compiled (`done`), each as the territory's own.
 */
export function marketOf(r: Research, reading: unknown, names: Readonly<Record<string, string>>, zones: ReadonlySet<string>, place: () => string | undefined, done: Pick<Markets, 'markets' | 'agreements'>, spoken: () => string | undefined): { market: Market; agreements: Record<string, Agreement> } {
  const m = record(reading, `the reading of ${r.country}`);
  const lang = record(m['language'], 'a language');
  const code = String(lang['code']);
  if (!Object.hasOwn(names, code)) throw new Error(`${r.country} casts in ${code}, which a person can't speak`);
  if (lang['fig'] !== null) {
    const text = JSON.stringify(figureOf(r, lang['fig'], ['language']));
    if (!new RegExp(`\\b${code}\\b`).test(text) && !text.includes(names[code] as string)) throw new Error(`${r.country}'s language figure doesn't name ${code}`);
  } else {
    const most = spoken();
    if (most !== code) throw new Error(`${r.country}'s research names no language, so it is its most spoken official one by CLDR (${String(most)}), not ${code}`);
  }
  const zone = String(m['zone']);
  if (!zones.has(zone)) throw new Error(`${zone} isn't a zone the clock keeps`);
  if (m['market'] === null) {
    const most = place();
    if (most !== zone) throw new Error(`${r.country}'s research names no city, so its zone is its most populous place's (${String(most)}), not ${zone}`);
  } else {
    const city = record(figureOf(r, m['market'], ['market']).value, 'a market');
    const named = city['tz'] ?? city['timeZone'];
    if (named !== undefined && named !== zone) throw new Error(`${r.country}'s market is in ${String(named)}, not ${zone}`);
  }
  const agreements: Record<string, Agreement> = {};
  if (m['follows'] === undefined) {
    for (const [id, a] of Object.entries(record(m['agreements'], 'the agreements'))) agreements[id] = agreementOf(id, r, a);
  } else {
    if (m['agreements'] !== undefined) throw new Error(`${r.country} follows another country's agreements, and has none of its own`);
    const f = record(m['follows'], 'what a market follows');
    const cc = String(f['market']);
    if (record(figureOf(r, f['fig'], ['none']).value, 'a none')['follows'] !== cc) throw new Error(`${r.country}'s figure ${String(f['fig'])} doesn't say its work follows ${cc}'s terms`);
    if (!Object.hasOwn(done.markets, cc)) throw new Error(`${cc} isn't a market to follow`);
    for (const id of (done.markets[cc] as Market).agreements) {
      const a = done.agreements[id] as Agreement;
      if (a.follows !== undefined) throw new Error(`${cc} follows another country's terms itself`);
      agreements[`${r.country.toLowerCase()}-${id}`] = { ...a, country: r.country, follows: id };
    }
  }
  return { market: { language: code, zone, agreements: Object.keys(agreements) }, agreements };
}

/** A market's research, checked against the register's SHA-256 before a byte is read, and whether the register holds its blockers. */
export function readResearch(root: string, register: Register, cc: string): { research: Research; blocked: boolean } {
  const file = `${SOURCES}/${cc}.json`;
  // Stryker disable next-line OptionalChaining: the entry found names the file, so it has a value.
  const sha = register.entries.find((e) => e.fact === `${FACT}${cc}` && e.value?.file === file)?.value?.sha256;
  if (sha === undefined) throw new Error(`${file} isn't cited by the register`);
  const bytes = readFileSync(join(root, file));
  if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error(`${file} isn't the file the register cites`);
  const research = JSON.parse(bytes.toString('utf8')) as Research;
  if (research.country !== cc) throw new Error(`${file} is ${research.country}'s`);
  return { research, blocked: register.entries.some((e) => e.fact === `${BLOCKED}${cc}`) };
}

/** What a country's register blocker names unknown, where the register cites only that: each attempt's "not found: <item>". */
export function blockedOf(register: Register, cc: string): Item[] {
  const entry = register.entries.find((e) => e.fact === `${BLOCKED}${cc}`);
  if (entry === undefined) throw new Error(`${SOURCES}/${cc}.json isn't cited by the register`);
  return unknownOf((entry.attempts as { result: string }[]).map((a) => ({ item: /^not found: (\w+)$/.exec(a.result)?.[1] ?? a.result })));
}

/**
 * Every market the research holds, read as the readings say (a territory following another's terms after the rest), and
 * what each country's research couldn't find; a file the register cites without a reading, a reading without a file
 * the register cites, or a reading that says why it isn't read and something else, is refused.
 */
export function readMarkets(root: string): Markets {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const readings = record(read(READINGS), 'the readings');
  const register = read('research/register.json') as Register;
  const { names, territories } = read(LANGUAGES) as { names: Record<string, string>; territories: Record<string, Spoken> };
  const tz = read(ZONES) as { zones: object; links: object };
  const zones = new Set([...Object.keys(tz.zones), ...Object.keys(tz.links)]);
  // Stryker disable next-line MethodExpression: the directory's order is sorted on the file systems the gate runs on; the sort holds it on any other.
  const files = existsSync(join(root, SOURCES)) ? readdirSync(join(root, SOURCES)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).map((f) => f.slice(0, -5)).sort() : [];
  const out: Markets = { markets: {}, agreements: {}, unknown: {} };
  for (const cc of Object.keys(readings).filter((c) => !files.includes(c))) throw new Error(`${cc} has a reading and no research`);
  const researched: [string, Research][] = [];
  for (const cc of files) {
    if (!register.entries.some((e) => e.fact === `${FACT}${cc}`)) {
      out.unknown[cc] = blockedOf(register, cc);
      if (Object.hasOwn(readings, cc)) throw new Error(`${cc} has a reading, and no research the register cites`);
      continue;
    }
    if (!Object.hasOwn(readings, cc)) throw new Error(`${SOURCES}/${cc}.json has no reading`);
    const { research, blocked } = readResearch(root, register, cc);
    const unknown = unknownOf(research.blockers);
    if (blocked !== unknown.length > 0) throw new Error(blocked ? `the register holds ${cc}'s blockers, which its research doesn't` : `${cc}'s research has blockers the register doesn't hold`);
    out.unknown[cc] = unknown;
    const reading = record(readings[cc], `the reading of ${cc}`);
    const why = reading['unread'];
    if (why === undefined) {
      researched.push([cc, research]);
      continue;
    }
    // An unread reading may name what its research leaves open without a blocker (whether a sovereign's agreements reach a territory), so the player is told.
    const told = reading['unknown'] ?? [];
    if (typeof why !== 'string' || why === '' || !Array.isArray(told) || Object.keys(reading).some((k) => k !== 'unread' && k !== 'unknown')) throw new Error(`${cc}'s reading says why it isn't read, what that leaves unknown, and nothing else`);
    out.unknown[cc] = unknownOf([...research.blockers, ...told.map((item) => ({ item: String(item) }))]);
  }
  // Every reading here is an object (checked above), so whether it follows another's is its own key.
  const follows = ([c]: [string, Research]) => Object.hasOwn(readings[c] as object, 'follows');
  for (const [cc, research] of [...researched.filter((x) => !follows(x)), ...researched.filter(follows)]) {
    const { market, agreements } = marketOf(research, readings[cc], names, zones, () => placeZone(root, cc), out, () => spokenOf(territories[cc], names));
    for (const id of market.agreements) if ((KEPT as readonly string[]).includes(id) || Object.hasOwn(out.agreements, id)) throw new Error(`${id} is another agreement's id`);
    out.markets[cc] = market;
    Object.assign(out.agreements, agreements);
  }
  return out;
}

export const serialize = (m: Markets) => `${JSON.stringify(m, null, 1)}\n`;
