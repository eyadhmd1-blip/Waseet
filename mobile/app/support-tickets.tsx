// ============================================================
// WASEET — My Support Tickets Screen
// List of user's tickets, filterable by status
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  opened_at: string;
  resolved_at?: string;
}

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  open:      { color: '#7DD3FC', bg: '#0C4A6E' },
  in_review: { color: '#FCD34D', bg: '#78350F' },
  resolved:  { color: '#86EFAC', bg: '#14532D' },
  closed:    { color: '#94A3B8', bg: '#334155' },
};

const CAT_ICON: Record<string, string> = {
  payment: '💳', order: '📋', provider: '🔧',
  account: '👤', contract: '📄', other: '💬',
};

type Filter = 'all' | 'open' | 'in_review' | 'resolved';

export default function SupportTicketsScreen() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();

  const [tickets,    setTickets]  = useState<Ticket[]>([]);
  const [loading,    setLoading]  = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [filter,     setFilter]   = useState<Filter>('all');

  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',       label: t('supportTickets.filterAll') },
    { key: 'open',      label: t('supportTickets.filterOpen') },
    { key: 'in_review', label: t('supportTickets.filterReview') },
    { key: 'resolved',  label: t('supportTickets.filterResolved') },
  ];

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
    if (!user) { setLoading(false); return; }

    let q = supabase
      .from('support_tickets')
      .select('id, category, priority, status, subject, rating, opened_at, resolved_at')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false });

    if (filter !== 'all') q = q.eq('status', filter);

    const { data } = await q.limit(50);
    if (data) setTickets(data as Ticket[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefresh(true);
    await load();
    setRefresh(false);
  }, [load]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  const renderItem = ({ item }: { item: Ticket }) => {
    const meta = STATUS_COLOR[item.status] ?? STATUS_COLOR.open;
    return (
      <TouchableOpacity
        style={styles.ticketCard}
        onPress={() => router.push({ pathname: '/support-thread', params: { id: item.id } } as any)}
        activeOpacity={0.8}
      >
        <View style={[styles.ticketHead, {}]}>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{statusLabel(item.status)}</Text>
          </View>
          <View style={styles.ticketMeta}>
            <Text style={styles.ticketDate}>{fmtDate(item.opened_at)}</Text>
            <Text style={styles.ticketCat}>{CAT_ICON[item.category] ?? '💬'}</Text>
          </View>
        </View>

        <Text style={[styles.ticketSubj, { textAlign: ta }]} numberOfLines={2}>{item.subject}</Text>

        {item.rating && (
          <Text style={[styles.ticketRating, { textAlign: ta }]}>{'⭐'.repeat(item.rating)}</Text>
        )}

        {item.priority === 'urgent' && (
          <View style={styles.urgentPill}>
            <Text style={styles.urgentPillText}>{t('supportTickets.urgentLabel')}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('supportTickets.headerTitle')}</Text>
        <TouchableOpacity onPress={() => router.push('/support-new' as any)}>
          <Text style={styles.newBtn}>{t('supportTickets.newBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>{t('supportTickets.emptyText')}</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/support-new' as any)}
              >
                <Text style={styles.emptyBtnText}>{t('support.openTicketBtn')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: COLORS.textSecondary, transform: [{ scaleX: -1 }] },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  newBtn:   { fontSize: 14, fontWeight: '700', color: COLORS.accent },

  filterRow:      { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  chip:           { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  chipActive:     { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  chipText:       { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive: { color: COLORS.accent },

  list: { padding: 16, paddingBottom: 48 },

  ticketCard:      { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  ticketHead:      { justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:      { fontSize: 12, fontWeight: '700' },
  ticketMeta:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketDate:      { fontSize: 11, color: COLORS.textMuted },
  ticketCat:       { fontSize: 16 },
  ticketSubj:      { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 20 },
  ticketRating:    { fontSize: 14, marginTop: 6 },
  urgentPill:      { alignSelf: 'flex-start', marginTop: 6, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  urgentPillText:  { fontSize: 11, color: '#F87171', fontWeight: '700' },

  empty:       { alignItems: 'center', paddingTop: HEADER_PAD },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { fontSize: 16, color: COLORS.textMuted, marginBottom: 20 },
  emptyBtn:    { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText:{ fontSize: 14, fontWeight: '700', color: COLORS.bg },
});
