const OFFICIAL_ORIGIN = 'https://observatoire-photo.paris';

export type OfficialPageKind = 'form' | 'success' | 'blank' | 'untrusted';

export function officialPageKind(value: string): OfficialPageKind {
  if (value === 'about:blank') return 'blank';
  try {
    const url = new URL(value);
    const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1]?.toLowerCase();
    if (
      url.origin !== OFFICIAL_ORIGIN ||
      authority !== 'observatoire-photo.paris' ||
      url.username ||
      url.password ||
      url.port
    ) {
      return 'untrusted';
    }
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    if (pathname === '/elements/add') return 'form';
    if (pathname === '/elements/added') return 'success';
  } catch {
    // Toute URL ambiguë reste hors de la frontière de confiance.
  }
  return 'untrusted';
}

export function isAllowedOfficialNavigation(value: string) {
  return officialPageKind(value) !== 'untrusted';
}

export function shouldInjectOfficialScripts(value: string, fixtureEnabled = false) {
  const kind = officialPageKind(value);
  return kind === 'form' || (fixtureEnabled && kind === 'blank');
}

export function acceptsOfficialBridgeMessage(value: string, fixtureEnabled = false) {
  return shouldInjectOfficialScripts(value, fixtureEnabled);
}
