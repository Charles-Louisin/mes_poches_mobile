import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_BYTES = 450_000;

function byteSize(base64: string): number {
  return Math.ceil((base64.length * 3) / 4);
}

export async function compressImageForScan(
  uri: string,
  maxWidth = 960
): Promise<{ image: string; mimeType: string; previewUri: string }> {
  let source = uri;
  let width = maxWidth;
  let compress = 0.7;
  let lastBase64 = '';
  let lastUri = uri;

  for (let attempt = 0; attempt < 8; attempt++) {
    const result = await manipulateAsync(
      source,
      [{ resize: { width } }],
      { compress, format: SaveFormat.JPEG, base64: true }
    );
    lastUri = result.uri;
    lastBase64 = result.base64 ?? '';
    if (lastBase64 && byteSize(lastBase64) <= MAX_BYTES) {
      return { image: lastBase64, mimeType: 'image/jpeg', previewUri: lastUri };
    }
    if (compress > 0.4) {
      compress -= 0.08;
    } else {
      width = Math.round(width * 0.82);
      compress = 0.65;
    }
    source = result.uri;
  }

  if (!lastBase64) throw new Error('Image illisible');
  return { image: lastBase64, mimeType: 'image/jpeg', previewUri: lastUri };
}

/** Icônes poche / catégorie : JPEG ≤ ~800 Ko, côté 720. */
export async function compressImageForUpload(uri: string): Promise<{ uri: string }> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 720 } }],
    { compress: 0.82, format: SaveFormat.JPEG }
  );
  return { uri: result.uri || uri };
}
