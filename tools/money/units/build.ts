import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readUnits, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each index unit's values, as the money engine reads them, and their coverage (npx tsx tools/money/units/build.ts), after the register and the licences. */
const root = resolve(import.meta.dirname, '../../..');
const units = readUnits(root);
writeFileSync(join(root, OUTPUT), serialize(units));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Units: ${Object.keys(units.units).length} units -> ${OUTPUT}, coverage -> ${COVERAGE}`);
