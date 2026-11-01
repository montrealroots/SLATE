import { defineConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
// The tax engine's own tests only: mergeConfig would add these to the base's whole suite.
export default defineConfig({ ...base, test: { ...base.test, include: ['tests/money/tax/**/*.test.ts', 'tests/money/accounts/**/*.test.ts', 'tests/tools/tax.test.ts'] } });
