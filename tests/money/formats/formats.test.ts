import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/formats/formats.json';
import { aboutFormats, accountNumber, formatOf, keepsFormat, payeeRefusal, UNKEPT_LINE } from '../../../src/money/formats/formats.ts';
import { draw, ibanCheck, mod97, refusal, type Format } from '../../../src/money/formats/number.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const SEED = 0x5eed_0000_0000_0001n;
const GB = formatOf('GB') as Format;
const CLABE: Format = {
  national: {
    name: 'CLABE',
    parts: [
      { name: 'bank', length: 3, kind: 'n' },
      { name: 'branch', length: 3, kind: 'n' },
      { name: 'account', length: 11, kind: 'n' },
      { name: 'check', length: 1, kind: 'n' },
    ],
    bank: [1, 3],
  },
};

/** The registry's own example IBAN for each country it gives one, from the research. */
const EXAMPLES = readdirSync(join(ROOT, 'research/sources/money/formats')).flatMap((name) => {
  const file = JSON.parse(readFileSync(join(ROOT, 'research/sources/money/formats', name), 'utf8')) as { country: string; iban?: { example?: string } };
  return file.iban?.example === undefined ? [] : [[file.country, file.iban.example] as const];
});

describe('account numbers', () => {
  it("are drawn and checked in each country's own form", () => {
    expect(COUNTRY_CODES.filter(keepsFormat)).toEqual(Object.keys(data.countries).sort());
    expect([keepsFormat('GB'), keepsFormat('US')]).toEqual([true, false]);
    expect(formatOf('US')).toBeUndefined();
    expect(GB).toStrictEqual({ iban: { prefix: 'GB', length: 22, bban: [{ length: 4, kind: 'a' }, { length: 6, kind: 'n' }, { length: 8, kind: 'n' }], bank: [1, 4] } });
    // Guadeloupe's accounts are numbered as France's: SWIFT's registry folds it into the prefix FR.
    expect(formatOf('GP')).toStrictEqual(formatOf('FR'));
    // Every example IBAN SWIFT's registry gives passes, its check digits the ones ISO 13616's rule works out.
    expect(EXAMPLES.length).toBe(89);
    for (const [country, example] of EXAMPLES) {
      expect(payeeRefusal(country as 'GB', example), example).toBeUndefined();
      expect(ibanCheck(example.slice(0, 2), example.slice(4)), example).toBe(example.slice(2, 4));
    }
    // A number drawn in every kept country passes its own form: the IBAN's length, structure and check.
    for (const country of COUNTRY_CODES.filter(keepsFormat)) {
      const number = accountNumber(SEED, country, 'A Bank', 0) as string;
      expect(payeeRefusal(country, number), `${country} ${number}`).toBeUndefined();
      expect(number.slice(0, 2)).toBe(formatOf(country) !== undefined && 'iban' in (formatOf(country) as Format) ? (formatOf(country) as { iban: { prefix: string } }).iban.prefix : '');
    }
    expect(accountNumber(SEED, 'US', 'Chase', 0)).toBeUndefined();
    // A kept country's payee is held to its form; an unkept one's can't be, and goes as given.
    expect(payeeRefusal('GB', 'GB28NWBK60161331926819')).toBe('check');
    expect(payeeRefusal('US', 'anything')).toBeUndefined();
  });

  it('are the same for the same seed and bank, and differ otherwise', () => {
    const first = draw(GB, SEED, 'GB', 'Barclays', 0);
    // Drawn through the decider money.account, so a life replays its numbers.
    expect(first).toBe('GB15TQCJ54104064252561');
    expect(draw(GB, SEED, 'GB', 'Barclays', 0)).toBe(first);
    expect(first).toMatch(/^GB\d\d[A-Z]{4}\d{14}$/);
    // The holder's second account at the bank: the bank's own code (characters 5 to 8) the same, the account's own not.
    const second = draw(GB, SEED, 'GB', 'Barclays', 1);
    expect([second.slice(4, 8), second.slice(8) === first.slice(8)]).toEqual([first.slice(4, 8), false]);
    // Another bank, another code; another life, other numbers.
    expect(draw(GB, SEED, 'GB', 'HSBC UK', 0).slice(4, 8)).not.toBe(first.slice(4, 8));
    expect(draw(GB, SEED + 1n, 'GB', 'Barclays', 0)).not.toBe(first);
    expect(draw(GB, SEED, 'IM', 'Barclays', 0)).not.toBe(first);
    // A national number's parts drawn the same way: the bank's code shared by its accounts.
    const clabe = draw(CLABE, SEED, 'MX', 'BBVA', 0);
    expect(clabe).toMatch(/^\d{18}$/);
    expect(draw(CLABE, SEED, 'MX', 'BBVA', 1).slice(0, 3)).toBe(clabe.slice(0, 3));
    expect(draw(CLABE, SEED, 'MX', 'BBVA', 1).slice(3)).not.toBe(clabe.slice(3));
    // With no bank's code in the form (Poland's in the registry), nothing stays the same from one account to the next.
    const pl = formatOf('PL') as Format;
    expect(draw(pl, SEED, 'PL', 'PKO', 1).slice(4, 12)).not.toBe(draw(pl, SEED, 'PL', 'PKO', 0).slice(4, 12));
    // A bank's code past the number's start: only its own characters stay the same.
    const mid: Format = { national: { name: 'N', parts: [{ name: 'x', length: 12, kind: 'n' }], bank: [5, 8] } };
    const [m0, m1] = [draw(mid, SEED, 'XX', 'B', 0), draw(mid, SEED, 'XX', 'B', 1)];
    expect([m1.slice(4, 8), m1.slice(0, 4) === m0.slice(0, 4), m1.slice(8) === m0.slice(8)]).toEqual([m0.slice(4, 8), false, false]);
    // A `c` is drawn as a digit; an `a` as a capital.
    const c: Format = { iban: { prefix: 'XX', length: 64, bban: [{ length: 30, kind: 'c' }, { length: 30, kind: 'a' }] } };
    expect(draw(c, SEED, 'XX', 'B', 0)).toMatch(/^XX\d\d\d{30}[A-Z]{30}$/);
  });

  it("refuse a payee's number that isn't in its country's form", () => {
    expect(refusal(GB, 'GB29NWBK60161331926819')).toBeUndefined();
    // Printed in groups of four, or in small letters, it's the same number.
    expect(refusal(GB, 'GB29 NWBK 6016 1331 9268 19')).toBeUndefined();
    expect(refusal(GB, 'gb29nwbk60161331926819')).toBeUndefined();
    expect(refusal(GB, 'GB29NWBK6016133192681')).toBe('length');
    expect(refusal(GB, 'GB29NWBK601613319268190')).toBe('length');
    expect(refusal(GB, 'IE29NWBK60161331926819')).toBe('country');
    expect(refusal(GB, 'GX29NWBK60161331926819')).toBe('country');
    expect(refusal(GB, 'GB29NWB160161331926819')).toBe('structure');
    expect(refusal(GB, 'GB29NWBK6016133192681A')).toBe('structure');
    expect(refusal(GB, 'GBX9NWBK60161331926819')).toBe('structure');
    expect(refusal(GB, 'GB2XNWBK60161331926819')).toBe('structure');
    expect(refusal(GB, 'GB28NWBK60161331926819')).toBe('check');
    expect(refusal(GB, 'GB29NWBK60161331926818')).toBe('check');
    // A `c` takes a letter or a digit, and nothing else.
    const fr = formatOf('FR') as Format;
    expect(refusal(fr, 'FR1420041010050500013M02606')).toBeUndefined();
    expect(refusal(fr, 'FR1420041010050500013-02606')).toBe('structure');
    // A national number: its length, then each part's kind.
    expect(refusal(CLABE, '002 010 07777777777 1')).toBeUndefined();
    expect(refusal(CLABE, '00201007777777777')).toBe('length');
    expect(refusal(CLABE, '0020100777777777771')).toBe('length');
    expect(refusal(CLABE, '00201007777777777A')).toBe('structure');
  });

  it('work the IBAN check as ISO 13616 sets it', () => {
    expect([mod97(''), mod97('96'), mod97('97'), mod97('98'), mod97('A'), mod97('Z'), mod97('1A')]).toEqual([0, 96, 0, 1, 10, 35, 13]);
    // 3214282912345698765432161182, the example IBAN's digits as the standard rearranges them, is 1 mod 97.
    expect(mod97('3214282912345698765432161182')).toBe(1);
    expect(mod97('WEST12345698765432GB82')).toBe(1);
    expect(ibanCheck('GB', 'NWBK60161331926819')).toBe('29');
    // A check below ten keeps its leading nought.
    expect(ibanCheck('GB', 'NWBK60161300000010')).toBe('04');
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('formats.unkept');
    expect(aboutFormats('US')).toBe(t(UNKEPT_LINE, { country: 'United States' }));
    expect(aboutFormats('US')).toBe("How banks in United States number their accounts isn't known to this game yet.");
    expect(aboutFormats('GB')).toBeUndefined();
  });
});
