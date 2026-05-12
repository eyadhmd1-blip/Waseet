import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { TIER_META } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { SavedProvider } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const ACCENT = '#C9A84C';

// ─── Saved Card ───────────────────────────────────────────────

function SavedCard({
  item, anim, onView, onUnsave, colors, isDark,
}: {
  item: SavedProvider; anim: Animated.Value;
  onView: () => void; onUnsave: () => void;
  colors: AppColors; isDark: boolean;
}) {
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);
  const prov = item.provider;
  if (!prov) return null;

  const tier = TIER_META[prov.reputation_tier];
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <TouchableOpacity style={styles.card} onPress={onView} activeOpacity={0.85}>
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: tier.color }]} />

        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: tier.color + '28' }]}>
          <Text style={[styles.avatarText, { color: tier.color }]}>
            {prov.user?.full_name?.charAt(0) ?? '?'}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.providerName} numberOfLines={1}>{prov.user?.full_name}</Text>
            {prov.badge_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
            <View style={[styles.tierChip, { backgroundColor: tier.color + '22' }]}>
              <Text style={[styles.tierChipText, { color: tier.color }]}>{tier.label_ar}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            {prov.score > 0 && (
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>⭐ {prov.score.toFixed(1)}</Text>
              </View>
            )}
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>🔨 {prov.lifetime_jobs} {t('providerProfile.jobsDone')}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>📍 {t(`cities.${prov.user?.city}`, prov.user?.city ?? '')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.unsaveBtn} onPress={onUnsave} activeOpacity={0.7}>
            <Text style={styles.unsaveBtnText}>🗑 {t('saved.remove')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

const MAX_CARDS = 50;

export default function SavedProvidersScreen() {
  const { headerPad, contentPad } = useInsets();
  const router    = useRouter();
  const { t, isRTL } = useLanguage();
  const { colors, isDark } = useTheme();
  const [saved, setSaved]       = useState<SavedProvider[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);

  const headerOp = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(
    Array.from({ length: MAX_CARDS }, () => new Animated.Value(0))
  ).current;

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('saved_providers')
        .select(`
          *,
          provider:providers(
            id, score, reputation_tier, badge_verified, lifetime_jobs,
            categories, username,
            user:users(full_name, city)
          )
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_CARDS);

      if (data) setSaved(data as SavedProvider[]);

      Animated.timing(headerOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      const n = Math.min(data?.length ?? 0, MAX_CARDS);
      cardAnims.slice(0, n).forEach(a => a.setValue(0));
      Animated.stagger(
        50,
        cardAnims.slice(0, n).map(a =>
          Animated.spring(a, { toValue: 1, tension: 90, friction: 10, useNativeDriver: true })
        )
      ).start();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unsave = async (item: SavedProvider) => {
    Alert.alert(
      t('saved.title'),
      `${t('saved.remove')} ${item.provider?.user?.full_name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('saved.remove'),
          style: 'destructive',
          onPress: async () => {
            await supabase.from('saved_providers').delete().eq('id', item.id);
            setSaved(prev => prev.filter(s => s.id !== item.id));
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  const gradColors: [string, string] = isDark
    ? [colors.bg, '#1A1407']
    : ['#FDF6E3', '#FFFBF8'];

  return (
    <LinearGradient colors={gradColors} style={{ flex: 1 }}>
      {/* Header */}
      <Animated.View style={[styles.topBar, { paddingTop: headerPad, opacity: headerOp }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <View style={styles.backCircle}>
            <Text style={styles.backArrow}>{isRTL ? '→' : '←'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.topTitle}>{t('saved.title')}</Text>
          <Text style={styles.topSub}>
            {saved.length > 0 ? `${saved.length} مقدم محفوظ` : ''}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </Animated.View>

      <FlatList
        data={saved}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: contentPad + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Text style={{ fontSize: 40 }}>🔖</Text>
            </View>
            <Text style={styles.emptyTitle}>{t('saved.noSaved')}</Text>
            <Text style={styles.emptySub}>{t('saved.noSavedDesc')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <SavedCard
            item={item}
            anim={cardAnims[Math.min(index, MAX_CARDS - 1)]}
            colors={colors}
            isDark={isDark}
            onView={() => router.push({ pathname: '/provider-profile', params: { provider_id: item.provider_id } })}
            onUnsave={() => unsave(item)}
          />
        )}
        ListFooterComponent={saved.length >= MAX_CARDS
          ? <Text style={styles.limitNote}>{t('saved.limitNote')}</Text>
          : null
        }
      />
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    center: {
      flex: 1, backgroundColor: colors.bg,
      alignItems: 'center', justifyContent: 'center',
    },

    // Header
    topBar: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom:  14,
    },
    backBtn:    { padding: 4 },
    backCircle: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.75)',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    backArrow:    { fontSize: 20, color: colors.textSecondary },
    headerCenter: { alignItems: 'center' },
    topTitle:     { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    topSub:       { fontSize: 11, color: ACCENT, fontWeight: '600', marginTop: 2 },

    listContent: { padding: 16 },

    // Provider card
    card: {
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)',
      borderRadius:    16,
      marginBottom:    12,
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.25)',
      flexDirection:   isRTL ? 'row-reverse' : 'row',
      alignItems:      'stretch',
      overflow:        'hidden',
      shadowColor:     ACCENT,
      shadowOffset:    { width: 0, height: 3 },
      shadowOpacity:   0.08,
      shadowRadius:    8,
      elevation:       2,
    },
    cardAccent: {
      width:         4,
      borderRadius:  0,
    },
    avatar: {
      width: 54, height: 54, borderRadius: 27,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      margin: 14,
    },
    avatarText: { fontSize: 22, fontWeight: '800' },
    cardInfo:   { flex: 1, paddingVertical: 12, paddingEnd: 14 },

    nameRow: {
      flexDirection:  isRTL ? 'row-reverse' : 'row',
      alignItems:     'center',
      gap:            6,
      marginBottom:   6,
    },
    providerName: {
      fontSize:   15, fontWeight: '800',
      color:      colors.textPrimary,
      flex:       1,
      textAlign:  ta,
    },
    verifiedBadge: {
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: '#38BDF8',
      alignItems: 'center', justifyContent: 'center',
    },
    verifiedText:  { fontSize: 10, color: '#fff', fontWeight: '800' },
    tierChip:      { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    tierChipText:  { fontSize: 10, fontWeight: '700' },

    metaRow:  { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    metaPill: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius:    8,
      paddingHorizontal: 8,
      paddingVertical:   4,
    },
    metaText: { fontSize: 11, color: colors.textMuted },

    unsaveBtn: {
      alignSelf:     'flex-start',
      borderRadius:  10,
      paddingVertical:   7,
      paddingHorizontal: 14,
      backgroundColor:  isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
      borderWidth:   1,
      borderColor:   'rgba(239,68,68,0.25)',
    },
    unsaveBtnText: { fontSize: 12, color: '#F87171', fontWeight: '600' },

    limitNote: {
      fontSize: 12, color: colors.textMuted,
      textAlign: 'center', paddingVertical: 16,
    },

    empty:        { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyIconWrap: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: isDark ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.08)',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 10, textAlign: ta },
    emptySub:   { fontSize: 14, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },
  });
}
