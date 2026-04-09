import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/src/theme/colors';
import { PROCESSING_MESSAGES } from '../constants';
import type { PipelineStatus } from '@/src/hooks/useVisionPipeline';

interface ProcessingOverlayProps {
  status: PipelineStatus;
  uploadProgress: number;
}

/**
 * Fullscreen overlay shown during `uploading` and `processing` states.
 *
 * Owns the Reanimated spinner pulse and the rotating processing message timer
 * so that RecordScreen does not need to. Returns null when the overlay is idle.
 */
export function ProcessingOverlay({ status, uploadProgress }: ProcessingOverlayProps) {
  const visible = status === 'uploading' || status === 'processing';

  const spinnerOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      spinnerOpacity.value = withRepeat(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(spinnerOpacity);
      spinnerOpacity.value = 1;
    }
  }, [visible, spinnerOpacity]);

  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
  }));

  const [processingMessage, setProcessingMessage] = useState<string>(PROCESSING_MESSAGES[0]!);

  useEffect(() => {
    if (status !== 'processing') return;

    let i = 0;
    setProcessingMessage(PROCESSING_MESSAGES[0]!);

    const interval = setInterval(() => {
      i = (i + 1) % PROCESSING_MESSAGES.length;
      setProcessingMessage(PROCESSING_MESSAGES[i]!);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={spinnerStyle}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Animated.View>
      <Text style={styles.processingText}>
        {status === 'uploading'
          ? `Uploading… ${Math.round(uploadProgress * 100)}%`
          : processingMessage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,14,14,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  processingText: {
    color: colors.onSurface,
    fontSize: 16,
    marginTop: 20,
  },
});
