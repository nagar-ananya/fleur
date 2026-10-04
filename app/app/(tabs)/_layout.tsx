/**
 * Tab navigator (REQUIREMENTS §11.1): Today, Rules, History, Reset, Settings.
 *
 * The bar floats above the content with a soft rounded shell, and the active
 * tab's icon sits in a tinted pill. Labels stay visible on every tab — a
 * label-free bar looks cleaner and is measurably worse to use.
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';

import {
  HistoryIcon,
  InsightsIcon,
  LeafIcon,
  SettingsIcon,
  TodayIcon,
  type IconProps,
} from '../../src/components/icons';
import { useTheme } from '../../src/hooks/useTheme';
import { radius, spacing } from '../../src/theme';

type IconComponent = (props: IconProps) => React.ReactElement;

function TabItem({
  Icon,
  color,
  focused,
  background,
}: {
  Icon: IconComponent;
  color: ColorValue;
  focused: boolean;
  background: string;
}): React.ReactElement {
  return (
    <View
      style={{
        width: 52,
        height: 32,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? background : 'transparent',
      }}
    >
      <Icon size={22} color={String(color)} strokeWidth={focused ? 2.1 : 1.8} />
    </View>
  );
}

export default function TabsLayout(): React.ReactElement {
  const { palette } = useTheme();

  const icon =
    (Icon: IconComponent) =>
    ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <TabItem Icon={Icon} color={color} focused={focused} background={palette.primarySoft} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarStyle: {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          borderRadius: radius.xl,
          borderTopWidth: 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          backgroundColor: palette.surface,
          shadowColor: palette.shadow,
          shadowOpacity: 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon(TodayIcon) }} />
      <Tabs.Screen
        name="rules"
        options={{ title: 'Rules', tabBarIcon: icon(InsightsIcon) }}
      />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon(HistoryIcon) }} />
      <Tabs.Screen name="reset" options={{ title: 'Reset', tabBarIcon: icon(LeafIcon) }} />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: icon(SettingsIcon) }}
      />
    </Tabs>
  );
}
