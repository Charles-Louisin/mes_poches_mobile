import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { TutorialTarget } from '@/components/tutorial/tutorial-target';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ImageUpload } from '@/components/ui/image-upload';
import { PressScale } from '@/components/ui/press-scale';
import { color, radius, type as font } from '@/theme/tokens';

export type CategoryDraft = { name: string; type: 'expense' | 'income'; image_url: string | null };

/** Formulaire de catégorie : création (page glissante) et modification (page de la catégorie). */
export function CategoryForm({
  initial,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<CategoryDraft>;
  submitLabel: string;
  loading: boolean;
  onSubmit: (draft: CategoryDraft) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<'expense' | 'income'>(initial?.type ?? 'expense');
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);

  return (
    <View style={{ gap: 20 }}>
      <ImageUpload value={imageUrl} onChange={setImageUrl} endpoint="categoryImage" label="Icône (facultatif)" />
      <View>
        <Text style={styles.label}>Type de mouvement</Text>
        <View style={styles.kinds}>
          {(
            [
              { key: 'expense' as const, label: 'Sortie', hint: 'Dépenses', Icon: ArrowUpRight, tint: color.danger },
              { key: 'income' as const, label: 'Entrée', hint: 'Revenus', Icon: ArrowDownLeft, tint: color.success },
            ] as const
          ).map((k) => {
            const on = type === k.key;
            return (
              <PressScale
                key={k.key}
                onPress={() => setType(k.key)}
                style={[styles.kind, on && { borderColor: k.tint, backgroundColor: color.white }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}>
                <k.Icon color={on ? k.tint : color.textMuted} size={20} strokeWidth={2.2} />
                <View>
                  <Text style={[styles.kindT, on && { color: color.text }]}>{k.label}</Text>
                  <Text style={styles.kindH}>{k.hint}</Text>
                </View>
              </PressScale>
            );
          })}
        </View>
      </View>
      <TutorialTarget id="category-name">
        <Field label="Nom" value={name} onChangeText={setName} placeholder="Transport, marché, salaire…" />
      </TutorialTarget>
      <TutorialTarget id="category-submit">
        <Button
          label={submitLabel}
          loadingLabel="Enregistrement…"
          loading={loading}
          disabled={!name.trim()}
          onPress={() => onSubmit({ name: name.trim(), type, image_url: imageUrl })}
        />
      </TutorialTarget>
      {onCancel ? <Button label="Annuler" variant="ghost" onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.sansMed, fontSize: 14, color: color.textSecondary, marginBottom: 10 },
  kinds: { flexDirection: 'row', gap: 10 },
  kind: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  kindT: { fontFamily: font.sansSemi, fontSize: 15, color: color.textSecondary },
  kindH: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
});
