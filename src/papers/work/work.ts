import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { nationality } from '../citizenship/citizenship.ts';
import data from './work.json' with { type: 'json' };

/**
 * What a performer needs to live and work in each country (src/papers/work/work.json, compiled by tools/papers/work
 * from the research, register facts papers.work.<CC> and papers.work.group.<name>): by the worker's citizenship,
 * nothing (`free`: a right to live and work there, as the European Economic Area's free movement gives), or a
 * permission to apply for (`permit`), named by the route a performer takes, with the days a short engagement may be
 * worked without it where the law allows that. A country keeps its own list, or a shared one (the European Economic
 * Area's free movement, the United States' rules in its territories) with its own rules on top, compiled into one list
 * of every passport it names and its rule for every other. A country whose rules the game doesn't keep has none here,
 * and the player is told.
 */
export type Right = 'free' | 'permit';

export interface Work {
  readonly right: Right;
  /** The permit's route, as the government names it. */
  readonly route?: string;
  /** The days a performer may work there without the permit, within a period of `within` days where the law counts them so. */
  readonly days?: number;
  readonly within?: number;
  /** The first day those days apply (YYYY-MM-DD), where the law that gives them comes later. */
  readonly from?: string;
  /** Whom they are for, where the law limits them: artists of renown, or work engaged from abroad. */
  readonly only?: 'renowned' | 'engaged-abroad';
}

interface List {
  readonly passports: Readonly<Record<string, Work>>;
  readonly others: Work;
}

const DATA = data as unknown as { countries: Record<string, List> };

/** Whether the game keeps what a country asks of a performer who isn't its own. */
export const keepsWork = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/**
 * What a citizen of one country needs to live and work in another: 'home' where the destination is the citizen's own
 * country or state, or is of its nationality and its list doesn't name it; the list's rule for the citizenship itself
 * where it names it, else for the citizen's nationality, else its rule for every other passport; undefined where the
 * game doesn't keep the destination's rules.
 */
export function work(citizenship: CountryCode, destination: CountryCode): Work | 'home' | undefined {
  const mine = nationality(citizenship);
  if (citizenship === destination || mine === destination) return 'home';
  const list = DATA.countries[destination];
  if (list === undefined) return undefined;
  const named = list.passports[citizenship] ?? list.passports[String(mine)];
  if (named !== undefined) return named;
  return mine === nationality(destination) ? 'home' : list.others;
}

export const UNKEPT_LINE = 'work.unkept';

/** What the player is told about a country whose rules for foreign workers the game doesn't keep. Nothing otherwise. */
export const aboutWork = (country: CountryCode): string | undefined => (keepsWork(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
