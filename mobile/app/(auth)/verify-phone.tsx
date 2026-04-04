import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { useAuthStore } from '@/src/stores/authStore';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';
import { typography } from '@/src/theme/typography';

export default function VerifyPhoneScreen() {
  const phone = useAuthStore((s) => s.pendingVerification?.phone ?? '');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  async function handleVerify() {
    setError('');
    if (otpCode.length !== 6) {
      setError('Enter the 6-digit code from your SMS.');
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
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

  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'sms',
        phone,
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
          <Text style={styles.subtitle}>We sent a 6-digit code to {phone}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor={colors.outline}
            keyboardType="number-pad"
            maxLength={6}
            value={otpCode}
            onChangeText={setOtpCode}
            onSubmitEditing={handleVerify}
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>

          <Pressable onPress={handleResend} disabled={loading}>
            <Text style={styles.linkText}>Resend code</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  wordmark: { ...typography.headlineMd, color: colors.primary },
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
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
    width: '100%',
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...typography.bodyLg, color: colors.onPrimary, fontWeight: '700' },
  linkText: { ...typography.bodyMd, color: colors.primary, marginTop: spacing.sm },
});
