import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Séparateur de milliers à la française, calculable depuis un worklet. */
function formatFrench(value: number, decimals: number) {
  'worklet';
  const fixed = value.toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  let grouped = '';
  for (let index = 0; index < whole.length; index += 1) {
    const fromEnd = whole.length - index;
    grouped += whole[index];
    if (fromEnd > 1 && fromEnd % 3 === 1) grouped += ' ';
  }
  return fraction ? `${grouped},${fraction}` : grouped;
}

type AnimatedNumberProps = {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Nombre qui se compte à l'affichage. L'animation tourne sur le thread UI via un `TextInput`
 * non éditable : c'est le seul moyen de faire varier du texte sans repasser par React à
 * chaque image.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1100,
  suffix = '',
  style,
}: AnimatedNumberProps) {
  const animated = useDerivedValue(
    () => withTiming(value, { duration, easing: Easing.out(Easing.cubic) }),
    [value, duration],
  );

  const animatedProps = useAnimatedProps(() => ({
    text: `${formatFrench(animated.value, decimals)}${suffix}`,
    defaultValue: `${formatFrench(animated.value, decimals)}${suffix}`,
  }));

  return (
    <AnimatedTextInput
      editable={false}
      accessible
      accessibilityLabel={`${formatFrench(value, decimals)}${suffix}`}
      animatedProps={animatedProps}
      style={[styles.input, style]}
      underlineColorAndroid="transparent"
      value={`${formatFrench(value, decimals)}${suffix}`}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
  },
});
