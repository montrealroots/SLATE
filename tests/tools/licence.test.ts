import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLicences, compileLicence, feeOf, OUTPUT, readLicences, serialize, SOURCES } from '../../tools/papers/licence/compile.ts';
import { COVERAGE, coverageOf, licenceCoverage, TESTS, TOLD } from '../../tools/papers/licence/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const ny = (over: Record<string, unknown> = {}) => ({
  country: 'US',
  region: 'US.NY',
  issuer: 'New York State Department of Motor Vehicles',
  licence: { name: 'Class D license', from: 18, fee: '64.25', validYears: 8 },
  card: { name: 'Non-driver ID card', fee: '14', validYears: 8 },
  note: 'anything',
  sources: [],
  ...over,
});
const de = (over: Record<string, unknown> = {}) => ({ country: 'DE', issuer: 'Fahrerlaubnisbehörde', licence: { name: 'Führerschein Klasse B', from: 18, fee: null, validYears: 15 }, ...over });

describe('the licences compile', () => {
  it("takes a country's or a region's licence and card to their fees in minor units", () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/papers/licence', 'src/papers/licence/licence.json']);
    expect(compileLicence('US.NY', ny())).toStrictEqual({
      issuer: 'New York State Department of Motor Vehicles',
      licence: { name: 'Class D license', from: 18, fee: { currency: 'USD', minor: 6425 }, validYears: 8 },
      card: { name: 'Non-driver ID card', fee: { currency: 'USD', minor: 1400 }, validYears: 8 },
    });
    expect(compileLicence('DE', de())).toStrictEqual({ issuer: 'Fahrerlaubnisbehörde', licence: { name: 'Führerschein Klasse B', from: 18, fee: null, validYears: 15 } });
    expect(compileLicence('DE', de({ licence: undefined, card: { name: 'x', from: 0, fee: '1', validYears: null }, currency: 'USD' }))).toStrictEqual({ issuer: 'Fahrerlaubnisbehörde', card: { name: 'x', from: 0, fee: { currency: 'USD', minor: 100 }, validYears: null } });
    expect(compileLicence('US.NY', ny({ exchange: ['US.NJ', 'DE'] })).exchange).toEqual(['US.NJ', 'DE']);
    expect(compileLicence('DE', de({ licence: { name: 'x', from: 0, fee: null, validYears: 1 } })).licence?.from).toBe(0);
    // A non-citizen's fee beside a citizen's, a fee by the year, an age the licence ends at.
    const my = (over: Record<string, unknown>) => compileLicence('DE', de({ currency: 'EUR', licence: { name: 'x', from: 18, fee: '30', validYears: null, ...over } })).licence;
    expect(my({ foreignFee: '120', perYear: true, untilAge: 70 })).toStrictEqual({ name: 'x', from: 18, fee: { currency: 'EUR', minor: 3000 }, foreignFee: { currency: 'EUR', minor: 12000 }, perYear: true, validYears: null, untilAge: 70 });
    expect(() => my({ fee: null, foreignFee: '120' })).toThrow("DE's licence charges a non-citizen another fee only beside a citizen's");
    expect(() => my({ foreignFee: 'x' })).toThrow("DE's licence's foreign fee");
    // A fee in an index unit the game holds, worth an amount of the file's currency, with what the office adds.
    expect(feeOf({ count: '8.5', unit: 'UMA' }, 'MXN', 'f')).toStrictEqual({ count: '8.5', unit: 'UMA' });
    expect(feeOf({ count: '1.25', unit: 'UR', plus: '333' }, 'UYU', 'f')).toStrictEqual({ count: '1.25', unit: 'UR', plus: { currency: 'UYU', minor: 33_300 } });
    expect(feeOf('10', 'EUR', 'f')).toStrictEqual({ currency: 'EUR', minor: 1000 });
    for (const count of ['0', '-1', 8.5, undefined]) expect(() => feeOf({ count, unit: 'UMA' }, 'MXN', 'f'), String(count)).toThrow('f is a count of its unit, a decimal above 0');
    for (const unit of ['UF', 'UR', undefined, 7, ['UMA']]) expect(() => feeOf({ count: '1', unit }, 'MXN', 'f'), String(unit)).toThrow('f is in a unit the game holds, worth an amount of MXN');
    expect(() => feeOf({ count: '1', unit: 'UMA', per: 'year' }, 'MXN', 'f')).toThrow('f has no term per');
    expect(() => feeOf({ count: '1', unit: 'UR', plus: 'x' }, 'UYU', 'f')).toThrow("f's plus is an amount written out in major units");
    expect(() => feeOf(null, 'MXN', 'f')).toThrow('f is an amount written out in major units');
    // Through the file: the licence's fee and a non-citizen's may each be one.
    const mx = compileLicence('MX.18', { country: 'MX', region: 'MX.18', issuer: 'i', licence: { name: 'x', from: 18, fee: { count: '8.5', unit: 'UMA' }, foreignFee: { count: '9', unit: 'UMA' }, validYears: 3 } });
    expect([mx.licence?.fee, mx.licence?.foreignFee]).toStrictEqual([{ count: '8.5', unit: 'UMA' }, { count: '9', unit: 'UMA' }]);
    for (const perYear of [false, 'yes']) expect(() => my({ perYear }), String(perYear)).toThrow("DE's licence's fee is by the year only as perYear: true, beside a fee");
    expect(() => my({ fee: null, perYear: true })).toThrow("DE's licence's fee is by the year only as perYear: true, beside a fee");
    for (const untilAge of [18, 17, 0, 70.5, '70']) expect(() => my({ untilAge }), String(untilAge)).toThrow("DE's licence ends at a whole age above the one it's issued from");
    expect(my({ untilAge: 19 })?.untilAge).toBe(19);
    const card = (untilAge: unknown) => compileLicence('DE', de({ licence: undefined, currency: 'EUR', card: { name: 'c', fee: null, validYears: null, untilAge } })).card;
    expect(card(1)?.untilAge).toBe(1);
    expect(() => card(0)).toThrow("DE's card ends at a whole age above the one it's issued from");
    // For life: no years, no age it ends at.
    expect(my({ forLife: true })?.forLife).toBe(true);
    for (const bad of [{ forLife: false }, { forLife: 'yes' }, { forLife: true, validYears: 10 }, { forLife: true, untilAge: 70 }])
      expect(() => my(bad), JSON.stringify(bad)).toThrow("DE's licence lasts for life only as forLife: true, with no years and no age it ends at");
  });

  it('refuses a licence that is not what it says it is', () => {
    expect(() => compileLicence('XX', de())).toThrow('XX is not a country on the map');
    expect(() => compileLicence('XX.01', de())).toThrow('XX.01 is not a country on the map');
    expect(() => compileLicence('FR', de())).toThrow("FR's file is for DE");
    expect(() => compileLicence('US.NY', ny({ country: 'CA' }))).toThrow("US.NY's file is for CA");
    // A region's file names its region as the file does, one on the map; a country's names none.
    for (const region of [undefined, 'US.NJ']) expect(() => compileLicence('US.NY', ny({ region }))).toThrow("US.NY's region is the one its file is named for, a region of US on the map");
    expect(() => compileLicence('US.ZZ', ny({ region: 'US.ZZ' }))).toThrow("US.ZZ's region is the one its file is named for, a region of US on the map");
    expect(() => compileLicence('DE', de({ region: 'DE.01' }))).toThrow("DE's region is the one its file is named for, a region of DE on the map");
    expect(() => compileLicence('DE', de({ permits: [] }))).toThrow('DE has no term permits');
    for (const issuer of [undefined, '', 7]) expect(() => compileLicence('DE', de({ issuer }))).toThrow('DE needs its issuer');
    expect(() => compileLicence('DE', de({ licence: undefined }))).toThrow('DE gives a licence, a card or both');
    expect(() => compileLicence('DE', de({ licence: 'B' }))).toThrow("DE's licence is not an object");
    expect(() => compileLicence('DE', de({ licence: { name: 'x', from: 18, fee: null, validYears: 1, classes: [] } }))).toThrow("DE's licence has no term classes");
    for (const name of [undefined, '', 7]) expect(() => compileLicence('DE', de({ licence: { name, from: 18, fee: null, validYears: 1 } }))).toThrow("DE's licence needs its name");
    for (const from of [undefined, -1, 17.5, '18']) expect(() => compileLicence('DE', de({ licence: { name: 'x', from, fee: null, validYears: 1 } }))).toThrow("DE's licence is issued from a whole age");
    expect(() => compileLicence('DE', de({ card: { name: 'x', from: -1, fee: null, validYears: 1 } }))).toThrow("DE's card is issued from a whole age");
    for (const validYears of [undefined, 0, 1.5, 'permanent']) expect(() => compileLicence('DE', de({ card: { name: 'x', fee: null, validYears } }))).toThrow("DE's card is valid a whole number of years, or null");
    expect(() => compileLicence('DE', de({ card: { name: 'x', fee: 14, validYears: 1 } }))).toThrow("DE's card's fee is an amount written out in major units");
    expect(() => compileLicence('DE', de({ card: { name: 'x', validYears: 1 } }))).toThrow("DE's card's fee is an amount written out in major units");
    expect(() => compileLicence('DE', de({ currency: 'XXX', card: { name: 'x', fee: '1', validYears: 1 } }))).toThrow("DE's fees are in XXX, not a currency in use");
    for (const exchange of ['FR', [], ['XX'], ['FR', 'XX'], ['FR', 'FR'], ['DE'], [7]]) expect(() => compileLicence('DE', de({ exchange })), JSON.stringify(exchange)).toThrow('DE exchanges the licences of distinct other countries and regions on the map');
  });

  it('keeps a country whole or by its regions, never both, and a territory as the country whose licences it holds', () => {
    const us = compileLicence('US.NY', ny());
    expect(() => checkLicences({ 'US.NY': us, DE: compileLicence('DE', de()), AT: { issuedBy: 'DE' } })).not.toThrow();
    expect(() => checkLicences({ US: us, 'US.NY': us })).toThrow('US is kept whole and by its regions (US.NY)');
    expect(() => checkLicences({ AT: { issuedBy: 'DE' } })).toThrow("AT's licences are DE's, which the game doesn't keep in its own right");
  });

  it('reads only files the register cites, a region by its key', () => {
    const root = mkdtempSync(join(tmpdir(), 'licence-'));
    mkdirSync(join(root, 'research'), { recursive: true });
    const entries: unknown[] = [];
    const write = (key: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, SOURCES, `${key}.json`), text);
      entries.push({ fact: `papers.licence.${key}`, value: { file: `${SOURCES}/${key}.json`, sha256: createHash('sha256').update(text).digest('hex') } });
      writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    };
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    expect(readLicences(root)).toEqual({});
    mkdirSync(join(root, SOURCES), { recursive: true });
    write('US.NY', ny());
    write('DE', de());
    write('AT', { country: 'AT', issuedBy: 'DE' });
    expect(readLicences(root)).toStrictEqual({ AT: { issuedBy: 'DE' }, DE: compileLicence('DE', de()), 'US.NY': compileLicence('US.NY', ny()) });
    entries[2] = { ...(entries[2] as object), fact: 'papers.numbers.AT' };
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    // A citation by another engine's fact doesn't count.
    expect(() => readLicences(root)).toThrow(`${SOURCES}/AT.json isn't cited by the register`);
    write('AT', { country: 'AT', issuedBy: 'DE' });
    write('US', { ...ny(), region: undefined });
    expect(() => readLicences(root)).toThrow('US is kept whole and by its regions (US.NY)');
    write('US.NJ', { country: 'US', issuedBy: 'DE' });
    expect(() => readLicences(root)).toThrow('US.NJ is not a country on the map');
    write('PR', { country: 'PR', issuedBy: 'US', licence: {} });
    expect(() => readLicences(root)).toThrow("PR, whose licences are US's, has no term licence");
    expect(serialize({ AT: { issuedBy: 'DE' } })).toBe('{\n "AT": {\n  "issuedBy": "DE"\n }\n}\n');
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readLicences(ROOT)));
  });
});

describe('the licences coverage', () => {
  it('is researched where the country or every one of its regions is compiled and cited', () => {
    const facts = new Map([['papers.licence.DE', 'R-1'], ['papers.licence.US.NY', 'R-2'], ['papers.licence.US.NJ', 'R-3'], ['papers.licence.CA.08', 'R-4'], ['papers.licence.blocked.KP', 'R-5'], ['papers.licence.blocked.CA', 'R-6'], ['papers.licence.FR', 'R-7']]);
    const regions = ['US.NY', 'US.NJ', 'CA.08', 'CA.10', 'FR.11'];
    const rows = licenceCoverage(['DE', 'US', 'CA', 'KP', 'FR', 'AQ', 'LY'], new Set(['DE', 'US', 'CA', 'KP', 'FR', 'LY']), regions, new Set(['DE', 'US.NY', 'US.NJ', 'CA.08']), facts);
    expect(rows).toEqual([
      { key: 'DE', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'US', status: 'researched', register: ['R-2', 'R-3'], tests: TESTS },
      // Ontario read and Quebec not: blocked by the country's blocker, else pending.
      { key: 'CA', status: 'blocked', register: ['R-6'], tests: [...TESTS, TOLD] },
      { key: 'KP', status: 'blocked', register: ['R-5'], tests: [...TESTS, TOLD] },
      // Cited but not compiled: not researched.
      { key: 'FR', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // No file and no regions: pending.
      { key: 'LY', status: 'pending' },
    ]);
    expect(licenceCoverage(['CA'], new Set(['CA']), regions, new Set(['CA.08']), facts.set('papers.licence.blocked.CA', 'R-6'))[0]).toEqual({ key: 'CA', status: 'blocked', register: ['R-6'], tests: [...TESTS, TOLD] });
    expect(licenceCoverage(['CA'], new Set(['CA']), regions, new Set(['CA.08']), new Map())[0]).toEqual({ key: 'CA', status: 'pending' });
    expect(TESTS).toEqual(["tests/papers/licence/licence.test.ts::the licences > are each office's own", 'tests/papers/licence/licence.places.test.ts::the licences > for every place on the map']);
    expect(TOLD).toBe("tests/papers/licence/licence.test.ts::the licences > tell the player what the game doesn't know");
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/licence-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
    expect(JSON.parse(coverageOf(ROOT))).toMatchObject({ engine: 'papers.licence', axis: 'country' });
  });
});
