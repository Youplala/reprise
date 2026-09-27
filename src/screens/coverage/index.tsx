import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/charts/animated-number';
import { BarChart } from '@/components/charts/bar-chart';
import { ArrondissementHeatmap } from '@/components/charts/arrondissement-heatmap';
import { RankRow } from '@/components/charts/rank-row';
import { WaffleChart } from '@/components/charts/waffle-chart';
import { StackedShare } from '@/components/charts/stacked-share';
import { SourcePill } from '@/components/source-pill';
import { ProgressBar } from '@/components/progress-bar';
import {
  Fonts,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Stat,
  Typography,
} from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import { HISTORIC_GRID_COUNT } from '@/services/onboarding';
import { formatContributorName } from '@/utils/community-stats';

const BUCKET_COLORS: Record<string, string> = {
  untouched: 'rgba(204, 72, 28, 0.55)',
  started: Palette.brass,
  halfway: Palette.lichen,
  complete: Palette.parisBlue,
};

const DEVICE_COLORS: Record<string, string> = {
  digital: Palette.parisBlue,
  smartphone: Palette.goBright,
  film: Palette.lichen,
  other: Palette.line,
};

function SeeAllButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.seeAll, pressed && styles.seeAllPressed]}>
      <Text style={styles.seeAllText}>{label}</Text>
      <SymbolView name="chevron.right" size={13} tintColor={Palette.go} />
    </Pressable>
  );
}

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

  const weekdays = stats.weekdayActivity.map((entry) => ({
    key: String(entry.day),
    label: entry.label,
    value: entry.count,
    // Samedi et dimanche : c'est là que la campagne se joue.
    color: entry.day >= 5 ? Palette.goBright : undefined,
  }));
  const busiestDay = [...weekdays].sort((left, right) => right.value - left.value)[0];
  const datedTotal = weekdays.reduce((sum, entry) => sum + entry.value, 0);
  const weekendShare = datedTotal
    ? Math.round(
        (weekdays.filter((_, day) => day >= 5).reduce((sum, entry) => sum + entry.value, 0) /
          datedTotal) *
          100,
      )
    : 0;

  const devices = stats.deviceShare.map((entry) => ({
    key: entry.key,
    label: entry.label,
    value: entry.count,
    color: DEVICE_COLORS[entry.key],
  }));
  const filmCount = stats.deviceShare.find((entry) => entry.key === 'film')?.count ?? 0;

  const topContributors = stats.topContributors.slice(0, 5);
  const topPhotographers = stats.archivePhotographers.slice(0, 5);

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
          <Text style={styles.heroKicker}>Paris refait à</Text>
          <AnimatedNumber
            value={coverage.percentage}
            decimals={1}
            suffix=" %"
            style={styles.heroNumber}
          />
          <Text style={styles.heroCaption}>des photos de 1970 ont été refaites</Text>
          <ProgressBar percentage={coverage.percentage} height={10} tone="onDark" style={styles.heroTrack} />
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

        <Section
          title="Quand Paris sort photographier"
          copy={`Le week-end concentre ${weekendShare} % des photos datées.`}
          delay={160}>
          <BarChart
            data={weekdays}
            unit="photos"
            accentColor={Palette.parisBlue}
            initialKey={busiestDay?.key}
          />
        </Section>

        <Section
          title="Smartphone ou appareil photo ?"
          copy={
            filmCount > 0
              ? `Et ${filmCount} ${filmCount > 1 ? 'photos refaites' : 'photo refaite'} à l’argentique, comme en 1970.`
              : undefined
          }
          delay={200}>
          <WaffleChart data={devices} />
        </Section>

        <Section
          title="Paris, arrondissement par arrondissement"
          copy="Touchez un arrondissement pour voir son score."
          delay={240}>
          <ArrondissementHeatmap data={stats.arrondissementActivity} />
          <SeeAllButton
            label="Voir le classement complet"
            onPress={() => router.push({ pathname: '/stats/[kind]', params: { kind: 'arrondissements' } })}
          />
        </Section>

        <Section
          title="Celles et ceux qui refont Paris"
          copy={`${stats.contributorCount} personnes créditées par leur prénom, comme le prévoit le règlement de l’Observatoire.`}
          delay={280}>
          <View>
            {topContributors.map((contributor, index) => (
              <RankRow
                key={contributor.name}
                rank={index + 1}
                label={formatContributorName(contributor.name)}
                count={contributor.count}
                max={topContributors[0]?.count ?? 1}
                unit="photos"
                first={index === 0}
                last={index === topContributors.length - 1}
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push({
                    pathname: '/contributor/[name]',
                    params: { name: contributor.name },
                  });
                }}
              />
            ))}
          </View>
          <SeeAllButton
            label={`Voir les ${stats.contributorCount} contributeurs`}
            onPress={() => router.push('/contributors')}
          />
        </Section>

        {topPhotographers.length ? (
          <Section
            title="Les photographes de 1970 les plus repris"
            copy={`${stats.archivePhotographers.length} photographes identifiés ont déjà vu au moins une de leurs vues refaite.`}
            delay={320}>
            <View>
              {topPhotographers.map((photographer, index) => (
                <RankRow
                  key={photographer.name}
                  rank={index + 1}
                  label={formatContributorName(photographer.name)}
                  count={photographer.count}
                  max={topPhotographers[0]?.count ?? 1}
                  unit="vues refaites"
                  first={index === 0}
                  last={index === topPhotographers.length - 1}
                />
              ))}
            </View>
            <SeeAllButton
              label="Voir tous les photographes"
              onPress={() => router.push({ pathname: '/stats/[kind]', params: { kind: 'photographes' } })}
            />
          </Section>
        ) : null}

        <Section
          title="Les secteurs les plus fournis"
          copy="Ces secteurs contiennent le plus de photos qui n’ont pas encore été refaites."
          delay={360}>
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
  seeAll: {
    marginTop: Spacing.twoHalf,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  seeAllPressed: {
    backgroundColor: Palette.goSoft,
  },
  seeAllText: {
    ...Typography.body,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
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
    fontFamily: Fonts.display,
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
  heroKicker: {
    ...Kicker,
    color: Palette.goBright,
  },
  heroNumber: {
    ...Stat,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    fontSize: 64,
    lineHeight: 80,
    color: Palette.white,
  },
  heroCaption: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.78)',
    fontFamily: Fonts.sans,
  },
  heroTrack: {
    marginTop: Spacing.three,
  },
  heroDetail: {
    ...Typography.body,
    marginTop: Spacing.three,
    color: 'rgba(255, 255, 255, 0.78)',
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
    fontFamily: Fonts.display,
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
