import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { ServiceRequest } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

type Filter = 'all' | 'open' | 'in_progress' | 'completed';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open:        { bg: '#0C4A6E', text: '#7DD3FC' },
  in_progress: { bg: '#78350F', text: '#FCD34D' },
  completed:   { bg: '#14532D', text: '#86EFAC' },
  cancelled:   { bg: '#3B0764', text: '#C4B5FD' },
};

export default function ClientRequests() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();
  const { colors } = useTheme();
  const [requests, setRequests]   = useState<ServiceRequest[]>([]);
  const [filter, setFilter]       = useState<Filter>('all');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',         label: t('requests.filterAll') },
    { key: 'open',        label: t('requests.filterOpen') },
    { key: 'in_progress', label: t('requests.filterInProgress') },
    { key: 'completed',   label: t('requests.filterCompleted') },
  ];

  const STATUS_LABEL: Record<string, string> = {
    open:        t('requests.statusOpen'),
    in_progress: t('requests.statusInProgress'),
    completed:   t('requests.statusCompleted'),
    cancelled:   t('requests.statusCancelled'),
  };

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

      if (filter !== 'all') query = query.eq('status', filter);

      const { data } = await query;
      if (data) setRequests(data);
  
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

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

  const renderItem = ({ item }: { item: ServiceRequest }) => {
    const itemColors = STATUS_COLORS[item.status] ?? STATUS_COLORS.open;
    const bidsCount = (item as any).bids_count?.[0]?.count ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/request-detail', params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { textAlign: ta, marginEnd: 10 }]}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: itemColors.bg }]}>
            <Text style={[styles.badgeText, { color: itemColors.text }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardMeta, { textAlign: ta }]}>
          {getCategoryName(item)} · {t(`cities.${item.city}`, item.city)}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>
            {new Date(item.created_at).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short' })}
          </Text>

          {item.status === 'open' && bidsCount > 0 && (
            <View style={styles.bidsBtn}>
              <Text style={styles.bidsBtnText}>
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
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { textAlign: ta }]}>{t('requests.title')}</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>{t('requests.noRequests')}</Text>
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

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: colors.bg },
    center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header:      { paddingHorizontal: 20, paddingTop: HEADER_PAD, paddingBottom: 12 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },

    filterRow:       { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
    filterTab:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    filterTabActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
    filterText:      { fontSize: 13, color: colors.textSecondary },
    filterTextActive:{ color: colors.accent, fontWeight: '600' },

    listContent: { paddingHorizontal: 16, paddingBottom: 32 },

    card:       { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    cardTitle:  { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1, marginLeft: 10 },
    cardMeta:   { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardDate:   { fontSize: 12, color: colors.textMuted },

    badge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontWeight: '600' },

    bidsBtn:     { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    bidsBtnText: { fontSize: 12, fontWeight: '700', color: colors.bg },

    aiPrice: { fontSize: 12, color: colors.accent, fontWeight: '600' },

    empty:       { alignItems: 'center', paddingTop: HEADER_PAD },
    emptyIcon:   { fontSize: 48, marginBottom: 12 },
    emptyTitle:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 20 },
    emptyBtn:    { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
    emptyBtnText:{ fontSize: 15, fontWeight: '700', color: colors.bg },
  });
}
