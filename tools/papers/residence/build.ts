import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readResidence, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the residence permissions the papers engine reads and their coverage (npx tsx tools/papers/residence/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const residence = readResidence(root);
writeFileSync(join(root, OUTPUT), serialize(residence));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Residence permissions: ${Object.keys(residence).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
