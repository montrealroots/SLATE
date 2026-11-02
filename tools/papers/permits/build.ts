import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readPermits, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the work permits, as the papers engine reads them, and their coverage (npx tsx tools/papers/permits/build.ts), after the register; says what of the research the game couldn't read. */
const root = resolve(import.meta.dirname, '../../..');
const { countries, unread } = readPermits(root);
writeFileSync(join(root, OUTPUT), serialize(countries));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Permits: ${Object.keys(countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
for (const u of unread) console.log(`  not read: ${u}`);
