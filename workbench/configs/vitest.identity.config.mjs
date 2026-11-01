import base from '../../vitest.config.ts';
// Only identity's tests (mergeConfig would add these to the base's include, not replace it).
export default { ...base, test: { ...base.test, include: ['tests/person/identity/**/*.test.ts'] } };
