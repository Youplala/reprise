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
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import { formatContributorName } from '@/utils/community-stats';

const BUCKET_COLORS: Record<string, string> = {
  untouched: 'rgba(185, 95, 62, 0.55)',
  started: Palette.brass,
  halfway: Palette.lichen,
  complete: Palette.parisBlue,
};

function Section({
  kicker,
  title,
  copy,
  delay,
  children,
}: {
  kicker: string;
  title: string;
  copy?: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420)} style={styles.card}>
      <Text style={styles.cardKicker}>{kicker}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      {copy ? <Text style={styles.cardCopy}>{copy}</Text> : null}
      <View style={styles.cardBody}>{children}</View>
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
          kicker="LA GRILLE DE 1970"
          title="1 171 secteurs de 250 m"
          copy="Paris avait été découpé en secteurs pour le concours de 1970. Voici où en est chacun d’eux."
          delay={60}>
          <StackedShare data={shares} />
        </Section>

        <Section
          kicker="ACTIVITÉ DE LA COMMUNAUTÉ"
          title="Les photos mois par mois"
          copy={`${stats.datedRecaptures.toLocaleString('fr-FR')} photos datées depuis l’ouverture de la campagne.`}
          delay={120}>
          <BarChart data={months} unit="photos" accentColor={Palette.parisBlue} />
        </Section>

        <Section kicker="RÉPARTITION" title="Les arrondissements les plus actifs" delay={180}>
          <RankedBars data={arrondissements} color={Palette.lichen} />
        </Section>

        <Section
          kicker={`${stats.contributorCount} PERSONNES`}
          title="Celles et ceux qui refont Paris"
          copy="Les contributrices et contributeurs sont crédités par leur nom, comme le prévoit le règlement de l’Observatoire."
          delay={240}>
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
          kicker="À FAIRE EN PRIORITÉ"
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
          le CAUE de Paris, sous licence ODbL. Photos de 1970 conservées par la Bibliothèque
          historique de la Ville de Paris.
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
    marginTop: Spacing.four,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1,
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
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 56,
    minWidth: 132,
  },
  heroCaption: {
    flex: 1,
    marginBottom: Spacing.two,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 17,
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
    marginTop: Spacing.three,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.three,
    padding: Spacing.threeHalf,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  cardKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  cardTitle: {
    marginTop: Spacing.one,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 27,
  },
  cardCopy: {
    marginTop: Spacing.two,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  cardBody: {
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
    width: 22,
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '900',
  },
  contributorName: {
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  contributorCount: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 11,
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
    width: 22,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '900',
  },
  priorityText: {
    flex: 1,
  },
  priorityTitle: {
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
  },
  priorityMeta: {
    marginTop: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  footnote: {
    margin: Spacing.three,
    marginTop: Spacing.four,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
  },
});
