export type OfficialUploadFile = {
  base64: string;
  filename: string;
  mimeType: 'image/jpeg' | 'image/png';
  size: number;
};

export type OfficialUploadFiles = {
  current: OfficialUploadFile;
  reference: OfficialUploadFile;
};

function safeScriptJson(value: unknown) {
  return JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function contentFingerprint(base64: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < base64.length; index += 1) {
    const code = base64.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

function hasValidUploadShape(file: OfficialUploadFile | undefined) {
  if (!file) return false;
  const extensionMatches =
    file.mimeType === 'image/png'
      ? /\.png$/i.test(file.filename)
      : /\.(jpe?g)$/i.test(file.filename);
  return (
    extensionMatches &&
    Number.isInteger(file.size) &&
    file.size > 0 &&
    file.size <= 8 * 1024 * 1024 &&
    file.base64.length > 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)
  );
}

export function buildObservatoireFileCleanupScript(preparationId: string) {
  return `
    (() => {
      const preparationId = ${safeScriptJson(preparationId)};
      const latestPreparation = Number(window.__repriseLatestPreparationId);
      const incomingPreparation = Number(preparationId);
      if (!Number.isFinite(incomingPreparation) ||
          (Number.isFinite(latestPreparation) && latestPreparation > incomingPreparation)) return;
      window.__repriseLatestPreparationId = preparationId;
      const matchingForms = Array.from(document.querySelectorAll('form')).filter((candidate) =>
        candidate.querySelector('.new-file-fields-list.images') &&
        candidate.querySelector('.new-file-template.images') &&
        candidate.querySelector('.btn-add-file[data-type="images"]')
      );
      const form = matchingForms.length === 1 ? matchingForms[0] : null;
      const list = form && form.querySelector('.new-file-fields-list.images');
      if (!list) return;
      const ownedFiles = window.__repriseOwnedFiles instanceof WeakMap
        ? window.__repriseOwnedFiles
        : new WeakMap();
      window.__repriseOwnedFiles = ownedFiles;
      const intact = (node) => {
        const input = node.querySelector('input[type="file"]');
        const file = input && input.files && input.files[0];
        return Boolean(file && input.files.length === 1 && ownedFiles.get(input) === file);
      };
      Array.from(list.querySelectorAll('[data-reprise-upload="1"]')).forEach((node) => {
        if (intact(node)) {
          node.remove();
        } else {
          node.removeAttribute('data-reprise-upload');
          node.removeAttribute('data-reprise-kind');
        }
      });
      window.__repriseFileSignature = undefined;
      window.__repriseFilesReadySignature = undefined;
      window.__repriseFileError = undefined;
    })();
    true;
  `;
}

/**
 * Construit deux vrais objets File dans la page officielle à partir des images déjà validées par
 * Reprise. Le script ne s'exécute que sur le contrat multipart GoGoCarto exact et ne touche jamais
 * aux champs personnels, aux consentements ni au bouton d'envoi.
 */
export function buildObservatoireFileInjectionScript(
  files: OfficialUploadFiles,
  preparationId: string,
  documentId: string,
) {
  const valid = hasValidUploadShape(files.reference) && hasValidUploadShape(files.current);
  const contentSignature = [
    contentFingerprint(files.reference.base64),
    contentFingerprint(files.current.base64),
  ].join('|');
  return `
    (() => {
      const preparationId = ${safeScriptJson(preparationId)};
      const documentId = ${safeScriptJson(documentId)};
      const latestPreparation = Number(window.__repriseLatestPreparationId);
      const incomingPreparation = Number(preparationId);
      if (!Number.isFinite(incomingPreparation) ||
          (Number.isFinite(latestPreparation) && latestPreparation > incomingPreparation)) return;
      window.__repriseLatestPreparationId = preparationId;
      const bridge = window.ReactNativeWebView;
      const send = (message) => {
        try { bridge && bridge.postMessage(JSON.stringify(message)); } catch (_) {}
      };
      const fail = (message) => {
        if (window.__repriseFileError !== message) {
          window.__repriseFileError = message;
          send({ type: 'files-error', message, preparationId, documentId });
        }
      };
      const payload = ${safeScriptJson(files)};
      if (!${valid ? 'true' : 'false'}) {
        fail('Une photo préparée n’est pas conforme au contrat JPG/PNG de 8 Mo.');
        return;
      }
      const matchingForms = Array.from(document.querySelectorAll('form')).filter((candidate) =>
        candidate.querySelector('.new-file-fields-list.images') &&
        candidate.querySelector('.new-file-template.images') &&
        candidate.querySelector('.btn-add-file[data-type="images"]')
      );
      const form = matchingForms.length === 1 ? matchingForms[0] : null;
      const list = form && form.querySelector('.new-file-fields-list.images');
      const template = form && form.querySelector('.new-file-template.images');
      const button = form && form.querySelector('.btn-add-file[data-type="images"]');
      const templateInputs = template ? template.querySelectorAll('input[type="file"]') : [];
      const expectedName = 'element[images][__count__][file][file]';
      if (!form || !list || !template || !button || templateInputs.length !== 1 ||
          templateInputs[0].getAttribute('name') !== expectedName) {
        fail('L’uploader officiel a changé. Les photos n’ont pas été ajoutées automatiquement.');
        return;
      }

      const signature = [payload.reference.filename, payload.reference.size,
        payload.current.filename, payload.current.size, ${safeScriptJson(contentSignature)}].join('|');
      const readySignature = [signature, documentId].join('|');
      const sendReady = () => {
        if (window.__repriseFilesReadySignature === readySignature) return;
        window.__repriseFilesReadySignature = readySignature;
        send({
          type: 'files-ready',
          count: 2,
          files: ['reference', 'current'],
          preparationId,
          documentId,
        });
      };
      const owned = Array.from(list.querySelectorAll('[data-reprise-upload="1"]'));
      const ownedFiles = window.__repriseOwnedFiles instanceof WeakMap
        ? window.__repriseOwnedFiles
        : new WeakMap();
      window.__repriseOwnedFiles = ownedFiles;
      const ownedFileIsIntact = (node) => {
        const input = node.querySelector('input[type="file"]');
        const file = input && input.files && input.files[0];
        return Boolean(file && input.files.length === 1 && ownedFiles.get(input) === file);
      };
      const manuallyReplaced = owned.filter((node) => !ownedFileIsIntact(node));
      if (manuallyReplaced.length) {
        manuallyReplaced.forEach((node) => {
          node.removeAttribute('data-reprise-upload');
          node.removeAttribute('data-reprise-kind');
        });
        window.__repriseFileSignature = undefined;
        window.__repriseFilesReadySignature = undefined;
        fail('Des photos ont déjà été choisies manuellement. Reprise ne les remplacera pas.');
        return;
      }
      if (window.__repriseFileSignature === signature && owned.length === 2 &&
          owned.every(ownedFileIsIntact)) {
        sendReady();
        return;
      }
      const foreignSelected = Array.from(list.querySelectorAll('input[type="file"]'))
        .some((input) => !input.closest('[data-reprise-upload="1"]') && input.files?.length);
      if (foreignSelected) {
        fail('Des photos ont déjà été choisies manuellement. Reprise ne les remplacera pas.');
        return;
      }
      owned.forEach((node) => node.remove());

      const inserted = [];
      try {
        let count = Number.parseInt(button.getAttribute('data-count') || '0', 10);
        if (!Number.isInteger(count) || count < 0) throw new Error('invalid-counter');
        const add = (kind, filePayload) => {
          const wrapper = document.createElement('li');
          wrapper.setAttribute('data-reprise-upload', '1');
          wrapper.setAttribute('data-reprise-kind', kind);
          wrapper.innerHTML = template.innerHTML.replace(/__count__/g, String(count));
          const input = wrapper.querySelector('input[type="file"]');
          const expectedIndexedName = expectedName.replace('__count__', String(count));
          if (!input || input.getAttribute('name') !== expectedIndexedName) {
            throw new Error('invalid-template');
          }
          const binary = window.atob(filePayload.base64);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
          }
          const file = new File([bytes], filePayload.filename, {
            type: filePayload.mimeType,
            lastModified: Date.now(),
          });
          if (file.size !== filePayload.size) throw new Error('invalid-size');
          wrapper.setAttribute('data-reprise-name', file.name);
          wrapper.setAttribute('data-reprise-size', String(file.size));
          wrapper.setAttribute('data-reprise-type', file.type);
          wrapper.setAttribute('data-reprise-last-modified', String(file.lastModified));
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.files = transfer.files;
          if (input.files?.length !== 1 || input.files[0].name !== filePayload.filename) {
            throw new Error('file-assignment-failed');
          }
          ownedFiles.set(input, input.files[0]);
          input.setAttribute('data-file', filePayload.filename);
          // GoGoCarto supprime avant submit les inputs dont la valeur et l'attribut value sont vides.
          // Safari peut garder la valeur visuelle vide après DataTransfer : cet attribut sentinelle
          // empêche uniquement ce nettoyage, sans représenter un chemin local ni modifier FileList.
          input.setAttribute('value', filePayload.filename);
          list.appendChild(wrapper);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          inserted.push(wrapper);
          count += 1;
        };
        // Le formulaire demande d'abord la vue de 1970, puis la reprise actuelle.
        add('reference', payload.reference);
        add('current', payload.current);
        button.setAttribute('data-count', String(count));
        window.__repriseFileSignature = signature;
        window.__repriseFileError = undefined;
        sendReady();
      } catch (_) {
        inserted.forEach((node) => node.remove());
        fail('iOS n’a pas pu joindre automatiquement les photos au formulaire officiel.');
      }
    })();
    true;
  `;
}
