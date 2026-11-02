import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readMarkets, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes the markets the actor's engine reads, and their coverage (npx tsx tools/person/markets/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const markets = readMarkets(root);
writeFileSync(join(root, OUTPUT), serialize(markets));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Markets: ${Object.keys(markets.markets).length} markets, ${Object.keys(markets.agreements).length} agreements -> ${OUTPUT}, coverage -> ${COVERAGE}`);
