import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
import { AccessiblePressable } from './AccessiblePressable';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastProps {
  message: string;
  variant: ToastVariant;
  duration?: number;
  onDismiss?: () => void;
}

const ENTER_DURATION_MS = 220;
const EXIT_DURATION_MS = 180;
const SLIDE_OFFSET_PX = 24;
const ICON_SIZE = 20;
const DISMISS_ICON_SIZE = 18;
const TOAST_MAX_WIDTH_PX = 520;

function iconNameFor(variant: ToastVariant): React.ComponentProps<typeof MaterialCommunityIcons>['name'] {
  switch (variant) {
    case 'error':
      return 'alert-circle-outline';
    case 'success':
      return 'check-circle-outline';
    default:
      return 'information-outline';
  }
}

function iconColorFor(variant: ToastVariant): string {
  switch (variant) {
    case 'error':
      return colors.error;
    case 'success':
      return colors.primary;
    default:
      return colors.onSurfaceVariant;
  }
}

/**
 * Overlay toast primitive (Midnight Editorial).
 *
 * Animates in from below using transform + opacity only (compositor-friendly).
 * Sits above the bottom safe area and does NOT shift layout when mounting.
 * Error variants include a dismiss button.
 */
export function Toast({ message, variant, duration, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SLIDE_OFFSET_PX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();

    const timeoutId = setTimeout(() => {
      runDismiss();
    }, duration ?? 4000);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runDismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SLIDE_OFFSET_PX,
        duration: EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  }

  const bottomOffset = insets.bottom + spacing.xl;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { bottom: bottomOffset }]}
    >
      <Animated.View
        style={[
          styles.toast,
          variant === 'error' && styles.toastError,
          variant === 'success' && styles.toastSuccess,
          variant === 'info' && styles.toastInfo,
          { opacity, transform: [{ translateY }] },
        ]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <MaterialCommunityIcons
          name={iconNameFor(variant)}
          size={ICON_SIZE}
          color={iconColorFor(variant)}
          style={styles.icon}
        />
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
        {variant === 'error' && (
          <AccessiblePressable
            onPress={runDismiss}
            accessibilityLabel="Dismiss notification"
            hitSlop={spacing.sm}
            style={styles.dismiss}
          >
            <MaterialCommunityIcons
              name="close"
              size={DISMISS_ICON_SIZE}
              color={colors.onSurfaceVariant}
            />
          </AccessiblePressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.md,
    maxWidth: TOAST_MAX_WIDTH_PX,
    width: '100%',
    backgroundColor: colors.surfaceContainerHigh,
  },
  toastError: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  toastSuccess: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  toastInfo: {
    backgroundColor: colors.surfaceContainer,
  },
  icon: {
    flexShrink: 0,
  },
  message: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  dismiss: {
    padding: spacing.xs,
    marginRight: -spacing.xs,
    flexShrink: 0,
  },
});
