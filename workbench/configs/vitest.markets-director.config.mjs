import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged (mergeConfig concatenates arrays, which would run every test). The checks
// that the built files are as the research builds them are left out (they compare files, not code; the gate's run
// keeps them); the compile's own run over the twenty markets stays. The youth engine's tests hold prep's use of a minor's grant.
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/directing/**/*.test.ts', 'tests/tools/markets-director.test.ts', 'tests/person/youth/youth.test.ts'], testNamePattern: /^(?!.*as built from the (research|repository)).*$/ } });
