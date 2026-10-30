import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readNumbers, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the national numbers the papers engine reads and their coverage (npx tsx tools/papers/numbers/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const numbers = readNumbers(root);
writeFileSync(join(root, OUTPUT), serialize(numbers));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`National numbers: ${Object.keys(numbers).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
