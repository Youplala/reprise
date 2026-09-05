import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, Palette } from '@/constants/theme';

const appIcon = require('../../assets/images/reprise-app-icon.png');
const logoGlow = require('../../assets/images/logo-glow.png');

type AnimatedSplashProps = {
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const overlayOpacity = useSharedValue(1);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.74);
  const markRotation = useSharedValue(-12);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.7);
  const wordOpacity = useSharedValue(0);
  const wordOffset = useSharedValue(12);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 220 });
    markScale.value = withSequence(
      withSpring(1.06, { damping: 12, stiffness: 170, mass: 0.7 }),
      withSpring(1, { damping: 14, stiffness: 190 }),
    );
    markRotation.value = withSpring(0, { damping: 13, stiffness: 120 });
    glowOpacity.value = withSequence(
      withTiming(0.72, { duration: 420 }),
      withDelay(350, withTiming(0.18, { duration: 360 })),
    );
    glowScale.value = withTiming(1.16, { duration: 980, easing: Easing.out(Easing.cubic) });
    wordOpacity.value = withDelay(230, withTiming(1, { duration: 360 }));
    wordOffset.value = withDelay(230, withSpring(0, { damping: 17, stiffness: 150 }));
    overlayOpacity.value = withDelay(
      1050,
      withTiming(0, { duration: 360, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [glowOpacity, glowScale, markOpacity, markRotation, markScale, onFinish, overlayOpacity, wordOffset, wordOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }, { rotate: `${markRotation.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordOffset.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
      <View style={styles.grid}>
        {Array.from({ length: 8 }, (_, index) => (
          <View key={`vertical-${index}`} style={[styles.gridVertical, { left: `${index * 16}%` }]} />
        ))}
        {Array.from({ length: 12 }, (_, index) => (
          <View key={`horizontal-${index}`} style={[styles.gridHorizontal, { top: `${index * 10}%` }]} />
        ))}
      </View>
      <View style={styles.logoStage}>
        <Animated.View style={[styles.glow, glowStyle]}>
          <Image source={logoGlow} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[styles.mark, markStyle]}>
          <Image source={appIcon} style={styles.markImage} contentFit="cover" />
        </Animated.View>
        <Animated.View style={[styles.wordmark, wordStyle]}>
          <Text style={styles.brand}>PARIS GO</Text>
          <Text style={styles.tagline}>PARIS · 1970 → AUJOURD’HUI</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 100,
    backgroundColor: '#0F233A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    opacity: 0.14,
    transform: [{ rotate: '-8deg' }, { scale: 1.22 }],
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: Palette.white,
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.white,
  },
  logoStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
  },
  mark: {
    width: 184,
    height: 184,
    borderRadius: 42,
    overflow: 'hidden',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  wordmark: {
    alignItems: 'center',
    marginTop: 30,
  },
  brand: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5.8,
  },
  tagline: {
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
});
