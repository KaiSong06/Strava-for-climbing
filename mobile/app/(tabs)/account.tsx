import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Text, View } from '@/components/Themed';
import { api, ApiError } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import type { AuthUser, Gym } from '../../../shared/types';

export default function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, updateUser } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editGymId, setEditGymId] = useState<string | null>(null);
  const [gymPickerVisible, setGymPickerVisible] = useState(false);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<AuthUser>({
    queryKey: ['users', 'me'],
    queryFn: () => api.get<AuthUser>('/users/me'),
  });

  const { data: gymsData } = useQuery<{ data: Gym[] }>({
    queryKey: ['gyms'],
    queryFn: () => api.get<{ data: Gym[] }>('/gyms'),
    enabled: isEditing,
  });
  const gyms = gymsData?.data ?? [];

  const patchMutation = useMutation({
    mutationFn: (body: {
      display_name?: string;
      home_gym_id?: string | null;
      avatar_base64?: string;
    }) => api.patch<AuthUser>('/users/me', body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['users', 'me'], updated);
      updateUser(updated);
      setIsEditing(false);
    },
    onError: (e) => {
      Alert.alert('Update failed', e instanceof ApiError ? e.message : 'Please try again.');
    },
  });

  function startEditing() {
    if (!profile) return;
    setEditDisplayName(profile.display_name);
    setEditGymId(profile.home_gym_id);
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const base64 = result.assets[0].base64;
    const mimeType = result.assets[0].mimeType ?? 'image/jpeg';
    patchMutation.mutate({ avatar_base64: `data:${mimeType};base64,${base64}` });
  }

  function saveEdits() {
    if (!profile) return;
    const body: { display_name?: string; home_gym_id?: string | null } = {};
    if (editDisplayName !== profile.display_name) body.display_name = editDisplayName;
    if (editGymId !== profile.home_gym_id) body.home_gym_id = editGymId;
    if (Object.keys(body).length === 0) {
      setIsEditing(false);
      return;
    }
    patchMutation.mutate(body);
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          logout();
          // Auth gate in _layout.tsx handles redirect to login
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load profile.</Text>
      </View>
    );
  }

  const selectedGymName =
    gyms.find((g) => g.id === editGymId)?.name ?? profile.home_gym_name ?? 'None';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Avatar */}
      <Pressable onPress={isEditing ? pickAvatar : undefined} style={styles.avatarWrapper}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {profile.display_name[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        {isEditing && (
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditBadgeText}>Edit</Text>
          </View>
        )}
      </Pressable>

      {/* Name + username */}
      {isEditing ? (
        <TextInput
          style={styles.nameInput}
          value={editDisplayName}
          onChangeText={setEditDisplayName}
          placeholder="Display name"
          autoCorrect={false}
        />
      ) : (
        <Text style={styles.displayName}>{profile.display_name}</Text>
      )}
      <Text style={styles.username}>@{profile.username}</Text>

      {/* Home gym */}
      <View style={styles.gymRow}>
        <Text style={styles.gymLabel}>Home gym: </Text>
        {isEditing ? (
          <Pressable onPress={() => setGymPickerVisible(true)}>
            <Text style={styles.gymPicker}>{selectedGymName} ▾</Text>
          </Pressable>
        ) : (
          <Text style={styles.gymValue}>{profile.home_gym_name ?? 'Not set'}</Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Pressable
          style={styles.statItem}
          onPress={() => router.push('/follow-list')}>
          <Text style={styles.statNumber}>{profile.follower_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable
          style={styles.statItem}
          onPress={() => router.push('/follow-list')}>
          <Text style={styles.statNumber}>{profile.following_count}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </Pressable>
      </View>

      {/* Action buttons */}
      {isEditing ? (
        <View style={styles.editActions}>
          <Pressable
            style={[styles.button, styles.buttonPrimary, patchMutation.isPending && styles.buttonDisabled]}
            onPress={saveEdits}
            disabled={patchMutation.isPending}>
            {patchMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonTextLight}>Save changes</Text>
            )}
          </Pressable>
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={cancelEditing}>
            <Text style={styles.buttonTextDark}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.button, styles.buttonPrimary]} onPress={startEditing}>
          <Text style={styles.buttonTextLight}>Edit profile</Text>
        </Pressable>
      )}

      <Pressable style={[styles.button, styles.buttonDestructive]} onPress={handleSignOut}>
        <Text style={styles.buttonTextLight}>Sign out</Text>
      </Pressable>

      {/* Gym picker modal */}
      <Modal visible={gymPickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select home gym</Text>
            <Pressable onPress={() => setGymPickerVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.gymItem}
            onPress={() => {
              setEditGymId(null);
              setGymPickerVisible(false);
            }}>
            <Text style={[styles.gymItemText, editGymId === null && styles.gymItemSelected]}>
              None
            </Text>
          </Pressable>
          <FlatList
            data={gyms}
            keyExtractor={(g) => g.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.gymItem}
                onPress={() => {
                  setEditGymId(item.id);
                  setGymPickerVisible(false);
                }}>
                <Text
                  style={[styles.gymItemText, editGymId === item.id && styles.gymItemSelected]}>
                  {item.name} · {item.city}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#dc2626' },
  container: { alignItems: 'center', padding: 24, gap: 12 },

  avatarWrapper: { position: 'relative', marginBottom: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '700' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  avatarEditBadgeText: { color: '#fff', fontSize: 11 },

  displayName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  username: { fontSize: 15, opacity: 0.5, textAlign: 'center' },
  nameInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    fontWeight: '600',
    width: '100%',
    textAlign: 'center',
    backgroundColor: '#fff',
    color: '#111',
  },

  gymRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  gymLabel: { fontSize: 14, opacity: 0.6 },
  gymValue: { fontSize: 14, fontWeight: '500' },
  gymPicker: { fontSize: 14, fontWeight: '500', color: '#2563eb' },

  statsRow: {
    flexDirection: 'row',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center', padding: 16 },
  statNumber: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, opacity: 0.5, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#e5e7eb' },

  editActions: { width: '100%', gap: 8 },
  button: { width: '100%', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#2563eb' },
  buttonSecondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  buttonDestructive: { backgroundColor: '#dc2626', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonTextLight: { color: '#fff', fontWeight: '600', fontSize: 15 },
  buttonTextDark: { color: '#374151', fontWeight: '600', fontSize: 15 },

  modalContainer: { flex: 1, paddingTop: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalClose: { color: '#2563eb', fontSize: 16 },
  gymItem: { padding: 18, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  gymItemText: { fontSize: 16 },
  gymItemSelected: { color: '#2563eb', fontWeight: '600' },
});
