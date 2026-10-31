import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readMeans, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each country's families' means, as the money engine reads them, and their coverage (npx tsx tools/money/means/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const means = readMeans(root);
writeFileSync(join(root, OUTPUT), serialize(means));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Means: ${Object.keys(means.countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
