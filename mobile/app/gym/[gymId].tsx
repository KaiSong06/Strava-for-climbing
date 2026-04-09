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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { ProblemCard } from '@/src/components/ProblemCard';
import { CruxBanner, BANNER_HEIGHT } from '@/src/components/CruxBanner';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';
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

export default function GymDetailScreen() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const topPadding = insets.top + BANNER_HEIGHT + spacing.lg;

  if (gymLoading) {
    return (
      <View style={styles.screen}>
        <View style={[styles.centered, { paddingTop: topPadding }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <CruxBanner />
      </View>
    );
  }

  const header = (
    <View>
      {gym && (
        <View style={styles.gymHeader}>
          {/* Back button */}
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={colors.onSurface} />
          </Pressable>

          <Text style={styles.gymName}>{gym.name}</Text>
          <Text style={styles.gymCity}>{gym.city}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{gym.active_problem_count}</Text>
              <Text style={styles.statLabel}>ACTIVE PROBLEMS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{gym.total_ascents_all_time}</Text>
              <Text style={styles.statLabel}>TOTAL ASCENTS</Text>
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
              {tab === 'current' ? 'Current' : 'Past'}
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
      <View style={styles.screen}>
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
              {row.length < numCols && <View style={styles.gridSpacer} />}
            </View>
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            problemsLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : (
              <Text style={styles.emptyText}>No active problems at this gym.</Text>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
          showsVerticalScrollIndicator={false}
        />
        <CruxBanner />
      </View>
    );
  }

  // Past problems — grouped by month
  if (retiredLoading) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {header}
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        </ScrollView>
        <CruxBanner />
      </View>
    );
  }

  if (retiredGroups.length === 0) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {header}
          <Text style={styles.emptyText}>No retired problems yet.</Text>
        </ScrollView>
        <CruxBanner />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={retiredGroups.map((g) => ({ title: formatMonth(g.month), data: [g.problems] }))}
        keyExtractor={(_, i) => String(i)}
        renderSectionHeader={({ section }) => (
          <Text style={styles.monthHeader}>{section.title}</Text>
        )}
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
                  {row.length < numCols && <View style={styles.gridSpacer} />}
                </View>
              ))}
            </>
          );
        }}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      />
      <CruxBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Gym header ──────────────────────────────────────────────────────────────
  gymHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  gymName: {
    ...typography.headlineLg,
    color: colors.onSurface,
    textTransform: 'uppercase',
    fontStyle: 'italic',
  },
  gymCity: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.xl,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  statLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: spacing.md,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  tabText: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: colors.onSurface,
  },

  // ── Grid & content ──────────────────────────────────────────────────────────
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl - spacing.xs,
  },
  gridSpacer: {
    flex: 1,
    margin: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  monthHeader: {
    ...typography.labelMd,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
});
