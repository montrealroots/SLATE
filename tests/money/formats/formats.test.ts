import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { COUNTRY_CODES } from '../../../src/world/gazetteer/gazetteer.ts';
import data from '../../../src/money/formats/formats.json';
import { aboutFormats, accountNumber, formatOf, keepsFormat, payeeRefusal, UNKEPT_LINE } from '../../../src/money/formats/formats.ts';
import { draw, ibanCheck, mod97, refusal, signed, type Format, type National, type Part } from '../../../src/money/formats/number.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const SEED = 0x5eed_0000_0000_0001n;
const GB = formatOf('GB') as Format;
const CLABE: { national: National } = {
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
    expect([keepsFormat('GB'), keepsFormat('ZA')]).toEqual([true, false]);
    expect(formatOf('ZA')).toBeUndefined();
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
      const form = formatOf(country) as Format;
      // An IBAN opens with its prefix; a national number is as long as its parts' drawn lengths, or their most.
      const drawnAt = (p: Part) => p.drawn ?? [p.length, p.length];
      if ('iban' in form) expect(number.slice(0, 2)).toBe(form.iban.prefix);
      else expect(number.length).toBeGreaterThanOrEqual(form.national.parts.reduce((sum, p) => sum + drawnAt(p)[0], 0));
      if ('national' in form) expect(number.length).toBeLessThanOrEqual(form.national.parts.reduce((sum, p) => sum + drawnAt(p)[1], 0));
    }
    expect(accountNumber(SEED, 'ZA', 'Standard Bank', 0)).toBeUndefined();
    // A kept country's payee is held to its form; an unkept one's can't be, and goes as given.
    expect(payeeRefusal('GB', 'GB28NWBK60161331926819')).toBe('check');
    expect(payeeRefusal('ZA', 'anything')).toBeUndefined();
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

  it('work the checks inside a national number as their central banks publish them', () => {
    // Argentina's CBU: the BCRA's 1997 bulletin's number, both blocks (checks 2 and 4), passes, and a digit changed fails.
    const ar = formatOf('AR') as Format;
    expect(refusal(ar, '0110138202011100377664')).toBeUndefined();
    expect(refusal(ar, '0110138302011100377664')).toBe('check');
    expect(refusal(ar, '0110138202011100377665')).toBe('check');
    expect(refusal(ar, '1110138202011100377664')).toBe('check');
    // Each block's check covers only its own block: the first's digit isn't read by the second's.
    const cbu = (ar as { national: National }).national;
    expect(signed(cbu, '0110138002011100377660')).toBe('0110138202011100377664');
    // Nigeria's NUBAN: the CBN's worked number, bank 011, serial 000001457, check 9; and 10 written as 0.
    const ng = formatOf('NG') as Format;
    expect(refusal(ng, '0110000014579')).toBeUndefined();
    expect(refusal(ng, '0110000014570')).toBe('check');
    expect(signed((ng as { national: National }).national, '0000000000000')).toBe('0000000000000');
    expect(signed((ng as { national: National }).national, '1100000000005')).toBe('1100000000000');
    expect(signed((ng as { national: National }).national, '0000000000010')).toBe('0000000000017');
    // Angola's NBA, ISO 7064's MOD 97-10 over its first nineteen digits; the digits and the check read mod 97 are one.
    const ao = formatOf('AO') as Format;
    const nba = draw(ao, SEED, 'AO', 'BFA', 0);
    expect([nba.length, mod97(nba), refusal(ao, nba)]).toEqual([21, 1, undefined]);
    expect(refusal(ao, `${nba.slice(0, 19)}${nba[19] === '9' ? '0' : '9'}${nba[20] as string}`)).toBe('check');
    // The French RIB's key: the Comoros' central bank's worked RIB (Règlement 14/2015, read by eye), its key 88 where
    // MOD 97-10 would give 89; the whole reads 0 mod 97. Its keys run 01 to 97.
    const rib: National = { name: 'RIB', parts: [{ name: 'x', length: 23, kind: 'n' }], checks: [{ over: [1, 21], key97: true }] };
    expect(refusal({ national: rib }, '00099000010000072000288')).toBeUndefined();
    expect(refusal({ national: rib }, '00099000010000072000289')).toBe('check');
    expect(mod97('00099000010000072000288')).toBe(0);
    const key = (body: string) => signed({ ...rib, parts: [{ name: 'x', length: body.length + 2, kind: 'n' }], checks: [{ over: [1, body.length], key97: true }] }, `${body}00`).slice(-2);
    expect([key('0'), key('1'), key('32')]).toEqual(['97', '94', '01']);
    // Kyrgyzstan's: the remainder itself, 97 for nought. The National Bank's own three (Instruction 3/5, annex 1).
    const kg: National = { name: 'K', parts: [{ name: 'x', length: 16, kind: 'n' }], checks: [{ over: [1, 14], rest97: true }] };
    expect([signed(kg, '1251234567890100'), refusal({ national: kg }, '1251234567890164'), refusal({ national: kg }, '1251234567890163')]).toEqual(['1251234567890164', undefined, 'check']);
    expect([signed(kg, '0000000000000000'), signed(kg, '0000000000000200')]).toEqual(['0000000000000097', '0000000000000202']);
    // A check below ten keeps its leading nought, and 98 is written whole.
    const two: National = { name: 'N', parts: [{ name: 'x', length: 4, kind: 'n' }], checks: [{ over: [1, 2], mod97: true }] };
    expect([signed(two, '9600'), signed(two, '0000'), signed(two, '3000')]).toEqual(['9604', '0098', '3008']);
    // Drawn numbers carry their checks, and a form with none is drawn as it was.
    for (const country of ['AR', 'NG', 'AO']) expect(refusal(formatOf(country as 'AR') as Format, draw(formatOf(country as 'AR') as Format, SEED + 1n, country, 'B', 3)), country).toBeUndefined();
    expect(signed(CLABE.national, '123')).toBe('123');
  });

  it('take a part whose length varies, and draw it at the bank\'s own lengths', () => {
    const us: National = {
      name: 'R',
      parts: [{ name: 'routing', length: 8, kind: 'n' }, { name: 'check', length: 1, kind: 'n' }, { name: 'account', length: 17, kind: 'c', min: 1, drawn: [8, 12] }],
      bank: [1, 8],
      checks: [{ over: [1, 8], weights: [3, 7, 1, 3, 7, 1, 3, 7] }],
    };
    // Bank of Guam's routing number, 121405115, its check 5 (sum 45), with an account of one to seventeen characters.
    for (const account of ['1', '12345678', 'A1B2C3', '12345678901234567']) expect(refusal({ national: us }, `121405115${account}`), account).toBeUndefined();
    expect(refusal({ national: us }, '121405115')).toBe('length');
    expect(refusal({ national: us }, '121405115123456789012345678')).toBe('length');
    expect(refusal({ national: us }, '121405116123')).toBe('check');
    expect(refusal({ national: us }, '12140511512-3')).toBe('structure');
    // Drawn at eight to twelve, every length in time, each passing; the bank's routing number shared by its accounts.
    const drawn = Array.from({ length: 60 }, (_, n) => draw({ national: us }, SEED, 'US', 'Chase', n));
    expect(new Set(drawn.map((d) => d.length))).toStrictEqual(new Set([17, 18, 19, 20, 21]));
    for (const d of drawn) expect(refusal({ national: us }, d), d).toBeUndefined();
    expect(new Set(drawn.map((d) => d.slice(0, 9))).size).toBe(1);
    // Without its own drawn lengths, a part is drawn at its most.
    const most: National = { ...us, parts: [us.parts[0] as National['parts'][number], us.parts[1] as National['parts'][number], { name: 'account', length: 9, kind: 'n', min: 1 }] };
    expect(draw({ national: most }, SEED, 'US', 'Chase', 0)).toHaveLength(18);
  });

  it("tell the player what the game doesn't know", () => {
    expect(UNKEPT_LINE).toBe('formats.unkept');
    expect(aboutFormats('ZA')).toBe(t(UNKEPT_LINE, { country: 'South Africa' }));
    expect(aboutFormats('ZA')).toBe("How banks in South Africa number their accounts isn't known to this game yet.");
    expect(aboutFormats('GB')).toBeUndefined();
  });
});
