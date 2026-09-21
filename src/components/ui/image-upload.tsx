import { useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { getErrorMessage } from '@/lib/errors';
import { uploadEntityImage, type UploadImageEndpoint } from '@/lib/upload-image';
import { ReceiptSourceSheet } from '@/components/capture/receipt-source-sheet';
import { color, radius, type as font } from '@/theme/tokens';
import { GoldDiamond } from './gold-diamond';
import { PressScale } from './press-scale';

export function ImageUpload({
  value,
  onChange,
  endpoint,
  label = 'Image',
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  endpoint: UploadImageEndpoint;
  label?: string;
}) {
  const { isPremium, requirePremium } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  const pickFrom = async (source: 'camera' | 'gallery') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  };

  const runUpload = async (source: 'camera' | 'gallery') => {
    if (busy) return;
    setBusy(true);
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          toast('Autorisez la caméra dans les paramètres du téléphone', 'err');
          return;
        }
      } else if (source === 'gallery' && Platform.OS === 'ios') {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          toast('Autorisez l’accès aux photos dans les paramètres du téléphone', 'err');
          return;
        }
      }
      const uri = await pickFrom(source);
      if (!uri) return;
      const url = await uploadEntityImage(uri, endpoint);
      onChange(url);
      toast('Image ajoutée', 'ok');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible d’envoyer l’image'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const startPick = () => {
    if (!isPremium) {
      requirePremium();
      return;
    }
    if (Platform.OS === 'web') {
      void runUpload('gallery');
      return;
    }
    setSourceOpen(true);
  };

  if (!isPremium) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <PressScale
          onPress={() => router.push('/subscription')}
          accessibilityRole="button"
          accessibilityLabel="Images Premium"
          style={styles.premium}>
          <GoldDiamond size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumT}>Images Premium</Text>
            <Text style={styles.premiumS}>Personnalisez vos poches et catégories avec Premium</Text>
          </View>
        </PressScale>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.preview}>
          {value ? (
            <>
              <Image source={{ uri: value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <PressScale
                onPress={() => onChange(null)}
                style={styles.remove}
                accessibilityLabel="Supprimer l'image">
                <X color={color.white} size={14} strokeWidth={2.4} />
              </PressScale>
            </>
          ) : (
            <ImagePlus color={color.primary} size={28} strokeWidth={1.8} />
          )}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <PressScale
            onPress={startPick}
            disabled={busy}
            accessibilityRole="button"
            style={styles.cta}>
            {busy ? (
              <View style={styles.ctaRow}>
                <ActivityIndicator color={color.white} />
                <Text style={styles.ctaT}>Envoi…</Text>
              </View>
            ) : (
              <Text style={styles.ctaT}>{value ? "Changer l'image" : 'Ajouter une image'}</Text>
            )}
          </PressScale>
        </View>
      </View>
      <ReceiptSourceSheet
        open={sourceOpen}
        onSelectCamera={() => {
          setSourceOpen(false);
          void runUpload('camera');
        }}
        onSelectGallery={() => {
          setSourceOpen(false);
          void runUpload('gallery');
        }}
        onCancel={() => setSourceOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: font.sansMed,
    fontSize: 13,
    color: color.textSecondary,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  preview: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: color.primaryLight,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: color.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(17,17,17,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaT: {
    fontFamily: font.sansSemi,
    fontSize: 14,
    color: color.white,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.primary,
    backgroundColor: color.primaryLight,
  },
  premiumT: { fontFamily: font.sansSemi, fontSize: 14, color: color.text },
  premiumS: { fontFamily: font.sans, fontSize: 12, color: color.textSecondary, marginTop: 2 },
});
