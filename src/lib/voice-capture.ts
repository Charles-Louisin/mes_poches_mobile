import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { File } from 'expo-file-system';
import { MicPermissionError, ensureMicPermission } from './mic-permission';

type Recorder = {
  uri: string | null;
  isRecording: boolean;
  prepareToRecordAsync: (options?: object) => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
};

type NativeAudio = {
  AudioRecorder: new (options: object) => Recorder;
  requestRecordingPermissionsAsync: () => Promise<{ granted: boolean }>;
  setAudioModeAsync: (mode: object) => Promise<void>;
};

function nativeAudio(): NativeAudio | null {
  try {
    return requireOptionalNativeModule<NativeAudio>('ExpoAudio');
  } catch {
    return null;
  }
}

export function canUseAudioCapture(): boolean {
  return nativeAudio()?.AudioRecorder != null;
}

export function audioUnavailableMessage(): string {
  if (Platform.OS === 'web') {
    return 'Reconnaissance vocale non disponible sur ce navigateur';
  }
  return 'Mettez Expo Go à jour (SDK 57) ou utilisez un build de développement pour le micro';
}

function recordOptions() {
  const common = {
    extension: '.m4a',
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    isMeteringEnabled: false,
  };
  if (Platform.OS === 'ios') {
    return {
      ...common,
      outputFormat: 'aac ',
      audioQuality: 127,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    };
  }
  return {
    ...common,
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  };
}

let recorder: Recorder | null = null;

async function restorePlaybackMode() {
  try {
    await nativeAudio()?.setAudioModeAsync({ allowsRecording: false });
  } catch {
    /* ignore */
  }
}

export async function startVoiceCapture(): Promise<void> {
  await abortVoiceCapture();
  const audio = nativeAudio();
  if (!audio?.AudioRecorder) {
    throw new Error(audioUnavailableMessage());
  }
  const granted = await ensureMicPermission();
  if (!granted) {
    throw new MicPermissionError();
  }
  try {
    await audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  } catch {
    /* Android Expo Go may ignore audio mode */
  }
  const options = recordOptions();
  const next = new audio.AudioRecorder(options);
  await next.prepareToRecordAsync(options);
  next.record();
  recorder = next;
}

export async function stopVoiceCapture(): Promise<{ audio: string; mimeType: string } | null> {
  const current = recorder;
  recorder = null;
  if (!current) return null;
  try {
    await current.stop();
  } catch {
    /* already stopped */
  }
  await restorePlaybackMode();
  const uri = current.uri;
  if (!uri) return null;
  const file = new File(uri);
  if (!file.exists) return null;
  const audio = await file.base64();
  if (!audio) return null;
  return { audio, mimeType: 'audio/mp4' };
}

export async function abortVoiceCapture(): Promise<void> {
  const current = recorder;
  recorder = null;
  if (!current) return;
  try {
    if (current.isRecording) await current.stop();
  } catch {
    /* ignore */
  }
  await restorePlaybackMode();
}
