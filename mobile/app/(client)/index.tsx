// ============================================================
// WASEET — Client Home Screen
// Categories: Smart Tab Browser (group tabs + 3-col grid)
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { COLORS } from '../../src/constants/theme';
import { CATEGORY_GROUPS } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { User, ServiceRequest } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD, SCREEN_WIDTH, rs } from '../../src/utils/layout';

// ─── Constants ────────────────────────────────────────────────

const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚',
  moon: '🌙', 'pen-tool': '✏️',
  car: '🚗', battery: '🔋', gauge: '⛽', snowflake: '🧊', shield: '🛡️', droplet: '💧',
};

const GROUP_COLORS: Record<string, string> = {
  maintenance:  '#3B82F6',
  cleaning:     '#10B981',
  education:    '#8B5CF6',
  freelance:    '#F59E0B',
  car_services: '#EF4444',
};

const GROUP_ICONS: Record<string, string> = {
  maintenance:  '🏠',
  cleaning:     '✨',
  education:    '📚',
  freelance:    '🎨',
  car_services: '🚗',
};

// 6 most-requested services for the quick-access row
const POPULAR_SLUGS = ['electrical', 'plumbing', 'cleaning', 'ac_repair', 'car_repair', 'tutoring', 'moving'] as const;

// ─── Quick Access Row ─────────────────────────────────────────

function QuickAccessRow({ onPress }: { onPress: (slug: string) => void }) {
  const { t } = useLanguage();
  const allCats = CATEGORY_GROUPS.flatMap(g => g.categories);
  const popular = POPULAR_SLUGS.map(slug => {
    const cat = allCats.find(c => c.slug === slug);
    return { slug, icon: cat ? ICON_MAP[cat.icon] ?? '🔧' : '🔧' };
  });

  return (
    <View style={qStyles.section}>
      <Text style={qStyles.label}>{t('home.mostRequested')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={qStyles.scroll}
      >
        {popular.map(p => (
          <TouchableOpacity
            key={p.slug}
            style={qStyles.pill}
            onPress={() => onPress(p.slug)}
            activeOpacity={0.72}
          >
            <Text style={qStyles.pillIcon}>{p.icon}</Text>
            <Text style={qStyles.pillName}>{t(`categories.${p.slug}`, p.slug)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const qStyles = StyleSheet.create({
  section: { marginBottom: 20 },
  label:   { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, textAlign: 'right', paddingHorizontal: 20, marginBottom: 10 },
  scroll:  { paddingHorizontal: 20, gap: 8 },
  pill:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.border,
  },
  pillIcon: { fontSize: 15 },
  pillName: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
});

// ─── Group Tab Bar ────────────────────────────────────────────

function GroupTabBar({
  activeGroup,
  onSelect,
}: {
  activeGroup: string;
  onSelect: (slug: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tabStyles.content}
      style={tabStyles.scroll}
    >
      {CATEGORY_GROUPS.map(g => {
        const color    = GROUP_COLORS[g.slug] ?? COLORS.accent;
        const isActive = activeGroup === g.slug;
        return (
          <TouchableOpacity
            key={g.slug}
            style={[
              tabStyles.tab,
              isActive && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => onSelect(g.slug)}
            activeOpacity={0.78}
          >
            <Text style={tabStyles.tabIcon}>{GROUP_ICONS[g.slug] ?? '🔧'}</Text>
            <Text style={[tabStyles.tabText, isActive && tabStyles.tabTextActive]}>
              {t(`categories.${g.slug}`, g.name_ar)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  scroll:  { flexGrow: 0, marginBottom: 16 },
  content: { paddingHorizontal: 20, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.surface, borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  tabIcon:       { fontSize: 14 },
  tabText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
});

// ─── Category Card (3-per-row) ────────────────────────────────

function CategoryCard({
  anim,
  icon,
  name,
  color,
  onPress,
}: {
  anim: Animated.Value;
  icon: string;
  name: string;
  color: string;
  onPress: () => void;
}) {
  const scale      = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.75, 1.05, 1] });
  const opacity    = anim;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  return (
    <Animated.View style={[ccStyles.wrap, { opacity, transform: [{ scale }, { translateY }] }]}>
      <TouchableOpacity
        style={[ccStyles.card, { backgroundColor: color + '15', borderColor: color + '40' }]}
        onPress={onPress}
        activeOpacity={0.72}
      >
        {/* Icon bubble */}
        <View style={[ccStyles.iconBubble, { backgroundColor: color + '25' }]}>
          <Text style={ccStyles.icon}>{icon}</Text>
        </View>
        <Text style={ccStyles.name} numberOfLines={2}>{name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const ccStyles = StyleSheet.create({
  wrap:       { width: '31%' },
  card: {
    borderRadius: 16, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1.5, minHeight: 100, justifyContent: 'center',
  },
  iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  icon:       { fontSize: 24 },
  name:       { fontSize: 12, color: COLORS.textPrimary, textAlign: 'center', fontWeight: '600', lineHeight: 16 },
});

// ─── Tab Category Browser ─────────────────────────────────────

function TabCategoryBrowser({
  activeGroup,
  anims,
  onGroupChange,
  onCategoryPress,
}: {
  activeGroup: string;
  anims: Animated.Value[][];
  onGroupChange: (slug: string) => void;
  onCategoryPress: (slug: string) => void;
}) {
  const { t } = useLanguage();
  const groupIndex = CATEGORY_GROUPS.findIndex(g => g.slug === activeGroup);
  const group      = CATEGORY_GROUPS[groupIndex];
  const color      = GROUP_COLORS[activeGroup] ?? COLORS.accent;
  const activeAnims = anims[groupIndex] ?? [];

  return (
    <View style={tbStyles.container}>
      {/* Header row */}
      <View style={tbStyles.headerRow}>
        <Text style={[tbStyles.groupCount, { color }]}>
          {t('home.serviceCount', { count: group?.categories.length })}
        </Text>
        <Text style={tbStyles.sectionTitle}>{t('home.allCategories')}</Text>
      </View>

      {/* Group tab selector */}
      <GroupTabBar activeGroup={activeGroup} onSelect={onGroupChange} />

      {/* Active group label */}
      <View style={[tbStyles.activeLabel, { backgroundColor: color + '15', borderColor: color + '30' }]}>
        <Text style={[tbStyles.activeLabelText, { color }]}>
          {GROUP_ICONS[activeGroup]} {t(`categories.${activeGroup}`, group?.name_ar)}
        </Text>
      </View>

      {/* 3-column grid */}
      <View style={tbStyles.grid}>
        {group?.categories.map((cat, i) => (
          <CategoryCard
            key={cat.slug}
            anim={activeAnims[i] ?? new Animated.Value(1)}
            icon={ICON_MAP[cat.icon] ?? '🔧'}
            name={t(`categories.${cat.slug}`, cat.name_ar)}
            color={color}
            onPress={() => onCategoryPress(cat.slug)}
          />
        ))}
      </View>
    </View>
  );
}

const tbStyles = StyleSheet.create({
  container:     { marginBottom: 24, paddingHorizontal: 20 },
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  groupCount:    { fontSize: 13, fontWeight: '600' },
  activeLabel:   { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-end', marginBottom: 12, borderWidth: 1 },
  activeLabelText: { fontSize: 13, fontWeight: '700' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

// ─── Urgent Countdown (inline on request cards) ──────────────

function UrgentCountdownInline({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );

  useEffect(() => {
    if (remaining === 0) return;
    const iv = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  const { t } = useLanguage();
  if (remaining === 0) {
    return <Text style={styles.urgentExpired}>{t('home.urgentExpired')}</Text>;
  }
  return (
    <Text style={styles.urgentCountdown}>
      {t('home.urgentRemaining')} {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </Text>
  );
}

// ─── Urgent Banner ───────────────────────────────────────────

function UrgentBanner({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  const pulse = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.03, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 1,    duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.00, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow,  { toValue: 0,    duration: 500, useNativeDriver: true }),
        ]),
        Animated.delay(1200),
      ])
    ).start();
  }, []);

  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: ['#7F1D1D', '#EF4444'] });

  return (
    <Animated.View style={[styles.urgentWrap, { transform: [{ scale: pulse }] }]}>
      <Animated.View style={[styles.urgentBanner, { borderColor }]}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.urgentInner}>
          <View>
            <Text style={styles.urgentTitle}>{t('home.urgentQ')}</Text>
            <Text style={styles.urgentSub}>{t('home.urgentGuarantee')}</Text>
          </View>
          <View style={styles.urgentCta}>
            <Text style={styles.urgentCtaText}>{t('home.urgentNow')}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── CTA Banner ──────────────────────────────────────────────

function CtaBanner({ onPress }: { onPress: () => void }) {
  const { t } = useLanguage();
  const shimmerX = useRef(new Animated.Value(-120)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(shimmerX, { toValue: 420, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: -120, duration: 0, useNativeDriver: true }),
      ])
    );
    const timer = setTimeout(() => loop.start(), 1200);
    return () => { clearTimeout(timer); loop.stop(); };
  }, []);

  return (
    <TouchableOpacity style={styles.ctaBanner} onPress={onPress} activeOpacity={0.85}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.shimmer, { transform: [{ translateX: shimmerX }] }]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ctaTitle}>{t('home.postNow')}</Text>
        <Text style={styles.ctaSub}>{t('home.getOffers')}</Text>
      </View>
      <Text style={{ fontSize: 30 }}>✨</Text>
    </TouchableOpacity>
  );
}

// ─── Recurring Banner ─────────────────────────────────────────

function RecurringBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recurringBanner} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1 }}>
        <Text style={styles.recurringTitle}>🔄 خدمة دورية؟</Text>
        <Text style={styles.recurringSub}>عقود أسبوعية أو شهرية · وفّر مع المزود الثابت</Text>
      </View>
      <View style={styles.recurringCta}>
        <Text style={styles.recurringCtaText}>ابدأ</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────

const MAX_PER_GROUP = 10;
const TOTAL_GROUPS  = CATEGORY_GROUPS.length;

export default function ClientHome() {
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const { t, ta } = useLanguage();
  const [user, setUser]             = useState<User | null>(null);
  const [requests, setRequests]     = useState<ServiceRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGroup, setActiveGroup] = useState(CATEGORY_GROUPS[0].slug);

  // Entrance anims
  const headerOp   = useRef(new Animated.Value(0)).current;
  const headerX    = useRef(new Animated.Value(-24)).current;
  const searchOp   = useRef(new Animated.Value(0)).current;
  const searchY    = useRef(new Animated.Value(12)).current;
  const bannerOp   = useRef(new Animated.Value(0)).current;
  const bannerY    = useRef(new Animated.Value(16)).current;
  const notifPulse = useRef(new Animated.Value(1)).current;
  const catSectionOp = useRef(new Animated.Value(0)).current;

  // Per-group anim pool [groupIndex][cardIndex]
  const groupAnims = useRef(
    Array.from({ length: TOTAL_GROUPS }, () =>
      Array.from({ length: MAX_PER_GROUP }, () => new Animated.Value(0))
    )
  ).current;

  const animateGroup = useCallback((groupSlug: string) => {
    const gi = CATEGORY_GROUPS.findIndex(g => g.slug === groupSlug);
    if (gi === -1) return;
    const anims = groupAnims[gi];
    anims.forEach(a => a.setValue(0));
    Animated.stagger(
      45,
      anims.slice(0, CATEGORY_GROUPS[gi].categories.length).map(a =>
        Animated.spring(a, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true })
      )
    ).start();
  }, [groupAnims]);

  const handleGroupChange = useCallback((slug: string) => {
    setActiveGroup(slug);
    animateGroup(slug);
  }, [animateGroup]);

  const runEntrance = useCallback(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 550, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(headerX,  { toValue: 0, duration: 550, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(searchOp, { toValue: 1, duration: 500, delay: 250, useNativeDriver: true }),
      Animated.timing(searchY,  { toValue: 0, duration: 500, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(bannerOp, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }),
      Animated.timing(bannerY,  { toValue: 0, duration: 500, delay: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    Animated.timing(catSectionOp, { toValue: 1, duration: 400, delay: 520, useNativeDriver: true }).start();
    setTimeout(() => animateGroup(CATEGORY_GROUPS[0].slug), 580);

    Animated.loop(
      Animated.sequence([
        Animated.delay(4000),
        Animated.timing(notifPulse, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(notifPulse, { toValue: 0.9, duration: 100, useNativeDriver: true }),
        Animated.timing(notifPulse, { toValue: 1.1, duration: 100, useNativeDriver: true }),
        Animated.timing(notifPulse, { toValue: 1.0, duration: 100, useNativeDriver: true }),
        Animated.delay(8000),
      ])
    ).start();
  }, [animateGroup]);

  const load = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const [{ data: profile }, { data: recentRequests }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase
        .from('requests')
        .select('*, category:service_categories(name_ar, icon)')
        .eq('client_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .returns<(ServiceRequest & { category?: { name_ar: string; icon: string } })[]>(),
    ]);

    if (profile)        setUser(profile);
    if (recentRequests) setRequests(recentRequests);
    setLoading(false);
    runEntrance();
  }, [runEntrance]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const goToNewRequest = (slug?: string) =>
    router.push(slug
      ? { pathname: '/(client)/new-request', params: { category: slug } }
      : '/(client)/new-request'
    );

  const goToUrgent    = () => router.push('/urgent-request');
  const goToRecurring = () => router.push('/recurring-request');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: contentPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateX: headerX }] }]}>
        <View>
          <Text style={[styles.greeting, { textAlign: ta }]}>{t('home.greeting')}، {user?.full_name?.split(' ')[0]} 👋</Text>
          <Text style={[styles.city, { textAlign: ta }]}>📍 {t(`cities.${user?.city}`, user?.city ?? '')}</Text>
        </View>
        <Animated.View style={{ transform: [{ scale: notifPulse }] }}>
          <TouchableOpacity style={styles.notifBtn}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── Search bar ── */}
      <Animated.View style={{ opacity: searchOp, transform: [{ translateY: searchY }] }}>
        <TouchableOpacity style={styles.searchBar} activeOpacity={0.8} onPress={() => goToNewRequest()}>
          <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
          <Text style={{ fontSize: 17 }}>🔍</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Action banners (compact 2-row) ── */}
      <Animated.View style={[styles.bannerWrap, { opacity: bannerOp, transform: [{ translateY: bannerY }] }]}>
        <CtaBanner onPress={() => goToNewRequest()} />

        <View style={styles.bannerRow2}>
          <View style={{ flex: 1 }}>
            <UrgentBanner onPress={goToUrgent} />
          </View>
          <TouchableOpacity style={styles.recurringMini} onPress={goToRecurring} activeOpacity={0.85}>
            <Text style={styles.recurringMiniIcon}>🔄</Text>
            <Text style={styles.recurringMiniTitle}>{t('home.recurringShort')}</Text>
            <Text style={styles.recurringMiniSub}>{t('home.recurringFixed')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Category Browser ── */}
      <Animated.View style={{ opacity: catSectionOp }}>
        <QuickAccessRow onPress={goToNewRequest} />
        <TabCategoryBrowser
          activeGroup={activeGroup}
          anims={groupAnims}
          onGroupChange={handleGroupChange}
          onCategoryPress={goToNewRequest}
        />
      </Animated.View>

      {/* ── Recent requests ── */}
      {requests.length > 0 ? (
        <>
          {/* Section header: title on start, "see all" on end — RTL-aware */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('home.recentRequests')}</Text>
            <TouchableOpacity onPress={() => router.push('/(client)/requests')}>
              <Text style={styles.seeAll}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          {requests.map((req, i) => (
            <Animated.View
              key={req.id}
              style={{
                opacity: headerOp,
                transform: [{ translateY: headerOp.interpolate({ inputRange: [0, 1], outputRange: [10 + i * 5, 0] }) }],
              }}
            >
              <TouchableOpacity
                style={[styles.requestCard, req.is_urgent && styles.requestCardUrgent]}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/request-detail', params: { id: req.id } })}
              >
                <View style={styles.requestLeft}>
                  <View style={styles.requestTitleRow}>
                    {req.is_urgent && (
                      <Text style={styles.urgentTag}>🚨 {t('providerFeed.urgent')}</Text>
                    )}
                    <Text style={[styles.requestTitle, { textAlign: ta }]} numberOfLines={1}>{req.title}</Text>
                  </View>
                  <Text style={[styles.requestMeta, { textAlign: ta }]}>
                    {String(t(`categories.${req.category_slug}`, (req as any).category?.name_ar ?? req.category_slug))} · {String(t(`cities.${req.city}`, req.city))}
                  </Text>
                  {req.is_urgent && req.urgent_expires_at && req.status === 'open' && (
                    <UrgentCountdownInline expiresAt={req.urgent_expires_at} />
                  )}
                </View>
                <View style={[styles.statusBadge, STATUS_COLORS[req.status]]}>
                  <Text style={styles.statusText}>
                    {t(`requests.status${req.status.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`, req.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </>
      ) : (
        <Animated.View style={[styles.emptyBox, { opacity: bannerOp }]}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>{t('home.noRequests')}</Text>
          <Text style={styles.emptySub}>{t('home.noRequestsSub')}</Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ─── Status color helpers ─────────────────────────────────────
const STATUS_COLORS: Record<string, { backgroundColor: string }> = {
  open:        { backgroundColor: '#0C4A6E' },
  in_progress: { backgroundColor: '#78350F' },
  completed:   { backgroundColor: '#14532D' },
  cancelled:   { backgroundColor: '#3B0764' },
};

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content:   { paddingBottom: 24 },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: HEADER_PAD, paddingBottom: 16,
  },
  greeting: { fontSize: 21, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  city:     { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', marginTop: 3 },
  notifBtn: {
    width: 44, height: 44, backgroundColor: COLORS.surface, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },

  // Search
  searchBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, backgroundColor: COLORS.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
  },
  searchPlaceholder: { fontSize: 14, color: COLORS.textMuted },

  // Banners
  bannerWrap:  { marginHorizontal: 20, marginBottom: 24, gap: 10 },
  ctaBanner: {
    backgroundColor: '#1C1A0E', borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: '#78350F', overflow: 'hidden',
  },
  ctaTitle: { fontSize: 15, fontWeight: '700', color: COLORS.accent, textAlign: 'right', marginBottom: 3 },
  ctaSub:   { fontSize: 11, color: '#92400E', textAlign: 'right' },
  shimmer:  { position: 'absolute', top: 0, bottom: 0, width: Math.round(SCREEN_WIDTH * 0.2), backgroundColor: 'rgba(245,158,11,0.10)', borderRadius: 16 },

  // Row 2: urgent + recurring mini side by side
  bannerRow2:     { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  urgentWrap:     { },
  urgentBanner:   { backgroundColor: '#1A0A0A', borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', flex: 1 },
  urgentInner:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  urgentTitle:    { fontSize: 14, fontWeight: '800', color: '#EF4444', textAlign: 'right', marginBottom: 2 },
  urgentSub:      { fontSize: 10, color: '#9CA3AF', textAlign: 'right' },
  urgentCta:      { backgroundColor: '#DC2626', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  urgentCtaText:  { fontSize: 12, fontWeight: '800', color: '#fff' },

  // Recurring mini card (square)
  recurringMini:       { width: Math.max(84, Math.round(SCREEN_WIDTH * 0.22)), backgroundColor: '#10B98115', borderRadius: 16, borderWidth: 1.5, borderColor: '#10B981', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  recurringMiniIcon:   { fontSize: rs(22, 18, 26), marginBottom: 4 },
  recurringMiniTitle:  { fontSize: rs(13, 11, 15), fontWeight: '800', color: '#10B981' },
  recurringMiniSub:    { fontSize: rs(10, 9, 12), color: '#6EE7B7', marginTop: 2 },

  // unused kept for recurring-request entry in profile
  recurringBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98122', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#10B981' },
  recurringTitle:   { fontSize: 15, fontWeight: '700', color: '#10B981', marginBottom: 3 },
  recurringSub:     { fontSize: 12, color: '#6EE7B7' },
  recurringCta:     { backgroundColor: '#10B981', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  recurringCtaText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Section row
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12, marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  seeAll:       { fontSize: 13, color: COLORS.accent },

  // Request cards
  requestCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  requestLeft:       { flex: 1, marginRight: 12, marginLeft: 0 },
  requestTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: 4 },
  requestTitle:      { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'right', flexShrink: 1 },
  requestMeta:       { fontSize: 12, color: COLORS.textMuted, textAlign: 'right' },
  requestCardUrgent: { borderColor: '#7F1D1D', borderWidth: 1.5, backgroundColor: '#1A0808' },
  urgentTag:         { fontSize: 10, fontWeight: '800', color: '#EF4444', backgroundColor: '#450A0A', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  urgentCountdown:   { fontSize: 11, color: '#FCA5A5', textAlign: 'right', marginTop: 3 },
  urgentExpired:     { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 3 },

  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:   { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary },

  // Empty
  emptyBox:   { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});
