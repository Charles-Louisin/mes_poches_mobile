import { StyleSheet, View } from 'react-native';
import { CsvIcon, ExcelIcon, PdfIcon } from './export-icons';
import { GoldDiamond } from './gold-diamond';
import { Chip } from './chip';
import { useState } from 'react';
import { type ExportFormat } from '@/lib/api';
import { shareExport } from '@/lib/download';
import { isPremiumRequiredError } from '@/lib/errors';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { color } from '@/theme/tokens';

const FORMATS: { key: ExportFormat; label: string; Icon: typeof CsvIcon }[] = [
  { key: 'csv', label: 'CSV', Icon: CsvIcon },
  { key: 'pdf', label: 'PDF', Icon: PdfIcon },
  { key: 'xlsx', label: 'Excel', Icon: ExcelIcon },
];

export function TxExportRow({ transactionId }: { transactionId: string }) {
  const { isPremium, requirePremium } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    if (busy) return;
    if (!isPremium) {
      toast(`Export ${format.toUpperCase()} — Premium requis`, 'info');
      requirePremium();
      return;
    }
    setBusy(format);
    try {
      await shareExport(
        `/export/transactions/${transactionId}?format=${format}`,
        `transaction-${transactionId.slice(-8)}.${format}`
      );
      toast('Enregistré dans Téléchargements', 'ok');
    } catch (err) {
      if (isPremiumRequiredError(err)) requirePremium();
      else toast(err instanceof Error ? err.message : 'Erreur export', 'err');
    } finally {
      setBusy(null);
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
        {FORMATS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            icon={<f.Icon size={14} />}
            loading={busy === f.key}
            disabled={!!busy && busy !== f.key}
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
