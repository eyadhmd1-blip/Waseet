// ============================================================
// WASEET — Client Home  (UI Redesign — logic unchanged)
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
import { flexRow, me }                  from '../../src/utils/rtl';
import { useTheme }                     from '../../src/context/ThemeContext';
import { AppHeader }                    from '../../src/components/AppHeader';
import type { AppColors }               from '../../src/constants/colors';

// ─── Layout constants ─────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const H_PAD    = 20;
const CARD_GAP = 10;
const CARD_W_3 = (W - H_PAD * 2 - CARD_GAP * 2) / 3;

// ─── Maps ─────────────────────────────────────────────────────
const ICON_MAP: Record<string, string> = {
  // صيانة المنازل
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚',
  moon: '🌙', 'pen-tool': '✏️', car: '🚗', battery: '🔋',
  gauge: '⛽', snowflake: '🧊', shield: '🛡️', droplet: '💧',
  // صيانة المنازل — جديد
  tile: '🔲', plaster: '🪣', iron: '⚒️', aluminium: '🪟', sofa: '🛋️',
  gypsum: '🏗️', bricks: '🧱', 'glass-pane': '🔳',
  // الخدمات الفنية
  wifi: '📶', cctv: '📹', 'solar-panel': '☀️', 'fire-alarm': '🔔',
  desktop: '🖥️', laptop: '💻',
  // الصحة والعناية
  massage: '💆', nurse: '🏥', haircut: '✂️',
  // المناسبات والفعاليات
  photo: '📸', cake: '🎂', party: '🎉',
  // تصميم وأعمال حرة
  'code-bracket': '⌨️', 'chart-up': '📈', document: '📝', calculator: '🧮',
  // الحِرَف اليدوية
  thread: '🧵', stitch: '🪡', shoe: '👟',
  // الحيوانات الأليفة
  paw: '🐾', 'dog-lead': '🦮', stethoscope: '🩺',
};

const GROUP_COLORS: Record<string, string> = {
  maintenance:   '#3B82F6', // أزرق
  cleaning:      '#10B981', // أخضر
  technical:     '#06B6D4', // سماوي
  health_beauty: '#EC4899', // وردي
  events:        '#F97316', // برتقالي
  education:     '#8B5CF6', // بنفسجي
  freelance:     '#F59E0B', // ذهبي
  handicrafts:   '#84CC16', // أخضر ليموني
  pets:          '#A78BFA', // بنفسجي فاتح
  car_services:  '#EF4444', // أحمر
};

// ─── Status helpers ───────────────────────────────────────────
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

// ─── UrgentCountdownInline (unchanged) ───────────────────────

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

// ─── ShortcutItem ─────────────────────────────────────────────

function ShortcutItem({ icon, label, sub, onPress }: {
  icon: string; label: string; sub: string; onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={{ flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={{
        width: 54, height: 54, borderRadius: 17,
        backgroundColor: colors.bg,
        borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <Text style={{
        fontSize: 12, fontWeight: '700',
        color: colors.textPrimary, textAlign: 'center',
      }}>{label}</Text>
      <Text style={{
        fontSize: 10, color: colors.textMuted,
        textAlign: 'center', lineHeight: 14,
      }}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ─── CategoryCard (3-col) ─────────────────────────────────────

function CategoryCard({ icon, name, color, onPress }: {
  icon: string; name: string; color: string; onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const pressAnim = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(pressAnim, { toValue: 0.94, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const onOut = () => Animated.spring(pressAnim, { toValue: 1.00, useNativeDriver: true, tension: 300, friction: 10 }).start();

  return (
    <TouchableOpacity
      onPress={onPress} onPressIn={onIn} onPressOut={onOut}
      activeOpacity={1}
      style={{ width: CARD_W_3 }}
    >
      <Animated.View style={{
        backgroundColor: isDark ? `${color}16` : `${color}0E`,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: isDark ? `${color}30` : `${color}1E`,
        padding: 10,
        alignItems: 'center',
        gap: 7,
        minHeight: 128,
        justifyContent: 'space-between',
        transform: [{ scale: pressAnim }],
      }}>
        <View style={{
          width: 50, height: 50, borderRadius: 15,
          backgroundColor: `${color}25`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 24 }}>{icon}</Text>
        </View>

        <Text style={{
          fontSize: 11, fontWeight: '700',
          color: colors.textPrimary,
          textAlign: 'center',
          lineHeight: 15,
          flex: 1,
        }} numberOfLines={2}>{name}</Text>

        <View style={{
          width: 28, height: 28, borderRadius: 9,
          backgroundColor: color,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 15, color: '#fff', fontWeight: '800', lineHeight: 20 }}>›</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────

const SHOW_CATS = 6;

export default function ClientHome() {
  const { colors, isDark } = useTheme();
  const styles  = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { contentPad } = useInsets();
  const router  = useRouter();
  const { t, ta, isRTL } = useLanguage();

  // ── State (unchanged) ────────────────────────────────────────
  const [user,        setUser]        = useState<User | null>(null);
  const [requests,    setRequests]    = useState<ServiceRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeGroup, setActiveGroup] = useState(CATEGORY_GROUPS[0].slug);

  // ── Animations ───────────────────────────────────────────────
  const contentOp  = useRef(new Animated.Value(0)).current;
  const contentY   = useRef(new Animated.Value(24)).current;
  const heroScale  = useRef(new Animated.Value(0.94)).current;

  const runEntrance = useCallback(() => {
    Animated.parallel([
      Animated.timing(contentOp, { toValue: 1, duration: 520, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentY,  { toValue: 0, duration: 520, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.spring(heroScale, { toValue: 1, tension: 100, friction: 8, delay: 320, useNativeDriver: true }).start();
  }, []);

  // ── Data loading (unchanged) ─────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser) { setLoading(false); return; }
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
      runEntrance();
    } finally {
      setLoading(false);
    }
  }, [runEntrance]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Navigation (unchanged) ───────────────────────────────────
  const goNew       = (slug?: string) => router.push(slug
    ? { pathname: '/(client)/new-request', params: { category: slug } }
    : '/(client)/new-request'
  );
  const goUrgent    = () => router.push('/urgent-request');

  // ── Derived data ─────────────────────────────────────────────
  const filteredCats = useMemo(() => {
    const group = CATEGORY_GROUPS.find(g => g.slug === activeGroup);
    if (!group) return [];
    return group.categories.slice(0, SHOW_CATS).map(c => ({
      slug:  c.slug,
      icon:  ICON_MAP[c.icon] ?? '🔧',
      name:  c.name_ar,
      color: GROUP_COLORS[group.slug] ?? '#3B82F6',
    }));
  }, [activeGroup]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={styles.container}>

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <AppHeader
        variant="root"
        userName={user?.full_name}
        userRole="client"
        userCity={user?.city}
        onNotifPress={() => router.push('/notification-settings')}
        onAvatarPress={() => router.push('/(client)/profile' as any)}
      />

      {/* ══ SCROLL ══════════════════════════════════════════════ */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: contentPad + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Animated.View style={{ opacity: contentOp, transform: [{ translateY: contentY }] }}>

          {/* ── Search ─────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.searchBar, { flexDirection: flexRow(isRTL) }]}
            onPress={() => goNew()}
            activeOpacity={0.8}
          >
            <View style={styles.searchIconWrap}>
              <Text style={{ fontSize: 14 }}>🔍</Text>
            </View>
            <Text style={[styles.searchHint, { textAlign: ta }]}>{t('home.searchPlaceholder')}</Text>
          </TouchableOpacity>

          {/* ── Group chips ─────────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={[styles.chipsContent, { flexDirection: flexRow(isRTL) }]}
          >
            {CATEGORY_GROUPS.map(g => {
              const active = activeGroup === g.slug;
              const col    = GROUP_COLORS[g.slug] ?? colors.accent;
              return (
                <TouchableOpacity
                  key={g.slug}
                  style={[styles.chip, active && { backgroundColor: col + '20', borderColor: col }]}
                  onPress={() => setActiveGroup(g.slug)}
                >
                  <Text style={[styles.chipText, active && { color: col, fontWeight: '700' }]}>
                    {t(`categories.${g.slug}`, g.name_ar)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Quick shortcuts ─────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { textAlign: ta }]}>
            {t('home.quickAccess')}
          </Text>
          <View style={[styles.shortcutsCard, { flexDirection: flexRow(isRTL) }]}>
            <ShortcutItem
              icon="❤️"
              label={t('home.saved')}
              sub={t('home.savedSub')}
              onPress={() => router.push('/(client)/saved-providers')}
            />
            <View style={styles.shortcutDivider} />
            <ShortcutItem
              icon="🕐"
              label={t('home.lastRequest')}
              sub={t('home.lastRequestSub')}
              onPress={() => requests[0]
                ? router.push({ pathname: '/request-detail', params: { id: requests[0].id } })
                : goNew()
              }
            />
            <View style={styles.shortcutDivider} />
            <ShortcutItem
              icon="⚡"
              label={t('home.urgentRequest')}
              sub={t('home.urgentSub')}
              onPress={goUrgent}
            />
          </View>

          {/* ── Popular services ────────────────────────────────── */}
          <View style={[styles.sectionRow, { flexDirection: flexRow(isRTL) }]}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>
              🔥 {t('home.popularServices')}
            </Text>
            <TouchableOpacity onPress={() => goNew()}>
              <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── 3-col category grid ─────────────────────────────── */}
          <View style={styles.categoryGrid}>
            {filteredCats.map(c => (
              <CategoryCard
                key={c.slug}
                icon={c.icon}
                name={c.name}
                color={c.color}
                onPress={() => goNew(c.slug)}
              />
            ))}
          </View>

          {/* ── Recent requests ─────────────────────────────────── */}
          {requests.length > 0 && (
            <>
              <View style={[styles.sectionRow, { flexDirection: flexRow(isRTL), marginTop: 4 }]}>
                <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('home.recentRequests')}</Text>
                <TouchableOpacity onPress={() => router.push('/(client)/requests')}>
                  <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
                </TouchableOpacity>
              </View>

              {requests.map(req => {
                const catIcon = ICON_MAP[(req as any).category?.icon ?? ''] ?? '🔧';
                const sBg     = STATUS_BG[req.status]    ?? STATUS_BG.open;
                const sTxt    = STATUS_TEXT[req.status]  ?? STATUS_TEXT.open;
                const sLbl    = STATUS_LABEL[req.status] ?? req.status;
                return (
                  <TouchableOpacity
                    key={req.id}
                    style={[styles.reqCard, { flexDirection: flexRow(isRTL) }]}
                    onPress={() => router.push({ pathname: '/request-detail', params: { id: req.id } })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.reqIcon, me(12, isRTL)]}>
                      <Text style={{ fontSize: 20 }}>{catIcon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqTitle, { textAlign: ta }]} numberOfLines={1}>{req.title}</Text>
                      <Text style={[styles.reqMeta, { textAlign: ta }]}>
                        {String(t(`categories.${req.category_slug}`, (req as any).category?.name_ar ?? req.category_slug))} · {String(t(`cities.${req.city}`, req.city))}
                      </Text>
                      {req.is_urgent && req.urgent_expires_at && req.status === 'open' && (
                        <UrgentCountdownInline expiresAt={req.urgent_expires_at} />
                      )}
                    </View>
                    <View style={[styles.badge, { backgroundColor: sBg }]}>
                      <Text style={[styles.badgeText, { color: sTxt }]}>{sLbl}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* ── Empty state ─────────────────────────────────────── */}
          {requests.length === 0 && (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Text style={{ fontSize: 36 }}>📭</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('home.noRequests')}</Text>
              <Text style={[styles.emptySub, { textAlign: 'center' }]}>{t('home.noRequestsSub')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => goNew()} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>{t('home.newRequest')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── CTA Banner ──────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.ctaBanner, { flexDirection: flexRow(isRTL) }]}
            onPress={() => goNew()}
            activeOpacity={0.88}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.ctaTitle, { textAlign: ta }]}>{t('home.ctaTitle')}</Text>
              <Text style={[styles.ctaSub, { textAlign: ta }]}>{t('home.ctaSub')}</Text>
            </View>
            <View style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>{t('home.ctaBtnLabel')}</Text>
            </View>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors, isDark: boolean) {
  const surf2   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const border2 = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    scroll:    { flex: 1 },
    content:   { paddingTop: 8 },


    // ── Search ──────────────────────────────────────────────────
    searchBar: {
      marginHorizontal: H_PAD, marginTop: 16, marginBottom: 14,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 12,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', gap: 10,
    },
    searchIconWrap: {
      width: 30, height: 30, borderRadius: 9,
      backgroundColor: surf2,
      alignItems: 'center', justifyContent: 'center',
    },
    searchHint: { fontSize: 14, color: colors.textMuted, flex: 1 },

    // ── Chips ───────────────────────────────────────────────────
    chipsScroll:  { marginBottom: 20 },
    chipsContent: { paddingHorizontal: H_PAD, gap: 8, paddingVertical: 2 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

    // ── Section labels ───────────────────────────────────────────
    sectionLabel: {
      fontSize: 14, fontWeight: '700', color: colors.textSecondary,
      paddingHorizontal: H_PAD, marginBottom: 12,
    },
    sectionRow: {
      paddingHorizontal: H_PAD, marginBottom: 14,
      justifyContent: 'space-between', alignItems: 'center',
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
    seeAll:       { fontSize: 13, color: colors.accent, fontWeight: '600' },

    // ── Shortcuts card ───────────────────────────────────────────
    shortcutsCard: {
      marginHorizontal: H_PAD, marginBottom: 28,
      backgroundColor: colors.surface,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
      paddingVertical: 20, paddingHorizontal: 12,
      alignItems: 'flex-start',
    },
    shortcutDivider: {
      width: 1, height: 48,
      backgroundColor: colors.border,
      alignSelf: 'center',
    },

    // ── Category grid ────────────────────────────────────────────
    categoryGrid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: H_PAD,
      gap: CARD_GAP, marginBottom: 28,
    },

    // ── Request cards ────────────────────────────────────────────
    reqCard: {
      marginHorizontal: H_PAD, marginBottom: 10,
      backgroundColor: colors.surface,
      borderRadius: 18, padding: 14,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center',
    },
    reqIcon: {
      width: 44, height: 44, borderRadius: 13,
      backgroundColor: surf2, borderWidth: 1, borderColor: border2,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    reqTitle:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
    reqMeta:   { fontSize: 12, color: colors.textMuted },
    badge:     { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0, marginStart: 8 },
    badgeText: { fontSize: 11, fontWeight: '700' },

    // ── Empty state ──────────────────────────────────────────────
    emptyBox: {
      alignItems: 'center', paddingTop: 24,
      paddingHorizontal: H_PAD, marginBottom: 24,
    },
    emptyIconWrap: {
      width: 72, height: 72, borderRadius: 22,
      backgroundColor: surf2, borderWidth: 1, borderColor: border2,
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    emptySub:   { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 18 },
    emptyBtn: {
      backgroundColor: colors.accent, borderRadius: 14,
      paddingHorizontal: 28, paddingVertical: 12,
    },
    emptyBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg },

    // ── CTA Banner ───────────────────────────────────────────────
    ctaBanner: {
      marginHorizontal: H_PAD, marginTop: 8,
      backgroundColor: colors.accentDim,
      borderRadius: 20, padding: 18,
      alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: 'rgba(201,168,76,0.28)',
      gap: 12,
    },
    ctaTitle:   { fontSize: 14, fontWeight: '800', color: colors.accent, marginBottom: 4 },
    ctaSub:     { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    ctaBtn: {
      backgroundColor: colors.accent, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 10, flexShrink: 0,
    },
    ctaBtnText: { fontSize: 13, fontWeight: '700', color: colors.bg },
  });
}
