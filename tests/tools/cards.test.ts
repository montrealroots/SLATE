import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { money } from '../../src/core/money/money.ts';
import { amount, card, charge, compileCountry, fee, interest, LATE_BASES, LIMIT_WHEN, OUTPUT, OVER_BASES, percent, rate, RATE_PERIODS, readCards, serialize, SOURCES, waiver } from '../../tools/money/cards/compile.ts';
import { cardsCoverage, COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD } from '../../tools/money/cards/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('the cards compile', () => {
  it('takes a rate to its percent and its period, a range to its lowest, or a charge card to in full', () => {
    expect([SOURCES, OUTPUT, RATE_PERIODS, LATE_BASES, OVER_BASES, LIMIT_WHEN]).toEqual(['research/sources/money/cards', 'src/money/cards/cards.json', ['month', 'year'], ['minimum', 'balance', 'unpaid'], ['excess', 'balance', 'limit'], ['issue', 'year', 'raise']]);
    expect(rate({ percent: '27.99', per: 'year' }, 'USD', 'r')).toStrictEqual({ percent: '27.99', per: 'year' });
    expect(rate({ percent: '3', per: 'month' }, 'USD', 'r')).toStrictEqual({ percent: '3', per: 'month' });
    expect(rate({ percent: '0', per: 'year' }, 'USD', 'r')).toStrictEqual({ percent: '0', per: 'year' });
    expect(rate('in full', 'USD', 'r')).toBe('in full');
    // The ceilings themselves are figures a bank can state; above them, a misreading.
    expect(rate({ percent: '300', per: 'year' }, 'USD', 'r')).toStrictEqual({ percent: '300', per: 'year' });
    expect(rate({ percent: '25.0', per: 'month' }, 'USD', 'r')).toStrictEqual({ percent: '25.0', per: 'month' });
    expect(() => rate({ percent: '300.01', per: 'year' }, 'USD', 'r')).toThrow("r's percent is above 300");
    expect(() => rate({ percent: '25.01', per: 'month' }, 'USD', 'r')).toThrow("r's percent is above 25");
    // A yearly rate the bank states only as effective is marked so; nothing else is.
    expect(rate({ percent: '95.90', per: 'year', effective: true }, 'USD', 'r')).toStrictEqual({ percent: '95.90', per: 'year', effective: true });
    for (const r of [{ percent: '2', per: 'month', effective: true }, { percent: '9', per: 'year', effective: false }, { percent: '9', per: 'year', effective: 'true' }])
      expect(() => rate(r, 'USD', 'r'), JSON.stringify(r)).toThrow('r is effective only as a yearly rate, marked true');
    // A range: its lowest below its top, which is the percent.
    expect(interest({ percent: '29', per: 'year', from: '18' }, 'r')).toStrictEqual({ percent: '29', per: 'year', from: '18' });
    expect(interest({ percent: '29', per: 'year', from: '28.99' }, 'r')).toStrictEqual({ percent: '29', per: 'year', from: '28.99' });
    for (const from of ['29', '29.0', '30']) expect(() => interest({ percent: '29', per: 'year', from }, 'r'), from).toThrow("r's range runs from below its percent");
    expect(() => interest({ percent: '29.5', per: 'year', from: '30' }, 'r')).toThrow("r's range runs from below its percent");
    expect(() => interest({ percent: '29', per: 'year', from: '1e1' }, 'r')).toThrow("r's from is a decimal written as text");
    expect(() => interest({ percent: '2', per: 'month', ofs: 1 }, 'r')).toThrow('r has no term ofs');
    // Steps: a fixed sum for each step of the balance carried.
    expect(rate({ steps: { fee: '10', each: '500' } }, 'AZN', 'r')).toStrictEqual({ steps: { fee: money('AZN', 1000), each: money('AZN', 50_000) } });
    expect(() => rate({ steps: { fee: '10', each: '500' }, per: 'month' }, 'AZN', 'r')).toThrow('r has no term per');
    expect(() => rate({ steps: { fee: '10', each: '500', x: 1 } }, 'AZN', 'r')).toThrow("r's steps has no term x");
    expect(() => rate({ steps: 'x' }, 'AZN', 'r')).toThrow("r's steps is not an object");
    expect(() => rate({ steps: { fee: '0', each: '500' } }, 'AZN', 'r')).toThrow("r's step fee is an amount above nothing, written in major units");
    expect(() => rate({ steps: { fee: '10', each: '-1' } }, 'AZN', 'r')).toThrow("r's step is an amount above nothing, written in major units");
  });

  it("refuses a rate that isn't one", () => {
    for (const r of [null, 'in Full', 24, undefined]) expect(() => rate(r, 'USD', 'r'), String(r)).toThrow("r is a percent and the period it's charged by, in full, or steps");
    for (const r of [[], ['x']]) expect(() => rate(r, 'USD', 'r'), String(r)).toThrow('r is not an object');
    for (const per of [undefined, 'day', 'Year']) expect(() => rate({ percent: '1', per }, 'USD', 'r'), String(per)).toThrow(`r is charged by the month or the year, not ${String(per)}`);
    for (const p of [24.99, '-1', '24,99', '.5', '5.', '1e2', ' 5', undefined]) expect(() => rate({ percent: p, per: 'year' }, 'USD', 'r'), String(p)).toThrow("r's percent is a decimal written as text");
  });

  it('reads a percent and an amount, and refuses what isn\'t one', () => {
    expect([percent('100', 100n, 'p'), percent('0', 100n, 'p'), percent('2.5', 100n, 'p')]).toEqual(['100', '0', '2.5']);
    expect(() => percent('100.01', 100n, 'p')).toThrow('p is above 100');
    for (const p of [2, '2%', '']) expect(() => percent(p, 100n, 'p'), String(p)).toThrow('p is a decimal written as text');
    expect(amount('0.01', 'USD', 'a')).toStrictEqual(money('USD', 1));
    for (const a of ['0', '-1', 5, undefined, 'x', 'a1', '1a']) expect(() => amount(a, 'USD', 'a'), String(a)).toThrow('a is an amount above nothing, written in major units');
  });

  it('takes a fee waived by spending, for its first periods, or as an account fee is', () => {
    expect(waiver({ spend: '10000' }, 'HKD', 'w')).toStrictEqual({ spend: money('HKD', 1_000_000) });
    expect(waiver({ spend: '0.01' }, 'USD', 'w')).toStrictEqual({ spend: money('USD', 1) });
    expect(waiver({ first: 1 }, 'USD', 'w')).toStrictEqual({ first: 1 });
    expect(waiver({ first: 60 }, 'USD', 'w')).toStrictEqual({ first: 60 });
    for (const first of [0, 61, 1.5, '1']) expect(() => waiver({ first }, 'USD', 'w'), String(first)).toThrow("w's first is a whole number from 1 to 60");
    expect(waiver({ under: 26 }, 'USD', 'w')).toStrictEqual({ under: 26 });
    for (const spend of ['0', '-1', 100, undefined]) expect(() => waiver({ spend }, 'USD', 'w'), String(spend)).toThrow("w's spend is an amount above nothing, written in major units");
    expect(() => waiver({ spend: '1', under: 26 }, 'USD', 'w')).toThrow('w names one condition');
    expect(() => waiver({ first: 1, under: 26 }, 'USD', 'w')).toThrow('w names one condition');
    for (const w of [null, 'x', 7]) expect(() => waiver(w, 'USD', 'w'), String(w)).toThrow('w names one condition');
    expect(fee({ fee: '39.00', per: 'year' }, 'EUR', 'f')).toStrictEqual({ fee: money('EUR', 3900), per: 'year' });
    expect(fee({ fee: '1800', per: 'year', waived: [{ spend: '10000' }, { from: 60 }, { first: 1 }] }, 'HKD', 'f')).toStrictEqual({ fee: money('HKD', 180_000), per: 'year', waived: [{ spend: money('HKD', 1_000_000) }, { from: 60 }, { first: 1 }] });
    for (const f of [null, 'F']) expect(() => fee(f, 'USD', 'f'), String(f)).toThrow('f is not an object');
    for (const waived of [[], {}, 'x']) expect(() => fee({ fee: '1', per: 'year', waived }, 'USD', 'f'), JSON.stringify(waived)).toThrow("f's waivers are a list of conditions");
    expect(() => fee({ fee: '1', per: 'year', waived: [{ spend: '1' }, { x: 1 }] }, 'USD', 'f')).toThrow("f's waiver 1 names a condition the game doesn't check (x)");
    expect(() => fee({ fee: '0', per: 'year' }, 'USD', 'f')).toThrow('f is above nothing, or suspended until a change');
  });

  it('takes a charge to its share of a base, its fixed sum, its floor and its ceiling', () => {
    expect(charge({ percent: '5', of: 'minimum', min: '20', max: '100' }, 'USD', LATE_BASES, 'c')).toStrictEqual({ percent: '5', of: 'minimum', min: money('USD', 2000), max: money('USD', 10_000) });
    expect(charge({ fixed: '40' }, 'USD', LATE_BASES, 'c')).toStrictEqual({ fixed: money('USD', 4000) });
    expect(charge({ percent: '3', fixed: '3' }, 'OMR', [], 'c')).toStrictEqual({ percent: '3', fixed: money('OMR', 3000) });
    expect(charge({ percent: '1', of: 'excess', min: '5', max: '5' }, 'USD', OVER_BASES, 'c')).toStrictEqual({ percent: '1', of: 'excess', min: money('USD', 500), max: money('USD', 500) });
    expect(() => charge({}, 'USD', LATE_BASES, 'c')).toThrow('c is a share, a fixed sum, or both');
    expect(() => charge({ min: '1' }, 'USD', LATE_BASES, 'c')).toThrow('c is a share, a fixed sum, or both');
    expect(() => charge({ fixed: '1', min: '1' }, 'USD', LATE_BASES, 'c')).toThrow("c's floor and ceiling bound a share");
    expect(() => charge({ fixed: '1', max: '1' }, 'USD', LATE_BASES, 'c')).toThrow("c's floor and ceiling bound a share");
    for (const of of [undefined, 'excess', 'Minimum']) expect(() => charge({ percent: '5', of }, 'USD', LATE_BASES, 'c'), String(of)).toThrow(`c's share is of minimum, balance, unpaid, not ${String(of)}`);
    expect(() => charge({ fixed: '1', of: 'minimum' }, 'USD', LATE_BASES, 'c')).toThrow('c names a base only for a share');
    expect(() => charge({ percent: '1', of: 'minimum' }, 'USD', [], 'c')).toThrow('c names a base only for a share');
    expect(() => charge({ percent: '5', of: 'minimum', min: '20', max: '19.99' }, 'USD', LATE_BASES, 'c')).toThrow("c's min is above its max");
    expect(() => charge({ percent: '101', of: 'minimum' }, 'USD', LATE_BASES, 'c')).toThrow("c's percent is above 100");
    expect(() => charge({ fixed: '0' }, 'USD', LATE_BASES, 'c')).toThrow("c's fixed is an amount above nothing, written in major units");
    expect(() => charge({ percent: '1', of: 'balance', min: '0' }, 'USD', LATE_BASES, 'c')).toThrow("c's min is an amount above nothing, written in major units");
    expect(() => charge({ percent: '1', of: 'balance', max: 'x' }, 'USD', LATE_BASES, 'c')).toThrow("c's max is an amount above nothing, written in major units");
    expect(() => charge({ fixed: '1', cap: '1' }, 'USD', LATE_BASES, 'c')).toThrow('c has no term cap');
    for (const c of [null, 'x', []]) expect(() => charge(c, 'USD', LATE_BASES, 'c'), String(c)).toThrow('c is not an object');
  });

  it("takes a card to its bank, its rate and its fees, in the country's currency or its own", () => {
    expect(card({ bank: 'B', card: 'C', rate: { percent: '24', per: 'year' }, fees: [] }, 'GBP', 'c')).toStrictEqual({ bank: 'B', card: 'C', rate: { percent: '24', per: 'year' }, fees: [] });
    expect(card({ bank: 'B', card: 'C', currency: 'USD', rate: 'in full', fees: [{ fee: '25', per: 'year' }] }, 'KHR', 'c')).toStrictEqual({ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: money('USD', 2500), per: 'year' }] });
    for (const c of [null, 'C', []]) expect(() => card(c, 'USD', 'c'), String(c)).toThrow('c is not an object');
    for (const bank of [undefined, '', ' B', 7]) expect(() => card({ bank, card: 'C', rate: 'in full', fees: [] }, 'USD', 'c'), String(bank)).toThrow('c names the bank');
    for (const name of [undefined, '', 'C ', 7]) expect(() => card({ bank: 'B', card: name, rate: 'in full', fees: [] }, 'USD', 'c'), String(name)).toThrow('c names the card the bank sells');
    for (const currency of ['XXX', 7, null]) expect(() => card({ bank: 'B', card: 'C', currency, rate: 'in full', fees: [] }, 'USD', 'c'), String(currency)).toThrow(`c's currency is not one in use (${String(currency)})`);
    for (const fees of [undefined, '0', {}]) expect(() => card({ bank: 'B', card: 'C', rate: 'in full', fees }, 'USD', 'c'), String(fees)).toThrow("c's fees are a list, empty where the card costs nothing to hold");
    expect(() => card({ bank: 'B', card: 'C', fees: [] }, 'USD', 'c')).toThrow("c's rate is a percent and the period it's charged by, in full, or steps");
    expect(() => card({ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: '1', per: 'year' }, { fee: '0', per: 'year' }] }, 'USD', 'c')).toThrow("c's fee 1 is above nothing, or suspended until a change");
    expect(() => card({ bank: 'B', card: 'C', rate: 'in full', fees: [], annual: '1' }, 'USD', 'c')).toThrow('c has no term annual');
  });

  it('takes every other term a bank publishes, in the card\'s currency', () => {
    const base = { bank: 'B', card: 'C', currency: 'USD', rate: { percent: '24', per: 'year' }, fees: [] };
    const out = { bank: 'B', card: 'C', rate: { percent: '24', per: 'year' }, fees: [] };
    const full = card(
      {
        ...base,
        issue: '25',
        limitFees: [{ percent: '1', when: 'issue' }, { percent: '1', when: 'year' }, { percent: '0.5', when: 'raise' }],
        intro: { percent: '0', per: 'month', months: 12 },
        cash: { rate: { percent: '30', per: 'year' }, fee: { percent: '5', min: '10' } },
        fx: '2.75',
        minimum: { percent: '5', floor: '25', interest: true },
        grace: 55,
        late: { percent: '5', of: 'minimum', min: '20' },
        overLimit: { fixed: '25' },
        returned: '35',
        penalty: { percent: '29.99', per: 'year' },
        tax: { interest: '3.5', fees: '16' },
        limit: { times: '4' },
      },
      'KHR',
      'c',
    );
    const usd = (minor: number) => money('USD', minor);
    expect(full).toStrictEqual({
      bank: 'B', card: 'C', rate: { percent: '24', per: 'year' }, fees: [],
      issue: usd(2500),
      limitFees: [{ percent: '1', when: 'issue' }, { percent: '1', when: 'year' }, { percent: '0.5', when: 'raise' }],
      intro: { percent: '0', per: 'month', months: 12 },
      cash: { rate: { percent: '30', per: 'year' }, fee: { percent: '5', min: usd(1000) } },
      fx: '2.75',
      minimum: { percent: '5', floor: usd(2500), interest: true },
      grace: 55,
      late: { percent: '5', of: 'minimum', min: usd(2000) },
      overLimit: { fixed: usd(2500) },
      returned: usd(3500),
      penalty: { percent: '29.99', per: 'year' },
      tax: { interest: '3.5', fees: '16' },
      limit: { times: '4' },
    });
    expect(card({ ...base, cash: { fee: { fixed: '2' } }, minimum: { percent: '10' }, tax: { fees: '15' } }, 'USD', 'c')).toStrictEqual({ ...out, cash: { fee: { fixed: usd(200) } }, minimum: { percent: '10' }, tax: { fees: '15' } });
    expect(card({ ...base, cash: { rate: { percent: '2', per: 'month' } }, tax: { interest: '3.5' } }, 'USD', 'c')).toStrictEqual({ ...out, cash: { rate: { percent: '2', per: 'month' } }, tax: { interest: '3.5' } });
    const bad: [Record<string, unknown>, string][] = [
      [{ issue: '0' }, "c's issue is an amount above nothing, written in major units"],
      [{ limitFees: [] }, "c's limitFees are a list"],
      [{ limitFees: 'x' }, "c's limitFees are a list"],
      [{ limitFees: [{ percent: '1', when: 'month' }] }, "c's limitFee 0 is charged at issue, each year or at a raise, not month"],
      [{ limitFees: [{ percent: '1', when: 'year', x: 1 }] }, "c's limitFee 0 has no term x"],
      [{ limitFees: [{ percent: '101', when: 'year' }] }, "c's limitFee 0 is above 100"],
      [{ limitFees: [7] }, "c's limitFee 0 is not an object"],
      [{ intro: { percent: '0', per: 'month', months: 0 } }, "c's intro months is a whole number from 1 to 60"],
      [{ intro: { percent: '0', per: 'month', months: 61 } }, "c's intro months is a whole number from 1 to 60"],
      [{ intro: { percent: '0', per: 'week', months: 6 } }, "c's intro is charged by the month or the year, not week"],
      [{ intro: 'x' }, "c's intro is not an object"],
      [{ cash: {} }, "c's cash names its rate, its fee, or both"],
      [{ cash: { rate: { percent: '1', per: 'month' }, x: 1 } }, "c's cash has no term x"],
      [{ cash: { fee: { percent: '5', of: 'balance' } } }, "c's cash fee names a base only for a share"],
      [{ cash: { rate: { percent: '26', per: 'month' } } }, "c's cash rate's percent is above 25"],
      [{ fx: '101' }, "c's fx is above 100"],
      [{ fx: 2 }, "c's fx is a decimal written as text"],
      [{ minimum: { percent: '5', x: 1 } }, "c's minimum has no term x"],
      [{ minimum: { percent: '5', interest: 'yes' } }, "c's minimum adds the interest, marked true"],
      [{ minimum: { percent: '5', floor: '0' } }, "c's minimum floor is an amount above nothing, written in major units"],
      [{ minimum: { percent: '101' } }, "c's minimum is above 100"],
      [{ grace: 0 }, "c's grace is a whole number from 1 to 90"],
      [{ grace: 91 }, "c's grace is a whole number from 1 to 90"],
      [{ late: { percent: '5' } }, "c's late's share is of minimum, balance, unpaid, not undefined"],
      [{ overLimit: { percent: '5', of: 'minimum' } }, "c's overLimit's share is of excess, balance, limit, not minimum"],
      [{ returned: '-1' }, "c's returned is an amount above nothing, written in major units"],
      [{ penalty: { percent: '30', per: 'week' } }, "c's penalty is charged by the month or the year, not week"],
      [{ tax: {} }, "c's tax is on its interest, its fees, or both"],
      [{ tax: { interest: '1', vat: '1' } }, "c's tax has no term vat"],
      [{ tax: { interest: '101' } }, "c's tax on interest is above 100"],
      [{ tax: { fees: 'x' } }, "c's tax on fees is a decimal written as text"],
      [{ limit: { times: '0' } }, "c's limit times is above nothing"],
      [{ limit: { times: '51' } }, "c's limit times is above 50"],
      [{ limit: { times: '4', x: 1 } }, "c's limit has no term x"],
      [{ cash: 'x' }, "c's cash is not an object"],
      [{ minimum: 'x' }, "c's minimum is not an object"],
      [{ tax: 'x' }, "c's tax is not an object"],
      [{ limit: 'x' }, "c's limit is not an object"],
    ];
    for (const [term, message] of bad) expect(() => card({ ...base, ...term }, 'USD', 'c'), JSON.stringify(term)).toThrow(message);
    expect(card({ ...base, grace: 1, limit: { times: '50' }, intro: { percent: '0', per: 'month', months: 60 } }, 'USD', 'c')).toStrictEqual({ ...out, grace: 1, limit: { times: '50' }, intro: { percent: '0', per: 'month', months: 60 } });
    expect(card({ ...base, grace: 90, intro: { percent: '9.9', per: 'year', months: 1 } }, 'USD', 'c')).toStrictEqual({ ...out, grace: 90, intro: { percent: '9.9', per: 'year', months: 1 } });
  });

  it("takes a country's file to its cards, in its currency, none named twice", () => {
    expect(compileCountry('DE', { country: 'DE', cards: [{ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: '39', per: 'year' }] }], note: 'x', sources: [] })).toStrictEqual([{ bank: 'B', card: 'C', rate: 'in full', fees: [{ fee: money('EUR', 3900), per: 'year' }] }]);
    expect(() => compileCountry('XX', { country: 'XX', cards: [] })).toThrow('XX is not a country on the map');
    expect(() => compileCountry('DE', { country: 'FR', cards: [] })).toThrow("DE's file is for FR");
    for (const cards of [undefined, [], 'x']) expect(() => compileCountry('DE', { country: 'DE', cards }), JSON.stringify(cards)).toThrow('DE names no card');
    const c = { bank: 'B', card: 'C', rate: 'in full', fees: [] };
    expect(() => compileCountry('DE', { country: 'DE', cards: [c, { ...c, rate: { percent: '9', per: 'year' } }] })).toThrow("DE names B's C twice");
    expect(() => compileCountry('DE', { country: 'DE', cards: [c, { ...c, card: '' }] })).toThrow("DE's card 1 names the card the bank sells");
    // Two banks may sell a card of the same name, and a bank two cards.
    expect(compileCountry('DE', { country: 'DE', cards: [c, { ...c, bank: 'D' }, { ...c, card: 'E' }] }).map((x) => `${x.bank} ${x.card}`)).toEqual(['B C', 'D C', 'B E']);
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'cards-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const file = `${JSON.stringify({ country: 'GB', cards: [{ bank: 'B', card: 'C', rate: 'in full', fees: [] }] })}\n`;
    writeFileSync(join(root, SOURCES, 'GB.json'), file);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = createHash('sha256').update(file).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    mkdirSync(join(root, 'research'), { recursive: true });
    register([{ fact: 'money.cards.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }]);
    expect(readCards(root)).toStrictEqual({ countries: { GB: [{ bank: 'B', card: 'C', rate: 'in full', fees: [] }] } });
    register([{ fact: 'money.cards.GB', value: { file: `${SOURCES}/GB.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readCards(root)).toThrow(`${SOURCES}/GB.json isn't the file the register cites`);
    register([{ fact: 'money.banks.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }, { fact: 'money.cards.blocked.FR' }]);
    expect(() => readCards(root)).toThrow(`${SOURCES}/GB.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readCards(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ countries: {} })).toBe('{\n "countries": {}\n}\n');
  });
});

describe('the cards coverage', () => {
  it('rows each country researched, blocked, pending, or proven with no place', () => {
    const facts = new Map([['money.cards.GB', 'R-1'], ['money.cards.blocked.FR', 'R-2'], ['money.cards.DE', 'R-3'], ['money.banks.IT', 'R-4']]);
    expect(cardsCoverage(['GB', 'FR', 'IT', 'AQ', 'DE'], new Set(['GB', 'FR', 'IT', 'DE']), new Set(['GB', 'IT']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      // The banks' fact isn't the cards'.
      { key: 'IT', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // A file the register cites but the compile didn't take is no research.
      { key: 'DE', status: 'pending' },
    ]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TOLD, TESTS]).toEqual([
      'coverage/cards-countries.json',
      "tests/money/cards/cards.test.ts::cards > tell the player what the game doesn't know",
      ["tests/money/cards/cards.test.ts::cards > name each country's credit cards, their interest and their fees", 'tests/money/cards/cards.places.test.ts::cards > for every place on the map'],
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.cards",\n "axis": "country",\n "rows": []\n}\n');
  });
});
