import { StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { colors } from '@/src/theme/colors';
import { ActivityCard, type AscentActivity } from './ActivityCard';

interface Props {
  activities: AscentActivity[];
  onViewAll: () => void;
  onActivityPress: (activity: AscentActivity) => void;
}

export function RecentActivity({ activities, onViewAll, onActivityPress }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Activity</Text>
        <AccessiblePressable
          onPress={onViewAll}
          hitSlop={8}
          accessibilityLabel="View all recent activity"
          accessibilityRole="button"
        >
          <Text style={styles.viewAll}>VIEW ALL</Text>
        </AccessiblePressable>
      </View>

      {activities.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No climbs logged yet</Text>
        </View>
      ) : (
        <View style={styles.cardList}>
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onPress={() => onActivityPress(activity)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
  },
  viewAll: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  cardList: {
    gap: 24,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
  },
});
