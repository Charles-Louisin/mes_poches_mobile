import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { EmptyState } from '@/components/ui/empty-state';
import { PressScale } from '@/components/ui/press-scale';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { feedbackApi, type FeedbackThread } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { registerFeedbackPushToken } from '@/lib/feedback-push';
import { formatDateTime } from '@/lib/utils';
import { color, type as font } from '@/theme/tokens';

export default function AdminMessagesScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await feedbackApi.getThreads();
      setThreads(list);
    } catch (e) {
      toast(getErrorMessage(e, 'Impossible de charger les messages'), 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      if (user?.role !== 'admin') {
        router.replace('/settings');
        return;
      }
      void load();
      void registerFeedbackPushToken({ request: true });
    }, [load, user?.role])
  );

  if (user?.role !== 'admin') return null;

  return (
    <Screen scroll onRefresh={() => void load()} refreshing={loading && threads.length > 0}>
      <ScreenHeader title="Messages" back />
      {threads.length === 0 && !loading ? (
        <EmptyState
          title="Aucun message"
          description="Quand un utilisateur écrit depuis Réglages, sa discussion apparaît ici — un fil par personne."
        />
      ) : (
        threads.map((t) => (
          <PressScale
            key={t.userId}
            onPress={() => router.push(`/admin-messages/${t.userId}` as never)}
            style={styles.row}>
            <View style={styles.icon}>
              <MessageCircle color={color.primary} size={18} />
              {t.unread > 0 ? <View style={styles.dot} /> : null}
            </View>
            <View style={styles.mid}>
              <View style={styles.head}>
                <Text style={styles.name} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.date}>{formatDateTime(t.lastAt)}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {t.lastFrom === 'admin' ? 'Vous : ' : ''}
                {t.preview}
              </Text>
            </View>
          </PressScale>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.primary,
  },
  mid: { flex: 1, gap: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' },
  name: { fontFamily: font.sansSemi, fontSize: 16, color: color.text, flex: 1 },
  date: { fontFamily: font.sans, fontSize: 12, color: color.textMuted },
  preview: { fontFamily: font.sans, fontSize: 14, lineHeight: 20, color: color.textSecondary },
});
