import { add, money, type Money } from '../../core/money/money.ts';
import { inUnits } from '../../money/units/units.ts';
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
/** A fee set in an index unit: so many of it, worth their value on the day paid, and any amount the office adds. */
export interface UnitFee {
  readonly count: string;
  readonly unit: string;
  readonly plus?: Money;
}

export interface LicenceDocument {
  /** As the office names it. */
  readonly name: string;
  /** The youngest it is issued to (for a licence, a full one). */
  readonly from?: number;
  /** A citizen's, where a non-citizen pays another (`foreignFee`); by the year where `perYear`. */
  readonly fee: Money | UnitFee | null;
  readonly foreignFee?: Money | UnitFee;
  readonly perYear?: true;
  readonly validYears: number | null;
  /** The age at which it ends, whichever comes first with its years; or the ages, in order, at the first of which the holder reaches it ends. */
  readonly untilAge?: number | readonly number[];
  /**
   * The terms it's sold for, each with its fee and the ages it's sold to where limited; a holder chooses among those
   * their age allows. Its years and fee are then null.
   */
  readonly terms?: readonly {
    readonly years?: number;
    readonly forLife?: true;
    readonly untilAge?: number;
    readonly fee: Money | UnitFee;
    readonly foreignFee?: Money | UnitFee;
    readonly for?: 'citizens' | 'foreigners';
    readonly perYear?: true;
    readonly from?: number;
    readonly under?: number;
  }[];
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

/** What a fee comes to on a day (YYYY-MM-DD): an amount as it is; so many of a unit at its value that day, with what's added; none where it isn't known. */
export function feeOn(fee: Money | UnitFee | null | undefined, day: string): Money | undefined {
  if (fee === null || fee === undefined || 'minor' in fee) return fee ?? undefined;
  const value = inUnits(fee.count, fee.unit, day);
  return value === undefined || fee.plus === undefined ? value : add(value, fee.plus);
}

/**
 * What a term comes to on a day: its fee (a non-citizen's where `foreign` and the term charges one), times its years
 * where the fee is by the year; none where the fee isn't known that day.
 */
export function termFeeOn(term: NonNullable<LicenceDocument['terms']>[number], day: string, foreign = false): Money | undefined {
  const fee = feeOn(foreign ? (term.foreignFee ?? term.fee) : term.fee, day);
  return fee === undefined || term.perYear !== true ? fee : money(fee.currency, fee.minor * (term.years as number));
}

type Where = Pick<Place, 'country' | 'region'>;

const LICENCES = data as unknown as Record<string, Licence | { readonly issuedBy: string } | { readonly none: true }>;

/** The licence and card a place's office issues: its country's, else its region's, or those of the country its country follows; undefined where the game doesn't keep them. */
export function licenceAt({ country, region }: Where): Licence | undefined {
  const entry = LICENCES[country] ?? LICENCES[region];
  if (entry === undefined || 'none' in entry) return undefined;
  // The compile holds every issuer named as a place kept in its own right: a country kept whole, or a region
  // (Christmas Island's licences are Western Australia's).
  return 'issuedBy' in entry ? (LICENCES[entry.issuedBy] as Licence) : entry;
}

export const UNKEPT_LINE = 'licence.unkept';
export const NONE_LINE = 'licence.none';

/**
 * What the player is told about a place that issues no licence of its own, or whose licences the game doesn't keep
 * (named by its region where its country's regions issue their own). Nothing otherwise.
 */
export function aboutLicence(where: Where): string | undefined {
  if (licenceAt(where) !== undefined) return undefined;
  if (LICENCES[where.country] !== undefined && 'none' in (LICENCES[where.country] as object)) return t(NONE_LINE, { place: countryName(where.country) });
  const byRegion = Object.keys(LICENCES).some((key) => key.startsWith(`${where.country}.`));
  return t(UNKEPT_LINE, { place: (byRegion ? regionName(where.region) : undefined) ?? countryName(where.country) });
}
