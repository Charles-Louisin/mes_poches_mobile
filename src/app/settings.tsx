import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Coins, Crown, Download, Fingerprint, Info, LogOut, ScanFace, User } from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { type ExportFormat } from '@/lib/api';
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
import { WALLET_CURRENCIES } from '@/lib/currencies';
import { shareExport } from '@/lib/download';
import { isPremiumRequiredError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { CsvIcon, ExcelIcon, PdfIcon } from '@/components/ui/export-icons';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { OptionList } from '@/components/ui/option-list';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { PressScale } from '@/components/ui/press-scale';
import { SmsPermissionSettings } from '@/components/settings/sms-permission-settings';
import { color, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';

const EXPORT_OPTIONS: { value: ExportFormat; label: string; Icon: typeof CsvIcon }[] = [
  { value: 'csv', label: 'CSV', Icon: CsvIcon },
  { value: 'pdf', label: 'PDF', Icon: PdfIcon },
  { value: 'xlsx', label: 'Excel (XLSX)', Icon: ExcelIcon },
];

export default function SettingsScreen() {
  const { logout, isPremium, isOnTrial, requirePremium, user } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [bioKinds, setBioKinds] = useState<BiometricKind[]>([]);
  const [bioFace, setBioFace] = useState(false);
  const [bioFinger, setBioFinger] = useState(false);
  const [bioReady, setBioReady] = useState(false);

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

  const toggleBioKind = async (kind: 'face' | 'fingerprint') => {
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

  const out = async () => {
    const ok = await confirm({
      title: 'Se déconnecter ?',
      body: 'Vos données restent sur votre compte. Vous pourrez vous reconnecter à tout moment.',
      confirmLabel: 'Se déconnecter',
      cancelLabel: 'Annuler',
      danger: true,
    });
    if (!ok) return;
    track('logout', { screen: 'settings', props: { element: 'logout' } });
    setLeaving(true);
    try {
      await logout();
      toast('Session close', 'ok');
      router.replace('/(auth)/login');
    } finally {
      setLeaving(false);
    }
  };

  const runExport = async (format: ExportFormat) => {
    if (exporting) return;
    if (!isPremium) {
      setExportOpen(false);
      toast('L’export est réservé à Premium', 'info');
      requirePremium();
      return;
    }
    try {
      setExporting(format);
      const ext = format === 'xlsx' ? 'xlsx' : format;
      await shareExport(`/export/transactions?format=${format}`, `mes-poches-${Date.now()}.${ext}`);
      track('export', { screen: 'settings', props: { element: format } });
      toast('Enregistré dans Téléchargements', 'ok');
      setExportOpen(false);
    } catch (e) {
      if (isPremiumRequiredError(e)) {
        setExportOpen(false);
        requirePremium();
      } else {
        toast(e instanceof Error ? e.message : 'Erreur export', 'err');
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Réglages" back />
      <PressScale onPress={() => setOpen(true)} style={styles.row}>
        <View style={styles.rowL}>
          <Coins color={color.primary} size={18} />
          <Text style={styles.k}>Devise</Text>
        </View>
        <Text style={styles.v}>{currency}</Text>
      </PressScale>
      <PressScale onPress={() => router.push('/subscription')} style={styles.row}>
        <View style={styles.rowL}>
          <Crown color={color.primary} size={18} />
          <Text style={styles.k}>{isOnTrial ? 'Essai en cours' : isPremium ? 'Premium' : 'Passer Premium'}</Text>
        </View>
        <Text style={styles.v}>ouvrir</Text>
      </PressScale>
      <PressScale onPress={() => router.push('/profile')} style={styles.row}>
        <View style={styles.rowL}>
          <User color={color.primary} size={18} />
          <Text style={styles.k}>Profil</Text>
        </View>
        <Text style={styles.v}>identité</Text>
      </PressScale>
      {Platform.OS !== 'web' && bioReady && bioKinds.includes('face') ? (
        <PressScale
          onPress={() => void toggleBioKind('face')}
          style={styles.row}
          accessibilityRole="switch"
          accessibilityState={{ checked: bioFace }}>
          <View style={styles.rowL}>
            <ScanFace color={color.primary} size={18} />
            <Text style={styles.k}>Connexion {labelForKind('face')}</Text>
          </View>
          <Text style={styles.v}>{bioFace ? 'activée' : 'désactivée'}</Text>
        </PressScale>
      ) : null}
      {Platform.OS !== 'web' && bioReady && bioKinds.includes('fingerprint') ? (
        <PressScale
          onPress={() => void toggleBioKind('fingerprint')}
          style={styles.row}
          accessibilityRole="switch"
          accessibilityState={{ checked: bioFinger }}>
          <View style={styles.rowL}>
            <Fingerprint color={color.primary} size={18} />
            <Text style={styles.k}>Connexion {labelForKind('fingerprint')}</Text>
          </View>
          <Text style={styles.v}>{bioFinger ? 'activée' : 'désactivée'}</Text>
        </PressScale>
      ) : null}
      <PressScale onPress={() => router.push('/about')} style={styles.row}>
        <View style={styles.rowL}>
          <Info color={color.primary} size={18} />
          <Text style={styles.k}>À propos</Text>
        </View>
        <Text style={styles.v}>Mes Poches</Text>
      </PressScale>
      <PressScale
        onPress={() => {
          if (!isPremium) {
            toast('L’export est réservé à Premium', 'info');
            requirePremium();
            return;
          }
          setExportOpen(true);
        }}
        style={styles.row}>
        <View style={styles.exportHead}>
          <Download color={color.primary} size={18} />
          <Text style={styles.k}>Exporter tout</Text>
          {!isPremium ? <GoldDiamond size={16} /> : null}
        </View>
        <Text style={styles.v}>CSV · PDF · XLSX</Text>
      </PressScale>

      <View style={{ height: 28 }} />
      <SmsPermissionSettings />
      <View style={{ height: 28 }} />
      <Button
        label="Se déconnecter"
        loadingLabel="Déconnexion…"
        variant="ember"
        icon={<LogOut color={color.white} size={18} />}
        onPress={() => void out()}
        loading={leaving}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title="Devise d’affichage">
        <OptionList
          options={WALLET_CURRENCIES.map((c) => ({ value: c.value, label: c.label }))}
          value={currency}
          onChange={(v) => {
            void setCurrency(v as typeof currency);
            setOpen(false);
          }}
        />
      </Sheet>
      <Sheet open={exportOpen} onClose={() => !exporting && setExportOpen(false)} title="Exporter tout">
        <Text style={styles.exportHint}>Le grand livre complet, dans le format de votre choix.</Text>
        <OptionList
          options={EXPORT_OPTIONS.map((o) => ({
            value: o.value,
            label: exporting === o.value ? `${o.label} — en cours…` : o.label,
            icon: <o.Icon size={20} />,
            disabled: !!exporting,
          }))}
          onChange={(v) => void runExport(v as ExportFormat)}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
  rowL: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 12 },
  k: { fontFamily: font.sansMed, color: color.ivory, fontSize: 16 },
  exportHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 12 },
  v: { fontFamily: font.sans, color: color.brass, fontSize: 14 },
  exportHint: { fontFamily: font.sans, color: color.textSecondary, fontSize: 14, marginBottom: 8, lineHeight: 20 },
});
