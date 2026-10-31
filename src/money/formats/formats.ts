import { t } from '../../core/text/text.ts';
import { countryName, type CountryCode } from '../../world/gazetteer/gazetteer.ts';
import { hasNoBank } from '../banks/banks.ts';
import data from './formats.json' with { type: 'json' };
import { draw, refusal, type Format, type Refusal } from './number.ts';

/**
 * The number each country's banks give an account (src/money/formats/formats.json, compiled by tools/money/formats
 * from the research, register facts money.formats.<CC>): an IBAN where SWIFT's IBAN Registry gives the country one
 * (its prefix, its length and its BBAN's structure, with where the bank's own code sits in it), else the national
 * number the country's central bank or bankers' association states, part by part. A new account's number is drawn from
 * the life's seed (decider money.account), and a payee's number is checked against its country's form before a
 * transfer is sent. A country whose form the game doesn't keep has none here, and the player is told; one with no bank
 * of its own (the banks' `none`) has no account to number, and the banks tell the player so.
 */

const DATA = data as unknown as { countries: Record<string, Format> };

/** Whether the game keeps how a country's banks number their accounts. */
export const keepsFormat = (country: CountryCode) => Object.hasOwn(DATA.countries, country);

/** How a country's banks number their accounts; none where the game doesn't keep it. */
export const formatOf = (country: CountryCode): Format | undefined => DATA.countries[country];

/** A new account's number at a bank of a country; none where the game doesn't keep the country's form. */
export const accountNumber = (seed: bigint, country: CountryCode, bank: string, n: number): string | undefined => {
  const format = formatOf(country);
  return format === undefined ? undefined : draw(format, seed, country, bank, n);
};

/** What's wrong with a payee's number at a bank of a country; nothing to say where the game doesn't keep its form. */
export const payeeRefusal = (country: CountryCode, text: string): Refusal | undefined => {
  const format = formatOf(country);
  return format === undefined ? undefined : refusal(format, text);
};

export const UNKEPT_LINE = 'formats.unkept';

/** What the player is told about a country whose account numbers the game doesn't keep. Nothing otherwise, nor where there's no bank to keep them. */
export const aboutFormats = (country: CountryCode): string | undefined =>
  keepsFormat(country) || hasNoBank(country) ? undefined : t(UNKEPT_LINE, { country: countryName(country) });
