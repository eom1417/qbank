import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { genesisStrictRules } from './.genesis/adapters/eslint.rules.mjs';

export default tseslint.config(
  // Platform-managed files (gitignored, re-provisioned by the host) are not project code.
  { ignores: ['dist/**', 'node_modules/**', '.data/**', '.dependency-cruiser.cjs', 'scripts/browser.mjs', '.browser/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: genesisStrictRules,
  },
  {
    files: ['src/web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/platform/config/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration through src/server/platform/config.' },
      ],
    },
  },
);
