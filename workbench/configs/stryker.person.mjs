import base from '../../stryker.config.mjs';
export default { ...base, mutate: ['src/person/**/*.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/person.json' }, ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], vitest: { configFile: 'workbench/configs/vitest.person.config.mjs' } };
