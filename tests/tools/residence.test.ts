import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPLY, compileResidence, FOR, OUTPUT, readResidence, serialize, SOURCES, TERM_UNITS, WORK } from '../../tools/papers/residence/compile.ts';
import { COVERAGE, coverageOf, residenceCoverage, TESTS, TOLD } from '../../tools/papers/residence/coverage.ts';
import { NO_PLACES } from '../../tools/papers/passports/coverage.ts';

const ROOT = resolve(import.meta.dirname, '../..');

const route = (over: Record<string, unknown> = {}) => ({ id: 'talent', name: 'Global Talent visa', for: 'talent', apply: 'either', work: 'any', ...over });
const file = (over: Record<string, unknown> = {}) => ({ country: 'GB', routes: [route()], note: 'anything', sources: [], ...over });
const at = (r: Record<string, unknown>) => compileResidence('GB', file({ routes: [r] })).routes[0];

describe('the residence permissions compile', () => {
  it('takes a country to its routes, with what the research states of each', () => {
    expect([SOURCES, OUTPUT]).toEqual(['research/sources/papers/residence', 'src/papers/residence/residence.json']);
    expect(FOR).toEqual(['work', 'self-employed', 'talent', 'family', 'study', 'means', 'retirement', 'permanent', 'free movement']);
    expect([APPLY, WORK, TERM_UNITS]).toEqual([['abroad', 'in country', 'either'], ['any', 'sponsor', 'none'], ['day', 'week', 'month', 'year']]);
    expect(compileResidence('GB', file())).toStrictEqual({ routes: [{ id: 'talent', name: 'Global Talent visa', for: 'talent', apply: 'either', work: 'any' }] });
    const full = { fee: '766', within: { n: 3, unit: 'week' }, term: { n: 5, unit: 'year' }, renewable: true, counts: true, permanentAfter: 3 };
    expect(at(route(full))).toStrictEqual({ id: 'talent', name: 'Global Talent visa', for: 'talent', apply: 'either', work: 'any', fee: { currency: 'GBP', minor: 76600 }, within: { n: 3, unit: 'week' }, term: { n: 5, unit: 'year' }, renewable: true, counts: true, permanentAfter: 3 });
    expect(compileResidence('GB', file({ currency: 'USD', routes: [route({ fee: '1' })] })).routes[0]?.fee).toStrictEqual({ currency: 'USD', minor: 100 });
    expect(at(route({ id: 'eu', for: 'free movement', groups: ['EU/EEA', 'CH'] }))?.groups).toEqual(['EU/EEA', 'CH']);
    expect(at(route({ for: 'permanent', term: { n: 1, unit: 'day' } }))?.term).toEqual({ n: 1, unit: 'day' });
    expect(at(route({ permanentAfter: 1 }))?.permanentAfter).toBe(1);
    expect(compileResidence('GB', file({ routes: [route(), route({ id: 'skilled', for: 'work' })] })).routes.map((r) => r.id)).toEqual(['talent', 'skilled']);
    // The currency is read only where a fee is.
    expect(compileResidence('GB', file({ currency: 'XXX' })).routes).toHaveLength(1);
  });

  it('refuses a route that is not what it says it is', () => {
    expect(() => compileResidence('XX', file())).toThrow('XX is not a country on the map');
    expect(() => compileResidence('GB', file({ country: 'IE' }))).toThrow("GB's file is for IE");
    expect(() => compileResidence('GB', file({ visas: [] }))).toThrow('GB has no term visas');
    for (const routes of [undefined, [], {}]) expect(() => compileResidence('GB', file({ routes }))).toThrow('GB has no routes');
    expect(() => compileResidence('GB', file({ routes: [route(), route()] }))).toThrow('GB has two routes of one id');
    expect(() => compileResidence('GB', file({ routes: [7] }))).toThrow("GB's route 0 is not an object");
    expect(() => at(route({ cost: '1' }))).toThrow("GB's route 0 has no term cost");
    for (const id of [undefined, '', 7]) expect(() => at(route({ id }))).toThrow("GB's route 0 needs an id");
    for (const name of [undefined, '', 7]) expect(() => at(route({ name }))).toThrow("GB's route 0 (talent) needs its name");
    expect(() => at(route({ for: 'fun' }))).toThrow("GB's route 0 (talent)'s for is one of work, self-employed, talent, family, study, means, retirement, permanent, free movement");
    expect(() => at(route({ apply: 'online' }))).toThrow("GB's route 0 (talent)'s apply is one of abroad, in country, either");
    expect(() => at(route({ work: undefined }))).toThrow("GB's route 0 (talent)'s work is one of any, sponsor, none");
    expect(() => at(route({ fee: 766 }))).toThrow("GB's route 0 (talent)'s fee is an amount written out in major units");
    expect(() => compileResidence('GB', file({ currency: 'XXX', routes: [route({ fee: '1' })] }))).toThrow("GB's fees are in XXX, not a currency in use");
    expect(() => at(route({ within: { n: 1, unit: 'year' } }))).toThrow("GB's route 0 (talent)'s within is a whole number");
    for (const term of [5, null, { n: 0, unit: 'year' }, { n: 1.5, unit: 'year' }, { n: 1, unit: 'hour' }, { n: 1, unit: 'year', or: 2 }, { n: 1 }]) {
      expect(() => at(route({ term })), JSON.stringify(term)).toThrow("GB's route 0 (talent)'s term is a whole number of days, weeks, months or years");
    }
    expect(() => at(route({ renewable: false }))).toThrow("GB's route 0 (talent) says it is renewable only as renewable: true");
    expect(() => at(route({ counts: 'yes' }))).toThrow("GB's route 0 (talent) says its years count only as counts: true");
    for (const permanentAfter of [0, 2.5, '5']) expect(() => at(route({ permanentAfter }))).toThrow("GB's route 0 (talent) leads to permanent residence after a whole number of years, unless it is permanent");
    expect(() => at(route({ for: 'permanent', permanentAfter: 5 }))).toThrow('unless it is permanent');
    expect(() => at(route({ groups: ['EU/EEA'] }))).toThrow("GB's route 0 (talent) names groups if and only if it is free movement");
    expect(() => at(route({ for: 'free movement' }))).toThrow("GB's route 0 (talent) names groups if and only if it is free movement");
    for (const groups of ['EU/EEA', [], [''], [7], ['CH', ''], ['CH', 'CH']]) expect(() => at(route({ for: 'free movement', groups }))).toThrow("GB's route 0 (talent)'s groups are distinct names");
  });

  it('reads only files the register cites, and a territory as the country whose permits it follows', () => {
    const root = mkdtempSync(join(tmpdir(), 'residence-'));
    mkdirSync(join(root, 'research'), { recursive: true });
    const entries: unknown[] = [];
    const register = () => writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries }));
    register();
    expect(readResidence(root)).toEqual({});
    mkdirSync(join(root, SOURCES), { recursive: true });
    for (const [code, body] of [['GB', file()], ['GI', { country: 'GI', issuedBy: 'GB' }]] as const) {
      const text = JSON.stringify(body);
      writeFileSync(join(root, SOURCES, `${code}.json`), text);
      entries.push({ fact: `papers.residence.${code}`, value: { file: `${SOURCES}/${code}.json`, sha256: createHash('sha256').update(text).digest('hex') } });
    }
    register();
    expect(readResidence(root)).toStrictEqual({ GB: compileResidence('GB', file()), GI: { issuedBy: 'GB' } });
    writeFileSync(join(root, SOURCES, 'GI.json'), JSON.stringify({ country: 'GI', issuedBy: 'ES' }));
    entries[1] = { fact: 'papers.residence.GI', value: { file: `${SOURCES}/GI.json`, sha256: createHash('sha256').update(JSON.stringify({ country: 'GI', issuedBy: 'ES' })).digest('hex') } };
    register();
    expect(() => readResidence(root)).toThrow("GI's permits are ES's, which the game doesn't keep in its own right");
    writeFileSync(join(root, SOURCES, 'GI.json'), JSON.stringify({ country: 'GI', issuedBy: 'GB', routes: [] }));
    expect(() => readResidence(root)).toThrow(`${SOURCES}/GI.json isn't the file the register cites`);
    // A citation by another engine's fact doesn't count.
    const gi = JSON.stringify({ country: 'GI', issuedBy: 'GB' });
    writeFileSync(join(root, SOURCES, 'GI.json'), gi);
    entries[1] = { fact: 'papers.numbers.GI', value: { file: `${SOURCES}/GI.json`, sha256: createHash('sha256').update(gi).digest('hex') } };
    register();
    expect(() => readResidence(root)).toThrow(`${SOURCES}/GI.json isn't cited by the register`);
    expect(serialize({ GI: { issuedBy: 'GB' } })).toBe('{\n "GI": {\n  "issuedBy": "GB"\n }\n}\n');
  });

  it('names the permits in a territory\'s refusal', () => {
    const root = mkdtempSync(join(tmpdir(), 'residence-'));
    mkdirSync(join(root, SOURCES), { recursive: true });
    const text = JSON.stringify({ country: 'GI', issuedBy: 'GB', routes: [] });
    writeFileSync(join(root, SOURCES, 'GI.json'), text);
    writeFileSync(join(root, 'research/register.json'), JSON.stringify({ entries: [{ fact: 'papers.residence.GI', value: { file: `${SOURCES}/GI.json`, sha256: createHash('sha256').update(text).digest('hex') } }] }));
    expect(() => readResidence(root)).toThrow("GI, whose permits are GB's, has no term routes");
  });

  it("is the engine's file, as built from the research", () => {
    expect(readFileSync(join(ROOT, OUTPUT), 'utf8')).toBe(serialize(readResidence(ROOT)));
  });
});

describe('the residence permissions coverage', () => {
  it('is researched where compiled and cited, blocked where the register holds a blocker, proven where no one lives', () => {
    const facts = new Map([['papers.residence.GB', 'R-1'], ['papers.residence.blocked.KP', 'R-3'], ['papers.numbers.FR', 'R-5']]);
    expect(residenceCoverage(['GB', 'KP', 'FR', 'AQ'], new Set(['GB', 'KP', 'FR']), new Set(['GB', 'FR']), facts)).toEqual([
      { key: 'GB', status: 'researched', register: ['R-1'], tests: TESTS },
      { key: 'KP', status: 'blocked', register: ['R-3'], tests: [...TESTS, TOLD] },
      { key: 'FR', status: 'pending' },
      { key: 'AQ', status: 'proven', tests: [NO_PLACES] },
    ]);
    expect(TESTS).toEqual(["tests/papers/residence/residence.test.ts::the residence permissions > are each country's own", 'tests/papers/residence/residence.places.test.ts::the residence permissions > for every place on the map']);
    expect(TOLD).toBe("tests/papers/residence/residence.test.ts::the residence permissions > tell the player what the game doesn't know");
  });

  it('is the matrix the gate holds, as built from the repository', () => {
    expect(COVERAGE).toBe('coverage/residence-countries.json');
    expect(readFileSync(join(ROOT, COVERAGE), 'utf8')).toBe(coverageOf(ROOT));
    expect(JSON.parse(coverageOf(ROOT))).toMatchObject({ engine: 'papers.residence', axis: 'country' });
  });
});
