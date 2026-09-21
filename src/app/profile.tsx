import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { authApi } from '@/lib/api';
import { formatPremiumUntil, getTrialDaysLeft } from '@/lib/subscription';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

export default function ProfileScreen() {
  const { user, logout, isPremium, isOnTrial } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [wipeBusy, setWipeBusy] = useState(false);

  const wipe = async () => {
    const ok = await confirm({
      title: 'Effacer le compte ?',
      body: 'Irréversible. Poches, écritures, tout.',
      confirmLabel: 'Effacer',
      danger: true,
    });
    if (!ok) return;
    setWipeBusy(true);
    try {
      await authApi.deleteMe();
      await logout();
      toast('Compte effacé', 'ok');
      router.replace('/(auth)/login');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setWipeBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Identité" back />
      <Text style={styles.name}>{user?.name || 'Sans nom'}</Text>
      <Text style={styles.mail}>{user?.email}</Text>
      <Text style={styles.meta}>
        {isOnTrial
          ? `Essai · ${getTrialDaysLeft(user)} j restants`
          : isPremium
            ? `Premium jusqu’au ${formatPremiumUntil(user?.premiumUntil)}`
            : 'Livre gratuit'}
      </Text>
      <View style={{ height: 32 }} />
      <Button label="Effacer le compte" loadingLabel="Traitement…" variant="ember" onPress={() => void wipe()} loading={wipeBusy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: font.displayItalic, fontSize: 36, color: color.ivory },
  mail: { fontFamily: font.sans, color: color.mist, marginTop: 8 },
  meta: { fontFamily: font.sansMed, color: color.brass, marginTop: 16 },
});
