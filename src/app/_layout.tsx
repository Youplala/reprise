import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';


import { useAppTheme } from '@/hooks/use-app-theme';
import { StationsProvider } from '@/providers/stations-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useAppTheme();
  const isDark = theme.scheme === 'dark';

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
    // Les données sont embarquées et les polices sont celles du système : il n'y a rien à
    // attendre, l'écran de lancement peut se retirer dès le premier rendu.
    SplashScreen.hideAsync();
  }, []);

  return (
    // Requis par react-native-gesture-handler, dont dépend le comparateur avant/après.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemeProvider value={navigationTheme}>
        <StationsProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="coverage" />
            <Stack.Screen
              name="fieldbook"
              options={{ presentation: 'modal', sheetGrabberVisible: true }}
            />
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
        </StationsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
