import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { getErrorMessage } from '@/lib/errors';
import { color, radius, type as font } from '@/theme/tokens';
import { PressScale } from '@/components/ui/press-scale';
import { GoogleLogo } from './google-logo';
import { track } from '@/lib/telemetry';

export function GoogleSignInButton({ disabled }: { disabled?: boolean }) {
  const { loginWithGoogle } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await loginWithGoogle();
      track('login', { screen: 'login', props: { element: 'google' } });
      router.replace('/(tabs)');
    } catch (err) {
      const msg =
        err instanceof Error && /annulée/i.test(err.message)
          ? 'Connexion Google annulée'
          : getErrorMessage(err, 'Connexion Google impossible');
      toast(msg, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PressScale
      onPress={() => void onPress()}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel="Se connecter avec Google"
      accessibilityState={{ disabled: !!(disabled || busy), busy }}
      style={[styles.btn, (disabled || busy) && styles.disabled]}>
      {busy ? (
        <>
          <ActivityIndicator color={color.primary} />
          <Text style={styles.label}>Connexion…</Text>
        </>
      ) : (
        <>
          <GoogleLogo size={18} />
          <Text style={styles.label}>Se connecter avec Google</Text>
        </>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 56,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: color.white,
    borderWidth: 1.5,
    borderColor: color.primary,
    paddingHorizontal: 18,
    width: '100%',
  },
  disabled: { opacity: 0.55 },
  label: {
    fontFamily: font.sansSemi,
    fontSize: 16,
    color: color.primary,
  },
});
