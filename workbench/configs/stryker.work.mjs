import base from '../../stryker.config.mjs';
export default { ...base, mutate: ['src/papers/work/**/*.ts', 'tools/papers/work/compile.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/work.json' }, ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], tempDirName: '.stryker-tmp-work', vitest: { configFile: 'workbench/configs/vitest.work.config.mjs' } };
