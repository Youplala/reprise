import { OfficialSubmissionScreen } from '@/screens/official-submission';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function OfficialSubmissionRoute() {
  // Les modales plein écran iOS ont leur propre contrôleur natif. Un provider local évite de
  // réutiliser les insets de l'écran situé dessous, qui plaçaient le header sous la status bar.
  return (
    <SafeAreaProvider>
      <OfficialSubmissionScreen />
    </SafeAreaProvider>
  );
}
