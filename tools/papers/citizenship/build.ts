import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readCitizenship, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the citizenship rules the papers engine reads and their coverage (npx tsx tools/papers/citizenship/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const rules = readCitizenship(root);
writeFileSync(join(root, OUTPUT), serialize(rules));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Citizenship: ${Object.keys(rules).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
