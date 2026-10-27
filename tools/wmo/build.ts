import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readStations, serialize, type Station, type Town } from './compile.ts';
import { OUTPUT as COVERAGE, serializeCoverage, weatherCoverage } from './coverage.ts';

/** The gazetteer's towns, as the station compiler places stations among them. */
export function readTowns(root: string): Town[] {
  const dir = join(root, 'src/world/gazetteer/places');
  return readdirSync(dir).flatMap((f) =>
    readFileSync(join(dir, f), 'utf8')
      .split('\n')
      .filter((l) => l !== '')
      .map((l) => {
        const c = l.split('\t');
        return { name: c[1] as string, country: f.slice(0, 2), latitude: Number(c[4]), longitude: Number(c[5]) };
      }),
  );
}

/** The weather's coverage from the stations, the gazetteer's countries and places, and the register's blockers. */
export function coverageOf(root: string, stations: readonly Station[]): string {
  const countries = Object.keys(JSON.parse(readFileSync(join(root, 'src/world/gazetteer/countries.json'), 'utf8')) as object);
  const withPlaces = new Set(readdirSync(join(root, 'src/world/gazetteer/places')).map((f) => f.slice(0, 2)));
  const register = JSON.parse(readFileSync(join(root, 'research/register.json'), 'utf8')) as { entries: { id: string; fact: string }[] };
  const blockers = new Map(register.entries.flatMap((e) => (e.fact.startsWith('world.weather.blocked.') ? [[e.fact.slice('world.weather.blocked.'.length), e.id] as const] : [])));
  return serializeCoverage(weatherCoverage(countries, withPlaces, stations, blockers));
}

/** Writes the weather's stations and its coverage (npx tsx tools/wmo/build.ts), after the gazetteer. */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.dirname, 'build.ts')) {
  const root = resolve(import.meta.dirname, '../..');
  const stations = readStations(root, readTowns(root));
  writeFileSync(join(root, OUTPUT), serialize(stations));
  writeFileSync(join(root, COVERAGE), coverageOf(root, stations));
  console.log(`Weather: ${stations.length} stations -> ${OUTPUT}, coverage -> ${COVERAGE}`);
}
