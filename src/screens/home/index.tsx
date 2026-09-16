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

import { AnimatedNumber } from '@/components/charts/animated-number';
import { GlassSurface } from '@/components/glass-surface';
import { SourcePill } from '@/components/source-pill';
import { StationCard } from '@/components/station-card';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import {
  Fonts,
  Palette,
  Radius,
  Shadow,
  Spacing,
  TabBarClearance,
  Typography,
} from '@/constants/theme';

import { useUserLocation } from '@/hooks/use-user-location';
import { useStations } from '@/providers/stations-provider';

import { distanceInMeters } from '@/utils/distance';
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
        .slice(0, 3)
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

  const lastMonth = stats.monthlyActivity[stats.monthlyActivity.length - 1];

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
            <Text accessibilityRole="header" style={styles.brand}>Autour de moi</Text>
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

        </SafeAreaView>

        {/* Les archives de 1970, avec leurs photos à fond perdu. */}
        <View style={styles.cardList}>
          {nearby.map(({ station, distance }) => (
            <StationCard key={station.id} station={station} distance={locationContent.showDistances ? distance : undefined} wide />
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.pulseWrapper}>
          <View style={styles.pulse}>
            <GlassSurface variant="regular" style={styles.pulseGlass} />
            <View style={styles.pulseRow}>
              <View style={styles.pulseItem}>
                <AnimatedNumber value={coverage.published1970} style={styles.pulseValue} />
                <Text style={styles.pulseLabel}>photos refaites</Text>
              </View>
              <View style={styles.pulseDivider} />
              <View style={styles.pulseItem}>
                <AnimatedNumber value={stats.contributorCount} style={styles.pulseValue} />
                <Text style={styles.pulseLabel}>contributeurs</Text>
              </View>
              <View style={styles.pulseDivider} />
              <View style={styles.pulseItem}>
                <AnimatedNumber value={coverage.squaresOpened} style={styles.pulseValue} />
                <Text style={styles.pulseLabel}>secteurs ouverts</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void Haptics.selectionAsync();
                router.push('/coverage');
              }}
              style={({ pressed }) => [styles.pulseFooter, pressed && styles.pressedSoft]}>
              <Text style={styles.pulseFooterText}>
                {stats.recapturesLast30Days > 0
                  ? `${stats.recapturesLast30Days} photos publiées ces 30 derniers jours`
                  : `${lastMonth?.count ?? 0} photos publiées en ${lastMonth?.label ?? ''}`}
              </Text>
              <SymbolView name="chevron.right" size={13} tintColor={Palette.parisBlue} />
            </Pressable>
          </View>
        </Animated.View>

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
    paddingBottom: Spacing.two,
  },
  brandRow: {
    minHeight: 62,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brand: {
    ...Typography.title,
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '900',
    fontSize: 28,
    lineHeight: 34,
    flex: 1,
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
  pulseWrapper: {
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.five,
  },
  pulse: {
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  pulseGlass: {
    borderRadius: Radius.large,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.twoHalf,
  },
  pulseItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  pulseValue: {
    ...Typography.title,
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '800',
    textAlign: 'center',
  },
  pulseLabel: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  pulseDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: Spacing.one,
    backgroundColor: 'rgba(22, 63, 91, 0.16)',
  },
  pulseFooter: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(22, 63, 91, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pulseFooterText: {
    ...Typography.body,
    flex: 1,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  // Bord à bord : ni marge horizontale ni carte blanche autour des photos, qui sont le sujet.
  cardList: {
    backgroundColor: Palette.fog,
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
