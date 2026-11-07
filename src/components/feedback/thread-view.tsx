import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardBottomInset } from '@/hooks/use-keyboard-bottom-inset';
import type { FeedbackMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { color, radius, type as font } from '@/theme/tokens';

export function ThreadView({
  messages,
  mine,
  onSend,
  sending,
  placeholder,
}: {
  messages: FeedbackMessage[];
  mine: 'user' | 'admin';
  onSend: (body: string) => Promise<void>;
  sending: boolean;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const keyboardInset = useKeyboardBottomInset();
  const safeInsets = useSafeAreaInsets();
  const bottomPad = keyboardInset > 0 ? 0 : Math.max(safeInsets.bottom, 8);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  useEffect(() => {
    if (keyboardInset <= 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [keyboardInset]);

  const submit = async () => {
    const body = draft.replace(/\u0000/g, '').trim();
    if (!body || sending) return;
    await onSend(draft);
    setDraft('');
  };

  return (
    <View style={[styles.flex, { paddingBottom: bottomPad }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled>
        {messages.length === 0 ? (
          <Text style={styles.empty}>Aucun message pour l’instant. Écrivez ci-dessous.</Text>
        ) : (
          messages.map((m) => {
            const own = m.from === mine;
            return (
              <View key={m._id} style={[styles.bubbleWrap, own ? styles.ownWrap : styles.otherWrap]}>
                <View style={[styles.bubble, own ? styles.own : styles.other]}>
                  <Text style={[styles.body, own ? styles.ownBody : styles.otherBody]}>{m.body}</Text>
                  <Text style={[styles.when, own ? styles.ownWhen : styles.otherWhen]}>
                    {formatDateTime(m.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={color.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={4000}
          style={styles.input}
        />
        <Button
          label="Envoyer"
          loadingLabel="Envoi…"
          onPress={() => void submit()}
          loading={sending}
          disabled={!draft.trim() || sending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 16, gap: 10, flexGrow: 1 },
  empty: {
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 21,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  bubbleWrap: { maxWidth: '88%' },
  ownWrap: { alignSelf: 'flex-end' },
  otherWrap: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  own: { backgroundColor: color.primary },
  other: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  body: { fontFamily: font.sans, fontSize: 15, lineHeight: 22 },
  ownBody: { color: color.white },
  otherBody: { color: color.text },
  when: { fontFamily: font.sans, fontSize: 11 },
  ownWhen: { color: 'rgba(255,255,255,0.78)' },
  otherWhen: { color: color.textMuted },
  composer: { gap: 10, paddingTop: 8, paddingBottom: 8 },
  input: {
    fontFamily: font.sans,
    fontSize: 16,
    color: color.text,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 96,
    maxHeight: 180,
  },
});
