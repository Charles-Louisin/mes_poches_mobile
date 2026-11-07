import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/errors';
import { QUOTA_REACHED_CODE, type PaidTier } from '@/lib/planLimits';
import { color, type as font } from '@/theme/tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

export type QuotaPromptInfo = {
  message: string;
  nextTier?: PaidTier | null;
  nextLabel?: string | null;
  nextPriceXaf?: number | null;
};

type Listener = (info: QuotaPromptInfo) => void;
let listener: Listener | null = null;

export function blockIfQuotaFull(
  quotas: { scans?: QuotaPromptSnap; voice?: QuotaPromptSnap } | undefined,
  key: 'scans' | 'voice'
): boolean {
  const q = quotas?.[key];
  if (!q || q.limit == null || q.used < q.limit) return false;
  const when = q.period === 'month' ? ' ce mois-ci' : '';
  showQuotaPrompt({
    message: `Vous avez atteint votre limite de ${q.limit} ${q.label}${when}.`,
    nextTier: q.nextTier,
    nextLabel: q.nextLabel,
    nextPriceXaf: q.nextPriceXaf,
  });
  return true;
}

type QuotaPromptSnap = {
  label: string;
  used: number;
  limit: number | null;
  period?: 'month' | 'total';
  nextTier?: PaidTier | null;
  nextLabel?: string | null;
  nextPriceXaf?: number | null;
};

export function showQuotaPrompt(info: QuotaPromptInfo) {
  listener?.(info);
}

export function quotaPromptFromError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.code !== QUOTA_REACHED_CODE) return false;
  const data = (err.data ?? {}) as {
    nextTier?: PaidTier | null;
    nextLabel?: string | null;
    nextPriceXaf?: number | null;
  };
  if (!listener) return false;
  listener({
    message: err.message,
    nextTier: data.nextTier,
    nextLabel: data.nextLabel,
    nextPriceXaf: data.nextPriceXaf,
  });
  return true;
}

export function QuotaPromptHost() {
  const [info, setInfo] = useState<QuotaPromptInfo | null>(null);

  useEffect(() => {
    listener = (next) => setInfo(next);
    return () => {
      if (listener) listener = null;
    };
  }, []);

  const close = () => setInfo(null);

  return (
    <Sheet open={!!info} onClose={close} title="Limite atteinte">
      <Text style={styles.body}>{info?.message}</Text>
      {info?.nextTier ? (
        <Button
          label={
            info.nextPriceXaf
              ? `Passer à ${info.nextLabel} · ${info.nextPriceXaf.toLocaleString('fr-FR')} F / mois`
              : `Passer à ${info.nextLabel}`
          }
          onPress={() => {
            const tier = info.nextTier;
            close();
            router.push(`/subscription/payment?tier=${tier}`);
          }}
        />
      ) : (
        <Button label="Compris" onPress={close} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: font.sans,
    fontSize: 15,
    lineHeight: 22,
    color: color.textSecondary,
    marginBottom: 16,
  },
});
