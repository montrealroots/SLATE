import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLicences, compileLicence, feeOf, OUTPUT, readLicences, serialize, SOURCES } from '../../tools/papers/licence/compile.ts';
import { compileIssued } from '../../tools/papers/numbers/compile.ts';
import regions from '../../src/world/gazetteer/regions.json' with { type: 'json' };
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
    // The ages, in order, at the first of which the holder reaches it ends.
    expect(my({ untilAge: [40, 50, 60, 65, 70] })?.untilAge).toStrictEqual([40, 50, 60, 65, 70]);
    for (const untilAge of [[], [40, 40], [50, 40], [18, 30], [30, 40.5], [30, '40']])
      expect(() => my({ untilAge }), JSON.stringify(untilAge)).toThrow("DE's licence ends at a whole age above the one it's issued from, or at ages in order above it");
    expect(my({ untilAge: [19] })?.untilAge).toStrictEqual([19]);
    // Terms the holder chooses among, each with its fee, shortest first, for life last; its own years and fee null.
    const terms = [{ years: 1, fee: '70' }, { years: 5, fee: { count: '2', unit: 'UMA' } }, { forLife: true, fee: '280' }];
    const chosen = (over: Record<string, unknown>) => compileLicence('MX.09', { country: 'MX', region: 'MX.09', issuer: 'i', licence: { name: 'x', from: 18, fee: null, validYears: null, ...over } }).licence;
    expect(chosen({ terms })?.terms).toStrictEqual([{ years: 1, fee: { currency: 'MXN', minor: 7000 } }, { years: 5, fee: { count: '2', unit: 'UMA' } }, { forLife: true, fee: { currency: 'MXN', minor: 28_000 } }]);
    for (const over of [{ terms: [terms[0]] }, { terms: 'x' }, { terms, fee: '1' }, { terms, validYears: 3 }])
      expect(() => chosen(over), JSON.stringify(over)).toThrow("MX.09's licence gives two or more terms to choose among, each with its fee, its own years and fee then null");
    expect(() => chosen({ terms: [terms[0], 'x'] })).toThrow("MX.09's licence's term 1 is not an object");
    expect(() => chosen({ terms: [terms[0], { years: 2, fee: '1', label: 'x' }] })).toThrow("MX.09's licence's term 1 has no term label");
    for (const fee of [null, undefined]) expect(() => chosen({ terms: [terms[0], { years: 2, fee }] }), String(fee)).toThrow("MX.09's licence's term 1 gives its fee");
    expect(() => chosen({ terms: [terms[0], { years: 2, fee: 'x' }] })).toThrow("MX.09's licence's term 1's fee is an amount written out in major units");
    for (const t of [{ forLife: true, years: 2, fee: '1' }, { forLife: 'yes', fee: '1' }]) expect(() => chosen({ terms: [terms[0], t] }), JSON.stringify(t)).toThrow("MX.09's licence's term 1 lasts for life only as forLife: true, with no years");
    expect(() => chosen({ terms: [{ forLife: true, fee: '1' }, terms[0]] })).toThrow("MX.09's licence's terms are in order of the ages they're sold to, then shortest first");
    for (const years of [0, 1.5, '2', undefined]) expect(() => chosen({ terms: [terms[0], { years, fee: '1' }] }), String(years)).toThrow("MX.09's licence's term 1 lasts a whole number of years, for life, or to an age");
    for (const later of [{ years: 1, fee: '1' }, { years: 3, fee: '1' }]) expect(() => chosen({ terms: [{ years: 3, fee: '1' }, later] }), JSON.stringify(later)).toThrow("MX.09's licence's terms are in order of the ages they're sold to, then shortest first");
    expect(chosen({ terms: [{ years: 2, fee: '1' }, { years: 3, fee: '2' }] })?.terms?.length).toBe(2);
    // Terms sold to some ages only: Argentina's by age (five years to 17-65, three to 66-70), New South Wales's ten years to 21-44.
    expect(chosen({ terms: [{ years: 5, fee: '1', from: 17, under: 66 }, { years: 3, fee: '1', from: 66, under: 71 }] })?.terms).toStrictEqual([
      { years: 5, fee: { currency: 'MXN', minor: 100 }, from: 17, under: 66 },
      { years: 3, fee: { currency: 'MXN', minor: 100 }, from: 66, under: 71 },
    ]);
    expect(chosen({ terms: [{ years: 5, fee: '1' }, { years: 10, fee: '2', from: 21, under: 45 }] })?.terms?.[1]).toStrictEqual({ years: 10, fee: { currency: 'MXN', minor: 200 }, from: 21, under: 45 });
    expect(chosen({ terms: [{ years: 5, fee: '1', under: 66 }, { forLife: true, fee: '2', from: 0 }] })?.terms?.[1]).toStrictEqual({ forLife: true, fee: { currency: 'MXN', minor: 200 }, from: 0 });
    expect(chosen({ terms: [{ years: 5, fee: '1', from: 17 }, { years: 3, fee: '1', from: 66 }, { forLife: true, fee: '1', from: 66 }] })?.terms?.length).toBe(3);
    expect(() => chosen({ terms: [{ years: 3, fee: '1', from: 66 }, { years: 5, fee: '1', from: 17 }] })).toThrow("MX.09's licence's terms are in order of the ages they're sold to, then shortest first");
    expect(() => chosen({ terms: [{ years: 5, fee: '1', from: 17 }, { forLife: true, fee: '1', from: 17 }, { years: 6, fee: '1', from: 17 }] })).toThrow('terms are in order');
    for (const from of [-1, 1.5, '17']) expect(() => chosen({ terms: [terms[0], { years: 2, fee: '1', from }] }), String(from)).toThrow("MX.09's licence's term 1 is sold from a whole age");
    for (const [from, under] of [[17, 17], [17, 10], [undefined, 0], [0, 0.5]] as const)
      expect(() => chosen({ terms: [terms[0], { years: 2, fee: '1', from, under }] }), `${String(from)} ${String(under)}`).toThrow("MX.09's licence's term 1 is sold under a whole age above the one it's sold from");
    expect(chosen({ terms: [terms[0], { years: 2, fee: '1', under: 1 }] })?.terms?.[1]?.under).toBe(1);
    // A term's own non-citizen fee (Cayman's).
    expect(chosen({ terms: [{ years: 1, fee: '25', foreignFee: '75' }, terms[1]] })?.terms?.[0]).toStrictEqual({ years: 1, fee: { currency: 'MXN', minor: 2500 }, foreignFee: { currency: 'MXN', minor: 7500 } });
    expect(() => chosen({ terms: [{ years: 1, fee: '25', foreignFee: 'x' }, terms[1]] })).toThrow("MX.09's licence's term 0's foreign fee is an amount written out in major units");
    // A term sold to citizens or foreigners alone (Tamaulipas's permanent licence, Chiapas's year for foreigners).
    expect(chosen({ terms: [terms[0], { forLife: true, fee: '1', for: 'citizens' }] })?.terms?.[1]).toStrictEqual({ forLife: true, fee: { currency: 'MXN', minor: 100 }, for: 'citizens' });
    expect(chosen({ terms: [{ years: 1, fee: '1', for: 'foreigners' }, terms[1]] })?.terms?.[0]?.for).toBe('foreigners');
    // A term to an age (Arizona's to 65, its fee by the holder's age).
    expect(chosen({ terms: [{ untilAge: 65, fee: '25', under: 40 }, { untilAge: 65, fee: '10', from: 50 }] })?.terms).toStrictEqual([
      { untilAge: 65, fee: { currency: 'MXN', minor: 2500 }, under: 40 },
      { untilAge: 65, fee: { currency: 'MXN', minor: 1000 }, from: 50 },
    ]);
    for (const t of [{ untilAge: 50, fee: '1', from: 50 }, { untilAge: 0, fee: '1' }, { untilAge: 65.5, fee: '1' }, { untilAge: 65, years: 5, fee: '1' }, { untilAge: 65, forLife: true, fee: '1' }])
      expect(() => chosen({ terms: [terms[0], t] }), JSON.stringify(t)).toThrow("MX.09's licence's term 1 lasts to a whole age above the ones it's sold to, with no years and not for life");
    expect(() => chosen({ terms: [terms[0], { untilAge: 65, fee: '1', perYear: true }] })).toThrow("MX.09's licence's term 1's fee is by the year only as perYear: true, for a term of years");
    // A term's fee by the year (Iowa's $4 a year); never for a term for life.
    expect(chosen({ terms: [{ years: 2, fee: '4', perYear: true }, { years: 8, fee: '4', perYear: true }] })?.terms?.[1]).toStrictEqual({ years: 8, fee: { currency: 'MXN', minor: 400 }, perYear: true });
    for (const t of [{ years: 2, fee: '4', perYear: false }, { years: 2, fee: '4', perYear: 'yes' }, { forLife: true, fee: '4', perYear: true }])
      expect(() => chosen({ terms: [terms[0], t] }), JSON.stringify(t)).toThrow("MX.09's licence's term 1's fee is by the year only as perYear: true, for a term of years");
    for (const who of ['residents', true]) expect(() => chosen({ terms: [terms[0], { years: 2, fee: '1', for: who }] }), String(who)).toThrow("MX.09's licence's term 1 is sold to citizens or foreigners alone, or to anyone");
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
    // A territory may hold a region's licences where that country keeps them by region; never its own country's region.
    expect(compileIssued('CX', { country: 'CX', issuedBy: 'AU.08' }, 'licences', regions)).toStrictEqual({ issuedBy: 'AU.08' });
    expect(compileIssued('CX', { country: 'CX', issuedBy: 'AU' }, 'licences', regions)).toStrictEqual({ issuedBy: 'AU' });
    for (const issuedBy of ['AU.99', 'CX', 'XX'])
      expect(() => compileIssued('CX', { country: 'CX', issuedBy }, 'licences', regions), issuedBy).toThrow(`CX's licences are given by another country or region on the map, not ${issuedBy}`);
    expect(() => compileIssued('AU', { country: 'AU', issuedBy: 'AU.08' }, 'licences', regions)).toThrow("AU's licences are given by another country or region on the map, not AU.08");
    // Without regions (the numbers, the permits), a region isn't an issuer.
    expect(() => compileIssued('CX', { country: 'CX', issuedBy: 'AU.08' }, 'numbers')).toThrow("CX's numbers are given by another country on the map, not AU.08");
    const wa = compileLicence('AU.08', { country: 'AU', region: 'AU.08', issuer: 'i', licence: { name: 'x', from: 19, fee: null, validYears: 5 } });
    expect(() => checkLicences({ 'AU.08': wa, CX: { issuedBy: 'AU.08' } })).not.toThrow();
    expect(() => checkLicences({ CX: { issuedBy: 'AU.08' } })).toThrow("CX's licences are AU.08's, which the game doesn't keep in its own right");
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
