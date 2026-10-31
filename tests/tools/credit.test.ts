import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileCountry, GAME_REPORT, OUTPUT, readCredit, serialize, SOURCES } from '../../tools/money/credit/compile.ts';
import { COVERAGE, coverageOf, creditCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/money/credit/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('the credit records compile', () => {
  it("takes a country's file to its bureau, its days to report and its years kept", () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/money/credit', 'src/money/credit/credit.json']);
    expect(compileCountry('US', { country: 'US', bureau: 'B', report: 30, keep: 7, note: 'x', sources: [] })).toStrictEqual({ bureau: 'B', report: 30, keep: 7 });
    expect(compileCountry('US', { country: 'US', bureau: 'B', report: 1, keep: 1 })).toStrictEqual({ bureau: 'B', report: 1, keep: 1 });
    expect(compileCountry('US', { country: 'US', bureau: 'B', report: 365, keep: 30 })).toStrictEqual({ bureau: 'B', report: 365, keep: 30 });
    expect(() => compileCountry('XX', { country: 'XX' })).toThrow('XX is not a country on the map');
    expect(() => compileCountry('US', { country: 'GB' })).toThrow("US's file is for GB");
    for (const bureau of [undefined, '', ' B', 7]) expect(() => compileCountry('US', { country: 'US', bureau, report: 30, keep: 7 }), String(bureau)).toThrow('US names the bureau that keeps the record');
    for (const report of [0, 366, 1.5, '30', undefined]) expect(() => compileCountry('US', { country: 'US', bureau: 'B', report, keep: 7 }), String(report)).toThrow("US's report is the days after a due date a late payment is reported, from 1 to 365");
    for (const keep of [0, 31, 6.5, '7', undefined]) expect(() => compileCountry('US', { country: 'US', bureau: 'B', report: 30, keep }), String(keep)).toThrow("US's keep is the whole years a late payment stays, from 1 to 30");
    // No source stating the days: the game's reading, marked so.
    expect(GAME_REPORT).toBe(30);
    expect(compileCountry('MX', { country: 'MX', bureau: 'B', reportGame: true, keep: 6 })).toStrictEqual({ bureau: 'B', report: 30, keep: 6, game: true });
    for (const f of [{ reportGame: false }, { reportGame: 'true' }, { reportGame: true, report: 30 }]) expect(() => compileCountry('MX', { country: 'MX', bureau: 'B', keep: 6, ...f }), JSON.stringify(f)).toThrow("MX states its days to report, or marks them the game's (reportGame: true), not both");
    expect(() => compileCountry('MX', { country: 'MX', bureau: 'B', reportGame: true, keep: 0 })).toThrow("MX's keep is the whole years a late payment stays, from 1 to 30");
    // A record that lifts a late payment once paid: the days after paying, from 0 to 3650 (ten years), with stated or the game's days.
    expect(compileCountry('HN', { country: 'HN', bureau: 'B', report: 30, keep: 2, clears: 90 })).toStrictEqual({ bureau: 'B', report: 30, keep: 2, clears: 90 });
    expect(compileCountry('HN', { country: 'HN', bureau: 'B', report: 30, keep: 2, clears: 0 })).toStrictEqual({ bureau: 'B', report: 30, keep: 2, clears: 0 });
    expect(compileCountry('HN', { country: 'HN', bureau: 'B', reportGame: true, keep: 2, clears: 3650 })).toStrictEqual({ bureau: 'B', report: 30, keep: 2, game: true, clears: 3650 });
    for (const clears of [-1, 3651, 1.5, '90', null]) expect(() => compileCountry('HN', { country: 'HN', bureau: 'B', report: 30, keep: 2, clears }), String(clears)).toThrow("HN's clears is the days after a late payment is paid that its mark lifts, from 0 to 3650");
    // No bureau or registry at all: said so, and nothing a record would have.
    expect(compileCountry('LU', { country: 'LU', none: true, note: 'x', sources: [] })).toStrictEqual({ none: true });
    for (const f of [{ none: false }, { none: 'true' }, { none: true, bureau: 'B' }, { none: true, report: 30 }, { none: true, keep: 5 }, { none: true, reportGame: true }, { none: true, clears: 0 }]) expect(() => compileCountry('LU', { country: 'LU', ...f }), JSON.stringify(f)).toThrow('LU keeps no record (none: true) and names nothing a record would have');
  });

  it('reads only the files the register cites, at the hash it cites', () => {
    const root = mkdtempSync(join(tmpdir(), 'credit-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const file = `${JSON.stringify({ country: 'GB', bureau: 'B', report: 30, keep: 6 })}\n`;
    writeFileSync(join(root, SOURCES, 'GB.json'), file);
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not research');
    const sha = createHash('sha256').update(file).digest('hex');
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    register([{ fact: 'money.credit.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }]);
    expect(readCredit(root)).toStrictEqual({ countries: { GB: { bureau: 'B', report: 30, keep: 6 } } });
    register([{ fact: 'money.credit.GB', value: { file: `${SOURCES}/GB.json`, sha256: '0'.repeat(64) } }]);
    expect(() => readCredit(root)).toThrow(`${SOURCES}/GB.json isn't the file the register cites`);
    register([{ fact: 'money.cards.GB', value: { file: `${SOURCES}/GB.json`, sha256: sha } }, { fact: 'money.credit.blocked.FR' }]);
    expect(() => readCredit(root)).toThrow(`${SOURCES}/GB.json isn't cited by the register`);
  });

  it('writes what it reads, as the repository holds it', () => {
    expect(serialize(readCredit(ROOT))).toBe(readFileSync(join(ROOT, OUTPUT), 'utf8'));
    expect(serialize({ countries: {} })).toBe('{\n "countries": {}\n}\n');
  });
});

describe('the credit records coverage', () => {
  it('rows each country researched, blocked, pending, or proven with no place', () => {
    const facts = new Map([['money.credit.GB', 'R-1'], ['money.credit.blocked.FR', 'R-2'], ['money.credit.DE', 'R-3'], ['money.cards.IT', 'R-4']]);
    expect(creditCoverage(['GB', 'FR', 'IT', 'AQ', 'DE'], new Set(['GB', 'FR', 'IT', 'DE']), new Set(['GB', 'IT']), facts)).toStrictEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'FR', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] },
      { key: 'IT', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      { key: 'DE', status: 'pending' },
    ]);
  });

  it('writes the matrix the repository holds', () => {
    expect([COVERAGE, TOLD, TESTS]).toEqual([
      'coverage/credit-countries.json',
      "tests/money/credit/credit.test.ts::credit > tell the player what the game doesn't know",
      ["tests/money/credit/credit.test.ts::credit > name each country's credit bureau, when it reports a late payment and how long it keeps it", 'tests/money/credit/credit.places.test.ts::credit > for every place on the map'],
    ]);
    expect(coverageOf(ROOT)).toBe(readFileSync(join(ROOT, COVERAGE), 'utf8'));
    expect(serializeCoverage([])).toBe('{\n "engine": "money.credit",\n "axis": "country",\n "rows": []\n}\n');
  });
});
