// ============================================================
// WASEET — Admin Support Inbox
// Visible only to users with is_admin = true.
// Lists all open support tickets, highlights payment requests.
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

type Filter = 'all' | 'payment' | 'resolved';

interface AdminTicket {
  id: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  plan_tier?: string;
  plan_amount_jod?: number;
  opened_at: string;
  user: { full_name: string }[] | null;
}

const STATUS_COLOR: Record<string, string> = {
  open:      '#7DD3FC',
  in_review: '#FCD34D',
  resolved:  '#86EFAC',
  closed:    '#94A3B8',
};

const CAT_ICON: Record<string, string> = {
  payment: '💳', order: '📋', provider: '🔧',
  account: '👤', contract: '📄', other: '💬',
};

export default function AdminScreen() {
  const { headerPad } = useInsets();
  const router  = useRouter();
  const { t, ta, lang } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tickets,    setTickets]    = useState<AdminTicket[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<Filter>('all');
  const [isAdmin,    setIsAdmin]    = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!userData?.is_admin) { setIsAdmin(false); return; }
      setIsAdmin(true);

      let query = supabase
        .from('support_tickets')
        .select('id, category, priority, status, subject, plan_tier, plan_amount_jod, opened_at, user:users!user_id(full_name)')
        .order('opened_at', { ascending: false })
        .limit(100);

      if (filter === 'payment') {
        query = query.eq('category', 'payment').in('status', ['open', 'in_review']);
      } else if (filter === 'resolved') {
        query = query.in('status', ['resolved', 'closed']);
      } else {
        query = query.in('status', ['open', 'in_review']);
      }

      const { data } = await query;
      if (data) setTickets(data as AdminTicket[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>غير مصرح بالدخول</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',      label: t('admin.filterAll') },
    { key: 'payment',  label: t('admin.filterPayments') },
    { key: 'resolved', label: t('admin.filterResolved') },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
          <Text style={styles.backArrow}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterTabText, filter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ticket list */}
      <FlatList
        data={tickets}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('admin.emptyText')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPayment = item.category === 'payment';
          const isPending = isPayment && (item.status === 'open' || item.status === 'in_review');
          return (
            <TouchableOpacity
              style={[styles.ticketCard, isPending && styles.ticketCardPayment]}
              onPress={() => router.push({ pathname: '/support-thread', params: { id: item.id } } as any)}
              activeOpacity={0.8}
            >
              <View style={styles.ticketRow}>
                <Text style={styles.catIcon}>{CAT_ICON[item.category] ?? '💬'}</Text>
                <View style={styles.ticketBody}>
                  <Text style={[styles.ticketSubject, { textAlign: ta }]} numberOfLines={1}>
                    {item.subject}
                  </Text>
                  <Text style={styles.ticketMeta}>
                    {item.user?.[0]?.full_name ?? '—'}  ·  {fmtDate(item.opened_at)}
                  </Text>
                  {isPayment && item.plan_tier && (
                    <View style={styles.planRow}>
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>
                          {t('admin.planLabel', { tier: item.plan_tier })}
                        </Text>
                      </View>
                      {item.plan_amount_jod != null && (
                        <Text style={styles.amountText}>
                          {t('admin.amountLabel', { amount: item.plan_amount_jod })}
                        </Text>
                      )}
                      {isPending && (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>{t('admin.pendingBadge')}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? STATUS_COLOR.open }]} />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 },
    errorText: { fontSize: 16, color: colors.textMuted },
    backBtn:   { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
    backBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backArrow:   { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.textPrimary },

    filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    filterTab: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterTabActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
    filterTabText:       { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    filterTabTextActive: { color: colors.bg },

    listContent: { padding: 12, gap: 8, paddingBottom: 32 },
    empty:       { alignItems: 'center', paddingVertical: 60 },
    emptyText:   { fontSize: 15, color: colors.textMuted },

    ticketCard: {
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 14, borderWidth: 1, borderColor: colors.border,
    },
    ticketCardPayment: { borderColor: 'rgba(201,168,76,0.4)', backgroundColor: 'rgba(201,168,76,0.05)' },
    ticketRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    catIcon:     { fontSize: 22, marginTop: 2 },
    ticketBody:  { flex: 1, gap: 4 },
    ticketSubject: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    ticketMeta:    { fontSize: 12, color: colors.textMuted },

    planRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
    planBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    planBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
    amountText:    { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    pendingBadge:  { backgroundColor: '#422006', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    pendingBadgeText: { fontSize: 11, fontWeight: '600', color: '#FCD34D' },

    statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  });
}
