import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include replaced, not merged (mergeConfig joins arrays), so only the tests of the files a family reaches run.
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/directing/**/*.test.ts', 'tests/person/work/career.test.ts'] } });
