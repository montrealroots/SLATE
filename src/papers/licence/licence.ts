import type { Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, regionName, type Place } from '../../world/gazetteer/gazetteer.ts';
import data from './licence.json' with { type: 'json' };

/**
 * Driving licences and the identity cards licensing offices issue, as photo ID (nothing in the game drives), by country
 * or, where a country's first-level regions issue their own, by region (src/papers/licence/licence.json, compiled by
 * tools/papers/licence from the research, register facts papers.licence.<key>): the issuer, the full licence and the
 * card, each with the age it is issued from, its fee and the years it lasts (null where the research hasn't read
 * them), and the licences it exchanges without a test. A territory may hold another country's. A place whose
 * licences aren't kept has none here, and the player is told.
 */
export interface LicenceDocument {
  /** As the office names it. */
  readonly name: string;
  /** The youngest it is issued to (for a licence, a full one). */
  readonly from?: number;
  /** A citizen's, where a non-citizen pays another (`foreignFee`); by the year where `perYear`. */
  readonly fee: Money | null;
  readonly foreignFee?: Money;
  readonly perYear?: true;
  readonly validYears: number | null;
  /** The age at which it ends, whichever comes first with its years. */
  readonly untilAge?: number;
  /** It never ends; its years are then null. */
  readonly forLife?: true;
}

export interface Licence {
  readonly issuer: string;
  readonly licence?: LicenceDocument & { readonly from: number };
  readonly card?: LicenceDocument;
  /** The countries and regions whose licences it exchanges without a test. */
  readonly exchange?: readonly string[];
}

type Where = Pick<Place, 'country' | 'region'>;

const LICENCES = data as unknown as Record<string, Licence | { readonly issuedBy: string }>;

/** The licence and card a place's office issues: its country's, else its region's, or those of the country its country follows; undefined where the game doesn't keep them. */
export function licenceAt({ country, region }: Where): Licence | undefined {
  const entry = LICENCES[country] ?? LICENCES[region];
  if (entry === undefined) return undefined;
  // The compile holds every issuer named as a country kept whole in its own right.
  return 'issuedBy' in entry ? (LICENCES[entry.issuedBy] as Licence) : entry;
}

export const UNKEPT_LINE = 'licence.unkept';

/** What the player is told about a place whose licences the game doesn't keep, named by its region where its country's regions issue their own. Nothing otherwise. */
export function aboutLicence(where: Where): string | undefined {
  if (licenceAt(where) !== undefined) return undefined;
  const byRegion = Object.keys(LICENCES).some((key) => key.startsWith(`${where.country}.`));
  return t(UNKEPT_LINE, { place: (byRegion ? regionName(where.region) : undefined) ?? countryName(where.country) });
}
