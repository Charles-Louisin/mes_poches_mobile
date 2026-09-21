import { Tag, Wallet } from 'lucide-react-native';
import { Image, StyleSheet, View } from 'react-native';
import { color, radius } from '@/theme/tokens';
import { iconToneColor } from './icon-circle';

export function EntityAvatar({
  imageUrl,
  name,
  type = 'wallet',
  size = 48,
}: {
  imageUrl?: string | null;
  name: string;
  type?: 'wallet' | 'category';
  size?: number;
}) {
  const radiusPx = Math.round(size * 0.28);
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: radiusPx, backgroundColor: color.primaryLight }}
        resizeMode="cover"
        accessibilityLabel={name}
      />
    );
  }

  const Icon = type === 'wallet' ? Wallet : Tag;
  const tone = type === 'wallet' ? 'primary' : 'muted';
  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radiusPx,
          backgroundColor: type === 'wallet' ? color.primaryLight : color.surfaceSecondary,
        },
      ]}>
      <Icon color={iconToneColor(tone)} size={Math.round(size * 0.42)} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.md,
  },
});
