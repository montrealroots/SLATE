import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readBanks, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each country's banks, as the money engine reads them, and their coverage (npx tsx tools/money/banks/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const banks = readBanks(root);
writeFileSync(join(root, OUTPUT), serialize(banks));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Banks: ${Object.keys(banks.countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
