import { defineCommand, type Context, type Json } from '../../core/frame/frame.ts';
import { fromMajor, type Money } from '../../core/money/money.ts';
import { daysInMonth } from '../../core/time/calendar.ts';
import { ageOn } from '../../core/time/dates.ts';
import { localTime } from '../../core/time/time.ts';
import { payCost, type Holding } from '../../money/accounts/accounts.ts';
import { nationality } from '../../papers/citizenship/citizenship.ts';
import type { Sex } from '../../papers/ages/ages.ts';
import { isCountry, regionsOf, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import LANGUAGES from './languages.json' with { type: 'json' };
import type { LineId } from '../../core/text/text.ts';

/**
 * Who the person is (BUILD-ORDER layer 4; KEEP entries 3, 4, 9, 13; the owner's rulings in HANDOFF): the names, the
 * pronouns and what the person is billed as, which is their sex (the owner, 2026-11-01: "Actor (Male) Actress (Female)
 * and for They/Them it could be either or"), when and where they were
 * born, their citizenship, the languages they speak and how well, their race or ethnicity if they give one, where they
 * grew up, what their family did, and the headshot they start with. Made once, when the life is made; the one place
 * these are held, so every engine reads the same person.
 *
 * What reads each field, and what it changes, is in workbench/plans/layer4-identity.md and the engines that read it: the
 * parts written for the player (Billed As, playing age, a named ethnicity, a language; R-4620), the unions' rules
 * (names, citizenship; R-4621), a family in the business (R-4622), the languages the birthplace and where one grew up
 * suggest (CLDR 49, R-4618).
 *
 * Race or ethnicity, where given, is read only where the trade's published practice reads it: a breakdown that names
 * one, a programme whose eligibility names one. Never an ability, a judgment of work, a pay rate or a chance of being
 * good (KEEP entry 4's line).
 */

/** The line that tells the player these figures are the game's own (person.identity.model). */
export const MODEL_LINE: LineId = 'identity.model';

export type Pronouns = 'he' | 'she' | 'they';
export type Title = 'actor' | 'actress';
export type Level = (typeof LANGUAGES.levels)[number];

export const PRONOUNS: readonly Pronouns[] = ['he', 'she', 'they'];
export const TITLES: readonly Title[] = ['actor', 'actress'];
export const LEVELS = LANGUAGES.levels as readonly Level[];

/**
 * Race or ethnicity, as the trade's breakdowns name it: the categories of Sowa's count of 3,714 US television
 * breakdowns (2017; R-4620), the one source that counts how often a breakdown names each.
 */
export const ETHNICITIES = ['white', 'black', 'latino', 'asian', 'middle-eastern', 'south-asian', 'mixed', 'pacific-islander', 'native-american'] as const;
export type Ethnicity = (typeof ETHNICITIES)[number];

/**
 * What the family did: outside the business, or in it, by the trades Follows counts among the parents of actors in US
 * films of 2000-2025 (acting, directing, music, producing) and the writers among the families of writers (R-4622).
 */
export const FAMILY = ['outside', 'acting', 'directing', 'writing', 'producing', 'music'] as const;
export type Family = (typeof FAMILY)[number];

/** A headshot session's typical price where a published survey gives one: the US, Thumbtack's average of $304 (R-4622). */
// Stryker disable next-line StringLiteral: a mutant here throws as the module loads, which Stryker reports as surviving
// (HANDOFF, blockers); the test holds the price to the cent.
export const HEADSHOT_PRICE: Readonly<Partial<Record<CountryCode, Money>>> = { US: fromMajor('USD', '304') };

export interface Born {
  /** YYYY-MM-DD. */
  date: string;
  country: CountryCode;
  /** The region's key ("US.CA"), or empty. */
  region: string;
}

export interface Place {
  country: CountryCode;
  region: string;
}

export interface Spoken {
  /** BCP 47, as CLDR writes it. */
  lang: string;
  level: Level;
}

export interface Person {
  legal: { first: string; middle: string; last: string };
  /** The name the person goes by, and is credited and billed under. */
  preferred: string;
  pronouns: Pronouns;
  billedAs: Title;
  born: Born;
  citizenship: CountryCode[];
  languages: Spoken[];
  ethnicity: Ethnicity[];
  grewUp: Place;
  family: Family;
  /** When the headshot casting sees was taken; null where the person has none. */
  headshot: number | null;
}

export interface IdentitySlice {
  person: Person | null;
  /** Each headshot session had, and its price where known. */
  sessions: { at: number; price: Money | null }[];
}

export const IDENTITY_START: IdentitySlice = { person: null, sessions: [] };

const NAMES: Readonly<Record<string, string>> = LANGUAGES.names;
const TERRITORIES = LANGUAGES.territories as Readonly<Record<string, readonly { lang: string; share: number; official: boolean }[]>>;

export function personOf(s: IdentitySlice): Person {
  if (s.person === null) throw new Error('the person is not made yet');
  return s.person;
}

/** The person's age on a day where they are. */
export const ageOf = (p: Person, now: number, zone: string): number => {
  const [year, month, day] = p.born.date.split('-').map(Number) as [number, number, number];
  return ageOn({ year, month, day }, now, zone);
};

/**
 * The ages the person can play: Spotlight's rule of thumb, their age five years either way, and a young performer's
 * kept tight, a year either way under 18 (Spotlight's "9-11 at ten"; R-4620).
 */
export function playingAge(p: Person, now: number, zone: string): readonly [number, number] {
  const age = ageOf(p, now, zone);
  const by = age < 18 ? 1 : 5;
  return [Math.max(0, age - by), age + by];
}

const base = (lang: string) => lang.split('-')[0] as string;

/** Whether the person speaks a language at least as well as a level. */
export const speaks = (p: Person, lang: string, level: Level): boolean =>
  p.languages.some((l) => base(l.lang) === base(lang) && LEVELS.indexOf(l.level) >= LEVELS.indexOf(level));

/** Whether the person identifies with an ethnicity a breakdown names. */
export const identifiesAs = (p: Person, ethnicity: Ethnicity): boolean => p.ethnicity.includes(ethnicity);

/** Whether the person's family was in the business, and in which trade. */
export const inTheBusiness = (p: Person): Family | null => (p.family === 'outside' ? null : p.family);

/** Where the person lives, for tax: until a residence is held, the country of their first citizenship (money.tax.model). */
export const residenceOf = (p: Person): CountryCode => p.citizenship[0] as CountryCode;

/** The languages a place speaks, most spoken first (CLDR 49); none where CLDR doesn't list it. */
export const languagesOf = (country: CountryCode) => TERRITORIES[country] ?? [];

/**
 * The languages Identity suggests: those spoken by at least a tenth of the people where one was born or grew up (the
 * game's threshold for a suggestion), where one grew up first. The player confirms or changes them.
 */
export function suggestedLanguages(born: CountryCode, grewUp: CountryCode): string[] {
  const out: string[] = [];
  for (const c of [grewUp, born]) for (const l of languagesOf(c)) if (l.share >= 10 && !out.includes(l.lang)) out.push(l.lang);
  return out;
}

/** The citizenship the birthplace suggests: the nationality its people hold. */
export const suggestedCitizenship = (born: CountryCode): CountryCode | undefined => nationality(born);

/** The person's sex, as the papers, casting and the awards read it: an actor is male, an actress female. */
export const sexOf = (p: Person): Sex => (p.billedAs === 'actor' ? 'male' : 'female');

/** The title pronouns settle: he an actor, she an actress; they settle neither (KEEP entry 3). */
export const settledTitle = (pronouns: Pronouns): Title | null => (pronouns === 'he' ? 'actor' : pronouns === 'she' ? 'actress' : null);

export interface MakeArgs {
  [key: string]: Json;
  first: string;
  middle: string;
  last: string;
  preferred: string;
  pronouns: Pronouns;
  /** Needed under they/them; where the pronouns settle it, it must agree. */
  billedAs: Title | null;
  born: string;
  bornCountry: string;
  bornRegion: string;
  citizenship: string[];
  languages: { lang: string; level: string }[];
  ethnicity: string[];
  grewUpCountry: string;
  grewUpRegion: string;
  family: string;
  /** Whether the person brings a photo of themselves: their first headshot. */
  portrait: boolean;
}

const named = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${what} is needed`);
  return v.trim();
};

const country = (v: string, what: string): CountryCode => {
  if (!isCountry(v)) throw new Error(`there's no country ${v} for ${what}`);
  return v;
};

const region = (c: CountryCode, r: string, what: string): string => {
  if (r !== '' && !regionsOf(c).some((x) => x.key === r)) throw new Error(`${r} isn't a region of ${c} for ${what}`);
  return r;
};

function birthDate(v: string, now: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const [y, mo, d] = (m ?? []).slice(1).map(Number) as [number, number, number];
  if (m === null || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw new Error(`${v} isn't a date`);
  // Today where it is latest (Kiribati's Line Islands, UTC+14): nobody born anywhere today is refused.
  const t = localTime('Pacific/Kiritimati', now).date;
  if (v > `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`) throw new Error(`${v} is after today`);
  return v;
}

const unique = <T>(xs: readonly T[], what: string): T[] => {
  if (new Set(xs).size !== xs.length) throw new Error(`${what} is given twice`);
  return [...xs];
};

function make(s: { identity: IdentitySlice }, a: MakeArgs, c: Context): void {
  if (s.identity.person !== null) throw new Error('the person is made already');
  if (!PRONOUNS.includes(a.pronouns)) throw new Error(`there are no pronouns ${String(a.pronouns)}`);
  const settled = settledTitle(a.pronouns);
  if (a.billedAs !== null && !TITLES.includes(a.billedAs)) throw new Error(`there's no title ${String(a.billedAs)}`);
  if (settled !== null && a.billedAs !== null && a.billedAs !== settled) throw new Error(`${a.pronouns} pronouns bill a person as ${settled}`);
  const billedAs = settled ?? a.billedAs;
  if (billedAs === null) throw new Error('they/them pronouns leave the billing to the player');
  const bornCountry = country(a.bornCountry, 'the birthplace');
  const grewUp = country(a.grewUpCountry, 'where you grew up');
  if (a.citizenship.length === 0) throw new Error('a citizenship is needed');
  const citizenship = unique(a.citizenship.map((x) => country(x, 'the citizenship')), 'a citizenship');
  if (a.languages.length === 0) throw new Error('a language is needed');
  const languages = a.languages.map((l): Spoken => {
    // Own keys only: `in` would take a name every object has ("constructor") for a language.
    if (!Object.hasOwn(NAMES, l.lang)) throw new Error(`there's no language ${l.lang}`);
    if (!LEVELS.includes(l.level as Level)) throw new Error(`there's no level ${l.level}`);
    return { lang: l.lang, level: l.level as Level };
  });
  unique(languages.map((l) => l.lang), 'a language');
  const ethnicity = unique(a.ethnicity, 'an ethnicity').map((e) => {
    if (!(ETHNICITIES as readonly string[]).includes(e)) throw new Error(`there's no ethnicity ${e}`);
    return e as Ethnicity;
  });
  if (!(FAMILY as readonly string[]).includes(a.family)) throw new Error(`there's no family trade ${a.family}`);
  s.identity.person = {
    legal: { first: named(a.first, 'a first name'), middle: typeof a.middle === 'string' ? a.middle.trim() : '', last: named(a.last, 'a last name') },
    preferred: named(a.preferred, 'the name you go by'),
    pronouns: a.pronouns,
    billedAs,
    born: { date: birthDate(a.born, c.now), country: bornCountry, region: region(bornCountry, a.bornRegion, 'the birthplace') },
    citizenship,
    languages,
    ethnicity,
    grewUp: { country: grewUp, region: region(grewUp, a.grewUpRegion, 'where you grew up') },
    family: a.family as Family,
    headshot: a.portrait ? c.now : null,
  };
}

export interface HeadshotArgs {
  [key: string]: string;
  country: string;
  /** The account the session is paid from, where its price is known. */
  account: string;
}

/** A headshot session where the person lives: a new headshot, at the market's price where a survey gives one, paid from the account named. */
function headshot(s: { identity: IdentitySlice } & Holding, a: HeadshotArgs, c: Context): void {
  const p = personOf(s.identity);
  const where = country(a.country, 'the session');
  const price = HEADSHOT_PRICE[where] ?? null;
  if (price !== null) payCost(s, a.account, 'photographer', price, 'a headshot session', c.now);
  p.headshot = c.now;
  s.identity.sessions.push({ at: c.now, price });
}

// Stryker disable all: a mutant of a declaration made as the module loads changes its shape, so the module loaded
// again for it is refused as declared twice (as the accounts' and the cards' say). The declarations are held by the
// test that lists each command with what it reads and writes; what each does is mutated above.
export const makePerson = defineCommand<{ identity: IdentitySlice }, MakeArgs>({ id: 'identity.make', reads: [], writes: ['identity'], run: make });
export const takeHeadshot = defineCommand<{ identity: IdentitySlice } & Holding, HeadshotArgs>({ id: 'identity.headshot', reads: [], writes: ['identity', 'accounts', 'ledger'], run: headshot });
