import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

export function isVerticalPreviewDrag(dx: number, dy: number) {
  return Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.5;
}

export function previewShouldCollapse(collapsed: boolean, dy: number, vy: number) {
  if (dy > 36 || (dy > 8 && vy > 0.5)) return true;
  if (dy < -36 || (dy < -8 && vy < -0.5)) return false;
  return collapsed;
}

type Props = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: ReactNode;
};

/** Le mouvement vertical appartient au panneau, l'horizontal reste au carrousel. */
export function MapPreviewSheet({ collapsed, onCollapsedChange, children }: Props) {
  const [contentHeight, setContentHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(collapsed ? 1 : 0));
  const [reducedMotion, setReducedMotion] = useState(false);
  const settle = useCallback((nextCollapsed: boolean) => {
    Animated.timing(progress, {
      toValue: nextCollapsed ? 1 : 0,
      duration: reducedMotion ? 0 : 220,
      useNativeDriver: false,
    }).start();
  }, [progress, reducedMotion]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReducedMotion(enabled);
    });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    settle(collapsed);
    return () => progress.stopAnimation();
  }, [collapsed, progress, settle]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      isVerticalPreviewDrag(gesture.dx, gesture.dy),
    onPanResponderGrant: () => progress.stopAnimation(),
    onPanResponderMove: (_, gesture) => {
      const next = (collapsed ? 1 : 0) + gesture.dy / Math.max(contentHeight, 1);
      progress.setValue(Math.max(0, Math.min(1, next)));
    },
    onPanResponderRelease: (_, gesture) => {
      const next = previewShouldCollapse(collapsed, gesture.dy, gesture.vy);
      onCollapsedChange(next);
      settle(next);
    },
    onPanResponderTerminate: () => settle(collapsed),
  }), [collapsed, contentHeight, onCollapsedChange, progress, settle]);

  return (
    <View {...pan.panHandlers} pointerEvents="box-none" style={styles.sheet}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Afficher les photos' : 'Réduire les photos'}
        accessibilityHint="Glissez vers le bas pour réduire, vers le haut pour afficher"
        accessibilityState={{ expanded: !collapsed }}
        hitSlop={12}
        onPress={() => onCollapsedChange(!collapsed)}
        style={({ pressed }) => [styles.handle, collapsed && styles.handleCollapsed, pressed && styles.pressed]}>
        <View style={[styles.grabber, collapsed && styles.grabberCollapsed]} />
      </Pressable>
      <Animated.View
        pointerEvents={collapsed ? 'none' : 'auto'}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        style={[
          styles.clip,
          { height: contentHeight > 0
            ? progress.interpolate({ inputRange: [0, 1], outputRange: [contentHeight, 0] })
            : collapsed ? 0 : undefined },
        ]}>
        <View
          style={styles.content}
          onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { minHeight: 24 },
  handle: {
    position: 'absolute',
    top: 0,
    zIndex: 2,
    alignSelf: 'center',
    width: 56,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  handleCollapsed: {
    backgroundColor: Palette.fog,
  },
  grabber: {
    width: 28, height: 4, borderRadius: 2, backgroundColor: Palette.white,
    shadowColor: Palette.ink, shadowOpacity: 0.35, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  grabberCollapsed: { backgroundColor: Palette.inkSoft, shadowOpacity: 0 },
  pressed: { backgroundColor: Palette.blueMist },
  clip: { overflow: 'hidden' },
  content: { flexShrink: 0 },
});
