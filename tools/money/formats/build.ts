import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readFormats, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes how each country's banks number their accounts, as the money engine reads it, and its coverage (npx tsx tools/money/formats/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const formats = readFormats(root);
writeFileSync(join(root, OUTPUT), serialize(formats));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Account formats: ${Object.keys(formats.countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
