import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { color, radius, type as font } from '@/theme/tokens';
import { IconCircle, iconToneColor } from '@/components/ui/icon-circle';
import { PressScale } from '@/components/ui/press-scale';

export function ReceiptSourceSheet({
  open,
  onSelectCamera,
  onSelectGallery,
  onCancel,
}: {
  open: boolean;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.dim} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Importer une image</Text>
          <View style={styles.row}>
            <PressScale onPress={onSelectCamera} style={styles.cell} accessibilityLabel="Caméra">
              <IconCircle tone="primary" size={48}>
                <Camera color={iconToneColor('primary')} size={22} strokeWidth={2} />
              </IconCircle>
              <Text style={styles.label}>Caméra</Text>
            </PressScale>
            <PressScale onPress={onSelectGallery} style={styles.cell} accessibilityLabel="Galerie">
              <IconCircle tone="warning" size={48}>
                <ImageIcon color={iconToneColor('warning')} size={22} strokeWidth={2} />
              </IconCircle>
              <Text style={styles.label}>Galerie</Text>
            </PressScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(17,17,17,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: color.white,
    borderRadius: radius.largeCard,
    padding: 20,
  },
  title: {
    fontFamily: font.sansSemi,
    fontSize: 16,
    color: color.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 10 },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.primaryLight,
    borderRadius: radius.card,
    paddingVertical: 18,
  },
  label: { fontFamily: font.sansSemi, fontSize: 13, color: color.primary },
});
