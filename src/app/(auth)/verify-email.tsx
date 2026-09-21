import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { resendCodeRequest } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { BrandMark } from '@/components/brand/brand-mark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

export default function VerifyEmailScreen() {
  const { pendingEmail, verifyEmail } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = pendingEmail ?? '';

  const submit = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      await verifyEmail(email, code);
      toast('Compte vérifié', 'ok');
      router.replace('/(tabs)');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Code invalide', 'err');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
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
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Le sceau" back />
      <View style={styles.seal}>
        <BrandMark size={92} />
      </View>
      <Text style={styles.copy}>Six chiffres envoyés à {email || 'votre e-mail'}. Sans eux, le livre reste fermé.</Text>
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
      />
      <View style={{ height: 24 }} />
      <Button label="Vérifier" loadingLabel="Vérification…" onPress={() => void submit()} loading={loading} disabled={code.length !== 6} />
      <Text onPress={() => void resend()} style={styles.resend}>
        {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : 'Renvoyer le code'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  seal: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  copy: { fontFamily: font.sans, color: color.mist, fontSize: 15, lineHeight: 22, marginBottom: 28 },
  resend: { marginTop: 18, fontFamily: font.sansMed, color: color.brass, textAlign: 'center' },
});
