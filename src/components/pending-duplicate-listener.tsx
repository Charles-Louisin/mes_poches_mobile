import { useEffect } from 'react';
import { subscribePendingDuplicate } from 'sms-monitor';
import { useToast } from '@/contexts/toast';
import { canUseSmsNative } from '@/lib/sms-monitor';

export function PendingDuplicateListener() {
  const toast = useToast();

  useEffect(() => {
    if (!canUseSmsNative()) return;
    return subscribePendingDuplicate((alreadyValidated) => {
      toast(
        alreadyValidated
          ? 'Cette transaction a déjà été validée auparavant'
          : 'Cette transaction est déjà en attente de validation',
        alreadyValidated ? 'info' : 'ok'
      );
    });
  }, [toast]);

  return null;
}
