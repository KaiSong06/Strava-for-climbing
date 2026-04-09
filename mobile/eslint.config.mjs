import expoConfig from 'eslint-config-expo/flat.js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...expoConfig,
  eslintConfigPrettier,
  {
    plugins: {
      'react-native-a11y': reactNativeA11y,
    },
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

      // ── Accessibility ───────────────────────────────────────────────────
      // Every interactive touchable (Pressable, Touchable*) MUST have
      // accessibility metadata. The AccessiblePressable wrapper in
      // src/components/ui/ enforces this at the type level; these lint
      // rules are the safety net for raw touchables that slip past review.
      //
      // The plugin auto-detects Pressable, TouchableOpacity, TouchableHighlight,
      // TouchableWithoutFeedback, TouchableNativeFeedback, and TouchableBounce
      // as touchables by default (see lib/util/isTouchable.js).
      'react-native-a11y/has-valid-accessibility-descriptors': 'error',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-actions': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
      'react-native-a11y/has-valid-accessibility-value': 'error',
      'react-native-a11y/has-valid-important-for-accessibility': 'error',
      'react-native-a11y/no-nested-touchables': 'error',
    },
  },
  {
    // FeedCard is being rewritten in a separate sprint — do not block lint
    // on its legacy a11y holes. Remove this exception once that sprint lands.
    files: ['src/components/FeedCard.tsx'],
    rules: {
      'react-native-a11y/has-valid-accessibility-descriptors': 'off',
    },
  },
  {
    ignores: ['.expo/', 'node_modules/', 'dist/', 'android/', 'ios/', 'babel.config.js'],
  },
]);
