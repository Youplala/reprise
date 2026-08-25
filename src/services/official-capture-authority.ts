type PendingOfficialCapture = {
  expiresAt: number;
  stationId: string;
  uri: string;
};

const AUTHORIZATION_TTL_MS = 5 * 60 * 1000;
let pendingCapture: PendingOfficialCapture | undefined;

export function authorizeOfficialCapture(stationId: string, uri: string) {
  pendingCapture = {
    expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
    stationId,
    uri,
  };
}

export function isOfficialCaptureAuthorized(stationId: string, uri: string) {
  if (!pendingCapture || pendingCapture.expiresAt < Date.now()) {
    pendingCapture = undefined;
    return false;
  }
  return pendingCapture.stationId === stationId && pendingCapture.uri === uri;
}
