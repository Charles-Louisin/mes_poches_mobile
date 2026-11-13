import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, Plus, Search, X } from 'lucide-react-native';
import { categoryApi, type Category } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { LockedTag, PlanUsage, lockedMessage, promptLocked } from '@/components/subscription/plan-usage';
import { TutorialTarget } from '@/components/tutorial/tutorial-target';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Enter } from '@/components/ui/enter';
import { EntityAvatar } from '@/components/ui/entity-avatar';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ReceiptArt } from '@/components/illustrations';
import { color, radius, shadow, space, type as font, typeScale } from '@/theme/tokens';

type Kind = '' | 'expense' | 'income';

function CategoryRow({ c, index, onPress }: { c: Category; index: number; onPress: () => void }) {
  return (
    <Enter delay={index * 30}>
      <PressScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={c.locked ? `${c.name}, hors de votre forfait` : `${c.name}, voir l’historique`}
        style={[styles.row, c.locked && styles.locked]}>
        <EntityAvatar imageUrl={c.image_url} name={c.name} type="category" size={48} />
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, c.locked && { color: color.textMuted }]} numberOfLines={1}>
              {c.name}
            </Text>
            {c.locked ? <LockedTag /> : null}
          </View>
          <Text style={[styles.kind, c.type === 'income' ? styles.kindIn : styles.kindOut]}>
            {c.type === 'income' ? 'Entrée' : 'Sortie'}
          </Text>
        </View>
        <ChevronRight color={color.textMuted} size={20} />
      </PressScale>
    </Enter>
  );
}

export default function CategoriesScreen() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.getAll() });
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>('');
  const quota = user?.quotas?.categories;

  const all = q.data ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all.filter((c) => (!kind || c.type === kind) && (!needle || c.name.toLowerCase().includes(needle)));
  }, [all, kind, search]);
  const open = filtered.filter((c) => !c.locked);
  const locked = filtered.filter((c) => c.locked);
  const counts = {
    expense: all.filter((c) => c.type === 'expense').length,
    income: all.filter((c) => c.type === 'income').length,
  };

  return (
    <Screen scroll onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={styles.top}>
        <Text style={styles.title}>Catégories</Text>
        <TutorialTarget id="categories-add" style={styles.addTarget}>
          <PressScale
            onPress={() => router.push('/categories/new' as never)}
            style={styles.add}
            accessibilityRole="button"
            accessibilityLabel="Nouvelle catégorie">
            <Plus color={color.white} size={22} strokeWidth={2.4} />
          </PressScale>
        </TutorialTarget>
      </View>
      {all.length ? <PlanUsage kind="categories" style={styles.usage} /> : null}

      {all.length > 0 ? (
        <>
          <View style={styles.searchWrap}>
            <Search color={color.textMuted} size={18} strokeWidth={2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une catégorie"
              placeholderTextColor={color.textMuted}
              style={styles.search}
              returnKeyType="search"
            />
            {search ? (
              <PressScale onPress={() => setSearch('')} hitSlop={10} accessibilityLabel="Effacer la recherche">
                <X color={color.textMuted} size={18} strokeWidth={2.2} />
              </PressScale>
            ) : null}
          </View>
          <View style={styles.chips}>
            <Chip label={`Toutes · ${all.length}`} active={kind === ''} onPress={() => setKind('')} />
            <Chip label={`Sorties · ${counts.expense}`} active={kind === 'expense'} onPress={() => setKind('expense')} />
            <Chip label={`Entrées · ${counts.income}`} active={kind === 'income'} onPress={() => setKind('income')} />
          </View>
        </>
      ) : null}

      {open.map((c, i) => (
        <CategoryRow key={c._id} c={c} index={i} onPress={() => router.push(`/categories/${c._id}` as never)} />
      ))}
      {locked.length ? (
        <>
          <Text style={styles.lockedNote}>{lockedMessage('categories', quota)}</Text>
          {locked.map((c, i) => (
            <CategoryRow key={c._id} c={c} index={open.length + i} onPress={() => promptLocked('categories', quota)} />
          ))}
        </>
      ) : null}

      {q.isLoading && !q.data ? (
        <PageSkeleton variant="list" rows={6} />
      ) : all.length === 0 ? (
        <EmptyState
          illustration={<ReceiptArt size={180} />}
          title="Aucune catégorie"
          description="Transport, marché, salaire… Les catégories classent vos mouvements et alimentent vos analyses."
          cta="Créer une catégorie"
          onPress={() => router.push('/categories/new' as never)}
        />
      ) : filtered.length === 0 ? (
        <Text style={styles.noMatch}>Aucune catégorie ne correspond.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { ...typeScale.h1, color: color.text },
  addTarget: { width: 44, height: 44 },
  add: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usage: { marginBottom: 16 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: 12,
  },
  search: { flex: 1, fontFamily: font.sans, fontSize: 16, color: color.text, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  row: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[16],
    marginBottom: 12,
    gap: 12,
    ...shadow.soft,
  },
  locked: { opacity: 0.62 },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: font.sansSemi, fontSize: 16, color: color.text, flexShrink: 1 },
  kind: { fontFamily: font.sansMed, fontSize: 12, marginTop: 4 },
  kindOut: { color: color.danger },
  kindIn: { color: color.success },
  lockedNote: { marginTop: 12, marginBottom: 12, fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: color.textSecondary },
  noMatch: { fontFamily: font.sans, fontSize: 14, color: color.textMuted, textAlign: 'center', marginTop: 16 },
});
