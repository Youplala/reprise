import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'reprise:onboarding:v1';

export const HISTORIC_GRID_COUNT = 1755;

export const LOCATION_PRIVACY_COPY =
  'Elle sert à trouver les photos proches. Vos coordonnées peuvent être enregistrées dans votre carnet et préremplies dans le formulaire officiel, jamais envoyées sans votre validation.';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'completed';
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'completed');
}
