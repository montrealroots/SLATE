import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileWithZic, ROOT, SAMPLE, zdump } from '../../tests/core/time/zdump.ts';

/** Writes the oracle's account of the sample zones, for the fast tests; the oracle test holds it to live zdump. */
export const FIXTURE = 'tests/core/time/fixtures/zdump-sample.txt';
export const render = (dir: string) => SAMPLE.map((zone) => [`# ${zone}`, ...zdump(dir, zone)].join('\n')).join('\n') + '\n';

if (process.argv[1]?.endsWith('zdump-sample.ts')) {
  writeFileSync(join(ROOT, FIXTURE), render(compileWithZic()));
  console.log(`${SAMPLE.length} zones -> ${FIXTURE}`);
}
