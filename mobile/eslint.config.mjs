import expoConfig from 'eslint-config-expo/flat.js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...expoConfig,
  eslintConfigPrettier,
  {
    rules: {
      // Match existing code style
      'import/order': 'off',
      'import/namespace': 'off',
      // The codebase uses default exports for screen components
      'import/no-default-export': 'off',
      // Allow unused vars when prefixed with _ (for catch clauses, event params, etc.)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['.expo/', 'node_modules/', 'dist/', 'android/', 'ios/', 'babel.config.js'],
  },
]);
