import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { unregisterPushNotifications } from '../services/pushService';
import type { AuthUser } from '../../../shared/types';

interface AuthState {
  session: Session | null;
  user: AuthUser | null;
  /** Phone number waiting for OTP verification (set after signUp, before OTP confirm). */
  pendingVerification: { phone: string } | null;
  /** True once the initial session check has completed on app start. */
  _hasHydrated: boolean;

  /** Derived — convenience accessor for the Supabase access token. */
  accessToken: string | null;

  initialize: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
  setPendingVerification: (phone: string | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  pendingVerification: null,
  _hasHydrated: false,
  accessToken: null,

  initialize: async () => {
    // Get existing session from SecureStore (via Supabase client)
    const { data: { session } } = await supabase.auth.getSession();
    set({
      session,
      accessToken: session?.access_token ?? null,
      _hasHydrated: true,
    });

    // Listen for auth state changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({
        session: newSession,
        accessToken: newSession?.access_token ?? null,
      });
      // Clear pending verification when a session arrives
      if (newSession && get().pendingVerification) {
        set({ pendingVerification: null });
      }
    });
  },

  updateUser: (user) => set({ user }),

  setPendingVerification: (phone) =>
    set({ pendingVerification: phone ? { phone } : null }),

  logout: async () => {
    unregisterPushNotifications().catch(() => {});
    await supabase.auth.signOut();
    set({ session: null, accessToken: null, user: null, pendingVerification: null });
  },
}));
