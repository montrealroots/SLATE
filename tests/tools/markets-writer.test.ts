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
  checkFees,
  dated,
  FACT,
  feeOf,
  figureOf,
  FORMS,
  ITEMS,
  KEPT,
  LANGUAGES,
  marketOf,
  numberAt,
  optionOf,
  OUTPUT,
  PERS,
  PREFIX,
  range,
  READINGS,
  readMarkets,
  readResearch,
  serialize,
  shareOf,
  SOURCES,
  TIERS,
  unknownOf,
  type Fee,
  type Research,
} from '../../tools/person/markets-writer/compile.ts';
import { COVERAGE, coverageOf, marketsCoverage, serializeCoverage, TESTS, TOLD } from '../../tools/person/markets-writer/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const RESEARCH: Research = {
  country: 'XX',
  figures: [
    { item: 'fees', value: { unit: 'EUR', from: '2026-01-01', a: 100.5, b: 200, pct: 40, hold: 50, cap: 1000, zero: 0, text: '12', since: '2025-04', yen: 100.5, nested: { n: 3, s: 'x' }, note: 'x2026-01-01x' } },
    { item: 'none', value: { x: null } },
    { item: 'agreement', value: { minimumFee: null, fee: 300, unit: 'EUR', on: '2026-02-01', lang: 'French' } },
    { item: 'option', value: { pct: 5, share: 0.1, big: 150, whole: 1 } },
    { item: 'fees', value: { note: 'budgets are Negotiable', on: '2024-01-01' } },
    { item: 'union', value: { code: 'fr', other: 'fry' } },
    { item: 'fees', value: { note: 'small ones are exempt', on: '2024-01-01' } },
  ],
  blockers: [{ item: 'fees' }, { item: 'union' }, { item: 'fees' }],
};
const NAMES = { fr: 'French', en: 'English' };
const fee = (m: Record<string, unknown> = {}) => feeOf(RESEARCH, { forms: ['feature'], per: 'script', from: '2026-01-01', fig: 0, path: ['b'], ...m }, 'EUR', ['feature', 'episode']);
const f = (over: Partial<Fee> = {}): Fee => ({ forms: ['feature'], when: {}, per: 'script', from: '2026-01-01', amount: '1', share: null, cap: null, held: null, ...over });
const agreement = (a: Record<string, unknown>) => agreementOf('xx-film', RESEARCH, { forms: ['feature'], language: { code: 'fr', fig: null }, ...a }, NAMES);

describe("the screenwriter's markets compile", () => {
  it('reads a figure, a place in it, a number, a share and a tier', () => {
    expect([SOURCES, READINGS, OUTPUT, LANGUAGES, PREFIX, FACT, BLOCKED]).toEqual(['research/sources/person/markets', 'tools/person/markets-writer/readings.json', 'src/person/work/markets.json', 'src/person/identity/languages.json', 'writer-', 'person.markets.writer.', 'person.markets.writer.blocked.']);
    expect([KEPT, FORMS, PERS, TIERS, ITEMS]).toEqual([['wga'], ['feature', 'pilot', 'episode', 'short'], ['script', 'minute', 'hour'], ['budget', 'minutes', 'hourly'], ['agreement', 'fees', 'option', 'language', 'union']]);
    expect(figureOf(RESEARCH, 1, ['none'])).toBe(RESEARCH.figures[1]);
    expect(figureOf(RESEARCH, 2, null)).toBe(RESEARCH.figures[2]);
    expect(() => figureOf(RESEARCH, 1, ['fees', 'agreement'])).toThrow("XX's figure 1 isn't one of its fees or agreement");
    expect(() => figureOf(RESEARCH, 9, null)).toThrow("XX's figure 9 isn't one of its figures");
    expect(() => figureOf(RESEARCH, '1', null)).toThrow("XX's figure 1 isn't one of its figures");
    expect(at({ a: { b: [5, 6] } }, ['a', 'b', 1])).toBe(6);
    expect(at({ a: null }, ['a'])).toBeNull();
    expect(() => at({ a: null }, ['a', 'b'])).toThrow('has nothing at a.b');
    expect(() => at({ a: 'x' }, ['a', 'length'])).toThrow('has nothing at a.length');
    expect(() => at({}, ['toString'])).toThrow('has nothing at toString');
    expect(() => at({ a: 1 }, 'a')).toThrow('a path is a list');
    const fig = RESEARCH.figures[0] as Research['figures'][number];
    expect(numberAt(RESEARCH, fig, ['a'])).toBe(100.5);
    expect(numberAt(RESEARCH, fig, ['nested', 'n'])).toBe(3);
    for (const path of [['zero'], ['text'], ['nested'], ['nested', 's']]) expect(() => numberAt(RESEARCH, fig, path)).toThrow(`XX's figure has no figure at ${path.join('.')}`);
    expect(shareOf(40, 'pct')).toBe('0.4');
    expect(shareOf(16.5, 'pct')).toBe('0.165');
    expect(shareOf(0.1, 'share')).toBe('0.1');
    expect(() => shareOf(100, 'pct')).toThrow('a share is under one (1)');
    expect(() => shareOf(1.5, 'share')).toThrow('a share is under one (1.5)');
    expect(() => shareOf(10, 'share')).toThrow('a share is under one (10)');
    expect(() => shareOf(10.5, 'share')).toThrow('a share is under one (10.5)');
    expect(() => shareOf(0.1, 'amount')).toThrow('a share is read as a pct or a share, not amount');
    expect(range([0, null])).toEqual([0, null]);
    expect(range([3, 3])).toEqual([3, 3]);
    for (const bad of [[1], [1, 2, 3], 'a', [-1, 2], [1.5, 2], [2, 1], [1, 2.5], ['1', 2], [1, '2']]) expect(() => range(bad), JSON.stringify(bad)).toThrow(/a tier/);
  });

  it('dates a minimum where its figure writes the date, or its month for the first', () => {
    expect(dated('"from":"2026-01-01"', '2026-01-01')).toBe(true);
    expect(dated('"since":"2025-04"', '2025-04-01')).toBe(true);
    expect(dated('"since":"2025-04"', '2025-04-02')).toBe(false);
    expect(dated('"since":"2025-04-x"', '2025-04-01')).toBe(false);
    expect(dated('"x":"2025-05"', '2025-04-01')).toBe(false);
  });

  it('holds two minimums apart where they share no form or a tier both set keeps them apart', () => {
    expect(apart(f(), f({ forms: ['episode'] }))).toBe(true);
    expect(apart(f({ forms: ['feature', 'episode'] }), f({ forms: ['episode'] }))).toBe(false);
    expect(apart(f({ when: { budget: [0, 10] } }), f({ when: { budget: [11, null] } }))).toBe(true);
    expect(apart(f({ when: { budget: [11, 20] } }), f({ when: { budget: [0, 10] } }))).toBe(true);
    expect(apart(f({ when: { budget: [0, 10] } }), f({ when: { budget: [10, null] } }))).toBe(false);
    expect(apart(f({ when: { budget: [10, null] } }), f({ when: { budget: [0, 10] } }))).toBe(false);
    expect(apart(f({ when: { budget: [0, null] } }), f({ when: { budget: [5, null] } }))).toBe(false);
    expect(apart(f({ when: { budget: [0, 10] } }), f({ when: { minutes: [11, 20] } }))).toBe(false);
    expect(apart(f({ when: { minutes: [1, 30], budget: [0, 10] } }), f({ when: { minutes: [1, 30], budget: [11, 20] } }))).toBe(true);
    expect(() => checkFees('xx', [f(), f({ forms: ['episode'] }), f({ from: '2027-01-01' }), f({ when: { budget: [0, 5] } })])).toThrow('xx sets two minimums for one script (feature from 2026-01-01)');
    expect(() => checkFees('xx', [f(), f({ forms: ['episode'] }), f({ from: '2027-01-01' })])).not.toThrow();
    expect(() => checkFees('xx', [f({ forms: ['episode'] }), f({ forms: ['feature', 'episode'], from: '2027-01-01' }), f({ forms: ['episode'], from: '2027-01-01' })])).toThrow('xx sets two minimums for one script (feature, episode from 2027-01-01)');
  });

  it('reads a minimum at its place in the research, its date and currency standing in the figure', () => {
    expect(fee()).toEqual(f({ amount: '200' }));
    expect(fee({ forms: ['episode', 'feature'], when: { budget: [0, 10], minutes: [1, null], hourly: [5, 6] }, per: 'hour', path: ['a'] })).toEqual(f({ forms: ['episode', 'feature'], when: { budget: [0, 10], minutes: [1, null], hourly: [5, 6] }, per: 'hour', amount: '100.5' }));
    expect(fee({ per: 'minute', from: '2025-04-01' }).from).toBe('2025-04-01');
    expect(fee({ fig: 2, path: ['fee'], from: '2026-02-01' }).amount).toBe('300');
    expect(fee({ dated: 2, from: '2026-02-01' }).from).toBe('2026-02-01');
    expect(() => fee({ dated: 1, from: '2026-01-01' })).toThrow("XX's figure doesn't date a minimum from 2026-01-01");
    expect(() => fee({ from: '2026-01-02' })).toThrow("XX's figure doesn't date a minimum from 2026-01-02");
    expect(() => fee({ from: 'x2026-01-01' })).toThrow("XX's figure doesn't date a minimum from x2026-01-01");
    expect(() => fee({ from: '2026-01-01x' })).toThrow("XX's figure doesn't date a minimum from 2026-01-01x");
    expect(() => fee({ per: 'day' })).toThrow('a minimum is paid by day, which the game doesn\'t read');
    expect(() => fee({ fig: 1 })).toThrow("XX's figure 1 isn't one of its fees or agreement");
    expect(() => fee({ path: ['zero'] })).toThrow("XX's figure has no figure at zero");
    expect(() => fee({ forms: ['short'] })).toThrow("a minimum's forms is for feature, episode");
    expect(() => fee({ forms: ['feature', 'short'] })).toThrow("a minimum's forms is for feature, episode");
    expect(() => fee({ forms: [] })).toThrow("a minimum's forms is for feature, episode");
    expect(() => fee({ forms: 'feature' })).toThrow("a minimum's forms is for feature, episode");
    expect(() => fee({ when: { seats: [0, 1] } })).toThrow("a minimum's tier turns on seats, which the game doesn't read");
    expect(() => fee({ when: [] })).toThrow('a tier is not an object');
    expect(() => fee({ when: { budget: [2, 1] } })).toThrow(/a tier runs/);
    expect(() => fee({ rate: 1 })).toThrow("a minimum names rate, which the game doesn't read");
    expect(() => feeOf(RESEARCH, null, 'EUR', ['feature'])).toThrow('a minimum is not an object');
    expect(() => feeOf(RESEARCH, { forms: ['feature'], per: 'script', from: '2026-01-01', fig: 0, path: ['b'] }, 'GBP', ['feature'])).toThrow("XX's figure 0 doesn't name GBP");
    expect(() => feeOf({ ...RESEARCH, figures: [{ item: 'fees', value: { a: 100.5, from: '2026-01-01', c: 'JPY' } }] }, { forms: ['feature'], per: 'script', from: '2026-01-01', fig: 0, path: ['a'] }, 'JPY', ['feature'])).toThrow('JPY has 0 decimal places');
    // What waits for photography, a share of the budget, a ceiling.
    expect(fee({ held: { path: ['pct'], unit: 'pct' } }).held).toEqual({ share: '0.4' });
    expect(fee({ held: { path: ['hold'], unit: 'amount' } }).held).toEqual({ amount: '50' });
    expect(fee({ held: { path: ['a'], unit: 'amount' } }).held).toEqual({ amount: '100.5' });
    expect(() => fee({ held: { path: ['b'], unit: 'amount' } })).toThrow('XX holds more than the minimum until photography');
    expect(() => fee({ held: { path: ['pct'], unit: 'x' } })).toThrow('a share is read as a pct or a share, not x');
    expect(() => fee({ held: 'pct' })).toThrow('what is held is not an object');
    expect(fee({ share: { path: ['pct'], unit: 'pct' }, cap: { path: ['cap'] } })).toEqual(f({ amount: '200', share: '0.4', cap: '1000' }));
    expect(() => fee({ cap: { path: ['b'] } })).toThrow("XX's ceiling is under its floor");
    expect(fee({ cap: { path: ['b'] }, path: ['a'] }).cap).toBe('200');
    expect(() => fee({ share: 1 })).toThrow('a share is not an object');
    expect(() => fee({ cap: 1 })).toThrow('a cap is not an object');
    // A tier left to negotiation, as the research's figure says.
    const negotiated = f({ per: null, amount: null, from: '2024-01-01', when: { budget: [0, 9] } });
    expect(fee({ negotiated: { fig: 4 }, from: '2024-01-01', when: { budget: [0, 9] } })).toEqual(negotiated);
    expect(fee({ negotiated: { fig: 6 }, from: '2024-01-01', when: { budget: [0, 9] } })).toEqual(negotiated);
    expect(fee({ negotiated: { fig: 4 }, from: '2026-02-01', dated: 2, when: { budget: [0, 9] } }).from).toBe('2026-02-01');
    expect(() => fee({ negotiated: { fig: 4 }, from: '2026-01-01' })).toThrow("XX's figure doesn't date a minimum from 2026-01-01");
    expect(() => fee({ negotiated: { fig: 0 } })).toThrow("XX's figure doesn't leave the tier to negotiation");
    expect(() => fee({ negotiated: 4 })).toThrow('negotiated is not an object');
  });

  it("reads an option: negotiated where its finding says so, priced at a share of the minimum or of a base", () => {
    const option = (o: unknown, currency: 'EUR' | null = 'EUR', forms: ('feature' | 'episode')[] = ['feature']) => optionOf(RESEARCH, o, currency, forms);
    expect(option(undefined)).toBeNull();
    expect(option({ negotiated: { fig: 3 } }, null)).toBe('negotiated');
    expect(() => option({ negotiated: { fig: 0 } })).toThrow("XX's figure 0 isn't one of its option");
    expect(() => option({ negotiated: 3 })).toThrow('negotiated is not an object');
    expect(() => option({ free: true })).toThrow("an option names free, which the game doesn't read");
    expect(() => option('negotiated')).toThrow('an option is not an object');
    expect(option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct' }] })).toEqual([{ forms: ['feature'], share: '0.05', base: null }]);
    expect(option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct' }, { forms: ['episode'], fig: 3, path: ['share'], unit: 'share', base: { fig: 0, path: ['b'], from: '2026-01-01' } }] }, 'EUR', ['feature', 'episode'])).toEqual([
      { forms: ['feature'], share: '0.05', base: null },
      { forms: ['episode'], share: '0.1', base: '200' },
    ]);
    expect(option({ priced: [{ forms: ['feature'], fig: 3, path: ['share'], unit: 'share', base: { fig: 2, path: ['fee'], from: '2026-02-01' } }] })).toEqual([{ forms: ['feature'], share: '0.1', base: '300' }]);
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct' }] }, 'EUR', ['feature', 'episode'])).toThrow("XX's option sets no price for a episode");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct' }] }, null)).toThrow("XX's option is priced in the agreement's currency");
    expect(() => option({ priced: [] })).toThrow("XX's option is priced in the agreement's currency");
    expect(() => option({ priced: {} })).toThrow("XX's option is priced in the agreement's currency");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 0, path: ['pct'], unit: 'pct' }] })).toThrow("XX's figure 0 isn't one of its option");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['big'], unit: 'pct' }] })).toThrow('a share is under one (1.5)');
    expect(() => option({ priced: [{ forms: ['episode'], fig: 3, path: ['pct'], unit: 'pct' }] })).toThrow("an option's forms is for feature");
    expect(() => option({ priced: [{ forms: ['episode'], fig: 3, path: ['pct'], unit: 'pct', base: { fig: 0, path: ['b'], from: '2026-01-01' } }] })).toThrow("an option's forms is for feature");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct', at: 1 }] })).toThrow("a price names at, which the game doesn't read");
    expect(() => option({ priced: [1] })).toThrow('a price is not an object');
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct', base: { fig: 3, path: ['big'], from: '2026-01-01' } }] })).toThrow("XX's figure 3 isn't one of its fees or agreement");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct', base: { fig: 0, path: ['zero'], from: '2026-01-01' } }] })).toThrow("XX's figure has no figure at zero");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct', base: { fig: 0, path: ['b'], from: '2026-03-01' } }] })).toThrow("XX's figure doesn't date a minimum from 2026-03-01");
    expect(() => optionOf(RESEARCH, { priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct', base: { fig: 0, path: ['b'], from: '2026-01-01' } }] }, 'GBP' as never, ['feature'])).toThrow("XX's base doesn't name GBP");
    expect(() => option({ priced: [{ forms: ['feature'], fig: 3, path: ['pct'], unit: 'pct', base: 1 }] })).toThrow('a base is not an object');
  });

  it('reads an agreement: its language and forms, and its pay left to negotiation, unknown, or its minimums sorted by date', () => {
    expect(agreement({ unknown: true })).toEqual({ country: 'XX', language: 'fr', forms: ['feature'], currency: null, none: false, unknown: true, fees: [], option: null });
    expect(agreement({ none: { fig: 1 }, option: { negotiated: { fig: 3 } } })).toEqual({ country: 'XX', language: 'fr', forms: ['feature'], currency: null, none: true, unknown: false, fees: [], option: 'negotiated' });
    expect(agreement({ none: { fig: 2, path: ['minimumFee'] } }).none).toBe(true);
    expect(agreement({ none: { fig: 1, path: ['nothing'] } }).none).toBe(true);
    expect(() => agreement({ none: { fig: 2, path: ['fee'] } })).toThrow("XX's figure 2 doesn't say nothing sets the pay");
    expect(() => agreement({ none: { fig: 2 } })).toThrow('a path is a list');
    expect(() => agreement({ none: 1 })).toThrow('none is not an object');
    const later = { forms: ['feature'], per: 'script', from: '2026-02-01', fig: 2, path: ['fee'] };
    const earlier = { forms: ['feature'], per: 'script', from: '2026-01-01', fig: 0, path: ['b'] };
    const read = agreement({ currency: 'EUR', fees: [later, earlier], option: { negotiated: { fig: 3 } } });
    expect(read).toEqual({ country: 'XX', language: 'fr', forms: ['feature'], currency: 'EUR', none: false, unknown: false, fees: [f({ amount: '200' }), f({ amount: '300', from: '2026-02-01' })], option: 'negotiated' });
    expect(agreement({ currency: 'EUR', fees: [earlier] }).option).toBeNull();
    expect(agreement({ unknown: false, currency: 'EUR', fees: [earlier] }).unknown).toBe(false);
    expect(() => agreement({ currency: 'EUR', fees: [earlier, earlier] })).toThrow('xx-film sets two minimums for one script (feature from 2026-01-01)');
    expect(() => agreement({ forms: ['feature', 'episode'], currency: 'EUR', fees: [earlier] })).toThrow('xx-film sets no minimum for a episode');
    expect(() => agreement({ currency: 'EUR', fees: [] })).toThrow('xx-film sets no minimum for a feature');
    expect(() => agreement({ currency: 'EUR' })).toThrow('xx-film sets no minimums');
    expect(() => agreement({ currency: 'EUROS', fees: [earlier] })).toThrow("xx-film pays in EUROS, which isn't a currency");
    expect(() => agreement({ forms: ['film'] })).toThrow("xx-film's forms is for feature, pilot, episode, short");
    expect(() => agreement({ market: 1 })).toThrow("xx-film names market, which the game doesn't read");
    expect(() => agreementOf('xx', RESEARCH, [], NAMES)).toThrow('the reading of xx is not an object');
    // The language: one a person speaks, standing in the research's figure where it names one.
    expect(agreement({ unknown: true, language: { code: 'fr', fig: 5 } }).language).toBe('fr');
    expect(agreement({ unknown: true, language: { code: 'fr', fig: 2 } }).language).toBe('fr');
    expect(() => agreement({ unknown: true, language: { code: 'en', fig: 2 } })).toThrow("XX's language figure doesn't name en");
    expect(() => agreementOf('xx', { ...RESEARCH, figures: [{ item: 'x', value: { a: 'fry' } }] }, { forms: ['feature'], language: { code: 'fr', fig: 0 }, unknown: true }, NAMES)).toThrow("XX's language figure doesn't name fr");
    expect(() => agreement({ unknown: true, language: { code: 'de', fig: null } })).toThrow("xx-film is written in de, which a person can't speak");
    expect(() => agreement({ unknown: true, language: 'fr' })).toThrow('a language is not an object');
  });

  it("reads a market's agreements and what isn't known; an agreement unknown only where its blockers say so", () => {
    expect(unknownOf([{ item: 'fees' }, { item: 'union' }, { item: 'fees' }])).toEqual(['fees', 'union']);
    expect(() => unknownOf([{ item: 'rates' }])).toThrow("a blocker names rates, which isn't a fact the research seeks");
    const read = marketOf(RESEARCH, { agreements: { 'xx-a': { forms: ['feature'], language: { code: 'fr', fig: null }, unknown: true }, 'xx-b': { forms: ['short'], language: { code: 'en', fig: null }, none: { fig: 1 } } } }, NAMES);
    expect(read.market).toEqual({ agreements: ['xx-a', 'xx-b'], unknown: ['fees', 'union'] });
    expect(Object.keys(read.agreements)).toEqual(['xx-a', 'xx-b']);
    expect(read.agreements['xx-b']?.language).toBe('en');
    const unknown = { agreements: { 'xx-a': { forms: ['feature'], language: { code: 'fr', fig: null }, unknown: true } } };
    expect(marketOf({ ...RESEARCH, blockers: [{ item: 'agreement' }] }, unknown, NAMES).market.unknown).toEqual(['agreement']);
    expect(() => marketOf({ ...RESEARCH, blockers: [{ item: 'option' }] }, unknown, NAMES)).toThrow("xx-a's figures are unknown, which XX's blockers don't say");
    expect(() => marketOf({ ...RESEARCH, blockers: [] }, unknown, NAMES)).toThrow("xx-a's figures are unknown, which XX's blockers don't say");
    expect(() => marketOf(RESEARCH, { ...unknown, zone: 'x' }, NAMES)).toThrow("XX names zone, which the game doesn't read");
    expect(() => marketOf(RESEARCH, { agreements: [] }, NAMES)).toThrow('the agreements is not an object');
    expect(() => marketOf(RESEARCH, null, NAMES)).toThrow('the reading of XX is not an object');
  });

  it('reads each market as the register cites it, and refuses a file or a reading without the other', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-writer-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
    };
    const file = (cc: string, blockers: { item: string }[] = []) => JSON.stringify({ ...RESEARCH, country: cc, blockers });
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    const reading = (id: string) => ({ agreements: { [id]: { forms: ['feature'], language: { code: 'fr', fig: null }, none: { fig: 1 } } } });
    put(LANGUAGES, { names: NAMES });
    const aa = file('AA');
    const bb = file('BB', [{ item: 'fees' }]);
    put(`${SOURCES}/writer-AA.json`, aa);
    put(`${SOURCES}/writer-BB.json`, bb);
    put(`${SOURCES}/AA.json`, 'the actor\'s');
    put(`${SOURCES}/director-AA.json`, 'a director\'s');
    put(`${SOURCES}/writer-notes.txt`, 'not research');
    const cite = (cc: string, text: string) => ({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/writer-${cc}.json`, sha256: sha(text) } });
    const all = [cite('AA', aa), cite('BB', bb), { fact: `${BLOCKED}BB` }];
    put('research/register.json', { entries: all });
    put(READINGS, { AA: reading('aa'), BB: reading('bb') });
    const out = readMarkets(root);
    expect(out.markets).toEqual({ AA: { agreements: ['aa'], unknown: [] }, BB: { agreements: ['bb'], unknown: ['fees'] } });
    expect(out.agreements['bb']).toEqual({ country: 'BB', language: 'fr', forms: ['feature'], currency: null, none: true, unknown: false, fees: [], option: null });
    expect(serialize(out)).toBe(`${JSON.stringify(out, null, 1)}\n`);
    expect(readResearch(root, { entries: all as never }, 'BB')).toEqual({ research: JSON.parse(bb), blocked: true });
    expect(readResearch(root, { entries: all as never }, 'AA').blocked).toBe(false);
    expect(readResearch(root, { entries: [cite('AA', aa), { fact: 'person.markets.blocked.AA' }] as never }, 'AA').blocked).toBe(false);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), value: { file: `${SOURCES}/writer-BB.json`, sha256: sha(aa) } }] as never }, 'AA')).toThrow(`${SOURCES}/writer-AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ fact: `${FACT}AA` }] as never }, 'AA')).toThrow(`${SOURCES}/writer-AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [{ ...cite('AA', aa), fact: 'person.markets.AA' }] as never }, 'AA')).toThrow(`${SOURCES}/writer-AA.json isn't cited by the register`);
    expect(() => readResearch(root, { entries: [cite('AA', bb)] as never }, 'AA')).toThrow(`${SOURCES}/writer-AA.json isn't the file the register cites`);
    put(`${SOURCES}/writer-CC.json`, aa);
    expect(() => readResearch(root, { entries: [cite('CC', aa)] as never }, 'CC')).toThrow(`${SOURCES}/writer-CC.json is AA's`);
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/writer-CC.json has no reading`);
    put(READINGS, { AA: reading('aa'), BB: reading('bb'), CC: reading('cc'), DD: reading('dd') });
    expect(() => readMarkets(root)).toThrow('DD has a reading and no research');
    put(READINGS, { AA: reading('aa'), BB: reading('bb'), CC: reading('cc') });
    expect(() => readMarkets(root)).toThrow(`${SOURCES}/writer-CC.json isn't cited by the register`);
  });

  it('refuses a market whose blockers the register and the research hold apart, or an id taken', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-writer-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), typeof body === 'string' ? body : JSON.stringify(body));
    };
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    const reading = (id: string) => ({ agreements: { [id]: { forms: ['feature'], language: { code: 'fr', fig: null }, none: { fig: 1 } } } });
    put(LANGUAGES, { names: NAMES });
    const set = (files: Record<string, { item: string }[]>, blocked: string[], readings: Record<string, string>) => {
      const entries: unknown[] = blocked.map((cc) => ({ fact: `${BLOCKED}${cc}` }));
      for (const [cc, blockers] of Object.entries(files)) {
        const text = JSON.stringify({ ...RESEARCH, country: cc, blockers });
        put(`${SOURCES}/writer-${cc}.json`, text);
        entries.push({ fact: `${FACT}${cc}`, value: { file: `${SOURCES}/writer-${cc}.json`, sha256: sha(text) } });
      }
      put('research/register.json', { entries });
      put(READINGS, Object.fromEntries(Object.entries(readings).map(([cc, id]) => [cc, reading(id)])));
    };
    set({ AA: [] }, ['AA'], { AA: 'aa' });
    expect(() => readMarkets(root)).toThrow("the register holds AA's blockers, which its research doesn't");
    set({ AA: [{ item: 'fees' }] }, [], { AA: 'aa' });
    expect(() => readMarkets(root)).toThrow("AA's research has blockers the register doesn't hold");
    set({ AA: [] }, [], { AA: 'wga' });
    expect(() => readMarkets(root)).toThrow("wga is another agreement's id");
    set({ AA: [], BB: [] }, [], { AA: 'xx', BB: 'xx' });
    expect(() => readMarkets(root)).toThrow("xx is another agreement's id");
    set({ AA: [], BB: [] }, [], { AA: 'aa', BB: 'bb' });
    expect(Object.keys(readMarkets(root).agreements)).toEqual(['aa', 'bb']);
  });

  it('reads no markets where the research has none', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-writer-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(body));
    };
    put(LANGUAGES, { names: {} });
    put('research/register.json', { entries: [] });
    put(READINGS, {});
    expect(readMarkets(root)).toEqual({ markets: {}, agreements: {} });
    put(READINGS, []);
    expect(() => readMarkets(root)).toThrow('the readings is not an object');
  });

  it('compiles the twenty markets the engine reads', () => {
    const out = readMarkets(ROOT);
    expect(Object.keys(out.markets)).toHaveLength(20);
    expect(out).toEqual(JSON.parse(readFileSync(join(ROOT, OUTPUT), 'utf8')));
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readMarkets(ROOT)));
  });
});

describe("the screenwriter's markets coverage", () => {
  it('is blocked where the register holds a blocker, researched where it cites the research alone, pending where neither', () => {
    const facts = new Map([
      ['person.markets.writer.AA', 'R-1'],
      ['person.markets.writer.BB', 'R-2'],
      ['person.markets.writer.blocked.BB', 'R-3'],
      ['person.markets.writer.blocked.CC', 'R-4'],
      ['person.markets.DD', 'R-5'],
    ]);
    const rows = marketsCoverage(['AA', 'BB', 'CC', 'DD'], facts);
    expect(rows).toEqual([
      { key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'BB', status: 'blocked', register: ['R-3', 'R-2'], tests: [...TESTS, TOLD] },
      { key: 'CC', status: 'blocked', register: ['R-4'], tests: [...TESTS, TOLD] },
      { key: 'DD', status: 'pending' },
    ]);
    expect(TESTS).toEqual(["tests/person/work/markets.test.ts::the markets > are each country's own, every minimum as the research gives it", "tests/person/work/markets.test.ts::a script sold in a market > is paid its agreement's minimum, by form and tier, on the day it sells"]);
    expect(TOLD).toBe("tests/person/work/markets.test.ts::a script sold in a market > tells the player what of a market isn't known");
    expect(serializeCoverage(rows.slice(0, 2))).toBe(`${JSON.stringify({ engine: 'person.work', axis: 'market', universe: { keys: ['AA', 'BB'] }, rows: rows.slice(0, 2) }, null, 1)}\n`);
  });

  it('is built from the compiled markets and the register', () => {
    const root = mkdtempSync(join(tmpdir(), 'markets-writer-cov-'));
    const put = (path: string, body: unknown) => {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(body));
    };
    put(OUTPUT, { markets: { AA: {}, BB: {} }, agreements: {} });
    put('research/register.json', { entries: [{ id: 'R-1', fact: 'person.markets.writer.AA' }, { id: 'R-2', fact: 'person.markets.writer.blocked.BB' }] });
    expect(COVERAGE).toBe('coverage/markets-writer-countries.json');
    expect(coverageOf(root)).toBe(serializeCoverage([{ key: 'AA', status: 'researched', register: ['R-1'], tests: TESTS }, { key: 'BB', status: 'blocked', register: ['R-2'], tests: [...TESTS, TOLD] }]));
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
  });
});
