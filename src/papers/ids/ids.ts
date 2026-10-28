import { money, type CurrencyCode } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import type { Offer, Route } from '../passports/passports.ts';
import data from './ids.json' with { type: 'json' };

/**
 * National identity documents by country (src/papers/ids/ids.json, compiled by tools/papers/ids from the research,
 * register facts papers.ids.<CC>): the document's name, from what age holding one is compulsory, the ways the office
 * takes an application and, by age, the total paid for each way and how many years the document is valid, in the
 * passports' form. A country that issues none says so; a territory may hold another country's. A country whose
 * documents aren't kept has none here, and the player is told; what the research hasn't read is null, and the player
 * is told that too.
 */
interface Band {
  readonly from?: number;
  readonly under?: number;
  readonly validYears: number | null;
  readonly pay: Readonly<Record<string, number | null>>;
}

interface Card {
  readonly document: string;
  readonly compulsory: { readonly from: number } | false | null;
  readonly currency: string;
  readonly routes: readonly Route[];
  readonly bands: readonly Band[];
}

interface None {
  readonly none: true;
}

interface Issued {
  readonly issuedBy: string;
  readonly onlyRoutes?: readonly string[];
}

const IDS = data as unknown as Record<string, Card | None | Issued>;

/** Whether the game keeps a country's identity documents. */
export const keepsIds = (country: CountryCode) => Object.hasOwn(IDS, country);

/** The country whose identity document a country's or territory's people hold: its own, or the one it names. */
export const idIssuer = (country: CountryCode): CountryCode | undefined => {
  const entry = IDS[country];
  return entry === undefined ? undefined : 'issuedBy' in entry ? (entry.issuedBy as CountryCode) : country;
};

/** The issuer's own entry (the compile holds every issuer as a country in its own right). */
const own = (country: CountryCode) => IDS[idIssuer(country) ?? country] as Card | None | undefined;

/** The identity document a country's people hold: its name and from what age it is compulsory; 'none' where none is issued. */
export function idDocument(country: CountryCode): { name: string; compulsory: { from: number } | false | null } | 'none' | undefined {
  const entry = own(country);
  if (entry === undefined) return undefined;
  return 'none' in entry ? 'none' : { name: entry.document, compulsory: entry.compulsory };
}

const fits = (b: Band, age: number) => (b.from ?? 0) <= age && age < (b.under ?? Infinity);

/** The ways a citizen of an age (whole years on the day of application) can get the country's identity document, one per route and band that fits; none where none is issued; undefined where the game doesn't keep it. */
export function idOffers(country: CountryCode, age: number): Offer[] | undefined {
  const entry = own(country);
  if (entry === undefined) return undefined;
  if ('none' in entry) return [];
  const territory = IDS[country] as Card | Issued;
  const only = 'issuedBy' in territory ? territory.onlyRoutes : undefined;
  const offers: Offer[] = [];
  for (const route of entry.routes) {
    if (only !== undefined && !only.includes(route.id)) continue;
    for (const b of entry.bands) {
      if (!fits(b, age) || !Object.hasOwn(b.pay, route.id)) continue;
      const minor = b.pay[route.id] as number | null;
      offers.push({ route, fee: minor === null ? null : money(entry.currency as CurrencyCode, minor), validYears: b.validYears });
    }
  }
  return offers;
}

export const UNKEPT_LINE = 'ids.unkept';
export const NONE_LINE = 'ids.none';
export const COMPULSORY_UNKNOWN_LINE = 'ids.compulsory-unknown';
export const FEE_UNKNOWN_LINE = 'ids.fee-unknown';
export const VALIDITY_UNKNOWN_LINE = 'ids.validity-unknown';
export const TIME_UNKNOWN_LINE = 'ids.time-unknown';

/** What the player is told about a country's identity documents: not kept, none issued, or whether holding one is compulsory unknown. Nothing otherwise. */
export function aboutIds(country: CountryCode): string | undefined {
  const doc = idDocument(country);
  if (doc === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  if (doc === 'none') return t(NONE_LINE, { country: countryName(country) });
  return doc.compulsory === null ? t(COMPULSORY_UNKNOWN_LINE, { document: doc.name }) : undefined;
}

/** What the player is told about an offer the game doesn't fully know: its fee, its validity, its time, in that order. */
export function idOfferGaps(offer: Offer): string[] {
  const gaps: string[] = [];
  if (offer.fee === null) gaps.push(t(FEE_UNKNOWN_LINE));
  if (offer.validYears === null) gaps.push(t(VALIDITY_UNKNOWN_LINE));
  if (offer.route.within === null) gaps.push(t(TIME_UNKNOWN_LINE));
  return gaps;
}
