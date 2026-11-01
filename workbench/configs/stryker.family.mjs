import base from '../../stryker.config.mjs';
// Its own temporary directory, so it runs beside the other readers' mutation runs.
export default { ...base, mutate: ['src/person/directing/directing.ts', 'src/person/work/career.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/family.json' }, tempDirName: '.stryker-tmp-family', ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], vitest: { configFile: 'workbench/configs/vitest.family.config.mjs' } };
