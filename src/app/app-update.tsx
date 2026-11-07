import { useCallback, useEffect, useState } from 'react';
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

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') return;
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
        Les mises à jour légères (interface, corrections) arrivent ici sans retélécharger l’app depuis le store.
      </Text>

      <View style={styles.box}>
        <Text style={styles.k}>Version en cours</Text>
        <Text style={styles.v}>{runningUpdateLabel()}</Text>
      </View>

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
});
