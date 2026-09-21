import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { color, radius, space, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

function parseYmd(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatDisplay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choisir une date';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseYmd(value));
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const current = parseYmd(value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <PressScale
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDisplay(value)}`}
        style={styles.input}>
        <Text style={styles.value}>{formatDisplay(value)}</Text>
        <CalendarDays color={color.primary} size={18} strokeWidth={2} />
      </PressScale>
      {open ? (
        <View style={Platform.OS === 'ios' ? styles.iosBox : undefined}>
          <DateTimePicker
            value={current}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onValueChange={(_event, selected) => {
              if (Platform.OS === 'android') setOpen(false);
              onChange(toYmd(selected));
            }}
            onDismiss={() => setOpen(false)}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            locale="fr-FR"
          />
          {Platform.OS === 'ios' ? (
            <PressScale onPress={() => setOpen(false)} style={styles.done}>
              <Text style={styles.doneT}>OK</Text>
            </PressScale>
          ) : null}
        </View>
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[16],
    paddingVertical: 14,
    minHeight: 54,
  },
  value: {
    fontFamily: font.sans,
    fontSize: 16,
    color: color.text,
    flex: 1,
    marginRight: 8,
  },
  iosBox: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
  },
  done: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
  },
  doneT: {
    fontFamily: font.sansSemi,
    fontSize: 15,
    color: color.primary,
  },
});
