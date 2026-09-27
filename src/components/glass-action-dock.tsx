import {
  Button,
  GlassEffectContainer,
  HStack,
  Host,
  Image,
  Text as SwiftText,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  frame,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { supportsLiquidGlass } from '@/components/glass-surface';
import { Fonts, Palette, Shadow, Spacing, Typography } from '@/constants/theme';

type DockAction = {
  label: string;
  systemImage: SFSymbol;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
};

type GlassActionDockProps = {
  primary: DockAction;
  /** Action ronde, sans texte, à droite de l'action principale. */
  secondary?: DockAction & { loading?: boolean };
};

/**
 * Dock d'actions flottant. Sous iOS 26+, ce sont de vrais boutons SwiftUI en Liquid Glass
 * (`glassProminent` teinté pour l'action principale, `glass` pour la secondaire) regroupés dans
 * un `GlassEffectContainer` : réfraction, reflets et réaction au toucher sont ceux du système.
 * Ailleurs, repli en boutons React Native opaques.
 */
export function GlassActionDock({ primary, secondary }: GlassActionDockProps) {
  if (!supportsLiquidGlass()) return <FallbackDock primary={primary} secondary={secondary} />;

  return (
    <Host matchContents={{ vertical: true }} style={styles.host}>
      <GlassEffectContainer spacing={Spacing.three}>
        <HStack spacing={Spacing.two}>
          <Button
            onPress={primary.onPress}
            modifiers={[
              buttonStyle('glassProminent'),
              controlSize('extraLarge'),
              buttonBorderShape('capsule'),
              tint(Palette.go),
              accessibilityLabel(primary.accessibilityLabel ?? primary.label),
              disabled(Boolean(primary.disabled)),
            ]}>
            <HStack spacing={Spacing.two} modifiers={[frame({ maxWidth: 10_000 })]}>
              <Image systemName={primary.systemImage} size={18} />
              <SwiftText modifiers={[font({ size: 17, weight: 'semibold' })]}>
                {primary.label}
              </SwiftText>
            </HStack>
          </Button>
          {secondary ? (
            <Button
              onPress={secondary.onPress}
              modifiers={[
                buttonStyle('glass'),
                controlSize('extraLarge'),
                buttonBorderShape('circle'),
                tint(Palette.parisBlue),
                accessibilityLabel(secondary.accessibilityLabel ?? secondary.label),
                disabled(Boolean(secondary.disabled || secondary.loading)),
              ]}>
              <Image systemName={secondary.systemImage} size={20} />
            </Button>
          ) : null}
        </HStack>
      </GlassEffectContainer>
    </Host>
  );
}

function FallbackDock({ primary, secondary }: GlassActionDockProps) {
  return (
    <View style={styles.fallbackRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={primary.accessibilityLabel ?? primary.label}
        disabled={primary.disabled}
        onPress={primary.onPress}
        style={({ pressed }) => [styles.fallbackPrimary, pressed && styles.pressed]}>
        <SymbolView name={primary.systemImage} size={20} tintColor={Palette.white} />
        <Text style={styles.fallbackPrimaryText}>{primary.label}</Text>
      </Pressable>
      {secondary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondary.accessibilityLabel ?? secondary.label}
          disabled={secondary.disabled || secondary.loading}
          onPress={secondary.onPress}
          style={({ pressed }) => [styles.fallbackSecondary, pressed && styles.pressed]}>
          {secondary.loading ? (
            <ActivityIndicator color={Palette.parisBlue} size="small" />
          ) : (
            <SymbolView name={secondary.systemImage} size={20} tintColor={Palette.parisBlue} />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const floatingShadow = {
  shadowOpacity: 0.2,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  host: {
    width: '100%',
  },
  fallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fallbackPrimary: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: Spacing.three,
    borderRadius: 29,
    backgroundColor: Palette.go,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    ...Shadow.card,
    ...floatingShadow,
  },
  fallbackPrimaryText: {
    ...Typography.body,
    fontSize: 17,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  fallbackSecondary: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
    ...floatingShadow,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
});
