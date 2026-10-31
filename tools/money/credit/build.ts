import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readCredit, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each country's credit record, as the money engine reads it, and their coverage (npx tsx tools/money/credit/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const credit = readCredit(root);
writeFileSync(join(root, OUTPUT), serialize(credit));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Credit: ${Object.keys(credit.countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
