import { StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable } from './ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

interface ProblemCardProps {
  id: string;
  colour: string;
  consensus_grade: string | null;
  total_sends: number;
  flash_count: number;
  retired?: boolean;
  onPress?: () => void;
}

export function ProblemCard({
  colour,
  consensus_grade,
  total_sends,
  flash_count,
  retired = false,
  onPress,
}: ProblemCardProps) {
  const gradeLabel = consensus_grade ?? 'ungraded';
  const sendsLabel = total_sends === 1 ? '1 send' : `${total_sends} sends`;
  const flashLabel = flash_count > 0 ? `, ${flash_count} flashes` : '';
  const retiredLabel = retired ? ', retired' : '';
  const accessibilityLabel = `${gradeLabel} problem, ${sendsLabel}${flashLabel}${retiredLabel}`;

  return (
    <AccessiblePressable
      style={({ pressed }) => [styles.card, retired && styles.retired, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: retired }}
    >
      <View style={[styles.swatch, { backgroundColor: colour }]} />
      <View style={styles.info}>
        <Text style={styles.grade}>{consensus_grade ?? '?'}</Text>
        <View style={styles.meta}>
          <Text style={styles.sends}>{total_sends} sends</Text>
          {flash_count > 0 && <Text style={styles.flash}>{flash_count} ⚡</Text>}
        </View>
      </View>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: spacing.xs,
    borderRadius: spacing.lg,
    backgroundColor: colors.surfaceContainer,
    overflow: 'hidden',
  },
  retired: { opacity: 0.5 },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  swatch: { height: 64, width: '100%' },
  info: { padding: spacing.md, gap: spacing.xs },
  grade: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sends: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  flash: {
    ...typography.bodySm,
    color: colors.tertiary,
  },
});
