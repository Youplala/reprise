import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Fonts, HitSize, Kicker, Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { normalizeOfficialIdentity, type OfficialIdentity } from '@/services/official-identity';

type OfficialIdentitySheetProps = {
  visible: boolean;
  initial?: OfficialIdentity;
  onClose: () => void;
  onSave: (identity: OfficialIdentity) => void;
  onForget: () => void;
};

function Field({
  label,
  required,
  ...input
}: TextInputProps & { label: string; required?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput placeholderTextColor={Palette.inkSoft} style={styles.input} {...input} />
    </View>
  );
}

/**
 * Saisie des informations « Contributeur » que l'utilisateur choisit de mémoriser sur son
 * appareil. Rien n'est envoyé : ces valeurs sont recopiées dans le formulaire officiel, où
 * l'utilisateur coche le règlement et envoie lui-même.
 */
export function OfficialIdentitySheet({
  visible,
  initial,
  onClose,
  onSave,
  onForget,
}: OfficialIdentitySheetProps) {
  const [draft, setDraft] = useState<Partial<OfficialIdentity>>(initial ?? {});
  const [error, setError] = useState<string>();
  const update = (key: keyof OfficialIdentity) => (value: string) => {
    setError(undefined);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const identity = normalizeOfficialIdentity(draft);
    if (!identity) {
      setError('Indiquez au moins votre prénom et nom, et une adresse e-mail valide.');
      return;
    }
    onSave(identity);
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onShow={() => {
        setDraft(initial ?? {});
        setError(undefined);
      }}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Formulaire officiel</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Mes informations
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fermer"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <SymbolView name="xmark" size={16} tintColor={Palette.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.notice}>
            <SymbolView name="lock.fill" size={14} tintColor={Palette.lichen} />
            <Text style={styles.noticeText}>
              Enregistré uniquement sur cet appareil. Paris GO ne reçoit rien : ces informations
              sont recopiées dans le formulaire de l’Observatoire, où vous cochez le règlement et
              envoyez vous-même.
            </Text>
          </View>

          <Field
            label="Prénom NOM"
            required
            value={draft.fullName ?? ''}
            onChangeText={update('fullName')}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <Field
            label="E-mail"
            required
            value={draft.email ?? ''}
            onChangeText={update('email')}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Âge"
            value={draft.age ?? ''}
            onChangeText={update('age')}
            keyboardType="number-pad"
          />
          <Field
            label="Commune de résidence"
            value={draft.residenceCity ?? ''}
            onChangeText={update('residenceCity')}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
          />
          <Field
            label="Pays"
            value={draft.country ?? ''}
            onChangeText={update('country')}
            autoComplete="country"
            textContentType="countryName"
          />

          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <PrimaryButton label="Enregistrer sur cet appareil" icon="checkmark" onPress={save} />
          {initial ? (
            <Pressable
              accessibilityRole="button"
              onPress={onForget}
              style={({ pressed }) => [styles.forget, pressed && styles.pressed]}>
              <Text style={styles.forgetText}>Oublier mes informations</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerCopy: { flex: 1 },
  kicker: { ...Kicker, color: Palette.go },
  title: {
    ...Typography.display,
    color: Palette.ink,
    fontFamily: Fonts.display,
    fontWeight: '800',
  },
  close: {
    width: HitSize,
    height: HitSize,
    borderRadius: HitSize / 2,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  notice: {
    padding: Spacing.three,
    borderRadius: Radius.medium,
    backgroundColor: Palette.white,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  noticeText: { ...Typography.caption, flex: 1, color: Palette.inkSoft, fontFamily: Fonts.sans },
  field: { gap: Spacing.one },
  fieldLabel: {
    ...Typography.caption,
    color: Palette.inkSoft,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  required: { color: Palette.go },
  input: {
    ...Typography.body,
    fontSize: 17,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.line,
    backgroundColor: Palette.white,
    color: Palette.ink,
    fontFamily: Fonts.sans,
  },
  error: { ...Typography.caption, color: Palette.go, fontFamily: Fonts.sans, fontWeight: '600' },
  forget: { minHeight: HitSize, alignItems: 'center', justifyContent: 'center' },
  forgetText: { ...Typography.body, color: Palette.danger, fontFamily: Fonts.sans, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
