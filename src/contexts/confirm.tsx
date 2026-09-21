import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { color, type as font } from '@/theme/tokens';

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Confirmations maison : même feuille animée que le reste, pas la boîte système. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOpen(false);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Sheet open={open} onClose={() => settle(false)} title={options?.title}>
        {options?.body ? <Text style={styles.body}>{options.body}</Text> : null}
        <View style={styles.actions}>
          <Button
            label={options?.confirmLabel ?? 'Confirmer'}
            variant={options?.danger ? 'ember' : 'brass'}
            onPress={() => settle(true)}
          />
          <Button label={options?.cancelLabel ?? 'Annuler'} variant="line" onPress={() => settle(false)} />
        </View>
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

const styles = StyleSheet.create({
  body: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.mist,
    marginBottom: 22,
    marginTop: -6,
  },
  actions: { gap: 10 },
});
