// ============================================================
// WASEET — Admin Support Inbox
// Visible only to users with is_admin = true.
// Lists all open support tickets, highlights payment requests.
// ============================================================

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

type Filter = 'all' | 'payment' | 'resolved' | 'suggestions';

interface AdminSuggestion {
  id: string;
  service_name: string;
  category_hint: string | null;
  status: string;
  created_at: string;
  user: { full_name: string }[] | null;
}

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
  const { t, lang, isRTL } = useLanguage();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const [tickets,     setTickets]     = useState<AdminTicket[]>([]);
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [filter,      setFilter]      = useState<Filter>('all');
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [actioning,   setActioning]   = useState<string | null>(null);

  // ── Grant Trial modal ─────────────────────────────────────────
  const [trialModal,    setTrialModal]    = useState(false);
  const [trialPhone,    setTrialPhone]    = useState('');
  const [trialProvider, setTrialProvider] = useState<{ id: string; full_name: string; trial_used: boolean } | null>(null);
  const [trialSearching, setTrialSearching] = useState(false);
  const [trialGranting,  setTrialGranting]  = useState(false);

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

      if (filter === 'suggestions') {
        const { data: suggData } = await supabase
          .from('service_suggestions')
          .select('id, service_name, category_hint, status, created_at, user:users!user_id(full_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(100);
        setSuggestions((suggData ?? []) as AdminSuggestion[]);
      } else {
        if (filter === 'payment') {
          query = query.eq('category', 'payment').in('status', ['open', 'in_review']);
        } else if (filter === 'resolved') {
          query = query.in('status', ['resolved', 'closed']);
        } else {
          query = query.in('status', ['open', 'in_review']);
        }
        const { data } = await query;
        if (data) setTickets(data as AdminTicket[]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const handleSearchProvider = useCallback(async () => {
    const phone = trialPhone.trim();
    if (!phone) return;
    setTrialSearching(true);
    setTrialProvider(null);
    const normalized = phone.startsWith('0') ? '+962' + phone.slice(1) : phone;
    const { data } = await supabase
      .from('users')
      .select('id, full_name, providers!inner(trial_used)')
      .eq('phone', normalized)
      .maybeSingle();
    setTrialSearching(false);
    if (!data) {
      Alert.alert(t('common.attention'), t('admin.trialNotFound'));
      return;
    }
    const prov = data.providers as any;
    setTrialProvider({
      id:         data.id,
      full_name:  data.full_name,
      trial_used: Array.isArray(prov) ? prov[0]?.trial_used : prov?.trial_used,
    });
  }, [trialPhone, t]);

  const handleGrantTrial = useCallback(async () => {
    if (!trialProvider) return;
    if (trialProvider.trial_used) {
      Alert.alert(t('common.attention'), t('admin.trialAlreadyUsed'));
      return;
    }
    Alert.alert(
      t('admin.trialGrant'),
      t('admin.trialConfirm', { name: trialProvider.full_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.trialGrant'),
          onPress: async () => {
            setTrialGranting(true);
            const { error } = await supabase.rpc('admin_grant_trial', {
              p_provider_id: trialProvider.id,
            });
            setTrialGranting(false);
            if (error) {
              const msg = error.message?.includes('trial_already_used')
                ? t('admin.trialAlreadyUsed')
                : error.message;
              Alert.alert(t('common.error'), msg);
            } else {
              Alert.alert(t('common.success'), t('admin.trialSuccess'));
              setTrialModal(false);
              setTrialPhone('');
              setTrialProvider(null);
            }
          },
        },
      ],
    );
  }, [trialProvider, t]);

  const handleSuggestionAction = useCallback(async (id: string, name: string, action: 'approved' | 'rejected') => {
    const isApprove = action === 'approved';
    Alert.alert(
      isApprove ? t('admin.suggApprove') : t('admin.suggReject'),
      isApprove ? t('admin.suggApproveConfirm', { name }) : t('admin.suggRejectConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: isApprove ? t('admin.suggApprove') : t('admin.suggReject'),
          style: isApprove ? 'default' : 'destructive',
          onPress: async () => {
            setActioning(id);
            const { error } = await supabase
              .from('service_suggestions')
              .update({ status: action, reviewed_at: new Date().toISOString() })
              .eq('id', id);
            setActioning(null);
            if (error) {
              Alert.alert(t('common.error'), error.message);
            } else {
              setSuggestions(prev => prev.filter(s => s.id !== id));
            }
          },
        },
      ],
    );
  }, [t]);

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
    { key: 'all',         label: t('admin.filterAll') },
    { key: 'payment',     label: t('admin.filterPayments') },
    { key: 'resolved',    label: t('admin.filterResolved') },
    { key: 'suggestions', label: t('admin.filterSuggestions') },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
          <Text style={styles.backArrow}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.title')}</Text>
        <TouchableOpacity style={styles.trialHeaderBtn} onPress={() => { setTrialModal(true); setTrialPhone(''); setTrialProvider(null); }}>
          <Text style={styles.trialHeaderBtnText}>🎁</Text>
        </TouchableOpacity>
      </View>

      {/* Grant Trial Modal */}
      <Modal visible={trialModal} transparent animationType="slide" onRequestClose={() => setTrialModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('admin.trialModalTitle')}</Text>

            <View style={styles.modalSearchRow}>
              <TextInput
                style={styles.modalInput}
                placeholder={t('admin.trialSearchPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={trialPhone}
                onChangeText={v => { setTrialPhone(v); setTrialProvider(null); }}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
              <TouchableOpacity
                style={[styles.modalSearchBtn, trialSearching && styles.modalBtnDisabled]}
                onPress={handleSearchProvider}
                disabled={trialSearching}
              >
                {trialSearching
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalSearchBtnText}>{t('admin.trialSearch')}</Text>
                }
              </TouchableOpacity>
            </View>

            {trialProvider && (
              <View style={styles.modalProviderCard}>
                <Text style={styles.modalProviderName}>{trialProvider.full_name}</Text>
                {trialProvider.trial_used && (
                  <Text style={styles.modalProviderWarn}>{t('admin.trialAlreadyUsed')}</Text>
                )}
                {!trialProvider.trial_used && (
                  <TouchableOpacity
                    style={[styles.modalGrantBtn, trialGranting && styles.modalBtnDisabled]}
                    onPress={handleGrantTrial}
                    disabled={trialGranting}
                  >
                    {trialGranting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.modalGrantBtnText}>{t('admin.trialGrant')}</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTrialModal(false)}>
              <Text style={styles.modalCloseBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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

      {/* Suggestions list */}
      {filter === 'suggestions' ? (
        <FlatList
          data={suggestions}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('admin.suggEmpty')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isProcessing = actioning === item.id;
            return (
              <View style={styles.suggCard}>
                <View style={styles.suggHeader}>
                  <Text style={styles.suggIcon}>💡</Text>
                  <View style={styles.ticketBody}>
                    <Text style={styles.ticketSubject}>{item.service_name}</Text>
                    <Text style={styles.ticketMeta}>
                      {item.user?.[0]?.full_name ?? '—'}  ·  {fmtDate(item.created_at)}
                    </Text>
                    {item.category_hint ? (
                      <Text style={styles.suggHint}>{item.category_hint}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.suggActions}>
                  <TouchableOpacity
                    style={[styles.suggApproveBtn, isProcessing && styles.suggBtnDisabled]}
                    onPress={() => handleSuggestionAction(item.id, item.service_name, 'approved')}
                    disabled={isProcessing}
                  >
                    {isProcessing
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.suggApproveBtnText}>{t('admin.suggApprove')}</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.suggRejectBtn, isProcessing && styles.suggBtnDisabled]}
                    onPress={() => handleSuggestionAction(item.id, item.service_name, 'rejected')}
                    disabled={isProcessing}
                  >
                    <Text style={styles.suggRejectBtnText}>{t('admin.suggReject')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      ) : (
        /* Ticket list */
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
                    <Text style={styles.ticketSubject} numberOfLines={1}>
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
      )}
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
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
    ticketSubject: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textAlign: ta },
    ticketMeta:    { fontSize: 12, color: colors.textMuted },

    planRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
    planBadge: { backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    planBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
    amountText:    { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    pendingBadge:  { backgroundColor: '#422006', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    pendingBadgeText: { fontSize: 11, fontWeight: '600', color: '#FCD34D' },

    statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },

    suggCard:        { backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    suggHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    suggIcon:        { fontSize: 22, marginTop: 2 },
    suggHint:        { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    suggActions:     { flexDirection: 'row', gap: 8 },
    suggApproveBtn:  { flex: 1, backgroundColor: '#15803D', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
    suggRejectBtn:   { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#EF4444' },
    suggBtnDisabled: { opacity: 0.5 },
    suggApproveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    suggRejectBtnText:  { fontSize: 13, fontWeight: '700', color: '#EF4444' },

    trialHeaderBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    trialHeaderBtnText: { fontSize: 20 },

    modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalBox:         { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
    modalTitle:       { fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    modalSearchRow:   { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 },
    modalInput:       { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.border },
    modalSearchBtn:   { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
    modalBtnDisabled: { opacity: 0.5 },
    modalSearchBtnText: { fontSize: 13, fontWeight: '700', color: colors.bg },

    modalProviderCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
    modalProviderName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: ta },
    modalProviderWarn: { fontSize: 13, color: '#EF4444', textAlign: ta },
    modalGrantBtn:     { backgroundColor: '#15803D', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    modalGrantBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    modalCloseBtn:     { paddingVertical: 12, alignItems: 'center' },
    modalCloseBtnText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  });
}
