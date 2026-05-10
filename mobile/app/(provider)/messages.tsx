import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { getInitials, nameToAvatarColor } from '../../src/utils/avatar';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const ACCENT = '#C9A84C';

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
  active:    { bg: 'rgba(245,158,11,0.15)',  text: '#FCD34D' },
  completed: { bg: 'rgba(16,185,129,0.15)',  text: '#34D399' },
  cancelled: { bg: 'rgba(139,92,246,0.15)',  text: '#C4B5FD' },
  disputed:  { bg: 'rgba(239,68,68,0.15)',   text: '#FCA5A5' },
};

const MSG_TYPE_KEY: Record<string, string> = {
  audio:        'msgTypes.audio',
  image:        'msgTypes.image',
  video:        'msgTypes.video',
  location:     'msgTypes.location',
  profile_card: 'msgTypes.profileCard',
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
  const { colors, isDark } = useTheme();
  const { headerPad, contentPad } = useInsets();

  const [jobs, setJobs]             = useState<ConversationJob[]>([]);
  const [lastMsgMap, setLastMsgMap] = useState<Record<string, LastMsg>>({});
  const [unreadMap, setUnreadMap]   = useState<Record<string, number>>({});
  const [myId, setMyId]             = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef                  = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);

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

  const totalUnread = Object.values(unreadMap).reduce((s, n) => s + n, 0);

  const renderItem = ({ item }: { item: ConversationJob }) => {
    const itemColors  = JOB_STATUS_COLORS[item.status] ?? JOB_STATUS_COLORS.active;
    const clientName  = item.client?.full_name ?? '—';
    const lastMsg     = lastMsgMap[item.id];
    const unread      = unreadMap[item.id] ?? 0;
    const lastContent = lastMsg
      ? (MSG_TYPE_KEY[lastMsg.msg_type] ? t(MSG_TYPE_KEY[lastMsg.msg_type]) : lastMsg.content)
      : item.request?.title;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => openChat(item.id)}
      >
        <View style={[styles.avatar, { backgroundColor: nameToAvatarColor(clientName) }]}>
          <Text style={styles.avatarText}>{getInitials(clientName)}</Text>
          {unread > 0 && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <Text style={styles.personName} numberOfLines={1}>{clientName}</Text>
            <Text style={styles.cardTime}>
              {fmtTime(lastMsg?.created_at ?? item.created_at, lang)}
            </Text>
          </View>

          <Text style={styles.requestTitle} numberOfLines={1}>
            {item.request?.title}
          </Text>

          <View style={styles.bottomRow}>
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

  const gradColors: [string, string] = isDark
    ? [colors.bg, '#1A1407']
    : ['#FDF6E3', '#FFFBF8'];

  return (
    <LinearGradient colors={gradColors} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <Text style={styles.headerTitle}>💬 {t('chat.title')}</Text>
        {totalUnread > 0 && (
          <Text style={styles.headerSub}>{totalUnread} رسالة غير مقروءة</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: contentPad + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Text style={{ fontSize: 40 }}>💬</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('chat.noConversations')}</Text>
              <Text style={styles.emptySub}>{t('providerJobs.noConvSub')}</Text>
            </View>
          }
        />
      )}
    </LinearGradient>
  );
}

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
      paddingHorizontal: 20,
      paddingBottom:     16,
    },
    headerTitle: {
      fontSize: 22, fontWeight: '800',
      color: colors.textPrimary, textAlign: ta,
    },
    headerSub: {
      fontSize: 12, color: ACCENT, fontWeight: '600', marginTop: 3, textAlign: ta,
    },

    listContent: { paddingHorizontal: 16, paddingTop: 8 },

    card: {
      flexDirection:   isRTL ? 'row-reverse' : 'row',
      alignItems:      'center',
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.90)',
      borderRadius:    16,
      padding:         14,
      marginBottom:    10,
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.20)',
      gap:             12,
      shadowColor:     '#000',
      shadowOffset:    { width: 0, height: 2 },
      shadowOpacity:   0.05,
      shadowRadius:    6,
      elevation:       1,
    },

    avatar: {
      width: 52, height: 52, borderRadius: 26,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative',
    },
    avatarText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    unreadDot: {
      position: 'absolute',
      top: 0, right: isRTL ? undefined : 0, left: isRTL ? 0 : undefined,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: '#EF4444',
      borderWidth: 2, borderColor: isDark ? colors.surface : '#fff',
    },

    cardContent: { flex: 1, gap: 3 },
    topRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between', alignItems: 'center',
    },
    personName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, flex: 1, textAlign: ta },
    cardTime:   { fontSize: 11, color: colors.textMuted, flexShrink: 0, marginStart: 8 },

    requestTitle: { fontSize: 12, color: ACCENT, fontWeight: '600', textAlign: ta },

    bottomRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      justifyContent: 'space-between', alignItems: 'center', marginTop: 2,
    },
    lastMsgText:   { fontSize: 12, color: colors.textMuted, flex: 1, textAlign: ta },
    lastMsgUnread: { color: colors.textSecondary, fontWeight: '600' },

    unreadBadge: {
      minWidth: 22, height: 22, borderRadius: 11,
      backgroundColor: '#EF4444',
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 5, flexShrink: 0,
    },
    unreadText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
    statusText:  { fontSize: 10, fontWeight: '700' },

    empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyIconWrap: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: isDark ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.08)',
      alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: ta },
    emptySub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
