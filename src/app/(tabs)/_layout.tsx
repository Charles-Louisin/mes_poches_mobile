import { useState } from 'react';
import { Tabs, Redirect, router } from 'expo-router';
import { AtelierTabBar } from '@/components/ui/atelier-tab-bar';
import { ComposeSheet } from '@/components/ui/compose-sheet';
import { useAuth } from '@/contexts/auth';
import { useReceiptScan } from '@/contexts/receipt-scan';
import { useVoiceNote } from '@/contexts/voice-note';
import { blockIfQuotaFull } from '@/components/subscription/quota-prompt';
import { color } from '@/theme/tokens';

export default function TabsLayout() {
  const [compose, setCompose] = useState(false);
  const { ready, token, user } = useAuth();
  const { startScan, scanning } = useReceiptScan();
  const { startVoice } = useVoiceNote();

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
          if (blockIfQuotaFull(user?.quotas, 'scans')) return;
          void startScan();
        }}
        onAudio={() => {
          setCompose(false);
          if (blockIfQuotaFull(user?.quotas, 'voice')) return;
          startVoice();
        }}
      />
    </>
  );
}
