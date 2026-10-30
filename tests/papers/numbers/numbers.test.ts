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
    DE: { none: true },
    GU: { issuedBy: 'CA' },
    AS: { issuedBy: 'DE' },
  },
}));

describe('the national numbers', () => {
  it("are each country's own", () => {
    expect([keepsNumbers('CA'), keepsNumbers('GU'), keepsNumbers('LY')]).toEqual([true, true, false]);
    expect([numberIssuer('CA'), numberIssuer('GU'), numberIssuer('LY')]).toEqual(['CA', 'CA', undefined]);
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
    expect(fitsNumber('GB', 'QQ123456C')).toBe(true);
    expect(fitsNumber('GB', 'QQ123456E')).toBe(false);
    expect(fitsNumber('GB', 'QQ123456CX')).toBe(false);
    expect(fitsNumber('GB', 'QQ12345EX')).toBe(false);
    expect(fitsNumber('GB', 'XAAAAAAAA')).toBe(false);
    expect(fitsNumber('GB', 'X')).toBe(false);
    expect([fitsNumber('DE', '1'), fitsNumber('LY', '1')]).toEqual([undefined, undefined]);
  });

  it('carry the check digits their issuers publish', () => {
    expect(Object.keys(CHECKS)).toEqual(['luhn', 'br-cpf']);
    expect([CHECKS.luhn.digits, CHECKS['br-cpf'].digits]).toEqual([1, 2]);
    expect([isCheck('luhn'), isCheck('br-cpf'), isCheck('toString'), isCheck(7)]).toEqual([true, true, false, false]);
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
  });

  it("tell the player what the game doesn't know", () => {
    expect([UNKEPT_LINE, NONE_LINE]).toEqual(['numbers.unkept', 'numbers.none']);
    expect(aboutNumbers('LY')).toBe(t(UNKEPT_LINE, { country: 'Libya' }));
    expect(aboutNumbers('DE')).toBe(t(NONE_LINE, { country: 'Germany' }));
    expect(aboutNumbers('AS')).toBe(t(NONE_LINE, { country: 'American Samoa' }));
    expect([aboutNumbers('CA'), aboutNumbers('GU')]).toEqual([undefined, undefined]);
  });
});
