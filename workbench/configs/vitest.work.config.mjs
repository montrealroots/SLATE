import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged. The run over every place is left out, as vitest.stryker.config.ts leaves
// it out; so are the checks that the built files are as the research builds them (they compare files, not code, and
// hold once the register cites the research as changed; the gate's run keeps them).
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/tools/work.test.ts', 'tests/papers/work/work.test.ts'], testNamePattern: /^(?!.*as built from the (research|repository)).*$/ } });
