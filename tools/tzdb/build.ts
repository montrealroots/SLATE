import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readRelease, serialize } from './compile.ts';

/** Writes the compiled time zone data the engine reads (npx tsx tools/tzdb/build.ts). */
const root = resolve(import.meta.dirname, '../..');
const { data } = readRelease(root);
writeFileSync(join(root, OUTPUT), serialize(data));
console.log(`tzdb ${data.version}: ${Object.keys(data.zones).length} zones, ${Object.keys(data.links).length} links, ${Object.keys(data.rules).length} rule sets -> ${OUTPUT}`);
