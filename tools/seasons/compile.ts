import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Compiles the moments the seasons begin from USNO's equinoxes and solstices (register R-0036), as read into
 * research/sources/usno-seasons.json: for each year from 1800 to 2100, the March equinox, the June solstice, the
 * September equinox and the December solstice, in seconds UT.
 */
export const SOURCE = 'research/sources/usno-seasons.json';
export const OUTPUT = 'src/world/clock/seasons.json';

interface Event {
  phenom: string;
  year: number;
  month: number;
  day: number;
  time: string;
}

export interface Seasons {
  first: number;
  last: number;
  /** For each year from `first`, the four moments in seconds UT: March, June, September, December. */
  starts: [number, number, number, number][];
}

const ORDER = [
  ['Equinox', 3],
  ['Solstice', 6],
  ['Equinox', 9],
  ['Solstice', 12],
] as const;

export function compileSeasons(source: { years: Record<string, Event[]> }): Seasons {
  // A year is an integer key, and JSON keeps integer keys in ascending order.
  const years = Object.keys(source.years).map(Number);
  const first = years[0] as number;
  const last = years.at(-1) as number;
  const starts: Seasons['starts'] = [];
  for (let year = first; year <= last; year += 1) {
    const events = source.years[String(year)];
    if (events === undefined) throw new Error(`the source has no year ${year}`);
    if (events.length !== 4) throw new Error(`${year} has ${events.length} equinoxes and solstices, not 4`);
    starts.push(
      events.map((e, i) => {
        const [phenom, month] = ORDER[i] as (typeof ORDER)[number];
        const time = /^(\d{2}):(\d{2})$/.exec(e.time);
        if (e.phenom !== phenom || e.month !== month || e.year !== year || time === null) throw new Error(`${year}'s event ${i + 1} isn't the ${phenom} of month ${month}: ${JSON.stringify(e)}`);
        return Date.UTC(year, month - 1, e.day, Number(time[1]), Number(time[2])) / 1000;
      }) as [number, number, number, number],
    );
  }
  return { first, last, starts };
}

export const readSeasons = (root: string) => compileSeasons(JSON.parse(readFileSync(join(root, SOURCE), 'utf8')) as { years: Record<string, Event[]> });
export const serialize = (s: Seasons) => `${JSON.stringify(s)}\n`;
