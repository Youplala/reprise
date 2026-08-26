import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_PREFERENCE_KEY = 'reprise:location-preference:v1';

export type LocationPreference = 'nearby' | 'manual';

export async function getLocationPreference(): Promise<LocationPreference | null> {
  const value = await AsyncStorage.getItem(LOCATION_PREFERENCE_KEY);
  return value === 'nearby' || value === 'manual' ? value : null;
}

export async function setLocationPreference(preference: LocationPreference): Promise<void> {
  await AsyncStorage.setItem(LOCATION_PREFERENCE_KEY, preference);
}

/** Une panne du stockage local ne doit jamais bloquer l'accès à l'application. */
export async function trySetLocationPreference(
  preference: LocationPreference,
  write: (value: LocationPreference) => Promise<void> = setLocationPreference,
): Promise<boolean> {
  try {
    await write(preference);
    return true;
  } catch {
    return false;
  }
}

/** Les installations existantes gardent la recherche automatique déjà en place. */
export async function shouldAutoLocate(): Promise<boolean> {
  return (await getLocationPreference()) !== 'manual';
}
