import { Tabs } from 'expo-router';
import React from 'react';
import { type ColorValue } from 'react-native';

import {
  HistoryIcon,
  LeafIcon,
  RulesIcon,
  SettingsIcon,
  TodayIcon,
  type IconProps,
} from '../../src/components/icons';
import { useTheme } from '../../src/hooks/useTheme';

type IconComponent = (props: IconProps) => React.ReactElement;

export default function TabsLayout(): React.ReactElement {
  const { palette } = useTheme();

  const icon =
    (Icon: IconComponent) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Icon size={23} color={String(color)} strokeWidth={focused ? 2.1 : 1.8} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon(TodayIcon) }} />
      <Tabs.Screen name="rules" options={{ title: 'Rules', tabBarIcon: icon(RulesIcon) }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon(HistoryIcon) }} />
      <Tabs.Screen name="reset" options={{ title: 'Reset', tabBarIcon: icon(LeafIcon) }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon(SettingsIcon) }} />
    </Tabs>
  );
}
