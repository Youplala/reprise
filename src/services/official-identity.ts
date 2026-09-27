import AsyncStorage from '@react-native-async-storage/async-storage';

const IDENTITY_KEY = 'reprise:official-identity:v1';

/**
 * Identité que l'utilisateur choisit de mémoriser pour le formulaire officiel. Elle reste sur
 * l'appareil : Paris GO ne la transmet à personne, elle est seulement recopiée dans le formulaire
 * de l'Observatoire, que l'utilisateur vérifie et envoie lui-même.
 */
export type OfficialIdentity = {
  fullName: string;
  email: string;
  age?: string;
  residenceCity?: string;
  country?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Nettoie une saisie ; `undefined` si le nom ou l'e-mail manque ou si l'e-mail est invalide. */
export function normalizeOfficialIdentity(input: Partial<OfficialIdentity>): OfficialIdentity | undefined {
  const clean = (value?: string) => value?.trim().replace(/\s+/g, ' ') || undefined;
  const fullName = clean(input.fullName);
  const email = clean(input.email)?.toLowerCase();
  if (!fullName || !email || !EMAIL_PATTERN.test(email)) return undefined;
  const age = clean(input.age)?.replace(/\D/g, '') || undefined;
  return {
    fullName,
    email,
    age,
    residenceCity: clean(input.residenceCity),
    country: clean(input.country),
  };
}

export async function loadOfficialIdentity(): Promise<OfficialIdentity | undefined> {
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_KEY);
    return raw ? normalizeOfficialIdentity(JSON.parse(raw) as Partial<OfficialIdentity>) : undefined;
  } catch {
    return undefined;
  }
}

export async function saveOfficialIdentity(identity: OfficialIdentity) {
  await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export async function forgetOfficialIdentity() {
  await AsyncStorage.removeItem(IDENTITY_KEY);
}
