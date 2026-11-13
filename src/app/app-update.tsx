import { useCallback, useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import {
  applyAppUpdate,
  checkForAppUpdate,
  defaultUpdateMessage,
  downloadAppUpdate,
  otaUpdatesActive,
  runningUpdateLabel,
} from '@/lib/app-updates';
import { getErrorMessage } from '@/lib/errors';
import { checkApkUpdate, effectiveVersion, installedVersion, type ApkUpdate } from '@/lib/app-version';
import { ApkUpdateModal } from '@/components/apk-update-modal';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/contexts/toast';
import { color, type as font } from '@/theme/tokens';

export default function AppUpdateScreen() {
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [apk, setApk] = useState<ApkUpdate | null>(null);
  const [apkOpen, setApkOpen] = useState(false);
  const [version, setVersion] = useState(installedVersion());

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setApk(await checkApkUpdate(true));
    setVersion(await effectiveVersion());
    if (!otaUpdatesActive()) {
      setAvailable(false);
      setMessage(null);
      return;
    }
    setChecking(true);
    try {
      const info = await checkForAppUpdate();
      setAvailable(info.available);
      setMessage(info.available ? defaultUpdateMessage(info.message) : null);
    } catch (e) {
      toast(getErrorMessage(e, 'Vérification impossible'), 'err');
    } finally {
      setChecking(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const install = async () => {
    if (!otaUpdatesActive()) {
      toast('Disponible uniquement sur l’app installée (pas en Expo Go)', 'info');
      return;
    }
    setInstalling(true);
    try {
      const ok = await downloadAppUpdate();
      if (!ok) {
        toast('Aucune nouvelle version à télécharger', 'info');
        await refresh();
        return;
      }
      await applyAppUpdate();
    } catch (e) {
      toast(getErrorMessage(e, 'Mise à jour impossible'), 'err');
    } finally {
      setInstalling(false);
    }
  };

  const active = otaUpdatesActive();

  return (
    <Screen scroll keyboardAware>
      <ScreenHeader title="Mise à jour" back />
      <Text style={styles.lede}>
        Les corrections et nouveautés légères s’installent ici, sans retélécharger l’app.
      </Text>

      <View style={styles.box}>
        <Text style={styles.k}>Version installée</Text>
        <Text style={styles.v}>
          {version} · {runningUpdateLabel()}
        </Text>
        <Text style={styles.k}>
          Canal {Updates.channel ?? '—'} · runtime {Updates.runtimeVersion ?? '—'}
        </Text>
      </View>

      {apk ? (
        <View style={styles.apk}>
          <Text style={styles.apkT}>Nouvelle version {apk.latestVersion} à installer</Text>
          <Text style={styles.note}>
            Cette version change l’application elle-même : elle se télécharge depuis notre lien direct, puis s’installe
            par-dessus l’actuelle. Vos données sont conservées.
          </Text>
          <Button label="Télécharger la nouvelle version" onPress={() => setApkOpen(true)} />
        </View>
      ) : null}
      {apk && apkOpen ? <ApkUpdateModal update={{ ...apk, mandatory: false }} onLater={() => setApkOpen(false)} /> : null}

      {Platform.OS === 'web' ? (
        <Text style={styles.note}>Les mises à jour automatiques ne s’appliquent pas sur le web.</Text>
      ) : !active ? (
        <Text style={styles.note}>
          En développement (Expo Go ou build dev), les mises à jour OTA sont désactivées. Utilisez un build de
          production pour les recevoir.
        </Text>
      ) : checking ? (
        <View style={styles.row}>
          <ActivityIndicator color={color.primary} />
          <Text style={styles.note}>Recherche de mises à jour…</Text>
        </View>
      ) : available ? (
        <>
          <Text style={styles.k}>Nouveautés</Text>
          <Text style={styles.changelog}>{message}</Text>
          <Button
            label="Mettre à jour maintenant"
            loadingLabel="Téléchargement…"
            onPress={() => void install()}
            loading={installing}
          />
        </>
      ) : (
        <>
          <Text style={styles.note}>Vous avez la dernière version disponible.</Text>
          <Button label="Revérifier" variant="line" onPress={() => void refresh()} loading={checking} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: color.textSecondary, marginBottom: 20 },
  box: {
    backgroundColor: color.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 4,
  },
  k: { fontFamily: font.sansMed, fontSize: 13, color: color.textMuted },
  v: { fontFamily: font.sansSemi, fontSize: 16, color: color.text },
  note: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.textSecondary, marginBottom: 16 },
  changelog: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.text,
    marginBottom: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  apk: { backgroundColor: color.primaryVeryLight, borderRadius: 14, borderWidth: 1, borderColor: color.primaryLight, padding: 16, marginBottom: 24 },
  apkT: { fontFamily: font.sansSemi, fontSize: 16, color: color.text, marginBottom: 6 },
});
