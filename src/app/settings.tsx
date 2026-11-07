import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Coins,
  Crown,
  Download,
  Fingerprint,
  Info,
  LogOut,
  MessageCircle,
  RefreshCw,
  ScanFace,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { type ExportFormat } from '@/lib/api';
import { listExportPeriods, type ExportGrain } from '@/lib/export-periods';
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
import { exportSavedToast, shareExport } from '@/lib/download';
import { quotaPromptFromError } from '@/components/subscription/quota-prompt';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { CsvIcon, ExcelIcon, PdfIcon } from '@/components/ui/export-icons';
import { GoldDiamond } from '@/components/ui/gold-diamond';
import { OptionList } from '@/components/ui/option-list';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Sheet } from '@/components/ui/sheet';
import { PressScale } from '@/components/ui/press-scale';
import { color, type as font } from '@/theme/tokens';
import { track } from '@/lib/telemetry';
import { TutorialTarget } from '@/components/tutorial/tutorial-target';

const EXPORT_OPTIONS: { value: ExportFormat; label: string; Icon: typeof CsvIcon }[] = [
  { value: 'csv', label: 'CSV', Icon: CsvIcon },
  { value: 'pdf', label: 'PDF', Icon: PdfIcon },
  { value: 'xlsx', label: 'Excel (XLSX)', Icon: ExcelIcon },
];

export default function SettingsScreen() {
  const { logout, isPremium, isOnTrial, requirePremium, user } = useAuth();
  const [exportGrain, setExportGrain] = useState<'all' | ExportGrain>('all');
  const [exportKeys, setExportKeys] = useState<string[]>([]);
  const exportFormats = user?.exportFormats;
  const visibleExports = exportFormats?.length
    ? EXPORT_OPTIONS.filter((o) => exportFormats.includes(o.value))
    : EXPORT_OPTIONS;
  const exportPeriods = useMemo(
    () => (exportGrain === 'all' ? [] : listExportPeriods(user?.created_at, exportGrain)),
    [exportGrain, user?.created_at]
  );
  const { currency, setCurrency } = useCurrency();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<Partial<Record<ExportFormat, boolean>>>({});
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
    if (exporting[format]) return;
    if (!isPremium) {
      setExportOpen(false);
      toast('L’export est réservé à Premium', 'info');
      requirePremium();
      return;
    }
    try {
      setExporting((prev) => ({ ...prev, [format]: true }));
      const ext = format === 'xlsx' ? 'xlsx' : format;
      let query = '';
      if (user?.canExportRange && exportGrain !== 'all') {
        const chosen = exportPeriods.filter((period) => exportKeys.includes(period.key));
        if (!chosen.length) {
          toast('Cochez au moins un mois, une semaine ou un jour', 'info');
          return;
        }
        if (chosen.length > 800) {
          toast('800 périodes maximum. Choisissez Tout, ou moins de jours.', 'info');
          return;
        }
        query = `&ranges=${encodeURIComponent(chosen.map((period) => `${period.start}..${period.end}`).join(','))}`;
      }
      const dest = await shareExport(`/export/transactions?format=${format}${query}`, `mes-poches-${Date.now()}.${ext}`);
      track('export', { screen: 'settings', props: { element: format } });
      const saved = exportSavedToast(dest);
      toast(saved.message, saved.tone);
      setExportOpen(false);
    } catch (e) {
      if (quotaPromptFromError(e)) {
        setExportOpen(false);
        return;
      }
      if (isPremiumRequiredError(e)) {
        setExportOpen(false);
        requirePremium();
      } else {
        toast(getErrorMessage(e, 'Erreur export'), 'err');
      }
    } finally {
      setExporting((prev) => ({ ...prev, [format]: false }));
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
      <TutorialTarget id="settings-feedback">
        <PressScale onPress={() => router.push('/feedback')} style={styles.row}>
          <View style={styles.rowL}>
            <MessageCircle color={color.primary} size={18} />
            <Text style={styles.k}>Votre avis</Text>
          </View>
          <Text style={styles.v}>écrire</Text>
        </PressScale>
      </TutorialTarget>
      {user?.role === 'admin' ? (
        <PressScale onPress={() => router.push('/admin-messages')} style={styles.row}>
          <View style={styles.rowL}>
            <MessageCircle color={color.primary} size={18} />
            <Text style={styles.k}>Messages reçus</Text>
          </View>
          <Text style={styles.v}>admin</Text>
        </PressScale>
      ) : null}
      {Platform.OS !== 'web' ? (
        <PressScale onPress={() => router.push('/app-update' as never)} style={styles.row}>
          <View style={styles.rowL}>
            <RefreshCw color={color.primary} size={18} />
            <Text style={styles.k}>Mise à jour</Text>
          </View>
          <Text style={styles.v}>vérifier</Text>
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
      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Exporter tout">
        <Text style={styles.exportHint}>
          {user?.canExportRange
            ? 'Cochez les mois, les semaines ou les jours depuis votre inscription, puis le format. Les articles d’un reçu sont inclus.'
            : 'Le grand livre complet, dans le format de votre choix. Les articles d’un reçu sont inclus.'}
        </Text>
        {user?.canExportRange ? (
          <View>
            <View style={styles.ranges}>
              {(
                [
                  { id: 'all' as const, label: 'Tout' },
                  { id: 'month' as const, label: 'Mois' },
                  { id: 'week' as const, label: 'Semaines' },
                  { id: 'day' as const, label: 'Jours' },
                ]
              ).map((item) => {
                const on = exportGrain === item.id;
                return (
                  <PressScale
                    key={item.id}
                    onPress={() => {
                      setExportGrain(item.id);
                      setExportKeys([]);
                    }}
                    style={[styles.range, on && styles.rangeOn]}>
                    <Text style={[styles.rangeT, on && styles.rangeTon]}>{item.label}</Text>
                  </PressScale>
                );
              })}
            </View>
            {exportGrain !== 'all' ? (
              <>
                <PressScale
                  onPress={() =>
                    setExportKeys(exportKeys.length === exportPeriods.length ? [] : exportPeriods.map((p) => p.key))
                  }
                  style={styles.selectAll}>
                  <Text style={styles.selectAllT}>
                    {exportKeys.length === exportPeriods.length ? 'Tout décocher' : 'Tout cocher'}
                  </Text>
                </PressScale>
                <ScrollView style={styles.periodList} nestedScrollEnabled keyboardShouldPersistTaps="always">
                  {exportPeriods.map((period, index) => {
                    const on = exportKeys.includes(period.key);
                    const showGroup = !!period.group && period.group !== exportPeriods[index - 1]?.group;
                    return (
                      <View key={period.key}>
                        {showGroup ? <Text style={styles.group}>{period.group}</Text> : null}
                        <PressScale
                          onPress={() =>
                            setExportKeys((prev) =>
                              prev.includes(period.key) ? prev.filter((key) => key !== period.key) : [...prev, period.key]
                            )
                          }
                          style={styles.period}>
                          <View style={[styles.box, on && styles.boxOn]} />
                          <Text style={styles.periodT}>{period.label}</Text>
                        </PressScale>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
          </View>
        ) : null}
        <OptionList
          options={visibleExports.map((o) => ({
            value: o.value,
            label: exporting[o.value] ? `${o.label} — en cours…` : o.label,
            icon: <o.Icon size={20} />,
            disabled: !!exporting[o.value],
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
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  range: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: color.surface },
  rangeOn: { backgroundColor: color.primary },
  rangeT: { fontFamily: font.sansMed, fontSize: 13, color: color.text },
  rangeTon: { color: color.white },
  selectAll: { alignSelf: 'flex-start', marginBottom: 6 },
  selectAllT: { fontFamily: font.sansMed, fontSize: 13, color: color.primary },
  periodList: { maxHeight: 240, marginBottom: 8 },
  group: {
    fontFamily: font.sansMed,
    fontSize: 12,
    color: color.textMuted,
    marginTop: 10,
    marginBottom: 2,
  },
  period: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  periodT: { fontFamily: font.sans, fontSize: 15, color: color.text, flex: 1 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.white,
  },
  boxOn: { backgroundColor: color.primary, borderColor: color.primary },
});
