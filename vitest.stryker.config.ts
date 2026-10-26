import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';

/**
 * Mutation testing runs the suite once per mutant, so it leaves out the exhaustive oracle runs (every zone against zic
 * and against ICU, tens of seconds each); the sample of zones held to the oracle in tests/core/time/zones.test.ts and
 * the unit tests stand in for them there. The gate's own test run keeps them.
 */
export default mergeConfig(base, defineConfig({ test: { exclude: ['**/node_modules/**', '.stryker-tmp/**', 'tests/**/*.oracle.test.ts', 'tests/**/*.icu.test.ts'] } }));
