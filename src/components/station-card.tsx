import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { ArchiveContactSheet } from '@/components/archive-contact-sheet';
import { Fonts, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { arrondissementLabel } from '@/utils/place-name';
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
  // Une carte de secteur nomme un arrondissement, jamais son numéro interne : « Secteur 794 » ne
  // situe rien, pour l'œil comme pour un lecteur d'écran.
  const archiveTitle = arrondissementLabel(station.arrondissement) ?? `Secteur ${station.name}`;

  return (
    <Link href={{ pathname: '/station/[id]', params: { id: station.id } }} asChild>
      <Pressable
        accessibilityLabel={
          isArchive ? `Explorer ${archiveTitle}, ${photoLabel}` : `Ouvrir ${station.name}`
        }
        style={({ pressed }) => [
          wide ? styles.wideRoot : compact ? styles.compactRoot : styles.regularRoot,
          pressed && styles.pressed,
        ]}>
        <View style={[styles.imageWrap, wide ? styles.wideImageWrap : styles.tileImageWrap]}>
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

        <View style={wide ? styles.captionWide : styles.captionTile}>
          <Text style={styles.distanceLabel}>{distanceLabel.toLocaleUpperCase('fr-FR')}</Text>
          <Text style={styles.title} numberOfLines={wide ? 1 : 2}>
            {isArchive ? archiveTitle : station.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>
              {isArchive ? photoLabel : station.arrondissement ?? 'Paris'}
            </Text>
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
  // Une vignette de rail (compact/regular) reste un objet contenu : elle ne touche jamais les deux
  // bords de l'écran à la fois, elle garde donc un léger galbe. La carte « wide » occupe toute la
  // largeur : son image part à fond perdu, sans coin arrondi ni carte blanche autour.
  wideRoot: {
    width: '100%',
  },
  regularRoot: {
    width: 250,
  },
  compactRoot: {
    width: 212,
  },
  imageWrap: {
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  wideImageWrap: {
    height: 240,
  },
  tileImageWrap: {
    height: 150,
    borderRadius: Radius.medium,
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
    ...Typography.caption,
    color: Palette.parisBlue,
    fontFamily: Fonts.mono,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countBadge: {
    position: 'absolute',
    left: Spacing.twoHalf,
    top: Spacing.twoHalf,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  countBadgeText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // La légende se pose directement sur le fond de l'écran : pas de carte, pas de fond blanc.
  // L'image « wide » va à fond perdu, mais le texte garde le padding de page du reste de l'écran.
  captionWide: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.twoHalf,
  },
  captionTile: {
    paddingTop: Spacing.two,
  },
  distanceLabel: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.mono,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  title: {
    ...Typography.title,
    marginTop: Spacing.half,
    color: Palette.ink,
    fontFamily: Fonts.display,
  },
  metaRow: {
    marginTop: Spacing.one,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  meta: {
    ...Typography.body,
    flex: 1,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionText: {
    ...Typography.body,
    color: Palette.parisBlue,
    fontFamily: Fonts.sans,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
});
