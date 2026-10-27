import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTPUT, readMap, serialize } from './compile.ts';

/** Writes the world map's outlines (npx tsx tools/naturalearth/build.ts), after the gazetteer. */
const root = resolve(import.meta.dirname, '../..');
const countries = new Set(Object.keys(JSON.parse(readFileSync(join(root, 'src/world/gazetteer/countries.json'), 'utf8')) as object));
const map = readMap(root, countries);
writeFileSync(join(root, OUTPUT), serialize(map));
console.log(`Natural Earth 1:110m: ${Object.keys(map.countries).length} countries drawn -> ${OUTPUT}`);
