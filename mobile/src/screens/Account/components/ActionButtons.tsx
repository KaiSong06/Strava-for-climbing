import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { colors } from '@/src/theme/colors';

interface AnimatedButtonProps {
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  label: string;
}

function AnimatedButton({ onPress, style, textStyle, label }: AnimatedButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        <Text style={textStyle}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

interface Props {
  onEditProfile: () => void;
  onSignOut: () => void;
}

export function ActionButtons({ onEditProfile, onSignOut }: Props) {
  return (
    <View style={styles.container}>
      <AnimatedButton
        onPress={onEditProfile}
        style={styles.editButton}
        textStyle={styles.editButtonText}
        label="Edit Profile"
      />
      <AnimatedButton
        onPress={onSignOut}
        style={styles.signOutButton}
        textStyle={styles.signOutButtonText}
        label="Sign Out"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  // Ghost border (outline at 20% opacity) — this is a button shape border, not a divider
  signOutButton: {
    borderRadius: 6,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(140, 145, 157, 0.2)',
  },
  signOutButtonText: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: '700',
  },
});
