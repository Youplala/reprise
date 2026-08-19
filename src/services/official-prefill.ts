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
  | { type: 'form-error'; message?: string }
  | { type: 'contract-error'; fields: string[]; message: string };

export function parseOfficialBridgeMessage(value: string): OfficialBridgeMessage | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<OfficialBridgeMessage>;
    if (
      parsed.type === 'ready' ||
      parsed.type === 'prefill' ||
      parsed.type === 'success' ||
      parsed.type === 'form-error' ||
      parsed.type === 'contract-error'
    ) {
      return parsed as OfficialBridgeMessage;
    }
  } catch {
    // Un message tiers dans la page ne doit pas faire tomber l'écran natif.
  }
  return undefined;
}

function safeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * Adaptateur sémantique du formulaire GoGoCarto observé en août 2026.
 *
 * Les identifiants des champs personnalisés sont générés. Le bridge part donc des libellés et
 * de la section fonctionnelle du contrôle. Il exclut explicitement fichiers, identité,
 * consentements et bouton d'envoi, et ne remplace jamais une valeur déjà saisie.
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
      const keyOf = (control) => normalize([
        control && control.name,
        control && control.id,
        control && control.getAttribute && control.getAttribute('placeholder'),
      ].filter(Boolean).join(' '));
      const textOf = (element) => normalize(element && element.textContent);
      const ownedValues = window.__repriseOwnedValues instanceof WeakMap
        ? window.__repriseOwnedValues
        : new WeakMap();
      window.__repriseOwnedValues = ownedValues;
      const emitEvents = (control) => {
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const setValue = (control, value, options = {}) => {
        if (!control || value === undefined || value === null || String(value).length === 0) return false;
        if (['checkbox', 'radio', 'file', 'email', 'submit', 'button'].includes(control.type)) return false;
        const current = String(control.value || '').trim();
        const owned = options.ownershipKey && ownedValues.get(control)?.[options.ownershipKey];
        const mayReplaceOwned = options.replaceOwned && owned === current;
        if (current && !(options.zeroIsEmpty && Number(current) === 0) && !mayReplaceOwned) return false;
        const prototype = control.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : control.tagName === 'SELECT'
            ? window.HTMLSelectElement.prototype
            : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (setter) setter.call(control, String(value));
        else control.value = String(value);
        if (options.ownershipKey) {
          ownedValues.set(control, {
            ...(ownedValues.get(control) || {}),
            [options.ownershipKey]: String(value),
          });
        }
        emitEvents(control);
        return true;
      };
      const labels = (root = document) => Array.from(root.querySelectorAll('label'));
      const labelMatches = (label, aliases, exact = false) => {
        const text = textOf(label);
        return aliases.some((alias) => text === alias || (!exact && text.startsWith(alias + ' ')));
      };
      const controlsForLabel = (label) => {
        const controls = [];
        const add = (control) => {
          if (control && !controls.includes(control)) controls.push(control);
        };
        if (label.htmlFor) add(document.getElementById(label.htmlFor));
        Array.from(label.querySelectorAll('input, textarea, select')).forEach(add);
        Array.from(label.parentElement?.querySelectorAll('input, textarea, select') || []).forEach(add);
        Array.from(label.closest('.form-group, .control-group, .field-container, .field, [class*=field]')
          ?.querySelectorAll('input, textarea, select') || []).forEach(add);
        return controls;
      };
      const findByLabel = (aliases, validator = () => true, root = document, exact = false) => {
        for (const label of labels(root)) {
          if (!labelMatches(label, aliases, exact)) continue;
          const control = controlsForLabel(label).find(validator);
          if (control) return control;
        }
      };
      const textControl = (control) => !['email', 'file', 'checkbox', 'radio'].includes(control.type);
      const fillByLabel = (aliases, value, validator = textControl, options) => {
        const control = findByLabel(aliases, validator);
        return control ? setValue(control, value, options) : false;
      };
      const fillExactByLabel = (aliases, value) => {
        const control = findByLabel(aliases, textControl, document, true);
        return control ? setValue(control, value) : false;
      };
      const findCoordinate = (kind) => {
        const aliases = kind === 'latitude' ? ['latitude', 'lat'] : ['longitude', 'lng', 'lon'];
        return Array.from(document.querySelectorAll('input')).find((control) => {
          const tokens = keyOf(control).split(' ');
          return aliases.some((alias) => tokens.includes(alias));
        });
      };
      const fillCoordinate = (kind, value) => {
        if (!Number.isFinite(value)) return false;
        return setValue(findCoordinate(kind), Number(value).toFixed(6), {
          ownershipKey: kind,
          replaceOwned: true,
          zeroIsEmpty: true,
        });
      };
      const fillCaptureDate = (value) => {
        const control = findByLabel(
          ['date de prise de vue', 'date de la prise de vue'],
          (candidate) => textControl(candidate) && keyOf(candidate).includes('2026') && !keyOf(candidate).includes('display'),
        );
        if (!control || !setValue(control, value)) return false;
        const container = control.closest('.field-container, .form-group, .control-group, .field');
        const display = Array.from(container?.querySelectorAll('input') || [])
          .find((candidate) => keyOf(candidate).includes('display'));
        if (display && !String(display.value || '').trim()) {
          const parsed = new Date(String(value) + 'T12:00:00');
          const readable = Number.isNaN(parsed.getTime())
            ? value
            : new Intl.DateTimeFormat('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              }).format(parsed);
          setValue(display, readable);
        }
        return true;
      };
      const selectDevice = () => {
        if (!payload.device) return false;
        const radios = Array.from(document.querySelectorAll('input[type=radio]')).filter((control) => {
          const container = control.closest('.field-container, .form-group, .control-group, .field');
          return keyOf(control).includes('appareil') || textOf(container).includes('type d appareil utilise');
        });
        if (!radios.length || radios.some((control) => control.checked)) return false;
        const target = radios.find((control) => normalize(control.value) === 'smartphone');
        if (!target) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked')?.set;
        if (setter) setter.call(target, true);
        else target.checked = true;
        emitEvents(target);
        return true;
      };
      const knownControls = () => ({
        title: findByLabel(['titre de la fiche'], textControl),
        arrondissement: findByLabel(['arrondissement', 'code postal'], textControl),
        city: findByLabel(['ville'], textControl, document, true),
        captureDate: findByLabel(
          ['date de prise de vue', 'date de la prise de vue'],
          (control) => textControl(control) && keyOf(control).includes('2026') && !keyOf(control).includes('display'),
        ),
        device: Array.from(document.querySelectorAll('input[type=radio]')).find((control) => keyOf(control).includes('appareil')),
      });
      const fill = () => {
        const fields = new Set(window.__reprisePrefilledFields || []);
        if (fillByLabel(['adresse complete', 'adresse', 'adresse postale', 'numero et rue'], payload.address)) fields.add('address');
        if (fillByLabel(['titre de la fiche'], payload.address)) fields.add('title');
        if (fillByLabel(['arrondissement', 'code postal'], payload.postalCode)) fields.add('arrondissement');
        if (fillExactByLabel(['ville'], payload.city)) fields.add('city');
        if (fillCaptureDate(payload.captureDate)) fields.add('captureDate');
        if (selectDevice()) fields.add('device');
        if (fillByLabel(['observations commentaires', 'commentaire', 'legende', 'observation', 'elements de reperage'], payload.note)) fields.add('note');
        if (fillCoordinate('latitude', payload.latitude)) fields.add('latitude');
        if (fillCoordinate('longitude', payload.longitude)) fields.add('longitude');
        const allFields = Array.from(fields);
        window.__reprisePrefilledFields = allFields;
        const signature = allFields.slice().sort().join('|');
        if (signature && signature !== window.__reprisePrefillSignature) {
          window.__reprisePrefillSignature = signature;
          send({ type: 'prefill', count: allFields.length, fields: allFields });
        }
      };
      const inspectContract = () => {
        if (!document.querySelector('form') || !document.querySelector('input, textarea, select')) return;
        const controls = knownControls();
        const missing = Object.keys(controls).filter((field) => !controls[field]);
        const signature = missing.join('|');
        if (missing.length && signature !== window.__repriseContractSignature) {
          window.__repriseContractSignature = signature;
          send({
            type: 'contract-error',
            fields: missing,
            message: 'Le formulaire officiel a changé. Vérifiez les champs dans Safari avant de continuer.',
          });
        }
      };
      const inspectStatus = () => {
        const text = normalize(document.body?.innerText || document.body?.textContent || '');
        if (/contribution (a ete )?(envoyee|enregistree)|en attente de (validation|moderation)|merci pour votre contribution/.test(text)) {
          send({ type: 'success', message: 'Contribution transmise à l’Observatoire.' });
          return;
        }
        const alert = document.querySelector('.alert-danger, .form-error, [role=alert].error');
        if (alert?.textContent) send({ type: 'form-error', message: alert.textContent.trim().slice(0, 240) });
      };
      const inspect = () => { fill(); inspectStatus(); };
      inspect();
      clearTimeout(window.__repriseContractTimer);
      window.__repriseContractTimer = setTimeout(inspectContract, 1200);
      if (!window.__repriseObserver) {
        window.__repriseObserver = new MutationObserver(() => {
          clearTimeout(window.__repriseObserverTimer);
          window.__repriseObserverTimer = setTimeout(inspect, 180);
        });
        window.__repriseObserver.observe(document.documentElement, { childList: true, subtree: true });
        send({ type: 'ready' });
      }
    })();
    true;
  `;
}
