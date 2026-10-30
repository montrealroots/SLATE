import { draws, type Draws } from '../../core/rng/rng.ts';

/**
 * An account's number in its country's form (src/money/formats/formats.ts holds each country's): a new one drawn
 * from the life's seed, an IBAN's check digits worked out, and a payee's number checked. Kept apart from the
 * country lookups so the compile (tools/money/formats/compile.ts) checks the registry's own examples by the same rule.
 */

/** What a character of the number may be, in the registry's notation: a digit, a capital letter, or either. */
export type Kind = 'n' | 'a' | 'c';

export interface Part {
  readonly length: number;
  readonly kind: Kind;
}

/** Characters from..to of a number, counted from 1, both included. */
export type Span = readonly [number, number];

export interface Iban {
  /** The registry's two letters that open the number: the country's own, or those of the country whose IBAN covers it. */
  readonly prefix: string;
  /** The whole IBAN's characters: the prefix, the two check digits and the BBAN. */
  readonly length: number;
  /** The BBAN, part by part, as the registry's structure gives it. */
  readonly bban: readonly Part[];
  /** Where the bank's own code sits in the BBAN; none where the registry gives none. */
  readonly bank?: Span;
}

export interface National {
  /** The number's name, as the country's banks call it. */
  readonly name: string;
  readonly parts: readonly (Part & { readonly name: string })[];
  /** Where the bank's own code sits in the number. */
  readonly bank?: Span;
}

export type Format = { readonly iban: Iban } | { readonly national: National };

/**
 * A number read mod 97, a letter as two digits (A is 10, Z is 35): ISO 13616-1:2020's IBAN check, ISO/IEC 7064:2003
 * MOD 97-10, worked a character at a time so no figure grows past a few thousand. The standards are sold, not read
 * here; the rule is proven on every example SWIFT's registry gives (tests/money/formats/formats.test.ts).
 */
export function mod97(text: string): number {
  let rest = 0;
  for (const ch of text) rest = ch >= 'A' ? (rest * 100 + ch.charCodeAt(0) - 55) % 97 : (rest * 10 + ch.charCodeAt(0) - 48) % 97;
  return rest;
}

/** The two check digits of the IBAN for a prefix and a BBAN: 98 less the BBAN, the prefix and 00 read mod 97. */
export const ibanCheck = (prefix: string, bban: string): string => String(98 - mod97(`${bban}${prefix}00`)).padStart(2, '0');

const CLASSES: Record<Kind, string> = { n: '[0-9]', a: '[A-Z]', c: '[A-Z0-9]' };
const fits = (text: string, parts: readonly Part[]) => new RegExp(`^${parts.map((p) => `${CLASSES[p.kind]}{${p.length}}`).join('')}$`).test(text);

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Characters to the parts, those inside the bank's span from the bank's own stream and the rest from the account's. A
 * `c` is drawn as a digit: the registry allows a letter there and some banks use one (its own French example has an M),
 * but most numbers are digits through, and letters drawn 26 times in 36 would give numbers no bank gives.
 */
function fill(parts: readonly Part[], bank: Span | undefined, own: Draws, account: Draws): string {
  let out = '';
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      const at = out.length + 1;
      const from = bank !== undefined && at >= bank[0] && at <= bank[1] ? own : account;
      out += part.kind === 'a' ? from.pick([...LETTERS]) : String(from.below(10));
    }
  }
  return out;
}

/**
 * A new account's number at a bank, in the form given: the bank's own code drawn once a life for the bank (so every
 * account there carries it), the rest for the account (`n`, the holder's nth account at the bank). An IBAN is given
 * in its electronic form, with its check digits worked out.
 *
 * shortcut: two banks of a country can draw the same code (one time in 10 to the code's length); when transfers read
 * the bank from a payee's number, draw each bank of the country a code no other has.
 */
export function draw(format: Format, seed: bigint, country: string, bank: string, n: number): string {
  const own = draws(seed, 'money.account', country, bank);
  const account = draws(seed, 'money.account', country, bank, n);
  if ('iban' in format) {
    const { prefix, bban, bank: span } = format.iban;
    const body = fill(bban, span, own, account);
    return `${prefix}${ibanCheck(prefix, body)}${body}`;
  }
  return fill(format.national.parts, format.national.bank, own, account);
}

/** Why a payee's number is refused: too long or short, another country's, a character out of place, or its check fails. */
export type Refusal = 'length' | 'country' | 'structure' | 'check';

/**
 * What's wrong with a payee's number in a form, if anything: spaces (the IBAN's printed groups) are dropped and letters
 * read as capitals, as the registry's electronic form writes them.
 */
export function refusal(format: Format, text: string): Refusal | undefined {
  const s = text.replace(/\s/g, '').toUpperCase();
  if ('national' in format) {
    const { parts } = format.national;
    if (s.length !== parts.reduce((sum, p) => sum + p.length, 0)) return 'length';
    return fits(s, parts) ? undefined : 'structure';
  }
  const { prefix, length, bban } = format.iban;
  if (s.length !== length) return 'length';
  if (!s.startsWith(prefix)) return 'country';
  if (!fits(s.slice(2), [{ length: 2, kind: 'n' }, ...bban])) return 'structure';
  return mod97(`${s.slice(4)}${s.slice(0, 4)}`) === 1 ? undefined : 'check';
}
