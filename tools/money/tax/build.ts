import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readTax, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each country's tax, as the money engine reads it, and its coverage (npx tsx tools/money/tax/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const tax = readTax(root);
writeFileSync(join(root, OUTPUT), serialize(tax));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Tax: ${Object.keys(tax.countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
