// ============================================================
// WASEET — Client Requests  (UI Redesign — logic unchanged)
// ============================================================

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase }             from '../../src/lib/supabase';
import { useLanguage }          from '../../src/hooks/useLanguage';
import type { ServiceRequest }  from '../../src/types';
import { useInsets }            from '../../src/hooks/useInsets';
import { HEADER_PAD }           from '../../src/utils/layout';
import { flexRow }              from '../../src/utils/rtl';
import { useTheme }             from '../../src/context/ThemeContext';
import type { AppColors }       from '../../src/constants/colors';

type Filter = 'all' | 'open' | 'in_progress' | 'completed' | 'expired';

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

export default function ClientRequests() {
  const { headerPad } = useInsets();
  const router          = useRouter();
  const { t, ta, lang, isRTL } = useLanguage();
  const { colors, isDark }     = useTheme();

  const [requests,   setRequests]   = useState<ServiceRequest[]>([]);
  const [filter,     setFilter]     = useState<Filter>('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',         label: t('requests.filterAll') },
    { key: 'open',        label: t('requests.filterOpen') },
    { key: 'in_progress', label: t('requests.filterInProgress') },
    { key: 'completed',   label: t('requests.filterCompleted') },
    { key: 'expired',     label: t('requests.filterExpired') },
  ];

  const STATUS_LABEL: Record<string, string> = {
    open:        t('requests.statusOpen'),
    reviewing:   t('requests.statusReviewing'),
    in_progress: t('requests.statusInProgress'),
    completed:   t('requests.statusCompleted'),
    cancelled:   t('requests.statusCancelled'),
    expired:     t('requests.statusExpired'),
  };

  // ── Data loading (unchanged) ─────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) { setLoading(false); return; }

      let query = supabase
        .from('requests')
        .select('*, category:service_categories(name_ar, name_en, icon), bids_count:bids(count)')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'open')    query = query.in('status', ['open', 'reviewing']);
      else if (filter === 'all') query = query.not('status', 'eq', 'cancelled');
      else                       query = query.eq('status', filter);

      const { data } = await query;
      if (data) setRequests(data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const getCategoryName = (item: ServiceRequest) => {
    const cat = (item as any).category;
    if (cat) return lang === 'ar' ? cat.name_ar : (cat.name_en ?? cat.name_ar);
    return t(`categories.${item.category_slug}`, item.category_slug);
  };

  const openCount = useMemo(
    () => requests.filter(r => r.status === 'open' || r.status === 'reviewing').length,
    [requests],
  );

  // ── Card ─────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: ServiceRequest }) => {
    const accent    = STATUS_ACCENT[item.status] ?? STATUS_ACCENT.open;
    const badgeBg   = STATUS_BG[item.status]     ?? STATUS_BG.open;
    const bidsCount = (item as any).bids_count?.[0]?.count ?? 0;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { borderStartColor: accent, borderStartWidth: 4 },
        ]}
        activeOpacity={0.78}
        onPress={() => router.push({ pathname: '/request-detail', params: { id: item.id } })}
      >
        {/* Title + badge */}
        <View style={[styles.cardHeader, { flexDirection: flexRow(isRTL) }]}>
          <Text
            style={[styles.cardTitle, { textAlign: ta, flex: 1, ...(!isRTL ? { marginRight: 8 } : { marginLeft: 8 }) }]}
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

        {/* Category · City */}
        <Text style={[styles.cardMeta, { textAlign: ta }]}>
          {getCategoryName(item)} · {t(`cities.${item.city}`, item.city)}
        </Text>

        {/* Footer */}
        <View style={[styles.cardFooter, { flexDirection: flexRow(isRTL) }]}>
          <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString(
              lang === 'ar' ? 'ar-JO' : 'en-GB',
              { day: 'numeric', month: 'short' },
            )}
          </Text>

          <View style={[styles.footerEnd, { flexDirection: flexRow(isRTL) }]}>
            {item.status === 'open' && bidsCount > 0 && (
              <View style={[styles.bidsChip, { backgroundColor: colors.accentDim }]}>
                <Text style={[styles.bidChipText, { color: colors.accent }]}>
                  {t('requests.bidCount', { count: bidsCount })}
                </Text>
              </View>
            )}

            {item.ai_suggested_price_min && item.ai_suggested_price_max && (
              <Text style={styles.aiPrice}>
                {item.ai_suggested_price_min}–{item.ai_suggested_price_max} {t('common.jod')}
              </Text>
            )}
          </View>
        </View>

        {/* Repost banner — only for expired requests */}
        {item.status === 'expired' && (
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
            <Text style={styles.repostBtnText}>
              {t('requests.repostBtn')}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[styles.headerRow, { flexDirection: flexRow(isRTL) }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { textAlign: ta }]}>
              {t('requests.title')}
            </Text>
            {openCount > 0 && (
              <Text style={[styles.headerSub, { textAlign: ta }]}>
                {openCount} {t('requests.statusOpen')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/(client)/new-request')}
          >
            <Text style={styles.newBtnText}>＋ {t('requests.newRequest')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Filter chips ────────────────────────────────────────── */}
      <Animated.View style={{ opacity: fadeAnim }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filterScroll,
            { flexDirection: flexRow(isRTL) },
          ]}
        >
          {FILTERS.map(f => {
            const active      = filter === f.key;
            const chipAccent  = FILTER_ACCENT[f.key];
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  active && {
                    backgroundColor: chipAccent + '20',
                    borderColor:     chipAccent,
                  },
                ]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[
                  styles.filterText,
                  active && { color: chipAccent, fontWeight: '700' },
                ]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── Content ─────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIcon}>📋</Text>
              </View>
              <Text style={[styles.emptyTitle, { textAlign: ta }]}>
                {t('requests.noRequests')}
              </Text>
              <Text style={[styles.emptyDesc, { textAlign: ta }]}>
                {t('requests.noRequestsDesc')}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(client)/new-request')}
              >
                <Text style={styles.emptyBtnText}>{t('requests.emptyBtn')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: AppColors, isDark: boolean) {
  const btnText = isDark ? '#000' : '#fff';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // ── Header
    header:      { paddingHorizontal: H_PAD, paddingTop: HEADER_PAD, paddingBottom: 12 },
    headerRow:   { alignItems: 'center', gap: 12 },
    headerTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
    headerSub:   { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    newBtn: {
      backgroundColor: colors.accent,
      borderRadius:    12,
      paddingHorizontal: 14,
      paddingVertical:   8,
    },
    newBtnText: { fontSize: 13, fontWeight: '700', color: btnText },

    // ── Filter chips
    filterScroll: {
      paddingHorizontal: H_PAD,
      paddingBottom:     14,
      gap:               8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical:   8,
      borderRadius:      20,
      backgroundColor:   colors.surface,
      borderWidth:       1.5,
      borderColor:       colors.border,
    },
    filterText: { fontSize: 13, color: colors.textSecondary },

    // ── List
    listContent: { paddingHorizontal: H_PAD, paddingBottom: 32, gap: 10 },

    // ── Card
    card: {
      backgroundColor: colors.surface,
      borderRadius:    16,
      borderWidth:     1,
      borderColor:     colors.border,
      paddingVertical:   14,
      paddingHorizontal: 16,
    },
    cardHeader: { alignItems: 'flex-start', marginBottom: 4 },
    cardTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    cardMeta:   { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
    cardFooter: { alignItems: 'center', justifyContent: 'space-between' },
    cardDate:   { fontSize: 12, color: colors.textMuted },
    footerEnd:  { alignItems: 'center', gap: 6 },

    badge:     { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
    badgeText: { fontSize: 11, fontWeight: '700' },

    bidsChip:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    bidChipText: { fontSize: 12, fontWeight: '700' },

    aiPrice: { fontSize: 12, color: colors.accent, fontWeight: '600' },

    repostBtn: {
      marginTop:         12,
      backgroundColor:   colors.accent,
      borderRadius:      10,
      paddingVertical:   10,
      alignItems:        'center',
    },
    repostBtnText: { fontSize: 13, fontWeight: '700', color: isDark ? '#000' : '#fff' },

    // ── Empty state
    empty:         { alignItems: 'center', paddingTop: 60, paddingHorizontal: H_PAD },
    emptyIconWrap: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 20,
    },
    emptyIcon:    { fontSize: 36 },
    emptyTitle:   { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    emptyDesc:    { fontSize: 14, color: colors.textSecondary, marginBottom: 24, lineHeight: 20 },
    emptyBtn: {
      backgroundColor:   colors.accent,
      borderRadius:      14,
      paddingHorizontal: 28,
      paddingVertical:   14,
    },
    emptyBtnText: { fontSize: 15, fontWeight: '700', color: btnText },
  });
}
