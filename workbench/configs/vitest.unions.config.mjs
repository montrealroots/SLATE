import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include is replaced, not merged (mergeConfig concatenates arrays, which would run every test).
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/unions/**/*.test.ts'] } });
