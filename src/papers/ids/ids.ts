import { money, type CurrencyCode } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { routesFor, type Need, type Offer, type Route } from '../passports/passports.ts';
import data from './ids.json' with { type: 'json' };

/**
 * National identity documents by country (src/papers/ids/ids.json, compiled by tools/papers/ids from the research,
 * register facts papers.ids.<CC>): the document's name, the ways the office takes an application and, by age, the
 * total paid for each way and how many years the document is valid, in the passports' form. A country that issues none says so; a territory may hold another country's. A country whose
 * documents aren't kept has none here, and the player is told; what the research hasn't read is null, and the player
 * is told that too.
 *
 * From 2026-10-30 a card may give the age from which it must be held, the youngest it's issued to, and the groups and
 * countries where it serves as a travel document; its renewal and its replacement are routes, as the passports' are.
 */
interface Band {
  readonly from?: number;
  readonly under?: number;
  readonly validYears: number | null;
  /** The card never expires (its validYears then null). */
  readonly permanent?: true;
  readonly pay: Readonly<Record<string, number | null>>;
}

interface Card {
  readonly document: string;
  readonly currency: string;
  readonly routes: readonly Route[];
  readonly bands: readonly Band[];
  /** The age from which the card must be held. */
  readonly must?: number;
  /** The youngest age the card is issued at. */
  readonly from?: number;
  /** The groups (EU/EEA, GCC, Mercosur, ECOWAS) and countries where the card serves as a travel document. */
  readonly travel?: readonly string[];
}

interface None {
  readonly none: true;
}

interface Issued {
  readonly issuedBy: string;
}

const IDS = data as unknown as Record<string, Card | None | Issued>;

/** One way to get an identity document, as the applicant meets it: the passports' offer, and whether it never expires. */
export type IdOffer = Offer & { readonly permanent?: true };

/** Whether the game keeps a country's identity documents. */
export const keepsIds = (country: CountryCode) => Object.hasOwn(IDS, country);

/** The country whose identity document a country's or territory's people hold: its own, or the one it names. */
export const idIssuer = (country: CountryCode): CountryCode | undefined => {
  const entry = IDS[country];
  return entry === undefined ? undefined : 'issuedBy' in entry ? (entry.issuedBy as CountryCode) : country;
};

/** The issuer's own entry (the compile holds every issuer as a country in its own right). */
const own = (country: CountryCode) => IDS[idIssuer(country) ?? country] as Card | None | undefined;

/** The name of the identity document a country's people hold; 'none' where none is issued. */
export function idDocument(country: CountryCode): string | undefined {
  const entry = own(country);
  if (entry === undefined) return undefined;
  return 'none' in entry ? 'none' : entry.document;
}

const fits = (b: Band, age: number) => (b.from ?? 0) <= age && age < (b.under ?? Infinity);

/**
 * The ways a citizen of an age (whole years on the day of application) can get the country's identity document, for a
 * first issue, a renewal or a replacement, one per route and band that fits; none where none is issued or the citizen is
 * younger than it's issued to; undefined where the game doesn't keep it.
 */
export function idOffers(country: CountryCode, age: number, need?: Need): IdOffer[] | undefined {
  const entry = own(country);
  if (entry === undefined) return undefined;
  if ('none' in entry || age < (entry.from ?? 0)) return [];
  const offers: IdOffer[] = [];
  for (const route of routesFor(entry.routes, need)) {
    for (const b of entry.bands) {
      if (!fits(b, age) || !Object.hasOwn(b.pay, route.id)) continue;
      const minor = b.pay[route.id] as number | null;
      const offer: IdOffer = { route, fee: minor === null ? null : money(entry.currency as CurrencyCode, minor), validYears: b.validYears };
      offers.push(b.permanent === true ? { ...offer, permanent: true } : offer);
    }
  }
  return offers;
}

/** Whether a citizen of an age must hold the country's identity document; false where none is issued or no age is set; undefined where the game doesn't keep it. */
export function mustHoldId(country: CountryCode, age: number): boolean | undefined {
  const entry = own(country);
  if (entry === undefined) return undefined;
  // A country that issues none, or sets no age, has no `must`: nobody reaches it.
  return age >= ((entry as { readonly must?: number }).must ?? Infinity);
}

/** The groups and countries where the country's identity document serves as a travel document; none where it serves nowhere known or none is issued; undefined where the game doesn't keep it. */
export function idTravel(country: CountryCode): readonly string[] | undefined {
  const entry = own(country);
  if (entry === undefined) return undefined;
  // A country that issues none has no `travel`.
  return (entry as { readonly travel?: readonly string[] }).travel ?? [];
}

export const UNKEPT_LINE = 'ids.unkept';
export const NONE_LINE = 'ids.none';
export const FEE_UNKNOWN_LINE = 'ids.fee-unknown';
export const VALIDITY_UNKNOWN_LINE = 'ids.validity-unknown';
export const TIME_UNKNOWN_LINE = 'ids.time-unknown';

/** What the player is told about a country's identity documents: that the game doesn't keep them, or that none is issued. Nothing otherwise. */
export function aboutIds(country: CountryCode): string | undefined {
  const doc = idDocument(country);
  if (doc === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  return doc === 'none' ? t(NONE_LINE, { country: countryName(country) }) : undefined;
}

/** What the player is told about an offer the game doesn't fully know: its fee, its validity (unless it never expires), its time, in that order. */
export function idOfferGaps(offer: IdOffer): string[] {
  const gaps: string[] = [];
  if (offer.fee === null) gaps.push(t(FEE_UNKNOWN_LINE));
  if (offer.validYears === null && offer.permanent !== true) gaps.push(t(VALIDITY_UNKNOWN_LINE));
  if (offer.route.within === null) gaps.push(t(TIME_UNKNOWN_LINE));
  return gaps;
}
