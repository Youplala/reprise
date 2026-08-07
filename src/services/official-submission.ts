import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export const OBSERVATOIRE_CONTRIBUTION_URL =
  'https://observatoire-photo.paris/elements/add';
export const OBSERVATOIRE_HOST = 'observatoire-photo.paris';
export const OFFICIAL_SUBMISSION_FIXTURE_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_OFFICIAL_SUBMISSION_FIXTURE === '1';

export type OfficialPrefill = {
  address?: string;
  captureDate: string;
  city: string;
  device?: string;
  latitude?: number;
  longitude?: number;
  note?: string;
  postalCode?: string;
};

export type OfficialBridgeMessage =
  | { type: 'ready' }
  | { type: 'prefill'; count: number; fields: string[] }
  | { type: 'success'; message?: string }
  | { type: 'form-error'; message?: string };

export type PreparedImages = {
  current: boolean;
  reference: boolean;
};

function safeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * Adaptateur volontairement sémantique du formulaire GoGoCarto.
 *
 * Les identifiants HTML sont générés depuis la configuration de la carte et peuvent changer.
 * On cherche donc les contrôles par leur libellé français et on ne remplit que les champs vides.
 * Aucun bouton, aucune case de consentement et aucun champ fichier ne sont manipulés ici.
 */
export function buildObservatoirePrefillScript(payload: OfficialPrefill) {
  return `
    (() => {
      const payload = ${safeScriptJson(payload)};
      const bridge = window.ReactNativeWebView;
      const send = (message) => {
        try { bridge && bridge.postMessage(JSON.stringify(message)); } catch (_) {}
      };
      const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
      const nativeSetter = (control, value) => {
        if (!control || value === undefined || value === null || String(value).length === 0) return false;
        if (control.type === 'checkbox' || control.type === 'radio' || control.type === 'file') return false;
        if (String(control.value || '').trim().length > 0) return false;
        const prototype = control.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : control.tagName === 'SELECT'
            ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (setter) setter.call(control, String(value));
        else control.value = String(value);
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      const controlForLabel = (label) => {
        if (label.htmlFor) {
          const direct = document.getElementById(label.htmlFor);
          if (direct) return direct;
        }
        return label.querySelector('input, textarea, select')
          || label.parentElement?.querySelector('input, textarea, select')
          || label.closest('.form-group, .control-group, .field, [class*=field]')?.querySelector('input, textarea, select');
      };
      const fillByLabel = (field, aliases, value, validator) => {
        if (value === undefined || value === null || String(value).length === 0) return false;
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          const text = normalize(label.textContent);
          if (!aliases.some((alias) => text === alias || text.startsWith(alias + ' '))) continue;
          const control = controlForLabel(label);
          if (!control || (validator && !validator(control))) continue;
          if (nativeSetter(control, value)) return true;
        }
        return false;
      };
      const fillCoordinate = (kind, value) => {
        if (!Number.isFinite(value)) return false;
        const aliases = kind === 'latitude' ? ['latitude', 'lat'] : ['longitude', 'lng', 'lon'];
        const controls = Array.from(document.querySelectorAll('input'));
        for (const control of controls) {
          const key = normalize((control.name || '') + ' ' + (control.id || ''));
          const tokens = key.split(' ');
          if (!aliases.some((alias) => tokens.includes(alias))) continue;
          if (nativeSetter(control, Number(value).toFixed(6))) return true;
        }
        return false;
      };
      const fill = () => {
        const fields = [];
        const textOnly = (control) => !['email', 'file', 'checkbox', 'radio'].includes(control.type);
        if (fillByLabel('address', ['adresse', 'adresse postale', 'numero et rue'], payload.address, textOnly)) fields.push('address');
        if (fillByLabel('postalCode', ['code postal'], payload.postalCode, textOnly)) fields.push('postalCode');
        if (fillByLabel('city', ['ville', 'commune'], payload.city, textOnly)) fields.push('city');
        if (fillByLabel('captureDate', ['date de prise de vue', 'date de la prise de vue'], payload.captureDate, textOnly)) fields.push('captureDate');
        if (fillByLabel('device', ['type d appareil', 'appareil utilise', 'appareil photo'], payload.device, textOnly)) fields.push('device');
        if (fillByLabel('note', ['commentaire', 'legende', 'observation', 'elements de reperage'], payload.note, textOnly)) fields.push('note');
        if (fillCoordinate('latitude', payload.latitude)) fields.push('latitude');
        if (fillCoordinate('longitude', payload.longitude)) fields.push('longitude');
        const signature = fields.sort().join('|');
        if (signature && signature !== window.__reprisePrefillSignature) {
          window.__reprisePrefillSignature = signature;
          send({ type: 'prefill', count: fields.length, fields });
        }
      };
      const inspectStatus = () => {
        const text = normalize(document.body?.innerText || '');
        if (/contribution (a ete )?(envoyee|enregistree)|en attente de (validation|moderation)|merci pour votre contribution/.test(text)) {
          send({ type: 'success', message: 'Contribution transmise à l’Observatoire.' });
          return;
        }
        const alert = document.querySelector('.alert-danger, .form-error, [role=alert].error');
        if (alert?.textContent) send({ type: 'form-error', message: alert.textContent.trim().slice(0, 240) });
      };
      fill();
      inspectStatus();
      if (!window.__repriseObserver) {
        window.__repriseObserver = new MutationObserver(() => {
          clearTimeout(window.__repriseObserverTimer);
          window.__repriseObserverTimer = setTimeout(() => { fill(); inspectStatus(); }, 180);
        });
        window.__repriseObserver.observe(document.documentElement, { childList: true, subtree: true });
        send({ type: 'ready' });
      }
    })();
    true;
  `;
}

export function parseOfficialBridgeMessage(value: string): OfficialBridgeMessage | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<OfficialBridgeMessage>;
    if (
      parsed.type === 'ready' ||
      parsed.type === 'prefill' ||
      parsed.type === 'success' ||
      parsed.type === 'form-error'
    ) {
      return parsed as OfficialBridgeMessage;
    }
  } catch {
    // Un message tiers dans la page ne doit pas faire tomber l'écran natif.
  }
  return undefined;
}

async function addToRepriseAlbum(uri: string, filename: string) {
  let localUri = uri;
  if (/^https?:\/\//i.test(uri)) {
    const target = new File(Paths.cache, filename);
    const downloaded = await File.downloadFileAsync(uri, target, { idempotent: true });
    localUri = downloaded.uri;
  }

  const asset = await MediaLibrary.createAssetAsync(localUri);
  if (Platform.OS === 'ios') {
    try {
      const album = await MediaLibrary.getAlbumAsync('Reprise');
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync('Reprise', asset, false);
      }
    } catch {
      // La photo est déjà enregistrée ; l'album dédié reste un simple confort de rangement.
    }
  }
}

/**
 * Place les deux fichiers dans l'album Reprise, avant d'ouvrir les sélecteurs du formulaire.
 * Ils ne quittent pas le téléphone et ne sont jamais envoyés par ce service.
 */
export async function prepareImagesForOfficialForm(input: {
  currentAlreadySaved?: boolean;
  currentUri?: string;
  referenceUri?: string;
  stationId: string;
}): Promise<PreparedImages> {
  const permission = await MediaLibrary.requestPermissionsAsync(true, []);
  if (!permission.granted) throw new Error('PHOTO_LIBRARY_DENIED');

  const safeId = input.stationId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const result = {
    current: Boolean(input.currentAlreadySaved),
    reference: false,
  };

  if (input.referenceUri) {
    await addToRepriseAlbum(input.referenceUri, `reprise-${safeId}-reference.jpg`);
    result.reference = true;
  }
  if (input.currentUri && !input.currentAlreadySaved) {
    await addToRepriseAlbum(
      input.currentUri,
      `reprise-${safeId}-${new Date().getFullYear()}.jpg`,
    );
    result.current = true;
  }

  return result;
}
