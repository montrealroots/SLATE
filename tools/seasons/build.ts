import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readSeasons, serialize } from './compile.ts';

/** Writes the seasons' starting moments the clock reads (npx tsx tools/seasons/build.ts). */
const root = resolve(import.meta.dirname, '../..');
const s = readSeasons(root);
writeFileSync(join(root, OUTPUT), serialize(s));
console.log(`USNO seasons ${s.first} to ${s.last} -> ${OUTPUT}`);
