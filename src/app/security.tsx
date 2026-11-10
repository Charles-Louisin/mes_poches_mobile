import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { Fingerprint, KeyRound, ScanFace, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { twoFactorApi } from '@/lib/api';
import {
  authenticateBiometric,
  biometricAvailability,
  disableBiometricKind,
  enableBiometricKind,
  isBiometricKindEnabled,
  labelForKind,
  readBiometricCredentials,
  type BiometricKind,
} from '@/lib/biometrics';
import { clearDeviceTrust, saveDeviceTrust } from '@/lib/device-trust';
import { getErrorMessage } from '@/lib/errors';
import { track } from '@/lib/telemetry';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, radius, type as font } from '@/theme/tokens';

type Step = { purpose: 'enable' | 'disable'; emailHint: string } | null;

export default function SecurityScreen() {
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const enabled = Boolean(user?.twoFactorEnabled);
  const googleOnly = user?.authProvider === 'google';

  const [step, setStep] = useState<Step>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [bioKinds, setBioKinds] = useState<BiometricKind[]>([]);
  const [bioReady, setBioReady] = useState(false);
  const [bioFace, setBioFace] = useState(false);
  const [bioFinger, setBioFinger] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => {
      const avail = await biometricAvailability();
      setBioReady(avail.available && avail.enrolled);
      setBioKinds(avail.kinds);
      setBioFace(await isBiometricKindEnabled('face'));
      setBioFinger(await isBiometricKindEnabled('fingerprint'));
    })();
  }, []);

  const start = async (purpose: 'enable' | 'disable') => {
    if (sending) return;
    setSending(true);
    try {
      const res = await twoFactorApi.sendCode(purpose);
      setCode('');
      setStep({ purpose, emailHint: res.emailHint });
      toast(`Code envoyé à ${res.emailHint}`, 'ok');
    } catch (err) {
      toast(getErrorMessage(err, 'Envoi du code impossible'), 'err');
    } finally {
      setSending(false);
    }
  };

  const confirm = async () => {
    if (!step || code.length !== 6 || confirming) return;
    setConfirming(true);
    try {
      if (step.purpose === 'enable') {
        const res = await twoFactorApi.enable(code);
        if (res.deviceTrust) await saveDeviceTrust(res.deviceTrust);
        track('click', { screen: 'security', props: { element: '2fa-on' } });
        toast('Double authentification activée', 'ok');
      } else {
        await twoFactorApi.disable(code);
        await clearDeviceTrust();
        track('click', { screen: 'security', props: { element: '2fa-off' } });
        toast('Double authentification désactivée', 'ok');
      }
      setStep(null);
      setCode('');
      await refreshMe();
    } catch (err) {
      toast(getErrorMessage(err, 'Code incorrect'), 'err');
    } finally {
      setConfirming(false);
    }
  };

  const toggleBio = async (kind: 'face' | 'fingerprint') => {
    const on = kind === 'face' ? bioFace : bioFinger;
    const label = labelForKind(kind);
    if (on) {
      await disableBiometricKind(kind);
      if (kind === 'face') setBioFace(false);
      else setBioFinger(false);
      toast(`${label} désactivé`, 'ok');
      return;
    }
    const creds = await readBiometricCredentials();
    if (!creds) {
      toast('Reconnectez-vous une fois avec e-mail et mot de passe, puis réactivez', 'info');
      return;
    }
    const result = await authenticateBiometric(`Activer ${label}`);
    if (!result.success) {
      toast('Authentification annulée', 'info');
      return;
    }
    await enableBiometricKind(kind, creds.email, creds.password);
    if (kind === 'face') setBioFace(true);
    else setBioFinger(true);
    toast(`${label} activé pour la prochaine connexion`, 'ok');
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Sécurité" back />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={[styles.icon, enabled && styles.iconOn]}>
            <ShieldCheck color={enabled ? color.white : color.primary} size={22} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Double authentification</Text>
            <Text style={[styles.status, enabled && styles.statusOn]}>{enabled ? 'Activée' : 'Désactivée'}</Text>
          </View>
        </View>
        <Text style={styles.body}>
          À chaque connexion par mot de passe sur un nouvel appareil, un code à 6 chiffres est envoyé à votre e-mail.
          Même si quelqu’un découvre votre mot de passe, il ne peut pas entrer sans ce code.
        </Text>
        {googleOnly ? (
          <Text style={styles.note}>
            Vous vous connectez avec Google : votre compte est protégé par la sécurité de Google. La double authentification
            s’appliquera si vous définissez aussi un mot de passe.
          </Text>
        ) : null}

        {step ? (
          <View style={styles.stepBox}>
            <Field
              label={`Code envoyé à ${step.emailHint}`}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              onSubmitEditing={() => void confirm()}
            />
            <View style={{ height: 14 }} />
            <Button
              label={step.purpose === 'enable' ? 'Activer' : 'Désactiver'}
              loadingLabel="Vérification…"
              variant={step.purpose === 'enable' ? 'primary' : 'ember'}
              onPress={() => void confirm()}
              loading={confirming}
              disabled={code.length !== 6}
            />
            <PressScale onPress={() => setStep(null)} accessibilityRole="button" style={styles.cancel}>
              <Text style={styles.cancelT}>Annuler</Text>
            </PressScale>
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            <Button
              label={enabled ? 'Désactiver' : 'Activer la double authentification'}
              loadingLabel="Envoi du code…"
              variant={enabled ? 'secondary' : 'primary'}
              onPress={() => void start(enabled ? 'disable' : 'enable')}
              loading={sending}
              disabled={googleOnly && !enabled}
            />
          </View>
        )}
      </View>

      {Platform.OS !== 'web' && bioReady && (bioKinds.includes('face') || bioKinds.includes('fingerprint')) ? (
        <>
          <Text style={styles.section}>Déverrouillage rapide</Text>
          {bioKinds.includes('face') ? (
            <BioRow
              icon={<ScanFace color={color.primary} size={20} />}
              label={`Connexion ${labelForKind('face')}`}
              value={bioFace}
              onToggle={() => void toggleBio('face')}
            />
          ) : null}
          {bioKinds.includes('fingerprint') ? (
            <BioRow
              icon={<Fingerprint color={color.primary} size={20} />}
              label={`Connexion ${labelForKind('fingerprint')}`}
              value={bioFinger}
              onToggle={() => void toggleBio('fingerprint')}
            />
          ) : null}
        </>
      ) : null}

      <View style={styles.tip}>
        <KeyRound color={color.textSecondary} size={18} />
        <Text style={styles.tipT}>
          Mot de passe oublié ou appareil perdu ? Utilisez « Mot de passe oublié » sur l’écran de connexion : un code
          vous sera envoyé par e-mail.
        </Text>
      </View>
    </Screen>
  );
}

function BioRow({ icon, label, value, onToggle }: { icon: React.ReactNode; label: string; value: boolean; onToggle: () => void }) {
  return (
    <PressScale onPress={onToggle} style={styles.row} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <View style={styles.rowL}>
        {icon}
        <Text style={styles.rowT}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: color.primary, false: color.border }} thumbColor={color.white} />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.card, padding: 18, marginTop: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: color.primaryLight, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: color.primary },
  cardTitle: { fontFamily: font.sansSemi, fontSize: 17, color: color.text },
  status: { fontFamily: font.sansMed, fontSize: 13, color: color.textSecondary, marginTop: 2 },
  statusOn: { color: color.success },
  body: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  note: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.text, marginTop: 10 },
  stepBox: { marginTop: 18 },
  cancel: { alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 12 },
  cancelT: { fontFamily: font.sansMed, fontSize: 15, color: color.textSecondary },
  section: { fontFamily: font.sansSemi, fontSize: 15, color: color.text, marginTop: 28, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  rowL: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowT: { fontFamily: font.sansMed, fontSize: 16, color: color.text },
  tip: { flexDirection: 'row', gap: 10, marginTop: 28, paddingRight: 8 },
  tipT: { flex: 1, fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.textSecondary },
});
