import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cited, compile, DEFINITIONS, MARKET, OUTPUT, serialize } from './compile.ts';

/** Writes the genres the genres engine reads (npx tsx tools/person/genres/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const genres = compile(cited(root, DEFINITIONS) as Parameters<typeof compile>[0], cited(root, MARKET) as Parameters<typeof compile>[1]);
writeFileSync(join(root, OUTPUT), serialize(genres));
console.log(`Genres: ${Object.keys(genres.genres).length} offered -> ${OUTPUT}`);
