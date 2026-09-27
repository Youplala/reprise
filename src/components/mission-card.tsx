import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ArchiveContactSheet } from '@/components/archive-contact-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import {
  Fonts,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Typography,
} from '@/constants/theme';
import { useBhvpImages } from '@/hooks/use-bhvp-images';
import { useStationDetail } from '@/hooks/use-station-detail';
import type { StationSummary } from '@/types/station';
import { formatDistance } from '@/utils/distance';
import { arrondissementLabel } from '@/utils/place-name';

type MissionCardProps = {
  station: StationSummary;
  distance?: number;
};

/**
 * Le secteur de 1970 le plus proche, présenté comme la mission du moment : où, combien de
 * photos restent à refaire, et une seule action pour y aller.
 */
export function MissionCard({ station, distance }: MissionCardProps) {
  const router = useRouter();
  const { detail } = useStationDetail(station.id);
  const { images } = useBhvpImages(detail?.archiveLinks, 3);

  const total = station.frameCount ?? images.length;
  const remaining = station.remainingCount ?? total;
  const done = Math.max(0, station.publishedCount ?? total - remaining);
  const percentage = total > 0 ? (done / total) * 100 : 0;
  const title = arrondissementLabel(station.arrondissement) ?? `Secteur ${station.name}`;
  const where =
    distance !== undefined
      ? `${station.approximate ? 'À environ ' : 'À '}${formatDistance(distance)}`
      : 'Zone de 250 m';

  const open = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/station/[id]', params: { id: station.id } });
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`Voir les photos de 1970 de ${title}`}
        onPress={open}
        style={({ pressed }) => [styles.media, pressed && styles.pressed]}>
        {images.length ? <ArchiveContactSheet images={images} /> : null}
        <View style={styles.badge}>
          <SymbolView name="location.fill" size={11} tintColor={Palette.white} />
          <Text style={styles.badgeText}>{where}</Text>
        </View>
      </Pressable>

      <View style={styles.body}>
        <Text style={styles.kicker}>Mission du jour</Text>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.count}>
            <Text style={styles.countStrong}>{done}</Text> / {total} photos refaites
          </Text>
          <Text style={styles.remaining}>
            {remaining > 0 ? `${remaining} à retrouver` : 'Secteur terminé'}
          </Text>
        </View>
        <ProgressBar percentage={percentage} />

        <PrimaryButton label="C’est parti" icon="arrow.right" onPress={open} style={styles.cta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    ...Shadow.card,
  },
  media: {
    height: 210,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    overflow: 'hidden',
    backgroundColor: Palette.blueMist,
  },
  pressed: {
    opacity: 0.88,
  },
  badge: {
    position: 'absolute',
    left: Spacing.twoHalf,
    top: Spacing.twoHalf,
    minHeight: 28,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8, 17, 22, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  badgeText: {
    ...Typography.caption,
    color: Palette.white,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  body: {
    padding: Spacing.three,
    paddingTop: Spacing.threeHalf,
    gap: Spacing.two,
  },
  kicker: {
    ...Kicker,
    color: Palette.go,
  },
  title: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  progressRow: {
    marginTop: Spacing.one,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  count: {
    ...Typography.body,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  countStrong: {
    color: Palette.ink,
    fontWeight: '800',
  },
  remaining: {
    ...Typography.caption,
    color: Palette.go,
    fontFamily: Fonts.sans,
    fontWeight: '700',
  },
  cta: {
    marginTop: Spacing.two,
  },
});
