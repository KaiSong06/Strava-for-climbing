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
