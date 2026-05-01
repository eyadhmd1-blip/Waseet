import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
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
}

// ─── Helpers ──────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  job_commit_request:  '✅',
  perseverance_reward: '🏆',
  no_bids_reminder:    '⏰',
  admin_broadcast:     '📢',
  seasonal:            '📅',
  lifecycle:           '🔄',
  behavioral:          '🧠',
  ai:                  '✨',
};

function notifIcon(type: string | null): string {
  return TYPE_ICON[type ?? ''] ?? '🔔';
}

function relativeTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
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

const PAGE = 20;

// ─── Screen ───────────────────────────────────────────────────

export default function NotificationInboxScreen() {
  const { colors }    = useTheme();
  const { t, ta, lang, isRTL } = useLanguage();
  const router        = useRouter();
  const st            = useMemo(() => createSt(colors, isRTL), [colors, isRTL]);
  const locale        = lang === 'ar' ? 'ar' : 'en';

  const [items,      setItems]      = useState<NotifRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,    setHasMore]    = useState(true);
  const cursorRef = useRef<string | null>(null);

  // ── Fetch page ──────────────────────────────────────────────
  const fetchPage = useCallback(async (reset: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let q = supabase
      .from('notifications')
      .select('id, title, body, type, screen, metadata, is_read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE);

    if (!reset && cursorRef.current) {
      q = q.lt('created_at', cursorRef.current);
    }

    const { data } = await q;
    if (!data) return;

    if (reset) {
      setItems(data as NotifRow[]);
    } else {
      setItems(prev => [...prev, ...(data as NotifRow[])]);
    }

    if (data.length > 0) cursorRef.current = data[data.length - 1].created_at;
    setHasMore(data.length === PAGE);
  }, []);

  // ── Initial load ────────────────────────────────────────────
  const initialLoad = useCallback(async () => {
    setLoading(true);
    cursorRef.current = null;
    await fetchPage(true);
    setLoading(false);
  }, [fetchPage]);

  useState(() => { initialLoad(); });

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
    const data = {
      screen:      item.screen      ?? undefined,
      job_id:      (item.metadata?.job_id      as string) ?? undefined,
      provider_id: (item.metadata?.provider_id as string) ?? undefined,
      notif_id:    (item.metadata?.notif_id    as string) ?? undefined,
      request_id:  (item.metadata?.request_id  as string) ?? undefined,
    };
    handleNotifTap(data, router);
  }, [router]);

  // ── Mark all read ───────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.rpc('mark_all_notifications_read', { p_user_id: session.user.id });
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  // ── Render item ─────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: NotifRow }) => (
    <TouchableOpacity
      style={[st.card, !item.is_read && st.cardUnread]}
      onPress={() => onTap(item)}
      activeOpacity={0.75}
    >
      <View style={st.cardLeft}>
        <Text style={st.icon}>{notifIcon(item.type)}</Text>
      </View>
      <View style={st.cardBody}>
        <View style={st.cardTop}>
          <Text style={st.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={st.time}>{relativeTime(item.created_at, locale)}</Text>
        </View>
        {!!item.body && (
          <Text style={st.body} numberOfLines={2}>
            {item.body}
          </Text>
        )}
      </View>
      {!item.is_read && <View style={st.unreadDot} />}
    </TouchableOpacity>
  ), [st, locale, onTap]);

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
      />

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
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
    },
    cardUnread: {
      borderColor:     colors.accent + '55',
      backgroundColor: colors.accentDim,
    },
    cardLeft: {
      width:          38,
      height:         38,
      borderRadius:   12,
      backgroundColor: colors.bg,
      alignItems:     'center',
      justifyContent: 'center',
      borderWidth:    1,
      borderColor:    colors.border,
    },
    icon:     { fontSize: 18 },
    cardBody: { flex: 1, gap: 4 },
    cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    title:    { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 20, textAlign: ta },
    time:     { fontSize: 11, color: colors.textMuted, flexShrink: 0 },
    body:     { fontSize: 13, color: colors.textSecondary, lineHeight: 18, textAlign: ta },

    unreadDot: {
      position:        'absolute',
      top:             14,
      right:           14,
      width:           8,
      height:          8,
      borderRadius:    4,
      backgroundColor: colors.accent,
    },

    empty:      { alignItems: 'center' },
    emptyIcon:  { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    emptySub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
