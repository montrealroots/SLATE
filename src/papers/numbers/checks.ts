/**
 * The check digits a national number carries, by the id a research file names in its format's `check`. A file may
 * name only an algorithm kept here, so a number the game draws or reads is checked as its issuer checks it; one the
 * research names that isn't here yet is added here, from its published specification, before the file compiles.
 * Each gives the whole number from its body: the digits before its check digits (`digits` of them, at its end).
 */
export interface Check {
  readonly digits: number;
  readonly compute: (body: string) => string;
}

/** A weighted sum's remainder by 11 taken to a digit: 0 for a remainder under 2, else 11 less it. */
const mod11 = (body: string) => {
  const r = [...body].reduce((sum, d, i) => sum + Number(d) * (body.length + 1 - i), 0) % 11;
  return String(r < 2 ? 0 : 11 - r);
};

export const CHECKS = {
  /**
   * The Luhn formula (ISO/IEC 7812-1, Annex B): from the right of the body, every other digit doubled, beginning with
   * the last, its digits summed; the check digit takes the sum to a multiple of ten. Canada's Social Insurance Number
   * carries it (the Canada Revenue Agency's "Validating a Social Insurance Number", magmedia/sin-e.pdf, archived by
   * Library and Archives Canada on 2006-12-10, found 2026-10-30; the archive refused the fetch that day for its rate
   * limit, so the research reads it before Canada's file cites it). 046 454 286 is a number it holds valid.
   */
  luhn: {
    digits: 1,
    compute: (body: string) => {
      const sum = [...body].reverse().reduce((s, c, i) => {
        const d = Number(c) * (i % 2 === 0 ? 2 : 1);
        return s + (d > 9 ? d - 9 : d);
      }, 0);
      return body + String((10 - (sum % 10)) % 10);
    },
  },
  /**
   * Brazil's CPF: nine digits and two check digits, each the remainder by 11 of the digits before it weighted from 2
   * at the right, rising by one to the left, taken to 0 under 2 and to 11 less it otherwise; the second's sum includes
   * the first. Read 2026-10-30 in the Universidade Federal de Minas Gerais's course note "Dígitos verificadores de
   * CPF" (homepages.dcc.ufmg.br/~rodolfo/aedsi-1-12/), with its worked 123456789-09; the Receita Federal's own
   * statement of it wasn't found that day in three searches, so Brazil's file names its source for the rule.
   */
  'br-cpf': {
    digits: 2,
    compute: (body: string) => {
      const first = body + mod11(body);
      return first + mod11(first);
    },
  },
} satisfies Record<string, Check>;

export type CheckId = keyof typeof CHECKS;

export const isCheck = (id: unknown): id is CheckId => Object.hasOwn(CHECKS, id as PropertyKey);

/** Whether a number, all digits, ends in the check digits its body gives. */
export function checks(id: CheckId, number: string): boolean {
  const { digits, compute } = CHECKS[id];
  return /^\d+$/.test(number) && number.length > digits && compute(number.slice(0, -digits)) === number;
}
