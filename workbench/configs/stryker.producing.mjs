import base from '../../stryker.config.mjs';
export default { ...base, mutate: ['src/person/producing/**/*.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/producing.json' }, ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], tempDirName: '.stryker-tmp-producing', vitest: { configFile: 'workbench/configs/vitest.producing.config.mjs' } };
