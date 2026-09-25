import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
// Side-effect import: captures the browser's one-time install prompt at startup.
import '@/lib/pwaInstall';
import { useSessionListener } from '@/hooks/useSession';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useIsDesktopWeb } from '@/hooks/useResponsive';
import { DesktopSidebar } from '@/components/DesktopSidebar';
import { HeaderBackButton } from '@/components/HeaderBackButton';
import { PlanGenerationPill } from '@/components/PlanGenerationPill';
import { WorkoutSessionOverlay } from '@/components/WorkoutSessionOverlay';
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
  const isDesktopWeb = useIsDesktopWeb();
  const [hasHiddenSplash, setHasHiddenSplash] = useState(false);

  const readyToRoute = !isInitializing && (!session || !isProfileLoading);
  const inAuthGroup = segments[0] === '(auth)';
  const inOnboarding = segments[0] === 'onboarding';
  const isOnboarded = Boolean(profile?.onboarded_at);

  useEffect(() => {
    if (readyToRoute && !hasHiddenSplash) {
      setHasHiddenSplash(true);
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [readyToRoute, hasHiddenSplash]);

  useEffect(() => {
    if (isInitializing) return;

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }
    if (!session || isProfileLoading) return;

    if (!isOnboarded && !inOnboarding) {
      // Straight from sign-in/verify to onboarding — no flash of the home screen.
      router.replace('/onboarding');
      return;
    }
    if (isOnboarded && (inAuthGroup || inOnboarding)) {
      // Also covers finishing onboarding: completing it flips onboarded_at and lands here.
      router.replace('/(tabs)');
    }
  }, [session, isInitializing, isProfileLoading, isOnboarded, inAuthGroup, inOnboarding, router]);

  const showSidebar = isDesktopWeb && Boolean(session) && isOnboarded && !inAuthGroup && !inOnboarding;

  return (
    <View style={styles.shell}>
      {showSidebar ? <DesktopSidebar /> : null}
      <View style={styles.main}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen
            name="exercise/[id]"
            options={{ headerShown: true, title: 'Exercise', headerLeft: () => <HeaderBackButton fallback="/glossary" /> }}
          />
          <Stack.Screen
            name="plan/index"
            options={{ headerShown: true, title: 'Exercise groups', headerLeft: () => <HeaderBackButton fallback="/log" /> }}
          />
          <Stack.Screen
            name="plan/history"
            options={{ headerShown: true, title: 'Past exercise groups', headerLeft: () => <HeaderBackButton fallback="/plan" /> }}
          />
          <Stack.Screen
            name="plan/new"
            options={{ headerShown: true, title: 'New exercise groups', headerLeft: () => <HeaderBackButton fallback="/plan" /> }}
          />
          <Stack.Screen
            name="records"
            options={{ headerShown: true, title: 'Personal records', headerLeft: () => <HeaderBackButton fallback="/" /> }}
          />
          <Stack.Screen
            name="workout/new"
            options={{ headerShown: true, title: 'Log workout', headerLeft: () => <HeaderBackButton fallback="/log" /> }}
          />
        </Stack>
        {/* Background plan generation status, over every signed-in screen. */}
        {session && isOnboarded && !inAuthGroup && !inOnboarding ? (
          <>
            <PlanGenerationPill />
            {/* Rest-timer chime + "workout in progress" pill, on every screen. */}
            <WorkoutSessionOverlay />
          </>
        ) : null}
      </View>
    </View>
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

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  main: {
    flex: 1,
  },
});
