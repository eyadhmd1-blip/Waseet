// ============================================================
// WASEET — Provider Feed Screen
// Animated: staggered cards, live pulse, bid spring, locked shimmer,
//           rocket upsell bounce, score counter, header entrance
// ============================================================

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  Alert, ScrollView, Animated, Easing, Pressable, I18nManager,
  KeyboardAvoidingView, Platform, AppState, Image, Dimensions,
} from 'react-native';

const Dimensions_width  = Dimensions.get('window').width;
const Dimensions_height = Dimensions.get('window').height;
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { ALL_CATEGORIES, JORDAN_CITIES, TIER_META, CREDIT_COST, ICON_MAP, getCategoryBySlug } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { ServiceRequest, Provider, User, RecurringContract } from '../../src/types';
import { FREQ_VISITS_PER_MONTH } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { AppHeader }              from '../../src/components/AppHeader';
import { useUnreadNotifCount }   from '../../src/hooks/useUnreadNotifCount';
import { ProviderSubHeader } from '../../src/components/ProviderSubHeader';
import { calcUrgentPremium, calcContractTotal, sanitizeAmount } from '../../src/utils/pricing';
import { alignEnd, selfStart, me } from '../../src/utils/rtl';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';
import { useTutorial }   from '../../src/hooks/useTutorial';
import { TutorialTooltip } from '../tutorial/tooltip';

const CONTRACT_COLOR = '#10B981';
const CONTRACT_DIM   = '#10B98122';


type RequestWithMeta = ServiceRequest & {
  category?: { name_ar: string; name_en?: string; icon: string };
  client?: { full_name: string };
  bids_count?: { count: number }[];
};

type BidMeta = {
  amount: number;
  bidId: string;
  is_boosted: boolean;
  boost_expires_at: string | null;
};

// ─── Urgent Countdown ────────────────────────────────────────

function UrgentCountdown({ expiresAt }: { expiresAt: string }) {
  const { colors } = useTheme();
  const urgentStyles = useMemo(() => createUrgentStyles(colors), [colors]);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now())
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 10 * 60 * 1000; // < 10 min = critical

  return (
    <View style={[urgentStyles.countdownWrap, urgent && urgentStyles.countdownCritical]}>
      <Text style={[urgentStyles.countdown, urgent && urgentStyles.countdownCriticalText]}>
        ⏱️ {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
    </View>
  );
}

// ─── Boost Countdown ─────────────────────────────────────────

function BoostCountdown({ expiresAt }: { expiresAt: string }) {
  const { t } = useLanguage();
  const [rem, setRem] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const iv = setInterval(() => setRem(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 60000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (rem <= 0) return <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{t('providerFeed.boostExpired')}</Text>;

  const totalMins = Math.floor(rem / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return <Text style={{ fontSize: 11, fontWeight: '700', color: '#EAB308' }}>{t('providerFeed.boostCountdown', { time: timeStr })}</Text>;
}

function createUrgentStyles(colors: AppColors, isRTL = false) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  urgentCard:           { borderColor: '#EF4444', borderWidth: 2, backgroundColor: '#1A0808' },
  urgentTopBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  urgentBadge:          { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  urgentBadgeText:      { fontSize: 11, fontWeight: '800', color: '#fff' },
  urgentPremium:        { fontSize: 11, color: '#6EE7B7', fontWeight: '700', backgroundColor: '#064E3B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  countdownWrap:        { flexDirection: 'row', alignItems: 'center' },
  countdown:            { fontSize: 12, color: '#FCA5A5', fontWeight: '700' },
  countdownCritical:    { },
  countdownCriticalText:{ color: '#EF4444' },

  acceptBtn:      { backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  acceptBtnText:  { fontSize: 13, fontWeight: '800', color: '#fff' },

  // Accept modal
  acceptSheet:     { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  acceptTitle:     { fontSize: 20, fontWeight: '800', color: '#EF4444', textAlign: ta, marginBottom: 4 },
  acceptSubtitle:  { fontSize: 14, color: colors.textMuted, textAlign: ta, marginBottom: 20 },
  acceptRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  acceptLabel:     { fontSize: 13, color: colors.textMuted },
  acceptValue:     { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  acceptPriceTip:  { backgroundColor: '#064E3B', borderRadius: 12, padding: 14, marginTop: 16, marginBottom: 8 },
  acceptPriceTipText: { fontSize: 13, color: '#6EE7B7', textAlign: ta, lineHeight: 20 },
  acceptCommitment:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#450A0A', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 20 },
  acceptCommitText:{ fontSize: 12, color: '#FCA5A5', textAlign: ta, flex: 1, lineHeight: 18 },
  acceptBtns:      { flexDirection: 'row', gap: 12 },
  acceptCancel:    { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  acceptCancelText:{ fontSize: 15, color: colors.textSecondary },
  acceptConfirm:   { flex: 2, backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptConfirmText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
  });
}

// ─── Contract Mini Card (horizontal scroll) ──────────────────

function ContractMiniCard({
  contract,
  onPress,
}: {
  contract: RecurringContract;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const cStyles = useMemo(() => createCStyles(colors), [colors]);
  const { t, lang } = useLanguage();
  const totalVisits = FREQ_VISITS_PER_MONTH[contract.frequency] * contract.duration_months;
  const freqKey = `providerFeed.freq${contract.frequency.charAt(0).toUpperCase() + contract.frequency.slice(1)}` as any;

  return (
    <TouchableOpacity style={cStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={cStyles.badge}>
        <Text style={cStyles.badgeText}>{t('providerFeed.contractBadge')}</Text>
      </View>
      <Text style={cStyles.title} numberOfLines={2}>{contract.title}</Text>
      <Text style={cStyles.freq}>{t(freqKey)} · {t('providerFeed.contractVisitCount', { count: totalVisits })}</Text>
      <Text style={cStyles.city}>📍 {t(`cities.${contract.city}` as any, contract.city)}</Text>
      <View style={cStyles.footer}>
        <Text style={cStyles.bids}>{t('providerFeed.bidCount', { count: contract.bids_count ?? 0 })}</Text>
        <View style={cStyles.bidBtn}>
          <Text style={cStyles.bidBtnText}>{t('providerFeed.submitBid')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createCStyles(colors: AppColors) {
  return StyleSheet.create({
  card:     { width: 190, backgroundColor: CONTRACT_DIM, borderRadius: 16, padding: 14, marginEnd: 10, borderWidth: 2, borderColor: CONTRACT_COLOR },
  badge:    { backgroundColor: CONTRACT_COLOR, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  badgeText:{ fontSize: 10, fontWeight: '800', color: '#fff' },
  title:    { fontSize: 14, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 4, lineHeight: 20 },
  freq:     { fontSize: 12, color: CONTRACT_COLOR, fontWeight: '600', textAlign: 'auto', marginBottom: 4 },
  city:     { fontSize: 12, color: colors.textMuted, textAlign: 'auto', marginBottom: 10 },
  footer:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bids:     { fontSize: 11, color: colors.textMuted },
  bidBtn:   { backgroundColor: CONTRACT_COLOR, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  bidBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  });
}

// ─── Live Indicator ──────────────────────────────────────────

function LiveDot() {
  const scale   = useRef(new Animated.Value(1)).current;
  const op      = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
          Animated.timing(op,    { toValue: 0,   duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1,   duration: 0, useNativeDriver: true }),
          Animated.timing(op,    { toValue: 1,   duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(900),
      ])
    );
    loopRef.current.start();
    return () => { loopRef.current?.stop(); };
  }, []);

  return (
    <View style={liveDotStyles.wrap}>
      <Animated.View style={[liveDotStyles.ring, { transform: [{ scale }], opacity: op }]} />
      <View style={liveDotStyles.dot} />
    </View>
  );
}

const liveDotStyles = StyleSheet.create({
  wrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginStart: 6 },
  dot:  { width: 7,  height: 7,  borderRadius: 3.5, backgroundColor: '#22C55E', position: 'absolute' },
  ring: { width: 13, height: 13, borderRadius: 7,   borderWidth: 1.5, borderColor: '#22C55E', position: 'absolute' },
});

// ─── Locked Card Shimmer ─────────────────────────────────────

function LockedShimmer() {
  const x       = useRef(new Animated.Value(-100)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 340, duration: 1600,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(x, { toValue: -100, duration: 0, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    );
    loopRef.current.start();
    return () => { loopRef.current?.stop(); };
  }, []);

  return (
    <View style={shimmerStyles.container} pointerEvents="none">
      <Animated.View style={[shimmerStyles.sweep, { transform: [{ translateX: x }] }]} />
    </View>
  );
}

const shimmerStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, borderRadius: 16, overflow: 'hidden' },
  sweep: {
    position: 'absolute', top: 0, bottom: 0, width: 70,
    backgroundColor: 'rgba(201,168,76,0.07)',
    transform: [{ skewX: '-20deg' }],
  },
});

// ─── New Badge Pulse ─────────────────────────────────────────

function NewBadge() {
  const { t }   = useLanguage();
  const scale   = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 500, useNativeDriver: true }),
        Animated.delay(1500),
      ])
    );
    loopRef.current.start();
    return () => { loopRef.current?.stop(); };
  }, []);

  return (
    <Animated.View style={[newBadgeStyles.badge, { transform: [{ scale }] }]}>
      <Text style={newBadgeStyles.text}>{t('providerFeed.newBadge')}</Text>
    </Animated.View>
  );
}

const newBadgeStyles = StyleSheet.create({
  badge: {
    backgroundColor: '#16A34A', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  text: { fontSize: 10, fontWeight: '700', color: '#fff' },
});

// ─── Animated Bid Button ──────────────────────────────────────

function BidButton({
  locked,
  onPress,
}: {
  locked: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.87, useNativeDriver: true, speed: 60 }),
      Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, speed: 25, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1.00, useNativeDriver: true, speed: 30 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.bidBtn, locked && styles.bidBtnLocked]}
        onPress={handlePress}
        activeOpacity={1}
      >
        <Text style={[styles.bidBtnText, locked && styles.bidBtnTextLocked]}>
          {locked ? t('providerFeed.bidBtnLocked') : t('providerFeed.bidBtn')}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Rocket Upsell Modal ─────────────────────────────────────

function UpsellModal({
  visible,
  onClose,
  onSubscribe,
}: {
  visible: boolean;
  onClose: () => void;
  onSubscribe: (tier: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);
  const rocketY   = useRef(new Animated.Value(0)).current;
  const sheetY    = useRef(new Animated.Value(500)).current;
  const sheetOp   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      sheetY.setValue(500);
      sheetOp.setValue(0);
      rocketY.setValue(0);

      Animated.parallel([
        Animated.spring(sheetY, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
        Animated.timing(sheetOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        // Rocket hover loop
        Animated.loop(
          Animated.sequence([
            Animated.timing(rocketY, { toValue: -10, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(rocketY, { toValue:   0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      rocketY.stopAnimation();
    }
  }, [visible]);

  const { contentPad: upsellContentPad } = useInsets();
  if (!visible) return null;

  const plans = [
    { tier: 'basic',   price: '5 د.أ',  label: t('providerFeed.upsellPlanBasic'),   detail: t('providerFeed.upsellPlanBasicDetail') },
    { tier: 'pro',     price: '12 د.أ', label: t('providerFeed.upsellPlanPro'),     detail: t('providerFeed.upsellPlanProDetail'),   highlight: true },
    { tier: 'premium', price: '22 د.أ', label: t('providerFeed.upsellPlanPremium'), detail: t('providerFeed.upsellPlanPremiumDetail') },
  ];

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.upsellSheet,
            { opacity: sheetOp, transform: [{ translateY: sheetY }], paddingBottom: upsellContentPad },
          ]}
        >
          <Animated.Text
            style={[styles.upsellIcon, { transform: [{ translateY: rocketY }] }]}
          >
            🚀
          </Animated.Text>
          <Text style={styles.upsellTitle}>{t('providerFeed.upsellTitle')}</Text>
          <Text style={styles.upsellSub}>{t('providerFeed.upsellSub')}</Text>

          <View style={styles.planRow}>
            {plans.map(p => (
              <TouchableOpacity
                key={p.tier}
                style={[styles.planCard, p.highlight && styles.planCardHighlight]}
                activeOpacity={0.8}
                onPress={() => onSubscribe(p.tier)}
              >
                {p.highlight && <Text style={styles.planBestTag}>{t('providerFeed.upsellBestTag')}</Text>}
                <Text style={styles.planPrice}>{p.price}</Text>
                <Text style={styles.planLabel}>{p.label}</Text>
                <Text style={styles.planDetail}>{p.detail}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.upsellCloseBtn} onPress={onClose}>
            <Text style={styles.upsellCloseBtnText}>{t('providerFeed.upsellClose')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Request Card ─────────────────────────────────────────────

function RequestCard({
  item,
  index,
  isLocked,
  myBidMeta,
  entranceAnim,
  onBidPress,
  onUrgentAccept,
  onBoostPress,
  onDetailPress,
}: {
  item: RequestWithMeta;
  index: number;
  isLocked: boolean;
  myBidMeta?: BidMeta;
  entranceAnim: Animated.Value;
  onBidPress: () => void;
  onUrgentAccept: () => void;
  onBoostPress?: () => void;
  onDetailPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t, lang, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);
  const urgentStyles = useMemo(() => createUrgentStyles(colors, isRTL), [colors, isRTL]);
  const bidsCount     = item.bids_count?.[0]?.count ?? 0;
  const isNew         = Date.now() - new Date(item.created_at).getTime() < 60 * 60 * 1000;
  const isUrgent      = !!item.is_urgent;
  const locale        = lang === 'ar' ? 'ar-JO' : 'en-GB';

  // Bidding window countdown
  const biddingEndsLabel = useMemo(() => {
    if (!item.bidding_ends_at) return null;
    const msLeft = new Date(item.bidding_ends_at).getTime() - Date.now();
    if (msLeft <= 0) return t('requests.biddingClosed');
    const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));
    const minsLeft  = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
    const timeStr   = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;
    return t('requests.biddingEndsIn', { time: timeStr });
  }, [item.bidding_ends_at]);

  const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  return (
    <Animated.View style={{ opacity: entranceAnim, transform: [{ translateY }] }}>
      <Pressable onPress={onDetailPress} style={[styles.card, isLocked && styles.cardLocked, isUrgent && urgentStyles.urgentCard]}>
        {isLocked && index <= 3 && <LockedShimmer />}

        {/* Urgent top bar */}
        {isUrgent && (
          <View style={urgentStyles.urgentTopBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.urgent_expires_at && (
                <UrgentCountdown expiresAt={item.urgent_expires_at} />
              )}
              <Text style={urgentStyles.urgentPremium}>
                {t('providerFeed.urgentPremium', { pct: item.urgent_premium_pct ?? 25 })}
              </Text>
            </View>
            <View style={urgentStyles.urgentBadge}>
              <Text style={urgentStyles.urgentBadgeText}>{t('providerFeed.urgentBadge')}</Text>
            </View>
          </View>
        )}

        {/* Submitted bid banner + boost CTA */}
        {myBidMeta !== undefined && (
          <View style={styles.submittedBanner}>
            <Text style={styles.submittedBannerText}>
              {t('providerFeed.submittedBanner', { amount: myBidMeta.amount })}
            </Text>
            {myBidMeta.is_boosted && myBidMeta.boost_expires_at &&
             new Date(myBidMeta.boost_expires_at) > new Date() ? (
              <BoostCountdown expiresAt={myBidMeta.boost_expires_at} />
            ) : !myBidMeta.is_boosted ? (
              <TouchableOpacity style={styles.boostBannerBtn} onPress={onBoostPress} activeOpacity={0.8}>
                <Text style={styles.boostBannerBtnText}>{t('providerFeed.boostBtn')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Category + time + new badge */}
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isNew && !isUrgent && <NewBadge />}
            <Text style={styles.cardTime}>
              {new Date(item.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <Text style={styles.cardCat}>
            {ICON_MAP[item.category?.icon ?? ''] ?? '🔧'}{' '}
            {lang === 'ar'
              ? (item.category?.name_ar ?? item.category_slug)
              : (item.category?.name_en ?? item.category?.name_ar ?? item.category_slug)}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle}>{item.title}</Text>

        {/* Courier route — pickup → dropoff */}
        {item.category_slug === 'courier' && (item as any).pickup_address && (
          <View style={styles.courierRoute}>
            <Text style={styles.courierRouteText} numberOfLines={1}>
              📍 {(item as any).pickup_address}
            </Text>
            <Text style={styles.courierArrow}>↓</Text>
            <Text style={styles.courierRouteText} numberOfLines={1}>
              📌 {(item as any).dropoff_address}
            </Text>
          </View>
        )}

        {/* Description — obscured if locked */}
        {isLocked ? (
          <View style={styles.blurContainer}>
            <Text style={styles.blurText} numberOfLines={2}>{item.description}</Text>
            <View style={styles.blurOverlay} />
          </View>
        ) : (
          <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardCity} numberOfLines={1}>📍 {t(`cities.${item.city}` as any, item.city)}</Text>
            {bidsCount > 0 && !isUrgent && (
              <Text style={styles.bidsCount} numberOfLines={1}>{t('providerFeed.bidCount', { count: bidsCount })}</Text>
            )}
            {biddingEndsLabel && !isUrgent && (
              <Text style={styles.biddingEnds} numberOfLines={1}>⏱ {biddingEndsLabel}</Text>
            )}
          </View>

          {item.ai_suggested_price_min && item.ai_suggested_price_max && !isUrgent && (
            <View>
              <Text style={styles.aiPriceTag}>✨ {isRTL ? 'توقع ذ.ا' : 'AI Est.'}</Text>
              <Text style={styles.aiPrice}>
                {item.ai_suggested_price_min}–{item.ai_suggested_price_max} د.أ
              </Text>
            </View>
          )}

          {myBidMeta !== undefined ? (
            <View style={styles.submittedChip}>
              <Text style={styles.submittedChipText}>{t('providerFeed.submittedChip')}</Text>
            </View>
          ) : isUrgent ? (
            <TouchableOpacity style={urgentStyles.acceptBtn} onPress={onUrgentAccept}>
              <Text style={urgentStyles.acceptBtnText}>{t('providerFeed.acceptUrgent')}</Text>
            </TouchableOpacity>
          ) : (
            <BidButton locked={isLocked} onPress={onBidPress} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Demo Request Colors ──────────────────────────────────────

const DEMO_COLOR   = '#6366F1'; // indigo — exclusive to demo
const DEMO_DIM     = '#1E1B4B';
const DEMO_BORDER  = '#4338CA';
const DEMO_SOFT    = '#312E81';
const DEMO_TEXT    = '#A5B4FC';

// ─── DemoRequestCard ─────────────────────────────────────────

type DemoStatus = {
  status: 'pending' | 'submitted' | 'expired';
  expires_at?: string;
  bid_amount?: number;
  request?: {
    id: string; title: string; description: string;
    city: string; district?: string; category_slug: string; is_urgent: boolean;
  };
};

function DemoRequestCard({
  demo,
  onBidPress,
  onSkip,
}: {
  demo: DemoStatus;
  onBidPress: () => void;
  onSkip: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t, ta, isRTL, lang } = useLanguage();
  const demoStyles = useMemo(() => createDemoStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);

  if (demo.status === 'submitted') {
    return (
      <View style={demoStyles.cardCompleted}>
        <View style={demoStyles.completedRow}>
          <Text style={demoStyles.completedBadge}>{t('providerFeed.demoCompletedBadge')}</Text>
          <Text style={demoStyles.completedBadgeDot}>🎯 {t('providerFeed.demoBadge')}</Text>
        </View>
        <Text style={demoStyles.completedBid}>
          {t('providerFeed.demoCompletedBid', { amount: demo.bid_amount })}
        </Text>
        <TouchableOpacity style={demoStyles.realCTABtn} onPress={onSkip}>
          <Text style={demoStyles.realCTAText}>{t('providerFeed.demoRealCTA')} {isRTL ? '←' : '→'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const req = demo.request!;
  const reqCat  = getCategoryBySlug(req.category_slug);
  const reqIcon = ICON_MAP[reqCat?.icon ?? ''] ?? '🔧';

  return (
    <View style={demoStyles.card}>
      {/* Top badge row */}
      <View style={demoStyles.topRow}>
        <TouchableOpacity onPress={onSkip}>
          <Text style={demoStyles.skipText}>{t('providerFeed.demoSkip')}</Text>
        </TouchableOpacity>
        <View style={demoStyles.badge}>
          <Text style={demoStyles.badgeText}>🎯 {t('providerFeed.demoBadge')}</Text>
        </View>
      </View>

      {/* Request info */}
      <Text style={demoStyles.title}>{req.title}</Text>
      <Text style={demoStyles.desc} numberOfLines={2}>{req.description}</Text>

      <View style={demoStyles.metaRow}>
        <Text style={demoStyles.metaText}>📍 {t(`cities.${req.city}` as any, req.city)}{req.district ? ` — ${req.district}` : ''}</Text>
        <Text style={demoStyles.metaText}>
          {reqIcon} {(lang === 'ar' ? reqCat?.name_ar : reqCat?.name_en) ?? reqCat?.name_ar ?? req.category_slug}
        </Text>
      </View>

      {/* Info box */}
      <View style={demoStyles.infoBox}>
        <Text style={demoStyles.infoText}>
          ℹ️  {t('providerFeed.demoInfoBox')}
        </Text>
        <Text style={demoStyles.freeNote}>✓ {t('providerFeed.demoFreeNote')}</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity style={demoStyles.bidBtn} onPress={onBidPress} activeOpacity={0.85}>
        <Text style={demoStyles.bidBtnText}>{t('providerFeed.demoBidBtn')} {isRTL ? '←' : '→'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createDemoStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginBottom: 0,
    padding: 16, borderWidth: 1.5, borderColor: DEMO_COLOR,
  },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge:       { backgroundColor: DEMO_COLOR, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  skipText:    { fontSize: 12, color: colors.textSecondary },
  title:       { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 6, textAlign: ta },
  desc:        { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 10, textAlign: ta },
  metaRow:     { flexDirection: 'row', gap: 14, marginBottom: 12 },
  metaText:    { fontSize: 12, color: colors.textMuted },
  infoBox: {
    backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: DEMO_COLOR,
  },
  infoText:    { fontSize: 12, color: isDark ? DEMO_TEXT : DEMO_BORDER, lineHeight: 18, marginBottom: 4, textAlign: ta },
  freeNote:    { fontSize: 12, color: isDark ? '#6EE7B7' : '#16A34A', fontWeight: '700' },
  bidBtn:      { backgroundColor: DEMO_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  bidBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Completed state
  cardCompleted: {
    backgroundColor: colors.surface, borderRadius: 16, margin: 16, marginBottom: 0,
    padding: 14, borderWidth: 1, borderColor: '#16A34A', opacity: 0.85,
  },
  completedRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  completedBadge: { fontSize: 11, color: isDark ? '#6EE7B7' : '#16A34A', fontWeight: '700' },
  completedBadgeDot: { fontSize: 11, color: colors.textMuted },
  completedBid:   { fontSize: 13, color: isDark ? '#6EE7B7' : '#16A34A', marginBottom: 10, textAlign: ta },
  realCTABtn:     { borderWidth: 1, borderColor: DEMO_COLOR, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  realCTAText:    { fontSize: 13, color: DEMO_COLOR, fontWeight: '600' },
  });
}

// ─── Demo Success Modal ───────────────────────────────────────

function DemoSuccessModal({
  visible, credits, onClose,
}: { visible: boolean; credits: number; onClose: () => void }) {
  const { colors } = useTheme();
  const { t, ta, isRTL } = useLanguage();
  const demoSuccessStyles = useMemo(() => createDemoSuccessStyles(colors, isRTL), [colors, isRTL]);
  const steps = [
    t('providerFeed.demoSuccessStep1'),
    t('providerFeed.demoSuccessStep2'),
    t('providerFeed.demoSuccessStep3'),
    t('providerFeed.demoSuccessStep4'),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={demoSuccessStyles.overlay}>
        <View style={demoSuccessStyles.sheet}>
          <Text style={demoSuccessStyles.emoji}>🎉</Text>
          <Text style={demoSuccessStyles.title}>{t('providerFeed.demoSuccessTitle')}</Text>

          <View style={demoSuccessStyles.stepsBox}>
            <Text style={demoSuccessStyles.stepsTitle}>{t('providerFeed.demoHowItWorks')}</Text>
            {steps.map((s, i) => (
              <View key={i} style={[demoSuccessStyles.stepRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={demoSuccessStyles.stepNum}>{i + 1}.</Text>
                <Text style={demoSuccessStyles.step}>{s}</Text>
              </View>
            ))}
          </View>

          <View style={demoSuccessStyles.creditsBox}>
            <Text style={demoSuccessStyles.creditsText}>
              ✅ {t('providerFeed.demoSuccessCredits', { count: credits })}
            </Text>
          </View>

          <TouchableOpacity style={demoSuccessStyles.ctaBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={demoSuccessStyles.ctaBtnText}>{t('providerFeed.demoSuccessCTA')} {isRTL ? '←' : '→'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createDemoSuccessStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    sheet:       { backgroundColor: colors.bg, borderRadius: 20, padding: 28, width: '100%', borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    emoji:       { fontSize: 56, marginBottom: 16 },
    title:       { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 20, width: '100%', textAlign: ta },
    stepsBox:    { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, width: '100%' },
    stepsTitle:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, width: '100%', textAlign: ta },
    stepRow:     { alignItems: 'flex-start', gap: 6, marginBottom: 2 },
    stepNum:     { fontSize: 13, color: colors.accent, fontWeight: '700', lineHeight: 22, minWidth: 20 },
    step:        { fontSize: 13, color: colors.textSecondary, lineHeight: 22, flex: 1, textAlign: ta },
    creditsBox:  { backgroundColor: colors.successBg, borderRadius: 10, padding: 12, marginBottom: 20, width: '100%', borderWidth: 1, borderColor: colors.success },
    creditsText: { fontSize: 13, color: colors.successSoft, width: '100%', textAlign: ta },
    ctaBtn:      { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
    ctaBtnText:  { fontSize: 16, fontWeight: '700', color: colors.bg },
  });
}

// ─── Empty Feed State ─────────────────────────────────────────

function createEmptyStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    wrap:             { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

    hero:             { alignItems: 'center', marginBottom: 20 },
    heroEmoji:        { fontSize: 52, marginBottom: 10 },
    heroTitle:        { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4, textAlign: ta },
    heroSub:          { fontSize: 13, color: colors.textMuted, lineHeight: 20, textAlign: ta },

    stepsCard:        { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 14, overflow: 'hidden' },
    stepRow:          { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    stepRowBorder:    { borderBottomWidth: 1, borderBottomColor: colors.border },
    stepNum:          { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    stepNumDone:      { backgroundColor: '#10B981' },
    stepNumText:      { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    stepNumTextDone:  { color: '#fff' },
    stepInfo:         { flex: 1 },
    stepLabel:        { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 1, textAlign: ta },
    stepLabelDone:    { color: colors.textMuted },
    stepSub:          { fontSize: 11, color: colors.textMuted, textAlign: ta },
    stepBtn:          { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
    stepBtnText:      { fontSize: 11, fontWeight: '700', color: colors.bg },
    stepArrow:        { fontSize: 14, color: colors.border },

    tipCard:          { backgroundColor: 'rgba(201,168,76,0.07)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,168,76,0.22)', padding: 14 },
    tipHeader:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    tipTitle:         { fontSize: 13, fontWeight: '700', color: colors.accent },
    tipText:          { fontSize: 12, color: colors.textSecondary, lineHeight: 19, textAlign: ta },
    tipHighlight:     { fontWeight: '700', color: colors.accent },

    noReqWrap:        { alignItems: 'center', paddingTop: 48, paddingHorizontal: 28, paddingBottom: 32 },
    noReqIcon:        { fontSize: 52, marginBottom: 14 },
    noReqTitle:       { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    noReqSub:         { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
    noReqCard:        { backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: colors.border },
    noReqCardTitle:   { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 6, textAlign: ta },
    noReqCardText:    { fontSize: 12, color: colors.textMuted, lineHeight: 19, marginBottom: 12, textAlign: ta },
    noReqCardBtn:     { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    noReqCardBtnText: { fontSize: 12, fontWeight: '700', color: colors.bg },
  });
}

function EmptyFeedState({
  provider,
  portfolioCount,
  isRTL,
  ta,
  onSubscribe,
  onProfile,
}: {
  provider: (Provider & { user: User }) | null;
  portfolioCount: number;
  isRTL: boolean;
  ta: 'left' | 'right';
  onSubscribe: () => void;
  onProfile: () => void;
}) {
  const { colors } = useTheme();
  const { t }      = useLanguage();
  const s = useMemo(() => createEmptyStyles(colors, isRTL), [colors, isRTL]);

  const isNew        = (provider?.lifetime_jobs ?? 0) === 0;
  const hasCredits   = (provider?.subscription_tier === 'premium' ||
    !!(provider?.is_subscribed && ((provider.subscription_credits ?? 0) + (provider.bonus_credits ?? 0)) > 0));
  const hasBio       = !!(provider?.bio?.trim());
  const hasPortfolio = portfolioCount > 0 || (provider?.portfolio_urls?.length ?? 0) > 0;
  const profileOk    = hasPortfolio;

  if (!isNew) {
    return (
      <View style={s.noReqWrap}>
        <Text style={s.noReqIcon}>🔭</Text>
        <Text style={s.noReqTitle}>{t('providerFeed.emptyTitle')}</Text>
        <Text style={s.noReqSub}>{t('providerFeed.emptyDesc')}</Text>
        <View style={s.noReqCard}>
          <Text style={s.noReqCardTitle}>{t('providerFeed.emptyTipTitle')}</Text>
          <Text style={s.noReqCardText}>{t('providerFeed.emptyTipText')}</Text>
          <TouchableOpacity style={s.noReqCardBtn} onPress={onProfile} activeOpacity={0.85}>
            <Text style={s.noReqCardBtnText}>{t('providerFeed.emptyTipBtn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const creditsCount = (provider?.subscription_credits ?? 0) + (provider?.bonus_credits ?? 0);
  const steps: { label: string; sub: string; done: boolean; action: (() => void) | null; actionLabel: string }[] = [
    {
      label:       t('providerFeed.step1Label'),
      sub:         t('providerFeed.step1Sub'),
      done:        true,
      action:      null,
      actionLabel: '',
    },
    {
      label:       t('providerFeed.step2Label'),
      sub:         hasCredits ? t('providerFeed.step2SubDone', { count: creditsCount }) : t('providerFeed.step2Sub'),
      done:        hasCredits,
      action:      hasCredits ? null : onSubscribe,
      actionLabel: t('providerFeed.step2Action'),
    },
    {
      label:       t('providerFeed.step3Label'),
      sub:         profileOk ? t('providerFeed.step3SubDone') : t('providerFeed.step3Sub'),
      done:        profileOk,
      action:      profileOk ? null : onProfile,
      actionLabel: t('providerFeed.step3Action'),
    },
    {
      label:       t('providerFeed.step4Label'),
      sub:         t('providerFeed.step4Sub'),
      done:        false,
      action:      null,
      actionLabel: '',
    },
  ];

  return (
    <View style={s.wrap}>
      <View style={s.hero}>
        <Text style={s.heroEmoji}>🚀</Text>
        <Text style={s.heroTitle}>{t('providerFeed.heroTitle')}</Text>
        <Text style={s.heroSub}>{t('providerFeed.heroSub')}</Text>
      </View>

      <View style={s.stepsCard}>
        {steps.map((step, i) => (
          <View key={i} style={[s.stepRow, i < steps.length - 1 && s.stepRowBorder]}>
            <View style={[s.stepNum, step.done && s.stepNumDone]}>
              <Text style={[s.stepNumText, step.done && s.stepNumTextDone]}>
                {step.done ? '✓' : i + 1}
              </Text>
            </View>
            <View style={s.stepInfo}>
              <Text style={s.stepLabel}>{step.label}</Text>
              <Text style={s.stepSub}>{step.sub}</Text>
            </View>
            {step.action ? (
              <TouchableOpacity style={s.stepBtn} onPress={step.action} activeOpacity={0.85}>
                <Text style={s.stepBtnText}>{step.actionLabel}</Text>
              </TouchableOpacity>
            ) : !step.done ? (
              <Text style={s.stepArrow}>{isRTL ? '◁' : '▷'}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View style={s.tipCard}>
        <View style={s.tipHeader}>
          <Text style={{ fontSize: 18 }}>💡</Text>
          <Text style={s.tipTitle}>{t('providerFeed.tipTitle')}</Text>
        </View>
        <Text style={s.tipText}>
          {t('providerFeed.tipTextPre')}{' '}
          <Text style={s.tipHighlight}>{t('providerFeed.tipHighlight')}</Text>
          {'. '}{t('providerFeed.tipTextSuffix')}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

const MAX_CARDS = 30;

export default function ProviderFeed() {
  const { colors, isDark } = useTheme();
  const { t, ta, lang, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);
  const urgentStyles = useMemo(() => createUrgentStyles(colors, isRTL), [colors, isRTL]);
  const demoBidStyles = useMemo(() => createDemoBidStyles(colors, isRTL), [colors, isRTL]);
  const cBidStyles = useMemo(() => createCBidStyles(colors, isRTL), [colors, isRTL]);
  const { contentPad } = useInsets();
  const router = useRouter();
  const { count: notifCount } = useUnreadNotifCount();
  const [provider, setProvider]   = useState<(Provider & { user: User }) | null>(null);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [requests, setRequests]   = useState<RequestWithMeta[]>([]);
  // Map<request_id, BidMeta> — tracks every request this provider has already bid on
  const [myBidAmounts, setMyBidAmounts] = useState<Map<string, BidMeta>>(new Map());
  const [boostModal, setBoostModal] = useState<{ bidMeta: BidMeta; requestId: string } | null>(null);
  const [boosting, setBoosting] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter] = useState<string>('all');

  // Demo request
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [demoSuccess, setDemoSuccess] = useState(false);

  // Grouped: demo bid modal state
  const [demoModal, setDemoModal] = useState({ open: false, amount: '', note: '', loading: false });
  const [bidAmountError,      setBidAmountError]      = useState(false);
  const [bidNoteError,        setBidNoteError]         = useState(false);
  const [contractAmountError, setContractAmountError] = useState(false);
  const [contractNoteError,   setContractNoteError]   = useState(false);
  const [demoAmountError,     setDemoAmountError]     = useState(false);

  // Grouped: bid modal state
  const [bidModal, setBidModal] = useState<{
    target: RequestWithMeta | null; amount: string; note: string; loading: boolean;
  }>({ target: null, amount: '', note: '', loading: false });

  // Grouped: urgent accept modal state
  const [urgentModal, setUrgentModal] = useState<{
    target: RequestWithMeta | null; loading: boolean;
  }>({ target: null, loading: false });

  const [showUpsell, setShowUpsell] = useState(false);

  // Recurring contracts
  const [contracts, setContracts] = useState<RecurringContract[]>([]);

  // Grouped: contract bid modal state
  const [contractModal, setContractModal] = useState<{
    target: RecurringContract | null; amount: string; note: string; loading: boolean;
  }>({ target: null, amount: '', note: '', loading: false });

  // Request detail bottom sheet
  const [detailSheet, setDetailSheet] = useState<RequestWithMeta | null>(null);
  const [imageViewer, setImageViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const imageScrollRef = useRef<ScrollView>(null);

  // Scroll to the tapped image after the modal mounts
  // contentOffset is ignored on Android — ref.scrollTo is reliable
  useEffect(() => {
    if (!imageViewer || imageViewer.index === 0) return;
    const t = setTimeout(() => {
      imageScrollRef.current?.scrollTo({ x: imageViewer.index * Dimensions_width, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, [imageViewer]);

  // Pending job commitment (bid accepted by client, provider must confirm)
  const [pendingCommit, setPendingCommit] = useState<{
    job_id: string; title: string; is_urgent: boolean;
  } | null>(null);

  // Entrance anims
  const headerOp     = useRef(new Animated.Value(0)).current;
  const headerY      = useRef(new Animated.Value(-20)).current;
  const filterOp     = useRef(new Animated.Value(0)).current;

  // Dynamic card anim pool — only allocates Animated.Values for actual cards shown
  const cardAnimsRef = useRef<Animated.Value[]>([]);

  const getCardAnim = (index: number): Animated.Value => {
    if (!cardAnimsRef.current[index]) {
      cardAnimsRef.current[index] = new Animated.Value(0);
    }
    return cardAnimsRef.current[index];
  };

  const runEntranceAnims = (count: number) => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 500, delay: 50, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 500, delay: 50,
        easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(filterOp, { toValue: 1, duration: 400, delay: 250, useNativeDriver: true }),
    ]).start();

    const n = Math.min(count, MAX_CARDS);
    const anims = Array.from({ length: n }, (_, i) => {
      const a = getCardAnim(i);
      a.setValue(0);
      return a;
    });
    Animated.stagger(
      40,
      anims.map(a => Animated.spring(a, { toValue: 1, tension: 90, friction: 10, useNativeDriver: true }))
    ).start();
  };

  // Cleanup: stop all animations and release on unmount
  useEffect(() => () => {
    cardAnimsRef.current.forEach(a => a.stopAnimation());
    cardAnimsRef.current = [];
  }, []);

  // Pause card entrance animations when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        cardAnimsRef.current.forEach(a => a.stopAnimation());
      }
    });
    return () => sub.remove();
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser) { setLoading(false); return; }

      // All five queries run in parallel — no waterfall
      const [
        { data: providerData },
        { data: requestsData },
        { data: contractsData },
        { data: demoData },
        { data: myBidsData },
        { count: portfolioItemCount },
      ] = await Promise.all([
        supabase.from('providers').select('*, user:users(*)').eq('id', authUser.id).single(),
        supabase
          .from('requests')
          .select('*, category:service_categories(name_ar, name_en, icon), bids_count:bids(count)')
          .eq('status', 'open')
          .order('is_urgent',  { ascending: false })
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('public_contract_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.rpc('get_provider_demo', { p_provider_id: authUser.id }),
        supabase.from('bids').select('id, request_id, amount, is_boosted, boost_expires_at').eq('provider_id', authUser.id).eq('status', 'pending'),
        supabase.from('portfolio_items').select('*', { count: 'exact', head: true }).eq('provider_id', authUser.id),
      ]);

      if (providerData)  setProvider(providerData);
      setPortfolioCount(portfolioItemCount ?? 0);
      if (requestsData) {
        // Deduplicate by id — guards against PostgREST returning duplicate rows
        // when bids_count join produces multiple matching rows per request
        const seen = new Set<string>();
        setRequests(requestsData.filter((r: any) => !seen.has(r.id) && seen.add(r.id)));
      }
      if (contractsData) setContracts(contractsData as RecurringContract[]);
      if (demoData)      setDemoStatus(demoData as DemoStatus);
      if (myBidsData)    setMyBidAmounts(new Map(myBidsData.map((b: any) => [b.request_id, { amount: b.amount, bidId: b.id, is_boosted: b.is_boosted, boost_expires_at: b.boost_expires_at }])));

      runEntranceAnims(requestsData?.length ?? 0);
  
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh portfolioCount when screen regains focus (e.g. after adding portfolio item)
  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('portfolio_items')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', user.id)
        .then(({ count }) => { if (count !== null) setPortfolioCount(count); });
    });
  }, []));

  // Safety net: if load() hangs for any reason, clear the spinner after 12 s
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(t);
  }, []);

  // ── Tutorial tooltip: credits badge shown once after first load ──
  const { ready: tutReady, isTooltipSeen, markTooltip } = useTutorial('provider');
  const [showCreditsTooltip, setShowCreditsTooltip] = useState(false);

  useEffect(() => {
    if (!tutReady || loading) return;
    if (isTooltipSeen('credits')) return;
    const tid = setTimeout(() => setShowCreditsTooltip(true), 1500);
    return () => clearTimeout(tid);
  }, [tutReady, loading, isTooltipSeen]);

  // ── Realtime: detect incoming job commitment request ─────────
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return;

      // On mount: check for any existing pending commit (JOIN avoids N+1)
      const { data } = await supabase
        .from('jobs')
        .select('id, request:requests(title, is_urgent)')
        .eq('provider_id', user.id)
        .eq('status', 'active')
        .is('provider_committed_at', null)
        .eq('provider_declined', false)
        .gt('provider_commit_deadline', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const req = (data as any).request ?? {};
        setPendingCommit({ job_id: data.id, title: req.title ?? 'طلب', is_urgent: !!req.is_urgent });
      }

      // Guard against StrictMode double-mount: remove stale channel before creating
      const staleJobs = supabase.getChannels().find(ch => ch.topic === `realtime:provider_jobs:${user.id}`);
      if (staleJobs) await supabase.removeChannel(staleJobs);

      // Realtime: JOIN included in SELECT so no secondary fetch per INSERT
      channel = supabase
        .channel(`provider_jobs:${user.id}`)
        .on('postgres_changes', {
          event:  'INSERT',
          schema: 'public',
          table:  'jobs',
          filter: `provider_id=eq.${user.id}`,
        }, async (payload) => {
          // Fetch title+is_urgent in a single targeted query (payload lacks joined fields)
          const { data: req } = await supabase
            .from('requests')
            .select('title, is_urgent')
            .eq('id', payload.new.request_id)
            .single();
          setPendingCommit({
            job_id:    payload.new.id,
            title:     req?.title ?? 'طلب',
            is_urgent: !!req?.is_urgent,
          });
        })
        .subscribe();
    };

    setup().catch(() => {});
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // ── Clear banner when returning from provider-confirm ────────
  // Realtime only fires on INSERT; UPDATE (confirm/decline) doesn't clear it.
  // Re-check on every focus so banner disappears after provider acts.
  useFocusEffect(useCallback(() => {
    if (!pendingCommit) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('jobs')
        .select('id')
        .eq('id', pendingCommit.job_id)
        .is('provider_committed_at', null)
        .eq('provider_declined', false)
        .gt('provider_commit_deadline', new Date().toISOString())
        .maybeSingle()
        .then(({ data }) => { if (!data) setPendingCommit(null); });
    });
  }, [pendingCommit?.job_id]));

  // ── Realtime: sync provider profile changes (credits, subscription) ──
  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Guard against StrictMode double-mount: remove stale channel before creating
      const staleProfile = supabase.getChannels().find(ch => ch.topic === `realtime:provider_profile:${user.id}`);
      if (staleProfile) await supabase.removeChannel(staleProfile);

      profileChannel = supabase
        .channel(`provider_profile:${user.id}`)
        .on('postgres_changes', {
          event:  'UPDATE',
          schema: 'public',
          table:  'providers',
          filter: `id=eq.${user.id}`,
        }, (payload) => {
          setProvider((prev: any) => prev ? { ...prev, ...payload.new } : prev);
        })
        .subscribe();
    });

    return () => { if (profileChannel) supabase.removeChannel(profileChannel); };
  }, []);

  // ── Realtime: prepend new open requests as they arrive ───────
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const stale = supabase.getChannels().find(ch => ch.topic === 'realtime:open_requests_feed');
      if (stale) await supabase.removeChannel(stale);

      channel = supabase
        .channel('open_requests_feed')
        .on('postgres_changes', {
          event:  'INSERT',
          schema: 'public',
          table:  'requests',
          filter: 'status=eq.open',
        }, async (payload) => {
          const { data } = await supabase
            .from('requests')
            .select('*, category:service_categories(name_ar, name_en, icon), bids_count:bids(count)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setRequests(prev => {
              if (prev.some(r => r.id === data.id)) return prev;
              return [data as RequestWithMeta, ...prev];
            });
          }
        })
        .subscribe();
    };

    setup().catch(() => {});
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // useMemo: filter by category — DB already scopes to provider's city + categories via RLS
  const filtered = useMemo(() =>
    requests.filter(r => {
      if (catFilter !== 'all' && r.category_slug !== catFilter) return false;
      return true;
    }),
    [requests, catFilter],
  );

  // Only show chips for categories that actually have requests in the current feed
  const feedCategories = useMemo(() => {
    const slugs = new Set(requests.map(r => r.category_slug));
    return ALL_CATEGORIES.filter(c => slugs.has(c.slug));
  }, [requests]);

  const handleBidPress = (req: RequestWithMeta, index: number) => {
    if (myBidAmounts.has(req.id)) return; // already bid — chip is shown instead
    if (!provider?.is_subscribed && index > 0) {
      setShowUpsell(true);
    } else {
      setBidModal(prev => ({ ...prev, target: req, amount: '', note: '' }));
    }
  };

  const submitDemoBid = async () => {
    if (!demoModal.amount) { setDemoAmountError(true); return; }
    const amount = parseFloat(demoModal.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('providerFeed.errInvalidAmount'));
      return;
    }
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setLoading(false); return; }

    setDemoModal(prev => ({ ...prev, loading: true }));
    const { data, error } = await supabase.rpc('submit_demo_bid', {
      p_provider_id: user.id,
      p_amount:      amount,
      p_note:        demoModal.note.trim() || null,
    });
    setDemoModal(prev => ({ ...prev, loading: false }));

    if (error || (data as any)?.error) {
      Alert.alert(t('common.error'), error?.message ?? (data as any)?.error);
      return;
    }

    setDemoModal({ open: false, amount: '', note: '', loading: false });
    setDemoStatus({ status: 'submitted', bid_amount: amount });
    setDemoSuccess(true);
  };

  const showBidError = useCallback((
    code: string,
    closeModal: () => void,
    rpcResult?: any,
    pendingBidCtx?: { target: RequestWithMeta; amount: string; note: string; creditCost: number },
  ) => {
    const msgMap: Record<string, string> = {
      NO_CREDITS:        t('providerFeed.errNoCredits'),
      COOLDOWN_ACTIVE:   t('providerFeed.errCooldown'),
      NOT_SUBSCRIBED:    t('providerFeed.mustSubscribe'),
      ALREADY_BID:       t('providerFeed.errAlreadyBid'),
      REQUEST_NOT_FOUND: t('common.error'),
    };
    const message = msgMap[code] ?? code;
    if (code === 'NO_CREDITS' || code === 'NOT_SUBSCRIBED') {
      closeModal();
      Alert.alert(t('common.error'), message, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('providerFeed.renewNow'), onPress: () => router.push('/subscribe') },
      ]);
    } else {
      Alert.alert(t('common.error'), message);
    }
  }, [t, router]);

  const submitUrgentAccept = async () => {
    const target = urgentModal.target;
    if (!target) return;
    setUrgentModal(prev => ({ ...prev, loading: true }));
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;

    // Use centralized pricing utility
    const { min: premiumMin } = calcUrgentPremium(
      target.ai_suggested_price_min,
      target.ai_suggested_price_max,
      target.urgent_premium_pct ?? 25,
    );

    const { data: rpcResult, error } = await supabase.rpc('submit_bid_with_credits', {
      p_request_id:  target.id,
      p_provider_id: user!.id,
      p_amount:      premiumMin ?? 0,
      p_note:        t('providerFeed.urgentBidNote'),
      p_credit_cost: CREDIT_COST.urgent,
    });
    setUrgentModal(prev => ({ ...prev, loading: false }));

    if (error) { Alert.alert(t('common.error'), error.message); return; }
    const result = rpcResult as { error?: string; bid_id?: string };
    if (result?.error) {
      showBidError(result.error, () => setUrgentModal({ target: null, loading: false }), result);
      return;
    }
    const submittedId = target.id;
    setUrgentModal({ target: null, loading: false });
    setMyBidAmounts(prev => new Map([...prev, [submittedId, { amount: premiumMin ?? 0, bidId: result.bid_id ?? '', is_boosted: false, boost_expires_at: null }]]));
    // Client notification is dispatched server-side by trg_notify_on_new_bid
    // (migrations 104/105) — fires on the bids INSERT, no client call needed.
    Alert.alert(t('providerFeed.successUrgentTitle'), t('providerFeed.successUrgentMsg'));
    load();
  };

  const submitBid = async () => {
    const { target, amount: amountStr, note } = bidModal;
    if (!target) return;
    if (!amountStr) { setBidAmountError(true); return; }
    if (!note.trim()) { setBidNoteError(true); return; }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('providerFeed.errInvalidAmount'));
      return;
    }

    const { data: validation } = await supabase.rpc('validate_bid_amount', {
      p_category_slug: target.category_slug,
      p_amount: amount,
    });
    if (validation && !validation.valid) {
      if (validation.error === 'BELOW_MIN') {
        Alert.alert(t('common.error'), t('providerFeed.errBelowMin', { min: validation.min_bid }));
      } else if (validation.error === 'ABOVE_MAX') {
        Alert.alert(t('common.error'), t('providerFeed.errAboveMax', { max: validation.max_bid }));
      }
      return;
    }

    setBidModal(prev => ({ ...prev, loading: true }));
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    const creditCost = target.is_urgent ? CREDIT_COST.urgent : CREDIT_COST.normal;

    const { data: rpcResult, error } = await supabase.rpc('submit_bid_with_credits', {
      p_request_id:  target.id,
      p_provider_id: user!.id,
      p_amount:      amount,
      p_note:        note.trim() || null,
      p_credit_cost: creditCost,
    });
    setBidModal(prev => ({ ...prev, loading: false }));

    if (error) { Alert.alert(t('common.error'), error.message); return; }
    const result = rpcResult as { error?: string; bid_id?: string };
    if (result?.error) {
      showBidError(
        result.error,
        () => setBidModal({ target: null, amount: '', note: '', loading: false }),
        result,
        { target, amount: amountStr, note, creditCost: creditCost },
      );
      return;
    }
    const submittedId     = target.id;
    const submittedAmount = amount;
    setBidModal({ target: null, amount: '', note: '', loading: false });
    setMyBidAmounts(prev => new Map([...prev, [submittedId, { amount: submittedAmount, bidId: result.bid_id ?? '', is_boosted: false, boost_expires_at: null }]]));
    // Client notification is dispatched server-side by trg_notify_on_new_bid
    // (migrations 104/105) — fires on the bids INSERT, no client call needed.
    Alert.alert(t('providerFeed.successBidTitle'), t('providerFeed.successBidMsg'));
    load();
  };

  const handleBoost = async () => {
    if (!boostModal || !provider) return;
    const { bidMeta, requestId } = boostModal;
    setBoosting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.rpc('boost_bid', {
      p_bid_id:      bidMeta.bidId,
      p_provider_id: session!.user.id,
    });
    setBoosting(false);

    if (error) { Alert.alert(t('common.error'), error.message); setBoostModal(null); return; }
    const result = data as { error?: string; success?: boolean; boost_expires_at?: string };

    if (result?.error) {
      const errKey: Record<string, string> = {
        ALREADY_BOOSTED:   'boostErrAlreadyBoosted',
        BOOST_LIMIT_REACHED: 'boostErrLimitReached',
        NO_CREDITS:        'boostErrNoCredits',
        BID_NOT_PENDING:   'boostErrNotPending',
      };
      Alert.alert(t('common.error'), t(`providerFeed.${errKey[result.error] ?? 'boostErrNoCredits'}`));
      setBoostModal(null);
      return;
    }

    // Optimistically update local state
    setMyBidAmounts(prev => {
      const updated = new Map(prev);
      updated.set(requestId, {
        ...bidMeta,
        is_boosted: true,
        boost_expires_at: result.boost_expires_at ?? null,
      });
      return updated;
    });
    setBoostModal(null);
    Alert.alert(t('providerFeed.boostSuccessTitle'), t('providerFeed.boostSuccessMsg'));
  };

  const submitContractBid = async () => {
    const { target, amount: amountStr, note } = contractModal;
    if (!target) return;
    if (!amountStr) { setContractAmountError(true); return; }
    if (!note.trim()) { setContractNoteError(true); return; }
    const price = parseFloat(amountStr);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('common.error'), t('providerFeed.errInvalidAmount'));
      return;
    }

    setContractModal(prev => ({ ...prev, loading: true }));
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;

    const { data: rpcResult, error } = await supabase.rpc('submit_contract_bid_with_credits', {
      p_contract_id:     target.id,
      p_provider_id:     user!.id,
      p_price_per_visit: price,
      p_note:            note.trim() || null,
      p_credit_cost:     CREDIT_COST.contract,
    });
    setContractModal(prev => ({ ...prev, loading: false }));

    if (error) { Alert.alert(t('common.error'), error.message); return; }
    const result = rpcResult as { error?: string; bid_id?: string };
    if (result?.error) {
      showBidError(result.error, () => setContractModal({ target: null, amount: '', note: '', loading: false }), result);
      return;
    }
    setContractModal({ target: null, amount: '', note: '', loading: false });
    Alert.alert(t('providerFeed.successContractBidTitle'), t('providerFeed.successContractBidMsg'));
    load();
  };

  const tierMeta = provider ? TIER_META[provider.reputation_tier] : null;

  const gradColors: [string, string] = isDark
    ? [colors.bg, '#1A1407']
    : ['#FDF6E3', '#FFFBF8'];

  if (loading) {
    return <LinearGradient colors={gradColors} style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></LinearGradient>;
  }

  return (
    <View style={styles.container}>

      <AppHeader
        variant="root"
        userName={provider?.user?.full_name}
        userRole="provider"
        userCity={provider?.user?.city ? t(`cities.${provider.user.city}`, { defaultValue: provider.user.city }) : undefined}
        providerScore={provider?.score}
        providerRepTier={provider?.reputation_tier}
        providerLifetimeJobs={provider?.lifetime_jobs}
        providerBidCredits={provider?.subscription_credits ?? 0}
        providerBonusCredits={provider?.bonus_credits ?? 0}
        providerSubscriptionTier={provider?.subscription_tier}
        providerIsAvailable={provider?.is_available}
        primaryCategoryIcon={(() => {
          const slug = provider?.categories?.[0];
          if (!slug) return undefined;
          const cat = getCategoryBySlug(slug);
          return cat ? (ICON_MAP[cat.icon] ?? '🛠️') : undefined;
        })()}
        notifCount={notifCount}
        onNotifPress={() => router.push('/notification-inbox' as any)}
        onAvatarPress={() => router.push('/(provider)/profile' as any)}
      />
      <ProviderSubHeader
        subscriptionCredits={provider?.subscription_credits ?? 0}
        bonusCredits={provider?.bonus_credits ?? 0}
        subscriptionTier={provider?.subscription_tier ?? ''}
        isSubscribed={provider?.is_subscribed ?? false}
        subscriptionEnds={provider?.subscription_ends}
        onUpgrade={() => router.push('/subscribe' as any)}
      />
      <LinearGradient colors={gradColors} style={{ flex: 1 }}>

      {/* ── Pending commitment banner ─────────────────────────── */}
      {pendingCommit && (
        <TouchableOpacity
          style={[styles.commitBanner, pendingCommit.is_urgent && styles.commitBannerUrgent, { flexDirection: 'row' }]}
          onPress={() => router.push({ pathname: '/provider-confirm', params: { job_id: pendingCommit.job_id } } as any)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.commitBannerTitle, pendingCommit.is_urgent && styles.commitBannerTitleUrgent]}>
              {pendingCommit.is_urgent ? t('providerFeed.commitBannerUrgentTitle') : t('providerFeed.commitBannerNormal')}
            </Text>
            <Text style={styles.commitBannerSub} numberOfLines={1}>{pendingCommit.title}</Text>
          </View>
          <Text style={[styles.commitBannerArrow, pendingCommit.is_urgent && { color: '#F87171' }]}>
            {isRTL ? '←' : '→'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Category filter ───────────────────────────────────── */}
      <Animated.View style={{ opacity: filterOp }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, catFilter === 'all' && styles.filterChipActive]}
            onPress={() => setCatFilter('all')}
          >
            <Text style={[styles.filterChipText, catFilter === 'all' && styles.filterChipTextActive]}>
              {t('providerFeed.allFilter')}
            </Text>
          </TouchableOpacity>
          {feedCategories.map(cat => (
            <TouchableOpacity
              key={cat.slug}
              style={[styles.filterChip, catFilter === cat.slug && styles.filterChipActive]}
              onPress={() => setCatFilter(catFilter === cat.slug ? 'all' : cat.slug)}
            >
              <Text style={[styles.filterChipText, catFilter === cat.slug && styles.filterChipTextActive]}>
                {ICON_MAP[cat.icon] ?? '🔧'} {lang === 'ar' ? cat.name_ar : (cat.name_en ?? cat.name_ar)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── Demo Request Card ─────────────────────────────────── */}
      {demoStatus && (demoStatus.status === 'pending' || demoStatus.status === 'submitted') && (
        <DemoRequestCard
          demo={demoStatus}
          onBidPress={() => setDemoModal(prev => ({ ...prev, open: true }))}
          onSkip={() => {
            setDemoStatus(null);
            if (provider?.id) {
              supabase.rpc('dismiss_provider_demo', { p_provider_id: provider.id }).then(() => {});
            }
          }}
        />
      )}

      {/* ── Recurring Contracts Section ──────────────────────── */}
      {contracts.length > 0 && (
        <View style={styles.contractSection}>
          <View style={styles.contractHeader}>
            <Text style={styles.contractHeaderSub}>{t('providerFeed.contractAvailable', { count: contracts.length })}</Text>
            <Text style={styles.contractHeaderTitle}>{t('providerFeed.contractSection')}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.contractScroll}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
          >
            {contracts.map(c => (
              <ContractMiniCard
                key={c.id}
                contract={c}
                onPress={() => setContractModal(prev => ({ ...prev, target: c }))}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Request list ──────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: contentPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <EmptyFeedState
            provider={provider}
            portfolioCount={portfolioCount}
            isRTL={isRTL}
            ta={ta}
            onSubscribe={() => router.push('/subscribe' as any)}
            onProfile={() => router.push({ pathname: '/(provider)/profile', params: { tab: 'portfolio' } } as any)}
          />
        }
        renderItem={({ item, index }) => {
          const bidMeta = myBidAmounts.get(item.id);
          return (
            <RequestCard
              key={item.id}
              item={item}
              index={index}
              isLocked={!item.is_urgent && !provider?.is_subscribed && index > 0}
              myBidMeta={bidMeta}
              entranceAnim={getCardAnim(Math.min(index, MAX_CARDS - 1))}
              onBidPress={() => handleBidPress(item, index)}
              onUrgentAccept={() => setUrgentModal(prev => ({ ...prev, target: item }))}
              onBoostPress={bidMeta ? () => setBoostModal({ bidMeta, requestId: item.id }) : undefined}
              onDetailPress={() => setDetailSheet(item)}
            />
          );
        }}
      />

      {/* ── Bid Modal ─────────────────────────────────────────── */}
      <Modal visible={!!bidModal.target} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            <Text style={styles.modalTitle}>{t('providerFeed.submitBid')}</Text>
            <Text style={styles.modalSubtitle}>{bidModal.target?.title}</Text>

            {bidModal.target?.ai_suggested_price_min && (
              <View>
                <Text style={styles.modalAiHint}>
                  ✨ {t('providerFeed.aiPrice', { min: bidModal.target.ai_suggested_price_min, max: bidModal.target.ai_suggested_price_max })}
                </Text>
                <Text style={styles.modalAiNote}>{t('newRequest.aiHint')}</Text>
              </View>
            )}

            {/* Credit cost hint */}
            {provider?.is_subscribed && (
              <View style={styles.creditCostHint}>
                <Text style={styles.creditCostHintText}>
                  {bidModal.target?.is_urgent
                    ? t('providerFeed.creditCostUrgent')
                    : t('providerFeed.creditCostNormal')}
                  {provider.subscription_tier !== 'premium' && (
                    ` • ${t('providerFeed.creditsRemaining', { count: Math.max(0, (provider.subscription_credits ?? 0) + (provider.bonus_credits ?? 0) - (bidModal.target?.is_urgent ? CREDIT_COST.urgent : CREDIT_COST.normal)) })}`
                  )}
                </Text>
              </View>
            )}

            <Text style={styles.modalLabel}>{t('providerFeed.bidAmountLabel')}</Text>
            <TextInput
              style={[styles.modalInput, bidAmountError && styles.inputError]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={bidModal.amount}
              onChangeText={text => { setBidModal(prev => ({ ...prev, amount: sanitizeAmount(text) })); if (bidAmountError) setBidAmountError(false); }}
              textAlign={ta}
            />
            {bidAmountError && (
              <Text style={styles.errorHint}>{t('providerFeed.errRequiredAmount')}</Text>
            )}

            <Text style={styles.modalLabel}>{t('providerFeed.bidNote')}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputText, { height: 80, textAlignVertical: 'top' }, bidNoteError && styles.inputError]}
              placeholder={t('providerFeed.bidWhyPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={bidModal.note}
              onChangeText={text => { setBidModal(prev => ({ ...prev, note: text })); if (bidNoteError) setBidNoteError(false); }}
              textAlign={ta}
              multiline
            />
            {bidNoteError && (
              <Text style={styles.errorHint}>{t('providerFeed.errRequiredNote')}</Text>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setBidModal(prev => ({ ...prev, target: null, amount: '', note: '' })); setBidAmountError(false); setBidNoteError(false); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, bidModal.loading && styles.btnDisabled]}
                onPress={submitBid}
                disabled={bidModal.loading}
                activeOpacity={0.85}
              >
                {bidModal.loading
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.modalSubmitText}>{t('providerFeed.sendBid')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Contract Bid Modal ───────────────────────────────── */}
      <Modal visible={!!contractModal.target} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            <View style={cBidStyles.header}>
              <Text style={cBidStyles.badge}>{t('providerFeed.contractBadge')}</Text>
            </View>
            <Text style={styles.modalTitle}>{contractModal.target?.title}</Text>
            {contractModal.target && (
              <View style={cBidStyles.summary}>
                <Text style={cBidStyles.summaryText}>
                  {t(`providerFeed.freq${contractModal.target.frequency.charAt(0).toUpperCase() + contractModal.target.frequency.slice(1)}` as any)} · {contractModal.target.duration_months} · {' '}
                  {t('providerFeed.contractVisitCount', { count: FREQ_VISITS_PER_MONTH[contractModal.target.frequency] * contractModal.target.duration_months })}
                </Text>
              </View>
            )}
            <Text style={styles.modalLabel}>{t('providerFeed.contractVisitPriceLabel')}</Text>
            <TextInput
              style={[styles.modalInput, contractAmountError && styles.inputError]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={contractModal.amount}
              onChangeText={text => { setContractModal(prev => ({ ...prev, amount: sanitizeAmount(text) })); if (contractAmountError) setContractAmountError(false); }}
              textAlign={ta}
            />
            {contractAmountError && (
              <Text style={styles.errorHint}>{t('providerFeed.errRequiredPrice')}</Text>
            )}
            {contractModal.amount && contractModal.target && !isNaN(parseFloat(contractModal.amount)) && (
              <View style={cBidStyles.totalBox}>
                <Text style={cBidStyles.totalLabel}>{t('providerFeed.contractTotalExpected')}</Text>
                <Text style={cBidStyles.totalValue}>
                  {calcContractTotal(parseFloat(contractModal.amount), contractModal.target.frequency, contractModal.target.duration_months).toFixed(0)} د.أ
                </Text>
              </View>
            )}
            <Text style={styles.modalLabel}>{t('providerFeed.bidNote')}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputText, { height: 80, textAlignVertical: 'top' }, contractNoteError && styles.inputError]}
              placeholder={t('providerFeed.contractNotePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={contractModal.note}
              onChangeText={text => { setContractModal(prev => ({ ...prev, note: text })); if (contractNoteError) setContractNoteError(false); }}
              textAlign={ta}
              multiline
            />
            {contractNoteError && (
              <Text style={styles.errorHint}>{t('providerFeed.errRequiredNote')}</Text>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setContractModal(prev => ({ ...prev, target: null, amount: '', note: '' })); setContractAmountError(false); setContractNoteError(false); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cBidStyles.submitBtn, contractModal.loading && styles.btnDisabled]}
                onPress={submitContractBid}
                disabled={contractModal.loading}
                activeOpacity={0.85}
              >
                {contractModal.loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={cBidStyles.submitBtnText}>{t('providerFeed.contractSendBid')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Boost Modal ──────────────────────────────────────── */}
      <Modal visible={!!boostModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.boostSheet}>
            <Text style={styles.boostSheetTitle}>{t('providerFeed.boostSheetTitle')}</Text>
            <Text style={styles.boostSheetDesc}>{t('providerFeed.boostSheetDesc')}</Text>

            <View style={styles.boostCostRow}>
              <Text style={styles.boostCostLabel}>
                {provider?.subscription_tier === 'premium'
                  ? t('providerFeed.boostSheetCostFree')
                  : t('providerFeed.boostSheetCost')}
              </Text>
              {provider?.subscription_tier !== 'premium' && (
                <Text style={styles.boostCostValue}>
                  {t('providerFeed.boostSheetCreditsAfter', {
                    count: Math.max(0, (provider?.subscription_credits ?? 0) + (provider?.bonus_credits ?? 0) - 1),
                  })}
                </Text>
              )}
            </View>

            <View style={styles.boostBtns}>
              <TouchableOpacity
                style={styles.boostCancelBtn}
                onPress={() => setBoostModal(null)}
                disabled={boosting}
              >
                <Text style={styles.boostCancelText}>{t('providerFeed.boostSheetCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.boostConfirmBtn, boosting && styles.btnDisabled]}
                onPress={handleBoost}
                disabled={boosting}
              >
                {boosting
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={styles.boostConfirmText}>{t('providerFeed.boostSheetConfirm')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Upsell Modal (animated) ───────────────────────────── */}
      <UpsellModal
        visible={showUpsell}
        onClose={() => setShowUpsell(false)}
        onSubscribe={(tier) => { setShowUpsell(false); router.push({ pathname: '/subscribe', params: { tier } }); }}
      />

      {/* ── Urgent Accept Modal ───────────────────────────────── */}
      <Modal visible={!!urgentModal.target} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={urgentStyles.acceptSheet}>
            <Text style={urgentStyles.acceptTitle}>{t('providerFeed.urgentAcceptTitle')}</Text>
            <Text style={urgentStyles.acceptSubtitle}>{urgentModal.target?.title}</Text>

            <View style={[urgentStyles.acceptRow, { flexDirection: 'row' }]}>
              <Text style={urgentStyles.acceptLabel}>{t('providerFeed.urgentServiceLabel')}</Text>
              <Text style={urgentStyles.acceptValue}>
                {(lang === 'ar' ? urgentModal.target?.category?.name_ar : (urgentModal.target?.category?.name_en ?? urgentModal.target?.category?.name_ar)) ?? urgentModal.target?.category_slug}
              </Text>
            </View>
            <View style={[urgentStyles.acceptRow, { flexDirection: 'row' }]}>
              <Text style={urgentStyles.acceptLabel}>{t('providerFeed.urgentCityLabel')}</Text>
              <Text style={urgentStyles.acceptValue}>{urgentModal.target?.city ? t(`cities.${urgentModal.target.city}` as any, urgentModal.target.city) : ''}</Text>
            </View>
            <View style={[urgentStyles.acceptRow, { flexDirection: 'row' }]}>
              <Text style={urgentStyles.acceptLabel}>{t('providerFeed.urgentDescLabel')}</Text>
              <Text style={[urgentStyles.acceptValue, { flex: 0.65, textAlign: ta }]} numberOfLines={3}>
                {urgentModal.target?.description}
              </Text>
            </View>

            {urgentModal.target?.ai_suggested_price_min ? (() => {
              const urgent = calcUrgentPremium(
                urgentModal.target.ai_suggested_price_min,
                urgentModal.target.ai_suggested_price_max,
                urgentModal.target.urgent_premium_pct ?? 25,
              );
              return (
                <View style={urgentStyles.acceptPriceTip}>
                  <Text style={urgentStyles.acceptPriceTipText}>
                    {t('providerFeed.urgentPriceTip', {
                      min: urgent.min,
                      max: urgent.max,
                      pct: urgentModal.target.urgent_premium_pct ?? 25,
                    })}
                  </Text>
                </View>
              );
            })() : null}

            <View style={urgentStyles.acceptCommitment}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <Text style={urgentStyles.acceptCommitText}>
                {t('providerFeed.urgentCommitText')}
              </Text>
            </View>

            <View style={urgentStyles.acceptBtns}>
              <TouchableOpacity
                style={urgentStyles.acceptCancel}
                onPress={() => setUrgentModal(prev => ({ ...prev, target: null }))}
                disabled={urgentModal.loading}
              >
                <Text style={urgentStyles.acceptCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[urgentStyles.acceptConfirm, urgentModal.loading && styles.btnDisabled]}
                onPress={submitUrgentAccept}
                disabled={urgentModal.loading}
              >
                {urgentModal.loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={urgentStyles.acceptConfirmText}>{t('providerFeed.urgentAcceptBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Demo Bid Modal ────────────────────────────────────── */}
      <Modal visible={demoModal.open} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            {/* Header */}
            <View style={demoBidStyles.header}>
              <View style={demoBidStyles.badge}>
                <Text style={demoBidStyles.badgeText}>🎯 {t('providerFeed.demoBidSheetTitle')}</Text>
              </View>
            </View>
            <Text style={styles.modalSubtitle}>
              {demoStatus?.request?.title}
            </Text>

            {/* Free note */}
            <View style={demoBidStyles.freeBox}>
              <Text style={demoBidStyles.freeText}>
                💡 {t('providerFeed.demoBidSheetInfo')}
              </Text>
            </View>

            {/* Credits safe */}
            {provider?.is_subscribed && (
              <View style={styles.creditCostHint}>
                <Text style={styles.creditCostHintText}>
                  {t('providerFeed.demoCreditsSafe', { count: (provider.subscription_credits ?? 0) + (provider.bonus_credits ?? 0) })}
                </Text>
              </View>
            )}

            <Text style={styles.modalLabel}>{t('providerFeed.bidAmountLabel')}</Text>
            <TextInput
              style={[styles.modalInput, demoAmountError && styles.inputError]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={demoModal.amount}
              onChangeText={text => { setDemoModal(prev => ({ ...prev, amount: sanitizeAmount(text) })); if (demoAmountError) setDemoAmountError(false); }}
              textAlign={ta}
            />
            {demoAmountError && (
              <Text style={styles.errorHint}>{t('providerFeed.errRequiredAmount')}</Text>
            )}

            <Text style={styles.modalLabel}>{t('providerFeed.bidNote')}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputText, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t('providerFeed.bidWhyPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={demoModal.note}
              onChangeText={text => setDemoModal(prev => ({ ...prev, note: text }))}
              textAlign={ta}
              multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setDemoModal(prev => ({ ...prev, open: false, amount: '', note: '' })); setDemoAmountError(false); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[demoBidStyles.submitBtn, demoModal.loading && styles.btnDisabled]}
                onPress={submitDemoBid}
                disabled={demoModal.loading}
                activeOpacity={0.85}
              >
                {demoModal.loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={demoBidStyles.submitBtnText}>{t('providerFeed.demoSubmitBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Demo Success Modal ────────────────────────────────── */}
      <DemoSuccessModal
        visible={demoSuccess}
        credits={(provider?.subscription_credits ?? 0) + (provider?.bonus_credits ?? 0)}
        onClose={() => setDemoSuccess(false)}
      />

      {/* ── Tutorial tooltip: credits badge ── */}
      <TutorialTooltip
        visible={showCreditsTooltip}
        icon="💳"
        titleKey="tutorial.tooltipCreditsTitle"
        subKey="tutorial.tooltipCreditsSub"
        onDismiss={() => { setShowCreditsTooltip(false); markTooltip('credits'); }}
      />

      {/* ── Full-screen Image Viewer ──────────────────────────── */}
      <Modal
        visible={!!imageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewer(null)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Close button */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 48, right: 16, zIndex: 10, backgroundColor: '#00000088', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setImageViewer(null)}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#fff', fontSize: 20, lineHeight: 22 }}>✕</Text>
          </TouchableOpacity>

          {/* Counter */}
          {(imageViewer?.urls.length ?? 0) > 1 && (
            <View style={{ position: 'absolute', top: 48, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
              <Text style={{ color: '#ffffffaa', fontSize: 14, fontWeight: '600' }}>
                {(imageViewer?.index ?? 0) + 1} / {imageViewer?.urls.length}
              </Text>
            </View>
          )}

          {/* Swipeable image list */}
          <ScrollView
            ref={imageScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1, height: Dimensions_height }}
          >
            {imageViewer?.urls.map((url, i) => (
              <Pressable
                key={i}
                style={{ width: Dimensions_width, height: Dimensions_height, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setImageViewer(null)}
              >
                <Image
                  source={{ uri: url }}
                  style={{ width: Dimensions_width, height: Dimensions_height }}
                  resizeMode="contain"
                  onError={() => console.warn('[Waseet] image viewer load failed:', url)}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Request Detail Bottom Sheet ───────────────────────── */}
      <Modal
        visible={!!detailSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailSheet(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetailSheet(null)}>
          <Pressable style={[styles.detailSheet, { paddingBottom: contentPad }]} onPress={() => {}}>

            {/* Handle bar */}
            <View style={styles.detailHandle} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category + urgent badge */}
              <View style={styles.detailCatRow}>
                <Text style={styles.detailCat}>
                  {ICON_MAP[detailSheet?.category?.icon ?? ''] ?? '🔧'} {(lang === 'ar' ? detailSheet?.category?.name_ar : (detailSheet?.category?.name_en ?? detailSheet?.category?.name_ar)) ?? detailSheet?.category_slug}
                </Text>
                {detailSheet?.is_urgent && (
                  <View style={urgentStyles.urgentBadge}>
                    <Text style={urgentStyles.urgentBadgeText}>{t('providerFeed.urgentBadge')}</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={styles.detailTitle}>{detailSheet?.title}</Text>

              {/* Full description */}
              <Text style={styles.detailDesc}>{detailSheet?.description}</Text>

              {/* Client images */}
              {(detailSheet?.image_urls?.length ?? 0) > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.detailImgScroll}
                  contentContainerStyle={{ gap: 10, paddingHorizontal: 2 }}
                >
                  {detailSheet!.image_urls.map((url, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.85}
                      onPress={() => setImageViewer({ urls: detailSheet!.image_urls, index: i })}
                    >
                      <Image source={{ uri: url }} style={styles.detailImg} resizeMode="cover" onError={() => console.warn('[Waseet] detail image load failed:', url)} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Info rows */}
              <View style={styles.detailInfoBox}>
                <View style={styles.detailInfoRow}>
                  <Text style={styles.detailInfoIcon}>📍</Text>
                  <Text style={styles.detailInfoValue}>
                    {detailSheet?.city ? t(`cities.${detailSheet.city}` as any, detailSheet.city) : ''}{detailSheet?.district ? ` — ${detailSheet.district}` : ''}
                  </Text>
                </View>

                {detailSheet?.bidding_ends_at && (() => {
                  const msLeft = new Date(detailSheet.bidding_ends_at!).getTime() - Date.now();
                  if (msLeft <= 0) return null;
                  const h = Math.floor(msLeft / 3600000);
                  const m = Math.floor((msLeft % 3600000) / 60000);
                  return (
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoIcon}>⏱</Text>
                      <Text style={styles.detailInfoValue}>
                        {t('requests.biddingEndsIn', { time: h > 0 ? `${h}h ${m}m` : `${m}m` })}
                      </Text>
                    </View>
                  );
                })()}

                {detailSheet?.ai_suggested_price_min && (
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoIcon}>✨</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.aiPriceTag}>{isRTL ? 'توقع ذكاء اصطناعي' : 'AI Estimate'}</Text>
                      <Text style={[styles.detailInfoValue, { color: colors.accent, fontWeight: '700' }]}>
                        {detailSheet.ai_suggested_price_min}–{detailSheet.ai_suggested_price_max} د.أ
                      </Text>
                    </View>
                  </View>
                )}

                {(detailSheet?.bids_count?.[0]?.count ?? 0) > 0 && (
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoIcon}>👥</Text>
                    <Text style={styles.detailInfoValue}>
                      {t('providerFeed.bidCount', { count: detailSheet!.bids_count![0].count })}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* CTA button */}
            {detailSheet && myBidAmounts.has(detailSheet.id) ? (
              <View style={styles.detailSubmittedRow}>
                <Text style={styles.detailSubmittedText}>
                  {t('providerFeed.submittedBanner', { amount: myBidAmounts.get(detailSheet.id)!.amount })}
                </Text>
              </View>
            ) : detailSheet?.is_urgent ? (
              <TouchableOpacity
                style={styles.detailBidBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const target = detailSheet;
                  setDetailSheet(null);
                  setUrgentModal({ target, loading: false });
                }}
              >
                <Text style={styles.detailBidBtnText}>{t('providerFeed.acceptUrgent')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.detailBidBtn}
                activeOpacity={0.85}
                onPress={() => {
                  const target = detailSheet!;
                  const idx = filtered.findIndex(r => r.id === target.id);
                  setDetailSheet(null);
                  handleBidPress(target, idx);
                }}
              >
                <Text style={styles.detailBidBtnText}>{t('providerFeed.submitBid')}</Text>
              </TouchableOpacity>
            )}

          </Pressable>
        </Pressable>
      </Modal>

      </LinearGradient>
    </View>
  );
}

function createDemoBidStyles(_colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  header:     { marginBottom: 4 },
  badge:      { backgroundColor: DEMO_COLOR, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  badgeText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  freeBox:    { backgroundColor: DEMO_SOFT, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: DEMO_BORDER },
  freeText:   { fontSize: 12, color: DEMO_TEXT, lineHeight: 18, textAlign: ta },
  submitBtn:  { flex: 2, backgroundColor: DEMO_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  // ── Pending commit banner
  commitBanner:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C4A6E', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(56,189,248,0.25)', gap: 10 },
  commitBannerUrgent:     { backgroundColor: '#450A0A', borderBottomColor: 'rgba(239,68,68,0.3)' },
  commitBannerTitle:      { fontSize: 13, fontWeight: '800', color: '#7DD3FC', textAlign: ta },
  commitBannerTitleUrgent:{ color: '#FCA5A5' },
  commitBannerSub:        { fontSize: 12, color: '#BAE6FD', textAlign: ta, marginTop: 2 },
  commitBannerArrow:      { fontSize: 18, color: '#38BDF8', fontWeight: '700' },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  greeting:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 6 },
  tierBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  tierText:   { fontSize: 12, fontWeight: '700' },
  tierScore:  { fontSize: 12, color: colors.textSecondary },
  tierJobs:   { fontSize: 11, color: colors.textMuted },

  liveRow:   { flexDirection: 'row', alignItems: 'center' },
  liveText:  { fontSize: 11, color: '#22C55E', fontWeight: '600' },

  upgradeBtn:     { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, shadowColor: colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  upgradeBtnText: { fontSize: 12, fontWeight: '700', color: colors.bg },

  creditsBadge:     { backgroundColor: 'rgba(201,168,76,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)' },
  creditsBadgeText: { fontSize: 12, fontWeight: '700', color: colors.accent },

  creditCostHint:     { backgroundColor: 'rgba(201,168,76,0.08)', borderRadius: 8, padding: 10, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(201,168,76,0.20)' },
  creditCostHintText: { fontSize: 12, color: colors.accent, textAlign: 'auto', fontWeight: '600' },

  // ── Filter
  filterScroll: { paddingHorizontal: 16, paddingBottom: 12, flexGrow: 0 },
  filterChip:          { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
  filterChipActive:    { borderColor: colors.accent, backgroundColor: colors.accentDim },
  filterChipText:      { color: colors.textSecondary, fontSize: 12 },
  filterChipTextActive:{ color: colors.accent, fontWeight: '600' },

  // ── List
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // ── Cards
  card:       { backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: isDark ? colors.border : 'rgba(201,168,76,0.20)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.05, shadowRadius: 6, elevation: isDark ? 0 : 1 },
  cardLocked: { opacity: 0.82 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCat:    { fontSize: 12, color: colors.textMuted },
  cardTime:   { fontSize: 12, color: colors.textMuted },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 8 },
  cardDesc:        { fontSize: 13, color: colors.textSecondary, textAlign: 'auto', lineHeight: 20, marginBottom: 12 },
  courierRoute:    { backgroundColor: colors.accentDim, borderRadius: 10, padding: 10, marginBottom: 10, gap: 2, borderWidth: 1, borderColor: colors.accent + '33' },
  courierRouteText:{ fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  courierArrow:    { fontSize: 11, color: colors.textMuted, marginStart: 4 },

  blurContainer: { marginBottom: 12, position: 'relative' },
  blurText:      { fontSize: 13, color: colors.textSecondary, textAlign: 'auto', lineHeight: 20 },
  blurOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, opacity: 0.88, borderRadius: 6 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  cardCity:   { fontSize: 12, color: colors.textMuted, flexShrink: 0 },
  bidsCount:    { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  biddingEnds:  { fontSize: 11, color: colors.textMuted, flexShrink: 1 },
  aiPrice:    { fontSize: 13, color: colors.accent, fontWeight: '600' },
  aiPriceTag: { fontSize: 10, color: colors.textMuted, marginBottom: 1 },
  modalAiNote:{ fontSize: 11, color: colors.textMuted, textAlign: ta, marginBottom: 12 },

  bidBtn:           { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  bidBtnLocked:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bidBtnText:       { fontSize: 13, fontWeight: '700', color: colors.bg },
  bidBtnTextLocked: { color: colors.textMuted },

  submittedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  submittedBannerText: { fontSize: 12, color: '#10B981', fontWeight: '700', flex: 1 },
  submittedChip: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.30)',
  },
  submittedChipText: { fontSize: 12, fontWeight: '700', color: '#10B981' },

  // ── Boost
  boostBannerBtn: {
    backgroundColor: 'rgba(234,179,8,0.15)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(234,179,8,0.40)',
  },
  boostBannerBtnText: { fontSize: 11, fontWeight: '700', color: '#EAB308' },
  boostCountdownText: { fontSize: 11, fontWeight: '700', color: '#EAB308' },
  boostSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  boostSheetTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: ta, marginBottom: 8 },
  boostSheetDesc: { fontSize: 14, color: colors.textMuted, textAlign: ta, lineHeight: 22, marginBottom: 20 },
  boostCostRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  boostCostLabel: { fontSize: 13, color: colors.textSecondary },
  boostCostValue: { fontSize: 15, fontWeight: '700', color: '#EAB308' },
  boostBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  boostCancelBtn: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  boostCancelText: { fontSize: 15, color: colors.textSecondary },
  boostConfirmBtn: { flex: 2, backgroundColor: '#EAB308', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  boostConfirmText: { fontSize: 15, fontWeight: '700', color: '#000' },

  // ── Modals
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: ta, marginBottom: 4 },
  modalSubtitle:{ fontSize: 14, color: colors.textMuted, textAlign: ta, marginBottom: 16 },
  modalAiHint:  { fontSize: 13, color: colors.accent, textAlign: ta, marginBottom: 16, fontWeight: '600' },
  modalLabel:   { fontSize: 13, color: colors.textSecondary, textAlign: ta, marginBottom: 8, marginTop: 12 },
  modalInput:   { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  modalInputText: { writingDirection: isRTL ? 'rtl' : 'ltr' },
  inputError:   { borderColor: '#EF4444' },
  errorHint:    { fontSize: 13, color: '#EF4444', marginTop: 4, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' as const },
  modalBtns:    { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancel:      { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText:  { fontSize: 15, color: colors.textSecondary },
  modalSubmit:      { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSubmitText:  { fontSize: 15, fontWeight: '700', color: colors.bg },
  btnDisabled:      { backgroundColor: colors.border },

  upsellSheet:      { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: 'center' },
  upsellIcon:       { fontSize: 52, marginBottom: 12 },
  upsellTitle:      { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  upsellSub:        { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  planRow:          { flexDirection: 'row', gap: 10, marginBottom: 24 },
  planCard:         { flex: 1, backgroundColor: colors.bg, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  planCardHighlight:{ borderColor: colors.accent, backgroundColor: colors.accentDim },
  planBestTag:      { fontSize: 10, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  planPrice:        { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  planLabel:        { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  planDetail:       { fontSize: 11, color: colors.textMuted },
  upsellCloseBtn:   { paddingVertical: 12 },
  upsellCloseBtnText:{ fontSize: 14, color: colors.textMuted },

  // ── Contracts section
  contractSection: { marginBottom: 4 },
  contractHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  contractHeaderTitle: { fontSize: 16, fontWeight: '700', color: CONTRACT_COLOR },
  contractHeaderSub:   { fontSize: 12, color: colors.textMuted },
  contractScroll:  { flexGrow: 0 },

  // ── Request detail bottom sheet
  detailSheet:         { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '88%' },
  detailHandle:        { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  detailCatRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailCat:           { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  detailTitle:         { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: ta, marginBottom: 10, lineHeight: 28 },
  detailDesc:          { fontSize: 14, color: colors.textSecondary, textAlign: ta, lineHeight: 22, marginBottom: 14 },
  detailImgScroll:     { marginBottom: 16 },
  detailImg:           { width: 140, height: 105, borderRadius: 12, backgroundColor: colors.border },
  detailInfoBox:       { backgroundColor: colors.bg, borderRadius: 14, padding: 14, gap: 10, marginBottom: 16 },
  detailInfoRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailInfoIcon:      { fontSize: 16, width: 24, textAlign: 'center' },
  detailInfoValue:     { fontSize: 14, color: colors.textPrimary, flex: 1, textAlign: ta },
  detailBidBtn:        { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  detailBidBtnText:    { fontSize: 16, fontWeight: '800', color: colors.bg },
  detailSubmittedRow:  { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  detailSubmittedText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  });
}
// ── Contract bid modal styles
function createCBidStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  badge:      { backgroundColor: CONTRACT_DIM, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: CONTRACT_COLOR },
  summary:    { backgroundColor: CONTRACT_DIM, borderRadius: 10, padding: 10, marginBottom: 4, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  summaryText:{ fontSize: 13, color: CONTRACT_COLOR, fontWeight: '600', textAlign: ta },
  totalBox:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CONTRACT_DIM, borderRadius: 10, padding: 12, marginVertical: 8, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 18, fontWeight: '800', color: CONTRACT_COLOR },
  submitBtn:  { flex: 2, backgroundColor: CONTRACT_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
