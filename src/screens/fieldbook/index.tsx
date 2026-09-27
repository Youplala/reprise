import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Fonts,
  HitSize,
  Kicker,
  Palette,
  Radius,
  Shadow,
  Spacing,
  Typography,
} from '@/constants/theme';
import { deleteCapture, getSavedCaptures, type SavedCapture } from '@/services/fieldbook';
import { getFieldbookViewState } from '@/services/fieldbook-view-state';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function FieldbookScreen() {
  const router = useRouter();
  const [captures, setCaptures] = useState<SavedCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setCaptures(await getSavedCaptures());
    } catch {
      setError('Le carnet n’a pas pu être ouvert. Réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const compare = (capture: SavedCapture) => {
    router.push({
      pathname: '/capture-review',
      params: {
        captureId: capture.id,
        id: capture.stationId,
        frame: String(capture.frameIndex),
        uri: capture.imageUri ?? '',
        simulated: capture.simulated ? '1' : '0',
        roll: capture.roll === undefined ? '' : String(capture.roll),
        pitch: capture.pitch === undefined ? '' : String(capture.pitch),
        resumed: '1',
        currentSaved: capture.preparation.current.ready ? '1' : '0',
        currentPreparation: JSON.stringify(capture.preparation.current),
        referencePreparation: JSON.stringify(capture.preparation.reference),
        latitude: capture.coordinate ? String(capture.coordinate.latitude) : '',
        longitude: capture.coordinate ? String(capture.coordinate.longitude) : '',
        locationPrecision: capture.locationPrecision ?? '',
      },
    });
  };

  const resumeSubmission = (capture: SavedCapture) => {
    router.push({
      pathname: '/official-submit' as never,
      params: {
        captureId: capture.id,
        id: capture.stationId,
        frame: String(capture.frameIndex),
        uri: capture.imageUri ?? '',
        simulated: capture.simulated ? '1' : '0',
        currentSaved: capture.preparation.current.ready ? '1' : '0',
        currentPreparation: JSON.stringify(capture.preparation.current),
        referencePreparation: JSON.stringify(capture.preparation.reference),
        latitude: capture.coordinate ? String(capture.coordinate.latitude) : '',
        longitude: capture.coordinate ? String(capture.coordinate.longitude) : '',
      },
    });
  };

  const share = async (capture: SavedCapture) => {
    if (capture.imageUri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(capture.imageUri, {
        dialogTitle: 'Partager cette reprise',
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
      return;
    }
    await Share.share({
      message: `Ma reprise de ${capture.stationName ?? 'Paris'} avec Paris GO.`,
    });
  };

  const confirmDelete = (capture: SavedCapture) => {
    Alert.alert(
      'Supprimer ce brouillon ?',
      'La copie privée dans Paris GO sera supprimée. La copie éventuellement enregistrée dans Photos restera intacte.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void deleteCapture(capture.id)
              .then(() => setCaptures((current) => current.filter((item) => item.id !== capture.id)))
              .catch(() =>
                Alert.alert('Suppression impossible', 'Le brouillon n’a pas été supprimé.'),
              );
          },
        },
      ],
    );
  };

  const state = getFieldbookViewState(captures);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable
          accessibilityLabel="Fermer le carnet"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <SymbolView name="xmark" size={17} tintColor={Palette.ink} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>BROUILLONS LOCAUX</Text>
          <Text style={styles.title}>Carnet</Text>
        </View>
        <View style={styles.headerSpacer} />
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.parisBlue} />
          <Text style={styles.status}>Ouverture du carnet…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <SymbolView name="exclamationmark.triangle.fill" size={30} tintColor={Palette.copper} />
          <Text style={styles.emptyTitle}>Carnet indisponible</Text>
          <Text style={styles.emptyCopy}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : state.kind === 'empty' ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <SymbolView name="book.closed.fill" size={31} tintColor={Palette.go} />
          </View>
          <Text style={styles.emptyTitle}>{state.title}</Text>
          <Text style={styles.emptyCopy}>{state.description}</Text>
          <Pressable onPress={() => router.replace('/map')} style={styles.retry}>
            <Text style={styles.retryText}>Choisir une photo de 1970</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}>
          <Text style={styles.count}>
            {state.count} {state.count > 1 ? 'reprises conservées' : 'reprise conservée'} sur cet appareil
          </Text>
          {state.captures.map((capture) => (
            <View key={capture.id} style={styles.card}>
              {capture.imageUri ? (
                <Image source={{ uri: capture.imageUri }} contentFit="cover" style={styles.thumbnail} />
              ) : (
                <View style={[styles.thumbnail, styles.simulatedThumbnail]}>
                  <SymbolView name="iphone.gen3" size={28} tintColor={Palette.parisBlue} />
                  <Text style={styles.simulatedLabel}>DÉMO</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardKicker}>{formatDate(capture.createdAt)}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {capture.stationName ?? `Point ${capture.stationId}`}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={2}>
                  {capture.stationAddress ?? (capture.coordinate ? 'Position enregistrée' : 'Position non enregistrée')}
                </Text>
                <View style={styles.preparationRow}>
                  <SymbolView
                    name={capture.preparation.current.ready ? 'checkmark.circle.fill' : 'circle'}
                    size={14}
                    tintColor={capture.preparation.current.ready ? Palette.lichen : Palette.inkSoft}
                  />
                  <Text style={styles.preparationText}>
                    Dépôt : {capture.preparation.current.ready ? 'photo prête' : 'à préparer'}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Supprimer le brouillon"
                onPress={() => confirmDelete(capture)}
                style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
                <SymbolView name="trash" size={16} tintColor={Palette.copper} />
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => compare(capture)} style={styles.action}>
                  <SymbolView name="rectangle.split.2x1" size={15} tintColor={Palette.parisBlue} />
                  <Text style={styles.actionText}>Comparer</Text>
                </Pressable>
                <Pressable onPress={() => void share(capture)} style={styles.action}>
                  <SymbolView name="square.and.arrow.up" size={15} tintColor={Palette.parisBlue} />
                  <Text style={styles.actionText}>Partager</Text>
                </Pressable>
                <Pressable onPress={() => resumeSubmission(capture)} style={styles.primaryAction}>
                  <Text style={styles.primaryActionText}>Reprendre le dépôt</Text>
                  <SymbolView name="arrow.right" size={14} tintColor={Palette.white} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  header: {
    minHeight: 78,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.line,
  },
  close: {
    width: HitSize,
    height: HitSize,
    borderRadius: HitSize / 2,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: HitSize },
  kicker: { ...Kicker, color: Palette.go },
  title: { ...Typography.title, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  center: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center' },
  status: { ...Typography.caption, marginTop: Spacing.two, color: Palette.inkSoft, fontFamily: Fonts.sans },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.goSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...Typography.display, marginTop: Spacing.three, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  emptyCopy: { ...Typography.body, marginTop: Spacing.two, maxWidth: 300, textAlign: 'center', color: Palette.inkSoft, fontFamily: Fonts.sans },
  retry: { marginTop: Spacing.four, minHeight: 52, paddingHorizontal: Spacing.four, borderRadius: Radius.pill, backgroundColor: Palette.go, alignItems: 'center', justifyContent: 'center' },
  retryText: { ...Typography.body, color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700' },
  list: { padding: Spacing.three, paddingBottom: Spacing.five },
  count: { ...Typography.caption, marginBottom: Spacing.three, color: Palette.inkSoft, fontFamily: Fonts.sans },
  card: { marginBottom: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, overflow: 'hidden', ...Shadow.card },
  thumbnail: { width: '100%', height: 210, backgroundColor: Palette.blueMist },
  simulatedThumbnail: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  simulatedLabel: { ...Kicker, color: Palette.parisBlue },
  cardBody: { padding: Spacing.three, paddingRight: 60 },
  cardKicker: { ...Kicker, color: Palette.go },
  cardTitle: { ...Typography.title, marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.display, fontWeight: '800' },
  cardMeta: { ...Typography.caption, marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans },
  preparationRow: { marginTop: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  preparationText: { ...Typography.caption, color: Palette.inkSoft, fontFamily: Fonts.sans, fontWeight: '600' },
  delete: { position: 'absolute', right: Spacing.two, top: 210 + Spacing.two, width: HitSize, height: HitSize, borderRadius: HitSize / 2, backgroundColor: Palette.fog, alignItems: 'center', justifyContent: 'center' },
  actions: { padding: Spacing.three, paddingTop: 0, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: { minHeight: HitSize, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, backgroundColor: Palette.blueMist, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  actionText: { ...Typography.caption, color: Palette.parisBlue, fontFamily: Fonts.sans, fontWeight: '700' },
  primaryAction: { minHeight: HitSize, flexGrow: 1, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, backgroundColor: Palette.go, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  primaryActionText: { ...Typography.caption, color: Palette.white, fontFamily: Fonts.sans, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
});
