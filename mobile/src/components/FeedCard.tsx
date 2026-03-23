import { Image, Pressable, StyleSheet, View, Text } from 'react-native';
import type { FeedItem, AscentType } from '../../../shared/types';

const TYPE_LABEL: Record<AscentType, string> = {
  flash: 'flashed',
  send: 'sent',
  attempt: 'attempted',
};

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

interface FeedCardProps {
  item: FeedItem;
  onPress?: () => void;
  onPressUser?: () => void;
  onPressGym?: () => void;
}

export function FeedCard({ item, onPress, onPressUser, onPressGym }: FeedCardProps) {
  const initial = item.user.display_name[0]?.toUpperCase() ?? '?';
  const gradeStr = item.problem.consensus_grade ?? item.user_grade ?? '';
  const typeLabel = TYPE_LABEL[item.type];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Avatar — tappable to profile */}
      <Pressable style={styles.avatarCol} onPress={onPressUser}>
        {item.user.avatar_url ? (
          <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
      </Pressable>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.action} numberOfLines={2}>
          <Text style={styles.name} onPress={onPressUser}>
            {item.user.display_name}
          </Text>
          {` ${typeLabel}${gradeStr ? ` a ${gradeStr}` : ' a problem'} at `}
          <Text style={styles.gym} onPress={onPressGym}>
            {item.problem.gym.name}
          </Text>
        </Text>

        <Text style={styles.meta}>{formatRelativeTime(item.logged_at)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  avatarCol: { paddingTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  content: { flex: 1, gap: 4 },
  action: { fontSize: 14, color: '#111827', lineHeight: 20 },
  name: { fontWeight: '700' },
  gym: { fontWeight: '600', color: '#2563eb' },
  meta: { fontSize: 12, color: '#6b7280' },
});
