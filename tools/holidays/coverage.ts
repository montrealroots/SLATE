import type { Kept } from '../../src/world/holidays/holidays.ts';
import type { When } from '../../src/world/holidays/rules.ts';

/**
 * The holidays' coverage matrix (coverage/holidays-countries.json), from the rules and the register: a country whose
 * rules are kept and whose official lists the register holds (world.holidays.<code>) is researched, citing those and
 * the reckonings its rules stand on (the calendars, the two Easters, the clock's equinoxes); such a country with a region
 * whose own the register couldn't find (world.holidays.blocked.<region>) is blocked, citing that blocker too; one without is blocked where the
 * register holds its blocker (world.holidays.blocked.<code>), else pending; a country with no place of its own is
 * proven by the gazetteer's test that it has none.
 */
export const OUTPUT = 'coverage/holidays-countries.json';

/** The register entries of the reckonings a rule's day stands on, by its kind. */
export const RECKONINGS = { lunar: 'R-0106', easter: 'R-0107', orthodox: 'R-0108', equinox: 'R-0036' } as const;

const T = 'tests/world/holidays/holidays.test.ts';
export const TESTS = [`${T}::the holidays of every country kept > are the days its official lists name, list by list`, 'tests/world/holidays/holidays.places.test.ts::the holidays > at every place on the map'];
/** And a blocked row's: the test that shows the player told its holidays aren't kept. */
export const TOLD = `${T}::the holidays > tell the player where a country's aren't kept`;
/** And the row's of a country with a region blocked (world.holidays.blocked.<region>): the test that shows the player told. */
export const TOLD_REGION = `${T}::the holidays > tell the player where a region's own aren't kept`;
export const NO_PLACES = 'tests/world/gazetteer/gazetteer.test.ts::places > are none in the six countries with no populated place of their own';

export type Row =
  | { key: string; status: 'researched' | 'blocked'; register: string[]; tests: string[] }
  | { key: string; status: 'pending' }
  | { key: string; status: 'proven'; tests: string[] };

/** The reckonings a rule's day stands on: a shift by Easter stands on the Western Easter too. */
function reckonings(when: When, shifted: boolean): string[] {
  const out: string[] = shifted ? [RECKONINGS.easter] : [];
  if ('lunar' in when) out.push(RECKONINGS.lunar);
  if ('easter' in when) out.push(when.orthodox === true ? RECKONINGS.orthodox : RECKONINGS.easter);
  if ('equinox' in when) out.push(RECKONINGS.equinox);
  return out;
}

export function holidaysCoverage(countries: readonly string[], withPlaces: ReadonlySet<string>, rules: Readonly<Record<string, Kept>>, facts: ReadonlyMap<string, string>): Row[] {
  return countries.map((key): Row => {
    if (!withPlaces.has(key)) return { key, status: 'proven', tests: [NO_PLACES] };
    const lists = facts.get(`world.holidays.${key}`);
    const own = rules[key];
    // A country keeping another's holidays cites that one's lists and reckonings too.
    const of = own !== undefined && 'of' in own ? own.of : undefined;
    const kept = of === undefined ? own : rules[of];
    if (kept !== undefined && 'holidays' in kept && lists !== undefined) {
      const others = of === undefined ? [] : [facts.get(`world.holidays.${of}`) as string];
      const regions = [...facts].filter(([fact]) => fact.startsWith(`world.holidays.blocked.${key}.`)).map(([, id]) => id);
      const register = new Set([lists, ...others, ...regions, ...kept.holidays.flatMap((r) => reckonings(r.when, r.shift !== undefined))]);
      return regions.length > 0 ? { key, status: 'blocked', register: [...register].sort(), tests: [...TESTS, TOLD_REGION] } : { key, status: 'researched', register: [...register].sort(), tests: TESTS };
    }
    const blocker = facts.get(`world.holidays.blocked.${key}`);
    return blocker === undefined ? { key, status: 'pending' } : { key, status: 'blocked', register: [blocker], tests: [...TESTS, TOLD] };
  });
}

export const serializeCoverage = (rows: readonly Row[]) => `${JSON.stringify({ engine: 'world.holidays', axis: 'country', rows }, null, 1)}\n`;
