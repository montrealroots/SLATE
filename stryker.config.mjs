// @ts-check
/**
 * Mutation testing: the gate's own code is mutated, and its tests must catch each mutant, so a check that stops
 * biting can't pass unseen. Each later layer adds its engines to `mutate` as it's built.
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['gate/**/*.ts', 'gate/eslint/plugin.js', 'tests/support/falsify-core.ts', '!gate/test/**', '!gate/cli.ts', '!gate/lock-owner-docs.ts'],
  coverageAnalysis: 'perTest',
  // Stryker would write a type-check-disabling header into every file it copies, the owner's kept source included,
  // which the owner-documents lock rightly calls a change. Vitest doesn't type-check, so nothing needs it.
  disableTypeChecks: false,
  // Constants evaluated when a module loads (patterns, lists, paths) are mutated too: they're rules the gate holds.
  ignoreStatic: false,
  reporters: ['clear-text', 'progress', 'json', 'html'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  // Every mutant is killed, or the line it sits on says why it can't be (a `Stryker disable` comment with the reason).
  thresholds: { high: 100, low: 100, break: 100 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};
