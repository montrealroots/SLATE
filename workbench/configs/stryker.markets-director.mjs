import base from '../../stryker.config.mjs';
// Its own temporary directory, so it runs beside the other roles' mutation runs.
export default { ...base, mutate: ['src/person/directing/directing.ts', 'tools/person/markets-director/compile.ts', 'tools/person/markets-director/coverage.ts'], reporters: ['clear-text', 'json'], jsonReporter: { fileName: 'reports/mutation/markets-director.json' }, ignorePatterns: ['.stryker-tmp*', 'reports', 'graphify-out'], tempDirName: '.stryker-tmp-markets-director', vitest: { configFile: 'workbench/configs/vitest.markets-director.config.mjs' } };
