import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { ApiError, getErrorMessage } from '@/lib/errors';
import { checkRegisterAvailability } from '@/lib/auth';
import { applyAvailabilityToField, isLoginFormValid, validateLoginField } from '@/lib/loginValidation';
import {
  authenticateBiometric,
  biometricAvailability,
  biometricLabel,
  isBiometricLoginEnabled,
  readBiometricCredentials,
  storeBiometricCredentials,
} from '@/lib/biometrics';
import { BrandLockup } from '@/components/brand/brand-mark';
import { GoogleSignInButton } from '@/components/auth/google-sign-in';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { PressScale } from '@/components/ui/press-scale';
import { color, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

export default function LoginScreen() {
  const { login, register, setPendingEmail } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameAvail, setNameAvail] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [bio, setBio] = useState<{ ready: boolean; label: string } | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLogin = mode === 'in';
  const values = { isLogin, name, email, password, confirmPassword: confirm };

  useEffect(() => {
    if (!isLogin || Platform.OS === 'web') return;
    void (async () => {
      const [avail, enabled, creds] = await Promise.all([
        biometricAvailability(),
        isBiometricLoginEnabled(),
        readBiometricCredentials(),
      ]);
      if (avail.available && avail.enrolled && enabled && creds) {
        setBio({ ready: true, label: biometricLabel(avail.kinds) });
      } else {
        setBio(null);
      }
    })();
  }, [isLogin]);

  useEffect(() => {
    if (isLogin) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void (async () => {
        if (!validateLoginField('name', values).valid) {
          setNameAvail('idle');
          return;
        }
        setNameAvail('checking');
        try {
          const data = await checkRegisterAvailability({ name: name.trim() });
          if (data.name) setNameAvail(data.name.available ? 'available' : 'taken');
          else setNameAvail('idle');
        } catch {
          setNameAvail('idle');
        }
      })();
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isLogin, name]);

  const canSubmit = isLoginFormValid(values, isLogin ? undefined : { name: nameAvail });

  const nameBase = validateLoginField('name', values);
  const emailBase = validateLoginField('email', values);
  const nameLive = isLogin ? nameBase : applyAvailabilityToField(nameBase, nameAvail);
  const emailLive = emailBase;
  const passwordLive = validateLoginField('password', values);
  const confirmLive = validateLoginField('confirmPassword', values);

  const showName = !isLogin && name.trim().length > 0;
  const showEmail = email.trim().length > 0;
  const showPassword = password.length > 0;
  const showConfirm = !isLogin && confirm.length > 0;

  const submit = async () => {
    if (loading || !canSubmit) return;
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        track('login', { screen: 'login', props: { element: 'password' } });
        const avail = await biometricAvailability();
        if (avail.available && avail.enrolled) {
          await storeBiometricCredentials(email.trim().toLowerCase(), password);
        }
        router.replace('/(tabs)');
      } else {
        const res = await register(email, password, name);
        track('signup', { screen: 'login', props: { element: 'register' } });
        await setPendingEmail(res.email);
        router.push('/(auth)/verify-email');
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        const pending = (err.data as { email?: string } | undefined)?.email ?? email;
        await setPendingEmail(pending);
        router.push('/(auth)/verify-email');
        toast('Vérifiez d’abord votre e-mail', 'info');
        return;
      }
      if (
        err instanceof ApiError &&
        (err.status === 500 || /inscription/i.test(err.message))
      ) {
        await setPendingEmail(email.trim().toLowerCase());
        router.push('/(auth)/verify-email');
        toast('Compte créé. Entrez le code reçu par e-mail.', 'info');
        return;
      }
      if (err instanceof ApiError && err.code === 'NEED_PASSWORD') {
        toast(err.message, 'info');
        router.push('/(auth)/forgot-password');
        return;
      }
      toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const loginWithBiometric = async () => {
    if (loading || !bio) return;
    setLoading(true);
    try {
      const result = await authenticateBiometric(`Ouvrir Mes Poches avec ${bio.label}`);
      if (!result.success) {
        toast('Authentification annulée', 'info');
        return;
      }
      const creds = await readBiometricCredentials();
      if (!creds) {
        toast('Reconnectez-vous une fois avec votre mot de passe', 'info');
        return;
      }
      await login(creds.email, creds.password);
      track('login', { screen: 'login', props: { element: 'biometric' } });
      router.replace('/(tabs)');
    } catch (err) {
      toast(getErrorMessage(err, 'Connexion biométrique impossible'), 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <BrandLockup size={48} caption="grand livre de poche" />
        <Text style={styles.headline}>{isLogin ? 'Bon retour.' : 'Ouvrir un livre.'}</Text>
        <Text style={styles.lede}>
          {isLogin ? 'Reconnectez-vous pour retrouver vos poches.' : 'Un mois Premium offert après la vérification.'}
        </Text>

        <View style={styles.toggle}>
          <PressScale
            onPress={() => {
              setMode('in');
            }}
            style={[styles.tog, isLogin && styles.togOn]}>
            <Text style={[styles.togTxt, isLogin && styles.togTxtOn]}>Connexion</Text>
          </PressScale>
          <PressScale
            onPress={() => {
              setMode('up');
              setShowEmailForm(false);
            }}
            style={[styles.tog, !isLogin && styles.togOn]}>
            <Text style={[styles.togTxt, !isLogin && styles.togTxtOn]}>Inscription</Text>
          </PressScale>
        </View>

        <View style={{ marginTop: 24 }}>
          <GoogleSignInButton disabled={loading} />
        </View>
        {isLogin && bio && !showEmailForm ? (
          <View style={{ marginTop: 12 }}>
            <Button
              label="Continuer avec email"
              variant="line"
              onPress={() => setShowEmailForm(true)}
            />
          </View>
        ) : null}
        {isLogin && bio && showEmailForm ? (
          <View style={styles.bioTop}>
            <PressScale
              onPress={() => void loginWithBiometric()}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir avec ${bio.label}`}
              style={styles.bioBtn}>
              {bio.label.toLowerCase().includes('face') ? (
                <ScanFace color={color.primary} size={32} />
              ) : (
                <Fingerprint color={color.primary} size={32} />
              )}
            </PressScale>
          </View>
        ) : null}
        {isLogin && !bio ? <Text style={styles.or}>ou avec e-mail</Text> : null}
        {!isLogin ? <Text style={styles.or}>ou avec e-mail</Text> : null}

        {!isLogin || !bio || showEmailForm ? (
          <>
            <View style={{ gap: 18 }}>
              {!isLogin ? (
                <Field
                  label="Nom"
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    setNameAvail('idle');
                  }}
                  autoCapitalize="words"
                  error={showName ? nameLive.error : undefined}
                  valid={showName && nameLive.valid}
                />
              ) : null}
              <Field
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                error={showEmail ? emailLive.error : undefined}
                valid={showEmail && emailLive.valid}
              />
              <Field
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secret
                error={showPassword ? passwordLive.error : undefined}
                valid={showPassword && passwordLive.valid}
              />
              {!isLogin ? (
                <Field
                  label="Confirmer"
                  value={confirm}
                  onChangeText={setConfirm}
                  secret
                  error={showConfirm ? confirmLive.error : undefined}
                  valid={showConfirm && confirmLive.valid}
                />
              ) : null}
            </View>

            {isLogin ? (
              <Link href="/(auth)/forgot-password" style={styles.forgot}>
                Mot de passe oublié
              </Link>
            ) : null}

            <View style={{ marginTop: 28, marginBottom: 24 }}>
              <Button
                label={isLogin ? 'Entrer' : 'Créer le compte'}
                loadingLabel={isLogin ? 'Connexion…' : 'Création…'}
                onPress={() => void submit()}
                loading={loading}
                disabled={!canSubmit}
              />
            </View>
          </>
        ) : (
          <View style={styles.bioBottom}>
            <PressScale
              onPress={() => void loginWithBiometric()}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir avec ${bio.label}`}
              style={styles.bioBtnLg}>
              {bio.label.toLowerCase().includes('face') ? (
                <ScanFace color={color.primary} size={48} />
              ) : (
                <Fingerprint color={color.primary} size={48} />
              )}
            </PressScale>
            <Text style={styles.bioHint}>Ouvrir avec {bio.label}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: font.displayItalic, color: color.ivory, fontSize: 40, marginTop: 28, lineHeight: 44 },
  lede: { fontFamily: font.sans, color: color.mist, fontSize: 15, marginTop: 10, marginBottom: 8 },
  toggle: { flexDirection: 'row', gap: 18, marginTop: 28 },
  tog: { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  togOn: { borderBottomColor: color.brass },
  togTxt: { fontFamily: font.sansMed, color: color.brassMute, letterSpacing: 1.4, textTransform: 'uppercase', fontSize: 12 },
  togTxtOn: { color: color.brass },
  forgot: { marginTop: 16, fontFamily: font.sansMed, color: color.brass, fontSize: 13 },
  or: {
    fontFamily: font.sans,
    color: color.textMuted,
    textAlign: 'center',
    marginVertical: 16,
    fontSize: 13,
  },
  bioTop: { marginTop: 16, alignItems: 'center' },
  bioBottom: { marginTop: 48, alignItems: 'center', marginBottom: 32 },
  bioBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioBtnLg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: color.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioHint: { marginTop: 12, fontFamily: font.sansMed, color: color.textSecondary, fontSize: 13 },
});
