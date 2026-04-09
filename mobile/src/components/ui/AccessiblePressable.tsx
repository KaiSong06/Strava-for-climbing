import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

/**
 * Accessible wrapper around React Native's `Pressable` that requires a11y metadata.
 *
 * Every interactive surface in the app must provide at least:
 *  - `accessibilityLabel` — a concise English description of what the control does
 *    (dynamic strings such as `Follow ${username}` are expected for context-specific controls)
 *  - `accessibilityRole` — the semantic role (defaults to `'button'`)
 *
 * Using this wrapper (instead of `Pressable` directly) lets the ESLint
 * `react-native-a11y` rules verify that every touchable has a label and role.
 *
 * Behavioural note: this is a thin pass-through — it does NOT change visual
 * styling, press handling, or animation behaviour. It only enforces that
 * `accessible` is set to `true` and that a label/role are supplied.
 */
export interface AccessiblePressableProps extends PressableProps {
  /** English-language label read by screen readers (e.g. `"Follow {username}"`). */
  accessibilityLabel: string;
  /** Semantic role. Defaults to `'button'`. */
  accessibilityRole?: PressableProps['accessibilityRole'];
}

export const AccessiblePressable = forwardRef<View, AccessiblePressableProps>(
  function AccessiblePressable(
    { accessibilityLabel, accessibilityRole = 'button', accessibilityState, ...rest },
    ref,
  ) {
    return (
      <Pressable
        ref={ref}
        accessible
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        {...rest}
      />
    );
  },
);
