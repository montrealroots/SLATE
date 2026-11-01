import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  agreementOf,
  apart,
  at,
  BLOCKED,
  checkAgreement,
  dated,
  FACT,
  figureOf,
  ITEMS,
  KEPT,
  LANGUAGES,
  MEDIA,
  marketOf,
  minimumOf,
  OUTPUT,
  range,
  READINGS,
  readMarkets,
  readResearch,
  serialize,
  SOURCES,
  TERMS,
  TIERS,
  unknownOf,
  ZONES,
  type Minimum,
  type Research,
} from '../../tools/person/markets/compile.ts';
import { COVERAGE, coverageOf, marketsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/person/markets/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const RESEARCH: Research = {
  country: 'XX',
  figures: [
    { item: 'agreements', value: { name: 'The Accord' } },
    { item: 'rates', value: { unit: 'EUR', from: '2026-01-01', day: { lead: 100.5, other: 80 }, since: '2025-04', zero: 0, text: '12', nested: { text: 'x' }, note: 'x2026-01-01x' } },
    { item: 'none', value: { minimum: null } },
    { item: 'language', value: { code: 'fr-CA' } },
    { item: 'market', value: { city: 'Paris', tz: 'Europe/Paris' } },
    { item: 'language', value: { language: 'French' } },
    { item: 'market', value: { city: 'Paris' } },
  ],
  blockers: [{ item: 'rates' }, { item: 'union' }, { item: 'rates' }],
};
const NAMES = { fr: 'French', en: 'English' };
const ZONE_SET = new Set(['Europe/Paris', 'Europe/Berlin']);
const read = (m: Record<string, unknown>) => minimumOf(RESEARCH, { medium: 'film', per: 'day', from: '2026-01-01', fig: 1, path: ['day', 'lead'], ...m }, 'EUR', ['film', 'stage']);
const min = (over: Partial<Minimum> = {}): Minimum => ({ medium: 'film', role: null, per: 'day', rehearsal: false, with: null, when: {}, from: '2026-01-01', amount: '1', ...over });

describe('the markets compile', () => {
  it('reads a figure, a place in it and a tier', () => {
    expect([SOURCES, READINGS, OUTPUT, LANGUAGES, ZONES, FACT, BLOCKED]).toEqual(['research/sources/person/markets', 'tools/person/markets/readings.json', 'src/person/acting/markets.json', 'src/person/identity/languages.json', 'src/core/time/tzdb.json', 'person.markets.', 'person.markets.blocked.']);
    expect([KEPT, MEDIA, TERMS, TIERS, ITEMS]).toEqual([
      ['sag-aftra', 'pact-equity', 'uk-theatre', 'actra'],
      ['film', 'television', 'stage'],
      ['day', 'week', 'month', 'year', 'session', 'performance', 'episode'],
      ['budget', 'lines', 'seats', 'minutes', 'length', 'years', 'nth'],
      ['agreements', 'rates', 'none', 'union', 'language', 'market'],
    ]);
    expect(figureOf(RESEARCH, 1, ['rates'])).toBe(RESEARCH.figures[1]);
    expect(figureOf(RESEARCH, 0, ['rates', 'agreements'])).toBe(RESEARCH.figures[0]);
    for (const fig of [0, 9, '1', null]) expect(() => figureOf(RESEARCH, fig, ['rates']), String(fig)).toThrow(`XX's figure ${String(fig)} isn't one of its rates`);
    expect(() => figureOf(RESEARCH, 0, ['rates', 'none'])).toThrow("XX's figure 0 isn't one of its rates or none");
    expect(at({ a: [{ b: 7 }] }, ['a', 0, 'b'])).toBe(7);
    expect(at({ a: 1 }, [])).toEqual({ a: 1 });
    for (const path of [['b'], ['a', 'c'], ['a', 'x', 'y']]) expect(() => at({ a: { x: null } }, path), path.join()).toThrow(`has nothing at ${path.join('.')}`);
    expect(() => at({ a: 'text' }, ['a', 'length'])).toThrow('has nothing at a.length');
    expect(range([0, null])).toEqual([0, null]);
    expect(range([3, 3])).toEqual([3, 3]);
    expect(() => range([1])).toThrow('a tier is a pair');
    expect(() => range('1-2')).toThrow('a tier is a pair');
    for (const v of [[-1, 2], [1.5, 2], [2, 1], [1, 2.5], ['1', 2], [1, '2']]) expect(() => range(v), JSON.stringify(v)).toThrow(`a tier runs from a whole number to a greater one or none (${JSON.stringify(v)})`);
  });

  it('dates a minimum where its figure writes the date, or its month for the first', () => {
    expect(dated('{"from":"2026-01-01"}', '2026-01-01')).toBe(true);
    expect(dated('{"since":"2025-04"}', '2025-04-01')).toBe(true);
    expect(dated('{"since":"2025-04"}', '2025-04-02')).toBe(false);
    expect(dated('{"since":"2025-04-30"}', '2025-04-01')).toBe(false);
    expect(dated('{"from":"2026-01-01"}', '2026-02-01')).toBe(false);
  });

  it('reads a minimum at its place in the research, its date and currency standing in the figure', () => {
    expect(read({})).toEqual({ medium: 'film', role: null, per: 'day', rehearsal: false, with: null, when: {}, from: '2026-01-01', amount: '100.5' });
    expect(read({ role: 'lead', rehearsal: true, with: ['performance'], when: { nth: [1, 5], years: [0, null] }, path: ['day', 'other'], from: '2025-04-01', per: 'performance', medium: 'stage' })).toEqual({ medium: 'stage', role: 'lead', per: 'performance', rehearsal: true, with: ['performance'], when: { nth: [1, 5], years: [0, null] }, from: '2025-04-01', amount: '80' });
    expect(read({ rehearsal: false }).rehearsal).toBe(false);
    expect(() => read({ note: 'x' })).toThrow("a minimum names note, which the game doesn't read");
    expect(() => minimumOf(RESEARCH, 'x', 'EUR', ['film'])).toThrow('a minimum is not an object');
    expect(() => minimumOf(RESEARCH, null, 'EUR', ['film'])).toThrow('a minimum is not an object');
    expect(() => minimumOf(RESEARCH, [], 'EUR', ['film'])).toThrow('a minimum is not an object');
    expect(() => read({ fig: 2 })).toThrow("XX's figure 2 isn't one of its rates or agreements");
    expect(() => read({ medium: 'television' })).toThrow("a minimum's medium television isn't its agreement's");
    expect(() => read({ per: 'hour' })).toThrow('a minimum is paid by hour, which isn\'t a term');
    for (const role of ['', 3]) expect(() => read({ role }), String(role)).toThrow('a role is named');
    for (const w of ['day', ['hour'], [3], ['performance', 'hour']]) expect(() => read({ with: w }), JSON.stringify(w)).toThrow('a rehearsal goes with terms');
    expect(() => read({ when: { age: [1, 2] } })).toThrow("a minimum's tier turns on age, which the game doesn't read");
    expect(() => read({ when: [1] })).toThrow('a tier is not an object');
    expect(() => read({ when: { lines: [3, 1] } })).toThrow('a tier runs from');
    for (const from of ['2026-1-01', 'x2026-01-01', '2026-01-01x', 'x2026-01-01x', '2027-01-01']) expect(() => read({ from }), from).toThrow(`XX's figure 1 doesn't date a minimum from ${from}`);
    expect(() => minimumOf(RESEARCH, { medium: 'film', per: 'day', from: '2026-01-01', fig: 1, path: ['day', 'lead'] }, 'NOK', ['film'])).toThrow("XX's figure 1 doesn't name NOK");
    for (const path of [['zero'], ['text'], ['day'], ['nested', 'text']]) expect(() => read({ path }), path.join()).toThrow(`XX's figure 1 has no amount at ${path.join('.')}`);
    expect(() => minimumOf({ ...RESEARCH, figures: [{ item: 'rates', value: { unit: 'JPY 2026-01-01', a: 1.5 } }] }, { medium: 'film', per: 'day', from: '2026-01-01', fig: 0, path: ['a'] }, 'JPY', ['film'])).toThrow('JPY has 0 decimal places');
  });

  it("holds an agreement's minimums to one a part, a role all or none, one rehearsal term, every unit paid from the first", () => {
    expect(apart(min({ when: { lines: [0, 2] } }), min({ when: { lines: [3, null] } }))).toBe(true);
    expect(apart(min({ when: { lines: [0, 2] } }), min({ when: { lines: [2, null] } }))).toBe(false);
    expect(apart(min({ when: { lines: [5, null] } }), min({ when: { lines: [0, 4] } }))).toBe(true);
    expect(apart(min({ when: { lines: [2, null] } }), min({ when: { lines: [0, 2] } }))).toBe(false);
    expect(apart(min({ when: { lines: [0, null] } }), min({ when: { lines: [7, 7] } }))).toBe(false);
    expect(apart(min({ when: { lines: [0, 2] } }), min({ when: { budget: [3, null] } }))).toBe(false);
    expect(apart(min(), min())).toBe(false);
    expect(apart(min({ when: { budget: [0, 9], nth: [1, 1] } }), min({ when: { budget: [0, 9], nth: [2, null] } }))).toBe(true);
    const ok = [min({ when: { nth: [1, 5] } }), min({ when: { nth: [6, null] } }), min({ per: 'week' }), min({ medium: 'stage', role: 'lead' }), min({ from: '2027-01-01' }), min({ rehearsal: true, per: 'session' }), min({ rehearsal: true, per: 'session', from: '2027-01-01' })];
    expect(() => checkAgreement('a', [...ok.slice(2), min()])).not.toThrow();
    expect(() => checkAgreement('a', [...ok, min()])).toThrow('a sets two minimums for one part (film||day|false|2026-01-01)');
    expect(() => checkAgreement('a', ok.slice(0, 2))).not.toThrow();
    expect(() => checkAgreement('a', [min(), min({ role: 'lead' })])).toThrow("a's film minimums name a role and none");
    expect(() => checkAgreement('a', [min({ medium: 'stage' }), min({ medium: 'stage', role: 'lead', from: '2027-01-01' })])).toThrow("a's stage minimums name a role and none");
    expect(() => checkAgreement('a', [min({ medium: 'television', role: 'lead' }), min({ medium: 'television', role: 'other' })])).not.toThrow();
    expect(() => checkAgreement('a', [min({ rehearsal: true }), min({ rehearsal: true, per: 'session' })])).toThrow("a's rehearsals are paid by more than one term");
    for (const turns of [[[2, null]], [[1, 5]], [[1, 4], [6, null]], [[1, 5], [6, 9]]] as [number, number | null][][]) {
      expect(() => checkAgreement('a', turns.map((nth) => min({ when: { nth } }))), JSON.stringify(turns)).toThrow("a's minimums by the unit don't pay every unit (film||day|false|2026-01-01)");
    }
    expect(() => checkAgreement('a', [[6, null], [1, 2], [3, 5]].map((nth) => min({ when: { nth: nth as [number, number | null] } })))).not.toThrow();
    // Turns are counted within one tier: another tier's are its own.
    expect(() => checkAgreement('a', [min({ when: { budget: [0, 9], nth: [1, 1] } }), min({ when: { budget: [10, null], nth: [2, null] } })])).toThrow("don't pay every unit");
    expect(() => checkAgreement('a', [min({ when: { budget: [0, 9], nth: [1, null] } }), min({ when: { budget: [10, null], nth: [1, null] } })])).not.toThrow();
  });

  it('reads an agreement: its media, its currency and minimums, or none where the research says none sets the pay', () => {
    const one = { medium: 'film', per: 'day', from: '2026-01-01', fig: 1, path: ['day', 'lead'] };
    expect(agreementOf('a', RESEARCH, { media: ['film'], currency: 'EUR', minimums: [one] })).toEqual({ country: 'XX', currency: 'EUR', media: ['film'], none: false, minimums: [read({})] });
    expect(agreementOf('a', RESEARCH, { media: ['film', 'stage'], none: { fig: 2 } })).toEqual({ country: 'XX', currency: null, media: ['film', 'stage'], none: true, minimums: [] });
    expect(() => agreementOf('a', RESEARCH, { media: ['film'], none: { fig: 1 } })).toThrow("XX's figure 1 isn't one of its none");
    expect(() => agreementOf('a', RESEARCH, { media: ['film'], none: 2 })).toThrow('none is not an object');
    for (const media of [[], ['radio'], ['film', 'radio'], 'film', undefined]) expect(() => agreementOf('a', RESEARCH, { media, currency: 'EUR', minimums: [one] }), JSON.stringify(media)).toThrow('a covers film, television or the stage');
    expect(() => agreementOf('a', RESEARCH, 'x')).toThrow('the reading of a is not an object');
    expect(() => agreementOf('a', RESEARCH, { media: ['film'], currency: 'EURO', minimums: [one] })).toThrow("a pays in EURO, which isn't a currency");
    for (const minimums of [[], undefined, 'x']) expect(() => agreementOf('a', RESEARCH, { media: ['film'], currency: 'EUR', minimums }), JSON.stringify(minimums)).toThrow('a sets no minimums');
    expect(() => agreementOf('a', RESEARCH, { media: ['film'], currency: 'EUR', minimums: [one, one] })).toThrow('a sets two minimums for one part');
    // Each slot's steps by date, whatever the reading's order; equals kept in it.
    const late = { ...one, from: '2025-04-01', path: ['day', 'other'] };
    expect(agreementOf('a', RESEARCH, { media: ['film', 'stage'], currency: 'EUR', minimums: [one, { ...one, medium: 'stage' }, late] }).minimums.map((m) => [m.from, m.medium])).toEqual([['2025-04-01', 'film'], ['2026-01-01', 'film'], ['2026-01-01', 'stage']]);
  });

  it("reads a market: its language, its city's zone, its agreements and what isn't known", () => {
    const reading = { market: 4, zone: 'Europe/Paris', language: { code: 'fr', fig: 3 }, agreements: { 'xx-none': { media: ['film'], none: { fig: 2 } } } };
    expect(unknownOf(RESEARCH.blockers)).toEqual(['rates', 'union']);
    expect(unknownOf([])).toEqual([]);
    expect(() => unknownOf([{ item: 'pay' }])).toThrow("a blocker names pay, which isn't a fact the research seeks");
    expect(marketOf(RESEARCH, reading, NAMES, ZONE_SET)).toEqual({ market: { language: 'fr', zone: 'Europe/Paris', agreements: ['xx-none'], unknown: ['rates', 'union'] }, agreements: { 'xx-none': { country: 'XX', currency: null, media: ['film'], none: true, minimums: [] } } });
    expect(marketOf(RESEARCH, { ...reading, language: { code: 'fr', fig: 5 } }, NAMES, ZONE_SET).market.language).toBe('fr');
    expect(marketOf(RESEARCH, { ...reading, language: { code: 'en', fig: null }, market: 6, zone: 'Europe/Berlin' }, NAMES, ZONE_SET).market).toMatchObject({ language: 'en', zone: 'Europe/Berlin' });
    expect(marketOf({ ...RESEARCH, figures: [...RESEARCH.figures, { item: 'market', value: { timeZone: 'Europe/Berlin' } }] }, { ...reading, market: 7, zone: 'Europe/Berlin' }, NAMES, ZONE_SET).market.zone).toBe('Europe/Berlin');
    expect(() => marketOf({ ...RESEARCH, figures: [...RESEARCH.figures, { item: 'market', value: { timeZone: 'Europe/Paris' } }] }, { ...reading, market: 7, zone: 'Europe/Berlin' }, NAMES, ZONE_SET)).toThrow("XX's market is in Europe/Paris, not Europe/Berlin");
    expect(() => marketOf(RESEARCH, { ...reading, language: { code: 'xx', fig: null } }, NAMES, ZONE_SET)).toThrow("XX casts in xx, which a person can't speak");
    expect(() => marketOf(RESEARCH, { ...reading, language: { code: 'en', fig: 3 } }, NAMES, ZONE_SET)).toThrow("XX's language figure doesn't name en");
    expect(() => marketOf(RESEARCH, { ...reading, language: { code: 'fr', fig: 4 } }, NAMES, ZONE_SET)).toThrow("XX's figure 4 isn't one of its language");
    expect(() => marketOf(RESEARCH, { ...reading, language: 'fr' }, NAMES, ZONE_SET)).toThrow('a language is not an object');
    expect(() => marketOf(RESEARCH, { ...reading, zone: 'Mars/Olympus' }, NAMES, ZONE_SET)).toThrow("Mars/Olympus isn't a zone the clock keeps");
    expect(() => marketOf(RESEARCH, { ...reading, zone: 'Europe/Berlin' }, NAMES, ZONE_SET)).toThrow("XX's market is in Europe/Paris, not Europe/Berlin");
    expect(() => marketOf(RESEARCH, { ...reading, market: 3 }, NAMES, ZONE_SET)).toThrow("XX's figure 3 isn't one of its market");
    expect(() => marketOf({ ...RESEARCH, figures: [{ item: 'market', value: 'Paris' }, ...RESEARCH.figures.slice(1)] }, { ...reading, market: 0 }, NAMES, ZONE_SET)).toThrow('a market is not an object');
    expect(() => marketOf(RESEARCH, { ...reading, agreements: [] }, NAMES, ZONE_SET)).toThrow('the agreements is not an object');
    expect(() => marketOf(RESEARCH, 'x', NAMES, ZONE_SET)).toThrow('the reading of XX is not an object');
  });

  it('reads each market as the register cites it, and refuses a file or a reading without the other', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
    };
    const file = (cc: string, blockers: { item: string }[] = []) => JSON.stringify({ ...RESEARCH, country: cc, blockers });
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    const reading = (id: string) => ({ market: 4, zone: 'Europe/Paris', language: { code: 'fr', fig: 3 }, agreements: { [id]: { media: ['film'], currency: 'EUR', minimums: [{ medium: 'film', per: 'day', from: '2026-01-01', fig: 1, path: ['day', 'lead'] }] } } });
    put(LANGUAGES, { names: NAMES });
    put(ZONES, { zones: { 'Europe/Paris': [] }, links: { 'Europe/Monaco': 'Europe/Paris' } });
    const aa = file('AA');
    const bb = file('BB', [{ item: 'rates' }]);
    put(`${SOURCES}/AA.json`, aa);
    put(`${SOURCES}/BB.json`, bb);
    put(`${SOURCES}/notes.txt`, 'not research');
    // Only a market's own file is read: another role's research beside it (writer-AA.json) and a copy (AA.json.bak) aren't.
    put(`${SOURCES}/writer-AA.json`, aa);
    put(`${SOURCES}/AA.json.bak`, aa);
    const cite = (cc: string, text: string) => ({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/${cc}.json`, sha256: sha(text) } });
    const register = (entries: unknown[]) => put('research/register.json', { entries });
    const all = [cite('AA', aa), cite('BB', bb), { fact: `${BLOCKED}BB` }];
    register(all);
    put(READINGS, { AA: reading('aa-film'), BB: { ...reading('bb-film'), zone: 'Europe/Monaco', market: 6 } });
    const out = readMarkets(root);
    expect(Object.keys(out.markets)).toEqual(['AA', 'BB']);
    expect(out.markets).toEqual({ AA: { language: 'fr', zone: 'Europe/Paris', agreements: ['aa-film'], unknown: [] }, BB: { language: 'fr', zone: 'Europe/Monaco', agreements: ['bb-film'], unknown: ['rates'] } });
    expect(out.agreements['bb-film']).toEqual({ country: 'BB', currency: 'EUR', media: ['film'], none: false, minimums: [read({})] });
    expect(serialize(out)).toBe(`${JSON.stringify(out, null, 1)}\n`);
    expect(readResearch(root, { entries: all as never }, 'BB')).toEqual({ research: JSON.parse(bb), blocked: true });
    expect(readResearch(root, { entries: all as never }, 'AA').blocked).toBe(false);
    // A blocker of the markets stands for the file: another fact of the same length doesn't.
    expect(readResearch(root, { entries: [cite('AA', aa), { fact: 'person.marketx.blocked.AA' }] as never }, 'AA').blocked).toBe(false);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), value: { file: `${SOURCES}/BB.json`, sha256: sha(aa) } }] as never }, 'AA')).toThrow(`${SOURCES}/AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ fact: `${FACT}AA` }] as never }, 'AA')).toThrow(`${SOURCES}/AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), fact: 'person.markets.BB' }] as never }, 'AA')).toThrow(`${SOURCES}/AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [cite('AA', bb)] as never }, 'AA')).toThrow(`${SOURCES}/AA.json isn't the file the register cites`);
    put(`${SOURCES}/CC.json`, aa);
    expect(() => readResearch(root, { entries: [cite('CC', aa)] as never }, 'CC')).toThrow(`${SOURCES}/CC.json is AA's`);
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/CC.json has no reading`);
    put(READINGS, { AA: reading('aa-film'), BB: reading('bb-film'), CC: reading('cc-film'), DD: reading('dd-film') });
    expect(() => readMarkets(root)).toThrow('DD has a reading and no research');
    put(READINGS, { AA: reading('aa-film'), BB: reading('bb-film'), CC: reading('cc-film') });
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/CC.json isn't cited by the register`);
  });

  it('refuses a market whose blockers the register and the research hold apart, or an id taken', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
    };
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    const reading = (id: string) => ({ market: 4, zone: 'Europe/Paris', language: { code: 'fr', fig: 3 }, agreements: { [id]: { media: ['film'], none: { fig: 2 } } } });
    put(LANGUAGES, { names: NAMES });
    put(ZONES, { zones: { 'Europe/Paris': [] }, links: {} });
    const set = (files: Record<string, { item: string }[]>, blocked: string[], readings: Record<string, string>) => {
      const entries: unknown[] = blocked.map((cc) => ({ fact: `${BLOCKED}${cc}` }));
      for (const [cc, blockers] of Object.entries(files)) {
        const text = JSON.stringify({ ...RESEARCH, country: cc, blockers });
        put(`${SOURCES}/${cc}.json`, text);
        entries.push({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/${cc}.json`, sha256: sha(text) } });
      }
      put('research/register.json', { entries });
      put(READINGS, Object.fromEntries(Object.entries(readings).map(([cc, id]) => [cc, reading(id)])));
    };
    set({ AA: [] }, ['AA'], { AA: 'aa' });
    expect(() => readMarkets(root)).toThrow("the register holds AA's blockers, which its research doesn't");
    set({ AA: [{ item: 'rates' }] }, [], { AA: 'aa' });
    expect(() => readMarkets(root)).toThrow("AA's research has blockers the register doesn't hold");
    set({ AA: [] }, [], { AA: 'actra' });
    expect(() => readMarkets(root)).toThrow('actra is another agreement\'s id');
    set({ AA: [], BB: [] }, [], { AA: 'xx', BB: 'xx' });
    expect(() => readMarkets(root)).toThrow("xx is another agreement's id");
    set({ AA: [], BB: [] }, [], { AA: 'aa', BB: 'bb' });
    expect(Object.keys(readMarkets(root).agreements)).toEqual(['aa', 'bb']);
  });

  it('reads no markets where the research has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(body));
    };
    put(LANGUAGES, { names: {} });
    put(ZONES, { zones: {}, links: {} });
    put('research/register.json', { entries: [] });
    put(READINGS, {});
    expect(readMarkets(root)).toEqual({ markets: {}, agreements: {} });
    put(READINGS, []);
    expect(() => readMarkets(root)).toThrow('the readings is not an object');
  });

  it('compiles the eighteen markets the engine reads', () => {
    expect(readMarkets(ROOT)).toEqual(JSON.parse(readFileSync(join(ROOT, OUTPUT), 'utf8')));
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readMarkets(ROOT)));
  });
});

describe('the markets coverage', () => {
  it('is blocked where the register holds a blocker, researched where it cites the research alone, pending where neither', () => {
    const facts = new Map([
      ['person.markets.AA', 'R-1'],
      ['person.markets.BB', 'R-2'],
      ['person.markets.blocked.BB', 'R-3'],
      ['person.markets.blocked.CC', 'R-4'],
    ]);
    const rows = marketsCoverage(['AA', 'BB', 'CC', 'DD'], facts);
    expect(rows).toEqual([
      { key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'BB', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'CC', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'DD', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/person/acting/markets.test.ts::the markets > are each country's own, every minimum as the research gives it", "tests/person/acting/markets.test.ts::a market's part > is paid at its agreement's minimum, by medium, role, term and tier"]);
    expect(TOLD).toBe("tests/person/acting/markets.test.ts::a market's part > tells the player what of a market isn't known");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'person.acting', axis: 'market', universe: { keys: ['AA', 'BB'] }, rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is built from the compiled markets and the register', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-cov-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(body));
    };
    put(OUTPUT, { markets: { AA: {}, BB: {} }, agreements: {} });
    put('research/register.json', { entries: [{ id: 'R-1', fact: 'person.markets.AA' }, { id: 'R-2', fact: 'person.markets.blocked.BB' }] });
    expect(COVERAGE).toBe('coverage/markets-countries.json');
    expect(coverageOf(root)).toBe(serializeCoverage([{ key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS }, { key: 'BB', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] }]));
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
