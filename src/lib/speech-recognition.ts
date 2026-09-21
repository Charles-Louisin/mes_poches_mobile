import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type NativeSpeech = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (event: string, listener: (payload: unknown) => void) => { remove: () => void };
  isRecognitionAvailable?: () => boolean;
  getSpeechRecognitionServices?: () => string[];
  getDefaultRecognitionService?: () => { packageName?: string };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

export type SpeechListeners = {
  onStart: () => void;
  onEnd: () => void;
  onResult: (text: string) => void;
  onError: (code: string, message?: string) => void;
};

function nativeSpeech(): NativeSpeech | null {
  try {
    return requireOptionalNativeModule<NativeSpeech>('ExpoSpeechRecognition');
  } catch {
    return null;
  }
}

function webSpeechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function canUseNativeSpeech(): boolean {
  const native = nativeSpeech();
  if (!native) return false;
  try {
    if (typeof native.isRecognitionAvailable === 'function') {
      return native.isRecognitionAvailable();
    }
  } catch {
    return false;
  }
  return true;
}

export function speechUnavailableMessage(): string {
  if (Platform.OS === 'web') {
    return 'Reconnaissance vocale non disponible sur ce navigateur';
  }
  if (nativeSpeech()) {
    return 'La dictée n’a pas démarré. Vérifiez le micro, ou maintenez pour enregistrer l’audio.';
  }
  return 'Mettez Expo Go à jour (SDK 57) ou utilisez un build de développement pour dicter';
}

export function speechErrorMessage(code: string, message?: string): string {
  if (code === 'not-allowed') return 'Autorisez le micro pour dicter une transaction';
  if (code === 'language-not-supported') {
    return 'Le français n’est pas installé pour la dictée. On enregistre l’audio à la place.';
  }
  if (code === 'service-not-allowed' || code === 'client') {
    return 'Reconnaissance vocale indisponible — enregistrement audio à la place.';
  }
  if (code === 'network') return 'Dictée hors ligne impossible. Vérifiez la connexion, ou dictez plus tard.';
  if (code === 'busy') return 'Le micro est déjà utilisé par une autre app.';
  if (code === 'no-speech' || code === 'speech-timeout') return 'Rien n’a été capté — maintenez pour parler';
  if (message?.trim()) return message;
  return speechUnavailableMessage();
}

function androidSpeechOptions(native: NativeSpeech): Record<string, unknown> {
  const options: Record<string, unknown> = {
    lang: 'fr-FR',
    interimResults: true,
    continuous: true,
    addsPunctuation: true,
    androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
  };
  try {
    const def = native.getDefaultRecognitionService?.()?.packageName?.trim();
    const listed = native.getSpeechRecognitionServices?.() ?? [];
    const pkg =
      def ||
      listed.find((p) => p.includes('googlequicksearchbox')) ||
      listed.find((p) => p.includes('android.tts') || p.endsWith('.as')) ||
      listed[0];
    if (pkg) options.androidRecognitionServicePackage = pkg;
  } catch {
    /* ignore */
  }
  return options;
}

export function createSpeechSession(listeners: SpeechListeners): {
  start: () => Promise<void>;
  stop: () => void;
  abort: () => void;
} {
  const native = nativeSpeech();
  const subs: Array<{ remove: () => void }> = [];
  let web: SpeechRecognitionLike | null = null;

  const clear = () => {
    for (const sub of subs) {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    }
    subs.length = 0;
  };

  return {
    async start() {
      if (native) {
        const permission = await native.requestPermissionsAsync();
        if (!permission.granted) {
          listeners.onError('not-allowed', 'Autorisez le micro pour dicter une transaction');
          return;
        }
        if (typeof native.isRecognitionAvailable === 'function' && !native.isRecognitionAvailable()) {
          listeners.onError('service-not-allowed', speechErrorMessage('service-not-allowed'));
          return;
        }
        clear();
        subs.push(
          native.addListener('start', () => listeners.onStart()),
          native.addListener('end', () => listeners.onEnd()),
          native.addListener('result', (payload) => {
            const event = payload as { results?: Array<{ transcript?: string }> };
            const text = (event.results ?? [])
              .map((item) => item.transcript || '')
              .join(' ')
              .trim();
            if (text) listeners.onResult(text);
          }),
          native.addListener('error', (payload) => {
            const event = payload as { error?: string; message?: string };
            listeners.onError(event.error || 'unknown', event.message);
          })
        );
        native.start(androidSpeechOptions(native));
        return;
      }

      const Ctor = webSpeechCtor();
      if (!Ctor) {
        throw new Error(speechUnavailableMessage());
      }
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const recognition = new Ctor();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onstart = () => listeners.onStart();
      recognition.onend = () => listeners.onEnd();
      recognition.onresult = (ev) => {
        let session = '';
        for (let i = 0; i < ev.results.length; i++) {
          session += `${ev.results[i][0].transcript} `;
        }
        const text = session.trim();
        if (text) listeners.onResult(text);
      };
      recognition.onerror = (ev) => {
        listeners.onError(ev.error || 'unknown', ev.message);
      };
      web = recognition;
      recognition.start();
    },
    stop() {
      try {
        native?.stop();
        web?.stop();
      } catch {
        /* ignore */
      }
    },
    abort() {
      try {
        native?.abort();
        web?.abort();
      } catch {
        /* ignore */
      }
      clear();
      web = null;
    },
  };
}
