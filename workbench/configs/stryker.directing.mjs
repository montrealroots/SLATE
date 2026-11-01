import base from '../../stryker.config.mjs';
// Its own temporary directory, so it runs beside the other roles' mutation runs.
export default { ...base, mutate: ['src/person/directing/**/*.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/directing.json' }, tempDirName: '.stryker-tmp-directing', ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], vitest: { configFile: 'workbench/configs/vitest.directing.config.mjs' } };
