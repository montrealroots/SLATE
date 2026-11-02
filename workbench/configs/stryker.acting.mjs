import base from '../../stryker.config.mjs';
export default { ...base, mutate: ['src/person/acting/**/*.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/acting.json' }, ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], tempDirName: '.stryker-tmp-acting', vitest: { configFile: 'workbench/configs/vitest.acting.config.mjs' } };
