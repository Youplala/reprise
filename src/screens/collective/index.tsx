import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BeforeAfterSlider } from '@/components/before-after-slider';
import { SourcePill } from '@/components/source-pill';
import { StationCard } from '@/components/station-card';
import { Fonts, Palette, Radius, Shadow, Spacing, TabBarClearance } from '@/constants/theme';

import { useStations } from '@/providers/stations-provider';
import {
  buildLocalSuggestion,
  formatSnapshotDate,
} from '@/services/collective-content';

import type { StationDetail } from '@/types/station';
import { formatContributorName } from '@/utils/community-stats';
import { mappingStatus } from '@/utils/mapping-coverage';

function LiveComparisonCard({
  detail,
  onOpen,
}: {
  detail: StationDetail;
  onOpen: () => void;
}) {
  if (!detail.referenceImage || !detail.recaptureImage) return null;

  return (
    <View style={styles.activityCard}>
      <BeforeAfterSlider
        before={detail.referenceImage}
        after={detail.recaptureImage}
        beforeLabel={String(detail.year)}
        afterLabel="2026"
        borderRadius={0}
      />
      <View style={styles.activityBody}>
        <Text style={styles.activityKicker}>PHOTO REFAITE · OBSERVATOIRE</Text>
        <Text style={styles.activityTitle}>{detail.name}</Text>
        <Text style={styles.activityMeta}>
          {[
            detail.currentAuthor,
            detail.recaptureDate ? formatSnapshotDate(detail.recaptureDate) : undefined,
            detail.arrondissement ?? 'Paris',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={styles.activityActions}>
          <Pressable onPress={onOpen} style={styles.detailButton}>
            <Text style={styles.detailText}>Voir la photo</Text>
            <SymbolView name="arrow.right" size={13} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function CollectiveScreen() {
  const router = useRouter();
  const {
    stations,
    snapshotVersion,
    coverage,
    stats,
    publishedSubmissions,
    refresh,
    refreshing,
  } = useStations();
  // Les reprises publiées sont dans l'instantané : plus de requêtes en cascade pour les trouver.
  const feed = publishedSubmissions;
  const feedStatus: 'loading' | 'ready' | 'error' = feed.length ? 'ready' : 'error';
  const openStations = useMemo(
    () => stations.filter((station) => mappingStatus(station) === 'to-reprise'),
    [stations],
  );
  const remainingMissions = openStations.slice(0, 6);
  const localSuggestion = useMemo(() => buildLocalSuggestion(openStations), [openStations]);
  const snapshotDate = formatSnapshotDate(snapshotVersion);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={Palette.parisBlue}
          />
        }
        contentContainerStyle={styles.content}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.brand}>COMMUNAUTÉ</Text>
              <Text style={styles.brandSub}>Les regards qui refont Paris</Text>
            </View>
            <SourcePill version={snapshotVersion} />
          </View>

          <Text style={styles.eyebrow}>INSTANTANÉ DE L’OBSERVATOIRE</Text>
          <Text style={styles.title}>Paris, avant{'\n'}et aujourd’hui.</Text>
          <Text style={styles.copy}>
            Découvrez les reprises publiées dans le relevé public du {snapshotDate}.
          </Text>
        </SafeAreaView>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {coverage.published1970.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.statLabel}>PHOTOS REFAITES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{coverage.percentage}%</Text>
            <Text style={styles.statLabel}>DU FONDS 1970</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {coverage.remaining1970.toLocaleString('fr-FR')}
            </Text>
            <Text style={styles.statLabel}>À RETROUVER</Text>
          </View>
        </View>

        <View style={styles.contributors}>
          <Pressable
            accessibilityLabel={`Voir le bilan de la communauté : ${stats.contributorCount} contributeurs et ${stats.recapturesLast30Days} photos publiées ce mois-ci`}
            accessibilityRole="button"
            onPress={() => {
              void Haptics.selectionAsync();
              router.push('/coverage');
            }}
            style={({ pressed }) => [
              styles.contributorsHead,
              pressed && styles.contributorsPressed,
            ]}>
            <Text style={styles.contributorsKicker}>
              {stats.contributorCount} CONTRIBUTEURS · {stats.recapturesLast30Days} PHOTOS CE MOIS-CI
            </Text>
            <View style={styles.contributorsAction}>
              <Text style={styles.contributorsActionText}>Le bilan</Text>
              <SymbolView name="chevron.right" size={12} tintColor={Palette.parisBlue} />
            </View>
          </Pressable>
          <View style={styles.contributorsList}>
            {stats.topContributors.slice(0, 3).map((contributor) => (
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
                  styles.contributorChip,
                  pressed && styles.contributorChipPressed,
                ]}>
                <Text style={styles.contributorInitials}>
                  {contributor.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
                    .join('')}
                </Text>
                <Text style={styles.contributorName} numberOfLines={1}>
                  {formatContributorName(contributor.name)}
                </Text>
                <Text style={styles.contributorCount}>{contributor.count}</Text>
                <SymbolView name="chevron.right" size={11} tintColor={Palette.inkSoft} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>PUBLICATIONS RÉCENTES · 1970 → 2026</Text>
            <Text style={styles.sectionTitle}>Derniers avant/après</Text>
          </View>
          <SymbolView name="arrow.left.and.right" size={18} tintColor={Palette.parisBlue} />
        </View>

        {feedStatus === 'ready' ? (
          feed.map((detail) => (
            <LiveComparisonCard
              key={detail.id}
              detail={detail}
              onOpen={() =>
                router.push({ pathname: '/station/[id]', params: { id: detail.id } })
              }
              />
          ))
        ) : (
          <View style={styles.feedLoading}>
            <SymbolView name="photo.on.rectangle.angled" size={24} tintColor={Palette.inkSoft} />
            <Text style={styles.loadingTitle}>Aucune photo refaite pour l’instant</Text>
            <Text style={styles.loadingCopy}>
              Les comparaisons avant/après apparaîtront ici dès qu’une photo sera publiée.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>MISSIONS OUVERTES · FONDS 1970</Text>
            <Text style={styles.sectionTitle}>Photos à retrouver</Text>
          </View>
          <SymbolView name="scope" size={19} tintColor={Palette.copper} />
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.missionRail}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}>
          {remainingMissions.map((station) => (
            <StationCard key={station.id} station={station} compact />
          ))}
        </ScrollView>

        {localSuggestion ? (
          <View style={styles.walkCard}>
            <View style={styles.suggestionMark}>
              <SymbolView name="map.fill" size={28} tintColor={Palette.parisBlue} />
              <Text style={styles.suggestionCount}>{localSuggestion.missionCount}</Text>
              <Text style={styles.suggestionCountLabel}>POINTS DE VUE OUVERTS</Text>
            </View>
            <View style={styles.walkBody}>
              <Text style={styles.walkKicker}>SUGGESTION LOCALE · {localSuggestion.sector}</Text>
              <Text style={styles.walkTitle}>Explorer ce secteur</Text>
              <Text style={styles.walkCopy}>
                Sélection calculée sur cet iPhone à partir des missions du relevé du {snapshotDate}.
              </Text>
              <Pressable
                accessibilityLabel={`Voir un point de départ dans le ${localSuggestion.sector}`}
                onPress={() =>
                  router.push({
                    pathname: '/station/[id]',
                    params: { id: localSuggestion.stationId },
                  })
                }
                style={({ pressed }) => [styles.walkAction, pressed && styles.pressed]}>
                <Text style={styles.walkActionText}>Voir un point de départ</Text>
                <SymbolView name="arrow.right" size={14} tintColor={Palette.white} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.prototypeNote}>
          <SymbolView name="info.circle" size={22} tintColor={Palette.parisBlue} />
          <Text style={styles.prototypeText}>
            Données Observatoire : relevé public du {snapshotDate}. Archives 1970 : Bibliothèques
            spécialisées de la Ville de Paris. Les suggestions sont calculées localement, sans
            activité sociale ni envoi depuis l’app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  content: {
    paddingBottom: TabBarClearance,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  brandRow: {
    minHeight: 62,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 2.2,
  },
  brandSub: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginTop: -2,
  },
  eyebrow: {
    marginTop: Spacing.three,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: Spacing.two,
    marginHorizontal: -2,
    paddingHorizontal: 2,
    paddingTop: 3,
    paddingBottom: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: -1.2,
    fontWeight: '800',
  },
  copy: {
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  stats: {
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 27,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 2,
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  contributors: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    gap: Spacing.twoHalf,
    ...Shadow.card,
  },
  contributorsPressed: {
    opacity: 0.75,
  },
  contributorsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  contributorsKicker: {
    flex: 1,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  contributorsAction: {
    minHeight: 28,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueMist,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contributorsActionText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
  },
  contributorsList: {
    gap: Spacing.two,
  },
  contributorChip: {
    minHeight: 36,
    marginHorizontal: -Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  contributorChipPressed: {
    backgroundColor: Palette.blueMist,
  },
  contributorInitials: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Palette.blueMist,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 30,
  },
  contributorName: {
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
  },
  contributorCount: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    marginTop: 4,
    marginHorizontal: -2,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 4,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
  },
  activityCard: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  activityBody: {
    padding: Spacing.three,
  },
  activityKicker: {
    color: Palette.lichen,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  retryButton: {
    minHeight: 44,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: Spacing.two,
  },
  retryText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
  },
  activityTitle: {
    marginTop: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 25,
    fontWeight: '800',
  },
  activityMeta: {
    marginTop: 4,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  activityActions: {
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.line,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  detailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
  },
  feedLoading: {
    marginHorizontal: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    alignItems: 'center',
  },
  loadingMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: Palette.blueMist,
    borderTopColor: Palette.parisBlue,
  },
  loadingTitle: {
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
  },
  loadingCopy: {
    marginTop: 5,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  missionRail: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  walkCard: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    ...Shadow.card,
  },
  suggestionMark: {
    height: 170,
    backgroundColor: Palette.blueMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionCount: {
    marginTop: Spacing.one,
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontSize: 42,
    fontWeight: '900',
  },
  suggestionCountLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  walkBody: {
    padding: Spacing.three,
  },

  walkKicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  walkTitle: {
    marginTop: Spacing.two,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
  },
  walkCopy: {
    marginTop: Spacing.two,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
  },
  walkAction: {
    marginTop: Spacing.three,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Palette.copper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  walkActionText: {
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
  },
  prototypeNote: {
    margin: Spacing.three,
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: Palette.line,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  prototypeText: {
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
