const REPORT_RECIPIENT = 'observatoire-photo@caue75.fr';
const DEFAULT_OFFICIAL_URL = 'https://observatoire-photo.paris/map';

type PhotoReportInput = {
  title: string;
  stationId?: string;
  officialUrl?: string;
};

export type PhotoReportDraft = {
  recipient: string;
  subject: string;
  body: string;
  mailto: string;
  fallbackMessage: string;
};

type LinkLauncher = {
  canOpenURL: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<unknown>;
};

export async function launchPhotoReport(
  mailto: string,
  launcher: LinkLauncher,
): Promise<'opened' | 'fallback'> {
  try {
    if (!(await launcher.canOpenURL(mailto))) return 'fallback';
    await launcher.openURL(mailto);
    return 'opened';
  } catch {
    return 'fallback';
  }
}

export function buildPhotoReportDraft({
  title,
  stationId,
  officialUrl,
}: PhotoReportInput): PhotoReportDraft {
  const resolvedStationId = stationId ?? 'inconnu';
  const resolvedOfficialUrl = officialUrl ?? DEFAULT_OFFICIAL_URL;
  const subject = `Signalement d’une photo refaite · ${title}`;
  const body = [
    'Bonjour,',
    '',
    `Je souhaite signaler un problème sur la photo actuelle associée à « ${title} » (identifiant ${resolvedStationId}).`,
    `Fiche : ${resolvedOfficialUrl}`,
    '',
    'Problème constaté : ',
  ].join('\n');
  const mailto = `mailto:${REPORT_RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const fallbackMessage = [
    `Destinataire : ${REPORT_RECIPIENT}`,
    `Sujet : ${subject}`,
    `Identifiant : ${resolvedStationId}`,
    `Fiche officielle : ${resolvedOfficialUrl}`,
    '',
    'Problème constaté :',
  ].join('\n');

  return {
    recipient: REPORT_RECIPIENT,
    subject,
    body,
    mailto,
    fallbackMessage,
  };
}
