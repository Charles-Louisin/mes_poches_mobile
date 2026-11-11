import { StyleSheet, View } from 'react-native';
import { CsvIcon, ExcelIcon, PdfIcon } from './export-icons';
import { GoldDiamond } from './gold-diamond';
import { Chip } from './chip';
import { useState } from 'react';
import { type ExportFormat } from '@/lib/api';
import { exportSavedToast, shareExport } from '@/lib/download';
import { quotaPromptFromError } from '@/components/subscription/quota-prompt';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { color } from '@/theme/tokens';

const FORMATS: { key: ExportFormat; label: string; Icon: typeof CsvIcon }[] = [
  { key: 'csv', label: 'CSV', Icon: CsvIcon },
  { key: 'pdf', label: 'PDF', Icon: PdfIcon },
  { key: 'xlsx', label: 'Excel', Icon: ExcelIcon },
];

export function TxExportRow({ transactionId }: { transactionId: string }) {
  const { isPremium, requirePremium, user } = useAuth();
  const formats = user?.exportFormats?.length
    ? FORMATS.filter((f) => user.exportFormats!.includes(f.key))
    : FORMATS;
  const toast = useToast();
  const [busy, setBusy] = useState<Partial<Record<ExportFormat, boolean>>>({});

  const run = async (format: ExportFormat) => {
    if (busy[format]) return;
    if (!isPremium) {
      toast(`Export ${format.toUpperCase()} — Premium requis`, 'info');
      requirePremium();
      return;
    }
    setBusy((prev) => ({ ...prev, [format]: true }));
    try {
      const dest = await shareExport(
        `/export/transactions/${transactionId}?format=${format}`,
        `mes-poches-operation-${transactionId.slice(-6)}.${format}`
      );
      const saved = exportSavedToast(dest);
      toast(saved.message, saved.tone);
    } catch (err) {
      if (quotaPromptFromError(err)) return;
      if (isPremiumRequiredError(err)) requirePremium();
      else toast(getErrorMessage(err, 'Erreur export'), 'err');
    } finally {
      setBusy((prev) => ({ ...prev, [format]: false }));
    }
  };

  return (
    <View style={styles.wrap}>
      {!isPremium ? (
        <View style={styles.pro}>
          <GoldDiamond size={14} />
        </View>
      ) : null}
      <View style={styles.row}>
        {formats.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            icon={<f.Icon size={14} />}
            loading={!!busy[f.key]}
            onPress={() => void run(f.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  pro: { alignSelf: 'flex-end', marginBottom: 6 },
});
