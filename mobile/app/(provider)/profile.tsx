import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Dimensions, Switch,
  Modal, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { TIER_META, SUBSCRIPTION_PLANS, ALL_CATEGORIES, CATEGORY_GROUPS, REP_DISCOUNT, ICON_MAP } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { Provider, User, PortfolioItem } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { calcLoyaltyProgress } from '../../src/utils/pricing';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const { width: W } = Dimensions.get('window');
const MINI_CELL    = (W - 32 - 8) / 3; // 3 cols, 16px side padding, 4px gaps

// LOYALTY_MILESTONES now lives in src/constants/loyalty.ts — imported via calcLoyaltyProgress
const LOYALTY_MILESTONES = [10, 25, 50, 100];


const TYPE_ICON: Record<string, string> = {
  single: '🖼', before_after: '🔄', video: '🎥',
};

export default function ProviderProfile() {
  const { colors, theme, setTheme } = useTheme();
  const { t, ta, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const [provider, setProvider]             = useState<(Provider & { user: User }) | null>(null);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [isAvailable, setIsAvailable]       = useState(true);
  const [urgentEnabled, setUrgentEnabled]   = useState(true);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [selectedCats, setSelectedCats]     = useState<string[]>([]);
  const [savingCats, setSavingCats]         = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser) { setLoading(false); return; }

      const [{ data: provData }, { data: portData }] = await Promise.all([
        supabase
          .from('providers')
          .select('*, user:users(*)')
          .eq('id', authUser.id)
          .single(),
        supabase
          .from('portfolio_items')
          .select('*')
          .eq('provider_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(9),
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

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  // ── These must live before any early return (Rules of Hooks) ──
  const { nextMilestone, progress: loyaltyProgress } = useMemo(
    () => calcLoyaltyProgress(provider?.lifetime_jobs ?? 0),
    [provider?.lifetime_jobs],
  );
  const myCats = useMemo(
    () => ALL_CATEGORIES.filter(c => provider?.categories?.includes(c.slug)),
    [provider?.categories],
  );
  const { portfolioPreview, totalViews } = useMemo(() => ({
    portfolioPreview: portfolioItems.slice(0, 8),
    totalViews:       portfolioItems.reduce((s, i) => s + i.views_count, 0),
  }), [portfolioItems]);

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

    const { error } = await supabase
      .from('providers')
      .update({ categories: selectedCats })
      .eq('id', authUser.id);

    setSavingCats(false);
    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setCatModalVisible(false);
      load(); // refresh provider data
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  if (!provider) return (
    <View style={styles.center}>
      <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 15 }}>
        {t('common.error')}
      </Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.retry') ?? 'إعادة المحاولة'}</Text>
      </TouchableOpacity>
    </View>
  );

  const tierMeta = TIER_META[provider.reputation_tier];
  const plan     = SUBSCRIPTION_PLANS.find(p => p.tier === provider.subscription_tier);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: contentPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* ── Avatar + Name + Tier ── */}
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {provider.user?.full_name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <Text style={styles.name}>{provider.user?.full_name}</Text>
        <Text style={styles.city}>{provider.user?.city}</Text>

        <View style={[styles.tierPill, { backgroundColor: tierMeta.color + '22' }]}>
          <Text style={[styles.tierPillText, { color: tierMeta.color }]}>{tierMeta.label_ar}</Text>
        </View>

        {provider.badge_verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ {t('providerProfile.verified')}</Text>
          </View>
        )}
      </View>

      {/* ── Score + Stats ── */}
      <View style={styles.statsRow}>
        <StatBox label={t('dashboard.rating')}    value={provider.score > 0 ? `${provider.score.toFixed(1)} ⭐` : '—'} />
        <StatBox label={t('dashboard.totalJobs')} value={String(provider.lifetime_jobs)} />
        <StatBox label={t('dashboard.views')}     value={String(provider.profile_views ?? 0)} />
        <StatBox label={t('dashboard.views')}     value={String(provider.share_count ?? 0)} />
      </View>

      {/* ── Portfolio Mini Gallery ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => router.push('/portfolio')}>
            <Text style={styles.sectionLink}>{t('profile.portfolioManage')} ›</Text>
          </TouchableOpacity>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{t('profile.portfolioMyGallery')}</Text>
            <Text style={styles.sectionEmoji}>🖼</Text>
          </View>
        </View>

        {portfolioItems.length === 0 ? (
          <TouchableOpacity
            style={styles.portfolioEmpty}
            onPress={() => router.push('/portfolio-add')}
            activeOpacity={0.85}
          >
            <Text style={styles.portfolioEmptyIcon}>📷</Text>
            <Text style={styles.portfolioEmptyTitle}>{t('profile.portfolioEmpty')}</Text>
            <Text style={styles.portfolioEmptySub}>{t('profile.portfolioEmptySub')}</Text>
            <View style={styles.portfolioEmptyBtn}>
              <Text style={styles.portfolioEmptyBtnText}>{t('profile.portfolioAdd')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.portfolioMiniStats}>
              <Text style={styles.portfolioMiniStat}>🖼 {portfolioItems.length} {t('providerProfile.jobsDone')}</Text>
              <Text style={styles.portfolioMiniStat}>👁 {totalViews} {t('dashboard.views')}</Text>
            </View>

            {/* 3-col thumbnail grid */}
            <View style={styles.miniGrid}>
              {portfolioPreview.map((item) => {
                const thumb = item.item_type === 'video'
                  ? null
                  : item.media_urls[0];

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.miniCell, { width: MINI_CELL, height: MINI_CELL }]}
                    onPress={() => router.push('/portfolio')}
                    activeOpacity={0.85}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.miniVideoPlaceholder]}>
                        <Text style={{ fontSize: 28 }}>🎥</Text>
                      </View>
                    )}
                    {/* Type badge */}
                    <View style={styles.miniTypeBadge}>
                      <Text style={{ fontSize: 9 }}>{TYPE_ICON[item.item_type]}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Add tile */}
              <TouchableOpacity
                style={[styles.miniCell, styles.miniAddCell, { width: MINI_CELL, height: MINI_CELL }]}
                onPress={() => router.push('/portfolio-add')}
                activeOpacity={0.85}
              >
                <Text style={styles.miniAddIcon}>+</Text>
                <Text style={styles.miniAddText}>{t('portfolio.fabAdd')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.portfolioViewAll} onPress={() => router.push('/portfolio')}>
              <Text style={styles.portfolioViewAllText}>{t('profile.portfolioViewAll')} ›</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Loyalty progress ── */}
      {nextMilestone && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.loyaltyReward')}</Text>
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyHeader}>
              <Text style={styles.loyaltyNext}>
                {t('profile.jobsToNextReward', { count: nextMilestone - provider.lifetime_jobs })}
              </Text>
              <Text style={styles.loyaltyCount}>
                {provider.lifetime_jobs}/{nextMilestone}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${loyaltyProgress * 100}%` as any }]} />
            </View>
            <Text style={styles.loyaltyReward}>
              {nextMilestone === 10  ? t('subscribe.discount', { pct: 20 }) + ' 🎁' :
               nextMilestone === 25  ? t('subscribe.discount', { pct: 30 }) + ' 🏅' :
               nextMilestone === 50  ? '🎉 ' + t('subscribe.loyalty') :
                                       '👑 ' + t('tiers.elite', 'Elite')}
            </Text>
          </View>
        </View>
      )}

      {/* ── Subscription ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.subscriptionTitle')}</Text>
        {provider.is_subscribed && plan ? (
          <View style={styles.subCard}>
            <View style={styles.subHeader}>
              <Text style={styles.subEnds}>
                {t('profile.subscriptionValid', {
                  date: new Date(provider.subscription_ends!).toLocaleDateString(
                    'en-GB', { day: 'numeric', month: 'long' }
                  )
                })}
              </Text>
              <Text style={styles.subTier}>{plan.name_ar}</Text>
            </View>
            {plan.is_trial
              ? <Text style={styles.subPrice}>{t('subscribe.trialBadge')}</Text>
              : <Text style={styles.subPrice}>{plan.price_jod} {t('common.jod')}{t('common.perMonth')}</Text>
            }

            {/* Remaining credits */}
            <View style={styles.creditsBadge}>
              <Text style={styles.creditsBadgeText}>
                {plan.is_unlimited
                  ? t('profile.creditsUnlimited')
                  : t('profile.creditsRemaining', { count: provider.bid_credits ?? 0 })}
              </Text>
            </View>

            {/* Win discount earned */}
            {(provider.win_discount_pct ?? 0) > 0 && (
              <Text style={styles.winDiscountText}>
                {t('profile.winDiscount', { pct: provider.win_discount_pct })}
              </Text>
            )}

            {/* Reputation discount */}
            {REP_DISCOUNT[provider.reputation_tier] > 0 && (
              <Text style={styles.repDiscountText}>
                {t('profile.repDiscount', { pct: REP_DISCOUNT[provider.reputation_tier] })}
              </Text>
            )}

            {/* Legacy loyalty discount banner */}
            {provider.loyalty_discount > 0 && (
              <View style={styles.discountBanner}>
                <Text style={styles.discountText}>
                  {t('profile.discountBanner', { pct: provider.loyalty_discount })}
                </Text>
              </View>
            )}

            {/* Upgrade / Renew button */}
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push('/subscribe' as any)}
            >
              <Text style={styles.upgradeBtnText}>
                {plan.tier === 'premium'
                  ? t('profile.renewBtn')
                  : t('profile.upgradeBtn')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noSubCard}>
            <Text style={styles.noSubText}>{t('subscribe.noSubscription')}</Text>
            <TouchableOpacity
              style={styles.subscribeBtn}
              onPress={() => router.push('/subscribe')}
            >
              <Text style={styles.subscribeBtnText}>{t('profile.subscribeNow')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── My categories ── */}
      <View style={styles.section}>
        <View style={[styles.sectionHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <TouchableOpacity onPress={openCatModal}>
            <Text style={styles.sectionLink}>{t('profile.editSpecialties')} ✏️</Text>
          </TouchableOpacity>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{t('profile.mySpecialties')}</Text>
            <Text style={styles.sectionEmoji}>🛠</Text>
          </View>
        </View>
        {myCats.length > 0 ? (
          <View style={styles.catsWrap}>
            {myCats.map(cat => (
              <View key={cat.slug} style={styles.catChip}>
                <Text style={styles.catChipText}>{ICON_MAP[cat.icon] ?? '🔧'} {t(`categories.${cat.slug}`, cat.name_ar)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <TouchableOpacity style={styles.addCatsHint} onPress={openCatModal}>
            <Text style={styles.addCatsHintText}>{t('profile.noSpecialties')}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.maxCatsNote}>{t('profile.maxSpecialtiesNote')}</Text>
      </View>

      {/* ── Category edit modal ── */}
      <Modal
        visible={catModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCatModalVisible(false)}>
                <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('profile.editSpecialties')}</Text>
              <TouchableOpacity
                onPress={saveCategories}
                disabled={savingCats}
              >
                <Text style={[styles.modalSave, savingCats && { color: colors.textMuted }]}>
                  {savingCats ? t('common.loading') : t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {t('profile.selectedCount', { count: selectedCats.length, max: 3 })}
            </Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {CATEGORY_GROUPS.map(group => (
                <View key={group.slug} style={styles.catGroup}>
                  <Text style={styles.catGroupLabel}>{group.name_ar}</Text>
                  <View style={styles.catsWrap}>
                    {group.categories.map(cat => {
                      const selected = selectedCats.includes(cat.slug);
                      return (
                        <TouchableOpacity
                          key={cat.slug}
                          style={[styles.catChip, selected && styles.catChipSelected]}
                          onPress={() => toggleCat(cat.slug)}
                        >
                          <Text style={[styles.catChipText, selected && styles.catChipTextSelected]}>
                            {ICON_MAP[cat.icon] ?? '🔧'} {t(`categories.${cat.slug}`, cat.name_ar)}
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

      {/* ── Availability & Urgent toggles ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.receptionStatus')}</Text>
        <View style={styles.availCard}>
          <View style={styles.availRow}>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailable}
              trackColor={{ false: colors.border, true: '#16A34A' }}
              thumbColor="#fff"
            />
            <View style={styles.availTextWrap}>
              <Text style={styles.availLabel}>{t('profile.availableNow')}</Text>
              <Text style={styles.availSub}>
                {isAvailable ? t('profile.visibleToClients') : t('profile.hiddenFromClients')}
              </Text>
            </View>
          </View>

          {isAvailable && (
            <View style={[styles.availRow, styles.availRowBorder]}>
              <Switch
                value={urgentEnabled}
                onValueChange={toggleUrgent}
                trackColor={{ false: colors.border, true: '#DC2626' }}
                thumbColor="#fff"
              />
              <View style={styles.availTextWrap}>
                <Text style={styles.availLabel}>{t('profile.acceptUrgent')}</Text>
                <Text style={styles.availSub}>
                  {urgentEnabled ? t('profile.urgentOn') : t('profile.urgentOff')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── Language switcher ── */}
      <TouchableOpacity style={styles.notifBtn} onPress={() => {}}>
        <Text style={styles.notifBtnIcon}>🌐</Text>
        <Text style={styles.notifBtnText}>{t('profile.language')}</Text>
      </TouchableOpacity>

      {/* ── Theme picker ── */}
      <View style={styles.notifBtn}>
        <Text style={styles.notifBtnIcon}>🎨</Text>
        <Text style={styles.notifBtnText}>{t('profile.theme')}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['dark', 'light', 'system'] as const).map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => setTheme(opt)}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                backgroundColor: theme === opt ? colors.accent : colors.surface,
                borderWidth: 1, borderColor: theme === opt ? colors.accent : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, color: theme === opt ? colors.bg : colors.textSecondary, fontWeight: '600' }}>
                {opt === 'dark' ? 'داكن' : opt === 'light' ? 'فاتح' : 'تلقائي'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Share public profile ── */}
      <TouchableOpacity
        style={styles.notifBtn}
        onPress={() => router.push({ pathname: '/provider-profile', params: { provider_id: provider.id } })}
      >
        <Text style={styles.notifBtnIcon}>⬆️</Text>
        <Text style={styles.notifBtnText}>{t('profile.sharePublicProfile')}</Text>
        <Text style={styles.notifBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Notification settings ── */}
      <TouchableOpacity
        style={styles.notifBtn}
        onPress={() => router.push('/notification-settings')}
      >
        <Text style={styles.notifBtnIcon}>🔔</Text>
        <Text style={styles.notifBtnText}>{t('profile.notifications')}</Text>
        <Text style={styles.notifBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Sign out ── */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.signOutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const statStyles = useMemo(() => createStatStyles(colors), [colors]);
  return (
    <View style={statStyles.box}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function createStatStyles(colors: AppColors) {
  return StyleSheet.create({
    box:   { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    value: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    label: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  });
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 24 },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  heroCard:   { alignItems: 'center', paddingTop: HEADER_PAD, paddingBottom: 24, paddingHorizontal: 20 },
  avatar:     { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.bg },
  name:       { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  city:       { fontSize: 14, color: colors.textMuted, marginBottom: 12 },
  tierPill:   { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 8 },
  tierPillText:{ fontSize: 13, fontWeight: '700' },
  verifiedBadge:{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C4A6E', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  verifiedText: { fontSize: 12, color: '#7DD3FC', fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 },

  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader:{ marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  sectionEmoji: { fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', alignSelf: 'stretch' },
  sectionLink:  { fontSize: 13, color: colors.accent, fontWeight: '600', alignSelf: 'stretch', textAlign: ta },

  // ── Portfolio mini grid ──
  portfolioMiniStats: { flexDirection: 'row', gap: 16, justifyContent: 'flex-end', marginBottom: 10 },
  portfolioMiniStat:  { fontSize: 12, color: colors.textMuted },

  miniGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  miniCell:    { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface },
  miniTypeBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 },
  miniVideoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  miniAddCell: { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  miniAddIcon: { fontSize: 22, color: colors.accent, fontWeight: '700' },
  miniAddText: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  portfolioViewAll:     { marginTop: 12, alignItems: 'center' },
  portfolioViewAllText: { fontSize: 13, color: colors.accent, fontWeight: '600' },

  portfolioEmpty:       { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', gap: 6 },
  portfolioEmptyIcon:   { fontSize: 40, marginBottom: 4 },
  portfolioEmptyTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  portfolioEmptySub:    { fontSize: 12, color: colors.textMuted },
  portfolioEmptyBtn:    { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9, marginTop: 4 },
  portfolioEmptyBtnText:{ fontSize: 13, fontWeight: '700', color: colors.bg },

  // ── Loyalty ──
  loyaltyCard:   { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  loyaltyNext:   { fontSize: 13, color: colors.textSecondary, textAlign: 'auto', flex: 1 },
  loyaltyCount:  { fontSize: 13, color: colors.accent, fontWeight: '700' },
  progressBg:    { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill:  { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  loyaltyReward: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  // ── Subscription ──
  subCard:       { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  subHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subTier:       { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  subEnds:       { fontSize: 12, color: colors.textMuted },
  subPrice:      { fontSize: 22, fontWeight: '700', color: colors.accent },
  discountBanner:{ backgroundColor: colors.accentDim, borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)' },
  discountText:  { fontSize: 13, color: colors.accent, textAlign: 'center' },
  creditsBadge:     { backgroundColor: 'rgba(201,168,76,0.10)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginTop: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)' },
  creditsBadgeText: { fontSize: 13, fontWeight: '700', color: colors.accent, textAlign: 'auto' },
  winDiscountText:  { fontSize: 13, color: '#86EFAC', marginTop: 8, textAlign: 'auto' },
  repDiscountText:  { fontSize: 13, color: '#7DD3FC', marginTop: 4, textAlign: 'auto' },

  upgradeBtn:     { marginTop: 14, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg },

  noSubCard:    { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 12 },
  noSubText:    { fontSize: 14, color: colors.textMuted },
  subscribeBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  subscribeBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg },

  // ── Categories ──
  catsWrap:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:             { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  catChipSelected:     { backgroundColor: colors.accentDim, borderColor: colors.accent },
  catChipText:         { fontSize: 13, color: colors.textPrimary },
  catChipTextSelected: { color: colors.accent, fontWeight: '600' },
  maxCatsNote:         { fontSize: 11, color: colors.textMuted, textAlign: 'auto', marginTop: 6 },
  addCatsHint:         { backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center' },
  addCatsHintText:     { fontSize: 13, color: colors.textMuted },
  catGroup:            { marginBottom: 16 },
  catGroupLabel:       { fontSize: 13, color: colors.textMuted, fontWeight: '600', textAlign: 'auto', marginBottom: 8 },

  // ── Category modal ──
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  modalCancel:   { fontSize: 14, color: colors.textMuted },
  modalSave:     { fontSize: 14, fontWeight: '700', color: colors.accent },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 20 },
  modalScroll:   { paddingHorizontal: 20, paddingTop: 8 },

  notifBtn:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 8, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },
  notifBtnIcon:  { fontSize: 18 },
  notifBtnText:  { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary, textAlign: ta, alignSelf: 'stretch' },
  notifBtnArrow: { fontSize: 16, color: colors.textMuted },

  signOutBtn:  { marginHorizontal: 16, marginTop: 8, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#7F1D1D' },
  signOutText: { fontSize: 15, color: '#FCA5A5' },

  availCard:      { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  availRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  availRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  availTextWrap:  { flex: 1 },
  availLabel:     { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textAlign: ta, marginBottom: 2, alignSelf: 'stretch' },
  availSub:       { fontSize: 12, color: colors.textMuted, textAlign: ta, alignSelf: 'stretch' },
  });
}