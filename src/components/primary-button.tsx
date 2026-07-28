import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { Fonts, Palette, Radius, Spacing } from '@/constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: SymbolViewProps['name'];
  variant?: 'primary' | 'light' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Palette.white : Palette.parisBlue} />
      ) : (
        <>
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
          {icon ? (
            <SymbolView
              name={icon}
              size={18}
              tintColor={variant === 'primary' ? Palette.white : Palette.parisBlue}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.threeHalf,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  primary: {
    backgroundColor: Palette.parisBlue,
  },
  light: {
    backgroundColor: Palette.white,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Palette.parisBlue,
  },
  label: {
    fontFamily: Fonts.sans,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  primaryLabel: {
    color: Palette.white,
  },
  lightLabel: {
    color: Palette.parisBlue,
  },
  outlineLabel: {
    color: Palette.parisBlue,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.48,
  },
});
