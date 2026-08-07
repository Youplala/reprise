import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
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
import { Fonts, Palette, Radius, Shadow, Spacing, TabBarClearance } from '@/constants/theme';

import { useUserLocation } from '@/hooks/use-user-location';
import { useFeaturedMission, useStations } from '@/providers/stations-provider';


import { distanceInMeters, formatDistance } from '@/utils/distance';

const STEPS = [
  ['01', 'Choisir', 'Une photo de 1970 près de vous.'],
  ['02', 'Aligner', 'La caméra superpose la photo d’archive.'],
  ['03', 'Publier', 'Votre photo rejoint la carte.'],
] as const;

export function HomeScreen() {
  const router = useRouter();
  const { stations, snapshotVersion, coverage, stats } = useStations();
  const { coordinate, isPrecise, loading: locating, locate } = useUserLocation();
  const [refreshing, setRefreshing] = useState(false);

  // Mission mise en avant : le point de vue de 2022 le plus proche, encore à reconduire.
  const featured = useFeaturedMission(isPrecise ? coordinate : undefined);

  const nearby = useMemo(
    () =>
      stations
        .filter(
          (station) =>
            station.kind === 'archive-1970' &&
            (station.remainingCount ?? station.frameCount ?? 0) > 0,
        )
        .map((station) => ({ station, distance: distanceInMeters(coordinate, station.coordinate) }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 3),
    [coordinate, stations],
  );

  const featuredDistance = featured ? distanceInMeters(coordinate, featured.coordinate) : 0;
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

  // Les repères sont embarqués : ce qui mérite d'être rafraîchi ici, c'est la position.
  const handleRefresh = async () => {
    setRefreshing(true);
    await locate();
    setRefreshing(false);
  };

  const openFeatured = () => {
    if (!featured) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    router.push({ pathname: '/station/[id]', params: { id: featured.id } });
  };

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
            <View>
              <Text style={styles.brand}>REPRISE</Text>
              <Text style={styles.brandSub}>Observatoire mobile de Paris</Text>
            </View>
            <Pressable
              accessibilityLabel="Utiliser ma position"
              accessibilityRole="button"
              onPress={handleLocate}
              style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
              <SymbolView
                name={isPrecise ? 'location.fill' : 'location'}
                size={21}
                tintColor={Palette.parisBlue}
              />
            </Pressable>
          </View>

          <View>
            <Text style={styles.eyebrow}>
              {isPrecise ? 'AUTOUR DE VOUS' : 'PARIS · 30 087 PHOTOS DE 1970'}
            </Text>
            <Text style={styles.heroTitle}>Retrouvez Paris, photo après photo.</Text>
            <Text style={styles.heroCopy}>
              Choisissez une photo de 1970, retrouvez où elle a été prise, puis refaites le même
              cadrage aujourd’hui.
            </Text>
          </View>
        </SafeAreaView>

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

        <Animated.View entering={FadeInDown.delay(140).duration(420)}>
          <Pressable
            accessibilityRole="button"
            onPress={openFeatured}
            style={({ pressed }) => [styles.featured, pressed && styles.featuredPressed]}>
            <Image
              source={featured?.previewImage}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
            />
            <View style={styles.featuredShade} />
            <View style={styles.featuredTop}>
              <SourcePill label="Photo à refaire" inverse />
            </View>
            <View style={styles.featuredBottom}>
              <Text style={styles.featuredKicker}>
                {featured?.author ? `${featured.author.toLocaleUpperCase('fr-FR')} · ` : ''}
                {featured?.year ?? 2022}
              </Text>
              <Text style={styles.featuredTitle} numberOfLines={2}>
                {featured?.name ?? 'Une photo à refaire'}
              </Text>
              <View style={styles.featuredMeta}>
                <View style={styles.featuredMetaItem}>
                  <SymbolView name="camera.viewfinder" size={15} tintColor={Palette.blueMist} />
                  <Text style={styles.featuredMetaText}>Refaire cette photo</Text>
                </View>
                <Text style={styles.featuredDistance}>
                  {isPrecise
                    ? formatDistance(featuredDistance)
                    : featured?.arrondissement
                      ? `Paris ${Number(featured.arrondissement.slice(3))}e`
                      : 'Paris'}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionKicker}>
              ARCHIVES DE 1970
            </Text>
            <Text style={styles.sectionTitle}>Photos près de vous</Text>
            <Text style={styles.sectionCopy}>
              Choisissez un secteur, puis une photo à retrouver.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Haptics.selectionAsync();
              router.push('/map');
            }}
            style={({ pressed }) => [styles.seeAll, pressed && styles.pressedSoft]}>
            <Text style={styles.seeAllText}>Carte</Text>
            <SymbolView name="arrow.right" size={13} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>

        <View style={styles.cardList}>
          {nearby.map(({ station, distance }) => (
            <StationCard key={station.id} station={station} distance={distance} wide />
          ))}
        </View>

        <View style={styles.protocol}>
          <Text style={styles.protocolKicker}>COMMENT ÇA MARCHE</Text>
          {STEPS.map(([number, title, copy], index) => (
            <View
              key={number}
              style={[styles.protocolRow, index === STEPS.length - 1 && styles.protocolRowLast]}>
              <Text style={styles.protocolNumber}>{number}</Text>
              <View style={styles.protocolText}>
                <Text style={styles.protocolTitle}>{title}</Text>
                <Text style={styles.protocolCopy}>{copy}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.dataNote}>
          <SourcePill version={snapshotVersion} />
          <Text style={styles.dataCopy}>
            Photos de 1970 conservées par la Bibliothèque historique de la Ville de Paris. Carte et
            photos actuelles publiées par l’Observatoire photo participatif des paysages parisiens, animé
            par le CAUE de Paris.
          </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 2.5,
  },
  brandSub: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 11,
    marginTop: -2,
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
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  pressedSoft: {
    opacity: 0.6,
  },
  eyebrow: {
    marginTop: Spacing.three,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: Spacing.two,
    marginHorizontal: -2,
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 5,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.2,
  },
  heroCopy: {
    marginTop: Spacing.twoHalf,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 340,
  },
  pulseWrapper: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
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
    gap: 2,
  },
  pulseValue: {
    color: Palette.parisBlue,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 26,
    textAlign: 'center',
  },
  pulseLabel: {
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
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
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
  },
  featured: {
    // Calée pour que la carte tienne entièrement au-dessus de la barre d'onglets au premier
    // affichage : son titre est l'appel à l'action, il ne doit pas arriver tronqué.
    height: 316,
    marginHorizontal: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueDeep,
    ...Shadow.card,
  },
  featuredPressed: {
    transform: [{ scale: 0.99 }],
  },
  featuredShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(8, 17, 22, 0.2)',
  },
  featuredTop: {
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredBottom: {
    marginTop: 'auto',
    padding: Spacing.threeHalf,
    backgroundColor: 'rgba(8, 17, 22, 0.78)',
  },
  featuredKicker: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  featuredTitle: {
    marginTop: 7,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 30,
    lineHeight: 32,
    maxWidth: 300,
  },
  featuredMeta: {
    marginTop: Spacing.twoHalf,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  featuredMetaText: {
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  featuredDistance: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionHeading: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  sectionKicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  sectionTitle: {
    marginTop: 5,
    marginHorizontal: -2,
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 4,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  sectionCopy: {
    marginTop: 5,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  seeAll: {
    minHeight: 44,
    paddingLeft: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  seeAllText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    fontSize: 14,
  },
  cardList: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  protocol: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
    backgroundColor: Palette.parisBlue,
    borderRadius: Radius.large,
  },
  protocolKicker: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  protocolRow: {
    paddingVertical: Spacing.twoHalf,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  protocolRowLast: {
    borderBottomWidth: 0,
  },
  protocolNumber: {
    color: Palette.brass,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    fontSize: 14,
  },
  protocolText: {
    flex: 1,
  },
  protocolTitle: {
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '800',
    fontSize: 20,
  },
  protocolCopy: {
    marginTop: 2,
    color: Palette.blueMist,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  dataNote: {
    margin: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  dataCopy: {
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  privacyLink: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  privacyLinkText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 13,
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
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
    fontSize: 13,
  },
});
