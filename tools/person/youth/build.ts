import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readYouth, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes what a minor meets in each country's screen work, as the youth engine reads it, and its coverage (npx tsx tools/person/youth/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const countries = readYouth(root);
writeFileSync(join(root, OUTPUT), serialize(countries));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Youth: ${Object.keys(countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
