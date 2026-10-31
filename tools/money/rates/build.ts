import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readRates, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each currency's rates, as the money engine reads them, and their coverage (npx tsx tools/money/rates/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const rates = readRates(root);
writeFileSync(join(root, OUTPUT), serialize(rates));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Rates: ${Object.keys(rates.currencies).length} currencies -> ${OUTPUT}, coverage -> ${COVERAGE}`);
