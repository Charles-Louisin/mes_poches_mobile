import { useState } from 'react';
import { Tabs, Redirect, router } from 'expo-router';
import { AtelierTabBar } from '@/components/ui/atelier-tab-bar';
import { ComposeSheet } from '@/components/ui/compose-sheet';
import { useAuth } from '@/contexts/auth';
import { useReceiptScan } from '@/contexts/receipt-scan';
import { useToast } from '@/contexts/toast';
import { useVoiceNote } from '@/contexts/voice-note';
import { color } from '@/theme/tokens';

export default function TabsLayout() {
  const [compose, setCompose] = useState(false);
  const { ready, token, isPremium, requirePremium } = useAuth();
  const { startScan, scanning } = useReceiptScan();
  const { startVoice } = useVoiceNote();
  const toast = useToast();

  if (ready && !token) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Tabs
        tabBar={(props) => <AtelierTabBar {...props} onCompose={() => setCompose(true)} />}
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          sceneStyle: { backgroundColor: color.background },
        }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="categories" />
        <Tabs.Screen name="wallets" />
        <Tabs.Screen name="analytics" />
        <Tabs.Screen name="plus" />
      </Tabs>
      <ComposeSheet
        open={compose}
        imageDisabled={scanning}
        onClose={() => setCompose(false)}
        onText={() => {
          setCompose(false);
          router.push('/transactions/new');
        }}
        onImage={() => {
          setCompose(false);
          if (!isPremium) {
            toast('Le scan de ticket est réservé à Premium', 'info');
            requirePremium();
            return;
          }
          void startScan();
        }}
        onAudio={() => {
          setCompose(false);
          if (!isPremium) {
            toast('La dictée est réservée à Premium', 'info');
            requirePremium();
            return;
          }
          startVoice();
        }}
      />
    </>
  );
}
