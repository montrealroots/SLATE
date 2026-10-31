// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import slate from './gate/eslint/plugin.js';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'reports', '.stryker-tmp', '.gate', 'docs', 'workbench'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    // Dropping one field by destructuring the rest is how a copy without it is made.
    rules: { '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
  {
    // The app: the browser's, deterministic, and every word, control and value held to the mandate.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, slate },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'slate/no-raw-text': 'error',
      'slate/control-feature': 'error',
      'slate/shown-value-feature': 'error',
      // Every draw is keyed by the life's seed and a named decider; every reading of the time goes through the clock.
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Draw from the seeded decider, so every draw is reproducible.' },
        { object: 'Date', property: 'now', message: 'Read the time through the clock.' },
      ],
      'no-restricted-syntax': ['error', { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Read the time through the clock.' }],
    },
  },
);
