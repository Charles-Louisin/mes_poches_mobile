import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ThreadView } from '@/components/feedback/thread-view';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/contexts/auth';
import { useToast } from '@/contexts/toast';
import { feedbackApi, type FeedbackMessage } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { markInboxSeen } from '@/lib/feedback-push';

export default function AdminConversationScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState('Discussion');
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const detail = await feedbackApi.getThread(userId);
      setTitle(detail.user.name);
      setMessages(detail.messages);
      const last = detail.messages[detail.messages.length - 1]?.created_at;
      await markInboxSeen(last);
    } catch (e) {
      toast(getErrorMessage(e, 'Impossible de charger la discussion'), 'err');
    }
  }, [toast, userId]);

  useFocusEffect(
    useCallback(() => {
      if (user?.role !== 'admin') {
        router.replace('/settings');
        return;
      }
      void load();
    }, [load, user?.role])
  );

  const send = async (body: string) => {
    if (!userId) return;
    setSending(true);
    try {
      const created = await feedbackApi.reply(userId, body);
      setMessages((prev) => [...prev, created]);
    } catch (e) {
      toast(getErrorMessage(e, 'Réponse impossible'), 'err');
    } finally {
      setSending(false);
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <Screen padded edges={['top']} style={styles.root}>
      <ScreenHeader title={title} back />
      <ThreadView
        messages={messages}
        mine="admin"
        onSend={send}
        sending={sending}
        placeholder="Répondre à cet utilisateur…"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
