import {
  buildObservatoirePrefillScript,
  parseOfficialBridgeMessage,
} from '@/services/official-submission';

jest.mock('expo-file-system', () => ({
  File: class File {},
  Paths: { cache: '/tmp' },
}));

jest.mock('expo-media-library', () => ({}));

describe('official-submission bridge', () => {
  it('accepte uniquement les types de messages connus', () => {
    expect(parseOfficialBridgeMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(
      parseOfficialBridgeMessage('{"type":"prefill","count":2,"fields":["city","captureDate"]}'),
    ).toEqual({ type: 'prefill', count: 2, fields: ['city', 'captureDate'] });
    expect(parseOfficialBridgeMessage('{"type":"tracking"}')).toBeUndefined();
    expect(parseOfficialBridgeMessage('pas du json')).toBeUndefined();
  });

  it('sérialise la charge utile sans casser le script injecté', () => {
    const script = buildObservatoirePrefillScript({
      captureDate: '2026-08-11',
      city: 'Paris\u2028<script>alert(1)</script>',
      note: 'Repère\u2029visuel',
    });

    expect(script).toContain('Paris\\u2028<script>alert(1)</script>');
    expect(script).toContain('Repère\\u2029visuel');
    expect(script).toContain("if (current && !(options.zeroIsEmpty && Number(current) === 0) && !mayReplaceOwned) return false");
    expect(script).toContain("['checkbox', 'radio', 'file', 'email', 'submit', 'button'].includes(control.type)");
    expect(script).not.toContain("querySelector('button");
  });
});
