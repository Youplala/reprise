import { CameraView } from 'expo-camera';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Platform } from 'react-native';

export type CameraLens = {
  /** Valeur à passer à `selectedLens` de `CameraView`. */
  id: string;
  /** Étiquette courte affichée dans le sélecteur. */
  label: string;
  /** Sert à ordonner les objectifs du plus large au plus long. */
  order: number;
};

/** Objectif par défaut d'expo-camera, seul disponible sur les appareils à une seule caméra. */
const DEFAULT_LENS = 'builtInWideAngleCamera';

/**
 * Les identifiants viennent d'AVFoundation et leur forme exacte peut varier selon la version
 * (`builtInUltraWideCamera`, parfois préfixé `AVCaptureDeviceType…`). On reconnaît donc par
 * sous-chaîne plutôt que par égalité stricte, pour ne pas rater un objectif au premier renommage.
 */
function describeLens(id: string): CameraLens | undefined {
  const normalized = id.toLowerCase();

  if (normalized.includes('ultrawide')) return { id, label: '0,5×', order: 0 };
  if (normalized.includes('telephoto')) return { id, label: 'Télé', order: 2 };
  if (normalized.includes('wideangle')) return { id, label: '1×', order: 1 };

  // Les caméras virtuelles (dual, triple) combinent plusieurs objectifs et gèrent la bascule
  // elles-mêmes : les proposer en plus ferait doublon avec les objectifs réels.
  return undefined;
}

/**
 * Objectifs physiques de l'appareil, du plus large au plus long.
 *
 * La prop `zoom` d'expo-camera ne fait que du zoom sur l'objectif courant : elle ne descend
 * jamais sous 1×. Le grand angle à 0,5× n'est donc atteignable qu'en changeant d'objectif, ce
 * qui compte pour Paris GO : beaucoup de vues de 1970 ont été prises au grand angle, et dans une
 * rue étroite on ne peut pas toujours reculer assez pour retrouver le cadrage.
 */
export function useCameraLenses(cameraRef: RefObject<CameraView | null>, ready: boolean) {
  const [lenses, setLenses] = useState<CameraLens[]>([]);
  const [selectedLens, setSelectedLens] = useState(DEFAULT_LENS);

  const readLenses = useCallback((available: string[]) => {
    const described = available
      .map(describeLens)
      .filter((lens): lens is CameraLens => lens !== undefined)
      .sort((left, right) => left.order - right.order);

    // Un seul objectif utilisable ne mérite pas de sélecteur.
    setLenses(described.length > 1 ? described : []);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !ready) return;

    let cancelled = false;

    cameraRef.current
      ?.getAvailableLensesAsync()
      .then((available) => {
        if (!cancelled) readLenses(available);
      })
      .catch(() => {
        // Appareil sans plusieurs objectifs, ou API indisponible : on reste sur le grand angle.
      });

    return () => {
      cancelled = true;
    };
  }, [cameraRef, readLenses, ready]);

  const activeLabel = lenses.find((lens) => lens.id === selectedLens)?.label ?? '1×';

  return { lenses, selectedLens, setSelectedLens, activeLabel, onAvailableLensesChanged: readLenses };
}
