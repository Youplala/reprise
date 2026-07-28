import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  type AccessibilityActionEvent,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useImageAspectRatio } from '@/hooks/use-image-aspect-ratio';

type BeforeAfterSliderProps = {
  before: ImageSource;
  after: ImageSource;
  beforeLabel: string;
  afterLabel: string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  onInteractionChange?: (active: boolean) => void;
};

const MIN_RATIO = 0.08;
const MAX_RATIO = 0.92;
const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };

export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  height,
  borderRadius = Radius.large,
  style,
  onInteractionChange,
}: BeforeAfterSliderProps) {
  const [width, setWidth] = useState(0);
  const { aspectRatio } = useImageAspectRatio(before);
  // Hauteur calée sur le format de la photo de référence, comme le reste de l'app.
  const resolvedHeight =
    height ?? (width ? Math.min(440, Math.max(220, width / aspectRatio)) : 280);

  const ratio = useSharedValue(0.5);
  // Dérivé de la largeur mesurée : le React Compiler interdit de muter une valeur partagée
  // depuis un gestionnaire d'événement, et une dérivation exprime mieux la dépendance.
  const containerWidth = useDerivedValue(() => width, [width]);
  const active = useSharedValue(0);
  // Mémorise le bord déjà atteint pour ne pas répéter le retour haptique à chaque frame.
  const edgeLatched = useSharedValue(0);

  const notifyInteraction = useCallback(
    (value: boolean) => onInteractionChange?.(value),
    [onInteractionChange],
  );

  const tapFeedback = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  }, []);

  const edgeFeedback = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  }, []);

  const pan = Gesture.Pan()
    // Laisse passer les gestes verticaux : sans cela le slider capture tout et la page
    // devient impossible à faire défiler dès que le doigt démarre sur la comparaison.
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      'worklet';
      active.value = withSpring(1, SPRING);
      runOnJS(notifyInteraction)(true);
      runOnJS(tapFeedback)();
    })
    .onUpdate((event) => {
      'worklet';
      if (!containerWidth.value) return;
      const next = Math.min(MAX_RATIO, Math.max(MIN_RATIO, event.x / containerWidth.value));
      ratio.value = next;

      const atEdge = next <= MIN_RATIO || next >= MAX_RATIO;
      if (atEdge && !edgeLatched.value) {
        edgeLatched.value = 1;
        runOnJS(edgeFeedback)();
      } else if (!atEdge && edgeLatched.value) {
        edgeLatched.value = 0;
      }
    })
    .onFinalize(() => {
      'worklet';
      active.value = withSpring(0, SPRING);
      edgeLatched.value = 0;
      runOnJS(notifyInteraction)(false);
    });

  const tap = Gesture.Tap().onEnd((event) => {
    'worklet';
    if (!containerWidth.value) return;
    ratio.value = withSpring(
      Math.min(MAX_RATIO, Math.max(MIN_RATIO, event.x / containerWidth.value)),
      SPRING,
    );
    runOnJS(tapFeedback)();
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const clipStyle = useAnimatedStyle(() => ({
    left: ratio.value * containerWidth.value,
    width: Math.max(0, containerWidth.value - ratio.value * containerWidth.value),
  }));

  const afterImageStyle = useAnimatedStyle(() => ({
    left: -ratio.value * containerWidth.value,
    width: containerWidth.value,
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    left: ratio.value * containerWidth.value - 1,
    backgroundColor: active.value > 0.5 ? Palette.brass : Palette.white,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(1 + active.value * 0.12, { duration: 140 }) }],
    backgroundColor: active.value > 0.5 ? Palette.brass : Palette.white,
  }));

  const beforeLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ratio.value, [0.14, 0.26], [0, 1], Extrapolation.CLAMP),
  }));

  const afterLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ratio.value, [0.74, 0.86], [1, 0], Extrapolation.CLAMP),
  }));

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
    runOnUI((step: number) => {
      'worklet';
      ratio.value = withSpring(
        Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio.value + step)),
        SPRING,
      );
    })(delta);
    void Haptics.selectionAsync();
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityActions={[
          { name: 'increment', label: `Afficher plus de ${beforeLabel}` },
          { name: 'decrement', label: `Afficher plus de ${afterLabel}` },
        ]}
        accessibilityHint="Balayez horizontalement pour comparer les deux époques"
        accessibilityLabel={`Comparaison entre ${beforeLabel} et ${afterLabel}`}
        accessibilityRole="adjustable"
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.container, { height: resolvedHeight, borderRadius }, style]}
        testID="before-after-slider">
        <Image source={before} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />

        <Animated.View pointerEvents="none" style={[styles.afterClip, clipStyle]}>
          <Animated.View style={[styles.afterImageHolder, afterImageStyle, { height: resolvedHeight }]}>
            <Image
              source={after}
              style={[StyleSheet.absoluteFill, { width }]}
              contentFit="cover"
              transition={180}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.beforeLabel, beforeLabelStyle]}>
          <Text style={styles.labelText}>{beforeLabel}</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.afterLabel, afterLabelStyle]}>
          <Text style={styles.labelText}>{afterLabel}</Text>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.divider, dividerStyle]}>
          <Animated.View style={[styles.knob, knobStyle]}>
            <SymbolView name="arrow.left.and.right" size={14} tintColor={Palette.parisBlue} />
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
    ...Shadow.card,
  },
  afterClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  afterImageHolder: {
    position: 'absolute',
    top: 0,
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(22, 63, 91, 0.08)',
    ...Shadow.card,
  },
  beforeLabel: {
    position: 'absolute',
    left: Spacing.two,
    top: Spacing.two,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Palette.copper,
  },
  afterLabel: {
    position: 'absolute',
    right: Spacing.two,
    top: Spacing.two,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
  },
  labelText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
