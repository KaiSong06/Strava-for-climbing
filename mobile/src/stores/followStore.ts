import { create } from 'zustand';
import { api } from '../lib/api';
import type { PaginatedResponse, UserProfile } from '../../../shared/types';

interface FollowState {
  /** userId → true for every user the current user follows */
  followingIds: Record<string, true>;
  /** Whether the initial load from the API has completed */
  isLoaded: boolean;

  /** Populate followingIds from GET /users/:username/following (first page, limit 200) */
  load: (username: string) => Promise<void>;
  /** Optimistically follow a user, then call the API; rolls back on failure */
  follow: (username: string, userId: string) => Promise<void>;
  /** Optimistically unfollow a user, then call the API; rolls back on failure */
  unfollow: (username: string, userId: string) => Promise<void>;
  isFollowing: (userId: string) => boolean;
  reset: () => void;
}

export const useFollowStore = create<FollowState>()((set, get) => ({
  followingIds: {},
  isLoaded: false,

  load: async (username: string) => {
    try {
      const result = await api.get<PaginatedResponse<UserProfile>>(
        `/users/${username}/following?limit=200`,
      );
      const ids: Record<string, true> = {};
      for (const u of result.data) {
        ids[u.id] = true;
      }
      set({ followingIds: ids, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  follow: async (username: string, userId: string) => {
    // Optimistic update
    set((s) => ({ followingIds: { ...s.followingIds, [userId]: true } }));
    try {
      await api.post(`/users/${username}/follow`, {});
    } catch (err) {
      // Rollback
      set((s) => {
        const next = { ...s.followingIds };
        delete next[userId];
        return { followingIds: next };
      });
      throw err;
    }
  },

  unfollow: async (username: string, userId: string) => {
    // Optimistic update
    set((s) => {
      const next = { ...s.followingIds };
      delete next[userId];
      return { followingIds: next };
    });
    try {
      await api.delete(`/users/${username}/follow`);
    } catch (err) {
      // Rollback
      set((s) => ({ followingIds: { ...s.followingIds, [userId]: true } }));
      throw err;
    }
  },

  isFollowing: (userId: string) => Boolean(get().followingIds[userId]),

  reset: () => set({ followingIds: {}, isLoaded: false }),
}));
