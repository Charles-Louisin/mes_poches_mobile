import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockedTag, promptLocked } from '@/components/subscription/plan-usage';
import { useAuth } from '@/contexts/auth';
import { color, type as font } from '@/theme/tokens';
import { PressScale } from './press-scale';

export function OptionList({
  options,
  value,
  onChange,
}: {
  options: {
    value: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    /** Poche ou catégorie hors forfait : grisée, l'appui propose le palier supérieur. */
    lockedKind?: 'wallets' | 'categories';
  }[];
  value?: string;
  onChange: (value: string) => void;
}) {
  const { user } = useAuth();
  return (
    <View>
      {options.map((opt, i) => {
        const active = opt.value === value;
        const last = i === options.length - 1;
        const locked = !!opt.lockedKind;
        return (
          <PressScale
            key={opt.value}
            onPress={() =>
              opt.lockedKind ? promptLocked(opt.lockedKind, user?.quotas?.[opt.lockedKind]) : onChange(opt.value)
            }
            disabled={opt.disabled}
            accessibilityRole="button"
            accessibilityHint={locked ? 'Hors de votre forfait actuel' : undefined}
            accessibilityState={{ selected: active, disabled: !!opt.disabled || locked }}
            style={[styles.row, last && styles.last, opt.disabled && styles.disabled]}>
            <View style={styles.left}>
              {opt.icon ? <View style={styles.icon}>{opt.icon}</View> : null}
              <Text style={[styles.label, active && styles.active, locked && styles.lockedLabel]}>{opt.label}</Text>
            </View>
            {locked ? <LockedTag /> : active ? <View style={styles.dot} /> : null}
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  last: { borderBottomWidth: 0 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: { width: 24, alignItems: 'center' },
  label: { fontFamily: font.sans, fontSize: 16, color: color.text, flex: 1 },
  active: { color: color.primary, fontFamily: font.sansMed },
  lockedLabel: { color: color.textMuted },
  disabled: { opacity: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: color.primary },
});
