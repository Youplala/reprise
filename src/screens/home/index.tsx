import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MissionCard } from '@/components/mission-card';
import { ProgressBar } from '@/components/progress-bar';
import { SourcePill } from '@/components/source-pill';
import { StationCard } from '@/components/station-card';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import {
  Fonts,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  TabBarClearance,
  Typography,
} from '@/constants/theme';

import { useUserLocation } from '@/hooks/use-user-location';
import { useStations } from '@/providers/stations-provider';

import { distanceInMeters, formatDistance } from '@/utils/distance';
import { nearestArrondissement } from '@/utils/place-name';
import { PARIS_CENTER } from '@/data/archive';
import { HOME_LOCATION_CONTENT, classifyLocationContext } from '@/services/location-context';

export function HomeScreen() {
  const router = useRouter();
  const { stations, snapshotVersion, coverage, stats, refresh, refreshing, syncError } =
    useStations();
  const { coordinate, isPrecise, loading: locating, locate } = useUserLocation({
    autoLocate: true,
  });
  const locationContext = classifyLocationContext({ coordinate, isPrecise });
  const locationContent = HOME_LOCATION_CONTENT[locationContext];
  const proximityOrigin = locationContext === 'in-paris' ? coordinate : PARIS_CENTER;


  // La campagne porte sur les archives de 1970, classées par proximité.
  const nearby = useMemo(
    () =>
      stations
        .filter(
          (station) =>
            station.kind === 'archive-1970' &&
            (station.remainingCount ?? station.frameCount ?? 0) > 0,
        )
        .map((station) => ({
          station,
          distance: distanceInMeters(proximityOrigin, station.coordinate),
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 5)
        // « Secteur 794 » ne situe rien : on emprunte l'arrondissement du repère localisé le plus
        // proche, comme la carte, pour que les deux écrans nomment un lieu de la même façon.
        .map(({ station, distance }) => ({
          station: {
            ...station,
            arrondissement:
              station.arrondissement ?? nearestArrondissement(station.coordinate, stations),
          },
          distance,
        })),
    [proximityOrigin, stations],
  );

  const [mission, ...others] = nearby;
  const lastMonth = stats.monthlyActivity[stats.monthlyActivity.length - 1];
  const percentageLabel = coverage.percentage.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  });

  const handleLocate = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextCoordinate = await locate();
    if (nextCoordinate) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Position non disponible',
      'Autorisez la localisation pour voir les photos de 1970 prises autour de vous.',
    );
  };

  const handleRefresh = refresh;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Palette.parisBlue}
          />
        }
        contentContainerStyle={styles.scrollContent}>
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.brandRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>Paris GO</Text>
              {locationContext === 'in-paris' ? (
                <Text accessibilityRole="header" style={styles.brand}>Autour de moi</Text>
              ) : (
                <Text accessibilityRole="header" style={styles.brand}>Explorer Paris</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Ouvrir le carnet"
                accessibilityRole="button"
                onPress={() => router.push('/fieldbook')}
                style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
                <SymbolView name="book.closed.fill" size={20} tintColor={Palette.parisBlue} />
              </Pressable>
              <Pressable
                accessibilityLabel="Utiliser ma position"
                accessibilityRole="button"
                accessibilityState={{ busy: locating, disabled: locating }}
                disabled={locating}
                onPress={handleLocate}
                style={({ pressed }) => [
                  styles.locationButton,
                  locating && styles.locationButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={isPrecise ? 'location.fill' : 'location'}
                  size={21}
                  tintColor={Palette.parisBlue}
                />
              </Pressable>
            </View>
          </View>

          {/* Loin de Paris, les distances ne veulent plus rien dire : on le dit, puis on propose
              le centre de Paris comme point de départ plutôt qu'une liste vide. */}
          {locationContext === 'outside-paris' && coordinate ? (
            <View style={styles.outsideNotice}>
              <SymbolView name="location.slash.fill" size={16} tintColor={Palette.go} />
              <Text style={styles.outsideNoticeText}>
                Vous êtes à {formatDistance(distanceInMeters(coordinate, PARIS_CENTER))} de Paris.
                Voici par où commencer au centre.
              </Text>
            </View>
          ) : null}

          {/* La progression collective : ce que la campagne a déjà refait de Paris. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Paris refait à ${percentageLabel} %. Voir où en est la carte`}
            onPress={() => {
              void Haptics.selectionAsync();
              router.push('/coverage');
            }}
            style={({ pressed }) => [styles.progress, pressed && styles.pressedSoft]}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>Paris refait à</Text>
              <View style={styles.progressValueRow}>
                <Text style={styles.progressValue}>{percentageLabel} %</Text>
                <SymbolView name="chevron.right" size={13} tintColor={Palette.inkSoft} />
              </View>
            </View>
            <ProgressBar percentage={coverage.percentage} height={10} />
            <View style={styles.progressStats}>
              <Text style={styles.progressStat}>
                <Text style={styles.progressStatStrong}>{coverage.published1970.toLocaleString('fr-FR')}</Text>{' '}
                photos refaites
              </Text>
              <Text style={styles.progressStat}>
                <Text style={styles.progressStatStrong}>{stats.contributorCount.toLocaleString('fr-FR')}</Text>{' '}
                explorateurs
              </Text>
              <Text style={styles.progressStat}>
                <Text style={styles.progressStatStrong}>{coverage.squaresOpened.toLocaleString('fr-FR')}</Text>{' '}
                secteurs ouverts
              </Text>
            </View>
          </Pressable>
        </SafeAreaView>

        {mission ? (
          <Animated.View entering={FadeInDown.delay(60).duration(420)}>
            <MissionCard
              station={mission.station}
              distance={locationContent.showDistances ? mission.distance : undefined}
            />
          </Animated.View>
        ) : null}

        {others.length ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {locationContext === 'in-paris' ? 'Autres secteurs proches' : 'Autres secteurs à explorer'}
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/map')}
                style={({ pressed }) => [styles.sectionLink, pressed && styles.pressedSoft]}>
                <Text style={styles.sectionLinkText}>Carte</Text>
                <SymbolView name="chevron.right" size={12} tintColor={Palette.go} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}>
              {others.map(({ station, distance }) => (
                <StationCard
                  key={station.id}
                  station={station}
                  distance={locationContent.showDistances ? distance : undefined}
                />
              ))}
            </ScrollView>
            <Text style={styles.activity}>
              {stats.recapturesLast30Days > 0
                ? `${stats.recapturesLast30Days} photos publiées ces 30 derniers jours`
                : `${lastMonth?.count ?? 0} photos publiées en ${lastMonth?.label ?? ''}`}
            </Text>
          </View>
        ) : null}

        <View style={styles.dataNote}>
          <SourcePill version={snapshotVersion} />
          <Text style={styles.dataCopy}>
            Photos de 1970 conservées par la Bibliothèque historique de la Ville de Paris. Carte et
            photos actuelles publiées par l’Observatoire photo participatif des paysages parisiens, animé
            par le CAUE de Paris.
          </Text>
          {syncError ? (
            <Text accessibilityLiveRegion="polite" style={styles.dataError}>
              Mise à jour impossible pour le moment — données disponibles hors connexion.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            style={({ pressed }) => [styles.privacyLink, pressed && styles.pressedSoft]}>
            <Text style={styles.privacyLinkText}>Politique de confidentialité</Text>
            <SymbolView name="arrow.up.right" size={12} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>
      </ScrollView>

      {locating ? (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.locatingToast}>
          <Text style={styles.locatingText}>Recherche de votre position…</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  scrollContent: {
    paddingBottom: TabBarClearance,
  },
  safeHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  brandRow: {
    minHeight: 62,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  kicker: {
    ...Kicker,
    color: Palette.go,
  },
  brand: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  locationButtonDisabled: {
    opacity: 0.58,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  pressedSoft: {
    opacity: 0.6,
  },
  outsideNotice: {
    marginTop: Spacing.twoHalf,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoHalf,
    borderRadius: Radius.medium,
    backgroundColor: Palette.goSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  outsideNoticeText: {
    ...Typography.caption,
    flex: 1,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  progress: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  progressLabel: {
    ...Typography.body,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  progressValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  progressValue: {
    ...Typography.title,
    color: Palette.go,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.half,
  },
  progressStat: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  progressStatStrong: {
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '800',
  },
  section: {
    marginTop: Spacing.five,
    gap: Spacing.twoHalf,
  },
  sectionHead: {
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  sectionLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sectionLinkText: {
    ...Typography.body,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  rail: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.twoHalf,
  },
  activity: {
    ...Typography.caption,
    paddingHorizontal: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  dataNote: {
    margin: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  dataCopy: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  dataError: {
    ...Typography.body,
    color: Palette.danger,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  privacyLink: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  privacyLinkText: {
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  locatingToast: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: 104,
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locatingText: {
    ...Typography.body,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
});
