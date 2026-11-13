import { useState } from 'react';
import { router } from 'expo-router';
import { CategoryForm } from '@/components/category-form';
import { quotaPromptFromError } from '@/components/subscription/quota-prompt';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/contexts/toast';
import { useTutorial } from '@/contexts/tutorial';
import { categoryApi } from '@/lib/api';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { invalidateFinance } from '@/lib/query';

export default function NewCategoryScreen() {
  const toast = useToast();
  const { step, afterCategoryCreated } = useTutorial();
  const [loading, setLoading] = useState(false);

  return (
    <Screen scroll keyboardAware>
      <ScreenHeader title="Nouvelle catégorie" back />
      <CategoryForm
        submitLabel="Créer la catégorie"
        loading={loading}
        onSubmit={async (draft) => {
          setLoading(true);
          try {
            await categoryApi.create(draft);
            await invalidateFinance();
            toast('Catégorie créée', 'ok');
            if (step === 'category-page') afterCategoryCreated();
            else router.back();
          } catch (err) {
            if (quotaPromptFromError(err)) return;
            if (isPremiumRequiredError(err)) {
              toast(err.message, 'info');
              router.push('/subscription');
            } else toast(getErrorMessage(err, 'Création impossible'), 'err');
          } finally {
            setLoading(false);
          }
        }}
      />
    </Screen>
  );
}
