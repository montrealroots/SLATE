import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged (mergeConfig concatenates arrays, which would run every test). The run over
// every place of the map is left out, as vitest.stryker.config.ts leaves it out; the checks that the built files are as
// the research builds them stay in, since they are what holds each reading's key in tools/papers/ages/person.ts.
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/tools/ages.test.ts', 'tests/papers/ages/ages.test.ts'] } });
