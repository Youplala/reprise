import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

// Évalué une fois : la capacité de l'appareil ne change pas en cours d'exécution.
let cachedSupport: boolean | null = null;

function supportsLiquidGlass() {
  if (cachedSupport === null) {
    cachedSupport =
      Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  }
  return cachedSupport;
}

type GlassSurfaceProps = {
  /** `clear` laisse passer davantage l'arrière-plan : à réserver aux surfaces posées sur la carte. */
  variant?: 'clear' | 'regular';
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
};

/**
 * Fond en Liquid Glass, avec repli en aplat translucide là où le matériau n'existe pas.
 *
 * À poser en `StyleSheet.absoluteFill` derrière le contenu d'une carte, sans ombre portée ni
 * faux reflet dessiné à la main : le matériau natif gère lui-même sa profondeur et sa
 * réfraction, et tout ce qu'on empile par-dessus se contente de le contredire.
 */
export function GlassSurface({ variant = 'regular', style, tintColor }: GlassSurfaceProps) {
  const theme = useAppTheme();

  if (!supportsLiquidGlass()) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.glassFallback }, style]}
      />
    );
  }

  return (
    <GlassView
      pointerEvents="none"
      colorScheme={theme.scheme}
      glassEffectStyle={variant}
      tintColor={tintColor ?? theme.glassTint}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}
