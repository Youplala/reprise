import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { OFFICIAL_CONTRIBUTION_GUIDE } from '@/services/official-contribution-guide';

export function OfficialContributionGuide({
  onComplete,
  visible,
}: {
  onComplete: () => void;
  visible: boolean;
}) {
  const [index, setIndex] = useState(0);
  const slide = OFFICIAL_CONTRIBUTION_GUIDE[index];
  const isLast = index === OFFICIAL_CONTRIBUTION_GUIDE.length - 1;

  const closeGuide = () => {
    setIndex(0);
    onComplete();
  };

  const continueGuide = () => {
    if (isLast) {
      closeGuide();
      return;
    }
    setIndex((value) => Math.min(value + 1, OFFICIAL_CONTRIBUTION_GUIDE.length - 1));
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeGuide}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            style={styles.sheet}>
            <View style={styles.topRow}>
              <Text style={styles.step}>{slide.eyebrow}</Text>
              <Pressable
                accessibilityLabel="Passer le guide"
                accessibilityRole="button"
                onPress={closeGuide}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
                <Text style={styles.skipLabel}>Passer</Text>
              </Pressable>
            </View>

            <View style={styles.iconShell}>
              <SymbolView name={slide.icon} size={34} tintColor={Palette.white} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>

            <View style={styles.points}>
              {slide.points.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.checkShell}>
                    <SymbolView name="checkmark" size={10} tintColor={Palette.white} />
                  </View>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <View accessibilityLabel={`Étape ${index + 1} sur 3`} style={styles.dots}>
                {OFFICIAL_CONTRIBUTION_GUIDE.map((item, dotIndex) => (
                  <View
                    key={item.eyebrow}
                    style={[styles.dot, dotIndex === index && styles.dotActive]}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={continueGuide}
                style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
                <Text style={styles.continueLabel}>
                  {isLast ? 'Voir le formulaire' : 'Suivant'}
                </Text>
                <SymbolView name="arrow.right" size={14} tintColor={Palette.white} />
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 24, 35, 0.58)',
    justifyContent: 'flex-end',
  },
  safeArea: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '100%',
    marginHorizontal: Spacing.two,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  sheetContent: { padding: Spacing.four },
  topRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  skipButton: {
    minHeight: 32,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  skipLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  iconShell: {
    width: 66,
    height: 66,
    marginTop: Spacing.three,
    borderRadius: 24,
    backgroundColor: Palette.parisBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: '900',
  },
  body: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  points: { marginTop: Spacing.three, gap: Spacing.twoHalf },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  checkShell: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderRadius: 10,
    backgroundColor: Palette.lichen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: {
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  footer: {
    marginTop: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Palette.line,
  },
  dotActive: { width: 22, backgroundColor: Palette.parisBlue },
  continueButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  continueLabel: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
