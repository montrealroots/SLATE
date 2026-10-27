import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Kept } from '../../src/world/holidays/holidays.ts';
import { holidaysCoverage, OUTPUT, serializeCoverage } from './coverage.ts';

/** The holidays' coverage from the rules, the gazetteer's countries and places, and the register's facts. */
export function coverageOf(root: string): string {
  const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8')) as unknown;
  const countries = Object.keys(read('src/world/gazetteer/countries.json') as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const rules = read('src/world/holidays/countries.json') as Record<string, Kept>;
  const facts = new Map((read('research/register.json') as { entries: { id: string; fact: string }[] }).entries.map((e) => [e.fact, e.id] as const));
  return serializeCoverage(holidaysCoverage(countries, withPlaces, rules, facts));
}

/** Writes the holidays' coverage (npx tsx tools/holidays/build.ts), after the gazetteer and the register. */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'build.ts')) {
  const root = resolve(import.meta.dirname, '../..');
  writeFileSync(join(root, OUTPUT), coverageOf(root));
  console.log(`Holidays: coverage -> ${OUTPUT}`);
}
