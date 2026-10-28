import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkIssuers, compileCard, compileIssued, compileNone, OUTPUT, readIds, serialize, SOURCES } from '../../tools/papers/ids/compile.ts';
import { COVERAGE, coverageOf, idsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/papers/ids/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const route = (id: string, extra: Record<string, unknown> = {}) => ({ id, where: 'home', speed: 'standard', within: null, label: 'as the office says', ...extra });
const file = (over: Record<string, unknown> = {}) => ({
  country: 'DE',
  document: 'Personalausweis',
  compulsory: { from: 16 },
  currency: 'EUR',
  routes: [route('home'), route('abroad', { where: 'abroad', within: { n: 3, unit: 'week' } })],
  cards: [
    { for: 'adult', from: 24, validYears: 10, pay: { home: '46', abroad: '89' } },
    { for: 'young', under: 24, validYears: 6, pay: { home: '27.60', abroad: null } },
  ],
  note: 'anything',
  sources: [],
  ...over,
});

describe('the identity documents compile', () => {
  it("takes a card to its name, compulsory age, routes and bands in minor units", () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/papers/ids', 'src/papers/ids/ids.json']);
    expect(compileCard('DE', file())).toStrictEqual({
      document: 'Personalausweis',
      compulsory: { from: 16 },
      currency: 'EUR',
      routes: [
        { id: 'home', where: 'home', speed: 'standard', within: null },
        { id: 'abroad', where: 'abroad', speed: 'standard', within: { n: 3, unit: 'week' } },
      ],
      bands: [
        { from: 24, validYears: 10, pay: { home: 4600, abroad: 8900 } },
        { under: 24, validYears: 6, pay: { home: 2760, abroad: null } },
      ],
    });
    expect(compileCard('DE', file({ compulsory: { from: 0, at: 'birth' } })).compulsory).toStrictEqual({ from: 0 });
    expect(compileCard('DE', file({ compulsory: false })).compulsory).toBe(false);
    expect(compileCard('DE', file({ compulsory: null })).compulsory).toBeNull();
  });

  it('refuses a card that is not what it says it is', () => {
    expect(() => compileCard('XX', file())).toThrow('XX is not a country on the map');
    expect(() => compileCard('FR', file())).toThrow("FR's file is for DE");
    for (const document of [undefined, '', 7]) expect(() => compileCard('DE', file({ document }))).toThrow("DE's identity document needs its name");
    for (const compulsory of [undefined, true, 16, {}, { from: -1 }, { from: 1.5 }, { from: '16' }, []]) {
      expect(() => compileCard('DE', file({ compulsory })), JSON.stringify(compulsory)).toThrow("DE's identity document is compulsory from a whole age, or false, or null");
    }
    expect(() => compileCard('DE', file({ currency: 'XXX' }))).toThrow("DE's fees are in XXX, not a currency in use");
    expect(() => compileCard('DE', file({ routes: [] }))).toThrow('DE has no routes');
    expect(() => compileCard('DE', file({ routes: 'none' }))).toThrow('DE has no routes');
    expect(() => compileCard('DE', file({ routes: [7] }))).toThrow("DE's route 0 is not an object");
    expect(() => compileCard('DE', file({ routes: [route('home'), route('home')] }))).toThrow('DE has two routes of one id');
    expect(() => compileCard('DE', file({ routes: [route('home'), route('abroad', { months: [1] })] }))).toThrow("DE's route abroad is offered all year round");
    expect(() => compileCard('DE', file({ cards: [] }))).toThrow('DE has no cards');
    expect(() => compileCard('DE', file({ cards: {} }))).toThrow('DE has no cards');
    expect(() => compileCard('DE', file({ cards: ['adult'] }))).toThrow("DE's card 0 is not an object");
    expect(() => compileCard('DE', file({ cards: [{ validYears: 10, pay: { home: '1', abroad: '2' } }, { validYears: 5, pages: 32, pay: { home: '1' } }] }))).toThrow("DE's card 1 is a card, with no pages");
    expect(() => compileCard('DE', file({ routes: [route('home'), route('abroad'), route('post')] }))).toThrow("DE's route post is paid for by no card");
    expect(() => compileCard('DE', file({ cards: [{ from: 18, validYears: 10, pay: { home: '1', abroad: '1' } }, { from: 60, validYears: 10, pay: { home: '1' } }] }))).toThrow("DE's cards 0 and 1 meet the same applicant");
    expect(() => compileCard('DE', file({ cards: [{ under: 5, validYears: 1, pay: { home: '1', abroad: '1' } }, { from: 5, validYears: 1, pay: { home: '1' } }, { from: 70, validYears: 1, pay: { home: '1' } }] }))).toThrow("DE's cards 1 and 2 meet the same applicant");
    expect(() => compileCard('DE', file({ cards: [{ under: 5, validYears: 1, pay: { home: '1', abroad: '1' } }, { from: 5, validYears: 1, pay: { home: '1' } }, { under: 3, validYears: 1, pay: { home: '1' } }] }))).toThrow("DE's cards 0 and 2 meet the same applicant");
    expect(compileCard('DE', file({ cards: [{ from: 18, validYears: 5, pay: { home: '1', abroad: '1' } }, { from: 18, validYears: 10, pay: { home: '2' } }] })).bands).toHaveLength(2);
  });

  it('takes a country that issues none to none, and a territory to the country whose document its people hold', () => {
    expect(compileNone('GB', { country: 'GB', none: true, note: 'x', sources: [] })).toStrictEqual({ none: true });
    expect(() => compileNone('XX', { country: 'XX', none: true })).toThrow('XX is not a country on the map');
    expect(() => compileNone('GB', { country: 'GB', none: 'yes' })).toThrow("GB's file says it issues none only as none: true");
    for (const key of ['routes', 'cards', 'document']) {
      expect(() => compileNone('GB', { country: 'GB', none: true, [key]: [] }), key).toThrow('GB issues no identity document, so it has no routes, cards or name');
    }
    expect(compileIssued('GU', { country: 'GU', issuedBy: 'US', note: 'x', sources: [] })).toStrictEqual({ issuedBy: 'US' });
    expect(compileIssued('GF', { country: 'GF', issuedBy: 'FR', onlyRoutes: ['home', 'abroad'] })).toStrictEqual({ issuedBy: 'FR', onlyRoutes: ['home', 'abroad'] });
    expect(() => compileIssued('XX', { country: 'XX', issuedBy: 'US' })).toThrow('XX is not a country on the map');
    expect(() => compileIssued('GU', { country: 'PR', issuedBy: 'US' })).toThrow("GU's file is for PR");
    for (const issuedBy of ['XX', 'GU', 7]) expect(() => compileIssued('GU', { country: 'GU', issuedBy })).toThrow(`GU's identity documents are issued by another country on the map, not ${String(issuedBy)}`);
    for (const key of ['routes', 'cards']) {
      expect(() => compileIssued('GU', { country: 'GU', issuedBy: 'US', [key]: [] }), key).toThrow("GU's identity documents are US's, so it has no routes or cards of its own");
    }
    for (const onlyRoutes of [[], 'home', [''], [3], ['a', ''], ['a', 'a']]) {
      expect(() => compileIssued('GF', { country: 'GF', issuedBy: 'FR', onlyRoutes }), JSON.stringify(onlyRoutes)).toThrow("GF is open to distinct routes of FR's by id");
    }
    const de = compileCard('DE', file());
    expect(() => checkIssuers({ DE: de, GB: { none: true }, AT: { issuedBy: 'DE' }, CH: { issuedBy: 'DE', onlyRoutes: ['abroad'] }, GU: { issuedBy: 'GB' } })).not.toThrow();
    expect(() => checkIssuers({ DE: de, AT: { issuedBy: 'PL' } })).toThrow("AT's identity documents are PL's, which the game doesn't keep in its own right");
    expect(() => checkIssuers({ DE: de, AT: { issuedBy: 'DE' }, CH: { issuedBy: 'AT' } })).toThrow("CH's identity documents are AT's, which the game doesn't keep in its own right");
    expect(() => checkIssuers({ GB: { none: true }, GU: { issuedBy: 'GB', onlyRoutes: ['home'] } })).toThrow("GU is open to routes of GB's, which issues none");
    expect(() => checkIssuers({ DE: de, CH: { issuedBy: 'DE', onlyRoutes: ['home', 'post'] } })).toThrow('CH is open to a route DE has none of (post)');
  });

  it('reads only files the register cites, as cited', () => {
    const root = mkdtempSync(join(tmpdir(), 'ids-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const write = (name: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, SOURCES, name), text);
      return createHash('sha256').update(text).digest('hex');
    };
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    // Written out of order: the files are read in the order of their names.
    const gb = write('GB.json', { country: 'GB', none: true });
    const de = write('DE.json', file());
    const at = write('AT.json', { country: 'AT', issuedBy: 'DE' });
    write('notes.txt', 'not a file');
    const cite = (code: string, sha256: string) => ({ fact: `papers.ids.${code}`, value: { file: `${SOURCES}/${code}.json`, sha256 } });
    register([cite('GB', gb), cite('AT', at), cite('DE', de), { fact: 'papers.ids.blocked.KP' }, { fact: 'papers.passports.DE', value: { file: `${SOURCES}/DE.json`, sha256: 'other' } }]);
    const ids = readIds(root);
    expect(Object.keys(ids)).toEqual(['AT', 'DE', 'GB']);
    expect(ids['AT']).toStrictEqual({ issuedBy: 'DE' });
    expect(ids['GB']).toStrictEqual({ none: true });
    expect(ids['DE']).toStrictEqual(compileCard('DE', file()));
    register([cite('GB', gb), cite('AT', at), cite('DE', de.replace(/^./, (c) => (c === '0' ? '1' : '0')))]);
    expect(() => readIds(root)).toThrow(`${SOURCES}/DE.json isn't the file the register cites`);
    register([cite('GB', gb), cite('AT', at)]);
    expect(() => readIds(root)).toThrow(`${SOURCES}/DE.json isn't cited by the register`);
    // An issuer the game doesn't keep in its own right stops the read.
    const de2 = write('DE.json', { country: 'DE', issuedBy: 'GB' });
    register([cite('GB', gb), cite('AT', at), cite('DE', de2)]);
    expect(() => readIds(root)).toThrow("AT's identity documents are DE's, which the game doesn't keep in its own right");
    expect(serialize({ GB: { none: true } })).toBe('{\n "GB": {\n  "none": true\n }\n}\n');
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readIds(ROOT)));
  });
});

describe('the identity documents coverage', () => {
  it('is researched where compiled and cited, blocked where the register holds a blocker, proven where no one is born', () => {
    const facts = new Map([['papers.ids.DE', 'R-1'], ['papers.ids.blocked.KP', 'R-3'], ['papers.ids.blocked.DE', 'R-4']]);
    const rows = idsCoverage(['DE', 'KP', 'FR', 'AQ', 'CZ'], new Set(['DE', 'KP', 'FR', 'CZ']), new Set(['DE', 'CZ']), facts);
    expect(rows).toEqual([
      { key: 'DE', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'FR', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // Compiled but not cited: not researched.
      { key: 'CZ', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/papers/ids/ids.test.ts::the identity documents > are each country's own, by age and route", 'tests/papers/ids/ids.places.test.ts::the identity documents > for every place on the map']);
    expect(TOLD).toBe("tests/papers/ids/ids.test.ts::the identity documents > tell the player what the game doesn't know");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.ids', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/ids-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
