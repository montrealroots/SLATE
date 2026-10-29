import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { nationality } from '../citizenship/citizenship.ts';
import data from './visits.json' with { type: 'json' };

/**
 * What a visitor needs to enter each country (src/papers/visits/visits.json, compiled by tools/papers/visits from the
 * research, register facts papers.visits.<CC> and papers.visits.group.<name>): by the visitor's citizenship, nothing
 * (`free`), an electronic travel authorisation (`eta`), a visa applied for online (`evisa`), one given at the border
 * (`arrival`), or one applied for beforehand (`visa`), with the days a stay may last where the list sets them. A
 * country keeps its own list or a shared one (the EU's common visa list), with rules of its own where it treats a
 * passport otherwise (Guam's waiver on top of the United States'). A country whose list the game doesn't keep has
 * none here, and the player is told.
 */
export type Entry = 'free' | 'eta' | 'evisa' | 'arrival' | 'visa';

export interface Visit {
  readonly entry: Entry;
  /** The days a stay may last, within a period of `within` days where the list counts them so. */
  readonly days?: number;
  readonly within?: number;
}

interface List {
  readonly passports: Readonly<Record<string, Visit>>;
  readonly others: Visit;
}

const DATA = data as unknown as { groups: Record<string, List>; countries: Record<string, List | { group: string; passports?: List['passports'] }> };

/** Whether the game keeps what a country asks of its visitors. */
export const keepsVisits = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** The list a country keeps: its own, or the shared one it names with its own rules for the passports it treats otherwise (the compile holds every one named). */
const listOf = (country: CountryCode): List | undefined => {
  const entry = DATA.countries[country];
  if (entry === undefined || !('group' in entry)) return entry;
  const shared = DATA.groups[entry.group] as List;
  return { passports: { ...shared.passports, ...entry.passports }, others: shared.others };
};

/**
 * What a citizen of one country needs to visit another: 'home' where the destination is the citizen's own state, or
 * is of its nationality and its list doesn't name it; the list's rule for the citizenship itself where it names it (a
 * territory's own passport, as Bermuda's), else for the citizen's nationality, else its rule for every other passport;
 * undefined where the game doesn't keep the destination's list.
 */
export function visit(citizenship: CountryCode, destination: CountryCode): Visit | 'home' | undefined {
  const mine = nationality(citizenship);
  if (mine === destination) return 'home';
  const list = listOf(destination);
  if (list === undefined) return undefined;
  const named = list.passports[citizenship] ?? list.passports[String(mine)];
  if (named !== undefined) return named;
  return mine === nationality(destination) ? 'home' : list.others;
}

export const UNKEPT_LINE = 'visits.unkept';

/** What the player is told about a country whose list the game doesn't keep. Nothing otherwise. */
export const aboutVisits = (country: CountryCode): string | undefined => (keepsVisits(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
