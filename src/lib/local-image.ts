import { useEffect, useState } from 'react';
import { Image, Platform, type ImageSourcePropType } from 'react-native';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';

function packagerOrigin(): string | null {
  const host =
    Constants.expoGoConfig?.debuggerHost ||
    Constants.expoConfig?.hostUri ||
    null;
  if (!host) return null;
  if (/^https?:\/\//i.test(host)) return host.replace(/\/$/, '');
  return `http://${host}`;
}

function toAbsolute(uri: string): string {
  let next = uri.replace(/\\/g, '/');
  const origin = packagerOrigin();
  if (!origin) return next;
  if (next.startsWith('/') && !next.startsWith('//')) {
    return origin + next;
  }
  return next.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, origin);
}

export function useLocalImageSource(mod: number): ImageSourcePropType | undefined {
  const [source, setSource] = useState<ImageSourcePropType | undefined>(
    Platform.OS === 'web' ? mod : undefined
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      setSource(mod);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resolved = Image.resolveAssetSource(mod);
        const asset = Asset.fromModule(mod);
        let uri = toAbsolute((asset.uri || resolved?.uri || '').replace(/\\/g, '/'));
        if (uri && uri !== asset.uri) {
          (asset as { uri: string }).uri = uri;
        }
        try {
          await asset.downloadAsync();
        } catch {
          /* Metro HTTP still usable */
        }
        const finalUri = toAbsolute((asset.localUri || uri || asset.uri || resolved?.uri || '').replace(/\\/g, '/'));
        if (!cancelled && finalUri) setSource({ uri: finalUri });
      } catch {
        const resolved = Image.resolveAssetSource(mod);
        const uri = resolved?.uri ? toAbsolute(resolved.uri) : '';
        if (!cancelled && uri) setSource({ uri });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mod]);

  return source;
}
