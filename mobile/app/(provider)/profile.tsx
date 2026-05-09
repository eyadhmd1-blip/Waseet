import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Dimensions, Switch,
  Modal, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import {
  TIER_META, SUBSCRIPTION_PLANS, ALL_CATEGORIES,
  CATEGORY_GROUPS, TIER_UPGRADE_CREDITS, ICON_MAP, JORDAN_CITIES,
} from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { Provider, User, PortfolioItem } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { calcLoyaltyProgress } from '../../src/utils/pricing';
import { useTheme } from '../../src/context/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import type { AppColors } from '../../src/constants/colors';

const { width: W } = Dimensions.get('window');

const TYPE_ICON: Record<string, string> = {
  single: '🖼', before_after: '🔄', video: '🎥',
};

const LOYALTY_MILESTONES = [10, 25, 50, 100];

const TIER_COLOR: Record<string, string> = {
  new:     '#9CA3AF',
  rising:  '#F59E0B',
  trusted: '#3B82F6',
  expert:  '#8B5CF6',
  elite:   '#10B981',
};

const CAT_COLORS = [
  '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981',
  '#EF4444', '#EC4899', '#F97316', '#06B6D4',
];

// ─── Sub-components ───────────────────────────────────────────

function StatCard({
  icon, label, value, color, colors,
}: { icon: string; label: string; value: string; color: string; colors: AppColors }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: color + '12',
      borderRadius: 18,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: color + '30',
      gap: 5,
      minHeight: 94,
      justifyContent: 'center',
    }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ fontSize: 21, fontWeight: '800', color: colors.textPrimary, lineHeight: 26 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function SettingsRow({
  icon, label, onPress, colors, danger = false, divider = true, right,
}: {
  icon: string; label: string; onPress?: () => void;
  colors: AppColors; danger?: boolean; divider?: boolean; right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={{
        flexDirection:    'row',
        alignItems:       'center',
        paddingHorizontal: 16,
        paddingVertical:   13,
        gap:               12,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: danger ? '#450A0A' : colors.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: danger ? '#FCA5A5' : colors.textPrimary }}>
        {label}
      </Text>
      {right ?? (onPress ? <Text style={{ fontSize: 18, color: colors.textMuted }}>›</Text> : null)}
    </TouchableOpacity>
  );
}

function SettingsGroup({
  title, children, colors,
}: { title: string; children: React.ReactNode; colors: AppColors }) {
  return (
    <View style={{ marginBottom: 6 }}>
      {title ? (
        <Text style={{
          fontSize: 11, fontWeight: '700', color: colors.textMuted,
          textTransform: 'uppercase', letterSpacing: 1,
          paddingHorizontal: 20, marginBottom: 6, marginTop: 8,
        }}>
          {title}
        </Text>
      ) : null}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 18,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}>
        {children}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function ProviderProfile() {
  const { colors, theme, setTheme } = useTheme();
  const { t, isRTL, toggleLanguage } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const { contentPad } = useInsets();
  const router = useRouter();

  const [provider, setProvider]               = useState<(Provider & { user: User }) | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [portfolioItems, setPortfolioItems]   = useState<PortfolioItem[]>([]);
  const [isAvailable, setIsAvailable]         = useState(true);
  const [urgentEnabled, setUrgentEnabled]     = useState(true);
  const [catModalVisible,  setCatModalVisible]  = useState(false);
  const [selectedCats,     setSelectedCats]     = useState<string[]>([]);
  const [savingCats,       setSavingCats]        = useState(false);
  const [activeTab,        setActiveTab]         = useState<'specialties' | 'portfolio'>('specialties');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [selectedCity,     setSelectedCity]     = useState('');
  const [savingCity,       setSavingCity]       = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser) { setLoading(false); return; }

      const [{ data: provData }, { data: portData }] = await Promise.all([
        supabase.from('providers').select('*, user:users(*)').eq('id', authUser.id).single(),
        supabase.from('portfolio_items').select('*').eq('provider_id', authUser.id)
          .order('created_at', { ascending: false }).limit(12),
      ]);

      if (provData) {
        setProvider(provData);
        setIsAvailable(provData.is_available ?? true);
        setUrgentEnabled(provData.urgent_enabled ?? true);
      }
      if (portData) setPortfolioItems(portData as PortfolioItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Refresh portfolio thumbnails whenever screen regains focus
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  const { nextMilestone, progress: loyaltyProgress } = useMemo(
    () => calcLoyaltyProgress(provider?.lifetime_jobs ?? 0),
    [provider?.lifetime_jobs],
  );
  const myCats = useMemo(
    () => ALL_CATEGORIES.filter(c => provider?.categories?.includes(c.slug)),
    [provider?.categories],
  );
  const totalViews = useMemo(
    () => portfolioItems.reduce((s, i) => s + i.views_count, 0),
    [portfolioItems],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleAvailable = async (val: boolean) => {
    setIsAvailable(val);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const authUser = _ses?.user;
    if (authUser) supabase.from('providers').update({ is_available: val }).eq('id', authUser.id).then(() => {});
  };

  const toggleUrgent = async (val: boolean) => {
    setUrgentEnabled(val);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const authUser = _ses?.user;
    if (authUser) supabase.from('providers').update({ urgent_enabled: val }).eq('id', authUser.id).then(() => {});
  };

  const openCatModal = () => {
    setSelectedCats(provider?.categories ?? []);
    setCatModalVisible(true);
  };

  const removeCat = async (slug: string) => {
    const updated = (provider?.categories ?? []).filter(s => s !== slug);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const authUser = _ses?.user;
    if (!authUser) return;
    const { error } = await supabase.from('providers').update({ categories: updated }).eq('id', authUser.id);
    if (error) Alert.alert(t('common.error'), error.message);
    else load();
  };

  const toggleCat = (slug: string) => {
    setSelectedCats(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 3) {
        Alert.alert(t('profile.maxSpecialties'), t('profile.maxSpecialtiesMsg'));
        return prev;
      }
      return [...prev, slug];
    });
  };

  const saveCategories = async () => {
    setSavingCats(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const authUser = _ses?.user;
    if (!authUser) { setSavingCats(false); return; }
    const { error } = await supabase.from('providers').update({ categories: selectedCats }).eq('id', authUser.id);
    setSavingCats(false);
    if (error) Alert.alert(t('common.error'), error.message);
    else { setCatModalVisible(false); load(); }
  };

  const openCityModal = () => {
    setSelectedCity(provider?.user?.city ?? '');
    setCityModalVisible(true);
  };

  const saveCity = async () => {
    if (!selectedCity) return;
    setSavingCity(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const authUser = _ses?.user;
    if (!authUser) { setSavingCity(false); return; }
    const { error } = await supabase.from('users').update({ city: selectedCity }).eq('id', authUser.id);
    setSavingCity(false);
    if (error) { Alert.alert(t('common.error'), error.message); return; }
    // Optimistic update — no need to refetch everything
    setProvider(prev => prev ? { ...prev, user: { ...prev.user, city: selectedCity } } : prev);
    setCityModalVisible(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  if (!provider) return (
    <View style={styles.center}>
      <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 15 }}>{t('common.error')}</Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.retry') ?? 'إعادة المحاولة'}</Text>
      </TouchableOpacity>
    </View>
  );

  const tierMeta         = TIER_META[provider.reputation_tier];
  const plan             = SUBSCRIPTION_PLANS.find(p => p.tier === provider.subscription_tier);
  const tierColor        = TIER_COLOR[provider.reputation_tier] ?? '#9CA3AF';
  const subCredits       = provider.subscription_credits ?? 0;
  const bonusCredits     = provider.bonus_credits ?? 0;
  const isPremium        = plan?.is_unlimited ?? false;
  const noCredits        = !isPremium && subCredits === 0 && provider.is_subscribed;
  const lowCredits       = !isPremium && subCredits > 0 && subCredits <= 3 && provider.is_subscribed;
  const creditColor      = noCredits ? '#EF4444' : lowCredits ? '#F59E0B' : tierColor;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="stack"
        title={t('profile.title')}
        actionIcon="settings-outline"
        onAction={() => router.push('/notification-settings')}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: contentPad + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >

        {/* ══════════════════════════════════════════════════════
            ZONE 1 — HERO
        ══════════════════════════════════════════════════════ */}
        <View style={[styles.heroCover, { backgroundColor: tierColor + '12' }]}>
          {/* Decorative blobs */}
          <View style={[styles.blob1, { backgroundColor: tierColor + '25' }]} />
          <View style={[styles.blob2, { backgroundColor: tierColor + '18' }]} />

          {/* Avatar with tier-colored ring */}
          <View style={[styles.avatarRing, { borderColor: tierColor + 'BB' }]}>
            <View style={[styles.avatarInner, { backgroundColor: tierColor + '25' }]}>
              <Text style={[styles.avatarLetter, { color: tierColor }]}>
                {provider.user?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.heroName}>{provider.user?.full_name}</Text>

          {/* City (tappable) + Verified */}
          <View style={styles.heroMetaRow}>
            <TouchableOpacity
              onPress={openCityModal}
              activeOpacity={0.7}
              style={[
                styles.heroCityChip,
                provider.user?.city
                  ? { backgroundColor: tierColor + '15', borderColor: tierColor + '45' }
                  : { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderStyle: 'dashed' },
              ]}
            >
              <Text style={{ fontSize: 13 }}>📍</Text>
              <Text style={[
                styles.heroCityText,
                { color: provider.user?.city ? tierColor : colors.textMuted },
              ]}>
                {provider.user?.city
                  ? provider.user.city
                  : (isRTL ? 'أضف مدينتك' : 'Add city')}
              </Text>
              <Text style={{ fontSize: 10, color: provider.user?.city ? tierColor : colors.textMuted, opacity: 0.7 }}>✏️</Text>
            </TouchableOpacity>
            {provider.badge_verified ? (
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>✓ {t('providerProfile.verified')}</Text>
              </View>
            ) : null}
          </View>

          {/* Tier pill + availability pill */}
          <View style={styles.heroTagsRow}>
            <View style={[styles.heroPill, { backgroundColor: tierColor + '20', borderColor: tierColor + '55' }]}>
              <View style={[styles.heroPillDot, { backgroundColor: tierColor }]} />
              <Text style={[styles.heroPillText, { color: tierColor }]}>{tierMeta.label_ar}</Text>
            </View>
            <View style={[styles.heroPill, {
              backgroundColor: isAvailable ? '#22C55E15' : colors.surfaceAlt,
              borderColor: isAvailable ? '#22C55E44' : colors.border,
            }]}>
              <View style={[styles.heroPillDot, { backgroundColor: isAvailable ? '#22C55E' : '#6B7280' }]} />
              <Text style={[styles.heroPillText, { color: isAvailable ? '#22C55E' : colors.textMuted }]}>
                {isAvailable ? (isRTL ? 'مباشر' : 'Online') : (isRTL ? 'غير متاح' : 'Away')}
              </Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            ZONE 2 — PERFORMANCE STATS (2 × 2 grid)
        ══════════════════════════════════════════════════════ */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard icon="⭐" label={t('dashboard.rating')}    value={provider.score > 0 ? provider.score.toFixed(1) : '—'} color="#F59E0B" colors={colors} />
            <StatCard icon="🔨" label={t('dashboard.totalJobs')} value={String(provider.lifetime_jobs)} color={tierColor} colors={colors} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="👁" label={t('dashboard.views')}           value={String(provider.profile_views ?? 0)} color="#3B82F6" colors={colors} />
            <StatCard icon="🔗" label={t('providerProfile.statShares')} value={String(provider.share_count   ?? 0)} color="#8B5CF6" colors={colors} />
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            ZONE 3 — SUBSCRIPTION CARD (Credit Card style)
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionPad}>
          {provider.is_subscribed && plan ? (
            <View style={[styles.subCard, { borderColor: tierColor + '45', backgroundColor: tierColor + '0B' }]}>
              {/* Decorative corner glow */}
              <View style={[styles.subGlow, { backgroundColor: tierColor + '1A' }]} />

              {/* Header row: plan name + price */}
              <View style={styles.subHeaderRow}>
                <View style={[styles.subTierBadge, { backgroundColor: tierColor + '22', borderColor: tierColor + '55' }]}>
                  <Text style={[styles.subTierText, { color: tierColor }]}>{plan.name_ar}</Text>
                </View>
                {plan.is_trial ? (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialText}>{t('subscribe.trialBadge')}</Text>
                  </View>
                ) : (
                  <Text style={styles.subPriceText}>
                    {plan.price_jod} {t('common.jod')}{t('common.perMonth')}
                  </Text>
                )}
              </View>

              {/* Credits — center hero number */}
              <View style={styles.subCreditsBlock}>
                {isPremium ? (
                  <>
                    <Text style={[styles.subCreditsNum, { color: tierColor }]}>∞</Text>
                    <Text style={styles.subCreditsCaption}>{t('profile.creditsUnlimited')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.subCreditsNum, { color: creditColor }]}>{subCredits}</Text>
                    <Text style={styles.subCreditsCaption}>
                      {isRTL ? 'رصيد متبقٍ هذا الشهر' : 'credits remaining'}
                    </Text>
                  </>
                )}
                {bonusCredits > 0 && (
                  <View style={styles.bonusPill}>
                    <Text style={styles.bonusPillText}>🏆 +{bonusCredits} {isRTL ? 'رصيد مكافأة' : 'bonus'}</Text>
                  </View>
                )}
              </View>

              {/* Discount chips */}
              {((provider.win_discount_pct ?? 0) > 0 || provider.reputation_tier !== 'elite') && (
                <View style={styles.subChipsRow}>
                  {(provider.win_discount_pct ?? 0) > 0 && (
                    <View style={styles.discChipGreen}>
                      <Text style={styles.discChipGreenText}>🏆 {provider.win_discount_pct}% {isRTL ? 'خصم تجديد' : 'renewal off'}</Text>
                    </View>
                  )}
                  {provider.reputation_tier !== 'elite' && (
                    <View style={styles.discChipBlue}>
                      <Text style={styles.discChipBlueText}>
                        ⬆️ {isRTL
                          ? `ارتقِ لـ ${['new','rising','trusted','expert'].includes(provider.reputation_tier)
                              ? ['rising','trusted','expert','elite'][['new','rising','trusted','expert'].indexOf(provider.reputation_tier)]
                              : 'elite'}`
                          : 'Upgrade tier for bonus'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Expiry */}
              {provider.subscription_ends && (
                <Text style={styles.subExpiry}>
                  {t('profile.subscriptionValid', {
                    date: new Date(provider.subscription_ends).toLocaleDateString(
                      isRTL ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'long' },
                    ),
                  })}
                </Text>
              )}

              {/* CTA button — urgent styling only when needed */}
              <TouchableOpacity
                style={[
                  styles.subCTA,
                  noCredits || lowCredits
                    ? { backgroundColor: colors.accent }
                    : { backgroundColor: tierColor + '20', borderWidth: 1, borderColor: tierColor + '55' },
                ]}
                onPress={() => router.push('/subscribe' as any)}
              >
                <Text style={[styles.subCTAText, { color: noCredits || lowCredits ? colors.bg : tierColor }]}>
                  {noCredits
                    ? (isRTL ? '⚡ جدّد اشتراكك الآن' : '⚡ Renew Now')
                    : plan.tier === 'premium'
                      ? t('profile.renewBtn')
                      : t('profile.upgradeBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.noSubCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>💎</Text>
              <Text style={styles.noSubTitle}>{isRTL ? 'لا يوجد اشتراك نشط' : 'No active subscription'}</Text>
              <Text style={styles.noSubSub}>{t('subscribe.noSubscription')}</Text>
              <TouchableOpacity
                style={[styles.subCTA, { backgroundColor: colors.accent, width: '100%', marginTop: 14 }]}
                onPress={() => router.push('/subscribe')}
              >
                <Text style={[styles.subCTAText, { color: colors.bg }]}>{t('profile.subscribeNow')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════
            ZONE 4 — SEGMENTED TABS: Specialties | Portfolio
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionPad}>
          {/* Segment control */}
          <View style={[styles.segmentWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['specialties', 'portfolio'] as const).map(tab => {
              const active = activeTab === tab;
              const label  = tab === 'specialties'
                ? `🛠 ${t('profile.mySpecialties')}`
                : `🖼 ${t('profile.portfolioMyGallery')}${portfolioItems.length > 0 ? ` (${portfolioItems.length})` : ''}`;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.segmentBtn,
                    active && { backgroundColor: tierColor + '20', borderWidth: 1, borderColor: tierColor + '66' },
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.segmentText, active && { color: tierColor, fontWeight: '700' }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab: Specialties */}
          {activeTab === 'specialties' && (
            <View style={styles.tabPane}>
              {myCats.length === 0 ? (
                <TouchableOpacity style={[styles.emptyPane, { borderColor: colors.border }]} onPress={openCatModal}>
                  <Text style={{ fontSize: 34 }}>🛠</Text>
                  <Text style={[styles.emptyPaneTitle, { color: colors.textPrimary }]}>{t('profile.noSpecialties')}</Text>
                  <Text style={[styles.emptyPaneSub, { color: colors.textMuted }]}>
                    {isRTL ? 'اضغط لإضافة تخصصاتك' : 'Tap to add specialties'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.catsWrap}>
                    {myCats.map((cat, i) => {
                      const cc = CAT_COLORS[i % CAT_COLORS.length];
                      return (
                        <View key={cat.slug} style={[styles.catChip, { backgroundColor: cc + '16', borderColor: cc + '55' }]}>
                          <Text style={styles.catChipIcon}>{ICON_MAP[cat.icon] ?? '🔧'}</Text>
                          <Text style={[styles.catChipLabel, { color: cc }]}>
                            {t(`categories.${cat.slug}`, cat.name_ar)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeCat(cat.slug)}
                            style={[styles.catRemoveBtn, { backgroundColor: cc + '22' }]}
                            hitSlop={8}
                          >
                            <Text style={{ fontSize: 13, color: cc, fontWeight: '700', lineHeight: 18 }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {myCats.length < 3 && (
                      <TouchableOpacity
                        style={[styles.catAddChip, { borderColor: colors.accent }]}
                        onPress={openCatModal}
                      >
                        <Text style={[styles.catChipLabel, { color: colors.accent }]}>
                          + {t('profile.addSpecialty')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.catsNote, { color: colors.textMuted }]}>
                    {t('profile.maxSpecialtiesNote')}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Tab: Portfolio */}
          {activeTab === 'portfolio' && (
            <View style={styles.tabPane}>
              {portfolioItems.length === 0 ? (
                <TouchableOpacity
                  style={[styles.emptyPane, { borderColor: colors.border }]}
                  onPress={() => router.push('/portfolio-add')}
                >
                  <Text style={{ fontSize: 34 }}>📷</Text>
                  <Text style={[styles.emptyPaneTitle, { color: colors.textPrimary }]}>{t('profile.portfolioEmpty')}</Text>
                  <Text style={[styles.emptyPaneSub, { color: colors.textMuted }]}>{t('profile.portfolioEmptySub')}</Text>
                  <View style={[styles.subCTA, { backgroundColor: colors.accent, paddingHorizontal: 28, marginTop: 10 }]}>
                    <Text style={[styles.subCTAText, { color: colors.bg }]}>{t('profile.portfolioAdd')}</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.portfolioMetaRow}>
                    <Text style={[styles.portfolioMetaText, { color: colors.textMuted }]}>🖼 {portfolioItems.length}</Text>
                    <Text style={[styles.portfolioMetaText, { color: colors.textMuted }]}>👁 {totalViews}</Text>
                    <TouchableOpacity onPress={() => router.push('/portfolio-add')}>
                      <Text style={[styles.portfolioMetaText, { color: colors.accent }]}>
                        + {t('profile.portfolioAdd')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingRight: 4, paddingBottom: 4 }}
                  >
                    {portfolioItems.map((item) => {
                      const thumb = item.item_type !== 'video' ? item.media_urls[0] : null;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.portfolioThumb, { backgroundColor: colors.surfaceAlt }]}
                          onPress={() => router.push('/portfolio')}
                          activeOpacity={0.85}
                        >
                          {thumb
                            ? <Image source={{ uri: thumb }} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} resizeMode="cover" />
                            : (
                              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', borderRadius: 14 }]}>
                                <Text style={{ fontSize: 28 }}>🎥</Text>
                              </View>
                            )}
                          <View style={styles.portfolioTypeBadge}>
                            <Text style={{ fontSize: 9 }}>{TYPE_ICON[item.item_type]}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.portfolioViewAll} onPress={() => router.push('/portfolio')}>
                    <Text style={[styles.portfolioViewAllText, { color: colors.accent }]}>
                      {t('profile.portfolioViewAll')} ›
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════════════════════
            ZONE 5 — LOYALTY PROGRESS (milestone track)
        ══════════════════════════════════════════════════════ */}
        {nextMilestone && (
          <View style={styles.sectionPad}>
            <View style={[styles.loyaltyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.loyaltyHeader}>
                <Text style={[styles.loyaltyTitle, { color: colors.textPrimary }]}>
                  🎯 {t('profile.loyaltyReward')}
                </Text>
                <Text style={[styles.loyaltyCount, { color: tierColor }]}>
                  {provider.lifetime_jobs} / {nextMilestone}
                </Text>
              </View>

              {/* Segmented milestone bar */}
              <View style={styles.milestoneBarRow}>
                {LOYALTY_MILESTONES.map((ms, idx) => {
                  const prevMs  = idx === 0 ? 0 : LOYALTY_MILESTONES[idx - 1];
                  const segSize = ms - prevMs;
                  const filled  = provider.lifetime_jobs >= ms;
                  const partial = !filled && provider.lifetime_jobs > prevMs;
                  return (
                    <View key={ms} style={{ flex: segSize, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      {/* Bar segment */}
                      <View style={{
                        flex: 1, height: 7, borderRadius: 3,
                        backgroundColor: filled
                          ? tierColor
                          : partial
                            ? tierColor + '50'
                            : colors.bg,
                      }} />
                      {/* Milestone dot */}
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: filled ? tierColor : colors.bg,
                        borderWidth: 2,
                        borderColor: filled ? tierColor : ms === nextMilestone ? tierColor + '88' : colors.border,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {filled
                          ? <Text style={{ fontSize: 9, color: '#fff', fontWeight: '800' }}>✓</Text>
                          : <Text style={{ fontSize: 8, color: ms === nextMilestone ? tierColor : colors.textMuted, fontWeight: '700' }}>
                              {ms > 25 ? `${ms}` : ms}
                            </Text>}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Milestone labels */}
              <View style={styles.milestoneLabelsRow}>
                {LOYALTY_MILESTONES.map(ms => (
                  <Text
                    key={ms}
                    style={[
                      styles.milestoneLabel,
                      { color: provider.lifetime_jobs >= ms ? tierColor : colors.textMuted,
                        fontWeight: provider.lifetime_jobs >= ms ? '700' : '400' },
                    ]}
                  >
                    {ms}
                  </Text>
                ))}
              </View>

              <Text style={[styles.loyaltyRewardText, { color: colors.textSecondary }]}>
                {nextMilestone === 10  ? t('subscribe.discount', { pct: 20 }) + ' 🎁' :
                 nextMilestone === 25  ? t('subscribe.discount', { pct: 30 }) + ' 🏅' :
                 nextMilestone === 50  ? '🎉 ' + t('subscribe.loyalty') :
                                         '👑 Elite'}
              </Text>
              <Text style={[styles.loyaltyHint, { color: colors.textMuted }]}>
                {t('profile.jobsToNextReward', { count: nextMilestone - provider.lifetime_jobs })}
              </Text>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            AVAILABILITY TOGGLES
        ══════════════════════════════════════════════════════ */}
        <View style={styles.sectionPad}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
            {t('profile.receptionStatus')}
          </Text>
          <View style={[styles.availCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.availRow}>
              <View style={styles.availLeft}>
                <View style={[styles.availIconBox, { backgroundColor: isAvailable ? '#22C55E18' : colors.surfaceAlt }]}>
                  <Text style={{ fontSize: 18 }}>{isAvailable ? '🟢' : '⚫'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.availLabel, { color: colors.textPrimary }]}>{t('profile.availableNow')}</Text>
                  <Text style={[styles.availSub, { color: colors.textMuted }]}>
                    {isAvailable ? t('profile.visibleToClients') : t('profile.hiddenFromClients')}
                  </Text>
                </View>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={toggleAvailable}
                trackColor={{ false: colors.border, true: '#16A34A' }}
                thumbColor="#fff"
              />
            </View>
            {isAvailable && (
              <View style={[styles.availRow, styles.availRowTop, { borderTopColor: colors.border }]}>
                <View style={styles.availLeft}>
                  <View style={[styles.availIconBox, { backgroundColor: urgentEnabled ? '#DC262618' : colors.surfaceAlt }]}>
                    <Text style={{ fontSize: 18 }}>🚨</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.availLabel, { color: colors.textPrimary }]}>{t('profile.acceptUrgent')}</Text>
                    <Text style={[styles.availSub, { color: colors.textMuted }]}>
                      {urgentEnabled ? t('profile.urgentOn') : t('profile.urgentOff')}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={urgentEnabled}
                  onValueChange={toggleUrgent}
                  trackColor={{ false: colors.border, true: '#DC2626' }}
                  thumbColor="#fff"
                />
              </View>
            )}
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            ZONE 6 — SETTINGS GROUPS (iOS-style)
        ══════════════════════════════════════════════════════ */}

        <SettingsGroup title={isRTL ? 'الحساب' : 'Account'} colors={colors}>
          <SettingsRow
            icon="🌐"
            label={t('profile.language')}
            onPress={toggleLanguage}
            colors={colors}
            right={
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                {isRTL ? 'العربية' : 'English'} ›
              </Text>
            }
          />
          <SettingsRow
            icon="🎨"
            label={t('profile.theme')}
            colors={colors}
            right={
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {(['dark', 'light', 'system'] as const).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setTheme(opt)}
                    style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                      backgroundColor: theme === opt ? colors.accent : colors.bg,
                      borderWidth: 1, borderColor: theme === opt ? colors.accent : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: theme === opt ? colors.bg : colors.textMuted }}>
                      {opt === 'dark' ? '🌙' : opt === 'light' ? '☀️' : '⚙️'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
          <SettingsRow
            icon="🔔"
            label={t('profile.notifications')}
            onPress={() => router.push('/notification-settings')}
            colors={colors}
            divider={false}
          />
        </SettingsGroup>

        <SettingsGroup title={isRTL ? 'ملفي العام' : 'My Profile'} colors={colors}>
          <SettingsRow
            icon="⬆️"
            label={t('profile.sharePublicProfile')}
            onPress={() => router.push({ pathname: '/provider-profile', params: { provider_id: provider.id } })}
            colors={colors}
            divider={false}
          />
        </SettingsGroup>

        <SettingsGroup title={isRTL ? 'المساعدة' : 'Help'} colors={colors}>
          <SettingsRow
            icon="🎧"
            label={t('profile.support')}
            onPress={() => router.push('/support' as any)}
            colors={colors}
          />
          <SettingsRow
            icon="❓"
            label={t('helpCenter.title')}
            onPress={() => router.push('/help-center?role=provider' as any)}
            colors={colors}
            divider={false}
          />
        </SettingsGroup>

        {/* Sign out */}
        <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
          <TouchableOpacity
            style={[styles.signOutRow, { backgroundColor: '#450A0A', borderColor: '#7F1D1D' }]}
            onPress={() => supabase.auth.signOut()}
            activeOpacity={0.75}
          >
            <Text style={{ fontSize: 18 }}>🚪</Text>
            <Text style={[styles.signOutText, { color: '#FCA5A5' }]}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── City Edit Modal ── */}
      <Modal
        visible={cityModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, paddingBottom: contentPad }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                📍 {isRTL ? 'اختر مدينتك' : 'Select City'}
              </Text>
              <TouchableOpacity onPress={saveCity} disabled={savingCity || !selectedCity}>
                <Text style={[styles.modalSave, {
                  color: savingCity || !selectedCity ? colors.textMuted : tierColor,
                }]}>
                  {savingCity ? t('common.loading') : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Subtitle */}
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {isRTL
                ? 'المدينة تحدد الطلبات التي تظهر لك في الفيد'
                : 'Your city determines which requests appear in your feed'}
            </Text>

            {/* City grid */}
            <ScrollView
              style={{ paddingHorizontal: 16, paddingTop: 4 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.cityGrid}>
                {JORDAN_CITIES.map(city => {
                  const active = selectedCity === city;
                  return (
                    <TouchableOpacity
                      key={city}
                      onPress={() => setSelectedCity(city)}
                      activeOpacity={0.7}
                      style={[
                        styles.cityGridChip,
                        active
                          ? { backgroundColor: tierColor + '20', borderColor: tierColor, borderWidth: 2 }
                          : { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1 },
                      ]}
                    >
                      {active && (
                        <Text style={{ fontSize: 10, color: tierColor, fontWeight: '900', marginBottom: 2 }}>✓</Text>
                      )}
                      <Text style={[
                        styles.cityGridText,
                        { color: active ? tierColor : colors.textPrimary, fontWeight: active ? '700' : '500' },
                      ]}>
                        {t(`cities.${city}`, city)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Category Edit Modal ── */}
      <Modal
        visible={catModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, paddingBottom: contentPad }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setCatModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('profile.editSpecialties')}</Text>
              <TouchableOpacity onPress={saveCategories} disabled={savingCats}>
                <Text style={[styles.modalSave, { color: savingCats ? colors.textMuted : colors.accent }]}>
                  {savingCats ? t('common.loading') : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {t('profile.selectedCount', { count: selectedCats.length, max: 3 })}
            </Text>
            <ScrollView style={{ paddingHorizontal: 20, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
              {CATEGORY_GROUPS.map(group => (
                <View key={group.slug} style={{ marginBottom: 16 }}>
                  <Text style={[styles.catGroupLabel, { color: colors.textMuted }]}>{group.name_ar}</Text>
                  <View style={styles.catsWrap}>
                    {group.categories.map((cat, i) => {
                      const selected = selectedCats.includes(cat.slug);
                      const cc = CAT_COLORS[i % CAT_COLORS.length];
                      return (
                        <TouchableOpacity
                          key={cat.slug}
                          style={[
                            styles.catChip,
                            selected
                              ? { backgroundColor: cc + '20', borderColor: cc + '70' }
                              : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                          ]}
                          onPress={() => toggleCat(cat.slug)}
                        >
                          <Text style={styles.catChipIcon}>{ICON_MAP[cat.icon] ?? '🔧'}</Text>
                          <Text style={[styles.catChipLabel, { color: selected ? cc : colors.textPrimary }]}>
                            {t(`categories.${cat.slug}`, cat.name_ar)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: colors.bg },
    scrollView: { flex: 1 },
    center:     { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

    // ── Hero ──
    heroCover: {
      paddingTop: 32, paddingBottom: 30, paddingHorizontal: 20,
      alignItems: 'center', overflow: 'hidden',
    },
    blob1: {
      position: 'absolute', width: 220, height: 220, borderRadius: 110,
      top: -70, right: -60,
    },
    blob2: {
      position: 'absolute', width: 160, height: 160, borderRadius: 80,
      bottom: -40, left: -40,
    },
    avatarRing: {
      width: 96, height: 96, borderRadius: 48,
      borderWidth: 3, padding: 4, marginBottom: 16,
    },
    avatarInner: {
      flex: 1, borderRadius: 40,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { fontSize: 36, fontWeight: '800' },
    heroName:     { fontSize: 23, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    heroMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' },
    heroCity:     { fontSize: 13, color: colors.textMuted },
    heroCityChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
      borderWidth: 1,
    },
    heroCityText: { fontSize: 13, fontWeight: '600' },
    // City grid in modal
    cityGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
    cityGridChip:  {
      width: (W - 32 - 20) / 3,
      borderRadius: 14, paddingVertical: 12,
      alignItems: 'center', justifyContent: 'center', gap: 2,
    },
    cityGridText:  { fontSize: 13, textAlign: 'center' },
    verifiedPill: { backgroundColor: '#0C4A6E', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    verifiedText: { fontSize: 11, color: '#7DD3FC', fontWeight: '700' },
    heroTagsRow:  { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
    heroPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
    heroPillDot:  { width: 7, height: 7, borderRadius: 3.5 },
    heroPillText: { fontSize: 12, fontWeight: '700' },

    // ── Stats 2×2 ──
    statsGrid: { paddingHorizontal: 16, marginBottom: 20, gap: 10 },
    statsRow:  { flexDirection: 'row', gap: 10 },

    // ── Section padding ──
    sectionPad: { paddingHorizontal: 16, marginBottom: 20 },

    // ── Subscription card ──
    subCard: { borderRadius: 22, padding: 22, borderWidth: 1.5, overflow: 'hidden' },
    subGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -60, right: -50 },
    subHeaderRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
    subTierBadge:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
    subTierText:     { fontSize: 13, fontWeight: '700' },
    subPriceText:    { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    trialBadge:      { backgroundColor: '#064E3B', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    trialText:       { fontSize: 12, color: '#6EE7B7', fontWeight: '700' },
    subCreditsBlock: { alignItems: 'center', marginBottom: 18, gap: 4 },
    subCreditsNum:   { fontSize: 60, fontWeight: '900', lineHeight: 68 },
    subCreditsCaption: { fontSize: 13, color: colors.textSecondary },
    bonusPill:       { backgroundColor: colors.accentDim, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.accent + '44', marginTop: 4 },
    bonusPillText:   { fontSize: 12, color: colors.accent, fontWeight: '700' },
    subChipsRow:     { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 },
    discChipGreen:   { backgroundColor: '#16A34A18', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#16A34A44' },
    discChipGreenText: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
    discChipBlue:    { backgroundColor: '#3B82F618', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#3B82F644' },
    discChipBlueText: { fontSize: 12, color: '#93C5FD', fontWeight: '600' },
    subExpiry:       { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
    subCTA:          { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    subCTAText:      { fontSize: 15, fontWeight: '700' },
    noSubCard:       { borderRadius: 22, padding: 26, borderWidth: 1, alignItems: 'center' },
    noSubTitle:      { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    noSubSub:        { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

    // ── Segmented tabs ──
    segmentWrap: { flexDirection: 'row', borderRadius: 14, padding: 4, borderWidth: 1, marginBottom: 16 },
    segmentBtn:  { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
    segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    tabPane:     { minHeight: 110 },

    // Empty states
    emptyPane:      { backgroundColor: colors.surface, borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', gap: 8 },
    emptyPaneTitle: { fontSize: 15, fontWeight: '700' },
    emptyPaneSub:   { fontSize: 13, textAlign: 'center' },

    // Categories
    catsWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
    catChipIcon:  { fontSize: 15 },
    catChipLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    catRemoveBtn: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    catAddChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderStyle: 'dashed' },
    catsNote:     { fontSize: 11, textAlign: ta, marginTop: 8 },
    catGroupLabel:{ fontSize: 13, fontWeight: '600', textAlign: ta, marginBottom: 8 },

    // Portfolio
    portfolioMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'flex-end', marginBottom: 12 },
    portfolioMetaText:  { fontSize: 12, fontWeight: '600' },
    portfolioThumb:     { width: 112, height: 112, borderRadius: 14, overflow: 'hidden' },
    portfolioTypeBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 },
    portfolioViewAll:   { alignItems: 'center', marginTop: 10 },
    portfolioViewAllText: { fontSize: 13, fontWeight: '600' },

    // Loyalty
    loyaltyCard:       { borderRadius: 18, padding: 18, borderWidth: 1 },
    loyaltyHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    loyaltyTitle:      { fontSize: 15, fontWeight: '700' },
    loyaltyCount:      { fontSize: 15, fontWeight: '700' },
    milestoneBarRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    milestoneLabelsRow:{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginBottom: 14 },
    milestoneLabel:    { fontSize: 10 },
    loyaltyRewardText: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
    loyaltyHint:       { fontSize: 12, textAlign: 'center' },

    // Availability
    groupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    availCard:  { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    availRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    availRowTop:{ borderTopWidth: 1 },
    availLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    availIconBox:{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    availLabel: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
    availSub:   { fontSize: 12 },

    // Sign out
    signOutRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1 },
    signOutText: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: ta },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '87%' },
    modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    modalTitle:   { fontSize: 16, fontWeight: '700' },
    modalCancel:  { fontSize: 14 },
    modalSave:    { fontSize: 14, fontWeight: '700' },
    modalSub:     { fontSize: 12, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  });
}
