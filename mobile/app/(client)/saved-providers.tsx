import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { TIER_META } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { SavedProvider } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

// ─── Saved Card ───────────────────────────────────────────────

function SavedCard({
  item, anim, onView, onUnsave, onRequest, colors,
}: {
  item: SavedProvider; anim: Animated.Value;
  onView: () => void; onUnsave: () => void; onRequest: () => void;
  colors: AppColors;
}) {
  const { t, ta } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const prov = item.provider;
  if (!prov) return null;

  const tier = TIER_META[prov.reputation_tier];
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <TouchableOpacity style={styles.card} onPress={onView} activeOpacity={0.85}>
        <View style={[styles.avatar, { backgroundColor: tier.color + '33' }]}>
          <Text style={[styles.avatarText, { color: tier.color }]}>
            {prov.user?.full_name?.charAt(0) ?? '?'}
          </Text>
        </View>

        <View style={styles.cardInfo}>
          <View style={[styles.nameRow, {}]}>
            <Text style={styles.providerName}>{prov.user?.full_name}</Text>
            {prov.badge_verified && <Text style={styles.verified}>✓</Text>}
            <View style={[styles.tierChip, { backgroundColor: tier.color + '22' }]}>
              <Text style={[styles.tierChipText, { color: tier.color }]}>{tier.label_ar}</Text>
            </View>
          </View>

          <View style={[styles.metaRow, {}]}>
            {prov.score > 0 && <Text style={styles.meta}>⭐ {prov.score.toFixed(1)}</Text>}
            <Text style={styles.meta}>🔨 {prov.lifetime_jobs} {t('providerProfile.jobsDone')}</Text>
            <Text style={styles.meta}>📍 {t(`cities.${prov.user?.city}`, prov.user?.city ?? '')}</Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.unsaveBtn} onPress={onUnsave}>
              <Text style={styles.unsaveBtnText}>{t('saved.remove')} 🗑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.requestBtn} onPress={onRequest}>
              <Text style={styles.requestBtnText}>{t('newRequest.title')} {ta === 'right' ? '←' : '→'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

const MAX_CARDS = 50;

export default function SavedProvidersScreen() {
  const { headerPad } = useInsets();
  const router    = useRouter();
  const { t, ta } = useLanguage();
  const { colors } = useTheme();
  const [saved, setSaved]       = useState<SavedProvider[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const headerOp = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(
    Array.from({ length: MAX_CARDS }, () => new Animated.Value(0))
  ).current;

  const load = useCallback(async () => {
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
    setLoading(false);

    Animated.timing(headerOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const n = Math.min(data?.length ?? 0, MAX_CARDS);
    cardAnims.slice(0, n).forEach(a => a.setValue(0));
    Animated.stagger(
      50,
      cardAnims.slice(0, n).map(a =>
        Animated.spring(a, { toValue: 1, tension: 90, friction: 10, useNativeDriver: true })
      )
    ).start();
  }, []);

  useEffect(() => { load(); }, [load]);

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
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.topBar, { opacity: headerOp }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { textAlign: ta }]}>{t('saved.title')}</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      <FlatList
        data={saved}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔖</Text>
            <Text style={[styles.emptyTitle, { textAlign: ta }]}>{t('saved.noSaved')}</Text>
            <Text style={[styles.emptySub, { textAlign: ta }]}>{t('saved.noSavedDesc')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <SavedCard
            item={item}
            anim={cardAnims[Math.min(index, MAX_CARDS - 1)]}
            colors={colors}
            onView={() => router.push({ pathname: '/provider-profile', params: { provider_id: item.provider_id } })}
            onUnsave={() => unsave(item)}
            onRequest={() => router.push({
              pathname: '/(client)/new-request',
              params: { provider_hint: item.provider_id },
            })}
          />
        )}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.bg },
    center:      { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

    topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText:  { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
    topTitle:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

    listContent: { padding: 16, paddingBottom: 40 },

    card: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 14,
      marginBottom: 12, borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    },

    avatar:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText: { fontSize: 22, fontWeight: '800' },

    cardInfo: { flex: 1 },

    nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    providerName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    verified:     { fontSize: 12, color: '#7DD3FC', fontWeight: '700' },
    tierChip:     { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    tierChipText: { fontSize: 10, fontWeight: '700' },

    metaRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    meta:    { fontSize: 12, color: colors.textMuted },

    cardActions:   { flexDirection: 'row', gap: 8 },
    unsaveBtn:     { flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    unsaveBtnText: { fontSize: 12, color: '#F87171' },
    requestBtn:    { flex: 2, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
    requestBtnText:{ fontSize: 12, fontWeight: '700', color: colors.bg },

    empty:     { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
    emptyIcon: { fontSize: 52, marginBottom: 14 },
    emptyTitle:{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
    emptySub:  { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  });
}
