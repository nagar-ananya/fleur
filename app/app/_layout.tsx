import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AppProvider, useApp } from '../src/hooks/appState';
import { useTheme } from '../src/hooks/useTheme';

function Gate(): React.ReactElement {
  const { ready, profile } = useApp();
  const { palette, scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!profile && !inOnboarding) {
      router.replace('/onboarding');
    } else if (profile && inOnboarding) {
      router.replace('/');
    }
  }, [ready, profile, segments, router]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerTitleStyle: { fontSize: 17, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="checkin"
          options={{ presentation: 'modal', title: 'Daily check-in', headerShown: false }}
        />
        <Stack.Screen name="backfill" options={{ presentation: 'modal', title: 'Backfill a day' }} />
        <Stack.Screen
          name="risk-detail"
          options={{ presentation: 'modal', title: 'What this means' }}
        />
        <Stack.Screen name="factor-detail" options={{ title: 'Factor' }} />

        <Stack.Screen name="reset-category" options={{ title: 'Reset' }} />
        <Stack.Screen
          name="reset-session"
          options={{ presentation: 'modal', title: 'Session', headerShown: false }}
        />
        <Stack.Screen name="reset-movement" options={{ title: 'Movement' }} />
        <Stack.Screen name="reset-recipe" options={{ title: 'Recipe' }} />
        <Stack.Screen name="reset-skin-routine" options={{ title: "Today's skin routine" }} />

        <Stack.Screen name="settings-profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="settings-export" options={{ title: 'Export' }} />
        <Stack.Screen name="settings-ai" options={{ title: 'AI second opinion' }} />
        <Stack.Screen name="settings-model" options={{ title: 'Scoring & disclaimer' }} />
        <Stack.Screen name="settings-delete" options={{ title: 'Delete all data' }} />
      </Stack>
    </>
  );
}

export default function RootLayout(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
