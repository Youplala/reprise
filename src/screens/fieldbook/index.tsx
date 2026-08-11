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

import { Fonts, Palette, Radius, Shadow, Spacing } from '@/constants/theme';
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
        currentSaved: capture.preparation.current ? '1' : '0',
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
        currentSaved: capture.preparation.current ? '1' : '0',
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
      message: `Ma reprise de ${capture.stationName ?? 'Paris'} avec Reprise.`,
    });
  };

  const confirmDelete = (capture: SavedCapture) => {
    Alert.alert(
      'Supprimer ce brouillon ?',
      'La copie privée de Reprise sera supprimée. La copie éventuellement enregistrée dans Photos restera intacte.',
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
            <SymbolView name="book.closed.fill" size={31} tintColor={Palette.parisBlue} />
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
                    name={capture.preparation.current ? 'checkmark.circle.fill' : 'circle'}
                    size={14}
                    tintColor={capture.preparation.current ? Palette.lichen : Palette.inkSoft}
                  />
                  <Text style={styles.preparationText}>
                    Dépôt : {capture.preparation.current ? 'photo prête' : 'à préparer'}
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 38 },
  kicker: { color: Palette.copper, fontFamily: Fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: Palette.ink, fontFamily: Fonts.display, fontSize: 28, fontWeight: '900' },
  center: { flex: 1, padding: Spacing.four, alignItems: 'center', justifyContent: 'center' },
  status: { marginTop: Spacing.two, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 13 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: Palette.blueMist, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: Spacing.three, color: Palette.ink, fontFamily: Fonts.display, fontSize: 27, fontWeight: '900' },
  emptyCopy: { marginTop: Spacing.two, maxWidth: 300, textAlign: 'center', color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  retry: { marginTop: Spacing.three, minHeight: 46, paddingHorizontal: Spacing.three, borderRadius: Radius.medium, backgroundColor: Palette.parisBlue, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: Palette.white, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800' },
  list: { padding: Spacing.three, paddingBottom: Spacing.five },
  count: { marginBottom: Spacing.three, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 12 },
  card: { marginBottom: Spacing.three, borderRadius: Radius.large, backgroundColor: Palette.white, overflow: 'hidden', ...Shadow.card },
  thumbnail: { width: '100%', height: 210, backgroundColor: Palette.blueMist },
  simulatedThumbnail: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  simulatedLabel: { color: Palette.parisBlue, fontFamily: Fonts.mono, fontSize: 9, fontWeight: '900' },
  cardBody: { padding: Spacing.three, paddingRight: 54 },
  cardKicker: { color: Palette.copper, fontFamily: Fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  cardTitle: { marginTop: Spacing.one, color: Palette.ink, fontFamily: Fonts.display, fontSize: 23, fontWeight: '900' },
  cardMeta: { marginTop: Spacing.one, color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17 },
  preparationRow: { marginTop: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  preparationText: { color: Palette.inkSoft, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700' },
  delete: { position: 'absolute', right: Spacing.two, top: 210 + Spacing.two, width: 38, height: 38, borderRadius: 19, backgroundColor: Palette.fog, alignItems: 'center', justifyContent: 'center' },
  actions: { padding: Spacing.two, paddingTop: 0, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  action: { minHeight: 42, paddingHorizontal: Spacing.two, borderRadius: Radius.medium, backgroundColor: Palette.blueMist, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { color: Palette.parisBlue, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  primaryAction: { minHeight: 42, flexGrow: 1, paddingHorizontal: Spacing.two, borderRadius: Radius.medium, backgroundColor: Palette.parisBlue, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryActionText: { color: Palette.white, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
});
