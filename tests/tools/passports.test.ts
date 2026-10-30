import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkIssuers, compileIssued, compilePassport, isCompilable, isOwnRoute, OUTPUT, readPassports, serialize, SOURCES, UNITS } from '../../tools/papers/passports/compile.ts';
import { COVERAGE, coverageOf, NO_PLACES, passportsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const route = (id: string, extra: Record<string, unknown> = {}) => ({ id, where: 'home', speed: 'standard', within: { n: 30, unit: 'day' }, label: 'as the office says', ...extra });
const file = (over: Record<string, unknown> = {}) => ({
  country: 'SK',
  currency: 'EUR',
  routes: [route('standard'), route('urgent', { speed: 'urgent', within: { n: 2, unit: 'working day' } })],
  passports: [
    { for: 'adult', from: 16, validYears: 10, pay: { standard: '50', urgent: '150.5' } },
    { for: 'child', under: 16, validYears: 5, pay: { standard: '20', urgent: null } },
  ],
  note: 'anything',
  sources: [],
  ...over,
});

describe('the passports compile', () => {
  it("takes a file in the engine's form to routes and bands in minor units", () => {
    expect(UNITS).toEqual(['minute', 'hour', 'day', 'working day', 'week', 'month']);
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/papers/passports', 'src/papers/passports/passports.json']);
    expect(compilePassport('SK', file())).toStrictEqual({
      currency: 'EUR',
      routes: [
        { id: 'standard', where: 'home', speed: 'standard', within: { n: 30, unit: 'day' } },
        { id: 'urgent', where: 'home', speed: 'urgent', within: { n: 2, unit: 'working day' } },
      ],
      bands: [
        { from: 16, validYears: 10, pay: { standard: 5000, urgent: 15050 } },
        { under: 16, validYears: 5, pay: { standard: 2000, urgent: null } },
      ],
    });
    const full = compilePassport('SK', file({
      routes: [route('a', { where: 'abroad', within: null, months: [4, 5] })],
      passports: [{ from: 0, under: 2, pages: 32, validYears: null, pay: { a: '1' } }],
    }));
    expect(full).toStrictEqual({ currency: 'EUR', routes: [{ id: 'a', where: 'abroad', speed: 'standard', within: null, months: [4, 5] }], bands: [{ from: 0, under: 2, pages: 32, validYears: null, pay: { a: 100 } }] });
    // A currency without minor units, and a route taking no time at all.
    const yen = compilePassport('JP', file({ country: 'JP', currency: 'JPY', routes: [route('s', { within: { n: 0, unit: 'minute' } })], passports: [{ validYears: 10, pay: { s: '16300' } }] }));
    expect(yen.bands).toStrictEqual([{ validYears: 10, pay: { s: 16300 } }]);
    expect(yen.routes[0]?.within).toEqual({ n: 0, unit: 'minute' });
    expect(isCompilable({ routes: [] })).toBe(true);
    expect(isCompilable({ issuedBy: 'US' })).toBe(true);
    expect(isCompilable({ passports: [] })).toBe(false);
  });

  it('allows two passports for one applicant only where their validity or their pages differ', () => {
    const two = (a: Record<string, unknown>, b: Record<string, unknown>) => compilePassport('SK', file({ routes: [route('s')], passports: [{ pay: { s: '1' }, ...a }, { pay: { s: '2' }, ...b }] }));
    expect(two({ from: 18, validYears: 5 }, { from: 18, validYears: 10 }).bands).toHaveLength(2);
    expect(two({ validYears: 5, pages: 32 }, { validYears: 5, pages: 64 }).bands).toHaveLength(2);
    expect(two({ under: 16, validYears: 5 }, { from: 16, validYears: 5 }).bands).toHaveLength(2);
    expect(() => two({ from: 18, validYears: 5 }, { from: 60, validYears: 5 })).toThrow("SK's passports 0 and 1 meet the same applicant");
    expect(() => two({ under: 18, validYears: 5 }, { under: 3, validYears: 5 })).toThrow('passports 0 and 1 meet');
    expect(() => two({ from: 10, under: 20, validYears: 5 }, { from: 19, under: 30, validYears: 5 })).toThrow('passports 0 and 1 meet');
    expect(() => two({ validYears: null }, { validYears: null })).toThrow('passports 0 and 1 meet');
    expect(() => compilePassport('SK', file({ routes: [route('s')], passports: [{ under: 5, validYears: 1, pay: { s: '1' } }, { from: 5, validYears: 1, pay: { s: '1' } }, { from: 70, validYears: 1, pay: { s: '1' } }] }))).toThrow("SK's passports 1 and 2 meet the same applicant");
    expect(() => compilePassport('SK', file({ routes: [route('s')], passports: [{ under: 5, validYears: 1, pay: { s: '1' } }, { from: 5, validYears: 1, pay: { s: '1' } }, { under: 3, validYears: 1, pay: { s: '1' } }] }))).toThrow("SK's passports 0 and 2 meet the same applicant");
  });

  it('refuses a file that is not what it says it is', () => {
    expect(() => compilePassport('XX', file())).toThrow('XX is not a country on the map');
    expect(() => compilePassport('CZ', file())).toThrow("CZ's file is for SK");
    expect(() => compilePassport('SK', file({ currency: 'XXX' }))).toThrow("SK's fees are in XXX, not a currency in use");
    expect(() => compilePassport('SK', file({ currency: 7 }))).toThrow("SK's fees are in 7, not a currency in use");
    expect(() => compilePassport('SK', file({ unit: 'UI' }))).toThrow("SK's fees are in UI, not in its currency");
    expect(() => compilePassport('SK', file({ routes: [] }))).toThrow('SK has no routes');
    expect(() => compilePassport('SK', file({ routes: 'none' }))).toThrow('SK has no routes');
    expect(() => compilePassport('SK', file({ routes: [route('s'), route('s')] }))).toThrow('SK has two routes of one id');
    expect(() => compilePassport('SK', file({ passports: [] }))).toThrow('SK has no passports');
    expect(() => compilePassport('SK', file({ passports: {} }))).toThrow('SK has no passports');
    expect(() => compilePassport('SK', file({ routes: [route('standard'), route('urgent'), route('unused')] }))).toThrow("SK's route unused is paid for by no passport");
  });

  it('refuses a route that is not one', () => {
    const bad = (r: unknown) => () => compilePassport('SK', file({ routes: [r], passports: [{ validYears: 1, pay: { s: '1' } }] }));
    expect(bad('s')).toThrow("SK's route 0 is not an object");
    expect(bad(null)).toThrow("SK's route 0 is not an object");
    expect(bad([])).toThrow("SK's route 0 is not an object");
    expect(bad(route(''))).toThrow("SK's route 0 needs an id");
    expect(bad({ ...route('s'), id: 3 })).toThrow("SK's route 0 needs an id");
    expect(bad(route('s', { where: 'there' }))).toThrow("SK's route 0 (s) is applied for at home or abroad");
    expect(bad(route('s', { speed: 'fast' }))).toThrow("SK's route 0 (s) is standard or urgent");
    for (const within of [undefined, 3, { n: -1, unit: 'day' }, { n: 1.5, unit: 'day' }, { n: 1, unit: 'year' }, { unit: 'day' }, [1, 'day']]) {
      expect(bad(route('s', { within })), JSON.stringify(within)).toThrow("SK's route 0 (s) takes a whole number of minutes, hours, days, working days, weeks or months, or null");
    }
    for (const months of [[], [0], [13], [1, 13], [1, 1], [1.5], 'May', {}]) {
      expect(bad(route('s', { months })), JSON.stringify(months)).toThrow("SK's route 0 (s) is offered in distinct months 1 to 12");
    }
    expect(compilePassport('SK', file({ routes: [route('s', { months: [1, 12] })], passports: [{ validYears: 1, pay: { s: '1' } }] })).routes[0]?.months).toEqual([1, 12]);
  });

  it('refuses a passport that is not one', () => {
    const bad = (b: unknown) => () => compilePassport('SK', file({ routes: [route('s')], passports: [b] }));
    const ok = { validYears: 5, pay: { s: '1' } };
    expect(bad('adult')).toThrow("SK's passport 0 is not an object");
    expect(bad(null)).toThrow("SK's passport 0 is not an object");
    expect(bad({ ...ok, from: -1 })).toThrow("SK's passport 0 starts at a whole age");
    expect(bad({ ...ok, from: 1.5 })).toThrow('starts at a whole age');
    expect(bad({ ...ok, under: 0 })).toThrow("SK's passport 0 ends before a whole age");
    expect(bad({ ...ok, under: '18' })).toThrow('ends before a whole age');
    expect(bad({ ...ok, from: 18, under: 18 })).toThrow("SK's passport 0 starts at 18 and ends before 18");
    expect(bad({ ...ok, from: 19, under: 18 })).toThrow('starts at 19 and ends before 18');
    expect(compilePassport('SK', file({ routes: [route('s')], passports: [{ ...ok, from: 17, under: 18 }] })).bands).toStrictEqual([{ from: 17, under: 18, validYears: 5, pay: { s: 100 } }]);
    expect(compilePassport('SK', file({ routes: [route('s')], passports: [{ ...ok, under: 1 }] })).bands).toStrictEqual([{ under: 1, validYears: 5, pay: { s: 100 } }]);
    expect(bad({ ...ok, pages: 0 })).toThrow("SK's passport 0 has a whole number of pages");
    expect(bad({ ...ok, validYears: 0 })).toThrow("SK's passport 0 is valid a whole number of years, or null");
    expect(bad({ ...ok, validYears: undefined })).toThrow('is valid a whole number of years, or null');
    expect(bad({ validYears: 5 })).toThrow("SK's passport 0 pays by route");
    expect(bad({ validYears: 5, pay: {} })).toThrow("SK's passport 0 pays by route");
    expect(bad({ validYears: 5, pay: ['1'] })).toThrow("SK's passport 0 pays by route");
    expect(bad({ validYears: 5, pay: { t: '1' } })).toThrow("SK's passport 0 pays for a route there is none of (t)");
    expect(bad({ validYears: 5, pay: { s: 1 } })).toThrow("SK's passport 0 pays s as an amount written out, or null");
    expect(bad({ validYears: 5, pay: { s: '1.001' } })).toThrow('EUR has 2 decimal places; "1.001" has more');
  });

  it('takes the routes that renew a passport held or replace a lost one, and refuses a term the form lacks', () => {
    const routes = [route('standard'), route('renew', { renewal: true, within: { n: 6, unit: 'week' } }), route('lost', { replacement: true })];
    const passports = [{ for: 'adult', validYears: 10, pay: { standard: '165', renew: '130', lost: '165' } }];
    expect(compilePassport('SK', file({ routes, passports })).routes).toStrictEqual([
      { id: 'standard', where: 'home', speed: 'standard', within: { n: 30, unit: 'day' } },
      { id: 'renew', where: 'home', speed: 'standard', within: { n: 6, unit: 'week' }, renewal: true },
      { id: 'lost', where: 'home', speed: 'standard', within: { n: 30, unit: 'day' }, replacement: true },
    ]);
    expect(isOwnRoute({ id: 'a', where: 'home', speed: 'standard', within: null })).toBe(false);
    expect(isOwnRoute({ id: 'a', where: 'home', speed: 'standard', within: null, renewal: true })).toBe(true);
    expect(isOwnRoute({ id: 'a', where: 'home', speed: 'standard', within: null, replacement: true })).toBe(true);
    const bad = (r: unknown) => () => compilePassport('SK', file({ routes: [route('s'), r], passports: [{ validYears: 1, pay: { s: '1', t: '1' } }] }));
    for (const renewal of [false, 'yes', 1]) expect(bad(route('t', { renewal })), String(renewal)).toThrow("SK's route 1 (t) is a renewal only as renewal: true");
    for (const replacement of [false, 'yes', 1]) expect(bad(route('t', { replacement })), String(replacement)).toThrow("SK's route 1 (t) is a replacement only as replacement: true");
    expect(bad(route('t', { renewal: true, replacement: true }))).toThrow("SK's route 1 (t) renews a document held or replaces a lost one, not both");
    expect(bad(route('t', { renewl: true }))).toThrow("SK's route 1 (t) has no term renewl");
    expect(() => compilePassport('SK', file({ routes: routes.slice(1), passports: [{ validYears: 10, pay: { renew: '1', lost: '1' } }] }))).toThrow('SK has no route for a first passport');
    // A band's term the form lacks; its `for` is the research's, accepted.
    expect(() => compilePassport('SK', file({ routes: [route('s')], passports: [{ for: 'adult', validYears: 1, pay: { s: '1' }, fee: '1' }] }))).toThrow("SK's passport 0 has no term fee");
  });

  it('pays the routes abroad in the currency the missions set, where it is not the country\'s', () => {
    // Yen have no minor units, so a fee abroad in cents shows the abroad currency is the one read.
    const routes = [route('home'), route('mission', { where: 'abroad' })];
    const jp = (abroad: unknown, more: Record<string, unknown> = {}) => compilePassport('JP', file({ country: 'JP', currency: 'JPY', abroad, routes, passports: [{ validYears: 10, pay: { home: '16300', mission: '62.50' } }], ...more }));
    expect(jp({ currency: 'USD' })).toStrictEqual({ currency: 'JPY', abroad: { currency: 'USD' }, routes: routes.map(({ label: _, ...r }) => r), bands: [{ validYears: 10, pay: { home: 16300, mission: 6250 } }] });
    expect(() => compilePassport('JP', file({ country: 'JP', currency: 'JPY', routes, passports: [{ validYears: 10, pay: { home: '16300', mission: '62.50' } }] }))).toThrow('JPY has 0 decimal places; "62.50" has more');
    for (const abroad of ['USD', null, ['USD']]) expect(() => jp(abroad), JSON.stringify(abroad)).toThrow("JP's abroad is not an object");
    expect(() => jp({ currency: 'USD', pay: {} })).toThrow("JP's abroad has no term pay");
    for (const currency of ['XXX', 7, undefined]) expect(() => jp({ currency }), String(currency)).toThrow(`JP's fees abroad are in ${String(currency)}, not a currency in use`);
    expect(() => jp({ currency: ['USD'] })).toThrow("JP's fees abroad are in USD, not a currency in use");
    expect(() => jp({ currency: 'JPY' })).toThrow("JP's fees abroad are in its own currency, which needs no abroad");
    expect(() => jp({ currency: 'USD' }, { routes: [route('home')], passports: [{ validYears: 10, pay: { home: '1' } }] })).toThrow('JP has no route abroad to pay in USD');
  });

  it('takes a passport card: its name and its bands, paid by the routes', () => {
    const card = (c: unknown, more: Record<string, unknown> = {}) => compilePassport('SK', file({ card: c, ...more })).card;
    const bands = [{ for: 'adult', from: 16, validYears: 10, pay: { standard: '30' } }, { under: 16, validYears: 5, pay: { standard: '15', urgent: null } }];
    expect(card({ name: 'passport card', bands })).toStrictEqual({ name: 'passport card', bands: [{ from: 16, validYears: 10, pay: { standard: 3000 } }, { under: 16, validYears: 5, pay: { standard: 1500, urgent: null } }] });
    expect(compilePassport('SK', file())).not.toHaveProperty('card');
    // Paid abroad in the missions' currency, as the passport is.
    const abroad = { abroad: { currency: 'JPY' }, routes: [route('standard'), route('urgent'), route('m', { where: 'abroad' })], passports: [{ validYears: 10, pay: { standard: '1', urgent: '1', m: '100' } }] };
    expect(card({ name: 'c', bands: [{ validYears: 10, pay: { m: '100' } }] }, abroad)?.bands[0]?.pay).toEqual({ m: 100 });
    for (const c of ['card', null, []]) expect(() => card(c), JSON.stringify(c)).toThrow("SK's passport card is not an object");
    for (const name of ['', 7, undefined]) expect(() => card({ name, bands }), String(name)).toThrow("SK's passport card needs its name");
    for (const b of [[], {}, undefined]) expect(() => card({ name: 'c', bands: b }), JSON.stringify(b)).toThrow("SK's passport card has no bands");
    expect(() => card({ name: 'c', bands, fee: '1' })).toThrow("SK's passport card has no term fee");
    expect(() => card({ name: 'c', bands: [{ validYears: 10, pages: 2, pay: { standard: '1' } }] })).toThrow("SK's passport card 0 is a card, with no pages");
    expect(() => card({ name: 'c', bands: [{ validYears: 10, pay: { standard: '1' } }, { from: 18, validYears: 10, pay: { standard: '1' } }] })).toThrow("SK's passport cards 0 and 1 meet the same applicant");
    expect(() => card({ name: 'c', bands: [{ validYears: 10, pay: { x: '1' } }] })).toThrow("SK's passport card 0 pays for a route there is none of (x)");
  });

  it("takes a territory to the country whose passport its people hold, and holds the issuer to the others", () => {
    expect(compileIssued('GU', { country: 'GU', issuedBy: 'US', note: 'x', sources: [] })).toStrictEqual({ issuedBy: 'US' });
    expect(compileIssued('GF', { country: 'GF', issuedBy: 'FR', onlyRoutes: ['guyane', 'abroad'] })).toStrictEqual({ issuedBy: 'FR', onlyRoutes: ['guyane', 'abroad'] });
    expect(() => compileIssued('XX', { country: 'XX', issuedBy: 'US' })).toThrow('XX is not a country on the map');
    expect(() => compileIssued('GU', { country: 'PR', issuedBy: 'US' })).toThrow("GU's file is for PR");
    for (const issuedBy of ['XX', 'GU', 7]) expect(() => compileIssued('GU', { country: 'GU', issuedBy })).toThrow(`GU's passports are issued by another country on the map, not ${String(issuedBy)}`);
    for (const key of ['routes', 'passports', 'abroad', 'card']) {
      expect(() => compileIssued('GU', { country: 'GU', issuedBy: 'US', [key]: [] }), key).toThrow("GU's passports are US's, so it has no routes, passports, fees abroad or passport card of its own");
    }
    for (const onlyRoutes of [[], 'guyane', [''], [3], ['a', ''], ['a', 'a']]) {
      expect(() => compileIssued('GF', { country: 'GF', issuedBy: 'FR', onlyRoutes }), JSON.stringify(onlyRoutes)).toThrow("GF is open to distinct routes of FR's by id");
    }
    const sk = compilePassport('SK', file());
    expect(() => checkIssuers({ SK: sk, CZ: { issuedBy: 'SK' }, AT: { issuedBy: 'SK', onlyRoutes: ['urgent'] } })).not.toThrow();
    expect(() => checkIssuers({ SK: sk, CZ: { issuedBy: 'PL' } })).toThrow("CZ's passports are PL's, which the game doesn't keep in its own right");
    expect(() => checkIssuers({ SK: sk, CZ: { issuedBy: 'SK' }, AT: { issuedBy: 'CZ' } })).toThrow("AT's passports are CZ's, which the game doesn't keep in its own right");
    expect(() => checkIssuers({ SK: sk, CZ: { issuedBy: 'SK', onlyRoutes: ['standard', 'abroad'] } })).toThrow('CZ is open to a route SK has none of (abroad)');
  });

  it('reads only files the register cites, as cited, and leaves those not in the engine\'s form pending', () => {
    const root = mkdtempSync(join(tmpdir(), 'passports-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    const write = (name: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, SOURCES, name), text);
      return createHash('sha256').update(text).digest('hex');
    };
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    // Written out of order: the files are read in the order of their names.
    const zw = write('ZW.json', { country: 'ZW', passports: [] });
    const sk = write('SK.json', file());
    const uy = write('UY.json', { country: 'UY', currency: 'UYU', unit: 'UI', passports: [] });
    const ad = write('AD.json', { country: 'AD', passports: [] });
    const at = write('AT.json', { country: 'AT', issuedBy: 'SK' });
    write('notes.txt', 'not a file');
    const cite = (code: string, sha256: string) => ({ fact: `papers.passports.${code}`, value: { file: `${SOURCES}/${code}.json`, sha256 } });
    register([cite('ZW', zw), cite('AD', ad), cite('AT', at), cite('SK', sk), cite('UY', uy), { fact: 'papers.passports.blocked.KP' }, { fact: 'world.prices.SK', value: { file: `${SOURCES}/SK.json`, sha256: 'other' } }]);
    const read = readPassports(root);
    expect(read.pending).toEqual(['AD', 'UY', 'ZW']);
    expect(Object.keys(read.passports)).toEqual(['AT', 'SK']);
    expect(read.passports['AT']).toStrictEqual({ issuedBy: 'SK' });
    expect((read.passports['SK'] as { bands: { pay: unknown }[] } | undefined)?.bands[0]?.pay).toEqual({ standard: 5000, urgent: 15050 });
    register([cite('ZW', zw), cite('AD', ad), cite('AT', at), cite('SK', sk.replace(/^./, (c) => (c === '0' ? '1' : '0'))), cite('UY', uy)]);
    expect(() => readPassports(root)).toThrow(`${SOURCES}/SK.json isn't the file the register cites`);
    register([cite('ZW', zw), cite('AD', ad), cite('AT', at), cite('UY', uy)]);
    expect(() => readPassports(root)).toThrow(`${SOURCES}/SK.json isn't cited by the register`);
    // An issuer the game doesn't keep in its own right stops the read.
    write('SK.json', { country: 'SK', passports: [] });
    register([cite('AT', at), cite('SK', createHash('sha256').update(JSON.stringify({ country: 'SK', passports: [] })).digest('hex'))].concat([cite('ZW', zw), cite('AD', ad), cite('UY', uy)]));
    expect(() => readPassports(root)).toThrow("AT's passports are SK's, which the game doesn't keep in its own right");
    expect(serialize({ SK: compilePassport('SK', file()) })).toBe(`${JSON.stringify({ SK: compilePassport('SK', file()) }, null, 1)}\n`);
  });

  it("is the engine's file, as built from the research", () => {
    const { passports } = readPassports(ROOT);
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(passports));
  });
});

describe('the passports coverage', () => {
  it('is researched where compiled and cited, blocked where the register holds a blocker, proven where no one is born', () => {
    const facts = new Map([['papers.passports.SK', 'R-1'], ['papers.passports.UY', 'R-2'], ['papers.passports.blocked.KP', 'R-3'], ['papers.passports.blocked.SK', 'R-4']]);
    const rows = passportsCoverage(['SK', 'UY', 'KP', 'FR', 'AQ', 'CZ'], new Set(['SK', 'UY', 'KP', 'FR', 'CZ']), new Set(['SK', 'CZ']), facts);
    expect(rows).toEqual([
      { key: 'SK', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'UY', status: 'pending' },
      { key: 'KP', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'FR', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // Compiled but not cited: not researched.
      { key: 'CZ', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/papers/passports/passports.test.ts::the passports > are each office's own, by age, route and month", 'tests/papers/passports/passports.places.test.ts::the passports > for every place on the map']);
    expect(TOLD).toBe("tests/papers/passports/passports.test.ts::the passports > tell the player what the game doesn't know");
    expect(NO_PLACES).toBe('tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own');
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.passports', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/passports-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
