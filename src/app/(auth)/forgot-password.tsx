import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { forgotPasswordRequest } from '@/lib/auth';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { validateLoginField } from '@/lib/loginValidation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const emailLive = validateLoginField('email', {
    isLogin: true,
    name: '',
    email,
    password,
    confirmPassword: confirm,
  });
  const passwordLive = validateLoginField('password', {
    isLogin: false,
    name: '',
    email,
    password,
    confirmPassword: confirm,
  });
  const confirmLive = validateLoginField('confirmPassword', {
    isLogin: false,
    name: '',
    email,
    password,
    confirmPassword: confirm,
  });

  const send = async () => {
    if (!emailLive.valid) return;
    setLoading(true);
    try {
      await forgotPasswordRequest(email.trim().toLowerCase());
      setStep('reset');
      toast('Si le compte existe, un code part.', 'ok');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESEND_COOLDOWN') {
        toast(err.message, 'info');
      } else toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!passwordLive.valid || !confirmLive.valid) return;
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      toast('Mot de passe renouvelé', 'ok');
      router.replace('/(tabs)');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="La clé" back />
      {step === 'email' ? (
        <>
          <Text style={styles.copy}>Nous n’indiquons jamais si l’e-mail existe. Le code arrive — ou pas.</Text>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={email.trim() ? emailLive.error : undefined}
            valid={email.trim().length > 0 && emailLive.valid}
          />
          <View style={{ height: 24 }} />
          <Button
            label="Envoyer le code"
            loadingLabel="Envoi…"
            onPress={() => void send()}
            loading={loading}
            disabled={!emailLive.valid}
          />
        </>
      ) : (
        <>
          <Text style={styles.copy}>Code à six chiffres, puis un mot de passe neuf.</Text>
          <View style={{ gap: 16 }}>
            <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            <Field
              label="Nouveau mot de passe"
              value={password}
              onChangeText={setPassword}
              secret
              error={password.length > 0 ? passwordLive.error : undefined}
              valid={password.length > 0 && passwordLive.valid}
            />
            <Field
              label="Confirmer"
              value={confirm}
              onChangeText={setConfirm}
              secret
              error={confirm.length > 0 ? confirmLive.error : undefined}
              valid={confirm.length > 0 && confirmLive.valid}
            />
          </View>
          <View style={{ height: 24 }} />
          <Button
            label="Enregistrer et entrer"
            loadingLabel="Enregistrement…"
            onPress={() => void reset()}
            loading={loading}
            disabled={!passwordLive.valid || !confirmLive.valid || code.length !== 6}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { fontFamily: font.sans, color: color.mist, fontSize: 15, lineHeight: 22, marginBottom: 24 },
});
