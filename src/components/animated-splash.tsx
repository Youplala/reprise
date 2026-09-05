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

const appIcon = require('../../assets/images/parisgo-app-icon.png');

type AnimatedSplashProps = {
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const overlayOpacity = useSharedValue(1);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.74);
  const markRotation = useSharedValue(-12);
  const wordOpacity = useSharedValue(0);
  const wordOffset = useSharedValue(12);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 220 });
    markScale.value = withSequence(
      withSpring(1.06, { damping: 12, stiffness: 170, mass: 0.7 }),
      withSpring(1, { damping: 14, stiffness: 190 }),
    );
    markRotation.value = withSpring(0, { damping: 13, stiffness: 120 });
    wordOpacity.value = withDelay(230, withTiming(1, { duration: 360 }));
    wordOffset.value = withDelay(230, withSpring(0, { damping: 17, stiffness: 150 }));
    overlayOpacity.value = withDelay(
      1050,
      withTiming(0, { duration: 360, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [markOpacity, markRotation, markScale, onFinish, overlayOpacity, wordOffset, wordOpacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }, { rotate: `${markRotation.value}deg` }],
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
        <Animated.View style={[styles.mark, markStyle]}>
          <Image source={appIcon} style={styles.markImage} contentFit="cover" />
        </Animated.View>
        <Animated.View style={[styles.wordmark, wordStyle]}>
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
    backgroundColor: '#FCF6F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    opacity: 0.08,
    transform: [{ rotate: '-8deg' }, { scale: 1.22 }],
  },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#0F233A',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#0F233A',
  },
  logoStage: {
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#0F233A',
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 5.8,
  },
  tagline: {
    color: '#163F5B',
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
  },
});
