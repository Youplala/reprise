import { useColorScheme } from 'react-native';

import { Themes, type AppTheme } from '@/constants/themes';

/**
 * Thème actif, suivant le réglage système. `app.json` déclare déjà
 * `userInterfaceStyle: "automatic"` : iOS transmet donc le mode sombre à l'app, il ne restait
 * qu'à en tenir compte.
 */
export function useAppTheme(): AppTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Themes.dark : Themes.light;
}
