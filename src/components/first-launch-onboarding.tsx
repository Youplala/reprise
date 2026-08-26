import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import {
  CAMPAIGN_END_LABEL,
  EXHIBITION_LABEL,
  FIRST_LAUNCH_ONBOARDING,
} from '@/services/first-launch-onboarding';
import type { StationDetail } from '@/types/station';

export function FirstLaunchOnboarding({
  examples,
  onComplete,
  visible,
}: {
  examples: StationDetail[];
  onComplete: () => void;
  visible: boolean;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const slide = FIRST_LAUNCH_ONBOARDING[slideIndex];
  const example = examples[exampleIndex];
  const isExamplesSlide = slideIndex === 2;
  const isLast = slideIndex === FIRST_LAUNCH_ONBOARDING.length - 1;

  const close = () => {
    setSlideIndex(0);
    setExampleIndex(0);
    onComplete();
  };

  const next = () => {
    void Haptics.selectionAsync();
    if (isExamplesSlide && exampleIndex === 0 && examples.length > 1) {
      setExampleIndex(1);
      return;
    }
    if (isLast) {
      close();
      return;
    }
    setSlideIndex((value) => Math.min(value + 1, FIRST_LAUNCH_ONBOARDING.length - 1));
  };

  const previous = () => {
    void Haptics.selectionAsync();
    if (isExamplesSlide && exampleIndex > 0) {
      setExampleIndex(0);
      return;
    }
    setSlideIndex((value) => Math.max(0, value - 1));
  };

  return (
    <Modal animationType="fade" onRequestClose={close} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>REPRISE</Text>
          <Pressable
            accessibilityLabel="Passer la présentation"
            accessibilityRole="button"
            onPress={close}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <Text style={styles.skipText}>Passer</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>

          {slideIndex === 0 ? (
            <View style={styles.missionVisual}>
              <View style={styles.mapLine} />
              <View style={[styles.mapPoint, styles.mapPointOne]} />
              <View style={[styles.mapPoint, styles.mapPointTwo]} />
              <View style={[styles.mapPoint, styles.mapPointThree]} />
              <View style={styles.missionStamp}>
                <SymbolView name="camera.viewfinder" size={28} tintColor={Palette.white} />
                <Text style={styles.missionStampText}>PARIS · 2026</Text>
              </View>
              <Text style={styles.missionVisualTitle}>Une mémoire collective des paysages parisiens</Text>
            </View>
          ) : null}

          {slideIndex === 1 ? (
            <View style={styles.archiveCard}>
              <Text style={styles.archiveYear}>1970</Text>
              <View style={styles.archiveDivider} />
              <View style={styles.archiveStats}>
                <View style={styles.archiveStat}>
                  <Text style={styles.archiveValue}>2 800</Text>
                  <Text style={styles.archiveLabel}>PHOTOGRAPHES AMATEURS</Text>
                </View>
                <View style={styles.archiveStat}>
                  <Text style={styles.archiveValue}>30 087</Text>
                  <Text style={styles.archiveLabel}>PHOTOS INDEXÉES DANS REPRISE</Text>
                </View>
              </View>
              <Text style={styles.archiveSource}>Fonds « C’était Paris en 1970 » · BHVP</Text>
            </View>
          ) : null}

          {isExamplesSlide ? (
            example?.referenceImage && example.recaptureImage ? (
              <View style={styles.exampleCard}>
                <BeforeAfterSlider
                  after={example.recaptureImage}
                  afterLabel="2026"
                  before={example.referenceImage}
                  beforeLabel={String(example.year)}
                  borderRadius={Radius.medium}
                  height={245}
                />
                <Text style={styles.exampleTitle} numberOfLines={2}>{example.name}</Text>
                <Text style={styles.exampleMeta} numberOfLines={2}>
                  {example.author ? `${example.author} · ` : ''}archive BHVP
                  {'\n'}Reprise : {example.currentAuthor ?? 'contribution publique'}
                </Text>
                {examples.length > 1 ? (
                  <View style={styles.exampleCounter}>
                    <Text style={styles.exampleCounterText}>EXEMPLE {exampleIndex + 1} / 2</Text>
                    <Text style={styles.exampleHint}>Faites glisser l’image</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.exampleFallback}>
                <SymbolView name="photo.on.rectangle.angled" size={42} tintColor={Palette.parisBlue} />
                <Text style={styles.exampleFallbackText}>Les avant/après publics apparaîtront ici.</Text>
              </View>
            )
          ) : null}

          {slideIndex === 3 ? (
            <>
              <View style={styles.stepsCard}>
                {[
                  ['01', 'Choisir', 'Une archive près de vous'],
                  ['02', 'Aligner', 'La superposition en transparence'],
                  ['03', 'Photographier', 'Le même cadre aujourd’hui'],
                  ['04', 'Contribuer', 'À l’Observatoire officiel'],
                ].map(([number, title, copy]) => (
                  <View key={number} style={styles.stepRow}>
                    <Text style={styles.stepNumber}>{number}</Text>
                    <View style={styles.stepCopy}>
                      <Text style={styles.stepTitle}>{title}</Text>
                      <Text style={styles.stepBody}>{copy}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.datesRow}>
                <View style={styles.dateCard}>
                  <Text style={styles.dateKicker}>CAMPAGNE</Text>
                  <Text style={styles.dateTitle}>Jusqu’au{`\n`}{CAMPAIGN_END_LABEL}</Text>
                </View>
                <View style={[styles.dateCard, styles.exhibitionCard]}>
                  <Text style={styles.dateKicker}>EXPOSITION · LA ROCHE</Text>
                  <Text style={styles.dateTitle}>Du {EXHIBITION_LABEL}</Text>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityLabel="Écran précédent"
            accessibilityRole="button"
            disabled={slideIndex === 0}
            onPress={previous}
            style={({ pressed }) => [
              styles.backButton,
              slideIndex === 0 && styles.hidden,
              pressed && styles.pressed,
            ]}>
            <SymbolView name="arrow.left" size={16} tintColor={Palette.parisBlue} />
          </Pressable>
          <View accessibilityLabel={`Écran ${slideIndex + 1} sur 4`} style={styles.dots}>
            {FIRST_LAUNCH_ONBOARDING.map((item, index) => (
              <View key={item.eyebrow} style={[styles.dot, index === slideIndex && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}>
            <Text style={styles.nextText}>
              {isLast ? 'Explorer Paris' : isExamplesSlide && exampleIndex === 0 && examples.length > 1 ? 'Autre exemple' : 'Continuer'}
            </Text>
            <SymbolView name="arrow.right" size={15} tintColor={Palette.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  header: {
    minHeight: 58,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 2,
  },
  skip: { minHeight: 40, paddingHorizontal: Spacing.two, justifyContent: 'center' },
  skipText: { color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700' },
  content: { flexGrow: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.four },
  eyebrow: { color: Palette.copper, fontFamily: Fonts.mono, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { marginTop: Spacing.two, color: Palette.ink, fontFamily: Fonts.display, fontSize: 35, lineHeight: 38, fontWeight: '900' },
  body: { marginTop: Spacing.three, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  missionVisual: { minHeight: 285, marginTop: Spacing.four, padding: Spacing.four, overflow: 'hidden', borderRadius: Radius.large, backgroundColor: Palette.parisBlue, justifyContent: 'flex-end', ...Shadow.card },
  mapLine: { position: 'absolute', width: 420, height: 2, left: -30, top: 120, backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ rotate: '-17deg' }] },
  mapPoint: { position: 'absolute', width: 13, height: 13, borderRadius: 7, backgroundColor: Palette.brass, borderWidth: 3, borderColor: Palette.parisBlue },
  mapPointOne: { left: '18%', top: '30%' },
  mapPointTwo: { right: '24%', top: '41%' },
  mapPointThree: { left: '45%', top: '60%' },
  missionStamp: { alignSelf: 'flex-start', paddingHorizontal: Spacing.twoHalf, paddingVertical: Spacing.two, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.13)', flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  missionStampText: { color: Palette.white, fontFamily: Fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  missionVisualTitle: { marginTop: Spacing.three, maxWidth: 270, color: Palette.white, fontFamily: Fonts.display, fontSize: 26, lineHeight: 29, fontWeight: '900' },
  archiveCard: { marginTop: Spacing.four, padding: Spacing.four, borderRadius: Radius.large, backgroundColor: Palette.archive, ...Shadow.card },
  archiveYear: { color: Palette.copper, fontFamily: Fonts.display, fontSize: 76, lineHeight: 80, fontWeight: '900' },
  archiveDivider: { height: 1, marginVertical: Spacing.three, backgroundColor: 'rgba(23,38,47,0.18)' },
  archiveStats: { flexDirection: 'row', gap: Spacing.three },
  archiveStat: { flex: 1 },
  archiveValue: { color: Palette.ink, fontFamily: Fonts.display, fontSize: 28, fontWeight: '900' },
  archiveLabel: { marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.mono, fontSize: 8, lineHeight: 12, fontWeight: '800' },
  archiveSource: { marginTop: Spacing.four, color: Palette.inkSoft, fontFamily: Fonts.serif, fontSize: 12, fontStyle: 'italic' },
  exampleCard: { marginTop: Spacing.four, padding: Spacing.two, borderRadius: Radius.large, backgroundColor: Palette.white, ...Shadow.card },
  exampleTitle: { marginTop: Spacing.three, paddingHorizontal: Spacing.two, color: Palette.ink, fontFamily: Fonts.display, fontSize: 23, lineHeight: 26, fontWeight: '900' },
  exampleMeta: { marginTop: Spacing.one, paddingHorizontal: Spacing.two, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 10, lineHeight: 15 },
  exampleCounter: { marginTop: Spacing.two, padding: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.line, flexDirection: 'row', justifyContent: 'space-between' },
  exampleCounterText: { color: Palette.copper, fontFamily: Fonts.mono, fontSize: 8, fontWeight: '900' },
  exampleHint: { color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 9 },
  exampleFallback: { minHeight: 250, marginTop: Spacing.four, borderRadius: Radius.large, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  exampleFallbackText: { color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 13 },
  stepsCard: { marginTop: Spacing.four, padding: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, ...Shadow.card },
  stepRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Palette.line },
  stepNumber: { color: Palette.copper, fontFamily: Fonts.mono, fontSize: 11, fontWeight: '900' },
  stepCopy: { flex: 1 },
  stepTitle: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '900' },
  stepBody: { marginTop: 2, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 10 },
  datesRow: { marginTop: Spacing.three, flexDirection: 'row', gap: Spacing.two },
  dateCard: { flex: 1, minHeight: 104, padding: Spacing.three, borderRadius: Radius.medium, backgroundColor: Palette.parisBlue },
  exhibitionCard: { backgroundColor: Palette.copper },
  dateKicker: { color: Palette.blueMist, fontFamily: Fonts.mono, fontSize: 7, lineHeight: 10, fontWeight: '900' },
  dateTitle: { marginTop: Spacing.two, color: Palette.white, fontFamily: Fonts.display, fontSize: 17, lineHeight: 19, fontWeight: '900' },
  footer: { minHeight: 72, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.white, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.line },
  dotActive: { width: 18, backgroundColor: Palette.parisBlue },
  nextButton: { minHeight: 48, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, backgroundColor: Palette.parisBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  nextText: { color: Palette.white, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  hidden: { opacity: 0 },
});
