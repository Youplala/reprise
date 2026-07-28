import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useState } from 'react';

type Attitude = {
  pitch: number;
  roll: number;
};

const UPDATE_INTERVAL_MS = 160;

// Le capteur renvoie des radians bruités : sans arrondi, la moindre vibration change la valeur
// et provoque un rendu. L'écran d'alignement embarque la caméra, l'archive superposée et le
// recalcul du cadre : le laisser se rendre huit fois par seconde le rendait injouable.
const QUANTUM_RADIANS = (0.5 * Math.PI) / 180;

function quantize(value: number) {
  return Math.round(value / QUANTUM_RADIANS) * QUANTUM_RADIANS;
}

/**
 * Inclinaison de l'appareil, échantillonnée au demi-degré. L'état n'est remplacé que si
 * l'orientation a réellement changé, ce qui laisse React sauter le rendu quand le téléphone
 * est immobile.
 */
export function useDeviceAttitude() {
  const [attitude, setAttitude] = useState<Attitude>({ pitch: 0, roll: 0 });

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;

    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available || cancelled) return;

      DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = DeviceMotion.addListener((measurement: DeviceMotionMeasurement) => {
        const rotation = measurement.rotation;
        if (!rotation) return;

        const pitch = quantize(rotation.beta ?? 0);
        const roll = quantize(rotation.gamma ?? 0);

        setAttitude((current) =>
          current.pitch === pitch && current.roll === roll ? current : { pitch, roll },
        );
      });
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return attitude;
}
