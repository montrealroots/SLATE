import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The base's include replaced, not merged (mergeConfig joins arrays), so only the director's tests run.
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/person/directing/**/*.test.ts'] } });
