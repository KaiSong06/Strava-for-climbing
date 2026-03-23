import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/src/lib/api';

interface UserResult {
  type: 'user';
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface GymResult {
  type: 'gym';
  id: string;
  name: string;
  city: string;
}

type SearchResult = UserResult | GymResult;

const RECENT_KEY = 'crux:recent_searches';
const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;

async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveSearch(q: string): Promise<void> {
  try {
    const existing = await loadRecentSearches();
    const updated = [q, ...existing.filter((s) => s !== q)].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Non-critical
  }
}

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRecentSearches().then(setRecent);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<{ data: SearchResult[] }>(
          `/search?q=${encodeURIComponent(query)}`,
        );
        setResults(data.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelectUser(username: string) {
    void saveSearch(username);
    loadRecentSearches().then(setRecent);
    router.push({ pathname: '/profile/[username]', params: { username } });
  }

  function handleSelectGym(gymId: string, gymName: string) {
    void saveSearch(gymName);
    loadRecentSearches().then(setRecent);
    router.push({ pathname: '/gym/[gymId]', params: { gymId } });
  }

  const users = results.filter((r): r is UserResult => r.type === 'user');
  const gyms = results.filter((r): r is GymResult => r.type === 'gym');
  const showRecent = query.length < 2 && recent.length > 0;

  return (
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search climbers and gyms..."
          placeholderTextColor="#9ca3af"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {loading && <ActivityIndicator style={styles.inputLoader} />}
      </View>

      {/* Recent searches */}
      {showRecent && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent searches</Text>
          {recent.map((s) => (
            <Pressable key={s} style={styles.recentRow} onPress={() => setQuery(s)}>
              <Text style={styles.recentText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* No results */}
      {!loading && query.length >= 2 && results.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          results.length > 0 ? (
            <>
              {users.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Climbers</Text>
                  {users.map((u) => {
                    const initial = u.display_name[0]?.toUpperCase() ?? '?';
                    return (
                      <Pressable
                        key={u.id}
                        style={styles.resultRow}
                        onPress={() => handleSelectUser(u.username)}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>{initial}</Text>
                          </View>
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName}>{u.display_name}</Text>
                          <Text style={styles.resultSub}>@{u.username}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {gyms.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Gyms</Text>
                  {gyms.map((g) => (
                    <Pressable
                      key={g.id}
                      style={styles.resultRow}
                      onPress={() => handleSelectGym(g.id, g.name)}>
                      <View style={styles.gymIcon}>
                        <Text style={styles.gymIconText}>🏟</Text>
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>{g.name}</Text>
                        <Text style={styles.resultSub}>{g.city}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#111827' },
  inputLoader: { marginRight: 4 },

  section: { paddingTop: 8 },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  recentRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#f3f4f6',
  },
  recentText: { fontSize: 14, color: '#374151' },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#f3f4f6',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  gymIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  gymIconText: { fontSize: 18 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultSub: { fontSize: 13, color: '#6b7280', marginTop: 1 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 64 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
