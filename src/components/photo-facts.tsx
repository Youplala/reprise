import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Kicker, Palette, Radius, Shadow, Spacing, Typography } from '@/constants/theme';
import type { ArchivePhotoMetadata } from '@/data/snapshot';
import { formatContributorName } from '@/utils/community-stats';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatDay(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : dateFormat.format(date);
}

/** « diapositives couleur » → « Diapositive couleur ». */
function formatTechnique(technique: string) {
  const singular = technique.replace(/^diapositives\b/i, 'diapositive');
  return singular.charAt(0).toLocaleUpperCase('fr-FR') + singular.slice(1);
}

/** « 24 x 36 mm (images) ; 50 x 50 mm (cadres) » → « 24 × 36 mm ». */
function formatFrame(dimensions: string) {
  const match = dimensions.match(/(\d+)\s*x\s*(\d+)\s*mm/i);
  return match ? `${match[1]} × ${match[2]} mm` : undefined;
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>
        <SymbolView name={icon} size={15} tintColor={Palette.parisBlue} />
      </View>
      <View style={styles.factBody}>
        <Text style={styles.factLabel}>{label}</Text>
        {typeof children === 'string' ? <Text style={styles.factValue}>{children}</Text> : children}
      </View>
    </View>
  );
}

function Card({
  era,
  tone,
  title,
  children,
}: {
  era: string;
  tone: 'archive' | 'today';
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={[styles.era, tone === 'today' ? styles.eraToday : styles.eraArchive]}>
          <Text style={styles.eraText}>{era}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.facts}>{children}</View>
    </View>
  );
}

type ArchiveFactsProps = {
  year: number;
  metadata?: ArchivePhotoMetadata;
  /** Auteur connu par la fiche de l'Observatoire quand la notice BHVP n'en donne pas. */
  fallbackAuthor?: string;
};

/**
 * La notice de la photo de 1970, lue comme une fiche d'archive : qui, avec quoi, où, et ce que
 * le catalogue en dit. Chaque ligne n'apparaît que si la notice la renseigne.
 */
export function ArchiveFacts({ year, metadata, fallbackAuthor }: ArchiveFactsProps) {
  const author = (metadata?.author ?? fallbackAuthor)?.trim();
  const identified = author && !/non identifi/i.test(author);
  const technique = metadata?.technique ? formatTechnique(metadata.technique) : undefined;
  const frame = metadata?.dimensions ? formatFrame(metadata.dimensions) : undefined;
  const support = [technique, frame].filter(Boolean).join(' · ');
  const locations = metadata?.locations ?? [];
  const notes = metadata?.notes ?? [];

  return (
    <Card era={String(year)} tone="archive" title="La photo d’origine">
      <Fact icon="person.crop.square" label="Photographe">
        <Text style={styles.factValue}>
          {identified ? formatContributorName(author) : 'Photographe non identifié'}
        </Text>
        {metadata?.candidateNumber ? (
          <Text style={styles.factDetail}>
            Candidat n° {metadata.candidateNumber} du concours de {year}
          </Text>
        ) : null}
      </Fact>

      {support ? (
        <Fact icon="film" label="Support">
          {support}
        </Fact>
      ) : null}

      {locations.length ? (
        <Fact icon="signpost.right" label="Rues du reportage">
          <View style={styles.chips}>
            {locations.map((location) => (
              <View key={location} style={styles.chip}>
                <Text style={styles.chipText}>{location}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.factDetail}>
            Le dossier du photographe couvre ces rues, pas forcément cette vue.
          </Text>
        </Fact>
      ) : null}

      {notes.length ? (
        <Fact icon="text.quote" label="Note d’archive">
          <Text style={styles.quote}>« {notes.join(' ').replace(/\s+,/g, ',').trim()} »</Text>
        </Fact>
      ) : null}

      {metadata?.callNumber ? (
        <Fact icon="books.vertical" label="Cote BHVP">
          <Text style={styles.code}>{metadata.callNumber}</Text>
        </Fact>
      ) : null}
    </Card>
  );
}

type RecaptureFactsProps = {
  referenceYear: number;
  author?: string;
  date?: string;
  device?: string;
  address?: string;
  description?: string;
};

/** La reprise d'aujourd'hui : qui l'a faite, quand, avec quoi, et ce qui a changé. */
export function RecaptureFacts({
  referenceYear,
  author,
  date,
  device,
  address,
  description,
}: RecaptureFactsProps) {
  const year = date ? Number(date.slice(0, 4)) : undefined;
  const gap = year && year > referenceYear ? year - referenceYear : undefined;

  return (
    <Card era={year ? String(year) : 'Aujourd’hui'} tone="today" title="La reprise">
      {description ? (
        <View style={styles.changed}>
          <Text style={styles.changedLabel}>Commentaire</Text>
          <Text style={styles.changedText}>« {description} »</Text>
          {author ? (
            <Text style={styles.changedAuthor}>— {formatContributorName(author)}</Text>
          ) : null}
        </View>
      ) : null}

      <Fact icon="person.crop.circle" label="Refaite par">
        {author ? formatContributorName(author) : 'Contributeur non renseigné'}
      </Fact>

      {date ? (
        <Fact icon="calendar" label="Le">
          <Text style={styles.factValue}>{formatDay(date)}</Text>
          {gap ? <Text style={styles.factDetail}>{gap} ans après l’original</Text> : null}
        </Fact>
      ) : null}

      {device ? (
        <Fact icon={/smartphone/i.test(device) ? 'iphone' : 'camera'} label="Appareil">
          {device}
        </Fact>
      ) : null}

      {address ? (
        <Fact icon="mappin.and.ellipse" label="Adresse">
          {address}
        </Fact>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    backgroundColor: Palette.white,
    padding: Spacing.three,
    gap: Spacing.three,
    ...Shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  era: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.pill,
  },
  eraArchive: {
    backgroundColor: Palette.go,
  },
  eraToday: {
    backgroundColor: Palette.parisBlue,
  },
  eraText: {
    ...Kicker,
    letterSpacing: 0.4,
    color: Palette.white,
  },
  cardTitle: {
    ...Typography.title,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  facts: {
    gap: Spacing.threeHalf,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.twoHalf,
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.fog,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factBody: {
    flex: 1,
    gap: Spacing.half,
  },
  factLabel: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  factValue: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  factDetail: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
  },
  chips: {
    marginTop: Spacing.half,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.twoHalf,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Palette.blueMist,
  },
  chipText: {
    ...Typography.caption,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  quote: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  code: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.sans,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  changed: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.goSoft,
    gap: Spacing.one,
  },
  changedLabel: {
    ...Kicker,
    color: Palette.go,
  },
  changedText: {
    ...Typography.body,
    color: Palette.ink,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
  },
  changedAuthor: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
});
