import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Download, ShieldAlert } from 'lucide-react-native';
import { markApkDownloadStarted, type ApkUpdate } from '@/lib/app-version';
import { track } from '@/lib/telemetry';
import { Button } from '@/components/ui/button';
import { color, radius, type as font } from '@/theme/tokens';

/**
 * Nouvel APK disponible : 1) ce qui change, 2) le guide Play Protect (même contenu que le site),
 * 3) téléchargement direct (navigateur du téléphone → fichier APK → Installer).
 */
/** Notes de la release GitHub → liste lisible (puces) ; à défaut, un résumé générique. */
function noteItems(notes: string | null): { text: string; bullet: boolean }[] {
  const lines = (notes ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    return [
      { text: 'Nouvelles fonctionnalités et améliorations.', bullet: true },
      { text: 'Corrections et application plus rapide.', bullet: true },
    ];
  }
  return lines.map((l) => {
    const bullet = /^[-*•]\s+/.test(l);
    const text = l.replace(/^#+\s*/, '').replace(/^[-*•]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
    return { text, bullet: bullet || !/^#/.test(l) };
  });
}

export function ApkUpdateModal({ update, onLater }: { update: ApkUpdate; onLater: () => void }) {
  const [step, setStep] = useState<'info' | 'guide'>('info');
  // Taille réelle de l'APK annoncé (release GitHub), arrondie ; ~37 Mo par défaut.
  const sizeMb = update.sizeMb ? Math.round(update.sizeMb) : 37;

  const download = async () => {
    track('click', { screen: 'apk-update', props: { element: `download-${update.latestVersion}` } });
    await markApkDownloadStarted(update.latestVersion);
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
              <Text style={styles.whatT}>Ce qui vous attend</Text>
              <ScrollView style={styles.notesBox} contentContainerStyle={{ gap: 10 }}>
                {noteItems(update.notes).map((item, i) =>
                  item.bullet ? (
                    <View key={i} style={styles.noteRow}>
                      <CheckCircle2 color={color.success} size={16} style={{ marginTop: 2 }} />
                      <Text style={styles.notes}>{item.text}</Text>
                    </View>
                  ) : (
                    <Text key={i} style={styles.noteHead}>
                      {item.text}
                    </Text>
                  )
                )}
              </ScrollView>
              <Text style={styles.tourHint}>Après l’installation, une visite guidée vous montrera comment utiliser ces nouveautés.</Text>
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
                <Button label={`Télécharger (~${sizeMb} Mo)`} onPress={() => void download()} />
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
  notesBox: { maxHeight: 240, backgroundColor: color.surface, borderRadius: 12, padding: 14 },
  notes: { flex: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.text },
  noteRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteHead: { fontFamily: font.sansSemi, fontSize: 14, color: color.text, marginTop: 4 },
  whatT: { fontFamily: font.sansSemi, fontSize: 15, color: color.text },
  tourHint: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.textSecondary },
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
