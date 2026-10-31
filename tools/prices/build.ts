import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readLevels, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the price levels the prices engine reads and their coverage (npx tsx tools/prices/build.ts), after the gazetteer and the register. */
const root = resolve(import.meta.dirname, '../..');
const { levels, unmapped } = readLevels(root);
if (unmapped.length > 0) console.log(`The World Bank prices economies the map has no country for: ${unmapped.join(', ')}`);
writeFileSync(join(root, OUTPUT), serialize(levels));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Prices: ${Object.keys(levels).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
