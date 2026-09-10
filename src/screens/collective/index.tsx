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
import { Fonts, Palette, Radius, Shadow, Spacing, TabBarClearance, Typography } from '@/constants/theme';

import { useStations } from '@/providers/stations-provider';
import {
  buildLocalSuggestion,
  formatSnapshotDate,
} from '@/services/collective-content';

import type { StationDetail } from '@/types/station';
import { formatContributorName } from '@/utils/community-stats';
import { mappingStatus } from '@/utils/mapping-coverage';

const PARTICLES = ['de', 'du', 'des', 'le', 'la'];

/** Initiales lisibles pour l'avatar, calculées sur le nom déjà réduit par `formatContributorName`. */
function initialsFor(displayName: string) {
  return displayName
    .split(' ')
    .filter(Boolean)
    .filter((part) => !PARTICLES.includes(part.toLocaleLowerCase('fr-FR')))
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
    .join('');
}

function LiveComparisonCard({
  detail,
  onOpen,
}: {
  detail: StationDetail;
  onOpen: () => void;
}) {
  if (!detail.referenceImage || !detail.recaptureImage) return null;

  return (
    <Pressable
      accessibilityLabel={`Ouvrir la photo refaite ${detail.name}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.activityCard, pressed && styles.activityCardPressed]}>
      <BeforeAfterSlider
        before={detail.referenceImage}
        after={detail.recaptureImage}
        beforeLabel={String(detail.year)}
        afterLabel="2026"
        borderRadius={0}
      />
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle}>{detail.name}</Text>
        <View style={styles.activityMetaRow}>
          <Text style={styles.activityMeta} numberOfLines={1}>
            {[
              detail.currentAuthor ? formatContributorName(detail.currentAuthor) : undefined,
              detail.recaptureDate ? formatSnapshotDate(detail.recaptureDate) : undefined,
              detail.arrondissement ?? 'Paris',
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <SymbolView name="arrow.right" size={13} tintColor={Palette.parisBlue} />
        </View>
      </View>
    </Pressable>
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
        </SafeAreaView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Derniers avant/après</Text>
          <SymbolView name="arrow.left.and.right" size={18} tintColor={Palette.parisBlue} />
        </View>

        {/* La comparaison avant/après est le sujet même de l'app : elle occupe le haut de la
            liste à fond perdu, sans carte blanche autour. */}
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
          <View style={styles.feedEmpty}>
            <SymbolView name="photo.on.rectangle.angled" size={24} tintColor={Palette.inkSoft} />
            <Text style={styles.loadingTitle}>Aucune photo refaite pour l’instant</Text>
            <Text style={styles.loadingCopy}>
              Les comparaisons avant/après apparaîtront ici dès qu’une photo sera publiée.
            </Text>
          </View>
        )}

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
            {stats.topContributors.slice(0, 3).map((contributor) => {
              const displayName = formatContributorName(contributor.name);
              return (
                <Pressable
                  key={contributor.name}
                  accessibilityLabel={`Voir le profil de ${displayName}, ${contributor.count} photos`}
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
                  <Text style={styles.contributorInitials}>{initialsFor(displayName)}</Text>
                  <Text style={styles.contributorName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.contributorCount}>{contributor.count}</Text>
                  <SymbolView name="chevron.right" size={11} tintColor={Palette.inkSoft} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos à retrouver</Text>
          <SymbolView name="scope" size={18} tintColor={Palette.parisBlue} />
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
  },
  brandRow: {
    minHeight: 62,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    ...Typography.title,
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  brandSub: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  eyebrow: {
    ...Typography.caption,
    marginTop: Spacing.three,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    ...Typography.display,
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  // Un seul palier d'espacement sépare l'accroche de la section suivante — ce qui sépare
  // respire (Spacing.five), pas deux paddings qui s'additionnent (voir direction-visuelle.md).
  sectionHeader: {
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  // La comparaison va à fond perdu : pas de carte blanche, pas de marge horizontale, pas de coin
  // arrondi puisqu'elle touche les deux bords de l'écran.
  activityCard: {
    marginBottom: Spacing.four,
  },
  activityCardPressed: {
    opacity: 0.92,
  },
  activityBody: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.twoHalf,
  },
  activityTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  activityMetaRow: {
    marginTop: Spacing.half,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  activityMeta: {
    ...Typography.body,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  feedEmpty: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.four,
    alignItems: 'center',
  },
  loadingTitle: {
    ...Typography.title,
    marginTop: Spacing.three,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  loadingCopy: {
    ...Typography.body,
    marginTop: Spacing.one,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    textAlign: 'center',
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
    ...Typography.title,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '900',
  },
  statLabel: {
    ...Typography.caption,
    marginTop: Spacing.half,
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
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
    ...Typography.caption,
    flex: 1,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
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
    gap: Spacing.one,
  },
  contributorsActionText: {
    ...Typography.body,
    color: Palette.parisBlue,
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
    ...Typography.body,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.blueMist,
    color: Palette.parisBlue,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 32,
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
    fontWeight: '800',
  },
  // Bord à bord : le rail de vignettes n'a pas de marge de page, seul le texte des têtes de
  // section en garde une.
  missionRail: {
    gap: Spacing.three,
    paddingBottom: Spacing.one,
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
    ...Typography.title,
    marginTop: Spacing.one,
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '900',
  },
  suggestionCountLabel: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  walkBody: {
    padding: Spacing.three,
  },

  walkKicker: {
    ...Typography.caption,
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  walkTitle: {
    ...Typography.title,
    marginTop: Spacing.two,
    color: Palette.white,
    fontFamily: Fonts.display,
  },
  walkCopy: {
    ...Typography.body,
    marginTop: Spacing.two,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
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
    ...Typography.body,
    color: Palette.white,
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
    ...Typography.caption,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.985 }],
  },
});
