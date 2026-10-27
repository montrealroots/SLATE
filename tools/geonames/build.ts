import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { OUT, readGazetteer, serialize } from './compile.ts';

/** Writes the compiled gazetteer the engine reads (npx tsx tools/geonames/build.ts). */
const root = resolve(import.meta.dirname, '../..');
const g = readGazetteer(root);
rmSync(join(root, OUT, 'places'), { recursive: true, force: true });
for (const [path, text] of serialize(g)) {
  mkdirSync(dirname(join(root, OUT, path)), { recursive: true });
  writeFileSync(join(root, OUT, path), text);
}
const places = Object.values(g.places).reduce((n, list) => n + list.length, 0);
console.log(`GeoNames: ${Object.keys(g.countries).length} countries, ${Object.keys(g.regions).length} regions, ${places} places -> ${OUT}`);
