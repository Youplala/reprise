import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PROJECT_URL } from '@/constants/legal';
import { Fonts, Palette, Radius, Spacing, TabBarClearance, Typography } from '@/constants/theme';

const links = [
  { label: 'Le site de Paris GO', detail: 'Découvrir le projet', icon: 'safari' as const, url: 'https://youplala.github.io/reprise/' },
  { label: 'Le code sur GitHub', detail: 'Open source · licence MIT', icon: 'chevron.left.forwardslash.chevron.right' as const, url: PROJECT_URL },
  { label: 'Confidentialité', detail: 'Comprendre l’usage de vos données', icon: 'hand.raised' as const, url: 'https://youplala.github.io/reprise/confidentialite/' },
];

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Lien indisponible', `Vous pouvez utiliser cette adresse : ${url.replace(/^mailto:/, '')}`);
  }
}

export function AboutScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>À propos</Text>
        <View style={styles.hero}>
          <View style={styles.identity}>
            <Image source={require('../../../assets/images/parisgo-app-icon.png')} style={styles.icon} />
            <View style={styles.identityCopy}>
              <Text style={styles.appName}>Paris GO</Text>
              <Text style={styles.subtitle}>Hier et aujourd’hui</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{'Le Paris d’hier,\nà portée de balade.'}</Text>
        </View>

        <View style={styles.story}>
          <View style={styles.author}>
            <View accessibilityElementsHidden style={styles.avatar}>
              <Text style={styles.initials}>ÉB</Text>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.caption}>Derrière l’app</Text>
              <Text accessibilityRole="header" style={styles.developer}>Élie Brosset</Text>
            </View>
          </View>
          <Text style={styles.body}>
            Je développe Paris GO pour vous aider à retrouver les points de vue d’autrefois et les photographier à nouveau.
          </Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Contacter Élie"
            accessibilityHint="Ouvre votre application de messagerie"
            onPress={() => openLink('mailto:parisgo@eliebrosset.com')}
            style={({ pressed }) => [styles.contact, pressed && styles.contactPressed]}>
            <SymbolView name="envelope" size={22} tintColor={Palette.parisBlue} />
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>On en parle ?</Text>
              <Text selectable style={styles.contactAddress}>parisgo@eliebrosset.com</Text>
            </View>
            <SymbolView name="arrow.up.right" size={14} tintColor={Palette.parisBlue} />
          </Pressable>
        </View>

        <View style={styles.links}>
          {links.map((link, index) => (
            <Pressable key={link.url} accessibilityRole="link" accessibilityLabel={link.label}
              accessibilityHint={link.url.startsWith('mailto:') ? 'Ouvre votre application de messagerie' : 'Ouvre le lien dans votre navigateur'}
              onPress={() => openLink(link.url)}
              style={({ pressed }) => [styles.link, index > 0 && styles.linkBorder, pressed && styles.pressed]}>
              <SymbolView name={link.icon} size={21} tintColor={Palette.parisBlue} />
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>{link.label}</Text>
                <Text style={styles.linkDetail}>{link.detail}</Text>
              </View>
              <SymbolView name="arrow.up.right" size={13} tintColor={Palette.inkSoft} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.promise}>Gratuite, sans compte et sans publicité.</Text>
        <Text style={styles.credits}>
          Les archives sont conservées par la Bibliothèque historique de la Ville de Paris.
          Les photos actuelles et la campagne participative sont publiées par l’Observatoire, animé par le CAUE de Paris.
        </Text>
        <Text style={styles.credits}>
          Paris GO n’est ni éditée ni approuvée par ces institutions. Le code est libre ; les photographies conservent leurs droits.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.fog },
  content: { padding: Spacing.three, paddingBottom: TabBarClearance },
  title: { ...Typography.display, fontSize: 28, fontFamily: Fonts.display, fontWeight: '900', color: Palette.parisBlue },
  hero: { marginTop: Spacing.four, padding: Spacing.four, backgroundColor: Palette.parisBlue, borderRadius: Radius.large },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: { width: 84, height: 84, borderRadius: Radius.medium },
  identityCopy: { flex: 1 },
  appName: { ...Typography.display, fontFamily: Fonts.display, color: Palette.white, fontWeight: '900' },
  subtitle: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.blueMist, marginTop: Spacing.one },
  heroTitle: { ...Typography.display, fontFamily: Fonts.display, fontWeight: '900', color: Palette.white, marginTop: Spacing.four },
  story: { marginTop: Spacing.five, marginBottom: Spacing.four },
  author: { flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.blueMist },
  initials: { ...Typography.title, fontFamily: Fonts.display, fontWeight: '900', color: Palette.parisBlue },
  caption: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.copper, fontWeight: '600' },
  developer: { ...Typography.title, fontFamily: Fonts.display, fontWeight: '900', color: Palette.ink, marginTop: Spacing.half },
  body: { ...Typography.body, fontFamily: Fonts.sans, color: Palette.inkSoft, marginTop: Spacing.twoHalf },
  contact: { marginTop: Spacing.three, backgroundColor: Palette.brass, borderRadius: Radius.medium, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.twoHalf },
  contactAddress: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.parisBlue, marginTop: Spacing.half },
  contactPressed: { opacity: 0.8 },
  links: { backgroundColor: Palette.white, borderRadius: Radius.medium, overflow: 'hidden', marginBottom: Spacing.three },
  link: { minHeight: 72, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  linkBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.line },
  linkCopy: { flex: 1 },
  linkTitle: { ...Typography.body, fontFamily: Fonts.sans, color: Palette.parisBlue, fontWeight: '700' },
  linkDetail: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.inkSoft, marginTop: Spacing.half },
  credits: { ...Typography.caption, fontFamily: Fonts.sans, color: Palette.inkSoft, marginTop: Spacing.twoHalf },
  promise: { ...Typography.caption, fontFamily: Fonts.sans, fontWeight: '600', color: Palette.parisBlue, marginTop: Spacing.two },
  pressed: { backgroundColor: Palette.blueMist },
});
