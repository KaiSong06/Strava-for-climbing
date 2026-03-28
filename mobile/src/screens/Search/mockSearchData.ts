export interface FriendEntry {
  id: string;
  username: string;
  avatarUrl: string;
  hasNewActivity: boolean;
}

export interface DiscoveryTile {
  id: string;
  type: 'featured_climb' | 'gym_spotlight' | 'standard' | 'tall_video' | 'featured_athlete';
  /** Image URL — null for non-image tiles like gym_spotlight */
  imageUrl: string | null;
  /** Climb-specific fields */
  grade?: string;
  problemName?: string;
  isVideo?: boolean;
  /** Gym spotlight fields */
  gymName?: string;
  /** Featured athlete fields */
  athlete?: {
    username: string;
    avatarUrl: string;
    achievement: string;
  };
}

export const MOCK_FRIENDS: FriendEntry[] = [
  { id: 'f1', username: '@ash_v12',     avatarUrl: 'https://picsum.photos/seed/ash/200',     hasNewActivity: true },
  { id: 'f2', username: '@leo_beta',    avatarUrl: 'https://picsum.photos/seed/leo/200',     hasNewActivity: false },
  { id: 'f3', username: '@dyno_king',   avatarUrl: 'https://picsum.photos/seed/dyno/200',    hasNewActivity: true },
  { id: 'f4', username: '@boulder_bee', avatarUrl: 'https://picsum.photos/seed/boulder/200', hasNewActivity: false },
  { id: 'f5', username: '@peak_form',   avatarUrl: 'https://picsum.photos/seed/peak/200',    hasNewActivity: false },
  { id: 'f6', username: '@crimp_lord',  avatarUrl: 'https://picsum.photos/seed/crimp/200',   hasNewActivity: true },
];

export const MOCK_TILES: DiscoveryTile[] = [
  // Row 1: featured 2x2 + gym spotlight 1x1 on right
  {
    id: 't1',
    type: 'featured_climb',
    imageUrl: 'https://picsum.photos/seed/obsidian/600/600',
    grade: 'V7',
    problemName: 'Obsidian Overhang',
    isVideo: true,
  },
  {
    id: 't2',
    type: 'gym_spotlight',
    imageUrl: null,
    gymName: 'The Vertical Lab',
  },
  // Row 1 right-bottom
  {
    id: 't3',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/shoes/300/300',
  },
  // Row 2: 3 standard squares
  {
    id: 't4',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/portrait/300/300',
  },
  {
    id: 't5',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/silhouette/300/300',
  },
  // Row 2-3 right: tall video 1x2
  {
    id: 't6',
    type: 'tall_video',
    imageUrl: 'https://picsum.photos/seed/lunge/300/600',
    isVideo: true,
  },
  // Row 3 left
  {
    id: 't7',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/harness/300/300',
  },
  // Featured athlete card 2x1
  {
    id: 't8',
    type: 'featured_athlete',
    imageUrl: null,
    athlete: {
      username: '@ash_v12',
      avatarUrl: 'https://picsum.photos/seed/ash/200',
      achievement: 'Sent "The Void" (V9) today!',
    },
  },
  // Row 4: standard square
  {
    id: 't9',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/pinkhold/300/300',
  },
  // Bottom row
  {
    id: 't10',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/outdoor/300/300',
  },
  {
    id: 't11',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/gyminterior/300/300',
  },
  {
    id: 't12',
    type: 'standard',
    imageUrl: 'https://picsum.photos/seed/grip/300/300',
  },
];
