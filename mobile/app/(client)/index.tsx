// ============================================================
// WASEET — Client Home  (Premium Glassmorphism Redesign)
// ============================================================

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, Easing, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase }                     from '../../src/lib/supabase';
import { CATEGORY_GROUPS }              from '../../src/constants/categories';
import { useLanguage }                  from '../../src/hooks/useLanguage';
import type { User, ServiceRequest }    from '../../src/types';
import { useInsets }                    from '../../src/hooks/useInsets';
import { HEADER_PAD }                   from '../../src/utils/layout';
import { flexRow, me }                  from '../../src/utils/rtl';
import { useTheme }                     from '../../src/context/ThemeContext';
import type { AppColors }               from '../../src/constants/colors';

// ─── Layout constants ─────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const H_PAD      = 24;
const CARD_GAP   = 12;
const CARD_W     = (W - H_PAD * 2 - CARD_GAP) / 2;

// ─── Icon & color maps ────────────────────────────────────────
const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚',
  moon: '🌙', 'pen-tool': '✏️', car: '🚗', battery: '🔋',
  gauge: '⛽', snowflake: '🧊', shield: '🛡️', droplet: '💧',
};
const GROUP_COLORS: Record<string, string> = {
  maintenance:  '#3B82F6',
  cleaning:     '#10B981',
  education:    '#8B5CF6',
  freelance:    '#F59E0B',
  car_services: '#EF4444',
};

// Time-aware greeting
const greeting = () => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 19) return 'مساء الخير';
  return 'مساء الخير';
};

// Status helpers
const STATUS_BG: Record<string, string> = {
  open:        'rgba(59,130,246,0.15)',
  in_progress: 'rgba(245,158,11,0.15)',
  completed:   'rgba(16,185,129,0.15)',
  cancelled:   'rgba(239,68,68,0.15)',
};
const STATUS_TEXT: Record<string, string> = {
  open:        '#60A5FA',
  in_progress: '#FCD34D',
  completed:   '#34D399',
  cancelled:   '#F87171',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'مفتوح', in_progress: 'جاري', completed: 'مكتمل', cancelled: 'ملغي',
};

// ─── Category Card ────────────────────────────────────────────

function CategoryCard({
  icon, name, color, onPress,
}: { icon: string; name: string; color: string; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const pressAnim = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(pressAnim, { toValue: 1.00, useNativeDriver: true, tension: 300, friction: 10 }).start();

  return (
    <TouchableOpacity
      onPress={onPress} onPressIn={onIn} onPressOut={onOut}
      activeOpacity={1}
    >
      <Animated.View style={[{
        width: CARD_W,
        aspectRatio: 1,
        backgroundColor: isDark ? `${color}16` : `${color}10`,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: isDark ? `${color}28` : `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        transform: [{ scale: pressAnim }],
      }]}>
        {/* Icon bubble */}
        <View style={{
          width: 54, height: 54, borderRadius: 18,
          backgroundColor: `${color}22`,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 10,
        }}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
        </View>
        <Text style={{
          fontSize: 12, fontWeight: '700',
          color: colors.textPrimary,
          textAlign: 'center', lineHeight: 17,
        }} numberOfLines={2}>{name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Urgent countdown inline ──────────────────────────────────

function UrgentCountdownInline({ expiresAt }: { expiresAt: string }) {
  const [rem, setRem] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );
  useEffect(() => {
    const iv = setInterval(() =>
      setRem(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  if (rem === 0) return <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>انتهى الوقت</Text>;
  const m = Math.floor(rem / 60000);
  const s = Math.floor((rem % 60000) / 1000);
  return (
    <Text style={{ fontSize: 11, color: '#FCA5A5', marginTop: 3, fontWeight: '600' }}>
      ⏱ {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')} متبقي
    </Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────

const SHOW_CATS = 6;

export default function ClientHome() {
  const { colors, isDark } = useTheme();
  const styles  = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { contentPad } = useInsets();
  const router  = useRouter();
  const { t, ta, isRTL } = useLanguage();

  const [user,       setUser]       = useState<User | null>(null);
  const [requests,   setRequests]   = useState<ServiceRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Entrance animations
  const headerOp   = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;
  const contentOp  = useRef(new Animated.Value(0)).current;
  const contentY   = useRef(new Animated.Value(24)).current;
  const heroScale  = useRef(new Animated.Value(0.94)).current;
  const notifPulse = useRef(new Animated.Value(1)).current;

  const runEntrance = useCallback(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 480, delay: 60,  easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 480, delay: 60,  easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(contentOp, { toValue: 1, duration: 520, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentY,  { toValue: 0, duration: 520, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.spring(heroScale, { toValue: 1, tension: 100, friction: 8, delay: 320, useNativeDriver: true }).start();

    // Bell pulse every ~12 s
    Animated.loop(Animated.sequence([
      Animated.delay(6000),
      Animated.timing(notifPulse, { toValue: 1.20, duration: 130, useNativeDriver: true }),
      Animated.timing(notifPulse, { toValue: 0.88, duration: 90,  useNativeDriver: true }),
      Animated.timing(notifPulse, { toValue: 1.08, duration: 90,  useNativeDriver: true }),
      Animated.timing(notifPulse, { toValue: 1.00, duration: 70,  useNativeDriver: true }),
      Animated.delay(6000),
    ])).start();
  }, []);

  const load = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const [{ data: profile }, { data: recent }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('requests')
        .select('*, category:service_categories(name_ar, icon)')
        .eq('client_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .returns<(ServiceRequest & { category?: { name_ar: string; icon: string } })[]>(),
    ]);
    if (profile) setUser(profile);
    if (recent)  setRequests(recent);
    setLoading(false);
    runEntrance();
  }, [runEntrance]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const goNew       = (slug?: string) => router.push(slug
    ? { pathname: '/(client)/new-request', params: { category: slug } }
    : '/(client)/new-request'
  );
  const goUrgent    = () => router.push('/urgent-request');
  const goRecurring = () => router.push('/recurring-request');

  // Build flat category list (up to SHOW_CATS)
  const cats = useMemo(() => {
    const out: { slug: string; icon: string; name: string; color: string }[] = [];
    for (const g of CATEGORY_GROUPS) {
      for (const c of g.categories) {
        if (out.length >= SHOW_CATS) break;
        out.push({ slug: c.slug, icon: ICON_MAP[c.icon] ?? '🔧', name: c.name_ar, color: GROUP_COLORS[g.slug] ?? '#3B82F6' });
      }
      if (out.length >= SHOW_CATS) break;
    }
    return out;
  }, []);

  const firstName = user?.full_name?.split(' ')[0] ?? '';
  const cityLabel = t(`cities.${user?.city}`, user?.city ?? '');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={styles.container}>

      {/* ══════════════════════════════════════════════════════
          FIXED HEADER
      ══════════════════════════════════════════════════════ */}
      <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
        <View style={[{ flexDirection: flexRow(isRTL), alignItems: 'center', justifyContent: 'space-between' }]}>

          {/* Avatar + greeting */}
          <View style={[{ flexDirection: flexRow(isRTL), alignItems: 'center', gap: 12, flex: 1 }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{firstName?.[0] ?? '؟'}</Text>
            </View>
            <View>
              <Text style={[styles.greeting, { textAlign: ta }]}>
                {greeting()}، {firstName} 👋
              </Text>
              <View style={[{ flexDirection: flexRow(isRTL), alignItems: 'center', gap: 3, marginTop: 2 }]}>
                <Text style={{ fontSize: 11 }}>📍</Text>
                <Text style={styles.city}>{cityLabel}</Text>
              </View>
            </View>
          </View>

          {/* Bell */}
          <Animated.View style={{ transform: [{ scale: notifPulse }] }}>
            <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notification-settings')} activeOpacity={0.75}>
              <Text style={{ fontSize: 19 }}>🔔</Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════
          SCROLLABLE CONTENT
      ══════════════════════════════════════════════════════ */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: contentPad + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>

          {/* ── Search ─────────────────────────────────────── */}
          <TouchableOpacity style={[styles.searchBar, { flexDirection: flexRow(isRTL) }]} onPress={() => goNew()} activeOpacity={0.8}>
            <Text style={[styles.searchHint, { textAlign: ta, flex: 1 }]}>{t('home.searchPlaceholder')}</Text>
            <View style={styles.searchIcon}>
              <Text style={{ fontSize: 15 }}>🔍</Text>
            </View>
          </TouchableOpacity>

          {/* ─────────────────────────────────────────────────
              HERO CARD — "طلب جديد"
          ───────────────────────────────────────────────── */}
          <Animated.View style={{ transform: [{ scale: heroScale }], marginHorizontal: H_PAD, marginBottom: CARD_GAP }}>
            <TouchableOpacity style={styles.heroCard} onPress={() => goNew()} activeOpacity={0.9}>

              {/* Decorative glow blobs */}
              <View style={styles.heroBlob1} />
              <View style={styles.heroBlob2} />

              {/* Text block */}
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{t('home.newRequest')}</Text>
                <Text style={styles.heroSub}>{t('home.heroSub')}</Text>
              </View>

              {/* Plus button */}
              <View style={styles.heroPlusRing}>
                <Text style={styles.heroPlus}>+</Text>
              </View>

            </TouchableOpacity>
          </Animated.View>

          {/* ─────────────────────────────────────────────────
              SECONDARY ROW  طلب طارئ | طلب دوري
          ───────────────────────────────────────────────── */}
          <View style={[styles.secondaryRow, { flexDirection: flexRow(isRTL) }]}>

            {/* طلب طارئ */}
            <TouchableOpacity style={styles.urgentCard} onPress={goUrgent} activeOpacity={0.85}>
              <View style={styles.urgentGlow} />
              <Text style={{ fontSize: 24, marginBottom: 8 }}>🚨</Text>
              <Text style={styles.urgentTitle}>{t('home.urgentRequest')}</Text>
              <Text style={styles.urgentSub}>{t('home.urgentSub')}</Text>
            </TouchableOpacity>

            {/* طلب دوري */}
            <TouchableOpacity style={styles.recurCard} onPress={goRecurring} activeOpacity={0.85}>
              <View style={styles.recurGlow} />
              <Text style={{ fontSize: 24, marginBottom: 8 }}>🔄</Text>
              <Text style={styles.recurTitle}>{t('home.recurringShort')}</Text>
              <Text style={styles.recurSub}>{t('home.recurringFixed')}</Text>
            </TouchableOpacity>

          </View>

          {/* ─────────────────────────────────────────────────
              SERVICE CATEGORIES — 2-column grid
          ───────────────────────────────────────────────── */}
          <View style={[styles.sectionRow, { flexDirection: flexRow(isRTL) }]}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('home.allServices')}</Text>
            <TouchableOpacity onPress={() => goNew()}>
              <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.categoryGrid}>
            {cats.map(c => (
              <CategoryCard key={c.slug} icon={c.icon} name={c.name} color={c.color} onPress={() => goNew(c.slug)} />
            ))}
          </View>

          {/* ─────────────────────────────────────────────────
              RECENT REQUESTS
          ───────────────────────────────────────────────── */}
          {requests.length > 0 && (
            <>
              <View style={[styles.sectionRow, { flexDirection: flexRow(isRTL), marginTop: 4 }]}>
                <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('home.recentRequests')}</Text>
                <TouchableOpacity onPress={() => router.push('/(client)/requests')}>
                  <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                </TouchableOpacity>
              </View>

              {requests.map(req => {
                const catIcon    = ICON_MAP[(req as any).category?.icon ?? ''] ?? '🔧';
                const sBg        = STATUS_BG[req.status]    ?? STATUS_BG.open;
                const sTxt       = STATUS_TEXT[req.status]  ?? STATUS_TEXT.open;
                const sLbl       = STATUS_LABEL[req.status] ?? req.status;
                return (
                  <TouchableOpacity
                    key={req.id}
                    style={[styles.reqCard, { flexDirection: flexRow(isRTL) }]}
                    onPress={() => router.push({ pathname: '/request-detail', params: { id: req.id } })}
                    activeOpacity={0.8}
                  >
                    {/* Icon bubble */}
                    <View style={[styles.reqIcon, me(12, isRTL)]}>
                      <Text style={{ fontSize: 22 }}>{catIcon}</Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqTitle, { textAlign: ta }]} numberOfLines={1}>{req.title}</Text>
                      <Text style={[styles.reqMeta, { textAlign: ta }]}>
                        {String(t(`categories.${req.category_slug}`, (req as any).category?.name_ar ?? req.category_slug))} · {String(t(`cities.${req.city}`, req.city))}
                      </Text>
                      {req.is_urgent && req.urgent_expires_at && req.status === 'open' && (
                        <UrgentCountdownInline expiresAt={req.urgent_expires_at} />
                      )}
                    </View>

                    {/* Status badge */}
                    <View style={[styles.badge, { backgroundColor: sBg }]}>
                      <Text style={[styles.badgeText, { color: sTxt }]}>{sLbl}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {requests.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Text style={{ fontSize: 38 }}>📭</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('home.noRequests')}</Text>
              <Text style={styles.emptySub}>{t('home.noRequestsSub')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => goNew()} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>{t('home.newRequest')}</Text>
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors, isDark: boolean) {
  const glass   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const glassB  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const shadow  = isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 }
    : { shadowColor: '#1D4ED8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 8 };

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    scroll:    { flex: 1 },
    content:   { paddingTop: 6 },

    // ── Header ──────────────────────────────────────────────────────
    header: {
      paddingHorizontal: H_PAD,
      paddingTop:        HEADER_PAD,
      paddingBottom:     18,
      backgroundColor:   colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800', color: colors.bg },
    greeting:   { fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.2 },
    city:       { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    bellBtn: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: glass,
      borderWidth: 1, borderColor: glassB,
      alignItems: 'center', justifyContent: 'center',
    },

    // ── Search ──────────────────────────────────────────────────────
    searchBar: {
      marginHorizontal: H_PAD, marginTop: 18, marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingHorizontal: 16, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center',
    },
    searchHint: { fontSize: 14, color: colors.textMuted },
    searchIcon: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: glass,
      alignItems: 'center', justifyContent: 'center',
    },

    // ── Hero card ───────────────────────────────────────────────────
    heroCard: {
      backgroundColor: '#1D4ED8',
      borderRadius: 26,
      padding: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      minHeight: 118,
      ...shadow,
    },
    heroBlob1: {
      position: 'absolute', width: 180, height: 180, borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40,
    },
    heroBlob2: {
      position: 'absolute', width: 80, height: 80, borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 20,
    },
    heroTitle:   { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 5, letterSpacing: -0.5 },
    heroSub:     { fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: '500' },
    heroPlusRing: {
      width: 54, height: 54, borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroPlus: { fontSize: 34, fontWeight: '200', color: '#fff', lineHeight: 40 },

    // ── Secondary row ───────────────────────────────────────────────
    secondaryRow: {
      marginHorizontal: H_PAD,
      marginBottom: 28,
      gap: CARD_GAP,
    },
    urgentCard: {
      flex: 1, borderRadius: 22,
      backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.07)',
      borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.30)',
      padding: 18, alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', minHeight: 118,
    },
    urgentGlow: {
      position: 'absolute', width: 90, height: 90, borderRadius: 45,
      backgroundColor: 'rgba(239,68,68,0.12)', top: -28, right: -22,
    },
    urgentTitle: { fontSize: 14, fontWeight: '800', color: '#EF4444', marginBottom: 2 },
    urgentSub:   { fontSize: 11, color: 'rgba(239,68,68,0.55)' },

    recurCard: {
      flex: 1, borderRadius: 22,
      backgroundColor: isDark ? 'rgba(16,185,129,0.09)' : 'rgba(16,185,129,0.06)',
      borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.28)',
      padding: 18, alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', minHeight: 118,
    },
    recurGlow: {
      position: 'absolute', width: 90, height: 90, borderRadius: 45,
      backgroundColor: 'rgba(16,185,129,0.12)', top: -28, left: -22,
    },
    recurTitle: { fontSize: 14, fontWeight: '800', color: '#10B981', marginBottom: 2 },
    recurSub:   { fontSize: 11, color: 'rgba(16,185,129,0.55)' },

    // ── Section headers ─────────────────────────────────────────────
    sectionRow: {
      paddingHorizontal: H_PAD,
      marginBottom: 14,
      justifyContent: 'space-between', alignItems: 'center',
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    seeAll:       { fontSize: 13, color: colors.accent, fontWeight: '600' },

    // ── Category grid ───────────────────────────────────────────────
    categoryGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: H_PAD,
      gap: CARD_GAP,
      marginBottom: 28,
    },

    // ── Request cards ───────────────────────────────────────────────
    reqCard: {
      marginHorizontal: H_PAD, marginBottom: 10,
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center',
    },
    reqIcon: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: glass,
      borderWidth: 1, borderColor: glassB,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    reqTitle:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
    reqMeta:   { fontSize: 12, color: colors.textMuted },
    badge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0, marginStart: 8 },
    badgeText: { fontSize: 12, fontWeight: '700' },

    // ── Empty state ─────────────────────────────────────────────────
    emptyBox: {
      alignItems: 'center', paddingTop: 32, paddingHorizontal: H_PAD,
    },
    emptyIcon: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: glass,
      borderWidth: 1, borderColor: glassB,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    emptySub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
    emptyBtn: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingHorizontal: 28, paddingVertical: 12,
    },
    emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg },
  });
}
