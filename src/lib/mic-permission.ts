import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type NativeAudio = {
  requestRecordingPermissionsAsync: () => Promise<{ granted: boolean }>;
};

export class MicPermissionError extends Error {
  constructor() {
    super('Autorisez le micro pour dicter une transaction');
    this.name = 'MicPermissionError';
  }
}

/** Sur Android l’API Expo Audio lève InvocationTargetException : on passe par le dialogue système. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      const audio = requireOptionalNativeModule<NativeAudio>('ExpoAudio');
      const permission = await audio?.requestRecordingPermissionsAsync();
      return permission?.granted ?? false;
    } catch {
      return false;
    }
  }
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Micro Mes Poches',
        message: 'Autorisez le micro pour dicter une transaction.',
        buttonPositive: 'Autoriser',
        buttonNegative: 'Refuser',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}
