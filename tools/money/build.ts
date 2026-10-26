import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readListOne, serialize } from './compile.ts';

/** Writes the currencies the money engine reads (npx tsx tools/money/build.ts). */
const root = resolve(import.meta.dirname, '../..');
const c = readListOne(root);
writeFileSync(join(root, OUTPUT), serialize(c));
console.log(`ISO 4217 list one of ${c.published}: ${Object.keys(c.currencies).length} currencies in use -> ${OUTPUT}`);
