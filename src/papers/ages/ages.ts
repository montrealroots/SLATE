import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode, type Place } from '../../world/gazetteer/gazetteer.ts';
import type { Age } from '../licence/licence.ts';
import data from './ages.json' with { type: 'json' };

/**
 * What a person may do at what age, and what their sex changes, in each country (src/papers/ages/ages.json, compiled by
 * tools/papers/ages from the research, register facts papers.ages.<CC>; from 2026-10-31, at the owner's ruling that
 * sex and age matter wherever a real rule reads them): the age of majority (a region's own where its law sets one),
 * the youngest age a person may be employed and what the law says of a younger performer, and military service by
 * sex and age. Each is undefined where the game doesn't know it, and the player is told.
 */
export type Sex = 'male' | 'female';

export interface WorkAge {
  readonly from: Age;
  readonly performers: 'permit' | 'free' | 'barred';
  readonly permit?: string;
  readonly permitFrom?: Age;
}

export interface Term {
  readonly sexes: readonly Sex[];
  readonly from: Age;
  readonly until: Age;
  readonly months: number | null;
}

/** None, or a term for each sex the law calls (one term may call both). */
export type Service = 'none' | readonly Term[];

interface Ages {
  readonly majority: Age | null;
  readonly regions?: Readonly<Record<string, Age | null>>;
  readonly work: WorkAge | null;
  readonly service: Service | null;
}

const DATA = data as unknown as Readonly<Record<string, Ages>>;

/** The age of majority where a place is: its region's own where the research names the region, else its country's; undefined where unknown. */
export function majorityAt({ country, region }: Pick<Place, 'country' | 'region'>): Age | undefined {
  const a = DATA[country];
  const own = a?.regions?.[region];
  return (own === undefined ? a?.majority : own) ?? undefined;
}

/** The youngest age a person may be employed in a country, and what the law says of a younger performer; undefined where unknown. */
export const workAge = (country: CountryCode): WorkAge | undefined => DATA[country]?.work ?? undefined;

/** A country's military service; undefined where unknown. */
export const serviceIn = (country: CountryCode): Service | undefined => DATA[country]?.service ?? undefined;

/** The term a country calls a person of this sex to: none where it calls them to none; undefined where its service isn't known. */
export function termFor(country: CountryCode, sex: Sex): Term | 'none' | undefined {
  const s = serviceIn(country);
  return s === undefined ? undefined : s === 'none' ? 'none' : (s.find((t) => t.sexes.includes(sex)) ?? 'none');
}

export const UNKEPT_LINE = 'ages.unkept';

/** What the player is told about a place where any of the three isn't known (its majority where it is). Nothing otherwise. */
export function aboutAges(place: Pick<Place, 'country' | 'region'>): string | undefined {
  const a = DATA[place.country];
  // Stryker disable next-line ConditionalExpression: a country the game doesn't keep has no majority either, so majorityAt already says no; the guard is for the type.
  return a !== undefined && majorityAt(place) !== undefined && a.work !== null && a.service !== null ? undefined : t(UNKEPT_LINE, { country: countryName(place.country as CountryCode) });
}
