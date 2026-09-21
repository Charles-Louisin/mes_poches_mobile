import { useEffect, type ReactNode } from 'react';
import { useToast } from '@/contexts/toast';
import { onSessionChange } from '@/lib/session';

export function SessionGuard({ children }: { children: ReactNode }) {
  const toast = useToast();

  useEffect(() => {
    return onSessionChange((reason) => {
      if (reason === 'expired') toast('Session expirée. Reconnectez-vous.', 'info');
    });
  }, [toast]);

  return <>{children}</>;
}
