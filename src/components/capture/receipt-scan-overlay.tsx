import { ActivityIndicator, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { color, radius, type as font } from '@/theme/tokens';

export type ScanPhase = 'idle' | 'scanning' | 'success' | 'error';

export function ReceiptScanOverlay({
  open,
  phase,
  imagePreview,
  message,
  onClose,
  onCancel,
  onRetry,
}: {
  open: boolean;
  phase: ScanPhase;
  imagePreview: string | null;
  message: string;
  onClose: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (!open) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={phase === 'scanning' ? onCancel : onClose}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <View style={styles.preview}>
            {imagePreview ? (
              <Image source={{ uri: imagePreview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Text style={styles.prep}>Préparation…</Text>
            )}
            {phase === 'scanning' ? <View style={styles.scanWash} /> : null}
            {phase === 'success' ? (
              <View style={styles.successWash}>
                <CheckCircle2 color={color.success} size={56} />
              </View>
            ) : null}
            {phase === 'error' ? (
              <View style={styles.errorWash}>
                <AlertCircle color={color.danger} size={56} />
              </View>
            ) : null}
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              {phase === 'scanning' ? <ActivityIndicator color={color.primary} /> : null}
              <Text style={styles.title}>
                {phase === 'scanning' ? 'Lecture du ticket' : phase === 'success' ? 'Ticket lu' : 'Échec'}
              </Text>
            </View>
            <Text style={styles.msg}>{message}</Text>
            {phase === 'scanning' ? (
              <>
                <Text style={styles.hint}>Montants et libellés en cours d’extraction…</Text>
                <Button label="Arrêter le traitement" variant="secondary" onPress={onCancel} />
              </>
            ) : null}
            {phase === 'success' ? (
              <Text style={styles.ok}>Redirection vers les transactions à valider…</Text>
            ) : null}
            {phase === 'error' ? (
              <View style={{ gap: 10 }}>
                <Button label="Réessayer" onPress={onRetry} disabled={!imagePreview} />
                <Button label="Fermer" variant="ghost" onPress={onClose} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: color.white,
    borderRadius: radius.largeCard,
    overflow: 'hidden',
  },
  preview: {
    height: 280,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prep: { fontFamily: font.sans, color: color.textMuted },
  scanWash: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(37,99,235,0.28)' },
  successWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18,183,106,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(240,68,56,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 20, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontFamily: font.sansSemi, fontSize: 16, color: color.text, textAlign: 'center' },
  msg: { fontFamily: font.sans, fontSize: 14, color: color.textSecondary, textAlign: 'center', lineHeight: 20 },
  hint: { fontFamily: font.sans, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  ok: { fontFamily: font.sansMed, fontSize: 12, color: color.success, textAlign: 'center' },
});
