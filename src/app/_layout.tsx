import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplash } from '@/components/animated-splash';
import { useAppTheme } from '@/hooks/use-app-theme';
import { StationsProvider } from '@/providers/stations-provider';
import { OnboardingScreen } from '@/screens/onboarding';
import { hasCompletedOnboarding } from '@/services/onboarding';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useAppTheme();
  const isDark = theme.scheme === 'dark';
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      primary: theme.accent,
      border: theme.line,
    },
  };

  useEffect(() => {
    let active = true;
    void hasCompletedOnboarding()
      .then((completed) => {
        if (active) setOnboardingComplete(completed);
      })
      .catch(() => {
        // Une indisponibilité du stockage ne doit pas empêcher d'ouvrir l'application.
        if (active) setOnboardingComplete(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (onboardingComplete !== null) void SplashScreen.hideAsync();
  }, [onboardingComplete]);

  return (
    // Requis par react-native-gesture-handler, dont dépend le comparateur avant/après.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemeProvider value={navigationTheme}>
        <View style={{ flex: 1 }}>
          <StationsProvider>
            {onboardingComplete === null ? (
              <View style={{ flex: 1, backgroundColor: theme.background }} />
            ) : onboardingComplete ? (
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.background },
                }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="coverage" />
                <Stack.Screen name="contributor/[name]" />
                <Stack.Screen name="station/[id]" />
                <Stack.Screen
                  name="align/[id]"
                  options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
                />
                <Stack.Screen
                  name="capture-review"
                  options={{ presentation: 'modal', sheetGrabberVisible: true }}
                />
                <Stack.Screen
                  name="official-submit"
                  options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
                />
              </Stack>
            ) : (
              <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />
            )}
          </StationsProvider>
          {onboardingComplete !== null && showAnimatedSplash ? (
            <AnimatedSplash onFinish={() => setShowAnimatedSplash(false)} />
          ) : null}
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
