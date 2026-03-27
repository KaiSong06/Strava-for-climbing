import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';

export interface GymUpdateData {
  id: string;
  type: 'gym_update';
  gym: { name: string; verified: boolean };
  title: string;
  body: string;
  image: string;
  cta: { label: string; action: string };
}

export function GymUpdateCard({ item }: { item: GymUpdateData }) {
  return (
    <View style={styles.card}>
      {/* Partner Update label */}
      <View style={styles.labelRow}>
        {item.gym.verified && (
          <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primary} />
        )}
        <Text style={styles.label}>Partner Update</Text>
      </View>

      {/* Headline */}
      <Text style={styles.headline}>
        {item.gym.name.toUpperCase()}:{'\n'}
        {item.title}
      </Text>

      {/* Body */}
      <Text style={styles.body}>{item.body}</Text>

      {/* CTA */}
      <Pressable
        onPress={() => console.log(`CTA pressed: ${item.cta.action}`)}
        style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>{item.cta.label}</Text>
      </Pressable>

      {/* Image */}
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.image }} style={styles.image} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: spacing.xxl,
    gap: spacing.lg,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.1)',
    overflow: 'hidden',
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: 'Inter_900Black',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: colors.primary,
  },

  headline: {
    ...typography.headlineLg,
    color: colors.onSurface,
    textTransform: 'uppercase',
  },

  body: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },

  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 6,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: colors.onPrimary,
  },

  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(66,71,82,0.2)',
    marginTop: spacing.sm,
  },
  image: {
    width: '100%',
    height: 200,
  },
});
