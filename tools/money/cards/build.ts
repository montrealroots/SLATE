import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readCards, serialize } from './compile.ts';
import { COVERAGE, coverageOf } from './coverage.ts';

/** Writes each country's credit cards, as the money engine reads them, and their coverage (npx tsx tools/money/cards/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const cards = readCards(root);
writeFileSync(join(root, OUTPUT), serialize(cards));
writeFileSync(join(root, COVERAGE), coverageOf(root));
console.log(`Cards: ${Object.keys(cards.countries).length} countries -> ${OUTPUT}, coverage -> ${COVERAGE}`);
