import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkNationalities, compileOf, compileState, DESCENT, OUTPUT, readCitizenship, serialize, SOIL, SOURCES, TEST_KINDS } from '../../tools/papers/citizenship/compile.ts';
import { citizenshipCoverage, COVERAGE, coverageOf, serializeCoverage, TESTS, TOLD } from '../../tools/papers/citizenship/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const state = (over: Record<string, unknown> = {}) => ({ country: 'DE', years: 5, renounce: false, lapses: false, note: 'anything', sources: [], ...over });

describe('the citizenship rules compile', () => {
  it("takes a state to its naturalisation and its loss rule", () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/papers/citizenship', 'src/papers/citizenship/citizenship.json']);
    expect(compileState('DE', state())).toStrictEqual({ years: 5, renounce: false, lapses: false });
    expect(compileState('JP', state({ country: 'JP', renounce: true, lapses: true }))).toStrictEqual({ years: 5, renounce: true, lapses: true });
    expect(compileState('SM', state({ country: 'SM', years: 20, renounce: null, lapses: null }))).toStrictEqual({ years: 20, renounce: null, lapses: null });
    expect(compileState('CN', state({ country: 'CN', years: 'none', renounce: null }))).toStrictEqual({ years: 'none', renounce: null, lapses: false });
    for (const years of [1, 50]) expect(compileState('DE', state({ years })).years).toBe(years);
  });

  it('refuses a state that is not what it says it is', () => {
    expect(() => compileState('XX', state())).toThrow('XX is not a country on the map');
    expect(() => compileState('FR', state())).toThrow("FR's file is for DE");
    for (const years of [0, 51, 2.5, '5', null, undefined, 'some']) {
      expect(() => compileState('DE', state({ years })), String(years)).toThrow(`DE's years of residence are a whole number from 1 to 50, or "none"`);
    }
    for (const renounce of ['yes', 0, undefined]) expect(() => compileState('DE', state({ renounce })), String(renounce)).toThrow("DE's renunciation is true, false or null");
    for (const lapses of ['no', 1, undefined]) expect(() => compileState('DE', state({ lapses })), String(lapses)).toThrow("DE's loss on taking another citizenship is true, false or null");
    for (const renounce of [true, false]) {
      expect(() => compileState('DE', state({ years: 'none', renounce }))).toThrow('DE naturalises no one by residence, so asks no one to renounce');
    }
  });

  it('takes how citizenship comes at birth, by soil and by descent', () => {
    expect([SOIL, DESCENT, TEST_KINDS]).toEqual([['unconditional', 'conditional', 'none'], ['either parent', 'father', 'none'], ['language', 'civics']]);
    const born = (atBirth: unknown) => compileState('DE', state({ atBirth })).atBirth;
    expect(born({ soil: 'unconditional', descent: 'either parent' })).toStrictEqual({ soil: 'unconditional', descent: 'either parent' });
    expect(born({ soil: 'conditional', soilIf: 'a parent lawfully resident eight years', descent: 'either parent', descentAbroad: 'a parent born abroad after 1999 registers the birth within a year' })).toStrictEqual({
      soil: 'conditional', soilIf: 'a parent lawfully resident eight years', descent: 'either parent', descentAbroad: 'a parent born abroad after 1999 registers the birth within a year',
    });
    expect(born({ soil: 'none', descent: 'father', descentAbroad: 'x' })).toStrictEqual({ soil: 'none', descent: 'father', descentAbroad: 'x' });
    expect(born({ soil: 'none', descent: 'none' })).toStrictEqual({ soil: 'none', descent: 'none' });
    expect(compileState('DE', state())).not.toHaveProperty('atBirth');
    expect(compileState('CN', state({ country: 'CN', years: 'none', renounce: null, atBirth: { soil: 'none', descent: 'either parent' } })).atBirth).toEqual({ soil: 'none', descent: 'either parent' });
    const W = "DE's citizenship at birth";
    for (const a of ['soil', null, []]) expect(() => born(a), JSON.stringify(a)).toThrow(`${W} is not an object`);
    expect(() => born({ soil: 'none', descent: 'none', parents: 2 })).toThrow(`${W} has no term parents`);
    for (const soil of ['always', undefined]) expect(() => born({ soil, descent: 'none' }), String(soil)).toThrow(`${W} by birth in the territory is unconditional, conditional, none, not ${String(soil)}`);
    for (const descent of ['mother', undefined]) expect(() => born({ soil: 'none', descent }), String(descent)).toThrow(`${W} by descent is either parent, father, none, not ${String(descent)}`);
    for (const soilIf of [undefined, '', ' ', 7]) expect(() => born({ soil: 'conditional', soilIf, descent: 'none' }), String(soilIf)).toThrow(`${W} by birth in the territory is conditional, so states its condition (soilIf)`);
    for (const soil of ['unconditional', 'none']) expect(() => born({ soil, soilIf: 'x', descent: 'none' }), soil).toThrow(`${W} states a condition only for a conditional birth in the territory`);
    for (const [descent, descentAbroad] of [['none', 'x'], ['father', ''], ['father', ' '], ['either parent', 7]]) {
      expect(() => born({ soil: 'none', descent, descentAbroad }), `${descent} ${String(descentAbroad)}`).toThrow(`${W} states a limit abroad only as text, and only for a descent`);
    }
  });

  it("takes naturalisation's fee, time and tests", () => {
    expect(compileState('GB', state({ country: 'GB', currency: 'GBP', fee: '1839', within: { n: 6, unit: 'month' }, test: ['language', 'civics'] }))).toStrictEqual({
      years: 5, renounce: false, lapses: false, fee: { currency: 'GBP', minor: 183900 }, within: { n: 6, unit: 'month' }, test: ['language', 'civics'],
    });
    expect(compileState('MX', state({ country: 'MX', currency: 'MXN', fee: '9502.01', within: { n: 0, unit: 'working day' }, test: [] }))).toMatchObject({ fee: { currency: 'MXN', minor: 950201 }, within: { n: 0, unit: 'working day' }, test: [] });
    expect(compileState('IE', state({ country: 'IE', currency: 'EUR', fee: '0' })).fee).toEqual({ currency: 'EUR', minor: 0 });
    const s = compileState('DE', state());
    for (const key of ['fee', 'within', 'test']) expect(s).not.toHaveProperty(key);
    for (const currency of ['XXX', 7, undefined]) expect(() => compileState('DE', state({ currency, fee: '1' })), String(currency)).toThrow(`DE's naturalisation fee is in ${String(currency)}, not a currency in use`);
    expect(() => compileState('DE', state({ currency: ['EUR'], fee: '1' }))).toThrow("DE's naturalisation fee is in EUR, not a currency in use");
    for (const fee of [1, '-1', '1,5', '', null]) expect(() => compileState('DE', state({ currency: 'EUR', fee })), String(fee)).toThrow("DE's naturalisation fee is an amount written out in major units");
    expect(() => compileState('DE', state({ currency: 'EUR', fee: '1.001' }))).toThrow('EUR has 2 decimal places; "1.001" has more');
    expect(() => compileState('DE', state({ currency: 'EUR' }))).toThrow('DE names a currency only for its naturalisation fee');
    for (const within of [3, null, [6, 'month'], { n: -1, unit: 'day' }, { n: 1.5, unit: 'day' }, { n: 1, unit: 'year' }, { unit: 'day' }, { n: 1, unit: 'day', at: 'most' }]) {
      expect(() => compileState('DE', state({ within })), JSON.stringify(within)).toThrow("DE's naturalisation takes a whole number of minutes, hours, days, working days, weeks or months");
    }
    for (const test of ['language', ['oath'], ['language', 'language'], null]) {
      expect(() => compileState('DE', state({ test })), JSON.stringify(test)).toThrow("DE's naturalisation tests are distinct of language, civics, or none");
    }
    for (const more of [{ currency: 'CNY' }, { fee: '1' }, { within: { n: 1, unit: 'day' } }, { test: [] }]) {
      expect(() => compileState('CN', state({ country: 'CN', years: 'none', renounce: null, ...more })), JSON.stringify(more)).toThrow('CN naturalises no one by residence, so has no fee, time or test');
    }
  });

  it("takes a territory to the state whose nationality its people hold, and whether living there counts", () => {
    expect(compileOf('GU', { country: 'GU', nationalityOf: 'US', note: 'x', sources: [] })).toStrictEqual({ nationalityOf: 'US' });
    expect(compileOf('SJ', { country: 'SJ', nationalityOf: 'NO', residenceCounts: false })).toStrictEqual({ nationalityOf: 'NO', residenceCounts: false });
    for (const residenceCounts of [true, 'no', null]) {
      expect(() => compileOf('SJ', { country: 'SJ', nationalityOf: 'NO', residenceCounts }), String(residenceCounts)).toThrow("SJ's file says living there doesn't count towards NO's naturalisation only as residenceCounts: false");
    }
    expect(() => compileOf('XX', { country: 'XX', nationalityOf: 'US' })).toThrow('XX is not a country on the map');
    expect(() => compileOf('GU', { country: 'PR', nationalityOf: 'US' })).toThrow("GU's file is for PR");
    for (const of of ['XX', 'GU', 7]) expect(() => compileOf('GU', { country: 'GU', nationalityOf: of })).toThrow(`GU's people hold another country's nationality on the map, not ${String(of)}`);
    for (const key of ['years', 'renounce', 'lapses', 'atBirth', 'currency', 'fee', 'within', 'test']) {
      expect(() => compileOf('GU', { country: 'GU', nationalityOf: 'US', [key]: null }), key).toThrow("GU's people hold US's nationality, so its rules are US's");
    }
    const us = compileState('US', state({ country: 'US' }));
    expect(() => checkNationalities({ US: us, GU: { nationalityOf: 'US' }, SJ: { nationalityOf: 'US', residenceCounts: false } })).not.toThrow();
    expect(() => checkNationalities({ US: us, GU: { nationalityOf: 'NO' } })).toThrow("GU's people hold NO's nationality, which the game doesn't keep in its own right");
    expect(() => checkNationalities({ US: us, GU: { nationalityOf: 'US' }, MP: { nationalityOf: 'GU' } })).toThrow("MP's people hold GU's nationality, which the game doesn't keep in its own right");
  });

  it('reads only files the register cites, as cited', () => {
    const root = mkdtempSync(join(tmpdir(), 'citizenship-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const write = (name: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, SOURCES, name), text);
      return createHash('sha256').update(text).digest('hex');
    };
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    // Written out of order: the files are read in the order of their names.
    const us = write('US.json', state({ country: 'US' }));
    const gu = write('GU.json', { country: 'GU', nationalityOf: 'US' });
    const cn = write('CN.json', state({ country: 'CN', years: 'none', renounce: null, lapses: true }));
    write('notes.txt', 'not a file');
    const cite = (code: string, sha256: string) => ({ fact: `papers.citizenship.${code}`, value: { file: `${SOURCES}/${code}.json`, sha256 } });
    register([cite('US', us), cite('GU', gu), cite('CN', cn), { fact: 'papers.citizenship.blocked.KP' }, { fact: 'papers.ids.US', value: { file: `${SOURCES}/US.json`, sha256: 'other' } }]);
    const rules = readCitizenship(root);
    expect(Object.keys(rules)).toEqual(['CN', 'GU', 'US']);
    expect(rules).toStrictEqual({ CN: { years: 'none', renounce: null, lapses: true }, GU: { nationalityOf: 'US' }, US: { years: 5, renounce: false, lapses: false } });
    register([cite('US', us.replace(/^./, (c) => (c === '0' ? '1' : '0'))), cite('GU', gu), cite('CN', cn)]);
    expect(() => readCitizenship(root)).toThrow(`${SOURCES}/US.json isn't the file the register cites`);
    register([cite('GU', gu), cite('CN', cn)]);
    expect(() => readCitizenship(root)).toThrow(`${SOURCES}/US.json isn't cited by the register`);
    // A state the game doesn't keep in its own right stops the read.
    const us2 = write('US.json', { country: 'US', nationalityOf: 'CN' });
    register([cite('US', us2), cite('GU', gu), cite('CN', cn)]);
    expect(() => readCitizenship(root)).toThrow("GU's people hold US's nationality, which the game doesn't keep in its own right");
    expect(serialize({ GU: { nationalityOf: 'US' } })).toBe('{\n "GU": {\n  "nationalityOf": "US"\n }\n}\n');
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readCitizenship(ROOT)));
  });
});

describe('the citizenship coverage', () => {
  it('is researched where compiled and cited, blocked where the register holds a blocker, proven where no one is born', () => {
    const facts = new Map([['papers.citizenship.DE', 'R-1'], ['papers.citizenship.blocked.KP', 'R-3'], ['papers.citizenship.blocked.DE', 'R-4']]);
    const rows = citizenshipCoverage(['DE', 'KP', 'FR', 'AQ', 'CZ'], new Set(['DE', 'KP', 'FR', 'CZ']), new Set(['DE', 'CZ']), facts);
    expect(rows).toEqual([
      { key: 'DE', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'FR', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // Compiled but not cited: not researched.
      { key: 'CZ', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/papers/citizenship/citizenship.test.ts::citizenship > is each state's own, and a territory's is its state's", 'tests/papers/citizenship/citizenship.places.test.ts::citizenship > for every place on the map']);
    expect(TOLD).toBe("tests/papers/citizenship/citizenship.test.ts::citizenship > tells the player what the game doesn't know");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.citizenship', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/citizenship-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
