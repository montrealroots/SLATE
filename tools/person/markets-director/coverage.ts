import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOCKED, FACT, OUTPUT, type Markets } from './compile.ts';

/**
 * The director's markets' coverage matrix (coverage/markets-director-countries.json), a row for every country and
 * territory of the map (the gazetteer's 252). The US is the DGA's, the engine's own terms (R-4613). Elsewhere, a market
 * whose research the register cites (person.markets.director.<code>) with nothing blocked is researched; one with
 * blockers (person.markets.director.blocked.<code>) is blocked, citing them and its research, the player told what
 * isn't known; a country with neither, or with no market compiled, is pending.
 */
export const COVERAGE = 'coverage/markets-director-countries.json';
export const COUNTRIES = 'src/world/gazetteer/countries.json';
/** The US's terms: the DGA's, which the engine keeps (R-4613), held by its own tests. */
export const HOME = 'US';
export const DGA = 'person.work.director.calibration';

const T = 'tests/person/directing/markets.test.ts';
export const TESTS = [`${T}::the director's markets > are each country's own, every fee and period as the research gives it`, `${T}::a film in a market > is paid its agreement's minimum, by form, tier, date and the days it works`];
/** And a blocked row's: the test that shows the player told what of the market isn't known. */
export const TOLD = `${T}::a film in a market > tells the player what of a market isn't known`;
const D = "tests/person/directing/directing.test.ts::the DGA terms > ";
export const HOME_TESTS = [`${D}set a feature by its budget: pay, prep and the Director's Cut at every level's edge`, `${D}set an episode by the show: the network program rate, the guaranteed prep and shoot, the episode's cut`];

export type Row = { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] } | { key: string; status: 'pending' };

/** A row for every country: the US's from the DGA, each market's from its register entries, pending where it has no market or no entry. */
export function marketsCoverage(countries: readonly string[], markets: Markets['markets'], facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (key === HOME) {
      const dga = facts.get(DGA);
      return dga === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [dga], tests: HOME_TESTS };
    }
    const [own, blocker] = [facts.get(`${FACT}${key}`), facts.get(`${BLOCKED}${key}`)];
    if (!Object.hasOwn(markets, key)) return { key, status: 'pending' };
    if (blocker !== undefined) return { key, status: 'blocked', register: [blocker, own].filter((id): id is string => id !== undefined), tests: [...TESTS, TOLD] };
    return own === undefined ? { key, status: 'pending' } : { key, status: 'researched', register: [own], tests: TESTS };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'person.directing', axis: 'country', rows }, null, 1)}\n`;

/** The coverage from the map's countries, the compiled markets and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read(COUNTRIES) as Record<string, unknown>);
  const markets = (read(OUTPUT) as Markets).markets;
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(marketsCoverage(countries, markets, facts));
}
