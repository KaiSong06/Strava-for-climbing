import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import { HolographicModelViewer } from '@/src/components/HolographicModelViewer';
import { colors } from '@/src/theme/colors';
import type { PaginatedResponse, AscentType } from '@shared/types';

interface ProblemDetail {
  id: string;
  gym_id: string;
  colour: string;
  status: 'active' | 'retired';
  consensus_grade: string | null;
  total_sends: number;
  total_attempts: number;
  flash_count: number;
  first_upload_at: string;
  retired_at: string | null;
  model_url: string | null;
  gym_name: string;
  ascent_summary: {
    total_sends: number;
    total_attempts: number;
    flash_count: number;
    grade_distribution: Record<string, number>;
  };
}

interface AscentRow {
  id: string;
  type: AscentType;
  user_grade: string | null;
  rating: number | null;
  notes: string | null;
  logged_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

const TYPE_BADGE: Record<AscentType, { label: string; color: string; bg: string }> = {
  flash: { label: 'Flash', color: '#92400e', bg: '#fef3c7' },
  send: { label: 'Send', color: '#065f46', bg: '#d1fae5' },
  attempt: { label: 'Attempt', color: '#1e40af', bg: '#dbeafe' },
};

function GradeBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={barStyles.count}>{count}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  label: { width: 36, fontSize: 12, color: '#374151', fontWeight: '600', textAlign: 'right' },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 5 },
  count: { width: 24, fontSize: 12, color: '#6b7280', textAlign: 'right' },
});

export default function ProblemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: problemData, isLoading: problemLoading } = useQuery({
    queryKey: ['problem', id],
    queryFn: () => api.get<{ problem: ProblemDetail }>(`/problems/${id}`),
  });

  const {
    data: ascentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: ascentsLoading,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['problem', id, 'ascents'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<AscentRow>>(
        `/problems/${id}/ascents?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
  });

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (problemLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const problem = problemData?.problem;
  if (!problem) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Problem not found.</Text>
      </View>
    );
  }

  const { ascent_summary: summary } = problem;
  const grades = Object.entries(summary.grade_distribution).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const maxCount = Math.max(...grades.map(([, c]) => c), 1);

  const ascents = ascentsData?.pages.flatMap((p) => p.data) ?? [];

  // Check if the current user has an upload linked to this problem (simplified — show button if any ascent exists by them)
  const userHasAscent = ascents.some((a) => a.user.id === currentUserId);

  const header = (
    <View>
      {/* Colour swatch + grade header */}
      <View style={styles.header}>
        <View style={[styles.swatch, { backgroundColor: problem.colour }]} />
        <View style={styles.headerInfo}>
          <Text style={styles.grade}>{problem.consensus_grade ?? 'Ungraded'}</Text>
          <Text style={styles.gymName}>{problem.gym_name}</Text>
          {problem.status === 'retired' && <Text style={styles.retired}>Retired</Text>}
        </View>
      </View>

      {/* 3D Holographic Model */}
      {problem.model_url && (
        <View style={styles.modelSection}>
          <Text style={styles.modelLabel}>3D View</Text>
          <HolographicModelViewer
            modelUrl={problem.model_url}
            holdColour={problem.colour}
          />
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.total_sends}</Text>
          <Text style={styles.statLabel}>Sends</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.total_attempts}</Text>
          <Text style={styles.statLabel}>Attempts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.flash_count}</Text>
          <Text style={styles.statLabel}>Flashes</Text>
        </View>
      </View>

      {/* Grade distribution */}
      {grades.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grade votes</Text>
          {grades.map(([grade, count]) => (
            <GradeBar key={grade} label={grade} count={count} max={maxCount} />
          ))}
        </View>
      )}

      {/* Log this climb */}
      {problem.status === 'active' && (
        <Pressable
          style={styles.logBtn}
          onPress={() =>
            router.push({ pathname: '/log-ascent/[problemId]', params: { problemId: problem.id } })
          }
        >
          <Text style={styles.logBtnText}>Log this climb</Text>
        </Pressable>
      )}

      {/* Ascents header */}
      <View style={styles.ascentsHeader}>
        <Text style={styles.sectionTitle}>Ascents</Text>
        {ascentsLoading && <ActivityIndicator size="small" />}
      </View>
    </View>
  );

  return (
    <FlatList
      data={ascents}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const badge = TYPE_BADGE[item.type];
        const initial = item.user.display_name[0]?.toUpperCase() ?? '?';
        return (
          <Pressable
            style={styles.ascentRow}
            onPress={() =>
              router.push({
                pathname: '/profile/[username]',
                params: { username: item.user.username },
              })
            }
          >
            {item.user.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.ascentInfo}>
              <Text style={styles.ascentUser}>{item.user.display_name}</Text>
              {item.notes ? (
                <Text style={styles.ascentNotes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
            <View style={styles.ascentRight}>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
              {item.user_grade && <Text style={styles.ascentGrade}>{item.user_grade}</Text>}
              {item.rating && <Text style={styles.ascentRating}>{'★'.repeat(item.rating)}</Text>}
            </View>
          </Pressable>
        );
      }}
      ListHeaderComponent={header}
      ListEmptyComponent={
        ascentsLoading ? null : <Text style={styles.emptyText}>No ascents logged yet.</Text>
      }
      ListFooterComponent={
        <>
          {isFetchingNextPage && <ActivityIndicator style={styles.loader} />}
          {userHasAscent && (
            <View style={styles.reportRow}>
              <Text style={styles.reportLink}>Wrong match? Contact support to dispute.</Text>
            </View>
          )}
        </>
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#6b7280', fontSize: 14 },
  listContent: { paddingBottom: 32 },

  header: { flexDirection: 'row', gap: 16, padding: 16 },
  swatch: { width: 60, height: 60, borderRadius: 12 },
  headerInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  grade: { fontSize: 22, fontWeight: '800', color: '#111827' },
  gymName: { fontSize: 14, color: '#6b7280' },
  retired: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },

  modelSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modelLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280' },

  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },

  logBtn: {
    margin: 16,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  ascentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },

  ascentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 14, fontWeight: '700' },
  ascentInfo: { flex: 1 },
  ascentUser: { fontSize: 14, fontWeight: '600', color: '#111827' },
  ascentNotes: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  ascentRight: { alignItems: 'flex-end', gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ascentGrade: { fontSize: 12, fontWeight: '600', color: '#374151' },
  ascentRating: { fontSize: 11, color: '#f59e0b' },

  emptyText: { paddingHorizontal: 16, paddingVertical: 24, color: '#6b7280', fontSize: 14 },
  loader: { paddingVertical: 16 },
  reportRow: { padding: 16, alignItems: 'center' },
  reportLink: { fontSize: 12, color: '#9ca3af' },
});
