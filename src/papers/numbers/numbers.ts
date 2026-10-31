import type { Money } from '../../core/money/money.ts';
import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { checks, type CheckId } from './checks.ts';
import data from './numbers.json' with { type: 'json' };

/**
 * National numbers by country (src/papers/numbers/numbers.json, compiled by tools/papers/numbers from the research,
 * register facts papers.numbers.<CC>): the number a government gives its people (the United States' Social Security
 * number, the United Kingdom's National Insurance number, Canada's SIN, Brazil's CPF), its form and check digits,
 * when and to whom it is given, and what needs one. A country that gives none says so; a territory may hold another
 * country's. A country whose number isn't kept has none here, and the player is told.
 */
export type When = 'birth' | 'registration' | 'application' | 'work';
export type Who = 'citizens' | 'residents' | 'workers' | 'anyone';
export type Purpose = 'work' | 'bank' | 'pay' | 'tax' | 'health';

export interface NationalNumber {
  /** As the government names it. */
  readonly name: string;
  readonly issuer: string;
  /** Its characters with no spaces or separators, a pattern the whole of it matches, and the check digits it carries. */
  readonly format: { readonly length?: number; readonly min?: number; readonly pattern: string; readonly check?: CheckId };
  readonly when: When;
  /** The youngest it is given to, where the law sets an age. */
  readonly from?: number;
  readonly who: readonly Who[];
  /** What it costs, where the research states it. */
  readonly fee?: Money;
  /** The longest it takes as the issuer publishes it. */
  readonly within?: { readonly n: number; readonly unit: string };
  /** What needs one, where the law or the issuer says. */
  readonly needed?: readonly Purpose[];
}

interface None {
  readonly none: true;
}

interface Issued {
  readonly issuedBy: string;
}

const NUMBERS = data as unknown as Record<string, NationalNumber | None | Issued>;

/** Whether the game keeps a country's national number. */
export const keepsNumbers = (country: CountryCode) => Object.hasOwn(NUMBERS, country);

/** The country whose number a country's or territory's people hold: its own, or the one it names. */
export const numberIssuer = (country: CountryCode): CountryCode | undefined => {
  const entry = NUMBERS[country];
  return entry === undefined ? undefined : 'issuedBy' in entry ? (entry.issuedBy as CountryCode) : country;
};

/** A country's people's national number; 'none' where none is given; undefined where the game doesn't keep it. */
export function nationalNumber(country: CountryCode): NationalNumber | 'none' | undefined {
  const entry = NUMBERS[numberIssuer(country) ?? country] as NationalNumber | None | undefined;
  return entry === undefined || !('none' in entry) ? entry : 'none';
}

/** Whether a purpose needs the country's number: false where none is given, undefined where the research doesn't say. */
export function needsNumber(country: CountryCode, purpose: Purpose): boolean | undefined {
  const n = nationalNumber(country);
  if (n === 'none') return false;
  return n?.needed?.includes(purpose);
}

/** Whether a number, written with no spaces or separators, is in the country's form and carries its check digits. */
export function fitsNumber(country: CountryCode, text: string): boolean | undefined {
  const n = nationalNumber(country);
  if (n === undefined || n === 'none') return undefined;
  const { length = Infinity, min = length, pattern, check } = n.format;
  return text.length >= min && text.length <= length && new RegExp(`^(?:${pattern})$`).test(text) && (check === undefined || checks(check, text));
}

export const UNKEPT_LINE = 'numbers.unkept';
export const NONE_LINE = 'numbers.none';

/** What the player is told about a country's number: that the game doesn't keep it, or that none is given. Nothing otherwise. */
export function aboutNumbers(country: CountryCode): string | undefined {
  const n = nationalNumber(country);
  if (n === undefined) return t(UNKEPT_LINE, { country: countryName(country) });
  return n === 'none' ? t(NONE_LINE, { country: countryName(country) }) : undefined;
}
