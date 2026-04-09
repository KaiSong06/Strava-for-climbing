import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AccessiblePressable } from './ui/AccessiblePressable';

export const TAB_BAR_HEIGHT = 72;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_MAP: Record<string, { inactive: IconName; active: IconName }> = {
  index: { inactive: 'home-outline', active: 'home' },
  search: { inactive: 'magnify', active: 'magnify' },
  gym: { inactive: 'dumbbell', active: 'dumbbell' },
  account: { inactive: 'account-outline', active: 'account' },
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  search: 'Search',
  gym: 'Gyms',
  account: 'Account',
  record: 'Log a climb',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 12 }]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;

        // Skip hidden routes (href: null) — Expo Router injects href but bottom-tabs types don't include it
        if ((options as { href?: string | null })?.href === null) return null;

        const isFocused = state.index === index;
        const isRecord = route.name === 'record';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isRecord) {
          return (
            <AccessiblePressable
              key={route.key}
              style={[styles.tabItem, styles.fabItem]}
              onPress={onPress}
              accessibilityLabel={TAB_LABELS.record ?? 'Log a climb'}
              accessibilityRole="button"
            >
              <View style={styles.fabButton}>
                <MaterialCommunityIcons name="plus" size={28} color="#003062" />
              </View>
            </AccessiblePressable>
          );
        }

        const icons = ICON_MAP[route.name];
        if (!icons) return null;

        const iconName = isFocused ? icons.active : icons.inactive;
        const color = isFocused ? '#a8c8ff' : '#71717a';
        const tabLabel = TAB_LABELS[route.name] ?? route.name;

        return (
          <AccessiblePressable
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            accessibilityLabel={`${tabLabel} tab`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
          >
            {isFocused ? (
              <View style={styles.activePill}>
                <MaterialCommunityIcons name={iconName} size={24} color={color} />
              </View>
            ) : (
              <MaterialCommunityIcons name={iconName} size={24} color={color} />
            )}
          </AccessiblePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(28,27,27,0.9)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 16,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  activePill: {
    backgroundColor: 'rgba(168, 200, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabItem: {
    marginTop: -12,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#a8c8ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a8c8ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
