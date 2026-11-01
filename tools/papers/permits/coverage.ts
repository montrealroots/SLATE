import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_PLACES } from '../passports/coverage.ts';
import { BLOCKED, freeToAll, type Kept, type Permit } from './compile.ts';

/**
 * The work permits' coverage matrix (coverage/permits-countries.json), from the compiled permits, papers.work's rules
 * and the register: a country every passport works in freely (papers.work) needs no permit and is proven, citing
 * papers.work's fact and the permit research's that confirms it; a country with a blocker (papers.permits.blocked.<code>,
 * the permit known in part or not at all) is blocked, citing it and the research's fact where there is one, the player
 * told what isn't known; one whose permit is compiled and cited (papers.permits.<code>) with nothing blocked and its
 * core facts read (who applies, the fees, a processing time, the term) is researched; any other is pending. A country with no place of its own is proven by the gazetteer's test that it has none.
 */
export const COVERAGE = 'coverage/permits-countries.json';

const T = 'tests/person/permits/permits.test.ts';
export const TESTS = [`${T}::the permits > are each country's own, as the research gives them`, 'tests/person/permits/permits.places.test.ts::the permits > for every place on the map'];
/** And a blocked row's: the test that shows the player told what of the permit isn't known. */
export const TOLD = `${T}::the permits > are held only where papers.work says a passport needs one, and where one isn't known whole the player is told what isn't`;
/** And a free country's: the test that shows every passport working there with no permit. */
export const FREE = `${T}::working in a country > is open by citizenship, by a permit in force on the day, or within the days a short engagement is worked without one`;

/** Whether a permit's core facts are read: who applies, the fees, a processing time, the term. */
export const coreKnown = (p: Permit): boolean => p.by !== null && p.fees !== null && (p.standard !== null || p.premium !== null) && p.term !== null;

export type Row =
  | { key: string; status: 'researched' | 'blocked' | 'proven'; register: string[]; tests: string[] }
  | { key: string; status: 'pending' }
  | { key: string; status: 'proven'; tests: string[] };

/** By country, `core` the countries whose compiled permit holds its core facts. */
export function permitsCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, free: ReadonlySet<string>, core: ReadonlySet<string>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const [own, blocker] = [facts.get(`papers.permits.${key}`), facts.get(`${BLOCKED}${key}`)];
    const cites = (...ids: (string | undefined)[]) => ids.filter((id): id is string => id !== undefined);
    const work = facts.get(`papers.work.${key}`);
    if (free.has(key) && work !== undefined) return { key, status: 'proven', register: cites(work, own, blocker), tests: [FREE] };
    if (blocker !== undefined) return { key, status: 'blocked', register: cites(blocker, own), tests: [...TESTS, TOLD] };
    return core.has(key) && own !== undefined ? { key, status: 'researched', register: [own], tests: TESTS } : { key, status: 'pending' };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'papers.permits', axis: 'country', rows }, null, 1)}\n`;

/** The permits' coverage from the compiled permits, papers.work's rules, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const work = (read('src/papers/work/work.json') as { countries: Record<string, Kept> }).countries;
  const free = new Set(Object.keys(work).filter((c) => freeToAll(work[c] as Kept)));
  const compiled = (read('src/person/permits/permits.json') as { countries: Record<string, Permit> }).countries;
  const core = new Set(Object.keys(compiled).filter((c) => coreKnown(compiled[c] as Permit)));
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(permitsCoverage(countries, withPlaces, free, core, facts));
}
