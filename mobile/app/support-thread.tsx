// ============================================================
// WASEET — Support Ticket Thread Screen
// Chat-style message thread + reply input + rating
// ============================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { COLORS } from '../src/constants/theme';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';

interface Ticket {
  id: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  rating?: number;
  rating_note?: string;
  opened_at: string;
}

interface SupportMessage {
  id: string;
  sender_id: string | null;
  is_admin: boolean;
  body: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  open:      '#7DD3FC',
  in_review: '#FCD34D',
  resolved:  '#86EFAC',
  closed:    '#94A3B8',
};

export default function SupportThreadScreen() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, ta, lang } = useLanguage();

  const [ticket,            setTicket]            = useState<Ticket | null>(null);
  const [messages,          setMessages]          = useState<SupportMessage[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [body,              setBody]              = useState('');
  const [sending,           setSending]           = useState(false);
  const [rating,            setRating]            = useState(0);
  const [ratingNote,        setRatingNote]        = useState('');
  const [ratingSubmitting,  setRatingSubmitting]  = useState(false);
  const scrollRef          = useRef<ScrollView>(null);
  const currentUserIdRef   = useRef<string | null>(null);

  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';

  const statusColor = (status: string) => STATUS_COLOR[status] ?? STATUS_COLOR.open;
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      open:      t('supportTickets.statusOpen'),
      in_review: t('supportTickets.statusReview'),
      resolved:  t('supportTickets.statusResolved'),
      closed:    t('supportTickets.statusClosed'),
    };
    return map[status] ?? status;
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) currentUserIdRef.current = user.id;

    const [{ data: ticketData }, { data: msgs }] = await Promise.all([
      supabase
        .from('support_tickets')
        .select('id, category, priority, status, subject, rating, rating_note, opened_at')
        .eq('id', id)
        .single(),
      supabase
        .from('support_messages')
        .select('id, sender_id, is_admin, body, created_at')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (ticketData) setTicket(ticketData as Ticket);
    if (msgs)       setMessages(msgs as SupportMessage[]);
    setLoading(false);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime: new messages ────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`support_thread:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table:  'support_messages',
        filter: `ticket_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as SupportMessage]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Send message ──────────────────────────────────────────────
  const handleSend = async () => {
    if (!body.trim() || sending) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      ticket_id: id,
      sender_id: user.id,
      is_admin:  false,
      body:      body.trim(),
    });
    setSending(false);
    if (!error) setBody('');
  };

  // ── Submit rating ─────────────────────────────────────────────
  const handleRating = async () => {
    if (rating === 0) { Alert.alert(t('common.attention'), t('supportThread.ratingAlert')); return; }
    setRatingSubmitting(true);
    await supabase
      .from('support_tickets')
      .update({ rating, rating_note: ratingNote.trim() || null })
      .eq('id', id);
    setRatingSubmitting(false);
    setTicket(prev => prev ? { ...prev, rating, rating_note: ratingNote.trim() || undefined } : prev);
    Alert.alert(t('supportThread.thankYou'));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('supportThread.notFound')}</Text>
        <TouchableOpacity style={styles.backBtnLg} onPress={() => router.back()}>
          <Text style={styles.backBtnLgText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{ticket.subject}</Text>
          <Text style={[styles.topStatus, { color: statusColor(ticket.status) }]}>
            {statusLabel(ticket.status)}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyMsgs}>
            <Text style={styles.emptyMsgsText}>{t('supportThread.emptyMsgs')}</Text>
          </View>
        )}

        {messages.map(msg => (
          <View
            key={msg.id}
            style={[styles.bubbleWrap, msg.is_admin ? styles.bubbleLeft : styles.bubbleRight]}
          >
            <View style={[styles.bubble, msg.is_admin ? styles.bubbleAdmin : styles.bubbleUser]}>
              {msg.is_admin && (
                <Text style={styles.adminLabel}>
                  {msg.sender_id ? t('supportThread.adminLabel') : t('supportThread.botLabel')}
                </Text>
              )}
              <Text style={[styles.bubbleText, { textAlign: ta }]}>{msg.body}</Text>
              <Text style={[styles.bubbleTime, msg.is_admin ? styles.timeLeft : styles.timeRight]}>
                {fmtDate(msg.created_at)}
              </Text>
            </View>
          </View>
        ))}

        {/* Rating section (if resolved and not yet rated) */}
        {isResolved && !ticket.rating && (
          <View style={styles.ratingBox}>
            <Text style={styles.ratingTitle}>{t('supportThread.ratingTitle')}</Text>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRating(n)}>
                  <Text style={[styles.star, n <= rating && styles.starActive]}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <>
                <TextInput
                  style={styles.ratingInput}
                  placeholder={t('supportThread.ratingPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={ratingNote}
                  onChangeText={setRatingNote}
                  textAlign={ta}
                />
                <TouchableOpacity
                  style={styles.ratingBtn}
                  onPress={handleRating}
                  disabled={ratingSubmitting}
                >
                  {ratingSubmitting
                    ? <ActivityIndicator color={COLORS.bg} size="small" />
                    : <Text style={styles.ratingBtnText}>{t('supportThread.ratingBtn')}</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Already rated */}
        {isResolved && ticket.rating && (
          <View style={styles.ratedBox}>
            <Text style={styles.ratedText}>{t('supportThread.ratedText')} {'⭐'.repeat(ticket.rating)}</Text>
            {ticket.rating_note && <Text style={styles.ratedNote}>{ticket.rating_note}</Text>}
          </View>
        )}

      </ScrollView>

      {/* Input */}
      {!isResolved && (
        <View style={[styles.inputBar, {}]}>
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={COLORS.bg} size="small" />
              : <Text style={styles.sendBtnText}>{t('supportThread.sendBtn')}</Text>
            }
          </TouchableOpacity>
          <TextInput
            style={styles.inputField}
            placeholder={t('supportThread.inputPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={body}
            onChangeText={setBody}
            textAlign={ta}
            multiline
            maxLength={800}
          />
        </View>
      )}

      {isResolved && (
        <View style={styles.resolvedBar}>
          <Text style={styles.resolvedBarText}>{t('supportThread.resolvedBar')}</Text>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: COLORS.textMuted, marginBottom: 16 },
  backBtnLg:     { backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  backBtnLgText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },

  topBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:  { fontSize: 22, color: COLORS.textSecondary, transform: [{ scaleX: -1 }] },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle:  { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  topStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  messages:        { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 24, gap: 8 },

  emptyMsgs:     { alignItems: 'center', paddingVertical: 40 },
  emptyMsgsText: { fontSize: 14, color: COLORS.textMuted },

  bubbleWrap:  { },
  bubbleLeft:  { alignItems: 'flex-start' },
  bubbleRight: { alignItems: 'flex-end' },

  bubble:      { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleAdmin: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderTopLeftRadius: 4 },
  bubbleUser:  { backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderTopRightRadius: 4 },

  adminLabel: { fontSize: 11, fontWeight: '700', color: '#38BDF8', marginBottom: 4 },
  bubbleText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 6 },
  timeLeft:   { color: COLORS.textMuted },
  timeRight:  { color: 'rgba(245,158,11,0.6)', textAlign: 'right' },

  ratingBox:     { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#15803D', alignItems: 'center' },
  ratingTitle:   { fontSize: 14, fontWeight: '700', color: '#86EFAC', textAlign: 'center', marginBottom: 12 },
  starsRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  star:          { fontSize: 28, opacity: 0.3 },
  starActive:    { opacity: 1 },
  ratingInput:   { backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: COLORS.textPrimary, fontSize: 13, borderWidth: 1, borderColor: COLORS.border, width: '100%', marginBottom: 10 },
  ratingBtn:     { backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  ratingBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.bg },

  ratedBox:  { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginTop: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  ratedText: { fontSize: 14, color: COLORS.textPrimary },
  ratedNote: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

  inputBar:        { alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  inputField:      { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textPrimary, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border },
  sendBtn:         { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  sendBtnDisabled: { backgroundColor: COLORS.border },
  sendBtnText:     { fontSize: 14, fontWeight: '700', color: COLORS.bg },

  resolvedBar:     { padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center', backgroundColor: 'rgba(20,83,45,0.2)' },
  resolvedBarText: { fontSize: 13, color: '#86EFAC', fontWeight: '600' },
});
