import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

type ConversationJob = {
  id: string;
  status: string;
  created_at: string;
  request: { title: string; category_slug: string };
  client:  { full_name: string };
};

type LastMsg = {
  content:    string;
  msg_type:   string;
  created_at: string;
  sender_id:  string;
  is_read:    boolean;
};

const JOB_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#78350F', text: '#FCD34D' },
  completed: { bg: '#14532D', text: '#86EFAC' },
  cancelled: { bg: '#3B0764', text: '#C4B5FD' },
  disputed:  { bg: '#7F1D1D', text: '#FCA5A5' },
};

const MSG_TYPE_ICON: Record<string, string> = {
  audio:        '🎤 رسالة صوتية',
  image:        '📷 صورة',
  video:        '🎥 فيديو',
  location:     '📍 موقع',
  profile_card: '👤 بروفايل مزود',
};

function fmtTime(iso: string, lang: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString(lang === 'ar' ? 'ar-JO' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7)  return d.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { weekday: 'short' });
  return d.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short' });
}

export default function ProviderMessages() {
  const router = useRouter();
  const { t, lang, isRTL } = useLanguage();
  const { colors } = useTheme();

  const [jobs, setJobs]               = useState<ConversationJob[]>([]);
  const [lastMsgMap, setLastMsgMap]   = useState<Record<string, LastMsg>>({});
  const [unreadMap, setUnreadMap]     = useState<Record<string, number>>({});
  const [myId, setMyId]               = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const channelRef                    = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const JOB_STATUS_LABEL: Record<string, string> = {
    active:    t('providerJobs.statusActive'),
    completed: t('providerJobs.statusCompleted'),
    cancelled: t('providerJobs.statusCancelled'),
    disputed:  t('providerJobs.statusDisputed'),
  };

  const loadMessages = useCallback(async (jobIds: string[], userId: string) => {
    if (jobIds.length === 0) return;
    const { data } = await supabase
      .from('messages')
      .select('job_id, content, msg_type, created_at, sender_id, is_read')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false });

    const lm: Record<string, LastMsg> = {};
    const ur: Record<string, number>  = {};
    for (const m of data ?? []) {
      if (!lm[m.job_id]) lm[m.job_id] = m as LastMsg;
      if (!m.is_read && m.sender_id !== userId) {
        ur[m.job_id] = (ur[m.job_id] ?? 0) + 1;
      }
    }
    setLastMsgMap(lm);
    setUnreadMap(ur);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setMyId(user.id);

      const { data } = await supabase
        .from('jobs')
        .select(`
          id, status, created_at,
          request:requests(title, category_slug),
          client:users!jobs_client_id_fkey(full_name)
        `)
        .eq('provider_id', user.id)
        .in('status', ['active', 'completed', 'disputed'])
        .order('created_at', { ascending: false });

      const loaded = (data ?? []) as unknown as ConversationJob[];
      setJobs(loaded);
      await loadMessages(loaded.map(j => j.id), user.id);
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => { load(); }, [load]);

  // Realtime: watch for new messages on any active job
  useEffect(() => {
    if (!myId || jobs.length === 0) return;
    const jobIds = new Set(jobs.map(j => j.id));

    channelRef.current = supabase
      .channel('provider-conv-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new as any;
        if (!jobIds.has(msg.job_id)) return;
        setLastMsgMap(prev => ({ ...prev, [msg.job_id]: msg }));
        if (msg.sender_id !== myId) {
          setUnreadMap(prev => ({ ...prev, [msg.job_id]: (prev[msg.job_id] ?? 0) + 1 }));
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [jobs, myId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openChat = useCallback((jobId: string) => {
    setUnreadMap(prev => ({ ...prev, [jobId]: 0 }));
    router.push({ pathname: '/chat', params: { job_id: jobId } });
  }, [router]);

  const renderItem = ({ item }: { item: ConversationJob }) => {
    const itemColors  = JOB_STATUS_COLORS[item.status] ?? JOB_STATUS_COLORS.active;
    const clientName  = item.client?.full_name ?? '—';
    const lastMsg     = lastMsgMap[item.id];
    const unread      = unreadMap[item.id] ?? 0;
    const lastContent = lastMsg
      ? (MSG_TYPE_ICON[lastMsg.msg_type] ?? lastMsg.content)
      : item.request?.title;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => openChat(item.id)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{clientName.charAt(0)}</Text>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.cardTopRow}>
            <Text style={styles.personName} numberOfLines={1}>{clientName}</Text>
            <Text style={styles.cardTime}>
              {fmtTime(lastMsg?.created_at ?? item.created_at, lang)}
            </Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text
              style={[styles.lastMsgText, unread > 0 && styles.lastMsgUnread]}
              numberOfLines={1}
            >
              {lastContent}
            </Text>
            {unread > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: itemColors.bg }]}>
                <Text style={[styles.statusText, { color: itemColors.text }]}>
                  {JOB_STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('chat.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>{t('chat.noConversations')}</Text>
              <Text style={styles.emptySub}>{t('providerJobs.noConvSub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.bg },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header:      { paddingHorizontal: 20, paddingTop: HEADER_PAD, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, textAlign: ta },
    listContent: { paddingVertical: 8 },

    card:        { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
    avatar:      { width: 50, height: 50, borderRadius: 25, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText:  { fontSize: 20, fontWeight: '700', color: '#F5F3FF' },
    cardInfo:    { flex: 1, gap: 4 },

    cardTopRow:    { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
    personName:    { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: ta },
    cardTime:      { fontSize: 11, color: colors.textMuted, flexShrink: 0, marginStart: 8 },

    cardBottomRow: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
    lastMsgText:   { fontSize: 13, color: colors.textMuted, flex: 1, textAlign: ta },
    lastMsgUnread: { color: colors.textSecondary, fontWeight: '600' },

    unreadBadge:  { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, flexShrink: 0 },
    unreadText:   { fontSize: 11, fontWeight: '700', color: '#fff' },

    statusBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
    statusText:   { fontSize: 10, fontWeight: '700' },

    empty:      { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyIcon:  { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: ta },
    emptySub:   { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: ta },
  });
}
