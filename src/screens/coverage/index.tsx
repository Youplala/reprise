import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/charts/animated-number';
import { BarChart } from '@/components/charts/bar-chart';
import { RankedBars } from '@/components/charts/ranked-bars';
import { StackedShare } from '@/components/charts/stacked-share';
import { SourcePill } from '@/components/source-pill';
import { Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import { HISTORIC_GRID_COUNT } from '@/services/onboarding';
import { formatContributorName } from '@/utils/community-stats';

const BUCKET_COLORS: Record<string, string> = {
  untouched: 'rgba(185, 95, 62, 0.55)',
  started: Palette.brass,
  halfway: Palette.lichen,
  complete: Palette.parisBlue,
};

// Une seule tête de section a droit au kicker orange sur cet écran — celle du haut de page. Les
// sections qui suivent se contentent de leur titre. Seule celle qui détache un objet actionnable
// (la liste de contributeurs) se pose sur une carte ; les autres vivent directement sur le fond.
function Section({
  title,
  copy,
  delay,
  card = false,
  children,
}: {
  title: string;
  copy?: string;
  delay: number;
  card?: boolean;
  children: ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(420)}
      style={[styles.section, card && styles.sectionCard]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {copy ? <Text style={styles.sectionCopy}>{copy}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

export function CoverageScreen() {
  const router = useRouter();
  const { coverage, snapshotVersion, grid, stats } = useStations();

  const priorityCells = useMemo(
    () =>
      grid.filter((cell) => cell.remaining1970 > 0)
        .sort((left, right) => right.remaining1970 - left.remaining1970)
        .slice(0, 5),
    [grid],
  );

  const shares = stats.squareDistribution.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: bucket.count,
    color: BUCKET_COLORS[bucket.key],
  }));

  const months = stats.monthlyActivity.map((entry) => ({
    key: entry.month,
    label: entry.label,
    value: entry.count,
  }));

  const arrondissements = stats.arrondissementActivity.slice(0, 8).map((entry) => ({
    key: entry.code,
    label: entry.label,
    value: entry.count,
  }));

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityLabel="Retour"
              accessibilityRole="button"
              onPress={() => {
                void Haptics.selectionAsync();
                router.back();
              }}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <SymbolView name="chevron.left" size={17} tintColor={Palette.ink} />
            </Pressable>
            <SourcePill version={snapshotVersion} />
          </View>

          <Text style={styles.kicker}>OÙ EN EST LA CARTE</Text>
          <Text style={styles.title}>Ce qui a été refait, ce qu’il reste à photographier.</Text>
        </SafeAreaView>

        <Animated.View entering={FadeInDown.duration(420)} style={styles.heroCard}>
          <View style={styles.heroTop}>
            <AnimatedNumber
              value={coverage.percentage}
              decimals={1}
              suffix=" %"
              style={styles.heroNumber}
            />
            <Text style={styles.heroCaption}>des photos de 1970{'\n'}ont été refaites</Text>
          </View>
          <View style={styles.heroTrack}>
            <View style={[styles.heroFill, { width: `${Math.max(1.5, coverage.percentage)}%` }]} />
          </View>
          <Text style={styles.heroDetail}>
            {coverage.published1970.toLocaleString('fr-FR')} photos refaites sur{' '}
            {coverage.total1970.toLocaleString('fr-FR')} photos numérisées. Le chantier est immense,
            c’est normal : chaque photo compte.
          </Text>
        </Animated.View>

        <Section
          title={`${HISTORIC_GRID_COUNT.toLocaleString('fr-FR')} secteurs historiques`}
          copy={`${grid.length.toLocaleString('fr-FR')} secteurs de 250 m sont actuellement référencés dans Paris GO. Voici où en est chacun d’eux.`}
          delay={60}>
          <StackedShare data={shares} />
        </Section>

        <Section
          title="Les photos mois par mois"
          copy={`${stats.datedRecaptures.toLocaleString('fr-FR')} photos datées depuis l’ouverture de la campagne.`}
          delay={120}>
          <BarChart data={months} unit="photos" accentColor={Palette.parisBlue} />
        </Section>

        <Section title="Les arrondissements les plus actifs" delay={180}>
          <RankedBars data={arrondissements} color={Palette.lichen} />
        </Section>

        <Section
          title="Celles et ceux qui refont Paris"
          copy={`${stats.contributorCount} personnes créditées par leur prénom, comme le prévoit le règlement de l’Observatoire.`}
          delay={240}
          card>
          <View style={styles.contributors}>
            {stats.topContributors.slice(0, 6).map((contributor, index) => (
              <Pressable
                key={contributor.name}
                accessibilityLabel={`Voir le profil de ${formatContributorName(contributor.name)}, ${contributor.count} photos`}
                accessibilityRole="button"
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push({
                    pathname: '/contributor/[name]',
                    params: { name: contributor.name },
                  });
                }}
                style={({ pressed }) => [
                  styles.contributorRow,
                  pressed && styles.contributorRowPressed,
                ]}>
                <Text style={styles.contributorRank}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.contributorName} numberOfLines={1}>
                  {formatContributorName(contributor.name)}
                </Text>
                <Text style={styles.contributorCount}>
                  {contributor.count} {contributor.count > 1 ? 'photos' : 'photo'}
                </Text>
                <SymbolView name="chevron.right" size={11} tintColor={Palette.inkSoft} />
              </Pressable>
            ))}
          </View>
        </Section>

        <Section
          title="Les secteurs les plus fournis"
          copy="Ces secteurs contiennent le plus de photos qui n’ont pas encore été refaites."
          delay={300}>
          <View style={styles.priority}>
            {priorityCells.map((cell, index) => (
              <Pressable
                key={cell.id}
                accessibilityRole="button"
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push({ pathname: '/station/[id]', params: { id: cell.id } });
                }}
                style={({ pressed }) => [styles.priorityRow, pressed && styles.pressedSoft]}>
                <Text style={styles.priorityRank}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.priorityText}>
                  <Text style={styles.priorityTitle}>Secteur {cell.name}</Text>
                  <Text style={styles.priorityMeta}>
                    {cell.remaining1970} photos à retrouver · {cell.percentage} % fait
                  </Text>
                </View>
                <SymbolView name="chevron.right" size={13} tintColor={Palette.inkSoft} />
              </Pressable>
            ))}
          </View>
        </Section>

        <Text style={styles.footnote}>
          Données publiques de l’Observatoire photo participatif des paysages parisiens, animé par
          le CAUE de Paris. Photos de 1970 conservées par la Bibliothèque historique de la Ville
          de Paris.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  pressedSoft: {
    opacity: 0.55,
  },
  kicker: {
    ...Typography.caption,
    marginTop: Spacing.four,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    ...Typography.display,
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  heroCard: {
    marginHorizontal: Spacing.three,
    padding: Spacing.threeHalf,
    borderRadius: Radius.large,
    backgroundColor: Palette.parisBlue,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  heroNumber: {
    ...Typography.title,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '900',
    minWidth: 132,
  },
  heroCaption: {
    ...Typography.body,
    flex: 1,
    marginBottom: Spacing.two,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
  },
  heroTrack: {
    marginTop: Spacing.three,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  heroFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Palette.brass,
  },
  heroDetail: {
    ...Typography.body,
    marginTop: Spacing.three,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
  },
  // Une section n'est une carte que si elle détache un objet actionnable (ici, la liste de
  // contributeurs) ; sinon elle reste posée sur le fond de l'écran.
  section: {
    marginTop: Spacing.five,
    marginHorizontal: Spacing.three,
  },
  sectionCard: {
    marginTop: Spacing.three,
    padding: Spacing.threeHalf,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  sectionTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  sectionCopy: {
    ...Typography.body,
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  sectionBody: {
    marginTop: Spacing.three,
  },
  contributors: {
    gap: Spacing.twoHalf,
  },
  contributorRow: {
    minHeight: 40,
    marginHorizontal: -Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  contributorRowPressed: {
    backgroundColor: Palette.blueMist,
  },
  contributorRank: {
    ...Typography.caption,
    width: 22,
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontWeight: '900',
  },
  contributorName: {
    ...Typography.body,
    flex: 1,
    color: Palette.ink,
    fontWeight: '600',
  },
  contributorCount: {
    ...Typography.body,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontWeight: '700',
  },
  priority: {
    gap: Spacing.one,
  },
  priorityRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoHalf,
  },
  priorityRank: {
    ...Typography.caption,
    width: 22,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '900',
  },
  priorityText: {
    flex: 1,
  },
  priorityTitle: {
    ...Typography.body,
    color: Palette.ink,
    fontWeight: '700',
  },
  priorityMeta: {
    ...Typography.body,
    marginTop: Spacing.half,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  footnote: {
    ...Typography.caption,
    margin: Spacing.three,
    marginTop: Spacing.four,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
});
