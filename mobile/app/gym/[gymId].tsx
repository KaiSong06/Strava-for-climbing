import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { ProblemCard } from '@/src/components/ProblemCard';
import type { PaginatedResponse } from '../../../shared/types';

interface GymDetail {
  id: string;
  name: string;
  city: string;
  active_problem_count: number;
  total_ascents_all_time: number;
}

interface GymProblem {
  id: string;
  colour: string;
  consensus_grade: string | null;
  total_sends: number;
  total_attempts: number;
  flash_count: number;
  first_upload_at: string;
  retired_at: string | null;
  thumbnail_url: string | null;
}

interface RetiredGroup {
  month: string;
  problems: GymProblem[];
}

type Tab = 'current' | 'past';

export default function GymScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('current');

  const { data: gymData, isLoading: gymLoading } = useQuery({
    queryKey: ['gym', gymId],
    queryFn: () => api.get<{ gym: GymDetail }>(`/gyms/${gymId}`),
  });

  const {
    data: problemsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: problemsLoading,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['gym', gymId, 'problems', 'active'],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.get<PaginatedResponse<GymProblem>>(
        `/gyms/${gymId}/problems?status=active${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: activeTab === 'current',
  });

  const { data: retiredData, isLoading: retiredLoading } = useQuery({
    queryKey: ['gym', gymId, 'problems', 'retired'],
    queryFn: () => api.get<{ data: RetiredGroup[] }>(`/gyms/${gymId}/problems/retired`),
    enabled: activeTab === 'past',
  });

  const gym = gymData?.gym;
  const problems = problemsData?.pages.flatMap((p) => p.data) ?? [];
  const retiredGroups = retiredData?.data ?? [];

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const formatMonth = (yyyyMm: string) => {
    const [year, month] = yyyyMm.split('-');
    if (!year || !month) return yyyyMm;
    return new Date(Number(year), Number(month) - 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  };

  if (gymLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const header = (
    <View>
      {gym && (
        <View style={styles.gymHeader}>
          <Text style={styles.gymName}>{gym.name}</Text>
          <Text style={styles.gymCity}>{gym.city}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{gym.active_problem_count}</Text>
              <Text style={styles.statLabel}>Active problems</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{gym.total_ascents_all_time}</Text>
              <Text style={styles.statLabel}>Total ascents</Text>
            </View>
          </View>
        </View>
      )}

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {(['current', 'past'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'current' ? 'Current problems' : 'Past problems'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (activeTab === 'current') {
    const numCols = 2;
    const rows: GymProblem[][] = [];
    for (let i = 0; i < problems.length; i += numCols) {
      rows.push(problems.slice(i, i + numCols));
    }

    return (
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item: row }) => (
          <View style={styles.gridRow}>
            {row.map((p) => (
              <ProblemCard
                key={p.id}
                id={p.id}
                colour={p.colour}
                consensus_grade={p.consensus_grade}
                total_sends={p.total_sends}
                flash_count={p.flash_count}
                onPress={() => router.push({ pathname: '/problem/[id]', params: { id: p.id } })}
              />
            ))}
            {/* Fill last row if odd number */}
            {row.length < numCols && <View style={{ flex: 1, margin: 4 }} />}
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          problemsLoading ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <Text style={styles.emptyText}>No active problems at this gym.</Text>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator style={styles.loader} /> : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.listContent}
      />
    );
  }

  // Past problems — grouped by month
  if (retiredLoading) {
    return (
      <ScrollView>
        {header}
        <ActivityIndicator style={styles.loader} />
      </ScrollView>
    );
  }

  if (retiredGroups.length === 0) {
    return (
      <ScrollView>
        {header}
        <Text style={styles.emptyText}>No retired problems yet.</Text>
      </ScrollView>
    );
  }

  return (
    <SectionList
      sections={retiredGroups.map((g) => ({ title: formatMonth(g.month), data: [g.problems] }))}
      keyExtractor={(_, i) => String(i)}
      renderSectionHeader={({ section }) => <Text style={styles.monthHeader}>{section.title}</Text>}
      renderItem={({ item: monthProblems }) => {
        const numCols = 2;
        const rows: GymProblem[][] = [];
        for (let i = 0; i < monthProblems.length; i += numCols) {
          rows.push(monthProblems.slice(i, i + numCols));
        }
        return (
          <>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map((p) => (
                  <ProblemCard
                    key={p.id}
                    id={p.id}
                    colour={p.colour}
                    consensus_grade={p.consensus_grade}
                    total_sends={p.total_sends}
                    flash_count={p.flash_count}
                    retired
                    onPress={() => router.push({ pathname: '/problem/[id]', params: { id: p.id } })}
                  />
                ))}
                {row.length < numCols && <View style={{ flex: 1, margin: 4 }} />}
              </View>
            ))}
          </>
        );
      }}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gymHeader: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  gymName: { fontSize: 22, fontWeight: '700', color: '#111827' },
  gymCity: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#2563eb' },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#2563eb', fontWeight: '700' },
  gridRow: { flexDirection: 'row', paddingHorizontal: 8 },
  listContent: { paddingBottom: 24 },
  monthHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    backgroundColor: '#f9fafb',
  },
  emptyText: { paddingHorizontal: 16, paddingVertical: 24, color: '#6b7280', fontSize: 14 },
  loader: { paddingVertical: 16 },
});
