import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged (mergeConfig concatenates arrays, which would run every test). The checks
// that the built files are as the research builds them are left out (they compare files, not code; the gate's run keeps them).
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/youth/youth.test.ts', 'tests/tools/youth.test.ts', 'tests/person/acting/acting.test.ts', 'tests/person/directing/directing.test.ts', 'tests/person/producing/producing.test.ts', 'tests/person/work/career.test.ts', 'tests/person/acting/markets.test.ts', 'tests/person/directing/markets.test.ts', 'tests/person/producing/markets.test.ts', 'tests/person/work/markets.test.ts'], testNamePattern: /^(?!.*as built from the (research|repository)).*$/ } });
