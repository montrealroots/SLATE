import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkNationalities, compileOf, compileState, OUTPUT, readCitizenship, serialize, SOURCES } from '../../tools/papers/citizenship/compile.ts';
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

  it("takes a territory to the state whose nationality its people hold, and whether living there counts", () => {
    expect(compileOf('GU', { country: 'GU', nationalityOf: 'US', note: 'x', sources: [] })).toStrictEqual({ nationalityOf: 'US' });
    expect(compileOf('SJ', { country: 'SJ', nationalityOf: 'NO', residenceCounts: false })).toStrictEqual({ nationalityOf: 'NO', residenceCounts: false });
    for (const residenceCounts of [true, 'no', null]) {
      expect(() => compileOf('SJ', { country: 'SJ', nationalityOf: 'NO', residenceCounts }), String(residenceCounts)).toThrow("SJ's file says living there doesn't count towards NO's naturalisation only as residenceCounts: false");
    }
    expect(() => compileOf('XX', { country: 'XX', nationalityOf: 'US' })).toThrow('XX is not a country on the map');
    expect(() => compileOf('GU', { country: 'PR', nationalityOf: 'US' })).toThrow("GU's file is for PR");
    for (const of of ['XX', 'GU', 7]) expect(() => compileOf('GU', { country: 'GU', nationalityOf: of })).toThrow(`GU's people hold another country's nationality on the map, not ${String(of)}`);
    for (const key of ['years', 'renounce', 'lapses']) {
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
