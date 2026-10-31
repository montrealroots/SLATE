import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readLicences, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the licences and cards the papers engine reads and their coverage (npx tsx tools/papers/licence/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const licences = readLicences(root);
writeFileSync(join(root, OUTPUT), serialize(licences));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Licences: ${Object.keys(licences).length} countries and regions -> ${OUTPUT}, coverage -> ${COVERAGE}`);
