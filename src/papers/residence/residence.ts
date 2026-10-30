import type { Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './residence.json' with { type: 'json' };

/**
 * Residence permissions by country (src/papers/residence/residence.json, compiled by tools/papers/residence from the
 * research, register facts papers.residence.<CC>): the routes by which someone who isn't a country's citizen may live
 * there, each as the government names it, with what it is for, where it is applied for, the work it allows and what
 * the research states of its fee, time, term, renewal, its years' count toward naturalisation and the way to permanent
 * residence. A territory may follow another country's. A country whose routes aren't kept has none here, and the
 * player is told.
 */
export interface ResidenceRoute {
  readonly id: string;
  /** As the government names it. */
  readonly name: string;
  readonly for: 'work' | 'self-employed' | 'talent' | 'family' | 'study' | 'means' | 'retirement' | 'permanent' | 'free movement';
  /** Where it is applied for; absent where the research's source doesn't say. */
  readonly apply?: 'abroad' | 'in country' | 'either';
  readonly fee?: Money;
  /** The longest a decision takes as the office publishes it. */
  readonly within?: { readonly n: number; readonly unit: string };
  /** How long a grant lasts. */
  readonly term?: { readonly n: number; readonly unit: 'day' | 'week' | 'month' | 'year' };
  readonly renewable?: true;
  /** The work it allows: any, only for the sponsor named, or none; absent where the research's source doesn't say. */
  readonly work?: 'any' | 'sponsor' | 'none';
  /** Its years count toward naturalisation's. */
  readonly counts?: true;
  /** The years on it after which permanent residence may be asked for. */
  readonly permanentAfter?: number;
  /** A free movement route's: the groups (or countries) whose citizens it is for. */
  readonly groups?: readonly string[];
}

const RESIDENCE = data as unknown as Record<string, { readonly routes: readonly ResidenceRoute[] } | { readonly issuedBy: string } | { readonly free: true }>;

/** Whether the game keeps how someone from abroad may live in a country. */
export const keepsResidence = (country: CountryCode) => Object.hasOwn(RESIDENCE, country);

/**
 * The routes by which someone from abroad may live in a country, its own or the ones it follows; none where no permit is
 * needed at all (`needsNoPermit`); undefined where the game doesn't keep them.
 */
export function residenceRoutes(country: CountryCode): readonly ResidenceRoute[] | undefined {
  const entry = RESIDENCE[country];
  if (entry === undefined) return undefined;
  if ('free' in entry) return [];
  return 'issuedBy' in entry ? residenceRoutes(entry.issuedBy as CountryCode) : entry.routes;
}

/** Whether anyone may live and work in a place with no permit of any kind; undefined where the game doesn't keep it. */
export const needsNoPermit = (country: CountryCode): boolean | undefined => (keepsResidence(country) ? 'free' in (RESIDENCE[country] as object) : undefined);

export const UNKEPT_LINE = 'residence.unkept';

/** What the player is told about a country whose residence routes the game doesn't keep. Nothing otherwise. */
export const aboutResidence = (country: CountryCode): string | undefined => (keepsResidence(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));
