import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { pendingTransactionApi } from '@/lib/api';
import { blockIfQuotaFull, quotaPromptFromError } from '@/components/subscription/quota-prompt';
import { getErrorMessage, isAbortError, isPremiumRequiredError, isTimeoutError } from '@/lib/errors';
import { formatScanError } from '@/lib/scan-errors';
import { MicPermissionError, ensureMicPermission, openAppSettings } from '@/lib/mic-permission';
import { isOnline } from '@/lib/network';
import { notifyTransactionReady } from '@/lib/pending-notify';
import { invalidateFinance } from '@/lib/query';
import { abortVoiceCapture, audioUnavailableMessage, canUseAudioCapture, startVoiceCapture, stopVoiceCapture } from '@/lib/voice-capture';
import {
  canUseNativeSpeech,
  createSpeechSession,
  speechErrorMessage,
  speechUnavailableMessage,
} from '@/lib/speech-recognition';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useToast } from '@/contexts/toast';
import { VoiceNoteOverlay, type VoicePhase } from '@/components/capture/voice-note-overlay';

type VoiceNoteContextValue = {
  startVoice: () => boolean;
  listening: boolean;
  submitting: boolean;
};

const VoiceNoteContext = createContext<VoiceNoteContextValue | null>(null);

function usesFileCapture(): boolean {
  if (Platform.OS === 'web') return false;
  return canUseAudioCapture();
}

export function VoiceNoteProvider({ children }: { children: ReactNode }) {
  const { user, requirePremium } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const latestText = useRef('');
  const sessionRef = useRef<ReturnType<typeof createSpeechSession> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const submittingRef = useRef(false);
  const holdingRef = useRef(false);
  const captureModeRef = useRef<'speech' | 'file'>('speech');
  const startPromiseRef = useRef<Promise<void> | null>(null);

  const stopSession = useCallback((abort = false) => {
    try {
      if (abort) sessionRef.current?.abort();
      else sessionRef.current?.stop();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSession(true);
    void abortVoiceCapture();
    latestText.current = '';
    holdingRef.current = false;
    submittingRef.current = false;
    setPhase('idle');
  }, [stopSession]);

  const close = useCallback(() => {
    reset();
    setOpen(false);
  }, [reset]);

  const askMicSettings = useCallback(async () => {
    const go = await confirm({
      title: 'Micro désactivé',
      body:
        'Dans la fiche de l’app, ouvrez Autorisations. Si Microphone n’apparaît pas, appuyez sur ⋮ puis Toutes les autorisations. Cochez Microphone.',
      confirmLabel: 'Ouvrir les autorisations',
      cancelLabel: 'Plus tard',
    });
    if (go) await openAppSettings();
  }, [confirm]);

  const cancelProcessing = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    submittingRef.current = false;
    latestText.current = '';
    setPhase('idle');
    toast('Traitement arrêté', 'info');
  }, [toast]);

  const submitVoice = useCallback(
    async (payload: { text?: string; audio?: string; mimeType?: string }) => {
      const hasContent = Boolean(payload.text?.trim() || payload.audio);
      if (!hasContent || submittingRef.current) {
        if (!hasContent) {
          setPhase('idle');
          toast('Rien n’a été capté — maintenez pour parler', 'err');
        }
        return;
      }
      submittingRef.current = true;
      setPhase('processing');
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      try {
        if (!(await isOnline())) {
          setPhase('idle');
          toast('La dictée nécessite une connexion. Réessayez en ligne.', 'err');
          return;
        }
        const created = await pendingTransactionApi.voiceNote(payload, controller.signal);
        if (controller.signal.aborted) return;
        const count = created.length;
        const expense = created.filter((t) => t.type === 'expense').length;
        const income = created.filter((t) => t.type === 'income').length;
        const label =
          expense && income
            ? `${expense} dépense(s) et ${income} revenu(s) à valider`
            : count > 1
              ? `${count} transactions prêtes à valider`
              : created[0]?.description || 'Transaction vocale prête';
        void notifyTransactionReady(label);
        toast(count > 1 ? `${count} propositions prêtes` : 'Transaction proposée', 'ok');
        await invalidateFinance();
        close();
        router.push('/pending');
      } catch (e) {
        if (controller.signal.aborted || isAbortError(e)) return;
        if (quotaPromptFromError(e)) {
          close();
          return;
        }
        if (isPremiumRequiredError(e)) {
          close();
          requirePremium(e.message);
        } else if (isTimeoutError(e)) {
          await invalidateFinance();
          setPhase('idle');
          toast(
            'L’analyse prend plus de temps que prévu. Vérifiez « À valider » dans un instant.',
            'info'
          );
        } else {
          setPhase('idle');
          toast(formatScanError(e), 'err');
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        submittingRef.current = false;
      }
    },
    [close, requirePremium, toast]
  );

  const beginHold = useCallback(async () => {
    if (blockIfQuotaFull(user?.quotas, 'voice')) {
      close();
      return;
    }
    if (submittingRef.current) return;
    if (!canUseNativeSpeech() && !canUseAudioCapture()) {
      toast(audioUnavailableMessage(), 'err');
      return;
    }
    holdingRef.current = true;
    latestText.current = '';
    captureModeRef.current = usesFileCapture() ? 'file' : 'speech';
    stopSession(true);
    void abortVoiceCapture();
    setPhase('holding');

    const start = (async () => {
      if (captureModeRef.current === 'speech') {
        const session = createSpeechSession({
          onStart: () => {
            if (holdingRef.current) setPhase('holding');
          },
          onEnd: () => undefined,
          onResult: (text) => {
            latestText.current = text;
          },
          onError: (code) => {
            if (code === 'aborted' || !holdingRef.current) return;
            if (
              canUseAudioCapture() &&
              (code === 'service-not-allowed' ||
                code === 'language-not-supported' ||
                code === 'client' ||
                code === 'audio-capture')
            ) {
              captureModeRef.current = 'file';
              stopSession(true);
              void startVoiceCapture().catch((e) => {
                holdingRef.current = false;
                setPhase('idle');
                if (e instanceof MicPermissionError) {
                  close();
                  void askMicSettings();
                  return;
                }
                toast(getErrorMessage(e, speechUnavailableMessage()), 'err');
              });
              return;
            }
            if (code === 'not-allowed') {
              close();
              void askMicSettings();
              return;
            }
            setPhase('idle');
            toast(speechErrorMessage(code), 'err');
          },
        });
        sessionRef.current = session;
        await session.start();
        if (!holdingRef.current) {
          stopSession(true);
        }
        return;
      }

      await startVoiceCapture();
      if (!holdingRef.current) {
        await abortVoiceCapture();
      }
    })();

    startPromiseRef.current = start;
    try {
      await start;
    } catch (e) {
      holdingRef.current = false;
      setPhase('idle');
      if (e instanceof MicPermissionError) {
        close();
        void askMicSettings();
        return;
      }
      toast(getErrorMessage(e, speechUnavailableMessage()), 'err');
    } finally {
      if (startPromiseRef.current === start) startPromiseRef.current = null;
    }
  }, [askMicSettings, close, requirePremium, stopSession, toast, user?.quotas]);

  const endHold = useCallback(
    async (cancelled: boolean) => {
      const wasHolding = holdingRef.current;
      holdingRef.current = false;
      if (!wasHolding) return;
      const pendingStart = startPromiseRef.current;
      if (pendingStart) {
        try {
          await pendingStart;
        } catch {
          setPhase('idle');
          return;
        }
      }
      if (cancelled) {
        stopSession(true);
        await abortVoiceCapture();
        latestText.current = '';
        setPhase('idle');
        toast('Prise annulée', 'info');
        return;
      }
      if (captureModeRef.current === 'file') {
        try {
          const clip = await stopVoiceCapture();
          await submitVoice({ audio: clip?.audio, mimeType: clip?.mimeType });
        } catch (e) {
          setPhase('idle');
          toast(getErrorMessage(e, 'Enregistrement impossible'), 'err');
        }
        return;
      }
      stopSession(false);
      await new Promise((r) => setTimeout(r, 280));
      await submitVoice({ text: latestText.current.trim() });
    },
    [stopSession, submitVoice, toast]
  );

  const markCancelling = useCallback(() => {
    if (holdingRef.current) setPhase('cancelling');
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopSession(true);
      void abortVoiceCapture();
    };
  }, [stopSession]);

  const startVoice = useCallback(() => {
    if (blockIfQuotaFull(user?.quotas, 'voice')) return false;
    void (async () => {
      await new Promise((r) => setTimeout(r, 450));
      const granted = await ensureMicPermission();
      if (!granted) {
        await askMicSettings();
        return;
      }
      latestText.current = '';
      setPhase('idle');
      setOpen(true);
    })();
    return true;
  }, [askMicSettings, user?.quotas]);

  return (
    <VoiceNoteContext.Provider
      value={{ startVoice, listening: phase === 'holding', submitting: phase === 'processing' }}>
      {children}
      <VoiceNoteOverlay
        open={open}
        phase={phase}
        onClose={close}
        onBeginHold={() => void beginHold()}
        onEndHold={(cancelled) => void endHold(cancelled)}
        onSwipeCancel={markCancelling}
        onStopProcessing={cancelProcessing}
      />
    </VoiceNoteContext.Provider>
  );
}

export function useVoiceNote() {
  const ctx = useContext(VoiceNoteContext);
  if (!ctx) throw new Error('useVoiceNote must be used within VoiceNoteProvider');
  return ctx;
}
