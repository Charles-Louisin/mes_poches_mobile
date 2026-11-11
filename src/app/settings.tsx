import { useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ChevronRight,
  Coins,
  Crown,
  Download,
  Info,
  LogOut,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useCurrency } from '@/contexts/currency';
import { useToast } from '@/contexts/toast';
import { type ExportFormat } from '@/lib/api';
import { listExportPeriods, type ExportGrain } from '@/lib/export-periods';
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

/** AAAA-MM-JJ en heure locale (le nom du fichier et le titre suivent les dates vues par l’utilisateur). */
const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Ligne de réglage : icône, libellé, valeur courante et chevron (navigation). */
function Row({
  icon,
  label,
  value,
  onPress,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  return (
    <PressScale onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label}>
      <View style={styles.rowL}>
        {icon}
        <Text style={styles.k}>{label}</Text>
        {trailing}
      </View>
      {value ? <Text style={styles.v} numberOfLines={1}>{value}</Text> : null}
      <ChevronRight color={color.textMuted} size={18} />
    </PressScale>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.groupT}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

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

  const planLabel = isOnTrial
    ? 'Essai en cours'
    : isPremium
      ? user?.tierLabel || 'Premium'
      : 'Gratuit';
  const exportValue = isPremium
    ? visibleExports.map((o) => (o.value === 'xlsx' ? 'Excel' : o.label)).join(' · ')
    : 'Premium';

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
      toast('Vous êtes déconnecté', 'ok');
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
      let span: { from: string; to: string } | null = null;
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
        // Dates locales de début et de fin (incluse) : titre du document et nom du fichier.
        const first = new Date(Math.min(...chosen.map((p) => new Date(p.start).getTime())));
        const last = new Date(Math.max(...chosen.map((p) => new Date(p.end).getTime())) - 1);
        span = { from: localYmd(first), to: localYmd(last) };
        query += `&from=${span.from}&to=${span.to}`;
      }
      const fileName = span
        ? `mes-poches-releve-${span.from}${span.to !== span.from ? `_au_${span.to}` : ''}.${ext}`
        : `mes-poches-releve-complet-${localYmd(new Date())}.${ext}`;
      const dest = await shareExport(`/export/transactions?format=${format}${query}`, fileName);
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

      <Group title="Compte">
        <Row icon={<User color={color.primary} size={18} />} label="Profil" value={user?.name || user?.email} onPress={() => router.push('/profile')} />
        <Row icon={<Crown color={color.primary} size={18} />} label="Abonnement" value={planLabel} onPress={() => router.push('/subscription')} />
        <Row icon={<Coins color={color.primary} size={18} />} label="Devise d’affichage" value={currency} onPress={() => setOpen(true)} />
      </Group>

      <Group title="Sécurité">
        <Row
          icon={<ShieldCheck color={color.primary} size={18} />}
          label="Double authentification"
          value={user?.twoFactorEnabled ? 'Activée' : 'À activer'}
          onPress={() => router.push('/security' as never)}
        />
      </Group>

      <Group title="Données">
        <Row
          icon={<Download color={color.primary} size={18} />}
          label="Exporter"
          value={exportValue}
          trailing={!isPremium ? <GoldDiamond size={14} /> : null}
          onPress={() => {
            if (!isPremium) {
              toast('L’export est réservé à Premium', 'info');
              requirePremium();
              return;
            }
            setExportOpen(true);
          }}
        />
      </Group>

      <Group title="Aide">
        <TutorialTarget id="settings-feedback">
          <Row icon={<MessageCircle color={color.primary} size={18} />} label="Donner mon avis" onPress={() => router.push('/feedback')} />
        </TutorialTarget>
        {user?.role === 'admin' ? (
          <Row icon={<MessageCircle color={color.primary} size={18} />} label="Messages reçus (admin)" onPress={() => router.push('/admin-messages')} />
        ) : null}
        {Platform.OS !== 'web' ? (
          <Row icon={<RefreshCw color={color.primary} size={18} />} label="Rechercher une mise à jour" onPress={() => router.push('/app-update' as never)} />
        ) : null}
        <Row icon={<Info color={color.primary} size={18} />} label="À propos de Mes Poches" onPress={() => router.push('/about')} />
      </Group>

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
      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Exporter mes transactions">
        <Text style={styles.exportHint}>
          {user?.canExportRange
            ? 'Cochez les mois, les semaines ou les jours depuis votre inscription, puis le format. Les articles d’un reçu sont inclus.'
            : 'Toutes vos transactions, dans le format de votre choix. Les articles d’un reçu sont inclus.'}
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
  section: { marginTop: 20 },
  groupT: { fontFamily: font.sansSemi, fontSize: 13, color: color.textSecondary, marginBottom: 6 },
  groupBody: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  rowL: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  k: { fontFamily: font.sansMed, color: color.text, fontSize: 16, flexShrink: 1 },
  v: { fontFamily: font.sans, color: color.textSecondary, fontSize: 14, maxWidth: "42%" },
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
