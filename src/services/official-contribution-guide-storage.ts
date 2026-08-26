import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFICIAL_CONTRIBUTION_GUIDE_KEY = 'reprise.official-contribution-guide.v1';

export async function shouldShowOfficialContributionGuide() {
  try {
    return (await AsyncStorage.getItem(OFFICIAL_CONTRIBUTION_GUIDE_KEY)) !== 'seen';
  } catch {
    return true;
  }
}

export async function markOfficialContributionGuideSeen() {
  try {
    await AsyncStorage.setItem(OFFICIAL_CONTRIBUTION_GUIDE_KEY, 'seen');
  } catch {
    // Le guide reste un confort : un stockage indisponible ne bloque jamais le formulaire.
  }
}
