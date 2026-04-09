import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessiblePressable } from '@/src/components/ui/AccessiblePressable';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/authStore';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

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
  const insets = useSafeAreaInsets();

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
      <View style={styles.screen}>
        <StatusBar style="light" />
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.wordmark}>Crux</Text>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.container}>
            <Text style={styles.title}>Verify your phone</Text>
            <Text style={styles.subtitle}>We sent a 6-digit code to {fullPhone}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              accessibilityLabel="Verification code"
              accessibilityHint="Enter the 6-digit code from your SMS"
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.outline}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
              onSubmitEditing={handleVerifyOtp}
            />

            <AccessiblePressable
              accessibilityLabel="Verify phone"
              accessibilityState={{ busy: loading, disabled: loading }}
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </AccessiblePressable>

            <AccessiblePressable
              accessibilityLabel="Resend verification code"
              onPress={handleResendCode}
              disabled={loading}
            >
              <Text style={styles.linkText}>Resend code</Text>
            </AccessiblePressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.wordmark}>Crux</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            accessibilityLabel="Phone number"
            accessibilityHint="Enter your 10-digit phone number"
            style={styles.input}
            placeholder="Phone number (10 digits)"
            placeholderTextColor={colors.outline}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
          <TextInput
            accessibilityLabel="Username"
            accessibilityHint="Choose a username, 3 to 20 characters"
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            accessibilityLabel="Password"
            accessibilityHint="Enter at least 8 characters"
            style={styles.input}
            placeholder="Password (min 8 characters)"
            placeholderTextColor={colors.outline}
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            accessibilityLabel="Confirm password"
            accessibilityHint="Re-enter your password"
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.outline}
            secureTextEntry
            textContentType="newPassword"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSignUp}
          />

          <AccessiblePressable
            accessibilityLabel="Create account"
            accessibilityState={{ busy: loading, disabled: loading }}
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </AccessiblePressable>

          <Link href="/(auth)/login" style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  wordmark: { ...typography.headlineMd, color: colors.primary },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  error: {
    ...typography.bodyMd,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.bodyLg,
    borderRadius: 12,
    padding: spacing.md,
    backgroundColor: colors.surfaceContainerHighest,
    color: colors.onSurface,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.bodyLg, color: colors.onPrimary, fontWeight: '700' },
  link: { marginTop: spacing.md, alignSelf: 'center' },
  linkText: { ...typography.bodyMd, color: colors.primary },
});
