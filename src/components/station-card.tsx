import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { ArchiveContactSheet } from '@/components/archive-contact-sheet';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import type { StationSummary } from '@/types/station';
import { formatDistance } from '@/utils/distance';

type StationCardProps = {
  station: StationSummary;
  distance?: number;
  compact?: boolean;
  wide?: boolean;
};

export function StationCard({
  station,
  distance,
  compact = false,
  wide = false,
}: StationCardProps) {
  const { detail } = useStationDetail(station.id);
  const image = detail?.images[0] ?? station.previewImage;
  const isArchive = station.kind === 'archive-1970';
  const { images: archiveImages, loading: previewsLoading } = useBhvpImages(
    isArchive ? detail?.archiveLinks : undefined,
    3,
  );
  const photoCount = station.frameCount ?? archiveImages.length;
  const remainingCount = station.remainingCount ?? photoCount;
  const photoLabel =
    remainingCount === 0
      ? 'Toutes les photos ont été refaites'
      : `${remainingCount} ${remainingCount > 1 ? 'photos' : 'photo'} à retrouver`;
  const distanceLabel =
    distance !== undefined
      ? `${station.approximate ? 'À environ ' : 'À '}${formatDistance(distance)}`
      : station.approximate
        ? 'Zone de 250 m'
        : 'Point précis';

  return (
    <Link href={{ pathname: '/station/[id]', params: { id: station.id } }} asChild>
      <Pressable
        accessibilityLabel={
          isArchive
            ? `Explorer le secteur ${station.name}, ${photoLabel}`
            : `Ouvrir ${station.name}`
        }
        style={({ pressed }) => [
          styles.card,
          wide ? styles.wideCard : compact ? styles.compactCard : styles.regularCard,
          pressed && styles.pressed,
        ]}>
        <View style={[styles.imageWrap, wide && styles.wideImageWrap]}>
          {isArchive && archiveImages.length ? (
            <ArchiveContactSheet images={archiveImages} />
          ) : image ? (
            <AdaptivePhoto source={image} style={StyleSheet.absoluteFill} transition={250} />
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderGrid}>
                <View style={styles.placeholderGridLineVertical} />
                <View style={styles.placeholderGridLineHorizontal} />
                <View style={styles.placeholderTarget}>
                  <SymbolView name="photo.stack" size={24} tintColor={Palette.parisBlue} />
                </View>
              </View>
              <Text style={styles.placeholderCopy}>
                {previewsLoading ? 'CHARGEMENT DES APERÇUS' : 'PHOTOS CONSERVÉES À LA BHVP'}
              </Text>
            </View>
          )}
          <View style={styles.imageShade} />
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {isArchive ? `${photoCount} ${photoCount > 1 ? 'PHOTOS' : 'PHOTO'}` : station.year}
            </Text>
          </View>
        </View>

        <View style={[styles.body, wide && styles.wideBody]}>
          <Text style={styles.kicker}>{distanceLabel.toLocaleUpperCase('fr-FR')}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {isArchive ? `Secteur ${station.name}` : station.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{isArchive ? photoLabel : station.arrondissement ?? 'Paris'}</Text>
            <View style={styles.action}>
              {wide ? <Text style={styles.actionText}>Explorer</Text> : null}
              <SymbolView name="arrow.right" size={13} tintColor={Palette.parisBlue} />
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white,
    borderRadius: Radius.large,
    overflow: 'hidden',
    ...Shadow.card,
  },
  regularCard: {
    width: 250,
  },
  compactCard: {
    width: 212,
  },
  wideCard: {
    width: '100%',
  },
  imageWrap: {
    height: 145,
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  wideImageWrap: {
    height: 190,
  },
  imageShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(13, 42, 60, 0.08)',
  },
  placeholder: {
    flex: 1,
    padding: Spacing.twoHalf,
    justifyContent: 'flex-end',
    backgroundColor: Palette.blueMist,
  },
  placeholderGrid: {
    position: 'absolute',
    inset: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(22, 63, 91, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderGridLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(22, 63, 91, 0.12)',
  },
  placeholderGridLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(22, 63, 91, 0.12)',
  },
  placeholderTarget: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCopy: {
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countBadge: {
    position: 'absolute',
    left: Spacing.twoHalf,
    top: Spacing.twoHalf,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  countBadgeText: {
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  body: {
    padding: Spacing.three,
    minHeight: 136,
  },
  wideBody: {
    minHeight: 124,
  },
  kicker: {
    color: Palette.copper,
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 7,
  },
  title: {
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 25,
  },
  metaRow: {
    marginTop: 'auto',
    paddingTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
});
