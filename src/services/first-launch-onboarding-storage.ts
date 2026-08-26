import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LAUNCH_ONBOARDING_KEY = 'reprise.first-launch-onboarding.v1';

export async function shouldShowFirstLaunchOnboarding() {
  try {
    return (await AsyncStorage.getItem(FIRST_LAUNCH_ONBOARDING_KEY)) !== 'seen';
  } catch {
    return true;
  }
}

export async function markFirstLaunchOnboardingSeen() {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_ONBOARDING_KEY, 'seen');
  } catch {
    // L’onboarding ne doit jamais empêcher d’entrer dans l’application.
  }
}
