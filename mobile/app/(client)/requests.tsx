// ============================================================
// WASEET — Client Requests  (UI Redesign — logic unchanged)
// ============================================================

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase }             from '../../src/lib/supabase';
import { useLanguage }          from '../../src/hooks/useLanguage';
import type { ServiceRequest }  from '../../src/types';
import { useInsets }            from '../../src/hooks/useInsets';
import { HEADER_PAD }           from '../../src/utils/layout';
import { useTheme }             from '../../src/context/ThemeContext';
import type { AppColors }       from '../../src/constants/colors';

type Filter = 'all' | 'open' | 'in_progress' | 'completed' | 'expired';
type Tab    = 'requests' | 'contracts';

type RecurringContract = {
  id: string;
  title: string;
  category_slug: string;
  city: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  duration_months: number;
  status: 'bidding' | 'active' | 'paused' | 'completed' | 'cancelled';
  created_at: string;
};

const CONTRACT_STATUS_ACCENT: Record<string, string> = {
  bidding:   '#F97316',
  active:    '#10B981',
  paused:    '#3B82F6',
  completed: '#9CA3AF',
  cancelled: '#EF4444',
};
const CONTRACT_STATUS_BG: Record<string, string> = {
  bidding:   'rgba(249,115,22,0.13)',
  active:    'rgba(16,185,129,0.13)',
  paused:    'rgba(59,130,246,0.13)',
  completed: 'rgba(156,163,175,0.15)',
  cancelled: 'rgba(239,68,68,0.13)',
};

const H_PAD = 20;

const STATUS_ACCENT: Record<string, string> = {
  open:        '#3B82F6',
  reviewing:   '#F97316',
  in_progress: '#F59E0B',
  completed:   '#10B981',
  cancelled:   '#8B5CF6',
  expired:     '#9CA3AF',
};
const STATUS_BG: Record<string, string> = {
  open:        'rgba(59,130,246,0.13)',
  reviewing:   'rgba(249,115,22,0.13)',
  in_progress: 'rgba(245,158,11,0.13)',
  completed:   'rgba(16,185,129,0.13)',
  cancelled:   'rgba(139,92,246,0.13)',
  expired:     'rgba(156,163,175,0.15)',
};
const FILTER_ACCENT: Record<Filter, string> = {
  all:         '#6B7280',
  open:        '#3B82F6',
  in_progress: '#F59E0B',
  completed:   '#10B981',
  expired:     '#9CA3AF',
};

function BidsChip({ label, colors }: { label: string; colors: AppColors }) {
  const ringScale   = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale,   { toValue: 1.55, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0,    duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale,   { toValue: 1,    duration: 0,   useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.7,  duration: 0,   useNativeDriver: true }),
        ]),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position:     'absolute',
          top: 0, bottom: 0, left: 0, right: 0,
          borderRadius: 10,
          borderWidth:  2,
          borderColor:  colors.accent,
          transform:    [{ scale: ringScale }],
          opacity:      ringOpacity,
        }}
      />
      <View style={{
        backgroundColor:   colors.accentDim,
        borderRadius:      10,
        paddingHorizontal: 10,
        paddingVertical:   5,
        flexDirection:     'row',
        alignItems:        'center',
        gap:               4,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
          {label}
        </Text>
        <Text style={{ fontSize: 11, color: colors.accent, opacity: 0.75 }}>←</Text>
      </View>
    </View>
  );
}

export default function ClientRequests() {
  const { headerPad } = useInsets();
  const router                    = useRouter();
  const { t, lang, isRTL }        = useLanguage();
  const { colors, isDark }        = useTheme();
  const { tab: tabParam }         = useLocalSearchParams<{ tab?: string }>();

  const [allRequests,      setAllRequests]      = useState<ServiceRequest[]>([]);
  const [filter,           setFilter]           = useState<Filter>('all');
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [hasError,         setHasError]         = useState(false);
  const [tab,              setTab]              = useState<Tab>(tabParam === 'contracts' ? 'contracts' : 'requests');
  const [contracts,        setContracts]        = useState<RecurringContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [userName,         setUserName]         = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);

  // sync tab from deep-link params (e.g. navigate from recurring-request success)
  useEffect(() => {
    if (tabParam === 'contracts' || tabParam === 'requests') setTab(tabParam);
  }, [tabParam]);

  // fetch first name once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase.from('users').select('full_name').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.full_name) setUserName(data.full_name.split(' ')[0]); });
    });
  }, []);

  const FILTERS: { key: Filter; label: string; emptyLabel?: string }[] = [
    { key: 'all',         label: t('requests.filterAll') },
    { key: 'open',        label: t('requests.filterOpen'),        emptyLabel: t('requests.filterOpenEmpty') },
    { key: 'in_progress', label: t('requests.filterInProgress'),  emptyLabel: t('requests.filterInProgressEmpty') },
    { key: 'completed',   label: t('requests.filterCompleted'),   emptyLabel: t('requests.filterCompletedEmpty') },
    { key: 'expired',     label: t('requests.filterExpired'),     emptyLabel: t('requests.filterExpiredEmpty') },
  ];

  const SUMMARY_CARDS: { key: Filter; emoji: string }[] = [
    { key: 'all',         emoji: '📋' },
    { key: 'open',        emoji: '🟠' },
    { key: 'in_progress', emoji: '🔧' },
    { key: 'completed',   emoji: '✅' },
    { key: 'expired',     emoji: '🕐' },
  ];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return t('requests.greetMorning');
    if (h >= 12 && h < 17) return t('requests.greetAfternoon');
    if (h >= 17 && h < 21) return t('requests.greetEvening');
    return t('requests.greetDefault');
  }, [lang]);

  const greetingEmoji = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return '☀️';
    if (h >= 12 && h < 17) return '🌤️';
    if (h >= 17 && h < 21) return '🌛';
    return '🌙';
  }, []);

  const greetingLine = userName
    ? (lang === 'ar' ? `${greetingEmoji} ${greeting}، ${userName}` : `${greetingEmoji} ${greeting}, ${userName}`)
    : `${greetingEmoji} ${greeting}`;

  const STATUS_LABEL: Record<string, string> = {
    open:        t('requests.statusOpen'),
    reviewing:   t('requests.statusReviewing'),
    in_progress: t('requests.statusInProgress'),
    completed:   t('requests.statusCompleted'),
    cancelled:   t('requests.statusCancelled'),
    expired:     t('requests.statusExpired'),
  };

  const CONTRACT_STATUS_LABEL: Record<string, string> = {
    bidding:   t('requests.contractStatusBidding'),
    active:    t('requests.contractStatusActive'),
    paused:    t('requests.contractStatusPaused'),
    completed: t('requests.contractStatusCompleted'),
    cancelled: t('requests.contractStatusCancelled'),
  };

  const FREQUENCY_LABEL: Record<string, string> = {
    weekly:   t('requests.freqWeekly'),
    biweekly: t('requests.freqBiweekly'),
    monthly:  t('requests.freqMonthly'),
  };

  // ── Data loading — always fetch all, filter client-side ──────
  const load = useCallback(async () => {
    setHasError(false);
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('requests')
        .select('*, category:service_categories(name_ar, name_en, icon), bids_count:bids(count)')
        .eq('client_id', user.id)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false });

      if (data) setAllRequests(data);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);  // no [filter] dependency — filter is applied client-side

  const loadContracts = useCallback(async () => {
    try {
      setContractsLoading(true);
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) return;
      const { data } = await supabase
        .from('recurring_contracts')
        .select('id, title, category_slug, city, frequency, duration_months, status, created_at')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setContracts(data);
    } finally {
      setContractsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Safety net: stop spinner after 12s on slow network
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    loadContracts();
  }, [load, loadContracts]));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (tab === 'contracts') await loadContracts();
    else await load();
    setRefreshing(false);
  }, [load, loadContracts, tab]);

  const getCategoryName = (item: ServiceRequest) => {
    const cat = (item as any).category;
    if (cat) return lang === 'ar' ? cat.name_ar : (cat.name_en ?? cat.name_ar);
    return t(`categories.${item.category_slug}`, item.category_slug);
  };

  // ── Client-side filter + per-chip counts ─────────────────────
  const filteredRequests = useMemo(() => {
    if (filter === 'all')         return allRequests;
    if (filter === 'open')        return allRequests.filter(r => r.status === 'open' || r.status === 'reviewing');
    return allRequests.filter(r => r.status === filter);
  }, [allRequests, filter]);

  const counts = useMemo<Record<Filter, number>>(() => ({
    all:         allRequests.length,
    open:        allRequests.filter(r => r.status === 'open' || r.status === 'reviewing').length,
    in_progress: allRequests.filter(r => r.status === 'in_progress').length,
    completed:   allRequests.filter(r => r.status === 'completed').length,
    expired:     allRequests.filter(r => r.status === 'expired').length,
  }), [allRequests]);

  const greetSub = useMemo(() => {
    if (tab !== 'requests' || loading) return null;
    if (counts.open > 0)        return t('requests.greetSubOpen', { count: counts.open });
    if (counts.in_progress > 0) return t('requests.greetSubInProgress', { count: counts.in_progress });
    if (allRequests.length === 0) return t('requests.greetSubNoRequests');
    return t('requests.greetSubTotal', { count: allRequests.length });
  }, [counts, allRequests.length, tab, loading, lang]);

  // ── Request Card ─────────────────────────────────────────────
  const renderItem = ({ item }: { item: ServiceRequest }) => {
    const accent    = STATUS_ACCENT[item.status] ?? STATUS_ACCENT.open;
    const badgeBg   = STATUS_BG[item.status]     ?? STATUS_BG.open;
    const bidsCount = (item as any).bids_count?.[0]?.count ?? 0;

    return (
      <TouchableOpacity
        style={[styles.card, { borderStartColor: accent, borderStartWidth: 4 }]}
        activeOpacity={0.78}
        onPress={() => router.push({ pathname: '/request-detail', params: { id: item.id } })}
      >
        <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
          <Text
            style={[styles.cardTitle, { flex: 1, ...(!isRTL ? { marginRight: 8 } : { marginLeft: 8 }) }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.cardMeta}>
          {getCategoryName(item)} · {t(`cities.${item.city}`, item.city)}
        </Text>

        <View style={[styles.cardFooter, { flexDirection: 'row' }]}>
          <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString(
              lang === 'ar' ? 'ar-JO' : 'en-GB',
              { day: 'numeric', month: 'short' },
            )}
          </Text>
          <View style={[styles.footerEnd, { flexDirection: 'row' }]}>
            {item.status === 'open' && bidsCount > 0 && (
              <BidsChip
                label={t('requests.bidCount', { count: bidsCount })}
                colors={colors}
              />
            )}
            {item.ai_suggested_price_min && item.ai_suggested_price_max && (
              <View>
                <Text style={styles.aiPriceTag}>✨ {t('newRequest.aiTag')}</Text>
                <Text style={styles.aiPrice}>
                  {item.ai_suggested_price_min}–{item.ai_suggested_price_max} {t('common.jod')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {(item.status === 'expired' || item.status === 'cancelled') && (
          <TouchableOpacity
            style={styles.repostBtn}
            activeOpacity={0.82}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: '/(client)/new-request',
                params: { repost_from: item.id },
              } as any);
            }}
          >
            <Text style={styles.repostBtnText}>{t('requests.repostBtn')}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ── Contract Card ─────────────────────────────────────────────
  const renderContractItem = ({ item }: { item: RecurringContract }) => {
    const accent = CONTRACT_STATUS_ACCENT[item.status] ?? CONTRACT_STATUS_ACCENT.bidding;
    const bg     = CONTRACT_STATUS_BG[item.status]     ?? CONTRACT_STATUS_BG.bidding;

    return (
      <View style={[styles.card, { borderStartColor: accent, borderStartWidth: 4 }]}>
        <View style={[styles.cardHeader, { flexDirection: 'row' }]}>
          <Text
            style={[styles.cardTitle, { flex: 1, ...(!isRTL ? { marginRight: 8 } : { marginLeft: 8 }) }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.badgeText, { color: accent }]}>
              {CONTRACT_STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.cardMeta}>
          {t(`categories.${item.category_slug}`, item.category_slug)} · {t(`cities.${item.city}`, item.city)}
        </Text>

        <View style={[styles.contractChipRow, { flexDirection: 'row' }]}>
          <View style={styles.contractChip}>
            <Text style={styles.contractChipText}>🔄 {FREQUENCY_LABEL[item.frequency]}</Text>
          </View>
          <View style={styles.contractChip}>
            <Text style={styles.contractChipText}>
              {item.duration_months} {t('requests.months')}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardDate, { marginTop: 6, textAlign: isRTL ? 'right' : 'left' }]}>
          {new Date(item.created_at).toLocaleDateString(
            lang === 'ar' ? 'ar-JO' : 'en-GB',
            { day: 'numeric', month: 'short', year: 'numeric' },
          )}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[styles.headerRow, { flexDirection: 'row' }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerGreet} numberOfLines={1}>{greetingLine}</Text>
            {greetSub ? (
              <Text style={styles.headerSub} numberOfLines={1}>{greetSub}</Text>
            ) : (
              <Text style={styles.headerSub} numberOfLines={1}> </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push(
              tab === 'contracts' ? '/recurring-request' : '/(client)/new-request'
            )}
          >
            <Text style={styles.newBtnText}>
              ＋ {tab === 'contracts' ? t('requests.newContract') : t('requests.newRequest')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Tab switcher ─────────────────────────────────────────── */}
      <Animated.View style={[styles.tabRow, { opacity: fadeAnim, flexDirection: 'row' }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabBtnText, tab === 'requests' && styles.tabBtnTextActive]}>
            {t('requests.tabRequests')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'contracts' && styles.tabBtnActive]}
          onPress={() => setTab('contracts')}
        >
          <Text style={[styles.tabBtnText, tab === 'contracts' && styles.tabBtnTextActive]}>
            {t('requests.tabContracts')} 🔄
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Summary cards (requests tab only) ───────────────────── */}
      {tab === 'requests' && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.summaryScroll, { flexDirection: 'row' }]}
          >
            {SUMMARY_CARDS.map(({ key, emoji }) => {
              const active = filter === key;
              const accent = FILTER_ACCENT[key];
              const count  = counts[key];
              const label  = FILTERS.find(f => f.key === key)?.label ?? '';
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.summaryCard,
                    active && { borderColor: accent, backgroundColor: accent + '18' },
                  ]}
                  onPress={() => setFilter(key)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.summaryEmoji}>{emoji}</Text>
                  <Text style={[styles.summaryCount, active && { color: accent }]}>{count}</Text>
                  <Text style={[styles.summaryLabel, active && { color: accent, fontWeight: '700' }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Content ─────────────────────────────────────────────── */}
      {tab === 'requests' ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredRequests}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            ListEmptyComponent={
              hasError ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIconWrap}>
                    <Text style={styles.emptyIcon}>⚠️</Text>
                  </View>
                  <Text style={styles.emptyTitle}>{t('common.error')}</Text>
                  <Text style={styles.emptyDesc}>
                    {lang === 'ar' ? 'تعذّر تحميل الطلبات' : 'Failed to load requests'}
                  </Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={load}>
                    <Text style={styles.emptyBtnText}>
                      {lang === 'ar' ? '↻ إعادة المحاولة' : '↻ Retry'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : filter === 'all' ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIconWrap}>
                    <Text style={styles.emptyIcon}>📋</Text>
                  </View>
                  <Text style={styles.emptyTitle}>{t('requests.noRequests')}</Text>
                  <Text style={styles.emptyDesc}>{t('requests.noRequestsDesc')}</Text>
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={() => router.push('/(client)/new-request')}
                  >
                    <Text style={styles.emptyBtnText}>{t('requests.emptyBtn')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.empty}>
                  <View style={styles.emptyIconWrap}>
                    <Text style={styles.emptyIcon}>🔍</Text>
                  </View>
                  <Text style={styles.emptyTitle}>
                    {t('requests.noRequestsFiltered', {
                      label: FILTERS.find(f => f.key === filter)?.emptyLabel ?? '',
                    })}
                  </Text>
                  <TouchableOpacity
                    style={[styles.emptyBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent }]}
                    onPress={() => setFilter('all')}
                  >
                    <Text style={[styles.emptyBtnText, { color: colors.accent }]}>
                      {t('requests.showAll')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            }
          />
        )
      ) : (
        contractsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={contracts}
            keyExtractor={item => item.id}
            renderItem={renderContractItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Text style={styles.emptyIcon}>🔄</Text>
                </View>
                <Text style={styles.emptyTitle}>{t('requests.noContracts')}</Text>
                <Text style={styles.emptyDesc}>{t('requests.noContractsSub')}</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/recurring-request')}
                >
                  <Text style={styles.emptyBtnText}>{t('requests.newContract')}</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )
      )}
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta      = isRTL ? 'right' : 'left' as const;
  const btnText = isDark ? '#000' : '#fff';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // ── Header
    header:      { paddingHorizontal: H_PAD, paddingTop: HEADER_PAD, paddingBottom: 14 },
    headerRow:   { alignItems: 'center', gap: 12 },
    headerGreet: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: ta },
    headerSub:   { fontSize: 13, color: colors.textMuted, marginTop: 3, textAlign: ta },
    newBtn: {
      backgroundColor:   colors.accent,
      borderRadius:      12,
      paddingHorizontal: 14,
      paddingVertical:   9,
      flexShrink:        0,
    },
    newBtnText: { fontSize: 13, fontWeight: '700', color: btnText },

    // ── Tab switcher
    tabRow: {
      marginHorizontal: H_PAD,
      marginBottom:     14,
      backgroundColor:  colors.surface,
      borderRadius:     14,
      borderWidth:      1,
      borderColor:      colors.border,
      padding:          4,
      gap:              4,
    },
    tabBtn: {
      flex:            1,
      paddingVertical: 9,
      borderRadius:    11,
      alignItems:      'center',
    },
    tabBtnActive:     { backgroundColor: colors.accent },
    tabBtnText:       { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    tabBtnTextActive: { color: isDark ? '#000' : '#fff' },

    // ── Summary cards
    summaryScroll: { paddingHorizontal: H_PAD, paddingBottom: 16, gap: 10 },
    summaryCard: {
      width:           76,
      paddingVertical: 12,
      alignItems:      'center',
      borderRadius:    16,
      borderWidth:     1.5,
      borderColor:     colors.border,
      backgroundColor: colors.surface,
      gap:             3,
    },
    summaryEmoji: { fontSize: 20 },
    summaryCount: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, lineHeight: 28 },
    summaryLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },

    // ── List
    listContent: { paddingHorizontal: H_PAD, paddingBottom: 32, gap: 10, flexGrow: 1 },

    // ── Card
    card: {
      backgroundColor:   colors.surface,
      borderRadius:      16,
      borderWidth:       1,
      borderColor:       colors.border,
      paddingVertical:   14,
      paddingHorizontal: 16,
    },
    cardHeader: { alignItems: 'flex-start', marginBottom: 4 },
    cardTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary, alignSelf: 'stretch', textAlign: ta },
    cardMeta:   { fontSize: 12, color: colors.textMuted, marginBottom: 10, alignSelf: 'stretch', textAlign: ta },
    cardFooter: { alignItems: 'center', justifyContent: 'space-between' },
    cardDate:   { fontSize: 12, color: colors.textMuted },
    footerEnd:  { alignItems: 'center', gap: 6 },

    badge:     { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
    badgeText: { fontSize: 11, fontWeight: '700' },

    bidsChip:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    bidChipText: { fontSize: 12, fontWeight: '700' },

    aiPriceTag: { fontSize: 10, color: colors.textMuted, marginBottom: 1 },
    aiPrice: { fontSize: 12, color: colors.accent, fontWeight: '600' },

    repostBtn: {
      marginTop:       12,
      backgroundColor: colors.accent,
      borderRadius:    10,
      paddingVertical: 10,
      alignItems:      'center',
    },
    repostBtnText: { fontSize: 13, fontWeight: '700', color: isDark ? '#000' : '#fff' },

    // ── Contract chips
    contractChipRow: { gap: 8, flexWrap: 'wrap', marginBottom: 4 },
    contractChip: {
      backgroundColor:   colors.bg,
      borderWidth:       1,
      borderColor:       colors.border,
      borderRadius:      8,
      paddingHorizontal: 10,
      paddingVertical:   5,
    },
    contractChipText: { fontSize: 12, color: colors.textSecondary },

    // ── Empty state
    empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: H_PAD },
    emptyIconWrap: {
      width:           80,
      height:          80,
      borderRadius:    40,
      backgroundColor: colors.surface,
      borderWidth:     1,
      borderColor:     colors.border,
      alignItems:      'center',
      justifyContent:  'center',
      marginBottom:    20,
    },
    emptyIcon:    { fontSize: 36 },
    emptyTitle:   { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, alignSelf: 'stretch', textAlign: ta },
    emptyDesc:    { fontSize: 14, color: colors.textSecondary, marginBottom: 24, lineHeight: 20, alignSelf: 'stretch', textAlign: ta },
    emptyBtn: {
      backgroundColor:   colors.accent,
      borderRadius:      14,
      paddingHorizontal: 28,
      paddingVertical:   14,
    },
    emptyBtnText: { fontSize: 15, fontWeight: '700', color: btnText },
  });
}
