import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { SourcePill } from '@/components/source-pill';
import { Fonts, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import { useStations } from '@/providers/stations-provider';
import type { StationDetail } from '@/types/station';
import {
  contributorKey,
  formatContributorName,
} from '@/utils/community-stats';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Initiales lisibles pour l'avatar, calculées sur le nom déjà réduit par `formatContributorName`. */
function initialsFor(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .filter((part) => !['de', 'du', 'des', 'le', 'la'].includes(part.toLocaleLowerCase('fr-FR')))
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr-FR'))
    .join('');
}

function arrondissementLabel(value?: string) {
  if (!value || !/^750\d{2}$/.test(value)) return value ?? 'Paris';
  const number = Number(value.slice(3));
  return `Paris ${number === 1 ? '1er' : `${number}e`}`;
}

function ContributorPhotoCard({
  detail,
  onOpen,
}: {
  detail: StationDetail;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Ouvrir la photo refaite ${detail.name}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.photoCard,
        pressed && styles.photoCardPressed,
      ]}>
      <View style={styles.photoPair}>
        <View style={styles.photoHalf}>
          {detail.referenceImage ? (
            <AdaptivePhoto source={detail.referenceImage} style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={styles.yearBadgeLeft}>
            <Text style={styles.yearBadgeText}>{detail.year}</Text>
          </View>
        </View>
        <View style={styles.photoHalf}>
          {detail.recaptureImage ? (
            <AdaptivePhoto source={detail.recaptureImage} style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={styles.yearBadgeRight}>
            <Text style={styles.yearBadgeText}>2026</Text>
          </View>
        </View>
      </View>
      <View style={styles.photoCaption}>
        <Text style={styles.photoTitle} numberOfLines={2}>
          {detail.name}
        </Text>
        <Text style={styles.photoMeta} numberOfLines={1}>
          {arrondissementLabel(detail.arrondissement)}
        </Text>
      </View>
    </Pressable>
  );
}

export function ContributorScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { stats, snapshotVersion, findContributorSubmissions } = useStations();
  const requestedName = name ?? '';
  const contributorIndex = stats.topContributors.findIndex(
    (contributor) => contributorKey(contributor.name) === contributorKey(requestedName),
  );
  const contributor = stats.topContributors[contributorIndex];
  const displayName = formatContributorName(contributor?.name ?? requestedName);
  const photos = useMemo(
    () => findContributorSubmissions(requestedName),
    [findContributorSubmissions, requestedName],
  );

  const profileStats = useMemo(() => {
    const areaCounts = new Map<string, number>();
    photos.forEach((photo) => {
      const area = arrondissementLabel(photo.arrondissement);
      areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
    });
    const favoriteArea = [...areaCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];
    const latestDate = photos.find((photo) => photo.recaptureDate)?.recaptureDate;
    return {
      areaCount: areaCounts.size,
      favoriteArea,
      latestDate,
    };
  }, [photos]);

  const openPhoto = (detail: StationDetail) => {
    void Haptics.selectionAsync();
    router.push({ pathname: '/station/[id]', params: { id: detail.id } });
  };

  const header = (
    <View>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable
          accessibilityLabel="Retour"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <SymbolView name="chevron.left" size={17} tintColor={Palette.ink} />
        </Pressable>
        <SourcePill version={snapshotVersion} />
      </SafeAreaView>

      <View style={styles.hero}>
        <Text style={styles.kicker}>PORTRAIT DE LA COMMUNAUTÉ</Text>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(displayName)}</Text>
          </View>
          <View style={styles.identityCopy}>
            {contributorIndex >= 0 ? (
              <View style={styles.rankPill}>
                <SymbolView name="trophy.fill" size={12} tintColor={Palette.blueDeep} />
                <Text style={styles.rankPillText}>N° {contributorIndex + 1} DE LA COMMUNAUTÉ</Text>
              </View>
            ) : null}
            <Text style={styles.name}>{displayName || 'Contributeur'}</Text>
          </View>
        </View>
        {photos.length === 0 ? (
          <Text style={styles.intro}>Aucune photo publiée ne correspond encore à ce profil.</Text>
        ) : null}
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{photos.length}</Text>
          <Text style={styles.metricLabel}>PHOTOS</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{profileStats.areaCount}</Text>
          <Text style={styles.metricLabel}>ARRONDISSEMENTS</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {contributorIndex >= 0 ? `#${contributorIndex + 1}` : '—'}
          </Text>
          <Text style={styles.metricLabel}>CLASSEMENT</Text>
        </View>
      </View>

      {profileStats.favoriteArea || profileStats.latestDate ? (
        <View style={styles.insightRow}>
          <SymbolView name="map.fill" size={18} tintColor={Palette.parisBlue} />
          <View style={styles.insightCopy}>
            {profileStats.favoriteArea ? (
              <Text style={styles.insightTitle}>
                {profileStats.favoriteArea[0]} · {profileStats.favoriteArea[1]}{' '}
                {profileStats.favoriteArea[1] > 1 ? 'photos' : 'photo'}
              </Text>
            ) : null}
            {profileStats.latestDate ? (
              <Text style={styles.insightText}>
                Dernière publication le {dateFormat.format(new Date(`${profileStats.latestDate}T12:00:00`))}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.galleryHeader}>
        <Text style={styles.galleryTitle}>Toutes ses photos</Text>
      </View>
    </View>
  );

  // La galerie est un contact-sheet : les vignettes vont bord à bord, sans marge de page.
  return (
    <View style={styles.screen}>
      <FlatList
        data={photos}
        keyExtractor={(photo) => photo.id}
        numColumns={2}
        columnWrapperStyle={styles.photoRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SymbolView name="photo.on.rectangle.angled" size={26} tintColor={Palette.copper} />
            <Text style={styles.emptyTitle}>Aucune photo à afficher</Text>
            <Text style={styles.emptyText}>Revenez au classement pour choisir un autre profil.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ContributorPhotoCard detail={item} onOpen={() => openPhoto(item)} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.fog,
  },
  content: {
    paddingBottom: Spacing.six,
  },
  topBar: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
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
  hero: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  kicker: {
    ...Typography.caption,
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  identityRow: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.parisBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.title,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rankPill: {
    minHeight: 28,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Palette.brass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rankPillText: {
    ...Typography.caption,
    color: Palette.blueDeep,
    fontFamily: Fonts.mono,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  name: {
    ...Typography.display,
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  intro: {
    ...Typography.body,
    marginTop: Spacing.three,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  metrics: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.parisBlue,
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  metricValue: {
    ...Typography.title,
    color: Palette.white,
    fontFamily: Fonts.display,
    fontWeight: '900',
  },
  metricLabel: {
    ...Typography.caption,
    marginTop: Spacing.half,
    color: Palette.blueMist,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.35,
  },
  // Un factoid n'est pas un objet détaché : il vit sur le fond, sans carte autour.
  insightRow: {
    marginTop: Spacing.three,
    marginHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  insightCopy: {
    flex: 1,
  },
  insightTitle: {
    ...Typography.body,
    color: Palette.ink,
    fontWeight: '800',
  },
  insightText: {
    ...Typography.body,
    marginTop: Spacing.half,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  galleryHeader: {
    marginTop: Spacing.five,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  galleryTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  // Mosaïque bord à bord, comme un contact-sheet : pas de marge de page, un simple liseré entre
  // les vignettes.
  photoRow: {
    gap: Spacing.half,
  },
  photoCard: {
    flex: 1,
    marginBottom: Spacing.half,
    overflow: 'hidden',
  },
  photoCardPressed: {
    opacity: 0.8,
  },
  photoPair: {
    height: 150,
    flexDirection: 'row',
    backgroundColor: Palette.archive,
  },
  photoHalf: {
    flex: 1,
    overflow: 'hidden',
  },
  yearBadgeLeft: {
    position: 'absolute',
    left: Spacing.one,
    bottom: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8,17,22,0.72)',
  },
  yearBadgeRight: {
    position: 'absolute',
    right: Spacing.one,
    bottom: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(22,63,91,0.82)',
  },
  yearBadgeText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontWeight: '900',
  },
  photoCaption: {
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  photoTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  photoMeta: {
    ...Typography.body,
    marginTop: Spacing.one,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  empty: {
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  emptyTitle: {
    ...Typography.title,
    marginTop: Spacing.two,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  emptyText: {
    ...Typography.body,
    marginTop: Spacing.one,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
