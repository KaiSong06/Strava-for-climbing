import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '../../../shared/types';

// SecureStore adapter for Zustand persist middleware
const secureStorage = createJSONStorage(() => ({
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}));

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once SecureStore has finished loading persisted state on app start. */
  _hasHydrated: boolean;

  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  updateAccessToken: (accessToken: string) => void;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      updateAccessToken: (accessToken) => set({ accessToken }),

      updateUser: (user) => set({ user }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'crux-auth',
      storage: secureStorage,
      // Only persist tokens and user — not ephemeral flags
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
