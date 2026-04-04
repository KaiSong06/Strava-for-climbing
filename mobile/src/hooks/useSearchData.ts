import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { FeedItem, PaginatedResponse } from '../../../shared/types';
import type { FriendEntry, DiscoveryTile } from '../screens/Search/searchTypes';

interface FriendWithActivity {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  has_new_activity: boolean;
}

function toFriendEntry(f: FriendWithActivity): FriendEntry {
  return {
    id: f.id,
    username: `@${f.username}`,
    avatarUrl: f.avatar_url ?? '',
    hasNewActivity: f.has_new_activity,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function gradeLabel(item: FeedItem): string {
  return item.problem.consensus_grade ?? item.user_grade ?? '';
}

function achievementText(item: FeedItem): string {
  const grade = gradeLabel(item);
  const verb = item.type === 'flash' ? 'Flashed' : 'Sent';
  const gradeStr = grade ? ` ${grade}` : '';
  return `${verb}${gradeStr} at ${item.problem.gym.name}`;
}

function feedItemsToTiles(items: FeedItem[]): DiscoveryTile[] {
  const tiles: DiscoveryTile[] = [];
  const used = new Set<string>();

  const withPhotos = items.filter((i) => i.photo_urls.length > 0);
  const withoutPhotos = items.filter((i) => i.photo_urls.length === 0);

  // 1. Featured climb — first flash/send with photo and high rating
  const featuredItem =
    withPhotos.find((i) => i.type === 'flash' && i.rating !== null && i.rating >= 4) ??
    withPhotos.find((i) => i.type === 'flash') ??
    withPhotos[0];

  if (featuredItem) {
    used.add(featuredItem.id);
    const grade = gradeLabel(featuredItem);
    tiles.push({
      id: featuredItem.id,
      type: 'featured_climb',
      imageUrl: featuredItem.photo_urls[0],
      problemId: featuredItem.problem.id,
      grade: grade || undefined,
      problemName: `${capitalize(featuredItem.problem.colour)} ${grade}`.trim(),
    });
  }

  // 2. Gym spotlight — most frequent gym in results
  const gymCounts = new Map<string, { count: number; name: string }>();
  for (const item of items) {
    const gym = item.problem.gym;
    const entry = gymCounts.get(gym.id);
    if (entry) {
      entry.count++;
    } else {
      gymCounts.set(gym.id, { count: 1, name: gym.name });
    }
  }
  let topGymId: string | undefined;
  let topGym: { name: string } | undefined;
  let topCount = 0;
  for (const [gymId, entry] of gymCounts.entries()) {
    if (entry.count > topCount) {
      topCount = entry.count;
      topGym = entry;
      topGymId = gymId;
    }
  }
  if (topGym && topGymId) {
    tiles.push({
      id: `gym-spotlight`,
      type: 'gym_spotlight',
      imageUrl: null,
      gymId: topGymId,
      gymName: topGym.name,
    });
  }

  // 3. Standard tiles from photos (fill remaining slots)
  const remainingPhotos = withPhotos.filter((i) => !used.has(i.id));

  // First standard (slot after gym spotlight)
  if (remainingPhotos[0]) {
    used.add(remainingPhotos[0].id);
    tiles.push({
      id: remainingPhotos[0].id,
      type: 'standard',
      imageUrl: remainingPhotos[0].photo_urls[0],
      problemId: remainingPhotos[0].problem.id,
    });
  }

  // Two more standards for row B top
  for (let i = 1; i <= 2 && i < remainingPhotos.length; i++) {
    used.add(remainingPhotos[i].id);
    tiles.push({
      id: remainingPhotos[i].id,
      type: 'standard',
      imageUrl: remainingPhotos[i].photo_urls[0],
      problemId: remainingPhotos[i].problem.id,
    });
  }

  // 4. Tall video tile
  const tallCandidate = remainingPhotos.find((i) => !used.has(i.id));
  if (tallCandidate) {
    used.add(tallCandidate.id);
    tiles.push({
      id: tallCandidate.id,
      type: 'tall_video',
      imageUrl: tallCandidate.photo_urls[0],
      problemId: tallCandidate.problem.id,
      isVideo: true,
    });
  }

  // One more standard for row B bottom-left
  const nextStd = remainingPhotos.find((i) => !used.has(i.id));
  if (nextStd) {
    used.add(nextStd.id);
    tiles.push({
      id: nextStd.id,
      type: 'standard',
      imageUrl: nextStd.photo_urls[0],
      problemId: nextStd.problem.id,
    });
  }

  // 5. Featured athlete — a notable ascent (prefer from withoutPhotos, fallback to any unused)
  const athleteItem =
    withoutPhotos.find((i) => (i.type === 'flash' || i.type === 'send') && !used.has(i.id)) ??
    items.find((i) => (i.type === 'flash' || i.type === 'send') && !used.has(i.id));
  if (athleteItem) {
    used.add(athleteItem.id);
    tiles.push({
      id: athleteItem.id,
      type: 'featured_athlete',
      imageUrl: null,
      problemId: athleteItem.problem.id,
      athlete: {
        username: `@${athleteItem.user.username}`,
        avatarUrl: athleteItem.user.avatar_url ?? '',
        achievement: achievementText(athleteItem),
      },
    });
  }

  // 6. Fill remaining standard slots (need ~4 more for row C right + row D)
  const allRemaining = [...remainingPhotos, ...withoutPhotos].filter(
    (i) => !used.has(i.id) && i.photo_urls.length > 0,
  );
  for (const item of allRemaining.slice(0, 4)) {
    used.add(item.id);
    tiles.push({
      id: item.id,
      type: 'standard',
      imageUrl: item.photo_urls[0],
      problemId: item.problem.id,
    });
  }

  return tiles;
}

export function useFriends() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['users', 'me', 'friends'],
    queryFn: () => api.get<{ data: FriendWithActivity[] }>('/users/me/friends'),
    enabled: !!accessToken,
    select: (res) => res.data.map(toFriendEntry),
  });
}

export function useDiscoverFeed() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['feed', 'discover'],
    queryFn: () => api.get<PaginatedResponse<FeedItem>>('/feed/discover?limit=20'),
    enabled: !!accessToken,
    select: (res) => feedItemsToTiles(res.data),
  });
}
