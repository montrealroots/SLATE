import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromMajor } from '../../src/core/money/money.ts';
import {
  BLOCKED,
  BOTH,
  compileCountry,
  compilePermit,
  ENGAGER,
  fee,
  fees,
  FIELDS,
  freeToAll,
  OUTPUT,
  PREMIUM,
  readPermits,
  RENEWAL,
  serialize,
  SOURCES,
  span,
  TERMS,
  UNITS,
  UNSAID,
  unknownOf,
  validity,
  whenAsked,
  WORK,
  WORKER,
  whoApplies,
  type Kept,
  type Permit,
} from '../../tools/papers/permits/compile.ts';
import { COVERAGE, coreKnown, coverageOf, FREE, permitsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/papers/permits/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const usd = (n: string) => fromMajor('USD', n);

const PERMIT = {
  applies: 'The employer applies.',
  fees: [{ what: 'Petition', amount: '1055.00', currency: 'USD' }],
  processing: { standard: { n: 3, unit: 'weeks' }, premium: null, note: 'prose' },
  validity: { n: 3, unit: 'years', renewable: true },
  union: 'A consultation.',
  eligibility: null,
  pay: null,
  exempt: null,
};
const COMPILED: Permit = {
  by: 'engager',
  fees: [{ what: 'Petition', money: usd('1055'), premium: false, when: 'grant' }],
  standard: { n: 3, unit: 'weeks' },
  premium: null,
  term: { n: 3, unit: 'years' },
  renews: true,
  union: 'A consultation.',
  eligibility: null,
  pay: null,
  unknown: [],
  renewal: null,
};

describe('the permits compile', () => {
  it('reads who applies as the party the research names first', () => {
    expect([SOURCES, OUTPUT, WORK, BLOCKED]).toEqual(['research/sources/papers/permits', 'src/person/permits/permits.json', 'src/papers/work/work.json', 'papers.permits.blocked.']);
    expect(whoApplies('The employer applies to the labour office.')).toBe('engager');
    expect(whoApplies('The worker or the hiring company applies.')).toBe('worker');
    expect(whoApplies('The employer (or the worker) applies.')).toBe('engager');
    expect(whoApplies('The performer applies, sponsored by an approved sponsor.')).toBe('worker');
    expect(whoApplies('the worker')).toBe('worker');
    expect(whoApplies('The Ministry decides it.')).toBeNull();
    expect(whoApplies('Online; the Code does not say whether by the employer or the worker.')).toBeNull();
    expect(whoApplies("The law doesn't say who; the employer pays.")).toBeNull();
    expect(whoApplies(null)).toBeNull();
    for (const v of ['', '  ', 7]) expect(() => whoApplies(v), String(v)).toThrow('is not words');
    for (const w of ['employer', 'employers', 'engager', 'employing body', 'engaging firm', 'hiring', 'organiser', 'organizer', 'organising company', 'organizing', 'promoter', 'producer', 'sponsor', 'petitioner', 'company', 'institution', 'entity', 'firm', 'hosting party', 'convener', 'referent']) expect(whoApplies(`The ${w} files.`), w).toBe('engager');
    for (const w of ['worker', 'performer', 'foreigner', 'foreign national', 'foreign citizen', 'artist', 'artiste', 'entertainer', 'applicant', 'person', 'alien', 'noncitizen', 'third-country national', 'employee', 'employed person', 'candidate']) expect(whoApplies(`The ${w} files.`), w).toBe('worker');
    expect([ENGAGER.flags, WORKER.flags, UNSAID.flags]).toEqual(['i', 'i', 'i']);
    expect([whoApplies('The EMPLOYER files.'), whoApplies('The PERFORMER files.'), whoApplies('It DOES NOT SAY, the employer.')]).toEqual(['engager', 'worker', null]);
    // Whole words: an "employment office" names no employer; "personal" no person.
    expect([whoApplies('The employment office decides.'), whoApplies('A personal application.'), whoApplies('Asponsors.')]).toEqual([null, null, null]);
  });

  it('reads a fee to Money, its service and the grants it is asked at', () => {
    expect(fee({ what: 'Petition', amount: '1055.00', currency: 'USD' })).toStrictEqual({ what: 'Petition', money: usd('1055'), premium: false, when: 'grant' });
    expect(fee({ what: 'Permit', amount: '100000.00', currency: 'RWF' }).money).toStrictEqual(fromMajor('RWF', '100000'));
    expect(fee({ what: 'Permit', amount: 100, currency: 'USD' }).money).toStrictEqual(usd('100'));
    expect(fee({ what: 'Premium processing (optional)', amount: '2965', currency: 'USD', note: 'x' }).premium).toBe(true);
    for (const w of ['Priority visa service', 'Express fee', 'expedited', 'Urgent processing', 'Fast Track 7 days', 'Fast-track', 'Fasttrack', 'Optional immediate processing', 'a decision within 15 working days', 'within 2 business days']) expect(PREMIUM.test(w), w).toBe(true);
    for (const w of ['Standard (30 calendar days)', 'within days', 'Visa fee']) expect(PREMIUM.test(w), w).toBe(false);
    expect([whenAsked('Renewal of a work permit'), whenAsked('Extension of the permit'), whenAsked('to extend it'), whenAsked('Extended permit (jatkolupa)'), whenAsked('Permit')]).toEqual(['renewal', 'renewal', 'renewal', 'renewal', 'grant']);
    for (const w of ['Application or renewal fee', 'an application and its extension', 'first application and extension', 'grant or renewal', 'Renewal or replacement', 'extension or change', 'Fee (also renewals)', 'each permit issued or renewed', 'the visa or the renewal', 'a visa or a renewal']) expect(whenAsked(w), w).toBe('both');
    expect([RENEWAL.flags, BOTH.flags, PREMIUM.flags]).toEqual(['i', 'i', 'i']);
    expect([whenAsked('RENEWAL'), whenAsked('APPLICATION OR RENEWAL')]).toEqual(['renewal', 'both']);
    expect(() => fee({ what: 'P', amount: '500 / 700', currency: 'USD' })).toThrow('"500 / 700" is not an amount');
    expect(() => fee({ what: 'P', amount: '96.00 / 93.00', currency: 'EUR' })).toThrow('"96.00 / 93.00" is not an amount');
    expect(() => fee({ what: 'P', amount: '-5', currency: 'USD' })).toThrow('"-5" is not an amount');
    expect(() => fee({ what: 'P', amount: '5.', currency: 'USD' })).toThrow('"5." is not an amount');
    expect(() => fee({ what: 'P', amount: '5.001', currency: 'USD' })).toThrow('USD has 2 decimal places');
    expect(() => fee({ what: 'P', amount: '5', currency: 'BRV' })).toThrow("is in BRV, which isn't a currency of ISO 4217's list");
    expect(() => fee({ what: 'P', amount: '5', currency: 'USD', ceiling: true })).toThrow("names ceiling, which the game doesn't read");
    // A ceiling the law sets, its name saying so.
    expect(fee({ what: 'Up to', amount: '95', currency: 'CHF', maximum: true }).money).toStrictEqual(fromMajor('CHF', '95'));
    for (const m of [false, 'yes', null]) expect(() => fee({ what: 'P', amount: '5', currency: 'USD', maximum: m }), String(m)).toThrow(`says maximum ${String(m)}, not true`);
    // An index unit's fee: the units at the unit's value, to the minor unit half to even.
    expect(fee({ what: 'Five base units', amount: '225.00', currency: 'BYN', units: '5', unitValue: '45' }).money).toStrictEqual(fromMajor('BYN', '225'));
    expect(fee({ what: 'UI', amount: '3579.93', currency: 'UYU', units: '557.30', unitValue: '6.4237' }).money).toStrictEqual(fromMajor('UYU', '3579.93'));
    expect(fee({ what: 'UI', amount: '357.80', currency: 'UYU', units: '55.70', unitValue: '6.4237' }).money).toStrictEqual(fromMajor('UYU', '357.8'));
    // 0.125 x 1 is 0.12 half to even, not 0.13.
    expect(fee({ what: 'Half', amount: '0.12', currency: 'USD', units: '0.125', unitValue: '1' }).money).toStrictEqual(fromMajor('USD', '0.12'));
    expect(() => fee({ what: 'Half', amount: '0.13', currency: 'USD', units: '0.125', unitValue: '1' })).toThrow('is 0.13, not 0.125 units of 1');
    expect(() => fee({ what: 'UI', amount: '3579.92', currency: 'UYU', units: '557.30', unitValue: '6.4237' })).toThrow('is 3579.92, not 557.30 units of 6.4237');
    expect(() => fee({ what: 'Yen', amount: '4680', currency: 'JPY', units: '60', unitValue: '78.01' })).toThrow('is 4680, not 60 units of 78.01');
    expect(fee({ what: 'Whole', amount: '4680.00', currency: 'TJS', units: '60', unitValue: '78' }).money).toStrictEqual(fromMajor('TJS', '4680'));
    for (const [units, value] of [['5', undefined], [undefined, '45'], ['5 x', '45'], ['5', '-45'], ['5', '45.']]) {
      const given = { what: 'P', amount: '225', currency: 'BYN', ...(units === undefined ? {} : { units }), ...(value === undefined ? {} : { unitValue: value }) };
      expect(() => fee(given), `${String(units)} ${String(value)}`).toThrow(`gives ${String(units)} units of ${String(value)}, not two amounts`);
    }
    // The amount compared as written: decimals that aren't zeros are kept; a whole amount's zero decimals dropped.
    expect(fee({ what: 'P', amount: '100.05', currency: 'USD', units: '1', unitValue: '100.05' }).money).toStrictEqual(fromMajor('USD', '100.05'));
    expect(fee({ what: 'P', amount: '100000.00', currency: 'RWF', units: '1', unitValue: '100000' }).money).toStrictEqual(fromMajor('RWF', '100000'));
    expect(() => fee({ what: null, amount: '5', currency: 'USD' })).toThrow('names no fee');
    expect(() => fee('x')).toThrow('is not an object');
    expect(() => fee(null)).toThrow('is not an object');
    expect(() => fee([])).toThrow('is not an object');
    expect(fees(null)).toBeNull();
    expect(fees([])).toStrictEqual([]);
    expect(() => fees({})).toThrow('is not a list');
    expect(() => fees([{ what: 'P', amount: '5', currency: 'USD' }, 'x'])).toThrow('fee 1 is not an object');
    // A fee by a formula on the worker's pay can't be reckoned: the fees aren't known.
    expect(fees([{ what: 'P', amount: '5', currency: 'USD' }, { what: 'Two months', amount: null, currency: 'XAF', formula: {} }])).toBeNull();
    expect(() => fees([null])).toThrow('fee 0 is not an object');
    expect(() => fees(['x'])).toThrow(expect.objectContaining({ cause: new Error('is not an object') }));
  });

  it('reads a span of time, and the term with whether it renews', () => {
    expect(UNITS).toEqual(['hours', 'days', 'business-days', 'weeks', 'months', 'years']);
    expect(TERMS).toEqual(['days', 'weeks', 'months', 'years']);
    expect(span({ n: 15, unit: 'business-days' }, UNITS)).toStrictEqual({ n: 15, unit: 'business-days' });
    expect(span({ n: 1, unit: 'hours', note: 'x' }, UNITS)).toStrictEqual({ n: 1, unit: 'hours' });
    expect([span(null, UNITS), span(undefined, UNITS)]).toEqual([null, null]);
    expect(() => span({ n: 1, unit: 'hours' }, TERMS)).toThrow('is in hours, not days, weeks, months, years');
    for (const n of [0, -1, 1.5, '3', null]) expect(() => span({ n, unit: 'days' }, UNITS), String(n)).toThrow(`is ${String(n)}, not a whole number above 0`);
    expect(() => span({ n: 1, unit: 'days', maximum: 2 }, UNITS)).toThrow("names maximum, which the game doesn't read");
    expect(() => span(7, UNITS)).toThrow('is not an object');
    expect(validity({ n: 12, unit: 'months', renewable: true })).toStrictEqual({ term: { n: 12, unit: 'months' }, renews: true, renewal: null });
    expect(validity({ n: null, unit: null, renewable: false, note: 'x' })).toStrictEqual({ term: null, renews: false, renewal: null });
    expect(validity({ n: null, unit: null, renewable: null })).toStrictEqual({ term: null, renews: null, renewal: null });
    expect(validity(null)).toStrictEqual({ term: null, renews: null, renewal: null });
    // The engagement's own term; a renewal's term apart from the first grant's.
    expect(validity({ n: null, unit: 'engagement', renewable: true, note: 'x' })).toStrictEqual({ term: 'engagement', renews: true, renewal: null });
    expect(validity({ n: null, unit: null, renewable: true, renewal: { n: 4, unit: 'years' } })).toStrictEqual({ term: null, renews: true, renewal: { n: 4, unit: 'years' } });
    expect(() => validity({ n: 3, unit: 'engagement', renewable: true })).toThrow('is in engagement, not days, weeks, months, years');
    expect(() => validity({ n: null, unit: 'contract', renewable: true })).toThrow('is in contract, not days, weeks, months, years');
    expect(() => validity({ n: 1, unit: 'years', renewable: true, renewal: { n: 1, unit: 'hours' } })).toThrow('is in hours, not days, weeks, months, years');
    expect(() => validity({ n: 3, unit: null, renewable: true })).toThrow('is in null');
    expect(() => validity({ n: 3, unit: 'years', renewable: 'yes' })).toThrow('says it renews yes, not true, false or null');
    expect(() => validity({ n: 3, unit: 'years' })).toThrow('says it renews undefined');
    expect(() => validity({ n: 3, unit: 'years', renewable: true, maximum: 'none' })).toThrow("names maximum, which the game doesn't read");
  });

  it("names the facts the research couldn't find, each once", () => {
    expect(FIELDS).toEqual(['route', 'applies', 'first', 'fees', 'processing', 'validity', 'union', 'eligibility', 'pay', 'exempt', 'country', 'all']);
    expect(unknownOf([{ field: 'pay' }, { field: 'validity.renewable' }, { field: 'validity' }, { field: 'exempt.within' }])).toEqual(['pay', 'validity', 'exempt']);
    expect(unknownOf([])).toEqual([]);
    expect(() => unknownOf({})).toThrow('is not a list');
    expect(() => unknownOf([{ field: 'colour' }])).toThrow("name colour, which isn't a fact the research seeks");
    expect(() => unknownOf(['x'])).toThrow('is not an object');
  });

  it('takes a permit to its fields, each unread one null and named', () => {
    const unread: string[] = [];
    expect(compilePermit('US', PERMIT, [], unread)).toStrictEqual(COMPILED);
    expect(unread).toEqual([]);
    const bad = { ...PERMIT, applies: 7, fees: [{ what: 'P', amount: '1 / 2', currency: 'USD' }], processing: { standard: { n: 0, unit: 'days' }, premium: { n: 1, unit: 'eons' } }, validity: { n: 1, unit: 'contract', renewable: true }, union: '', eligibility: 3, pay: [] };
    expect(compilePermit('XX', bad, [{ field: 'nothing' }], unread)).toStrictEqual({ by: null, fees: null, standard: null, premium: null, term: null, renews: null, union: null, eligibility: null, pay: null, unknown: [...FIELDS], renewal: null });
    expect(unread).toEqual([
      "XX's validity is in contract, not days, weeks, months, years",
      "XX's applies is not words",
      'XX\'s fees fee 0 "1 / 2" is not an amount',
      "XX's standard processing is 0, not a whole number above 0",
      "XX's premium processing is in eons, not hours, days, business-days, weeks, months, years",
      "XX's union is not words",
      "XX's eligibility is not words",
      "XX's pay is not words",
      "XX's blockers name nothing, which isn't a fact the research seeks",
    ]);
    const more: string[] = [];
    expect(compilePermit('XX', { ...PERMIT, processing: null }, [{ field: 'processing' }], more)).toMatchObject({ standard: null, premium: null, unknown: ['processing'] });
    expect(compilePermit('XX', { ...PERMIT, processing: 'x' }, [], more)).toMatchObject({ standard: null, premium: null });
    expect(compilePermit('XX', { ...PERMIT, processing: { standard: null, fast: 1 } }, [], more)).toMatchObject({ standard: null, premium: null });
    expect(more).toEqual(["XX's processing is not an object", "XX's processing names fast, which the game doesn't read"]);
  });

  it("takes a country to its permit where papers.work says a passport needs one", () => {
    const permit: Kept = { passports: { IE: { right: 'free' } }, others: { right: 'permit' } };
    const free: Kept = { passports: { DE: { right: 'free' } }, others: { right: 'free' } };
    const work = { GB: permit, AM: free, SI: { passports: { XK: { right: 'permit' } }, others: { right: 'free' } } };
    expect([freeToAll(permit), freeToAll(free), freeToAll(work.SI)]).toEqual([false, true, false]);
    const unread: string[] = [];
    expect(compileCountry('GB', { country: 'GB', permit: PERMIT, blockers: [] }, work, unread)).toStrictEqual(COMPILED);
    expect(compileCountry('SI', { country: 'SI', permit: PERMIT, blockers: [] }, work, unread)).toStrictEqual(COMPILED);
    expect(compileCountry('AM', { country: 'AM', permit: null, blockers: [] }, work, unread)).toBeUndefined();
    expect(compileCountry('AF', { country: 'AF', permit: PERMIT, blockers: [] }, work, unread)).toBeUndefined();
    expect(unread).toEqual(['AF has no permit compiled: papers.work keeps no rules for it, so nothing says who needs one']);
    expect(() => compileCountry('XX', { country: 'XX' }, work, unread)).toThrow('XX is not a country on the map');
    expect(() => compileCountry('GB', { country: 'FR' }, work, unread)).toThrow("GB's file is for FR");
    for (const p of [null, undefined, 'x']) expect(() => compileCountry('GB', { country: 'GB', permit: p }, work, unread), String(p)).toThrow("GB's file holds no permit, though papers.work says a passport needs one there");
  });

  it('reads only files the register cites, as cited, and skips one blocked whole', () => {
    const root = mkdtempSync(join(tmpdir(), 'permits-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    mkdirSync(join(root, 'research'), { recursive: true });
    mkdirSync(join(root, 'src/papers/work'), { recursive: true });
    const permit = { passports: {}, others: { right: 'permit' } };
    writeFileSync(join(root, WORK), JSON.stringify({ countries: { GB: permit, US: permit, IL: permit, AM: { passports: {}, others: { right: 'free' } } } }));
    const write = (code: string, body: unknown) => {
      const text = JSON.stringify(body);
      writeFileSync(join(root, SOURCES, `${code}.json`), text);
      return createHash('sha256').update(text).digest('hex');
    };
    const register = (entries: unknown[]) => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    const cite = (code: string, sha256: string) => ({ fact: `papers.permits.${code}`, value: { file: `${SOURCES}/${code}.json`, sha256 } });
    // Written out of order: the files are read in the order of their names.
    const us = write('US', { country: 'US', permit: PERMIT, blockers: [{ field: 'pay' }] });
    const gb = write('GB', { country: 'GB', permit: PERMIT, blockers: [] });
    const am = write('AM', { country: 'AM', permit: null, blockers: [] });
    write('IL', { country: 'IL', permit: null, blockers: [{ field: 'all' }] });
    writeFileSync(join(root, SOURCES, 'notes.txt'), 'not a file');
    const all = [cite('US', us), cite('GB', gb), cite('AM', am), { fact: 'papers.permits.blocked.IL' }, { fact: 'papers.permits.blocked.US' }, { fact: 'papers.work.US', value: { file: `${SOURCES}/US.json`, sha256: 'other' } }];
    register(all);
    const read = readPermits(root);
    expect(Object.keys(read.countries)).toEqual(['GB', 'US']);
    expect(read).toStrictEqual({ countries: { GB: COMPILED, US: { ...COMPILED, unknown: ['pay'] } }, unread: [] });
    // Only a blocker of the permits stands for a file: another fact of the same length doesn't.
    register([...all.filter((e) => e.fact !== 'papers.permits.blocked.IL'), { fact: 'papers.visits.blockedx.IL' }]);
    expect(() => readPermits(root)).toThrow(`${SOURCES}/IL.json isn't cited by the register`);
    register([cite('US', us.replace(/^./, (c) => (c === '0' ? '1' : '0'))), ...all.slice(1)]);
    expect(() => readPermits(root)).toThrow(`${SOURCES}/US.json isn't the file the register cites`);
    expect(serialize({ GB: COMPILED })).toBe(`${JSON.stringify({ countries: { GB: COMPILED } }, null, 1)}\n`);
  });

  it('reads no permits where the research has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'permits-'));
    mkdirSync(join(root, 'research'), { recursive: true });
    mkdirSync(join(root, 'src/papers/work'), { recursive: true });
    writeFileSync(join(root, WORK), JSON.stringify({ countries: {} }));
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [] }));
    expect(readPermits(root)).toStrictEqual({ countries: {}, unread: [] });
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readPermits(ROOT).countries));
  });
});

describe('the permits coverage', () => {
  it('is proven where every passport is free, blocked where the register holds a blocker, researched where the core is read and cited', () => {
    const facts = new Map([
      ['papers.permits.GB', 'R-1'],
      ['papers.permits.US', 'R-2'],
      ['papers.permits.blocked.US', 'R-3'],
      ['papers.permits.blocked.IL', 'R-4'],
      ['papers.work.AM', 'R-5'],
      ['papers.permits.AM', 'R-6'],
      ['papers.work.SI', 'R-7'],
      ['papers.permits.blocked.SI', 'R-8'],
      ['papers.permits.DE', 'R-9'],
      ['papers.permits.blocked.UA', 'R-10'],
    ]);
    const rows = permitsCoverage(['GB', 'US', 'IL', 'AM', 'SI', 'DE', 'AQ', 'FR', 'UA'], new Set(['GB', 'US', 'IL', 'AM', 'SI', 'DE', 'FR', 'UA']), new Set(['AM', 'SI', 'UA']), new Set(['GB', 'US', 'FR']), facts);
    expect(rows).toEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'US', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'IL', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'AM', status: 'proven', register: ['R-5', 'R-6'], tests: [FREE] },
      { key: 'SI', status: 'proven', register: ['R-7', 'R-8'], tests: [FREE] },
      // Its core not read: pending.
      { key: 'DE', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
      // Its core read but not cited: pending.
      { key: 'FR', status: 'pending' },
      // Free by papers.work, which doesn't cite it: blocked on its own blocker.
      { key: 'UA', status: 'blocked', register: ['R-10'], tests: [...TESTS, TOLD] },
    ]);
    expect(TESTS).toEqual(["tests/person/permits/permits.test.ts::the permits > are each country's own, as the research gives them", 'tests/person/permits/permits.places.test.ts::the permits > for every place on the map']);
    expect(TOLD).toBe("tests/person/permits/permits.test.ts::the permits > are held only where papers.work says a passport needs one, and where one isn't known whole the player is told what isn't");
    expect(FREE).toBe('tests/person/permits/permits.test.ts::working in a country > is open by citizenship, by a permit in force on the day, or within the days a short engagement is worked without one');
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'papers.permits', axis: 'country', rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('reads the core of a permit: who applies, the fees, a processing time, the term', () => {
    expect(coreKnown(COMPILED)).toBe(true);
    expect(coreKnown({ ...COMPILED, standard: null, premium: { n: 1, unit: 'days' } })).toBe(true);
    for (const over of [{ by: null }, { fees: null }, { standard: null }, { term: null }]) expect(coreKnown({ ...COMPILED, ...over }), JSON.stringify(over)).toBe(false);
    expect(coreKnown({ ...COMPILED, fees: [] })).toBe(true);
  });

  it('is built from the compiled permits, papers.work, the gazetteer and the register', () => {
    const root = mkdtempSync(join(tmpdir(), 'permits-cov-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(body));
    };
    put('src/world/gazetteer/countries.json', { GB: {}, AM: {}, AQ: {}, IL: {} });
    mkdirSync(join(root, 'src/world/gazetteer/places'), { recursive: true });
    for (const c of ['GB', 'AM', 'IL']) writeFileSync(join(root, 'src/world/gazetteer/places', `${c}.tsv`), '');
    put('src/papers/work/work.json', { countries: { GB: { passports: {}, others: { right: 'permit' } }, AM: { passports: {}, others: { right: 'free' } }, IL: { passports: {}, others: { right: 'permit' } } } });
    put(OUTPUT, { countries: { GB: COMPILED, IL: { ...COMPILED, term: null } } });
    put('research/register.json', { entries: [{ id: 'R-1', fact: 'papers.permits.GB' }, { id: 'R-2', fact: 'papers.work.AM' }, { id: 'R-3', fact: 'papers.permits.IL' }, { id: 'R-4', fact: 'papers.work.GB' }] });
    expect(COVERAGE).toBe('coverage/permits-countries.json');
    expect(coverageOf(root)).toBe(
      serializeCoverage([
        { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
        { key: 'AM', status: 'proven', register: ['R-2'], tests: [FREE] },
        { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
        { key: 'IL', status: 'pending' },
      ]),
    );
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/permits-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
