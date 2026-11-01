import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vitest.config.ts';
export default mergeConfig(base, defineConfig({ test: { include: ['tests/money/tax/**/*.test.ts', 'tests/money/accounts/**/*.test.ts', 'tests/tools/tax.test.ts'] } }));
