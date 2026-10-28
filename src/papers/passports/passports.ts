import { money, type CurrencyCode, type Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import data from './passports.json' with { type: 'json' };

/**
 * Passports by issuing country (src/papers/passports/passports.json, compiled by tools/papers/passports from the
 * research, register facts papers.passports.<CC>): the ways an office takes an application (at home or at a mission
 * abroad, standard or urgent, with the longest it takes as it publishes it), and by the applicant's age and the
 * passport's pages, the total paid for each way and how many years the passport is valid. A
 * country whose passports aren't kept has none here, and the player is told; a fee, a validity or a time the office
 * doesn't publish, or the research hasn't read, is null, and the player is told that too.
 */
export type Unit = 'minute' | 'hour' | 'day' | 'working day' | 'week';

export interface Route {
  readonly id: string;
  readonly where: 'home' | 'abroad';
  readonly speed: 'standard' | 'urgent';
  readonly within: { readonly n: number; readonly unit: Unit } | null;
  readonly months?: readonly number[];
}

interface Band {
  readonly from?: number;
  readonly under?: number;
  readonly pages?: number;
  readonly validYears: number | null;
  readonly pay: Readonly<Record<string, number | null>>;
}

interface Passport {
  readonly currency: string;
  readonly routes: readonly Route[];
  readonly bands: readonly Band[];
}

/** A territory whose people hold another country's passport, open to some of its routes or all. */
interface Issued {
  readonly issuedBy: string;
  readonly onlyRoutes?: readonly string[];
}

const PASSPORTS = data as unknown as Record<string, Passport | Issued>;

/** One way to get a passport, as the applicant meets it. */
export interface Offer {
  readonly route: Route;
  /** What it costs in all, or null where the game doesn't know. */
  readonly fee: Money | null;
  /** How many years it's valid, or null where the game doesn't know. */
  readonly validYears: number | null;
  readonly pages?: number;
}

export interface Applicant {
  /** Age in whole years on the day of application. */
  readonly age: number;
  /** The month of the application, 1 to 12. */
  readonly month: number;
}

/** The country whose passport a country's or territory's people hold: its own, or the one it names. */
export const passportIssuer = (country: CountryCode): CountryCode | undefined => {
  const entry = PASSPORTS[country];
  return entry === undefined ? undefined : 'issuedBy' in entry ? (entry.issuedBy as CountryCode) : country;
};

/** Whether the game keeps a country's passports. */
export const keepsPassports = (country: CountryCode) => Object.hasOwn(PASSPORTS, country);

const fits = (b: Band, a: Applicant) => (b.from ?? 0) <= a.age && a.age < (b.under ?? Infinity);

/**
 * The ways a country's citizen can get its passport, in the order its office lists them, one per route and band
 * that fits the applicant; none where the game doesn't keep the country's passports.
 */
export function passportOffers(country: CountryCode, applicant: Applicant): Offer[] | undefined {
  const entry = PASSPORTS[country];
  if (entry === undefined) return undefined;
  // An issuer is a country compiled in its own right (the compile holds it).
  const p = ('issuedBy' in entry ? PASSPORTS[entry.issuedBy] : entry) as Passport;
  const only = 'issuedBy' in entry ? entry.onlyRoutes : undefined;
  const offers: Offer[] = [];
  for (const route of p.routes) {
    if (only !== undefined && !only.includes(route.id)) continue;
    if (route.months !== undefined && !route.months.includes(applicant.month)) continue;
    for (const b of p.bands) {
      if (!fits(b, applicant) || !Object.hasOwn(b.pay, route.id)) continue;
      const minor = b.pay[route.id] as number | null;
      const offer: Offer = { route, fee: minor === null ? null : money(p.currency as CurrencyCode, minor), validYears: b.validYears };
      offers.push(b.pages === undefined ? offer : { ...offer, pages: b.pages });
    }
  }
  return offers;
}

export const UNKEPT_LINE = 'passports.unkept';
export const FEE_UNKNOWN_LINE = 'passports.fee-unknown';
export const VALIDITY_UNKNOWN_LINE = 'passports.validity-unknown';
export const TIME_UNKNOWN_LINE = 'passports.time-unknown';

/** What the player is told about a country's passports: where the game doesn't keep them, that it doesn't. Nothing where it does. */
export const aboutPassports = (country: CountryCode): string | undefined => (keepsPassports(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) }));

/** What the player is told about an offer the game doesn't fully know: its fee, its validity, its time, in that order. */
export function offerGaps(offer: Offer): string[] {
  const gaps: string[] = [];
  if (offer.fee === null) gaps.push(t(FEE_UNKNOWN_LINE));
  if (offer.validYears === null) gaps.push(t(VALIDITY_UNKNOWN_LINE));
  if (offer.route.within === null) gaps.push(t(TIME_UNKNOWN_LINE));
  return gaps;
}
