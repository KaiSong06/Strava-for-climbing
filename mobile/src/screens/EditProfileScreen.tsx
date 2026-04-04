import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import type { AuthUser } from '../../../shared/types';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

type Visibility = 'public' | 'friends' | 'private';

interface GymResult {
  type: 'gym';
  id: string;
  name: string;
  city: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>(
    user?.default_visibility ?? 'public',
  );
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [homeGymId, setHomeGymId] = useState<string | null>(user?.home_gym_id ?? null);
  const [homeGymName, setHomeGymName] = useState(user?.home_gym_name ?? '');

  // Gym search state
  const [gymQuery, setGymQuery] = useState('');
  const [gymResults, setGymResults] = useState<GymResult[]>([]);
  const [showGymSearch, setShowGymSearch] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const usernameLocked = !!user?.username_changed_at && isWithin30Days(user.username_changed_at);
  const usernameUnlockDate = user?.username_changed_at
    ? getUnlockDate(user.username_changed_at)
    : null;

  const handlePickAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  }, []);

  const handleGymSearch = useCallback(async (query: string) => {
    setGymQuery(query);
    if (query.length < 2) {
      setGymResults([]);
      return;
    }
    try {
      const res = await api.get<{ data: GymResult[] }>(
        `/search?q=${encodeURIComponent(query)}&type=gym`,
      );
      setGymResults(res.data.filter((r) => r.type === 'gym'));
    } catch {
      setGymResults([]);
    }
  }, []);

  const handleSelectGym = useCallback((gym: GymResult) => {
    setHomeGymId(gym.id);
    setHomeGymName(gym.name);
    setGymQuery('');
    setGymResults([]);
    setShowGymSearch(false);
  }, []);

  const handleClearGym = useCallback(() => {
    setHomeGymId(null);
    setHomeGymName('');
    setGymQuery('');
    setGymResults([]);
    setShowGymSearch(false);
  }, []);

  async function handleSave() {
    setError('');

    if (!displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (displayName.length > 50) {
      setError('Display name must be 50 characters or fewer.');
      return;
    }

    const usernameChanged = username !== user?.username;
    if (usernameChanged) {
      if (!USERNAME_REGEX.test(username)) {
        setError('Username must be 3–20 characters: letters, numbers, underscores only.');
        return;
      }
      if (usernameLocked) {
        setError(`You can change your username again after ${usernameUnlockDate}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {};

      if (displayName !== user?.display_name) body.display_name = displayName.trim();
      if (usernameChanged) body.username = username;
      if (homeGymId !== user?.home_gym_id) body.home_gym_id = homeGymId;
      if (avatarBase64) body.avatar_base64 = avatarBase64;
      if (defaultVisibility !== user?.default_visibility)
        body.default_visibility = defaultVisibility;

      if (Object.keys(body).length === 0) {
        router.back();
        return;
      }

      const updated = await api.patch<AuthUser>('/users/me', body);
      updateUser(updated);
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      router.back();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Failed to save changes.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Edit Profile</Text>
            <Pressable onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Avatar */}
          <Pressable style={styles.avatarContainer} onPress={handlePickAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {(displayName || username || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.changePhotoText}>Change photo</Text>
          </Pressable>

          {/* Display Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>DISPLAY NAME</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={colors.outline}
              maxLength={50}
              autoCapitalize="words"
            />
          </View>

          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              style={[styles.input, usernameLocked && styles.inputDisabled]}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!usernameLocked}
              maxLength={20}
            />
            {usernameLocked && usernameUnlockDate && (
              <Text style={styles.hint}>
                You can change your username again after {usernameUnlockDate}.
              </Text>
            )}
            {!usernameLocked && (
              <Text style={styles.hint}>Letters, numbers, and underscores. 3–20 characters.</Text>
            )}
          </View>

          {/* Home Gym */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>HOME GYM</Text>
            {!showGymSearch ? (
              <Pressable style={styles.input} onPress={() => setShowGymSearch(true)}>
                <Text style={homeGymName ? styles.inputText : styles.placeholderText}>
                  {homeGymName || 'Select a gym'}
                </Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={gymQuery}
                  onChangeText={handleGymSearch}
                  placeholder="Search gyms..."
                  placeholderTextColor={colors.outline}
                  autoFocus
                />
                {gymResults.length > 0 && (
                  <View style={styles.gymResults}>
                    {gymResults.map((gym) => (
                      <Pressable
                        key={gym.id}
                        style={styles.gymResultItem}
                        onPress={() => handleSelectGym(gym)}
                      >
                        <Text style={styles.gymResultName}>{gym.name}</Text>
                        <Text style={styles.gymResultCity}>{gym.city}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
            {homeGymName ? (
              <Pressable onPress={handleClearGym}>
                <Text style={styles.clearText}>Clear gym</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Default Visibility */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>DEFAULT ASCENT VISIBILITY</Text>
            <View style={styles.visibilityRow}>
              {(['public', 'friends', 'private'] as const).map((v) => (
                <Pressable
                  key={v}
                  style={[
                    styles.visibilityOption,
                    defaultVisibility === v && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setDefaultVisibility(v)}
                >
                  <Text
                    style={[
                      styles.visibilityText,
                      defaultVisibility === v && styles.visibilityTextActive,
                    ]}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              {defaultVisibility === 'public' && 'Anyone can see your ascents.'}
              {defaultVisibility === 'friends' && 'Only people you follow can see your ascents.'}
              {defaultVisibility === 'private' &&
                'Only you can see your ascents. They still count toward problem stats anonymously.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function isWithin30Days(dateStr: string): boolean {
  const changed = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - changed.getTime();
  return diffMs < 30 * 24 * 60 * 60 * 1000;
}

function getUnlockDate(dateStr: string): string {
  const changed = new Date(dateStr);
  const unlock = new Date(changed.getTime() + 30 * 24 * 60 * 60 * 1000);
  return unlock.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, gap: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelText: { ...typography.bodyLg, color: colors.onSurfaceVariant },
  title: { ...typography.headlineMd, color: colors.onSurface },
  saveText: { ...typography.bodyLg, color: colors.primary, fontWeight: '700' },

  error: { ...typography.bodyMd, color: colors.error, textAlign: 'center' },

  avatarContainer: { alignItems: 'center', gap: spacing.sm },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...typography.headlineLg, color: colors.onSurfaceVariant },
  changePhotoText: { ...typography.bodyMd, color: colors.primary },

  fieldGroup: { gap: spacing.sm },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant },
  input: {
    ...typography.bodyLg,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.onSurface,
  },
  inputDisabled: { opacity: 0.5 },
  inputText: { ...typography.bodyLg, color: colors.onSurface },
  placeholderText: { ...typography.bodyLg, color: colors.outline },
  hint: { ...typography.bodySm, color: colors.onSurfaceVariant },

  gymResults: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gymResultItem: {
    padding: spacing.md,
    gap: 2,
  },
  gymResultName: { ...typography.bodyLg, color: colors.onSurface },
  gymResultCity: { ...typography.bodySm, color: colors.onSurfaceVariant },

  clearText: { ...typography.bodySm, color: colors.primary },

  visibilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  visibilityOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
  },
  visibilityOptionActive: {
    backgroundColor: colors.primary,
  },
  visibilityText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  visibilityTextActive: { color: colors.onPrimary, fontWeight: '700' },
});
