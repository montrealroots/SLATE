import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readIds, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the identity documents the papers engine reads and their coverage (npx tsx tools/papers/ids/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const ids = readIds(root);
writeFileSync(join(root, OUTPUT), serialize(ids));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Identity documents: ${Object.keys(ids).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
