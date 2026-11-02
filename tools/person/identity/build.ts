import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compile, OUTPUT, readResearch, serialize } from './compile.ts';

/** Writes the languages the identity engine reads (npx tsx tools/person/identity/build.ts), after the register. */
const root = resolve(import.meta.dirname, '../../..');
const languages = compile(readResearch(root));
writeFileSync(join(root, OUTPUT), serialize(languages));
console.log(`Languages: ${Object.keys(languages.territories).length} territories, ${Object.keys(languages.names).length} languages -> ${OUTPUT}`);
