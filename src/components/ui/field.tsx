import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { color, radius, space, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function Field({
  label,
  error,
  valid,
  secret,
  compact,
  hideLabel,
  containerStyle,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  valid?: boolean;
  secret?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
  containerStyle?: ViewStyle;
}) {
  const [hidden, setHidden] = useState(true);
  const secure = secret ? hidden : props.secureTextEntry;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {hideLabel ? null : <Text style={styles.label}>{label}</Text>}
      <View>
        <TextInput
          placeholderTextColor={color.textMuted}
          {...props}
          secureTextEntry={secure}
          style={[
            styles.input,
            compact && styles.inputCompact,
            secret && styles.inputSecret,
            error ? styles.inputErr : valid ? styles.inputOk : null,
            props.editable === false ? styles.inputLocked : null,
          ]}
        />
        {secret ? (
          <PressScale
            onPress={() => setHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'}
            style={styles.eye}
            hitSlop={8}>
            {hidden ? (
              <Eye color={color.textMuted} size={20} strokeWidth={2} />
            ) : (
              <EyeOff color={color.textMuted} size={20} strokeWidth={2} />
            )}
          </PressScale>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  input: {
    fontFamily: font.sans,
    fontSize: 16,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[16],
    paddingVertical: 14,
    minHeight: 54,
  },
  inputCompact: {
    minHeight: 48,
    paddingVertical: 10,
  },
  inputSecret: {
    paddingRight: 48,
  },
  inputErr: {
    borderColor: color.danger,
  },
  inputOk: {
    borderColor: '#86EFAC',
    borderWidth: 1.5,
  },
  inputLocked: {
    backgroundColor: color.surfaceSecondary,
    color: color.textMuted,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: {
    fontFamily: font.sans,
    fontSize: 12,
    color: color.danger,
  },
});
