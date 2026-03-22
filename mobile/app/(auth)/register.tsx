import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { api, ApiError } from '@/src/lib/api';
import { useAuthStore } from '@/src/stores/authStore';
import type { AuthUser } from '../../../shared/types';

interface RegisterResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// Client-side validation matching server rules
function validate(fields: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(fields.username)) {
    return 'Username must be 3–20 characters: letters, numbers, underscores only.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return 'Enter a valid email address.';
  }
  if (fields.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (fields.password !== fields.confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    const validationError = validate({ username, email, password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const result = await api.post<RegisterResponse>('/auth/register', {
        username,
        email,
        password,
      });
      setAuth(result.user, result.accessToken, result.refreshToken);
      // Auth gate in _layout.tsx handles navigation
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          secureTextEntry
          textContentType="newPassword"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleRegister}
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  error: { color: '#dc2626', textAlign: 'center', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#111',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { marginTop: 12, alignSelf: 'center' },
  linkText: { color: '#2563eb', fontSize: 14 },
});
