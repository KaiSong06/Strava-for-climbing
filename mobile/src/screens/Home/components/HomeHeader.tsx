import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { spacing } from '@/src/theme/spacing';

interface HomeHeaderProps {
  onNotificationsPress?: () => void;
}

export function HomeHeader({ onNotificationsPress }: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {/* Inner wrapper ensures content is visible above blur */}
      <View style={styles.inner}>
        <Text style={styles.wordmark}>CRUX</Text>
        <Pressable
          onPress={onNotificationsPress}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="bell-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export const HEADER_CONTENT_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'rgba(19,19,19,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.4,
    shadowRadius: 48,
    elevation: 16,
  },
  inner: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  wordmark: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    letterSpacing: -1,
    textTransform: 'uppercase',
    color: colors.onSurface,
  },
  iconBtn: {
    padding: spacing.sm,
    borderRadius: 12,
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(168,200,255,0.1)',
  },
});
