import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readVisits, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes what a visitor needs to enter each country, as the papers engine reads it, and its coverage (npx tsx tools/papers/visits/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const visits = readVisits(root);
writeFileSync(join(root, OUTPUT), serialize(visits));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Visits: ${Object.keys(visits.countries).length} countries, ${Object.keys(visits.groups).length} shared lists -> ${OUTPUT}, coverage -> ${COVERAGE}`);
