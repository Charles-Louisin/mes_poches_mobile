import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { walletApi } from '@/lib/api';
import { invalidateFinance } from '@/lib/query';
import { isPremiumRequiredError } from '@/lib/errors';
import { useToast } from '@/contexts/toast';
import { useTutorial } from '@/contexts/tutorial';
import { TutorialTarget } from '@/components/tutorial/tutorial-target';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ImageUpload } from '@/components/ui/image-upload';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { track } from '@/lib/telemetry';

export default function NewWalletScreen() {
  const toast = useToast();
  const { step, afterPocketCreated } = useTutorial();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast('Un nom, d’abord', 'err');
      return;
    }
    setLoading(true);
    try {
      const n = parseFloat(balance.replace(',', '.'));
      await walletApi.create({
        name: name.trim(),
        image_url: imageUrl,
        initial_balance: balance.trim() && !Number.isNaN(n) ? n : 0,
      });
      await invalidateFinance();
      toast('Poche créée', 'ok');
      track('wallet_create', { screen: 'wallets_new', props: { element: 'create' } });
      if (
        step === 'pocket-submit' ||
        step === 'pocket-name' ||
        step === 'pocket-image' ||
        step === 'pocket-balance'
      ) {
        afterPocketCreated();
      } else {
        router.replace('/(tabs)/wallets');
      }
    } catch (err) {
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
        return;
      }
      toast(err instanceof Error ? err.message : 'Impossible', 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Nouvelle poche" back />
      <View style={{ gap: 20 }}>
        <TutorialTarget id="wallet-image">
          <ImageUpload value={imageUrl} onChange={setImageUrl} endpoint="walletImage" label="Icône" />
        </TutorialTarget>
        <TutorialTarget id="wallet-name">
          <Field label="Nom" value={name} onChangeText={setName} placeholder="Cash, MTN, Orange…" placeholderTextColor="#B89A76" />
        </TutorialTarget>
        <TutorialTarget id="wallet-balance">
          <Field label="Solde actuel" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#B89A76" />
        </TutorialTarget>
        <TutorialTarget id="wallet-submit">
          <Button label="Créer la poche" loadingLabel="Création…" onPress={() => void submit()} loading={loading} />
        </TutorialTarget>
      </View>
    </Screen>
  );
}
