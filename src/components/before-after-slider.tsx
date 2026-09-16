import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useImageAspectRatio } from '@/hooks/use-image-aspect-ratio';
import { comparisonDimensionsForAspectRatio } from '@/services/photo-geometry';

type BeforeAfterSliderProps = {
  before: ImageSource;
  after: ImageSource;
  beforeLabel: string;
  afterLabel: string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  onInteractionChange?: (active: boolean) => void;
  // Joue une démo du geste une seule fois à l'ouverture (onboarding), sans attendre le doigt.
  playIntro?: boolean;
};

const MIN_RATIO = 0.08;
const MAX_RATIO = 0.92;
const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };

// Composant isolé à dessein : le React Compiler refuse qu'un même useEffect et les gestes
// du slider mutent ratio/active tous les deux — chaque composant garde donc son propre
// site de mutation, ratio/active n'étant ici reçus qu'en lecture via les props.
function BeforeAfterSliderIntro({
  ratio,
  active,
  play,
  reducedMotion,
}: {
  ratio: SharedValue<number>;
  active: SharedValue<number>;
  play: boolean;
  reducedMotion: boolean;
}) {
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!play || hasPlayed.current) return;
    hasPlayed.current = true;
    // Réduction des animations activée : le curseur reste sur sa position de repos.
    if (reducedMotion) return;

    runOnUI(() => {
      'worklet';
      ratio.value = withDelay(
        400,
        withSequence(
          withTiming(0.78, { duration: 650 }),
          withTiming(0.22, { duration: 850 }),
          withTiming(0.5, { duration: 550 }),
        ),
      );
      active.value = withDelay(
        400,
        withSequence(withTiming(1, { duration: 220 }), withDelay(1350, withTiming(0, { duration: 260 }))),
      );
    })();
  }, [play, reducedMotion, ratio, active]);

  return null;
}

export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  height,
  borderRadius = Radius.large,
  style,
  onInteractionChange,
  playIntro,
}: BeforeAfterSliderProps) {
  const [width, setWidth] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const { aspectRatio } = useImageAspectRatio(before);
  // La comparaison montre le cadre complet. Pour un format exceptionnellement étroit, elle
  // réduit sa largeur plutôt que de recadrer l'image ou de créer une vue démesurée.
  const dimensions = height
    ? { width, height }
    : comparisonDimensionsForAspectRatio(width, aspectRatio, windowHeight * 0.82);
  const resolvedWidth = dimensions.width;
  const resolvedHeight = dimensions.height;

  const ratio = useSharedValue(0.5);
  // Dérivé de la largeur mesurée : le React Compiler interdit de muter une valeur partagée
  // depuis un gestionnaire d'événement, et une dérivation exprime mieux la dépendance.
  const containerWidth = useDerivedValue(() => resolvedWidth, [resolvedWidth]);
  const active = useSharedValue(0);
  // Mémorise le bord déjà atteint pour ne pas répéter le retour haptique à chaque frame.
  const edgeLatched = useSharedValue(0);
  const reducedMotion = useReducedMotion();

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
    .onTouchesDown(() => {
      'worklet';
      // Coupe la démo au contact du doigt : attendre l'activation du pan (12px de
      // mouvement) la ferait paraître figée un instant avant de répondre. `cancelAnimation`
      // fige la valeur là où elle en était, la reprise au doigt ne saute donc pas.
      cancelAnimation(ratio);
      cancelAnimation(active);
    })
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

  const tap = Gesture.Tap()
    .onTouchesDown(() => {
      'worklet';
      cancelAnimation(ratio);
      cancelAnimation(active);
    })
    .onEnd((event) => {
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
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={style}>
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
        style={[
          styles.container,
          { width: resolvedWidth, height: resolvedHeight, borderRadius, alignSelf: 'center' },
        ]}
        testID="before-after-slider">
        <BeforeAfterSliderIntro
          active={active}
          play={playIntro === true && width > 0}
          ratio={ratio}
          reducedMotion={reducedMotion}
        />
        <Image source={before} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />

        <Animated.View pointerEvents="none" style={[styles.afterClip, clipStyle]}>
          <Animated.View style={[styles.afterImageHolder, afterImageStyle, { height: resolvedHeight }]}>
            <Image
              source={after}
              style={[StyleSheet.absoluteFill, { width: resolvedWidth }]}
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
    </View>
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
