import { TutorialTarget } from '@/components/tutorial/tutorial-target';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { Field } from '@/components/ui/field';
import { ImageUpload } from '@/components/ui/image-upload';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/contexts/auth';
import { useConfirm } from '@/contexts/confirm';
import { useToast } from '@/contexts/toast';
import { useTutorial } from '@/contexts/tutorial';
import { categoryApi, type Category } from '@/lib/api';
import { getErrorMessage, isPremiumRequiredError } from '@/lib/errors';
import { quotaPromptFromError } from '@/components/subscription/quota-prompt';
import { LockedTag, PlanUsage, lockedMessage, promptLocked } from '@/components/subscription/plan-usage';
import { invalidateFinance } from '@/lib/query';
import { color, type as font } from '@/theme/tokens';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

export default function CategoriesScreen() {
  const { user } = useAuth();
  const { step, afterCategoryCreated } = useTutorial();
  const toast = useToast();
  const confirm = useConfirm();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const q = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.getAll() });
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setKind('expense');
    setImageUrl(null);
    setEditingId(null);
  };

  const startEdit = (category: Category) => {
    setEditingId(category._id);
    setName(category.name);
    setKind(category.type);
    setImageUrl(category.image_url ?? null);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const save = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (editingId) {
        await categoryApi.update(editingId, {
          name: name.trim(),
          type: kind,
          image_url: imageUrl,
        });
        toast('Catégorie modifiée', 'ok');
      } else {
        await categoryApi.create({ name: name.trim(), type: kind, image_url: imageUrl });
        toast('Catégorie créée', 'ok');
        if (step === 'category-page') afterCategoryCreated();
      }
      await invalidateFinance();
      resetForm();
    } catch (err) {
      if (quotaPromptFromError(err)) return;
      if (isPremiumRequiredError(err)) {
        toast(err.message, 'info');
        router.push('/subscription');
      } else toast(getErrorMessage(err, 'Impossible'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (category: Category) => {
    const ok = await confirm({
      title: 'Retirer cette catégorie ?',
      body: `« ${category.name} » sera supprimée. Les écritures déjà classées gardent leur libellé.`,
      confirmLabel: 'Retirer',
      danger: true,
    });
    if (!ok) return;
    try {
      await categoryApi.delete(category._id);
      if (editingId === category._id) resetForm();
      await invalidateFinance();
      toast('Catégorie retirée', 'ok');
    } catch (err) {
      toast(getErrorMessage(err, 'Impossible'), 'err');
    }
  };

  const list = q.data ?? [];
  const expenses = list.filter((c) => c.type === 'expense');
  const incomes = list.filter((c) => c.type === 'income');

  const quota = user?.quotas?.categories;
  const lockedCount = list.filter((c) => c.locked).length;

  const renderRow = (c: Category) => (
    <View key={c._id} style={[styles.row, c.locked && styles.rowLocked]}>
      <PressScale
        onPress={() => (c.locked ? promptLocked('categories', quota) : startEdit(c))}
        accessibilityLabel={c.locked ? `${c.name}, hors de votre forfait` : c.name}
        style={styles.main}>
        <EntityAvatar imageUrl={c.image_url} name={c.name} type="category" size={44} />
        <Text style={[styles.name, c.locked && styles.nameLocked]} numberOfLines={1}>
          {c.name}
        </Text>
        {c.locked ? <LockedTag /> : null}
      </PressScale>
      <PressScale onPress={() => startEdit(c)} accessibilityLabel={`Modifier ${c.name}`} style={styles.iconBtn}>
        <Pencil color={color.textMuted} size={18} strokeWidth={2} />
      </PressScale>
      <PressScale onPress={() => void remove(c)} accessibilityLabel={`Supprimer ${c.name}`} style={styles.iconBtn}>
        <Trash2 color={color.danger} size={18} strokeWidth={2} />
      </PressScale>
    </View>
  );

  return (
    <Screen scroll scrollRef={scrollRef} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <ScreenHeader title="Catégories" />
      <PlanUsage kind="categories" style={styles.usage} />
      {lockedCount ? <Text style={styles.limit}>{lockedMessage('categories', quota)}</Text> : null}
      <ImageUpload
        value={imageUrl}
        onChange={setImageUrl}
        endpoint="categoryImage"
        label="Icône de la catégorie"
      />
      <View style={{ height: 16 }} />
      <View style={styles.kinds}>
        <PressScale onPress={() => setKind('expense')}>
          <Text style={[styles.k, kind === 'expense' && styles.kon]}>Sortie</Text>
        </PressScale>
        <PressScale onPress={() => setKind('income')}>
          <Text style={[styles.k, kind === 'income' && styles.kon]}>Entrée</Text>
        </PressScale>
      </View>
      <TutorialTarget id="category-name">
        <Field label={editingId ? 'Nom' : 'Nouvelle'} value={name} onChangeText={setName} />
      </TutorialTarget>
      <View style={{ height: 12 }} />
      <TutorialTarget id="category-submit">
        <Button label="Enregistrer" loadingLabel="Enregistrement…" onPress={() => void save()} loading={loading} />
      </TutorialTarget>
      {editingId ? (
        <>
          <View style={{ height: 8 }} />
          <Button label="Annuler" variant="ghost" onPress={resetForm} />
        </>
      ) : null}
      <Text style={styles.sec}>Sorties ({expenses.length})</Text>
      {expenses.map(renderRow)}
      <Text style={styles.sec}>Entrées ({incomes.length})</Text>
      {incomes.map(renderRow)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  limit: { fontFamily: font.sans, color: color.brassMute, marginBottom: 16, fontSize: 13 },
  kinds: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  k: { fontFamily: font.sansSemi, color: color.textMuted, fontSize: 15 },
  kon: { color: color.brass },
  sec: { marginTop: 28, marginBottom: 8, fontFamily: font.sansMed, fontSize: 13, color: color.brass },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  name: { fontFamily: font.sans, color: color.ivory, fontSize: 16, flexShrink: 1 },
  nameLocked: { color: color.textMuted },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  rowLocked: { opacity: 0.62 },
  usage: { marginBottom: 12 },
  iconBtn: { padding: 6 },
});
