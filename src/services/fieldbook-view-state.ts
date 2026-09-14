import type { SavedCapture } from '@/services/fieldbook-store';

export type FieldbookViewState =
  | { kind: 'empty'; title: string; description: string }
  | { kind: 'filled'; count: number; captures: SavedCapture[] };

export function getFieldbookViewState(captures: SavedCapture[]): FieldbookViewState {
  if (captures.length === 0) {
    return {
      kind: 'empty',
      title: 'Aucun brouillon',
      description: 'Vos prochaines reprises resteront ici, même sans accès à Photos.',
    };
  }
  return { kind: 'filled', count: captures.length, captures };
}
