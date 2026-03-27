import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TAB_BAR_HEIGHT } from '@/src/components/TabBar';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: true,
        sceneStyle: { paddingBottom: TAB_BAR_HEIGHT + insets.bottom },
      }}
    >
      <Tabs.Screen name="index"  options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="record" options={{ title: 'Record', headerShown: false }} />
      <Tabs.Screen name="gym"    options={{ title: 'Gym' }} />
      <Tabs.Screen name="account" options={{ headerShown: false }} />
      <Tabs.Screen name="two"    options={{ href: null }} />
    </Tabs>
  );
}
