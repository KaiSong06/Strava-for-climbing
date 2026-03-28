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
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/authStore';

type Step = 'form' | 'otp';

function validateForm(fields: {
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!/^\d{10}$/.test(fields.phone)) {
    return 'Enter a valid 10-digit phone number.';
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(fields.username)) {
    return 'Username must be 3–20 characters: letters, numbers, underscores only.';
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
  const setPendingVerification = useAuthStore((s) => s.setPendingVerification);
  const [step, setStep] = useState<Step>('form');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fullPhone = `+1${phone}`;

  async function handleSignUp() {
    setError('');
    const validationError = validateForm({ phone, username, password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        phone: fullPhone,
        password,
        options: { data: { username, display_name: username } },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setPendingVerification(fullPhone);
      setStep('otp');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    if (otpCode.length !== 6) {
      setError('Enter the 6-digit code from your SMS.');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otpCode,
        type: 'sms',
      });
      if (verifyError) {
        setError(verifyError.message);
        return;
      }
      // onAuthStateChange fires SIGNED_IN → auth store updates → AuthGate navigates
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError('');
    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'sms',
        phone: fullPhone,
      });
      if (resendError) {
        setError(resendError.message);
      }
    } catch {
      setError('Could not resend code.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <Text style={styles.title}>Verify your phone</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to {fullPhone}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            value={otpCode}
            onChangeText={setOtpCode}
            onSubmitEditing={handleVerifyOtp}
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>

          <Pressable onPress={handleResendCode} disabled={loading}>
            <Text style={styles.linkText}>Resend code</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
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
          placeholder="Phone number (10 digits)"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
        />
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
          onSubmitEditing={handleSignUp}
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
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
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 4 },
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
