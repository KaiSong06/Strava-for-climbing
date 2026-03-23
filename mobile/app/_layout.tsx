import { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/src/stores/authStore';
import { registerForPushNotifications, setupNotificationHandler } from '@/src/services/pushService';

Sentry.init({
  dsn: process.env['EXPO_PUBLIC_SENTRY_DSN'],
  tracesSampleRate: 0.1,
  enabled: !!process.env['EXPO_PUBLIC_SENTRY_DSN'],
});

setupNotificationHandler();

const queryClient = new QueryClient();

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

export default Sentry.wrap(RootLayout);

/** Watches auth state and redirects between (auth) and (tabs) stacks. */
function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    // Wait until SecureStore finishes loading persisted tokens
    if (!hasHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (accessToken && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [accessToken, hasHydrated, segments, router]);

  return null;
}

function PushNotificationManager() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const router = useRouter();
  const listenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!hasHydrated || !accessToken) return;
    registerForPushNotifications().catch(console.error);
  }, [hasHydrated, accessToken]);

  useEffect(() => {
    listenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data.type === 'vision_complete' || data.type === 'vision_failed') {
        if (typeof data.uploadId === 'string') {
          router.push(`/uploads/${data.uploadId}` as never);
        }
      }
    });

    return () => {
      listenerRef.current?.remove();
    };
  }, [router]);

  return null;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <PushNotificationManager />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="follow-list" options={{ title: 'Follow List' }} />
          <Stack.Screen name="profile/[username]" options={{ title: '' }} />
          <Stack.Screen name="problem/[id]" options={{ title: 'Problem' }} />
          <Stack.Screen name="gym/[gymId]" options={{ title: '' }} />
          <Stack.Screen name="log-ascent/[problemId]" options={{ title: 'Log Ascent', presentation: 'modal' }} />
          <Stack.Screen name="feed/gym" options={{ title: 'Gym Activity' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
