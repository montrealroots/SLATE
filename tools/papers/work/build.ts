import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readWork, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes what a performer needs to live and work in each country, as the papers engine reads it, and its coverage (npx tsx tools/papers/work/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const work = readWork(root);
writeFileSync(join(root, OUTPUT), serialize(work));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Work: ${Object.keys(work.countries).length} countries, ${Object.keys(work.groups).length} shared lists -> ${OUTPUT}, coverage -> ${COVERAGE}`);
