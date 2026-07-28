import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdaptivePhoto } from '@/components/adaptive-photo';
import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
import { useStationDetail } from '@/hooks/use-station-detail';
import type { StationSummary } from '@/types/station';
import { formatDistance } from '@/utils/distance';

type StationCardProps = {
  station: StationSummary;
  distance?: number;
  compact?: boolean;
};

export function StationCard({ station, distance, compact = false }: StationCardProps) {
  const { detail } = useStationDetail(station.id);
  const image = detail?.images[0] ?? station.previewImage;

  return (
    <Link href={{ pathname: '/station/[id]', params: { id: station.id } }} asChild>
      <Pressable
        accessibilityLabel={`Ouvrir ${station.name}`}
        style={({ pressed }) => [
          styles.card,
          compact ? styles.compactCard : styles.regularCard,
          pressed && styles.pressed,
        ]}>
        <View style={styles.imageWrap}>
          {image ? (
            <AdaptivePhoto source={image} style={StyleSheet.absoluteFill} transition={250} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderYear}>{station.year}</Text>
              <View style={styles.placeholderLine} />
              <SymbolView name="camera.aperture" size={24} tintColor={Palette.parisBlue} />
            </View>
          )}
          <View style={styles.imageShade} />
          <View style={styles.yearBadge}>
            <Text style={styles.yearBadgeText}>{station.year}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>
            {station.approximate ? 'À LOCALISER' : 'POINT PRÉCIS'}
            {distance !== undefined ? ` · ${formatDistance(distance)}` : ''}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {station.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {station.arrondissement ? `${station.arrondissement.replace('750', '')}e` : 'Paris'}
            </Text>
            <SymbolView name="arrow.up.right" size={13} tintColor={Palette.parisBlue} />
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
  imageWrap: {
    height: 145,
    backgroundColor: Palette.blueMist,
    overflow: 'hidden',
  },
  imageShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(13, 42, 60, 0.08)',
  },
  placeholder: {
    flex: 1,
    padding: Spacing.three,
    justifyContent: 'space-between',
    backgroundColor: Palette.blueMist,
  },
  placeholderYear: {
    fontFamily: Fonts.display,
    fontSize: 42,
    color: Palette.parisBlue,
    fontWeight: '800',
  },
  placeholderLine: {
    height: 1,
    backgroundColor: Palette.parisBlue,
    opacity: 0.18,
  },
  yearBadge: {
    position: 'absolute',
    left: Spacing.twoHalf,
    top: Spacing.twoHalf,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  yearBadgeText: {
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
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
});
