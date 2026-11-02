import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged (mergeConfig concatenates arrays, which would run every test). The run over
// every place of the map is left out, as vitest.stryker.config.ts leaves it out; so are the checks that the built files
// are as the research builds them (they compare files, not code, and hold only once the register cites the research as
// changed; the gate's run keeps them).
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/permits/permits.test.ts', 'tests/tools/permits.test.ts', 'tests/person/acting/**/*.test.ts', 'tests/person/unions/**/*.test.ts'], testNamePattern: /^(?!.*as built from the (research|repository)).*$/ } });
