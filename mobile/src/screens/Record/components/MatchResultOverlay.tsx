import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { HOLD_COLOURS } from '../constants';
import type { PipelineStatus } from '@/src/hooks/useVisionPipeline';

interface MatchResultOverlayProps {
  status: PipelineStatus;
  isAutoMatched: boolean;
  needsConfirmation: boolean;
  isUnmatched: boolean;
  confidence: number | null;
  matchedProblemId: string | null;
  holdColor: string | null;
  difficulty: string | null;
  onConfirmMatch: () => void;
  onNewProblem: () => void;
  onCancel: () => void;
}

/**
 * Fullscreen overlay shown after the vision pipeline produces a match result.
 * Renders one of three states: auto-matched, awaiting confirmation, or unmatched
 * (new problem). Returns null when the pipeline is not in a result state.
 */
export function MatchResultOverlay({
  status,
  isAutoMatched,
  needsConfirmation,
  isUnmatched,
  confidence,
  matchedProblemId,
  holdColor,
  difficulty,
  onConfirmMatch,
  onNewProblem,
  onCancel,
}: MatchResultOverlayProps) {
  const visible =
    status === 'matched' || status === 'awaiting_confirmation' || status === 'unmatched';

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      {isAutoMatched ? (
        <View style={styles.resultContent}>
          <MaterialCommunityIcons name="check-circle" size={56} color={colors.primary} />
          <Text style={styles.resultHeading}>Problem identified!</Text>
          {confidence !== null && (
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{confidence}% match</Text>
            </View>
          )}
          <AccessiblePressable
            style={styles.resultButtonPrimary}
            onPress={onConfirmMatch}
            accessibilityLabel="Log ascent for matched problem"
            accessibilityRole="button"
          >
            <Text style={styles.resultButtonPrimaryText}>Log Ascent</Text>
          </AccessiblePressable>
          <AccessiblePressable
            style={styles.resultButtonSecondary}
            onPress={onNewProblem}
            accessibilityLabel="Not my climb, create a new problem instead"
            accessibilityRole="button"
          >
            <Text style={styles.resultButtonSecondaryText}>Not my climb — new problem</Text>
          </AccessiblePressable>
        </View>
      ) : needsConfirmation ? (
        <View style={styles.resultContent}>
          <MaterialCommunityIcons name="help-circle-outline" size={56} color={colors.tertiary} />
          <Text style={styles.resultHeading}>Is this your climb?</Text>
          {confidence !== null && (
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{confidence}% match</Text>
            </View>
          )}
          {matchedProblemId ? (
            <AccessiblePressable
              style={styles.resultButtonPrimary}
              onPress={onConfirmMatch}
              accessibilityLabel="Yes, log ascent for this problem"
              accessibilityRole="button"
            >
              <Text style={styles.resultButtonPrimaryText}>Yes, log it</Text>
            </AccessiblePressable>
          ) : null}
          <AccessiblePressable
            style={styles.resultButtonSecondary}
            onPress={onNewProblem}
            accessibilityLabel="No, create a new problem instead"
            accessibilityRole="button"
          >
            <Text style={styles.resultButtonSecondaryText}>No, it&apos;s a new problem</Text>
          </AccessiblePressable>
        </View>
      ) : isUnmatched ? (
        <View style={styles.resultContent}>
          <MaterialCommunityIcons name="plus-circle-outline" size={56} color={colors.primary} />
          <Text style={styles.resultHeading}>New problem detected</Text>
          <Text style={styles.resultSubtext}>
            No matching problem found. Create it as a new problem to start tracking ascents.
          </Text>
          {holdColor && (
            <View style={styles.newProblemDetail}>
              <View style={[styles.colorDot, { backgroundColor: holdColor }]} />
              <Text style={styles.newProblemDetailText}>
                {HOLD_COLOURS.find((c) => c.hex === holdColor)?.label ?? 'Unknown'} holds
              </Text>
            </View>
          )}
          {difficulty && (
            <View style={styles.newProblemDetail}>
              <MaterialCommunityIcons
                name="trending-up"
                size={16}
                color={colors.onSurfaceVariant}
              />
              <Text style={styles.newProblemDetailText}>{difficulty}</Text>
            </View>
          )}
          <AccessiblePressable
            style={styles.resultButtonPrimary}
            onPress={onNewProblem}
            accessibilityLabel="Create new problem"
            accessibilityRole="button"
          >
            <Text style={styles.resultButtonPrimaryText}>Create New Problem</Text>
          </AccessiblePressable>
          <AccessiblePressable
            style={styles.resultButtonSecondary}
            onPress={onCancel}
            accessibilityLabel="Cancel and return to record screen"
            accessibilityRole="button"
          >
            <Text style={styles.resultButtonSecondaryText}>Cancel</Text>
          </AccessiblePressable>
        </View>
      ) : null}
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
  resultContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  resultHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  confidenceBadge: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  resultButtonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
  },
  resultButtonPrimaryText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  resultButtonSecondary: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  resultButtonSecondaryText: {
    color: colors.onSurfaceVariant,
    fontSize: 14,
  },
  resultSubtext: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
  },
  newProblemDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newProblemDetailText: {
    fontSize: 14,
    color: colors.onSurface,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
