import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

type ProgressBarProps = {
  /** Avancement entre 0 et 100. */
  percentage: number;
  height?: number;
  /** `onDark` pour une jauge posée sur un aplat bleu nuit. */
  tone?: 'default' | 'onDark';
  style?: StyleProp<ViewStyle>;
};

/**
 * Jauge de mission. Une avancée non nulle reste toujours visible : 0,4 % d'un secteur refait
 * doit se voir, sinon la jauge dit « rien n'a été fait » à qui vient de contribuer.
 */
export function ProgressBar({ percentage, height = 8, tone = 'default', style }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const width = clamped === 0 ? 0 : Math.max(2, clamped);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[
        styles.track,
        { height, borderRadius: height / 2 },
        tone === 'onDark' && styles.trackOnDark,
        style,
      ]}>
      <View style={[styles.fill, { width: `${width}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueMist,
  },
  trackOnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  fill: {
    height: '100%',
    backgroundColor: Palette.goBright,
  },
});
