import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode, type Place } from '../../world/gazetteer/gazetteer.ts';
import type { Age } from '../licence/licence.ts';
import data from './ages.json' with { type: 'json' };

/**
 * What a person may do at what age in each country (src/papers/ages/ages.json, compiled by tools/papers/ages from the
 * research, register facts papers.ages.<CC> and person.ages.<CC>; from 2026-10-31, at the owner's ruling that age
 * matters wherever a real rule reads it): the age of majority (a region's own where its law sets one), and the youngest
 * age a person may be employed and what the law says of a younger performer. Each is undefined where the game doesn't
 * know it, and the player is told.
 */

/** A person's sex, as the person's identity holds it (src/person/identity reads it from here). */
export type Sex = 'male' | 'female';

export interface WorkAge {
  readonly from: Age;
  readonly performers: 'permit' | 'free' | 'barred';
  readonly permit?: string;
  readonly permitFrom?: Age;
}

interface Ages {
  readonly majority: Age | null;
  readonly regions?: Readonly<Record<string, Age | null>>;
  readonly work: WorkAge | null;
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

export const UNKEPT_LINE = 'ages.unkept';

/** What the player is told about a place where its majority or its country's working age isn't known. Nothing otherwise. */
export function aboutAges(place: Pick<Place, 'country' | 'region'>): string | undefined {
  return majorityAt(place) !== undefined && workAge(place.country as CountryCode) !== undefined ? undefined : t(UNKEPT_LINE, { country: countryName(place.country as CountryCode) });
}
