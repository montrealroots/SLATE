import { describe, expect, it, vi } from 'vitest';
import { t } from '../../../src/core/text/text.ts';
import { CHECKS, checks, isCheck } from '../../../src/papers/numbers/checks.ts';
import { aboutNumbers, fitsNumber, keepsNumbers, nationalNumber, needsNumber, NONE_LINE, numberIssuer, UNKEPT_LINE } from '../../../src/papers/numbers/numbers.ts';

/**
 * No country's research was written when the engine was built (2026-10-30), so its reads are held here on a few
 * entries in the compiled form; the test is rewritten on the research's own as it lands.
 */
vi.mock('../../../src/papers/numbers/numbers.json', () => ({
  default: {
    CA: { name: 'Social Insurance Number', issuer: 'Service Canada', format: { length: 9, pattern: '[0-9]{9}', check: 'luhn' }, when: 'application', who: ['citizens', 'residents'], fee: { currency: 'CAD', minor: 0 }, needed: ['work', 'tax'] },
    BR: { name: 'Cadastro de Pessoas Físicas', issuer: 'Receita Federal', format: { length: 11, pattern: '\\d{11}', check: 'br-cpf' }, when: 'birth', who: ['anyone'] },
    GB: { name: 'National Insurance number', issuer: 'HM Revenue and Customs', format: { length: 9, pattern: '[A-Z]{2}\\d{6}[A-D]|X' }, when: 'registration', who: ['residents'] },
    PA: { name: 'cédula', issuer: 'Tribunal Electoral', format: { length: 10, min: 3, pattern: '([1-9]|1[0-3])\\d{1,4}\\d{1,4}' }, when: 'birth', who: ['citizens'] },
    TV: { name: 'n', issuer: 'i', format: { length: 4, min: 2, pattern: '\\d+' }, when: 'birth', who: ['citizens'] },
    DE: { none: true },
    GU: { issuedBy: 'CA' },
    AS: { issuedBy: 'DE' },
  },
}));

describe('the national numbers', () => {
  it("are each country's own", () => {
    expect([keepsNumbers('CA'), keepsNumbers('GU'), keepsNumbers('IR')]).toEqual([true, true, false]);
    expect([numberIssuer('CA'), numberIssuer('GU'), numberIssuer('IR')]).toEqual(['CA', 'CA', undefined]);
    expect(nationalNumber('CA')).toMatchObject({ name: 'Social Insurance Number', fee: { currency: 'CAD', minor: 0 } });
    expect(nationalNumber('GU')).toBe(nationalNumber('CA'));
    expect([nationalNumber('DE'), nationalNumber('AS'), nationalNumber('LY')]).toEqual(['none', 'none', undefined]);
    // What needs one: as the research says, nothing where none is given, unknown where it doesn't say or isn't kept.
    expect([needsNumber('CA', 'work'), needsNumber('CA', 'bank'), needsNumber('DE', 'work'), needsNumber('BR', 'bank'), needsNumber('LY', 'work')]).toEqual([true, false, false, undefined, undefined]);
  });

  it('are numbers in their form, with their check digits', () => {
    expect(fitsNumber('CA', '046454286')).toBe(true);
    expect(fitsNumber('GU', '046454286')).toBe(true);
    expect(fitsNumber('CA', '046454287')).toBe(false);
    expect(fitsNumber('CA', '04645428')).toBe(false);
    expect(fitsNumber('BR', '11144477735')).toBe(true);
    expect(fitsNumber('BR', '11144477736')).toBe(false);
    // The pattern holds the whole number, each of its alternatives anchored, and the length its characters.
    // A length that varies: the fewest to the most, each held to the pattern.
    expect(['89261601', '111', '1312341234', '11', '13123412341', '0261601'].map((n) => fitsNumber('PA', n))).toEqual([true, true, true, false, false, false]);
    // The length holds where the pattern is looser.
    expect(['1', '12', '1234', '12345'].map((n) => fitsNumber('TV', n))).toEqual([false, true, true, false]);
    expect(fitsNumber('GB', 'QQ123456C')).toBe(true);
    expect(fitsNumber('GB', 'QQ123456E')).toBe(false);
    expect(fitsNumber('GB', 'QQ123456CX')).toBe(false);
    expect(fitsNumber('GB', 'QQ12345EX')).toBe(false);
    expect(fitsNumber('GB', 'XAAAAAAAA')).toBe(false);
    expect(fitsNumber('GB', 'X')).toBe(false);
    expect([fitsNumber('DE', '1'), fitsNumber('IR', '1')]).toEqual([undefined, undefined]);
  });

  it('carry the check digits their issuers publish', () => {
    expect(Object.keys(CHECKS)).toEqual(['luhn', 'br-cpf', 'cn-gb11643']);
    expect([CHECKS.luhn.digits, CHECKS['br-cpf'].digits, CHECKS['cn-gb11643'].digits]).toEqual([1, 2, 1]);
    expect([isCheck('luhn'), isCheck('br-cpf'), isCheck('cn-gb11643'), isCheck('toString'), isCheck(7)]).toEqual([true, true, true, false, false]);
    // Luhn: the Canada Revenue Agency's 046 454 286; a card number; a digit doubled past 9 and one not.
    expect(CHECKS.luhn.compute('04645428')).toBe('046454286');
    expect(CHECKS.luhn.compute('7992739871')).toBe('79927398713');
    expect(CHECKS.luhn.compute('5')).toBe('59');
    expect(CHECKS.luhn.compute('4')).toBe('42');
    expect(CHECKS.luhn.compute('0')).toBe('00');
    // The CPF: remainders of 1 (123456789-09, the course note's own), 0, 2 and 10.
    expect(CHECKS['br-cpf'].compute('123456789')).toBe('12345678909');
    expect(CHECKS['br-cpf'].compute('111444777')).toBe('11144477735');
    expect(CHECKS['br-cpf'].compute('000000000')).toBe('00000000000');
    expect(CHECKS['br-cpf'].compute('000000001')).toBe('00000000191');
    expect(CHECKS['br-cpf'].compute('000000005')).toBe('00000000515');
    expect([checks('luhn', '046454286'), checks('luhn', '046454285'), checks('luhn', '0'), checks('luhn', '00'), checks('luhn', '0464 54286'), checks('luhn', 'a046454286'), checks('luhn', ' 46454286'), checks('luhn', '0464542 3')]).toEqual([true, false, false, true, false, false, false, false]);
    expect([checks('br-cpf', '11144477735'), checks('br-cpf', '35'), checks('br-cpf', '000'), checks('br-cpf', '11144477735\n')]).toEqual([true, false, true, false]);
    // China's: GB 11643-1999's two worked numbers (sums 2 and 8 mod 11), a remainder of 1 (check 0) and of 0 (check 1).
    expect(CHECKS['cn-gb11643'].compute('11010519491231002')).toBe('11010519491231002X');
    expect(CHECKS['cn-gb11643'].compute('44052418800101001')).toBe('440524188001010014');
    expect(CHECKS['cn-gb11643'].compute('00000000000000006')).toBe('000000000000000060');
    expect(CHECKS['cn-gb11643'].compute('00000000000000000')).toBe('000000000000000001');
    expect(CHECKS['cn-gb11643'].compute('10000000000000000')).toBe('100000000000000005');
    expect([checks('cn-gb11643', '11010519491231002X'), checks('cn-gb11643', '110105194912310021'), checks('cn-gb11643', '1101051949123100XX'), checks('cn-gb11643', 'X')]).toEqual([true, false, false, false]);
  });

  it("tell the player what the game doesn't know", () => {
    expect([UNKEPT_LINE, NONE_LINE]).toEqual(['numbers.unkept', 'numbers.none']);
    expect(aboutNumbers('IR')).toBe(t(UNKEPT_LINE, { country: 'Iran' }));
    expect(aboutNumbers('DE')).toBe(t(NONE_LINE, { country: 'Germany' }));
    expect(aboutNumbers('AS')).toBe(t(NONE_LINE, { country: 'American Samoa' }));
    expect([aboutNumbers('CA'), aboutNumbers('GU')]).toEqual([undefined, undefined]);
  });
});
