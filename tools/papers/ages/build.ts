import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readAges, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes what a person may do at what age in each country, as the papers engine reads it, and its coverage (npx tsx tools/papers/ages/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const ages = readAges(root);
writeFileSync(join(root, OUTPUT), serialize(ages));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Ages: ${Object.keys(ages).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
