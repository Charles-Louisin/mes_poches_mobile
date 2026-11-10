import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatPremiumUntil, getTrialDaysLeft } from '@/lib/subscription';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useToast } from '@/contexts/toast';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

export default function ProfileScreen() {
  const { user, logout, isPremium, isOnTrial, refreshMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const saveName = async () => {
    const next = name.trim();
    if (next.length < 2) {
      toast('Le nom doit contenir au moins 2 caractères', 'info');
      return;
    }
    if (next === (user?.name || '')) return;
    setSaving(true);
    try {
      await authApi.updateMe({ name: next });
      await refreshMe();
      toast('Nom mis à jour', 'ok');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible de modifier le nom'), 'err');
    } finally {
      setSaving(false);
    }
  };

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
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setWipeBusy(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const trialDays = getTrialDaysLeft(user);
  const meta = isAdmin
    ? 'ADMINISTRATEUR'
    : isOnTrial
      ? `Essai Premium jusqu’au ${formatPremiumUntil(user?.premiumUntil)} · ${trialDays} j restants`
      : isPremium
        ? `Premium jusqu’au ${formatPremiumUntil(user?.premiumUntil)}`
        : 'Livre gratuit';

  return (
    <Screen scroll>
      <ScreenHeader title="Identité" back />
      <Text style={styles.mail}>{user?.email}</Text>
      <Text style={[styles.meta, isAdmin && styles.admin]}>{meta}</Text>
      <View style={{ height: 24 }} />
      <Field label="Nom" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60} />
      <View style={{ height: 12 }} />
      <Button
        label="Enregistrer le nom"
        loadingLabel="Enregistrement…"
        onPress={() => void saveName()}
        loading={saving}
        disabled={name.trim() === (user?.name || '') || name.trim().length < 2}
      />
      <View style={{ height: 32 }} />
      <Button label="Effacer le compte" loadingLabel="Traitement…" variant="ember" onPress={() => void wipe()} loading={wipeBusy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mail: { fontFamily: font.sans, color: color.mist, marginTop: 4 },
  meta: { fontFamily: font.sansSemi, fontSize: 16, color: color.primaryDark, marginTop: 12 },
  admin: { },
});
