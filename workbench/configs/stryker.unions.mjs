import base from '../../stryker.config.mjs';
export default { ...base, mutate: ['src/person/unions/**/*.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/unions.json' }, ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], tempDirName: '.stryker-tmp-unions', vitest: { configFile: 'workbench/configs/vitest.unions.config.mjs', related: false } };
