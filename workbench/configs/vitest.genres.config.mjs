import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged with (mergeConfig would join the arrays and run every test).
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/genres/**/*.test.ts', 'tests/person/work/**/*.test.ts', 'tests/person/producing/**/*.test.ts'] } });
