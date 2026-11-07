import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ThreadView } from '@/components/feedback/thread-view';
import { Screen } from '@/components/ui/screen';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/contexts/toast';
import { feedbackApi, type FeedbackMessage } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { markInboxSeen, registerFeedbackPushToken } from '@/lib/feedback-push';

export default function FeedbackScreen() {
  const toast = useToast();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await feedbackApi.getMine();
      setMessages(list);
      const last = list[list.length - 1]?.created_at;
      await markInboxSeen(last);
    } catch (e) {
      toast(getErrorMessage(e, 'Impossible de charger vos messages'), 'err');
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void registerFeedbackPushToken();
    }, [load])
  );

  const send = async (body: string) => {
    setSending(true);
    try {
      const created = await feedbackApi.send(body);
      setMessages((prev) => [...prev, created]);
      toast('Message envoyé. Merci pour votre retour.', 'ok');
    } catch (e) {
      toast(getErrorMessage(e, 'Envoi impossible'), 'err');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen padded edges={['top']} style={styles.root}>
      <ScreenHeader title="Votre avis" back />
      <ThreadView
        messages={messages}
        mine="user"
        onSend={send}
        sending={sending}
        placeholder="Bugs, idées, avis… un retour à la ligne reste un retour à la ligne."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
