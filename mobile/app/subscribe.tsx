// ============================================================
// WASEET — Subscription Payment Screen
// Provider-facing: plan selection → discount → checkout via Paddle
// ============================================================

import { useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Linking, Alert, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { SUBSCRIPTION_PLANS, REP_DISCOUNT } from '../src/constants/categories';
import type { Provider, User } from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

const { width } = Dimensions.get('window');

// ─── Paddle checkout URLs (fill after creating products) ─────
const PADDLE_CHECKOUT_BASE = 'https://buy.paddle.com/product/';
const PADDLE_PRICE_IDS: Record<string, string> = {
  basic:   'pri_FILL_BASIC',
  pro:     'pri_FILL_PRO',
  premium: 'pri_FILL_PREMIUM',
};

// ─── Plan config ──────────────────────────────────────────────
const PLAN_ICONS: Record<string, string>    = { trial: '🎁', basic: '🌱', pro: '🚀', premium: '👑' };
const PLAN_COLORS: Record<string, string>   = { trial: '#22C55E', basic: '#3B82F6', pro: '#F59E0B', premium: '#8B5CF6' };
const PLAN_POPULAR: Record<string, boolean> = { trial: false, basic: false, pro: true, premium: false };

// Feature rows per tier — keys reference t('subscribe.<key>')
const PLAN_FEATURE_KEYS: Record<string, { key: string; included: boolean }[]> = {
  trial: [
    { key: 'featureProfile',        included: true  },
    { key: 'featureNormalRank',     included: true  },
    { key: 'featureReplies',        included: true  },
    { key: 'featurePriorityRank',   included: false },
    { key: 'featureVerifiedBadge',  included: false },
    { key: 'featureAdvancedStats',  included: false },
  ],
  basic: [
    { key: 'featureProfile',        included: true  },
    { key: 'featureNormalRank',     included: true  },
    { key: 'featureReplies',        included: true  },
    { key: 'featurePriorityRank',   included: false },
    { key: 'featureVerifiedBadge',  included: false },
    { key: 'featureAdvancedStats',  included: false },
    { key: 'featureHomepage',       included: false },
  ],
  pro: [
    { key: 'featureProfile',        included: true  },
    { key: 'featurePriorityRank',   included: true  },
    { key: 'featureVerifiedBadge',  included: true  },
    { key: 'featureBasicStats',     included: true  },
    { key: 'featureReplies',        included: true  },
    { key: 'featureAdvancedStats',  included: false },
    { key: 'featureHomepage',       included: false },
  ],
  premium: [
    { key: 'featureProfile',         included: true },
    { key: 'featureAlwaysTop',       included: true },
    { key: 'featureVerifiedBadge',   included: true },
    { key: 'featureFullAnalytics',   included: true },
    { key: 'featureReplies',         included: true },
    { key: 'featureAdvancedStats',   included: true },
    { key: 'featureHomepage',        included: true },
  ],
};

// ─── Animated check icon ─────────────────────────────────────
function CheckIcon({ included }: { included: boolean }) {
  const { colors } = useTheme();
  const featureStyles = useMemo(() => createFeatureStyles(colors), [colors]);
  return (
    <View style={[
      featureStyles.check,
      included ? featureStyles.checkYes : featureStyles.checkNo,
    ]}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: included ? '#fff' : colors.textMuted }}>
        {included ? '✓' : '✕'}
      </Text>
    </View>
  );
}

function createFeatureStyles(colors: AppColors) {
  return StyleSheet.create({
  check:    { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  checkYes: { backgroundColor: '#22C55E' },
  checkNo:  { backgroundColor: colors.border },
  });
}

// ─── Plan Card ────────────────────────────────────────────────
function PlanCard({
  plan,
  selected,
  discount,
  anim,
  onSelect,
}: {
  plan: typeof SUBSCRIPTION_PLANS[0];
  selected: boolean;
  discount: number;
  anim: Animated.Value;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, ta, lang } = useLanguage();
  const accentColor = PLAN_COLORS[plan.tier];
  const features    = PLAN_FEATURE_KEYS[plan.tier] ?? [];
  const finalPrice  = plan.is_trial ? 0 : +(plan.price_jod * (1 - discount / 100)).toFixed(2);
  const popular     = PLAN_POPULAR[plan.tier];
  const planName    = lang === 'ar' ? plan.name_ar : (plan.name_en ?? plan.name_ar);

  const scale  = anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const shadow = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const border = selected ? accentColor : colors.border;

  return (
    <Animated.View style={[
      styles.planCard,
      {
        borderColor: border,
        borderWidth: selected ? 2 : 1,
        transform: [{ scale }],
        shadowColor: accentColor,
        shadowOpacity: selected ? 0.28 : 0,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: shadow as any,
        elevation: selected ? 8 : 0,
      },
    ]}>
      <TouchableOpacity onPress={onSelect} activeOpacity={0.88}>
        {/* Trial / Popular badge */}
        {plan.is_trial && (
          <View style={[styles.popularBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.popularText}>{t('subscribe.trialBadge')}</Text>
          </View>
        )}
        {!plan.is_trial && popular && (
          <View style={[styles.popularBadge, { backgroundColor: accentColor }]}>
            <Text style={styles.popularText}>{t('subscribe.popularBadge')}</Text>
          </View>
        )}

        {/* Plan header */}
        <View style={styles.planHeader}>
          <View style={styles.planLeft}>
            {/* Price */}
            <View style={styles.priceRow}>
              {!plan.is_trial && discount > 0 && (
                <Text style={styles.originalPrice}>{plan.price_jod} {t('common.jod')}</Text>
              )}
              <Text style={[styles.price, { color: selected ? accentColor : colors.textPrimary }]}>
                {plan.is_trial ? t('subscribe.trialBadge') : `${finalPrice} ${t('common.jod')}`}
              </Text>
              {!plan.is_trial && <Text style={styles.pricePer}>{t('subscribe.perMonth')}</Text>}
            </View>
            {/* Credits badge */}
            <Text style={[styles.creditsHint, { color: accentColor }]}>
              {plan.is_unlimited
                ? t('subscribe.unlimitedCredits')
                : t('subscribe.creditsLabel', { count: plan.bid_credits })}
            </Text>
            {plan.is_unlimited && (
              <Text style={styles.unlimitedNote}>{t('subscribe.unlimitedNote')}</Text>
            )}
            {!plan.is_trial && discount > 0 && (
              <View style={styles.discountTag}>
                <Text style={styles.discountTagText}>{t('subscribe.discountLabel', { pct: discount })}</Text>
              </View>
            )}
          </View>

          <View style={styles.planRight}>
            <Text style={styles.planIcon}>{PLAN_ICONS[plan.tier]}</Text>
            <Text style={[styles.planName, { color: selected ? accentColor : colors.textPrimary }]}>
              {planName}
            </Text>
            {/* Selection indicator */}
            <View style={[styles.selector, selected && { backgroundColor: accentColor, borderColor: accentColor }]}>
              {selected && <View style={styles.selectorDot} />}
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, selected && { backgroundColor: accentColor + '40' }]} />

        {/* Feature list */}
        <View style={styles.featureList}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <CheckIcon included={f.included} />
              <Text style={[styles.featureText, { textAlign: ta }, !f.included && styles.featureTextOff]}>
                {t(`subscribe.${f.key}` as any)}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Savings Banner ───────────────────────────────────────────
function SavingsBanner({ discount, plan }: { discount: number; plan: typeof SUBSCRIPTION_PLANS[0] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  const pulseOp = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOp, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseOp, { toValue: 0.7, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const saving = +(plan.price_jod * discount / 100).toFixed(2);

  return (
    <Animated.View style={[styles.savingsBanner, { opacity: pulseOp }]}>
      <Text style={styles.savingsIcon}>🎁</Text>
      <Text style={styles.savingsText}>
        {t('subscribe.savingsText', { pct: discount, saving })}
      </Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function SubscribeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router   = useRouter();
  const params   = useLocalSearchParams<{ tier?: string }>();
  const { t, ta, lang } = useLanguage();
  const { headerPad } = useInsets();

  const [provider, setProvider]         = useState<(Provider & { user: User }) | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>(params.tier ?? 'pro');
  const [processing, setProcessing]     = useState(false);

  // Entrance animations
  const headerOp   = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;
  const cardsOp    = useRef(new Animated.Value(0)).current;
  const cardsY     = useRef(new Animated.Value(32)).current;
  const ctaOp      = useRef(new Animated.Value(0)).current;
  const ctaY       = useRef(new Animated.Value(30)).current;

  // Per-plan selection spring
  const planAnims = useRef(
    Object.fromEntries(SUBSCRIPTION_PLANS.map(p => [p.tier, new Animated.Value(p.tier === (params.tier ?? 'pro') ? 1 : 0)]))
  ).current;

  const selectPlan = (tier: string) => {
    if (tier === selectedTier) return;
    Animated.spring(planAnims[selectedTier], { toValue: 0, useNativeDriver: false, speed: 20 }).start();
    Animated.spring(planAnims[tier],        { toValue: 1, useNativeDriver: false, tension: 120, friction: 7 }).start();
    setSelectedTier(tier);
  };

  const load = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;
    const { data } = await supabase
      .from('providers')
      .select('*, user:users(*)')
      .eq('id', authUser.id)
      .single();
    if (data) {
      setProvider(data);
      // Default to pro; if trial already used skip trial tier
      const defaultTier = data.trial_used ? 'pro' : (params.tier ?? 'pro');
      setSelectedTier(defaultTier);
    }
    setLoading(false);

    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 500, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(cardsOp, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
      Animated.timing(cardsY,  { toValue: 0, duration: 600, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(ctaOp, { toValue: 1, duration: 500, delay: 700, useNativeDriver: true }),
      Animated.timing(ctaY,  { toValue: 0, duration: 500, delay: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCheckout = async () => {
    if (!provider) return;

    // Trial: activate directly without payment
    if (selectedTier === 'trial') {
      if (provider.trial_used) {
        Alert.alert(t('common.attention'), t('subscribe.trialUsed'));
        return;
      }
      setProcessing(true);
      await supabase.rpc('activate_provider_subscription', {
        p_provider_id:   provider.id,
        p_tier:          'trial',
        p_period_months: 1,
      });
      setProcessing(false);
      Alert.alert(t('common.success'), t('subscribe.paymentSetupMsg'));
      router.back();
      return;
    }

    const priceId = PADDLE_PRICE_IDS[selectedTier];

    if (priceId.startsWith('pri_FILL')) {
      Alert.alert(
        t('subscribe.paymentSetupTitle'),
        t('subscribe.paymentSetupMsg'),
        [{ text: t('common.confirm') }]
      );
      return;
    }

    setProcessing(true);
    try {
      const repDiscount  = REP_DISCOUNT[provider.reputation_tier] ?? 0;
      const totalDiscount = Math.min(
        (provider.loyalty_discount ?? 0) + (provider.win_discount_pct ?? 0) + repDiscount,
        40
      );
      const passthrough = encodeURIComponent(JSON.stringify({
        provider_id: provider.id,
        tier:        selectedTier,
        discount:    totalDiscount,
      }));
      const url = `${PADDLE_CHECKOUT_BASE}${priceId}?passthrough=${passthrough}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('common.error'), t('subscribe.errCannotOpen'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('subscribe.errUnexpected'));
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  const repDiscount    = REP_DISCOUNT[provider?.reputation_tier ?? 'new'] ?? 0;
  const discount       = Math.min(
    (provider?.loyalty_discount ?? 0) + (provider?.win_discount_pct ?? 0) + repDiscount,
    40
  );
  const winDisc        = provider?.win_discount_pct ?? 0;
  const selectedPlan   = SUBSCRIPTION_PLANS.find(p => p.tier === selectedTier)!;
  const finalPrice     = selectedPlan?.is_trial ? 0 : +(selectedPlan.price_jod * (1 - discount / 100)).toFixed(2);
  const accentColor    = PLAN_COLORS[selectedTier];
  const selectedPlanName = lang === 'ar' ? selectedPlan.name_ar : (selectedPlan.name_en ?? selectedPlan.name_ar);
  const visiblePlans   = SUBSCRIPTION_PLANS.filter(p => !(p.is_trial && provider?.trial_used));

  const guarantees = [
    { icon: '🔒', label: t('subscribe.guaranteeSecure') },
    { icon: '↩️', label: t('subscribe.guaranteeCancel') },
    { icon: '🛡️', label: t('subscribe.guaranteeProtected') },
  ];

  const faqs = [
    { q: t('subscribe.faq1Q'), a: t('subscribe.faq1A') },
    { q: t('subscribe.faq2Q'), a: t('subscribe.faq2A') },
    { q: t('subscribe.faq3Q'), a: t('subscribe.faq3A') },
  ];

  return (
    <View style={styles.container}>
      {/* ── Fixed Header ── */}
      <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }], paddingTop: headerPad }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('subscribe.headerTitle')}</Text>
          <Text style={styles.headerSub}>{t('subscribe.headerSub')}</Text>
        </View>

        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Savings banner (only if discount > 0) ── */}
        {discount > 0 && (
          <Animated.View style={{ opacity: headerOp }}>
            <SavingsBanner discount={discount} plan={selectedPlan} />
          </Animated.View>
        )}

        {/* ── Discount breakdown banner ── */}
        {(winDisc > 0 || repDiscount > 0) && (
          <Animated.View style={[styles.discountBreakdownBanner, { opacity: headerOp }]}>
            <Text style={styles.discountBreakdownText}>
              {t('subscribe.discountBreakdown', { win: winDisc, rep: repDiscount, total: Math.min(winDisc + repDiscount + (provider?.loyalty_discount ?? 0), 40) })}
            </Text>
          </Animated.View>
        )}

        {/* ── Plan cards ── */}
        <Animated.View style={{ opacity: cardsOp, transform: [{ translateY: cardsY }] }}>
          {visiblePlans.map(plan => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              selected={selectedTier === plan.tier}
              discount={plan.is_trial ? 0 : discount}
              anim={planAnims[plan.tier] ?? new Animated.Value(plan.tier === selectedTier ? 1 : 0)}
              onSelect={() => selectPlan(plan.tier)}
            />
          ))}
        </Animated.View>

        {/* ── Guarantees ── */}
        <Animated.View style={[styles.guaranteesRow, { opacity: ctaOp }]}>
          {guarantees.map(g => (
            <View key={g.label} style={styles.guaranteeItem}>
              <Text style={styles.guaranteeIcon}>{g.icon}</Text>
              <Text style={styles.guaranteeLabel}>{g.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── FAQ ── */}
        <Animated.View style={[styles.faqSection, { opacity: ctaOp }]}>
          <Text style={[styles.faqTitle, { textAlign: ta }]}>{t('subscribe.faqTitle')}</Text>
          {faqs.map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Fixed Bottom CTA ── */}
      <Animated.View style={[styles.ctaBar, { opacity: ctaOp, transform: [{ translateY: ctaY }] }]}>
        {/* Order summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.orderLabel}>{t('subscribe.orderLabel')}</Text>
          <View style={styles.orderPriceRow}>
            {!selectedPlan?.is_trial && discount > 0 && (
              <Text style={styles.orderOriginal}>{selectedPlan.price_jod} {t('common.jod')}</Text>
            )}
            <Text style={[styles.orderPrice, { color: accentColor }]}>
              {selectedPlan?.is_trial ? t('subscribe.trialBadge') : `${finalPrice} ${t('common.jod')}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: accentColor }, processing && styles.btnDisabled]}
          onPress={handleCheckout}
          disabled={processing}
          activeOpacity={0.85}
        >
          {processing
            ? <ActivityIndicator color={colors.bg} />
            : (
              <>
                <Text style={styles.checkoutBtnText}>
                  {t('subscribe.checkoutBtn', { name: selectedPlanName })}
                </Text>
                <Text style={styles.checkoutBtnSub}>
                  {PLAN_ICONS[selectedTier]} {t('subscribe.checkoutSub')}
                </Text>
              </>
            )
          }
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { ta } = useLanguage();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.spring(anim, { toValue: open ? 0 : 1, useNativeDriver: false, speed: 18 }).start();
    setOpen(!open);
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 80] });
  const rot   = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <TouchableOpacity style={styles.faqItem} onPress={toggle} activeOpacity={0.8}>
      <View style={styles.faqRow}>
        <Animated.Text style={[styles.faqArrow, { transform: [{ rotate: rot }] }]}>▾</Animated.Text>
        <Text style={[styles.faqQ, { textAlign: ta }]}>{q}</Text>
      </View>
      <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
        <Text style={[styles.faqA, { textAlign: ta }]}>{a}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  headerSub:    { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  scrollContent: { padding: 16, paddingTop: 12 },

  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1C1A0E', borderRadius: 14,
    padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
  },
  savingsIcon: { fontSize: 22 },
  savingsText: { fontSize: 13, color: colors.accent, fontWeight: '600', flex: 1, textAlign: 'auto' },

  planCard: {
    backgroundColor: colors.surface, borderRadius: 20,
    marginBottom: 14, overflow: 'hidden',
  },
  popularBadge:  { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-end', borderBottomLeftRadius: 12 },
  popularText:   { fontSize: 11, fontWeight: '700', color: colors.bg },

  planHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', padding: 18,
  },
  planLeft:  { alignItems: 'flex-start' },
  planRight: { alignItems: 'flex-end', gap: 6 },

  planIcon: { fontSize: 28 },
  planName: { fontSize: 17, fontWeight: '700' },

  priceRow:     { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  originalPrice:{ fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  price:        { fontSize: 32, fontWeight: '800' },
  pricePer:     { fontSize: 13, color: colors.textMuted, marginBottom: 2 },

  discountTag: {
    backgroundColor: '#14532D', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  discountTagText: { fontSize: 11, fontWeight: '700', color: '#86EFAC' },

  creditsHint:   { fontSize: 13, fontWeight: '700', marginTop: 4 },
  unlimitedNote: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  discountBreakdownBanner: {
    backgroundColor: '#1C1A0E', borderRadius: 12,
    padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
  },
  discountBreakdownText: { fontSize: 12, color: colors.accent, textAlign: 'auto', fontWeight: '600' },

  selector: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  selectorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 18 },

  featureList: { padding: 18, gap: 10 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'flex-end' },
  featureText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  featureTextOff: { color: colors.textMuted },

  guaranteesRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24, marginTop: 4 },
  guaranteeItem: { alignItems: 'center', gap: 4 },
  guaranteeIcon: { fontSize: 22 },
  guaranteeLabel:{ fontSize: 11, color: colors.textMuted },

  faqSection: { gap: 0 },
  faqTitle:   { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  faqItem:    { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  faqRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ:       { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  faqArrow:   { fontSize: 16, color: colors.textMuted, marginLeft: 8 },
  faqA:       { fontSize: 12, color: colors.textMuted, lineHeight: 19, marginTop: 10 },

  ctaBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: 16, paddingBottom: 32, gap: 10,
  },
  orderSummary:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderLabel:    { fontSize: 13, color: colors.textMuted },
  orderPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  orderOriginal: { fontSize: 13, color: colors.textMuted, textDecorationLine: 'line-through' },
  orderPrice:    { fontSize: 22, fontWeight: '800' },

  checkoutBtn: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  checkoutBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  checkoutBtnSub:  { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  btnDisabled:     { opacity: 0.6 },
  });
}
