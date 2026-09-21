import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastHost, type ToastTone } from '@/components/ui/toast-host';
import { getLastScreen, track } from '@/lib/telemetry';

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ToastTone>('info');
  const seq = useRef(0);

  const toast = useCallback((text: string, next: ToastTone = 'info') => {
    seq.current += 1;
    setId(seq.current);
    setTone(next);
    setMessage(text);
    if (next === 'err') {
      track('error', {
        screen: getLastScreen(),
        props: { element: 'toast', message: text.slice(0, 80) },
      });
    }
  }, []);

  const onDone = useCallback(() => setMessage(null), []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost id={id} message={message} tone={tone} onDone={onDone} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
