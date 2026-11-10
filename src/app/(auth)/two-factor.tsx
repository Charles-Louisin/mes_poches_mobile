import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { twoFactorResendRequest } from '@/lib/auth';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { track } from '@/lib/telemetry';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

/** Étape 2 de la connexion : code à 6 chiffres reçu par e-mail (double authentification). */
export default function TwoFactorScreen() {
  const params = useLocalSearchParams<{ challenge?: string; hint?: string; cooldown?: string }>();
  const challenge = params.challenge ?? '';
  const { completeTwoFactorLogin } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(Number(params.cooldown) || 30);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const expired = () => {
    toast('La session de connexion a expiré. Reconnectez-vous.', 'info');
    router.replace('/(auth)/login');
  };

  const submit = async () => {
    if (code.length !== 6 || loading) return;
    if (!challenge) return expired();
    setLoading(true);
    try {
      await completeTwoFactorLogin(challenge, code, trust);
      track('login', { screen: 'two-factor', props: { element: trust ? 'trusted' : 'once' } });
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHALLENGE_EXPIRED') return expired();
      setCode('');
      toast(getErrorMessage(err, 'Code incorrect'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    if (!challenge) return expired();
    try {
      const res = await twoFactorResendRequest(challenge);
      setCooldown(res.cooldownSeconds ?? 30);
      toast('Nouveau code envoyé', 'ok');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHALLENGE_EXPIRED') return expired();
      toast(getErrorMessage(err, 'Envoi impossible'), 'err');
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Code de connexion" back />
      <View style={styles.icon}>
        <ShieldCheck color={color.primary} size={32} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>Vérifions que c’est bien vous</Text>
      <Text style={styles.copy}>
        Nous avons envoyé un code à 6 chiffres à {params.hint || 'votre adresse e-mail'}. Il expire dans 10 minutes.
      </Text>
      <Field
        label="Code reçu par e-mail"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        onSubmitEditing={() => void submit()}
      />
      <PressScale
        onPress={() => setTrust((t) => !t)}
        style={styles.trust}
        accessibilityRole="switch"
        accessibilityState={{ checked: trust }}
        accessibilityLabel="Faire confiance à cet appareil pendant 30 jours">
        <View style={{ flex: 1 }}>
          <Text style={styles.trustT}>Faire confiance à cet appareil</Text>
          <Text style={styles.trustS}>Plus de code ici pendant 30 jours.</Text>
        </View>
        <Switch
          value={trust}
          onValueChange={setTrust}
          trackColor={{ true: color.primary, false: color.border }}
          thumbColor={color.white}
        />
      </PressScale>
      <View style={{ height: 24 }} />
      <Button
        label="Se connecter"
        loadingLabel="Vérification…"
        onPress={() => void submit()}
        loading={loading}
        disabled={code.length !== 6}
      />
      <PressScale
        onPress={() => void resend()}
        disabled={cooldown > 0}
        accessibilityRole="button"
        style={styles.resendBtn}>
        <Text style={[styles.resend, cooldown > 0 && styles.resendOff]}>
          {cooldown > 0 ? `Renvoyer un code dans ${cooldown} s` : 'Renvoyer un code'}
        </Text>
      </PressScale>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  title: { fontFamily: font.sansBold, fontSize: 24, lineHeight: 30, color: color.text, marginBottom: 8 },
  copy: { fontFamily: font.sans, color: color.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: color.surface,
  },
  trustT: { fontFamily: font.sansMed, fontSize: 15, color: color.text },
  trustS: { fontFamily: font.sans, fontSize: 13, color: color.textSecondary, marginTop: 2 },
  resendBtn: { marginTop: 18, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  resend: { fontFamily: font.sansMed, color: color.primary, textAlign: 'center', fontSize: 15 },
  resendOff: { color: color.textMuted },
});
