import type { Money } from '../../core/money/money.ts';
import type { Unit } from '../passports/passports.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './citizenship.json' with { type: 'json' };

/**
 * Citizenship by country (src/papers/citizenship/citizenship.json, compiled by tools/papers/citizenship from the
 * research, register facts papers.citizenship.<CC>): for a state, the years of residence its ordinary naturalisation
 * asks ("none" where it naturalises no one by residence), whether it makes the applicant give up every other
 * citizenship, and whether its own citizens lose its citizenship on voluntarily taking another; for a territory, the
 * state whose nationality its people hold, whose rules are its own, unless living there doesn't count towards that
 * state's naturalisation (Svalbard), which then naturalises no one there. Whether other citizenships must go, or are
 * lost, is null where the research couldn't read it, and the player is told; a country the game doesn't keep has
 * nothing here, and the player is told that too.
 *
 * From 2026-10-30 a state may also give how citizenship comes at birth (by birth in its territory, by descent), and its
 * naturalisation's fee, the longest it takes and the tests it asks; where the research hasn't read them, they're absent.
 */
export interface AtBirth {
  /** By birth in the territory: always, on a condition the law states (soilIf), or never. */
  readonly soil: 'unconditional' | 'conditional' | 'none';
  readonly soilIf?: string;
  /** By descent: from either parent, from the father only, or never; with any limit for a child born abroad. */
  readonly descent: 'either parent' | 'father' | 'none';
  readonly descentAbroad?: string;
}

export type Test = 'language' | 'civics';

interface State {
  readonly years: number | 'none';
  readonly renounce: boolean | null;
  readonly lapses: boolean | null;
  readonly atBirth?: AtBirth;
  readonly fee?: Money;
  readonly within?: { readonly n: number; readonly unit: Unit };
  readonly test?: readonly Test[];
}

/** An ordinary naturalisation: the years of residence, whether every other citizenship must go, and its fee, time and tests where read. */
export interface Naturalisation {
  readonly years: number;
  readonly renounce: boolean | null;
  readonly fee?: Money;
  readonly within?: { readonly n: number; readonly unit: Unit };
  /** The tests it asks; none where empty. */
  readonly test?: readonly Test[];
}

interface Of {
  readonly nationalityOf: string;
  readonly residenceCounts?: false;
}

const RULES = data as unknown as Record<string, State | Of>;

/** Whether the game keeps a country's citizenship rules. */
export const keepsCitizenship = (country: CountryCode) => Object.hasOwn(RULES, country);

/** The state whose nationality a country's or territory's people hold: its own, or the one it names. */
export const nationality = (country: CountryCode): CountryCode | undefined => {
  const entry = RULES[country];
  return entry === undefined ? undefined : 'nationalityOf' in entry ? (entry.nationalityOf as CountryCode) : country;
};

/** The state's own rules (the compile holds every state named as a country in its own right). */
const rules = (country: CountryCode) => RULES[String(nationality(country))] as State | undefined;

/** A state's ordinary naturalisation: the years of residence it asks, whether every other citizenship must go, and its fee, time and tests where read; 'none' where it naturalises no one by residence; undefined where the game doesn't keep it. */
export function naturalisation(country: CountryCode): Naturalisation | 'none' | undefined {
  const state = rules(country);
  if (state === undefined) return undefined;
  const counts = (RULES[country] as Partial<Of>).residenceCounts !== false;
  if (state.years === 'none' || !counts) return 'none';
  const { years, renounce, fee, within, test } = state;
  return { years, renounce, ...(fee === undefined ? {} : { fee }), ...(within === undefined ? {} : { within }), ...(test === undefined ? {} : { test }) };
}

/** How citizenship comes at birth in a country (a territory's, its state's); undefined where the game doesn't keep it or the research hasn't read it. */
export const atBirth = (country: CountryCode): AtBirth | undefined => rules(country)?.atBirth;

/** The citizenships a person holds after naturalising in a country, and those whose keeping the game doesn't know. */
export interface Held {
  readonly held: readonly CountryCode[];
  readonly unsure: readonly CountryCode[];
}

/**
 * What naturalising in a country does to the citizenships a person holds (each the state whose nationality it is):
 * the new one is added; every other goes where the new state makes the applicant give them up; otherwise each goes
 * whose own law takes it from a citizen who voluntarily takes another. Where a rule isn't known the citizenship is
 * kept and named unsure. Undefined where the game doesn't keep a rule it needs, or the state naturalises no one by
 * residence.
 */
export function naturalise(held: readonly CountryCode[], country: CountryCode): Held | undefined {
  const into = naturalisation(country);
  const states = held.map(nationality);
  if (into === undefined || into === 'none' || states.includes(undefined)) return undefined;
  // Kept, so its nationality is too.
  const gained = nationality(country) as CountryCode;
  const others = [...new Set(states as CountryCode[])].filter((s) => s !== gained);
  if (into.renounce === true) return { held: [gained], unsure: [] };
  const lapses = (s: CountryCode) => (rules(s) as State).lapses;
  const kept = others.filter((s) => lapses(s) !== true);
  const unsure = into.renounce === null ? kept : kept.filter((s) => lapses(s) === null);
  return { held: [...kept, gained], unsure };
}

export const UNKEPT_LINE = 'citizenship.unkept';
export const NONE_LINE = 'citizenship.none';
export const KEEP_UNKNOWN_LINE = 'citizenship.keep-unknown';

/** What the player is told about a country's naturalisation: that the game doesn't keep it, or that no one is naturalised there by residence. Nothing otherwise. */
export function aboutNaturalisation(country: CountryCode): string | undefined {
  const into = naturalisation(country);
  if (into === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  if (into !== 'none') return undefined;
  // A territory where living doesn't count is named itself; otherwise the state whose rules they are.
  return t(NONE_LINE, { country: countryName((rules(country) as State).years === 'none' ? (nationality(country) as CountryCode) : country) });
}

/** What the player is told about each citizenship whose keeping the game doesn't know. */
export const keepingUnknown = (after: Held) => after.unsure.map((s) => t(KEEP_UNKNOWN_LINE, { country: countryName(s) }));
