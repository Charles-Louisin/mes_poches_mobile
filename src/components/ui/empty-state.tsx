import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, space, type as font, typeScale } from '@/theme/tokens';
import { Button } from './button';

export function EmptyState({
  illustration,
  title,
  description,
  cta,
  onPress,
}: {
  illustration?: ReactNode;
  title: string;
  description?: string;
  cta?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      {illustration ? <View style={styles.art}>{illustration}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {cta && onPress ? (
        <View style={styles.cta}>
          <Button label={cta} onPress={onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space[40],
    paddingHorizontal: space[16],
  },
  art: {
    marginBottom: space[20],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    width: '100%',
    overflow: 'visible',
  },
  title: {
    ...typeScale.h3,
    color: color.text,
    textAlign: 'center',
  },
  desc: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 22,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: space[8],
    maxWidth: 280,
  },
  cta: {
    marginTop: space[24],
    alignSelf: 'stretch',
  },
});
