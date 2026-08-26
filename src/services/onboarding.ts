import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'reprise:onboarding:v1';

export const HISTORIC_GRID_COUNT = 1755;

export const LOCATION_PRIVACY_COPY =
  'Elle sert à trouver les photos proches. Lors d’une prise de vue, les coordonnées peuvent être conservées dans votre carnet et préparées dans le formulaire officiel. Rien n’est envoyé sans votre validation.';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'completed';
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'completed');
}
