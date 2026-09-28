import {
  buildObservatoirePrefillScript,
  officialReferenceFilenameStem,
  parseOfficialBridgeMessage,
  prepareImagesForOfficialForm,
} from '@/services/official-submission';

jest.mock('expo-file-system', () => ({
  File: class File {},
  Paths: { cache: '/tmp' },
}));

jest.mock('expo-media-library', () => ({}));

jest.mock('@/services/official-reference-download', () => ({
  fetchOfficialReferenceUpload: jest.fn(async (_uri: string, filename: string) => ({
    base64: '/9j/4AAQ',
    filename,
    mimeType: 'image/jpeg',
    size: 6,
  })),
}));

describe('official-submission bridge', () => {
  it('accepte uniquement les types de messages connus', () => {
    expect(parseOfficialBridgeMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(
      parseOfficialBridgeMessage('{"type":"prefill","count":2,"fields":["city","captureDate"]}'),
    ).toEqual({ type: 'prefill', count: 2, fields: ['city', 'captureDate'] });
    expect(parseOfficialBridgeMessage('{"type":"tracking"}')).toBeUndefined();
    expect(parseOfficialBridgeMessage('pas du json')).toBeUndefined();
  });

  it('conserve l’identité ARK dans le nom de la référence envoyée', () => {
    expect(
      officialReferenceFilenameStem(
        'tl',
        'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAC/B1735044/v0009',
      ),
    ).toBe('reprise-tl-frcgmnov-751045102-lac-b1735044-v0009-reference');
    expect(officialReferenceFilenameStem('tl', 'https://example.test/not-an-ark')).toBe(
      'reprise-tl-reference',
    );
  });

  it('utilise le nom ARK lors de la préparation du fichier officiel', async () => {
    const prepared = await prepareImagesForOfficialForm({
      currentAuthorized: false,
      preparationId: 'ark-test',
      referenceArchiveLink:
        'https://bibliotheques-specialisees.paris.fr/ark:/73873/FRCGMNOV-751045102-LAC/B1735044/v0009',
      referenceUri: 'https://bibliotheques-specialisees.paris.fr/images/reference.jpg',
      stationId: 'tl',
    });

    expect(prepared.files.reference?.filename).toBe(
      'reprise-tl-frcgmnov-751045102-lac-b1735044-v0009-reference.jpg',
    );
  });

  it('sérialise la charge utile sans casser le script injecté', () => {
    const script = buildObservatoirePrefillScript({
      captureDate: '2026-08-11',
      city: 'Paris\u2028<script>alert(1)</script>',
      address: 'Repère\u2029visuel',
    });

    expect(script).toContain('Paris\\u2028<script>alert(1)</script>');
    expect(script).toContain('Repère\\u2029visuel');
    expect(script).toContain("if (current && !(options.zeroIsEmpty && Number(current) === 0) && !mayReplaceOwned) return false");
    // Consentements, fichiers et boutons ne sont jamais remplis ; l'e-mail seulement pour
    // l'identité que l'utilisateur a choisi de mémoriser.
    expect(script).toContain("['checkbox', 'radio', 'file', 'submit', 'button'].includes(control.type)");
    expect(script).toContain("if (control.type === 'email' && !options.allowEmail) return false;");
    expect(script).not.toContain("querySelector('button");
  });
});
