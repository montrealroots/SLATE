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
 *
 * From 2026-10-30 a route may renew a passport held or replace a lost or stolen one, the missions abroad may set their
 * fee in another currency, and a country may issue a passport card (the US's), offered by the same routes.
 */
export type Unit = 'minute' | 'hour' | 'day' | 'working day' | 'week' | 'month';

export interface Route {
  readonly id: string;
  readonly where: 'home' | 'abroad';
  readonly speed: 'standard' | 'urgent';
  readonly within: { readonly n: number; readonly unit: Unit } | null;
  readonly months?: readonly number[];
  /** Renews a document held: open only to a holder renewing. */
  readonly renewal?: true;
  /** Replaces a lost or stolen document: open only to a holder who lost it. */
  readonly replacement?: true;
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
  /** The currency every route abroad is paid in, where the missions set their fee in one that isn't the country's. */
  readonly abroad?: { readonly currency: string };
  readonly routes: readonly Route[];
  readonly bands: readonly Band[];
  /** The passport card, where the country issues one: its name and its bands, paid for by the same routes. */
  readonly card?: { readonly name: string; readonly bands: readonly Band[] };
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

/** What an application is for, past a first issue: renewing a document held, or replacing a lost or stolen one. */
export type Need = 'renewal' | 'replacement';

export interface Applicant {
  /** Age in whole years on the day of application. */
  readonly age: number;
  /** The month of the application, 1 to 12. */
  readonly month: number;
  /** A renewal or a replacement; a first issue where absent. */
  readonly need?: Need;
}

/**
 * The routes open to what an application is for, of those offered: a renewal's or a replacement's own routes where the
 * office has any, else the ordinary ones; a first issue only the ordinary ones. Decided 2026-10-30: an office's own
 * route for a renewal is the only way it renews (Ecuador's ID renewal isn't sold at the first card's fee), so where a
 * holder may also renew in person, as in the US, the research gives that as a renewal route too.
 */
export function routesFor(routes: readonly Route[], need: Need | undefined): Route[] {
  // A first issue (no need) reads no flag a route carries, so no route is its own.
  const own = (r: Route) => r[need as Need] === true;
  const hasOwn = routes.some(own);
  return routes.filter((r) => (r.renewal === true || r.replacement === true ? own(r) : !hasOwn));
}

/** The country whose passport a country's or territory's people hold: its own, or the one it names. */
export const passportIssuer = (country: CountryCode): CountryCode | undefined => {
  const entry = PASSPORTS[country];
  return entry === undefined ? undefined : 'issuedBy' in entry ? (entry.issuedBy as CountryCode) : country;
};

/** Whether the game keeps a country's passports. */
export const keepsPassports = (country: CountryCode) => Object.hasOwn(PASSPORTS, country);

const fits = (b: Band, a: Applicant) => (b.from ?? 0) <= a.age && a.age < (b.under ?? Infinity);

/** The passport a country's people hold, and the routes open to an applicant there (a territory's, the issuer's it's open to). */
function issued(country: CountryCode, applicant: Applicant): { p: Passport; routes: Route[] } | undefined {
  const entry = PASSPORTS[country];
  if (entry === undefined) return undefined;
  // An issuer is a country compiled in its own right (the compile holds it).
  const p = ('issuedBy' in entry ? PASSPORTS[entry.issuedBy] : entry) as Passport;
  const only = 'issuedBy' in entry ? entry.onlyRoutes : undefined;
  const offered = p.routes.filter((r) => (only === undefined || only.includes(r.id)) && (r.months === undefined || r.months.includes(applicant.month)));
  return { p, routes: routesFor(offered, applicant.need) };
}

/** One offer per route and band that fits the applicant, a route abroad paid in the missions' currency where they set one. */
function offersOf(p: Passport, bands: readonly Band[], routes: readonly Route[], applicant: Applicant): Offer[] {
  const offers: Offer[] = [];
  for (const route of routes) {
    const currency = (route.where === 'abroad' ? (p.abroad?.currency ?? p.currency) : p.currency) as CurrencyCode;
    for (const b of bands) {
      if (!fits(b, applicant) || !Object.hasOwn(b.pay, route.id)) continue;
      const minor = b.pay[route.id] as number | null;
      const offer: Offer = { route, fee: minor === null ? null : money(currency, minor), validYears: b.validYears };
      offers.push(b.pages === undefined ? offer : { ...offer, pages: b.pages });
    }
  }
  return offers;
}

/**
 * The ways a country's citizen can get its passport, in the order its office lists them, one per route and band
 * that fits the applicant and what the application is for; none where the game doesn't keep the country's passports.
 */
export function passportOffers(country: CountryCode, applicant: Applicant): Offer[] | undefined {
  const found = issued(country, applicant);
  return found === undefined ? undefined : offersOf(found.p, found.p.bands, found.routes, applicant);
}

/** The name of the passport card a country's people can hold, where its issuer issues one. */
export const passportCardName = (country: CountryCode): string | undefined => {
  const issuer = passportIssuer(country);
  return issuer === undefined ? undefined : (PASSPORTS[issuer] as Passport).card?.name;
};

/** The ways to get the passport card, as passportOffers; none where the issuer issues no card; undefined where the game doesn't keep the passports. */
export function passportCardOffers(country: CountryCode, applicant: Applicant): Offer[] | undefined {
  const found = issued(country, applicant);
  if (found === undefined) return undefined;
  return found.p.card === undefined ? [] : offersOf(found.p, found.p.card.bands, found.routes, applicant);
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
