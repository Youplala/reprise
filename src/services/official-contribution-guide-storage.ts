import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFICIAL_CONTRIBUTION_GUIDE_KEY = 'reprise.official-contribution-guide.v1';

type GuideStorage = {
  markSeen: () => Promise<void>;
  shouldShow: () => Promise<boolean>;
};

export function createOfficialContributionGuideStorage(
  read: () => Promise<string | null>,
  write: () => Promise<void>,
): GuideStorage {
  let seenThisSession = false;

  return {
    async shouldShow() {
      if (seenThisSession) return false;
      try {
        const stored = await read();
        return !seenThisSession && stored !== 'seen';
      } catch {
        return !seenThisSession;
      }
    },
    async markSeen() {
      seenThisSession = true;
      try {
        await write();
      } catch {
        // Le guide reste un confort : un stockage indisponible ne bloque jamais le formulaire.
      }
    },
  };
}

const guideStorage = createOfficialContributionGuideStorage(
  () => AsyncStorage.getItem(OFFICIAL_CONTRIBUTION_GUIDE_KEY),
  () => AsyncStorage.setItem(OFFICIAL_CONTRIBUTION_GUIDE_KEY, 'seen'),
);

export function shouldShowOfficialContributionGuide() {
  return guideStorage.shouldShow();
}

export function markOfficialContributionGuideSeen() {
  return guideStorage.markSeen();
}
