import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import type { RecentClimb } from '../mockGyms';

interface Props {
  climbs: RecentClimb[];
}

export function RecentClimbsRow({ climbs }: Props) {
  if (climbs.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No recent sends</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {climbs.map((climb) => (
        <View key={climb.id} style={styles.climbItem}>
          <Image source={{ uri: climb.avatarUrl }} style={styles.avatar} />
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{climb.grade}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  climbItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHighest,
  },
  gradeBadge: {
    backgroundColor: 'rgba(168,200,255,0.15)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: 4,
  },
  gradeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  emptyWrap: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.onSurfaceVariant,
    opacity: 0.5,
  },
});
