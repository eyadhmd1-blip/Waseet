import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { handleNotifTap } from '../src/lib/notifRouting';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import { AppHeader } from '../src/components/AppHeader';
import type { AppColors } from '../src/constants/colors';

// ─── Types ────────────────────────────────────────────────────

interface NotifRow {
  id:         string;
  title:      string;
  body:       string | null;
  type:       string | null;
  screen:     string | null;
  metadata:   Record<string, unknown> | null;
  is_read:    boolean;
  created_at: string;
  _type?:     undefined;
}

interface DateHeaderItem {
  _type:  'header';
  id:     string;
  label:  string;
}

type DataItem = NotifRow | DateHeaderItem;

// ─── Helpers ──────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  job_commit_request:    '✅',
  confirm_job:           '🔑',
  bid_accepted:          '✅',
  job_rated:             '⭐',
  contract_bid_accepted: '🤝',
  perseverance_reward:   '🏆',
  no_bids_reminder:      '⏰',
  subscription_expired:  '🔴',
  subscription_warning:  '⚠️',
  admin_broadcast:       '📢',
  seasonal:              '📅',
  lifecycle:             '🔄',
  behavioral:            '🧠',
  ai:                    '✨',
  support_reply:         '💬',
  new_bid:               '💰',
  bid_rejected:          '❌',
  credits_added:         '💳',
  credits_deducted:      '💳',
  account_suspended:     '⚠️',
  account_unsuspended:   '✅',
  suggestion_approved:   '✅',
  new_contract:          '📅',
  urgent_request:        '⚡',
};

function notifIcon(type: string | null): string {
  return TYPE_ICON[type ?? ''] ?? '🔔';
}

function relativeTime(iso: string, locale: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (locale === 'ar') {
    if (mins  < 1)  return 'الآن';
    if (mins  < 60) return `منذ ${mins} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days  < 7)  return `منذ ${days} يوم`;
    return new Date(iso).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' });
  }
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function dateGroupLabel(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (locale === 'ar') {
    if (days < 1) return 'اليوم';
    if (days < 2) return 'أمس';
    if (days < 7) return 'هذا الأسبوع';
    return 'أقدم';
  }
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Older';
}

function groupByDate(items: NotifRow[], locale: string): DataItem[] {
  const result: DataItem[] = [];
  let lastGroup = '';
  for (const item of items) {
    const group = dateGroupLabel(item.created_at, locale);
    if (group !== lastGroup) {
      result.push({ _type: 'header', id: `hdr_${group}`, label: group });
      lastGroup = group;
    }
    result.push(item);
  }
  return result;
}

const PAGE = 20;

// ─── Screen ───────────────────────────────────────────────────

export default function NotificationInboxScreen() {
  const { colors }           = useTheme();
  const { t, lang, isRTL }  = useLanguage();
  const router               = useRouter();
  const st                   = useMemo(() => createSt(colors, isRTL), [colors, isRTL]);
  const locale               = lang === 'ar' ? 'ar' : 'en';

  const [items,       setItems]       = useState<NotifRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const cursorRef = useRef<{ created_at: string; id: string } | null>(null);

  // ── Fetch page ──────────────────────────────────────────────
  const fetchPage = useCallback(async (reset: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let q = supabase
      .from('notifications')
      .select('id, title, body, type, screen, metadata, is_read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .order('id',         { ascending: false })
      .limit(PAGE);

    if (!reset && cursorRef.current) {
      const { created_at, id } = cursorRef.current;
      q = q.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`);
    }

    const { data } = await q;
    if (!data) return;

    if (reset) {
      setItems(data as NotifRow[]);
    } else {
      setItems(prev => [...prev, ...(data as NotifRow[])]);
    }

    if (data.length > 0) {
      const last = data[data.length - 1];
      cursorRef.current = { created_at: last.created_at, id: last.id };
    }
    setHasMore(data.length === PAGE);
  }, []);

  // ── Initial load ────────────────────────────────────────────
  const initialLoad = useCallback(async () => {
    setLoading(true);
    cursorRef.current = null;
    await fetchPage(true);
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => { initialLoad(); }, [initialLoad]);

  // ── Pull-to-refresh ─────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = null;
    await fetchPage(true);
    setRefreshing(false);
  }, [fetchPage]);

  // ── Load more ───────────────────────────────────────────────
  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await fetchPage(false);
    setLoadingMore(false);
  }, [hasMore, loadingMore, fetchPage]);

  // ── Delete single notification ──────────────────────────────
  const deleteItem = useCallback(async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('notifications').delete().eq('id', id).eq('user_id', session.user.id);
    }
  }, []);

  // ── Long-press → delete prompt ──────────────────────────────
  const onLongPress = useCallback((item: NotifRow) => {
    Alert.alert(
      locale === 'ar' ? 'حذف الإشعار' : 'Delete notification',
      locale === 'ar' ? 'هل تريد حذف هذا الإشعار؟' : 'Delete this notification?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: locale === 'ar' ? 'حذف' : 'Delete', style: 'destructive', onPress: () => deleteItem(item.id) },
      ],
    );
  }, [locale, deleteItem]);

  // ── Tap notification ────────────────────────────────────────
  const onTap = useCallback(async (item: NotifRow) => {
    if (!item.is_read) {
      setItems(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.rpc('mark_notification_read', {
          p_notif_id: item.id,
          p_user_id:  session.user.id,
        });
      }
    }

    const routeData = {
      screen:      item.screen      ?? undefined,
      job_id:      (item.metadata?.job_id      as string) ?? undefined,
      provider_id: (item.metadata?.provider_id as string) ?? undefined,
      notif_id:    (item.metadata?.notif_id    as string) ?? undefined,
      request_id:  (item.metadata?.request_id  as string) ?? undefined,
    };

    const isLong     = (item.body?.length ?? 0) > 60 || item.title.length > 60;
    const isExpanded = expandedIds.has(item.id);

    if (isLong && !isExpanded) {
      setExpandedIds(prev => new Set(prev).add(item.id));
    } else {
      if (item.screen) {
        handleNotifTap(routeData, router);
      } else {
        setExpandedIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    }
  }, [router, expandedIds]);

  // ── Mark all read ───────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.rpc('mark_all_notifications_read', { p_user_id: session.user.id });
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  // ── Clear all ───────────────────────────────────────────────
  const clearAll = useCallback(() => {
    Alert.alert(
      locale === 'ar' ? 'حذف جميع الإشعارات' : 'Clear all notifications',
      locale === 'ar' ? 'هل تريد حذف جميع الإشعارات نهائياً؟' : 'Delete all notifications permanently?',
      [
        { text: locale === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text:  locale === 'ar' ? 'حذف الكل' : 'Clear all',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setItems([]);
            await supabase.from('notifications').delete().eq('user_id', session.user.id);
          },
        },
      ],
    );
  }, [locale]);

  // ── Grouped data ────────────────────────────────────────────
  const groupedData = useMemo(() => groupByDate(items, locale), [items, locale]);

  // ── Render item ─────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: DataItem }) => {
    // Date section header
    if (item._type === 'header') {
      return <Text style={st.dateHeader}>{item.label}</Text>;
    }

    const expanded  = expandedIds.has(item.id);
    const isLong    = (item.body?.length ?? 0) > 60 || item.title.length > 60;
    const showHint  = isLong && !expanded;

    return (
      <TouchableOpacity
        style={[st.card, !item.is_read && st.cardUnread, expanded && st.cardExpanded]}
        onPress={() => onTap(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={400}
        activeOpacity={0.75}
      >
        {/* Unread accent bar */}
        {!item.is_read && <View style={st.unreadBar} />}

        <View style={st.cardLeft}>
          <Text style={st.icon}>{notifIcon(item.type)}</Text>
        </View>

        <View style={st.cardBody}>
          <View style={st.cardTop}>
            <Text style={st.title} numberOfLines={expanded ? undefined : 2}>
              {item.title}
            </Text>
            <Text style={st.time}>{relativeTime(item.created_at, locale)}</Text>
          </View>
          {!!item.body && (
            <Text style={st.body} numberOfLines={expanded ? undefined : 2}>
              {item.body}
            </Text>
          )}
          {showHint && (
            <Text style={st.expandHint}>{t('notifInbox.expandHint')}</Text>
          )}
          {expanded && !item.screen && (
            <Text style={st.expandHint}>{t('notifInbox.collapseHint')}</Text>
          )}
        </View>

        {!item.is_read && <View style={st.unreadDot} />}
      </TouchableOpacity>
    );
  }, [st, locale, onTap, onLongPress, expandedIds, t]);

  const unreadCount = useMemo(() => items.filter(n => !n.is_read).length, [items]);

  // ── Footer spinner ──────────────────────────────────────────
  const ListFooter = loadingMore
    ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
    : null;

  // ── Empty state ─────────────────────────────────────────────
  const ListEmpty = loading ? null : (
    <View style={st.empty}>
      <Text style={st.emptyIcon}>🔔</Text>
      <Text style={st.emptyTitle}>{t('notifInbox.emptyTitle')}</Text>
      <Text style={st.emptySub}>{t('notifInbox.emptySub')}</Text>
    </View>
  );

  return (
    <View style={st.container}>
      <AppHeader
        variant="stack"
        title={t('notifInbox.headerTitle')}
        onBack={() => router.back()}
        {...(unreadCount > 0
          ? { actionIcon: 'checkmark-done-outline', onAction: markAllRead }
          : {})}
        {...(items.length > 0
          ? { actionIcon2: 'trash-outline', onAction2: clearAll }
          : {})}
      />

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={ListFooter}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={items.length === 0 ? st.emptyContainer : st.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createSt(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: colors.bg },
    center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent:    { padding: 12, paddingBottom: 32 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

    // Date section label
    dateHeader: {
      fontSize:    12,
      fontWeight:  '700',
      color:       colors.textMuted,
      textAlign:   ta,
      marginTop:   12,
      marginBottom: 6,
      paddingHorizontal: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    card: {
      flexDirection:   'row',
      alignItems:      'flex-start',
      backgroundColor: colors.surface,
      borderRadius:    16,
      padding:         14,
      marginBottom:    8,
      borderWidth:     1,
      borderColor:     colors.border,
      gap:             10,
      position:        'relative',
      overflow:        'hidden',
    },
    cardUnread: {
      borderColor:     colors.accent + '55',
      backgroundColor: colors.accentDim,
    },
    cardExpanded: { borderColor: colors.accent + '88' },

    // Colored bar at top of unread cards
    unreadBar: {
      position:              'absolute',
      top:                   0,
      left:                  0,
      right:                 0,
      height:                3,
      backgroundColor:       colors.accent,
      borderTopLeftRadius:   16,
      borderTopRightRadius:  16,
    },

    cardLeft: {
      width:           40,
      height:          40,
      borderRadius:    13,
      backgroundColor: colors.bg,
      alignItems:      'center',
      justifyContent:  'center',
      borderWidth:     1,
      borderColor:     colors.border,
      marginTop:       2,
    },
    icon:     { fontSize: 19 },
    cardBody: { flex: 1, gap: 4 },
    cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    title:    { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 20, textAlign: ta },
    time:     { fontSize: 11, color: colors.textMuted, flexShrink: 0, marginTop: 2 },
    body:     { fontSize: 13, color: colors.textSecondary, lineHeight: 18, textAlign: ta },
    expandHint: { fontSize: 11, color: colors.accent, marginTop: 6, textAlign: ta },

    unreadDot: {
      position:        'absolute',
      top:             12,
      right:           12,
      width:           9,
      height:          9,
      borderRadius:    5,
      backgroundColor: colors.accent,
      borderWidth:     1.5,
      borderColor:     colors.accentDim,
    },

    empty:      { alignItems: 'center' },
    emptyIcon:  { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    emptySub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
