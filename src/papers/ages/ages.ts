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

export type Service = 'none' | { readonly sexes: readonly Sex[]; readonly from: Age; readonly until: Age; readonly months: number | null };

interface Ages {
  readonly majority: Age | null;
  readonly regions?: Readonly<Record<string, Age>>;
  readonly work: WorkAge | null;
  readonly service: Service | null;
}

const DATA = data as unknown as Readonly<Record<string, Ages>>;

/** The age of majority where a place is: its region's own where its law sets one, else its country's; undefined where unknown. */
export function majorityAt({ country, region }: Pick<Place, 'country' | 'region'>): Age | undefined {
  const a = DATA[country];
  return a?.regions?.[region] ?? a?.majority ?? undefined;
}

/** The youngest age a person may be employed in a country, and what the law says of a younger performer; undefined where unknown. */
export const workAge = (country: CountryCode): WorkAge | undefined => DATA[country]?.work ?? undefined;

/** A country's military service; undefined where unknown. */
export const serviceIn = (country: CountryCode): Service | undefined => DATA[country]?.service ?? undefined;

/** Whether a country calls a person of this sex to service: undefined where its service isn't known. */
export function calls(country: CountryCode, sex: Sex): boolean | undefined {
  const s = serviceIn(country);
  return s === undefined ? undefined : s !== 'none' && s.sexes.includes(sex);
}

export const UNKEPT_LINE = 'ages.unkept';

/** What the player is told about a country where any of the three isn't known. Nothing otherwise. */
export function aboutAges(country: CountryCode): string | undefined {
  const a = DATA[country];
  return a !== undefined && a.majority !== null && a.work !== null && a.service !== null ? undefined : t(UNKEPT_LINE, { country: countryName(country) });
}
