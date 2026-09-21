import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { subscriptionApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { color, type as font } from '@/theme/tokens';

export default function PaymentSuccessScreen() {
  const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
  const { refreshMe } = useAuth();
  const [status, setStatus] = useState<'wait' | 'ok' | 'no'>('wait');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!transactionId) {
      setStatus('no');
      setDetail('Référence manquante.');
      return;
    }
    void (async () => {
      try {
        const res = await subscriptionApi.verifyPayment(transactionId);
        await refreshMe();
        setStatus(res.isPremium || res.status === 'ACCEPTED' || res.status === 'success' ? 'ok' : 'no');
        setDetail(res.isPremium ? 'Premium activé.' : `État : ${res.status}`);
      } catch (err) {
        setStatus('no');
        setDetail(err instanceof Error ? err.message : 'Vérification impossible');
      }
    })();
  }, [refreshMe, transactionId]);

  return (
    <Screen>
      <ScreenHeader title="Visa" back />
      <Text style={styles.title}>{status === 'wait' ? 'On vérifie le cachet…' : status === 'ok' ? 'Payé.' : 'Pas encore.'}</Text>
      <Text style={styles.body}>{detail}</Text>
      <View style={{ flex: 1 }} />
      <Button label="Retour à l’accueil" onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.displayItalic, fontSize: 36, color: color.ivory, marginBottom: 12 },
  body: { fontFamily: font.sans, fontSize: 16, color: color.mist, lineHeight: 24 },
});
