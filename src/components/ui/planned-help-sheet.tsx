import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { color, type as font } from '@/theme/tokens';
import { Button } from './button';
import { PressScale } from './press-scale';
import { Sheet } from './sheet';

const BULLETS = [
  'Une date future enregistre une dépense prévue : la poche n’est pas débitée tout de suite.',
  'Le jour prévu (UTC), le montant est débité si le solde est suffisant.',
  'Sinon, l’échéance est annulée automatiquement (solde insuffisant).',
  'Dès que la poche couvre le montant avant l’échéance, vous êtes prévenu et pouvez la régler tout de suite.',
  'Vous pouvez modifier ou annuler avant le jour J. Un rappel email part la veille.',
];

export function PlannedHelpSheet({
  open,
  onClose,
  onHidden,
}: {
  open: boolean;
  onClose: () => void;
  onHidden?: () => void;
}) {
  const { refreshMe } = useAuth();
  const [hide, setHide] = useState(false);
  const [saving, setSaving] = useState(false);

  const done = async () => {
    if (hide) {
      setSaving(true);
      try {
        await authApi.updateMe({ hidePlannedExpensesHelp: true });
        await refreshMe();
        onHidden?.();
      } catch {
        /* fermer quand même */
      } finally {
        setSaving(false);
      }
    }
    setHide(false);
    onClose();
  };

  return (
    <Sheet open={open} onClose={() => void done()} title="Prévoir une dépense">
      <View style={{ gap: 12, marginBottom: 20 }}>
        {BULLETS.map((t) => (
          <Text key={t} style={styles.p}>
            {t}
          </Text>
        ))}
      </View>
      <PressScale onPress={() => setHide((v) => !v)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: hide }}>
        <View style={[styles.box, hide && styles.boxOn]} />
        <Text style={styles.checkT}>Ne plus afficher</Text>
      </PressScale>
      <Button label={saving ? 'Enregistrement…' : 'Compris'} onPress={() => void done()} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  p: { fontFamily: font.sans, fontSize: 14, lineHeight: 21, color: color.textSecondary },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.white,
  },
  boxOn: { backgroundColor: color.primary, borderColor: color.primary },
  checkT: { fontFamily: font.sans, fontSize: 14, color: color.text },
});
