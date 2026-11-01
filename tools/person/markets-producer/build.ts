import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readMarkets, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the markets the producer's engine reads, and their coverage (npx tsx tools/person/markets-producer/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const markets = readMarkets(root);
writeFileSync(join(root, OUTPUT), serialize(markets));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Producer markets: ${Object.keys(markets).length} markets -> ${OUTPUT}, coverage -> ${COVERAGE}`);
