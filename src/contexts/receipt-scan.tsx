import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { pendingTransactionApi } from '@/lib/api';
import { compressImageForScan } from '@/lib/image-compress';
import { isAbortError, isTimeoutError } from '@/lib/errors';
import { formatScanError } from '@/lib/scan-errors';
import { notifyTransactionReady } from '@/lib/pending-notify';
import { invalidateFinance } from '@/lib/query';
import { useAuth } from '@/contexts/auth';
import { ReceiptScanOverlay, type ScanPhase } from '@/components/capture/receipt-scan-overlay';
import { ReceiptSourceSheet } from '@/components/capture/receipt-source-sheet';

type Source = 'camera' | 'gallery';

type ReceiptScanContextValue = {
  startScan: () => Promise<boolean>;
  scanning: boolean;
};

const ReceiptScanContext = createContext<ReceiptScanContextValue | null>(null);

export function ReceiptScanProvider({ children }: { children: ReactNode }) {
  const { isPremium, requirePremium } = useAuth();
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const pendingImage = useRef<{ uri: string } | null>(null);
  const scanAbort = useRef<AbortController | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceResolver = useRef<((source: Source | null) => void) | null>(null);

  const askSource = useCallback((): Promise<Source | null> => {
    return new Promise((resolve) => {
      sourceResolver.current = resolve;
      setSourceOpen(true);
    });
  }, []);

  const answerSource = useCallback((source: Source | null) => {
    setSourceOpen(false);
    const resolver = sourceResolver.current;
    sourceResolver.current = null;
    resolver?.(source);
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setImagePreview(null);
    setMessage('');
    pendingImage.current = null;
  }, []);

  const cancelScan = useCallback(() => {
    scanAbort.current?.abort();
    scanAbort.current = null;
    reset();
  }, [reset]);

  const processImage = useCallback(
    async (uri: string) => {
      pendingImage.current = { uri };
      setImagePreview(uri);
      setPhase('scanning');
      setMessage('Analyse de votre reçu en cours…');
      const controller = new AbortController();
      scanAbort.current?.abort();
      scanAbort.current = controller;

      try {
        const { image, mimeType, previewUri } = await compressImageForScan(uri);
        if (controller.signal.aborted) return false;
        setImagePreview(previewUri);
        const created = await pendingTransactionApi.aiScan(image, mimeType, controller.signal);
        if (controller.signal.aborted) return false;
        const count = created.length;
        const expense = created.filter((t) => t.type === 'expense').length;
        const income = created.filter((t) => t.type === 'income').length;
        setPhase('success');
        const lowConf = created.some((t) => t.confidence < 0.75 || !!t.low_confidence_warning);
        const lineCount = created.reduce((s, t) => s + (t.ai_items?.length ?? 0), 0);
        setMessage(
          lowConf
            ? "Certaines informations n'ont pas pu être reconnues avec certitude."
            : expense && income
              ? `${expense} dépense(s) et ${income} revenu(s) · ${lineCount} lignes`
              : count === 1 && lineCount > 1
                ? `1 transaction · ${lineCount} articles`
                : count === 1
                  ? '1 transaction détectée'
                  : `${count} transactions détectées`
        );
        const readyLabel =
          expense && income
            ? `${expense} dépense(s) et ${income} revenu(s) à valider`
            : count > 1
              ? `${count} transactions prêtes à valider`
              : created[0]?.description || 'Ticket prêt à valider';
        void notifyTransactionReady(readyLabel);
        pendingImage.current = null;
        await invalidateFinance();
        setTimeout(() => {
          reset();
          router.push('/pending');
        }, 1400);
        return true;
      } catch (e) {
        if (controller.signal.aborted || isAbortError(e)) {
          return false;
        }
        if (isTimeoutError(e)) {
          await invalidateFinance();
          setPhase('error');
          setMessage(
            'L’analyse prend plus de temps que prévu. Si un ticket a été créé, il est déjà dans « À valider ».'
          );
          return false;
        }
        setPhase('error');
        setMessage(formatScanError(e));
        return false;
      } finally {
        if (scanAbort.current === controller) scanAbort.current = null;
      }
    },
    [reset]
  );

  const pickFrom = useCallback(async (source: Source) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: false,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }, []);

  const startScan = useCallback(async (): Promise<boolean> => {
    if (phase !== 'idle' && phase !== 'error') return false;
    if (!isPremium) {
      requirePremium();
      return false;
    }
    if (phase === 'error') reset();

    try {
      let source: Source | null = 'gallery';
      if (Platform.OS !== 'web') {
        source = await askSource();
        if (!source) return false;
        if (source === 'camera') {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (!cam.granted) throw new Error('Autorisez la caméra pour photographier un ticket');
        } else {
          const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!lib.granted) throw new Error('Autorisez l’accès aux photos pour scanner un ticket');
        }
      }
      const uri = await pickFrom(source);
      if (!uri) return false;
      return await processImage(uri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analyse impossible';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user')) return false;
      setImagePreview(null);
      setPhase('error');
      setMessage(formatScanError(e));
      return false;
    }
  }, [askSource, isPremium, phase, pickFrom, processImage, requirePremium, reset]);

  return (
    <ReceiptScanContext.Provider value={{ startScan, scanning: phase === 'scanning' }}>
      {children}
      <ReceiptSourceSheet
        open={sourceOpen}
        onSelectCamera={() => answerSource('camera')}
        onSelectGallery={() => answerSource('gallery')}
        onCancel={() => answerSource(null)}
      />
      <ReceiptScanOverlay
        open={phase !== 'idle'}
        phase={phase}
        imagePreview={imagePreview}
        message={message}
        onClose={reset}
        onCancel={cancelScan}
        onRetry={() => {
          const saved = pendingImage.current;
          if (!saved) {
            reset();
            return;
          }
          void processImage(saved.uri);
        }}
      />
    </ReceiptScanContext.Provider>
  );
}

export function useReceiptScan() {
  const ctx = useContext(ReceiptScanContext);
  if (!ctx) throw new Error('useReceiptScan must be used within ReceiptScanProvider');
  return ctx;
}
