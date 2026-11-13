import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { resendCodeRequest } from '@/lib/auth';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const { pendingEmail, verifyEmail } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const email = pendingEmail ?? '';

  const submit = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const { trialGranted } = await verifyEmail(email, code);
      toast(trialGranted ? 'Compte vérifié — votre mois Pro commence' : 'Compte vérifié. L’essai gratuit a déjà été utilisé avec cette adresse ou cet appareil : vous démarrez en version gratuite.', trialGranted ? 'ok' : 'info');
      router.replace('/(tabs)');
    } catch (err) {
      toast(getErrorMessage(err, 'Code invalide'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      await resendCodeRequest(email);
      setCooldown(60);
      const t = setInterval(() => setCooldown((s) => (s <= 1 ? (clearInterval(t), 0) : s - 1)), 1000);
      toast('Nouveau code envoyé', 'ok');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESEND_COOLDOWN') {
        const sec = (err.data as { cooldownSeconds?: number } | undefined)?.cooldownSeconds ?? 60;
        setCooldown(sec);
      }
      toast(getErrorMessage(err, 'Envoi impossible'), 'err');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Vérifier l’e-mail" back />
      <View style={styles.seal}>
        <BrandMark size={92} />
      </View>
      <Text style={styles.copy}>Nous avons envoyé un code à 6 chiffres à {email || 'votre adresse e-mail'}. Saisissez-le pour activer votre compte.</Text>
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
      />
      <View style={{ height: 24 }} />
      <Button label="Vérifier" loadingLabel="Vérification…" onPress={() => void submit()} loading={loading} disabled={code.length !== 6} />
      <PressScale onPress={() => void resend()} disabled={cooldown > 0 || resending} accessibilityRole="button" accessibilityState={{ busy: resending }} style={styles.resendBtn}>
        <Text style={[styles.resend, (cooldown > 0 || resending) && styles.resendOff]}>
          {resending ? 'Envoi du code…' : cooldown > 0 ? `Renvoyer un code dans ${cooldown} s` : 'Renvoyer un code'}
        </Text>
      </PressScale>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seal: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  copy: { fontFamily: font.sans, color: color.mist, fontSize: 15, lineHeight: 22, marginBottom: 28 },
  resendBtn: { marginTop: 18, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  resend: { fontFamily: font.sansMed, color: color.primary, textAlign: 'center', fontSize: 15 },
  resendOff: { color: color.textMuted },
});
