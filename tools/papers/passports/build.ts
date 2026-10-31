import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readPassports, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the passports the papers engine reads and their coverage (npx tsx tools/papers/passports/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const { passports, pending } = readPassports(root);
writeFileSync(join(root, OUTPUT), serialize(passports));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Passports: ${Object.keys(passports).length} countries -> ${OUTPUT}, ${pending.length} files not yet in the engine's form (${pending.join(', ')}), coverage -> ${COVERAGE}`);
