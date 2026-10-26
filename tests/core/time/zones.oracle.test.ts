import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import tzdb from '../../../src/core/time/tzdb.json';
import type { TzData } from '../../../src/core/time/tzdb-types.ts';
import { zoneHistory } from '../../../src/core/time/zones.ts';
import { FIXTURE, render } from '../../../tools/tzdb/zdump-sample.ts';
import { asZdump, compileWithZic, ROOT, zdump } from './zdump.ts';

/**
 * The time engine against the reference tools for every zone of the release, 1800 to 2200: every transition's local
 * time, UT offset, abbreviation and daylight-saving flag, exactly as zic compiles and zdump reports them.
 */
const data = tzdb as TzData;
let dir = '';
beforeAll(() => {
  dir = compileWithZic();
}, 120_000);

describe('every zone, against zic and zdump', () => {
  it.each(Object.keys(data.zones))('%s', (zone) => {
    expect(asZdump(zoneHistory(data, data.zones[zone] as TzData['zones'][string]))).toEqual(zdump(dir, zone));
  });
  it('the sample the fast tests read is what zdump says today', () => {
    expect(readFileSync(join(ROOT, FIXTURE), 'utf8')).toBe(render(dir));
  });
});
