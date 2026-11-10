import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Download, ShieldAlert } from 'lucide-react-native';
import type { ApkUpdate } from '@/lib/app-version';
import { track } from '@/lib/telemetry';
import { Button } from '@/components/ui/button';
import { color, radius, type as font } from '@/theme/tokens';

/**
 * Nouvel APK disponible : 1) ce qui change, 2) le guide Play Protect (même contenu que le site),
 * 3) téléchargement direct (navigateur du téléphone → fichier APK → Installer).
 */
export function ApkUpdateModal({ update, onLater }: { update: ApkUpdate; onLater: () => void }) {
  const [step, setStep] = useState<'info' | 'guide'>('info');
  const size = update.sizeMb ? ` (${update.sizeMb.toLocaleString('fr-FR')} Mo)` : '';

  const download = async () => {
    track('click', { screen: 'apk-update', props: { element: `download-${update.latestVersion}` } });
    await Linking.openURL(update.apkUrl);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={update.mandatory ? () => undefined : onLater}>
      <Pressable style={styles.backdrop} onPress={update.mandatory ? undefined : onLater} accessibilityLabel="Fermer" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          {step === 'info' ? (
            <>
              <View style={styles.icon}>
                <Download color={color.primary} size={26} strokeWidth={1.9} />
              </View>
              <Text style={styles.title}>Nouvelle version {update.latestVersion}</Text>
              <Text style={styles.meta}>
                Vous avez la {update.currentVersion}.{update.mandatory ? ' Cette mise à jour est nécessaire pour continuer.' : ''}
              </Text>
              {update.notes ? (
                <ScrollView style={styles.notesBox}>
                  <Text style={styles.notes}>{update.notes}</Text>
                </ScrollView>
              ) : (
                <Text style={styles.body}>Nouvelles fonctionnalités, corrections et une application plus légère.</Text>
              )}
              <View style={styles.actions}>
                <Button label="Télécharger la mise à jour" onPress={() => setStep('guide')} />
                {!update.mandatory ? <Button label="Plus tard" variant="line" onPress={onLater} /> : null}
              </View>
            </>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View style={[styles.icon, styles.iconWarn]}>
                <ShieldAlert color="#B45309" size={26} strokeWidth={1.9} />
              </View>
              <Text style={styles.title}>Play Protect peut bloquer l’installation</Text>
              <Text style={styles.body}>
                MES POCHES n’est pas encore sur le Play Store. Play Protect peut donc refuser l’APK. Ne désactivez pas la
                protection : <Text style={styles.strong}>suspendez-la</Text> seulement — elle se relance toute seule le
                lendemain.
              </Text>
              {[
                <>Ouvrez le <Text style={styles.strong}>Play Store</Text>.</>,
                <>Touchez votre photo de profil (en haut à droite).</>,
                <>Ouvrez <Text style={styles.strong}>Play Protect</Text>.</>,
                <>Touchez l’engrenage <Text style={styles.strong}>Paramètres</Text>.</>,
                <>Choisissez <Text style={styles.strong}>Suspendre</Text> — pas « Désactiver ».</>,
                <>Revenez au fichier téléchargé et touchez <Text style={styles.strong}>Installer</Text>. Vos données sont conservées.</>,
              ].map((content, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepN}>{i + 1}</Text>
                  <Text style={styles.stepT}>{content}</Text>
                </View>
              ))}
              <View style={styles.actions}>
                <Button label={`Lancer le téléchargement${size}`} onPress={() => void download()} />
                <Button label="Retour" variant="line" onPress={() => setStep('info')} />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.5)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: color.white, borderRadius: radius.largeCard, padding: 22, gap: 12, maxHeight: '88%' },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWarn: { backgroundColor: '#FFF6E5' },
  title: { fontFamily: font.sansBold, fontSize: 21, lineHeight: 27, color: color.text },
  meta: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.textSecondary },
  strong: { fontFamily: font.sansSemi, color: color.text },
  notesBox: { maxHeight: 180, backgroundColor: color.surface, borderRadius: 12, padding: 12 },
  notes: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.text },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepN: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
    backgroundColor: color.primaryLight,
    color: color.primaryDark,
    fontFamily: font.sansSemi,
    fontSize: 12,
  },
  stepT: { flex: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  actions: { gap: 10, marginTop: 6 },
});
