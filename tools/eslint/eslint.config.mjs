// ESLint for the merge checks (REVIEW-1): npm run check:merge lints the files a branch changes, and fails only on
// violations that are not in eslint-suppressions.json (the ones that existed when the check was introduced).
// TypeScript 6.0 in this folder only parses (typescript-eslint cannot use the root TypeScript 7); no type
// information, no typescript-eslint rules. Rules: react-hooks and the forbidden native controls (uiControls.mjs).
// Run it from the repository root (patterns are relative to the working directory): scripts/checks/mergeChecks.mjs does.
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import { uiControlsConfig } from './uiControls.mjs';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'tools/**', 'output/**', 'public/**', 'assets-inbox/**', '.omo/**'] },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',
      ecmaVersion: 'latest',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  uiControlsConfig,
];
