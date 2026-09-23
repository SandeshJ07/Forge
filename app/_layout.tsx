import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { useSessionListener } from '@/hooks/useSession';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unsupported (e.g. web) — safe to ignore.
});

function RootNavigation() {
  useSessionListener();
  const session = useAuthStore((s) => s.session);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const { data: profile, isLoading: isProfileLoading } = useUserProfile();
  const segments = useSegments();
  const router = useRouter();
  const [hasHiddenSplash, setHasHiddenSplash] = useState(false);

  const readyToRoute = !isInitializing && (!session || !isProfileLoading);

  useEffect(() => {
    if (readyToRoute && !hasHiddenSplash) {
      setHasHiddenSplash(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [readyToRoute, hasHiddenSplash]);

  useEffect(() => {
    if (isInitializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (session && inAuthGroup) {
      router.replace('/(tabs)');
      return;
    }

    if (session && !isProfileLoading && !profile?.onboarded_at && !inOnboarding && !inAuthGroup) {
      router.replace('/onboarding');
    }
  }, [session, isInitializing, isProfileLoading, profile?.onboarded_at, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="exercise/[id]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="plan/history" options={{ headerShown: true, title: 'Plan history' }} />
      <Stack.Screen name="records" options={{ headerShown: true, title: 'Personal records' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <RootNavigation />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
