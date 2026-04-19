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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { ALL_CATEGORIES, JORDAN_CITIES, TIER_META, CREDIT_COST } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { ServiceRequest, Provider, User, RecurringContract } from '../../src/types';
import { FREQ_VISITS_PER_MONTH } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { calcUrgentPremium, calcContractTotal, sanitizeAmount } from '../../src/utils/pricing';
import { flexRow, alignEnd, selfStart, me } from '../../src/utils/rtl';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const CONTRACT_COLOR = '#10B981';
const CONTRACT_DIM   = '#10B98122';

const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚', moon: '🌙', 'pen-tool': '✏️',
  car: '🚗', battery: '🔋', gauge: '⛽', snowflake: '🧊', shield: '🛡️', droplet: '💧',
};

type RequestWithMeta = ServiceRequest & {
  category?: { name_ar: string; icon: string };
  client?: { full_name: string };
  bids_count?: { count: number }[];
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

function createUrgentStyles(colors: AppColors) {
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
  acceptTitle:     { fontSize: 20, fontWeight: '800', color: '#EF4444', textAlign: 'auto', marginBottom: 4 },
  acceptSubtitle:  { fontSize: 14, color: colors.textMuted, textAlign: 'auto', marginBottom: 20 },
  acceptRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  acceptLabel:     { fontSize: 13, color: colors.textMuted },
  acceptValue:     { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  acceptPriceTip:  { backgroundColor: '#064E3B', borderRadius: 12, padding: 14, marginTop: 16, marginBottom: 8 },
  acceptPriceTipText: { fontSize: 13, color: '#6EE7B7', textAlign: 'auto', lineHeight: 20 },
  acceptCommitment:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#450A0A', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 20 },
  acceptCommitText:{ fontSize: 12, color: '#FCA5A5', textAlign: 'auto', flex: 1, lineHeight: 18 },
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
  const { t } = useLanguage();
  const totalVisits = FREQ_VISITS_PER_MONTH[contract.frequency] * contract.duration_months;
  const freqKey = `providerFeed.freq${contract.frequency.charAt(0).toUpperCase() + contract.frequency.slice(1)}` as any;

  return (
    <TouchableOpacity style={cStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={cStyles.badge}>
        <Text style={cStyles.badgeText}>{t('providerFeed.contractBadge')}</Text>
      </View>
      <Text style={cStyles.title} numberOfLines={2}>{contract.title}</Text>
      <Text style={cStyles.freq}>{t(freqKey)} · {t('providerFeed.contractVisitCount', { count: totalVisits })}</Text>
      <Text style={cStyles.city}>📍 {contract.city}</Text>
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
  const scale = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
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
    ).start();
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
  const x = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 340, duration: 1600,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(x, { toValue: -100, duration: 0, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    ).start();
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
  const { t } = useLanguage();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 500, useNativeDriver: true }),
        Animated.delay(1500),
      ])
    ).start();
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const { t } = useLanguage();
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
  entranceAnim,
  onBidPress,
  onUrgentAccept,
}: {
  item: RequestWithMeta;
  index: number;
  isLocked: boolean;
  entranceAnim: Animated.Value;
  onBidPress: () => void;
  onUrgentAccept: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const urgentStyles = useMemo(() => createUrgentStyles(colors), [colors]);
  const { t, lang } = useLanguage();
  const bidsCount = item.bids_count?.[0]?.count ?? 0;
  const isNew     = Date.now() - new Date(item.created_at).getTime() < 60 * 60 * 1000;
  const isUrgent  = !!item.is_urgent;
  const locale    = lang === 'ar' ? 'ar-JO' : 'en-GB';

  const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  return (
    <Animated.View style={{ opacity: entranceAnim, transform: [{ translateY }] }}>
      <View style={[styles.card, isLocked && styles.cardLocked, isUrgent && urgentStyles.urgentCard]}>
        {isLocked && <LockedShimmer />}

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

        {/* Category + time + new badge */}
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isNew && !isUrgent && <NewBadge />}
            <Text style={styles.cardTime}>
              {new Date(item.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <Text style={styles.cardCat}>
            {ICON_MAP[item.category?.icon ?? ''] ?? '🔧'} {item.category?.name_ar ?? item.category_slug}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle}>{item.title}</Text>

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
            <Text style={styles.cardCity}>📍 {item.city}</Text>
            {bidsCount > 0 && !isUrgent && (
              <Text style={styles.bidsCount}>{t('providerFeed.bidCount', { count: bidsCount })}</Text>
            )}
          </View>

          {item.ai_suggested_price_min && item.ai_suggested_price_max && !isUrgent && (
            <Text style={styles.aiPrice}>
              {item.ai_suggested_price_min}–{item.ai_suggested_price_max} د.أ
            </Text>
          )}

          {isUrgent ? (
            <TouchableOpacity style={urgentStyles.acceptBtn} onPress={onUrgentAccept}>
              <Text style={urgentStyles.acceptBtnText}>{t('providerFeed.acceptUrgent')}</Text>
            </TouchableOpacity>
          ) : (
            <BidButton locked={isLocked} onPress={onBidPress} />
          )}
        </View>
      </View>
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
  const { colors } = useTheme();
  const demoStyles = useMemo(() => createDemoStyles(colors), [colors]);
  const { t, ta } = useLanguage();

  if (demo.status === 'submitted') {
    return (
      <View style={demoStyles.cardCompleted}>
        <View style={demoStyles.completedRow}>
          <Text style={demoStyles.completedBadge}>{t('providerFeed.demoCompletedBadge')}</Text>
          <Text style={demoStyles.completedBadgeDot}>🎯 {t('providerFeed.demoBadge')}</Text>
        </View>
        <Text style={[demoStyles.completedBid, { textAlign: ta }]}>
          {t('providerFeed.demoCompletedBid', { amount: demo.bid_amount })}
        </Text>
        <TouchableOpacity style={demoStyles.realCTABtn} onPress={onSkip}>
          <Text style={demoStyles.realCTAText}>{t('providerFeed.demoRealCTA')} ←</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const req = demo.request!;

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
      <Text style={[demoStyles.title, { textAlign: ta }]}>{req.title}</Text>
      <Text style={[demoStyles.desc, { textAlign: ta }]} numberOfLines={2}>{req.description}</Text>

      <View style={demoStyles.metaRow}>
        <Text style={demoStyles.metaText}>📍 {req.city}{req.district ? ` — ${req.district}` : ''}</Text>
        <Text style={demoStyles.metaText}>
          {ICON_MAP[ALL_CATEGORIES.find(c => c.slug === req.category_slug)?.icon ?? ''] ?? '🔧'} {req.category_slug}
        </Text>
      </View>

      {/* Info box */}
      <View style={demoStyles.infoBox}>
        <Text style={[demoStyles.infoText, { textAlign: ta }]}>
          ℹ️  {t('providerFeed.demoInfoBox')}
        </Text>
        <Text style={demoStyles.freeNote}>✓ {t('providerFeed.demoFreeNote')}</Text>
      </View>

      {/* CTA */}
      <TouchableOpacity style={demoStyles.bidBtn} onPress={onBidPress} activeOpacity={0.85}>
        <Text style={demoStyles.bidBtnText}>{t('providerFeed.demoBidBtn')} ←</Text>
      </TouchableOpacity>
    </View>
  );
}

function createDemoStyles(colors: AppColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: DEMO_DIM, borderRadius: 16, margin: 16, marginBottom: 0,
    padding: 16, borderWidth: 1.5, borderColor: DEMO_BORDER,
  },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badge:       { backgroundColor: DEMO_COLOR, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:   { fontSize: 11, fontWeight: '800', color: '#fff' },
  skipText:    { fontSize: 12, color: '#475569' },
  title:       { fontSize: 18, fontWeight: '700', color: '#F1F5F9', marginBottom: 6 },
  desc:        { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  metaRow:     { flexDirection: 'row', gap: 14, marginBottom: 12 },
  metaText:    { fontSize: 12, color: colors.textMuted },
  infoBox: {
    backgroundColor: DEMO_SOFT, borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: DEMO_BORDER,
  },
  infoText:    { fontSize: 12, color: DEMO_TEXT, lineHeight: 18, marginBottom: 4 },
  freeNote:    { fontSize: 12, color: '#6EE7B7', fontWeight: '700' },
  bidBtn:      { backgroundColor: DEMO_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  bidBtnText:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Completed state
  cardCompleted: {
    backgroundColor: '#052E16', borderRadius: 16, margin: 16, marginBottom: 0,
    padding: 14, borderWidth: 1, borderColor: '#16A34A', opacity: 0.85,
  },
  completedRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  completedBadge: { fontSize: 11, color: '#6EE7B7', fontWeight: '700' },
  completedBadgeDot: { fontSize: 11, color: '#475569' },
  completedBid:   { fontSize: 13, color: '#6EE7B7', marginBottom: 10 },
  realCTABtn:     { borderWidth: 1, borderColor: DEMO_BORDER, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  realCTAText:    { fontSize: 13, color: DEMO_TEXT, fontWeight: '600' },
  });
}

// ─── Demo Success Modal ───────────────────────────────────────

function DemoSuccessModal({
  visible, credits, onClose,
}: { visible: boolean; credits: number; onClose: () => void }) {
  const { colors } = useTheme();
  const demoSuccessStyles = useMemo(() => createDemoSuccessStyles(colors), [colors]);
  const { t, ta } = useLanguage();
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
          <Text style={[demoSuccessStyles.title, { textAlign: ta }]}>{t('providerFeed.demoSuccessTitle')}</Text>

          <View style={demoSuccessStyles.stepsBox}>
            <Text style={[demoSuccessStyles.stepsTitle, { textAlign: ta }]}>{t('providerFeed.demoHowItWorks')}</Text>
            {steps.map((s, i) => (
              <Text key={i} style={[demoSuccessStyles.step, { textAlign: ta }]}>
                {i + 1}. {s}
              </Text>
            ))}
          </View>

          <View style={demoSuccessStyles.creditsBox}>
            <Text style={[demoSuccessStyles.creditsText, { textAlign: ta }]}>
              ✅ {t('providerFeed.demoSuccessCredits', { count: credits })}
            </Text>
          </View>

          <TouchableOpacity style={demoSuccessStyles.ctaBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={demoSuccessStyles.ctaBtnText}>{t('providerFeed.demoSuccessCTA')} ←</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createDemoSuccessStyles(colors: AppColors) {
  return StyleSheet.create({
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    sheet:       { backgroundColor: colors.bg, borderRadius: 20, padding: 28, width: '100%', borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    emoji:       { fontSize: 56, marginBottom: 16 },
    title:       { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 20, width: '100%' },
    stepsBox:    { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, width: '100%' },
    stepsTitle:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, width: '100%' },
    step:        { fontSize: 13, color: colors.textSecondary, lineHeight: 22, width: '100%' },
    creditsBox:  { backgroundColor: '#052E16', borderRadius: 10, padding: 12, marginBottom: 20, width: '100%', borderWidth: 1, borderColor: '#16A34A' },
    creditsText: { fontSize: 13, color: '#6EE7B7', width: '100%' },
    ctaBtn:      { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
    ctaBtnText:  { fontSize: 16, fontWeight: '700', color: colors.bg },
  });
}

// ─── Main Screen ──────────────────────────────────────────────

const MAX_CARDS = 30;

export default function ProviderFeed() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const urgentStyles = useMemo(() => createUrgentStyles(colors), [colors]);
  const demoBidStyles = useMemo(() => createDemoBidStyles(colors), [colors]);
  const cBidStyles = useMemo(() => createCBidStyles(colors), [colors]);
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang, isRTL } = useLanguage();
  const [provider, setProvider]     = useState<(Provider & { user: User }) | null>(null);
  const [requests, setRequests]     = useState<RequestWithMeta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catFilter, setCatFilter]   = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Demo request
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [demoSuccess, setDemoSuccess] = useState(false);

  // Grouped: demo bid modal state
  const [demoModal, setDemoModal] = useState({ open: false, amount: '', note: '', loading: false });

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

  const load = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    // All four queries run in parallel — no waterfall
    const [
      { data: providerData },
      { data: requestsData },
      { data: contractsData },
      { data: demoData },
    ] = await Promise.all([
      supabase.from('providers').select('*, user:users(*)').eq('id', authUser.id).single(),
      supabase
        .from('requests')
        .select('*, category:service_categories(name_ar, icon), bids_count:bids(count)')
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
    ]);

    if (providerData)  setProvider(providerData);
    if (requestsData)  setRequests(requestsData);
    if (contractsData) setContracts(contractsData as RecurringContract[]);
    if (demoData)      setDemoStatus(demoData as DemoStatus);

    setLoading(false);
    runEntranceAnims(requestsData?.length ?? 0);
  }, []);

  useEffect(() => { load(); }, [load]);

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
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') console.warn('[Waseet] provider_jobs channel error');
        });
    };

    setup().catch(console.error);
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // useMemo: only re-filter when requests list or active filters change
  const filtered = useMemo(() =>
    requests.filter(r => {
      if (catFilter  !== 'all' && r.category_slug !== catFilter)  return false;
      if (cityFilter !== 'all' && r.city          !== cityFilter) return false;
      return true;
    }),
    [requests, catFilter, cityFilter],
  );

  const handleBidPress = (req: RequestWithMeta, index: number) => {
    if (!provider?.is_subscribed && index > 0) {
      setShowUpsell(true);
    } else {
      setBidModal(prev => ({ ...prev, target: req, amount: '', note: '' }));
    }
  };

  const submitDemoBid = async () => {
    if (!demoModal.amount) return;
    const amount = parseFloat(demoModal.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('common.error'), t('providerFeed.errInvalidAmount'));
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

  const submitUrgentAccept = async () => {
    const target = urgentModal.target;
    if (!target) return;
    setUrgentModal(prev => ({ ...prev, loading: true }));
    const { data: { user } } = await supabase.auth.getUser();

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
      const msgMap: Record<string, string> = {
        NO_CREDITS:      t('providerFeed.errNoCredits'),
        COOLDOWN_ACTIVE: t('providerFeed.errCooldown'),
        MAX_ACTIVE_BIDS: t('providerFeed.errMaxActiveBids'),
        NOT_SUBSCRIBED:  t('providerFeed.mustSubscribe'),
      };
      Alert.alert(t('common.error'), msgMap[result.error] ?? result.error);
      return;
    }
    setUrgentModal({ target: null, loading: false });
    Alert.alert(t('providerFeed.successUrgentTitle'), t('providerFeed.successUrgentMsg'));
    load();
  };

  const submitBid = async () => {
    const { target, amount: amountStr, note } = bidModal;
    if (!target || !amountStr) return;
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
    const { data: { user } } = await supabase.auth.getUser();
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
      const msgMap: Record<string, string> = {
        NO_CREDITS:        t('providerFeed.errNoCredits'),
        COOLDOWN_ACTIVE:   t('providerFeed.errCooldown'),
        MAX_ACTIVE_BIDS:   t('providerFeed.errMaxActiveBids'),
        NOT_SUBSCRIBED:    t('providerFeed.mustSubscribe'),
        REQUEST_NOT_FOUND: t('common.error'),
      };
      Alert.alert(t('common.error'), msgMap[result.error] ?? result.error);
      return;
    }
    setBidModal({ target: null, amount: '', note: '', loading: false });
    Alert.alert(t('providerFeed.successBidTitle'), t('providerFeed.successBidMsg'));
    load();
  };

  const submitContractBid = async () => {
    const { target, amount: amountStr, note } = contractModal;
    if (!target || !amountStr) return;
    const price = parseFloat(amountStr);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('common.error'), t('providerFeed.errInvalidAmount'));
      return;
    }

    setContractModal(prev => ({ ...prev, loading: true }));
    const { data: { user } } = await supabase.auth.getUser();

    const { data: creditResult, error: creditError } = await supabase.rpc('submit_bid_with_credits', {
      p_request_id:  target.id,
      p_provider_id: user!.id,
      p_amount:      price,
      p_note:        note.trim() || null,
      p_credit_cost: CREDIT_COST.contract,
    });
    if (creditError) {
      setContractModal(prev => ({ ...prev, loading: false }));
      Alert.alert(t('common.error'), creditError.message);
      return;
    }
    const creditRes = creditResult as { error?: string };
    if (creditRes?.error) {
      setContractModal(prev => ({ ...prev, loading: false }));
      const msgMap: Record<string, string> = {
        NO_CREDITS:      t('providerFeed.errNoCredits'),
        COOLDOWN_ACTIVE: t('providerFeed.errCooldown'),
        MAX_ACTIVE_BIDS: t('providerFeed.errMaxActiveBids'),
        NOT_SUBSCRIBED:  t('providerFeed.mustSubscribe'),
      };
      Alert.alert(t('common.error'), msgMap[creditRes.error] ?? creditRes.error);
      return;
    }

    const { error } = await supabase.rpc('submit_contract_bid', {
      p_contract_id:     target.id,
      p_provider_id:     user!.id,
      p_price_per_visit: price,
      p_note:            note.trim() || null,
    });
    setContractModal(prev => ({ ...prev, loading: false }));

    if (error) { Alert.alert(t('common.error'), error.message); return; }
    setContractModal({ target: null, amount: '', note: '', loading: false });
    Alert.alert(t('providerFeed.successContractBidTitle'), t('providerFeed.successContractBidMsg'));
    load();
  };

  const tierMeta = provider ? TIER_META[provider.reputation_tier] : null;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={styles.container}>

      {/* ── Pending commitment banner ─────────────────────────── */}
      {pendingCommit && (
        <TouchableOpacity
          style={[styles.commitBanner, pendingCommit.is_urgent && styles.commitBannerUrgent, { flexDirection: flexRow(isRTL) }]}
          onPress={() => router.push({ pathname: '/provider-confirm', params: { job_id: pendingCommit.job_id } } as any)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.commitBannerTitle, pendingCommit.is_urgent && styles.commitBannerTitleUrgent, { textAlign: ta }]}>
              {pendingCommit.is_urgent ? t('providerFeed.commitBannerUrgentTitle') : t('providerFeed.commitBannerNormal')}
            </Text>
            <Text style={[styles.commitBannerSub, { textAlign: ta }]} numberOfLines={1}>{pendingCommit.title}</Text>
          </View>
          <Text style={[styles.commitBannerArrow, pendingCommit.is_urgent && { color: '#F87171' }]}>
            {isRTL ? '←' : '→'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Header ────────────────────────────────────────────── */}
      <Animated.View
        style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }], flexDirection: flexRow(isRTL) }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { textAlign: ta }]}>
            {t('providerFeed.greeting', { name: provider?.user?.full_name?.split(' ')[0] })}
          </Text>
          {tierMeta && (
            <View style={[styles.tierBadge, { backgroundColor: tierMeta.color + '22', flexDirection: flexRow(isRTL), alignSelf: selfStart(isRTL) }]}>
              <Text style={[styles.tierText, { color: tierMeta.color }]}>{tierMeta.label_ar}</Text>
              <Text style={styles.tierScore}>⭐ {provider?.score?.toFixed(1)}</Text>
              <Text style={styles.tierJobs}> · {t('providerFeed.lifetimeJobsBadge', { count: provider?.lifetime_jobs })}</Text>
            </View>
          )}
        </View>

        <View style={{ alignItems: alignEnd(isRTL), gap: 8 }}>
          {/* Live feed indicator */}
          <View style={[styles.liveRow, { flexDirection: flexRow(isRTL) }]}>
            <Text style={[styles.liveText, me(4, isRTL)]}>
              {t('providerFeed.live')}
            </Text>
            <LiveDot />
          </View>

          {provider?.is_subscribed ? (
            <View style={styles.creditsBadge}>
              <Text style={styles.creditsBadgeText}>
                {provider.subscription_tier === 'premium'
                  ? t('providerFeed.creditsUnlimited')
                  : t('providerFeed.creditsRemaining', { count: provider.bid_credits ?? 0 })}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push('/subscribe')}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeBtnText}>{t('providerFeed.subscribeBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

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
          {ALL_CATEGORIES.map(cat => (
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
          onSkip={() => setDemoStatus(null)}
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
            <Text style={styles.emptyText}>{t('providerFeed.emptyRequests')}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <RequestCard
            key={item.id}
            item={item}
            index={index}
            isLocked={!item.is_urgent && !provider?.is_subscribed && index > 0}
            entranceAnim={getCardAnim(Math.min(index, MAX_CARDS - 1))}
            onBidPress={() => handleBidPress(item, index)}
            onUrgentAccept={() => setUrgentModal(prev => ({ ...prev, target: item }))}
          />
        )}
      />

      {/* ── Bid Modal ─────────────────────────────────────────── */}
      <Modal visible={!!bidModal.target} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            <Text style={[styles.modalTitle, { textAlign: ta }]}>{t('providerFeed.submitBid')}</Text>
            <Text style={[styles.modalSubtitle, { textAlign: ta }]}>{bidModal.target?.title}</Text>

            {bidModal.target?.ai_suggested_price_min && (
              <Text style={[styles.modalAiHint, { textAlign: ta }]}>
                {t('providerFeed.aiPrice', { min: bidModal.target.ai_suggested_price_min, max: bidModal.target.ai_suggested_price_max })}
              </Text>
            )}

            {/* Credit cost hint */}
            {provider?.is_subscribed && (
              <View style={styles.creditCostHint}>
                <Text style={styles.creditCostHintText}>
                  {bidModal.target?.is_urgent
                    ? t('providerFeed.creditCostUrgent')
                    : t('providerFeed.creditCostNormal')}
                  {provider.subscription_tier !== 'premium' && (
                    ` • ${t('providerFeed.creditsRemaining', { count: Math.max(0, (provider.bid_credits ?? 0) - (bidModal.target?.is_urgent ? CREDIT_COST.urgent : CREDIT_COST.normal)) })}`
                  )}
                </Text>
              </View>
            )}

            <Text style={[styles.modalLabel, { textAlign: ta }]}>{t('providerFeed.bidAmountLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={bidModal.amount}
              onChangeText={text => setBidModal(prev => ({ ...prev, amount: sanitizeAmount(text) }))}
              textAlign={ta}
            />

            <Text style={[styles.modalLabel, { textAlign: ta }]}>{t('providerFeed.bidNote')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t('providerFeed.bidWhyPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={bidModal.note}
              onChangeText={text => setBidModal(prev => ({ ...prev, note: text }))}
              textAlign={ta}
              multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setBidModal(prev => ({ ...prev, target: null, amount: '', note: '' }))}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, (!bidModal.amount || bidModal.loading) && styles.btnDisabled]}
                onPress={submitBid}
                disabled={!bidModal.amount || bidModal.loading}
              >
                {bidModal.loading
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.modalSubmitText}>{t('providerFeed.sendBid')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Contract Bid Modal ───────────────────────────────── */}
      <Modal visible={!!contractModal.target} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            <View style={cBidStyles.header}>
              <Text style={cBidStyles.badge}>{t('providerFeed.contractBadge')}</Text>
            </View>
            <Text style={[styles.modalTitle, { textAlign: ta }]}>{contractModal.target?.title}</Text>
            {contractModal.target && (
              <View style={cBidStyles.summary}>
                <Text style={[cBidStyles.summaryText, { textAlign: ta }]}>
                  {t(`providerFeed.freq${contractModal.target.frequency.charAt(0).toUpperCase() + contractModal.target.frequency.slice(1)}` as any)} · {contractModal.target.duration_months} · {' '}
                  {t('providerFeed.contractVisitCount', { count: FREQ_VISITS_PER_MONTH[contractModal.target.frequency] * contractModal.target.duration_months })}
                </Text>
              </View>
            )}
            <Text style={[styles.modalLabel, { textAlign: ta }]}>{t('providerFeed.contractVisitPriceLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={contractModal.amount}
              onChangeText={text => setContractModal(prev => ({ ...prev, amount: sanitizeAmount(text) }))}
              textAlign="right"
            />
            {contractModal.amount && contractModal.target && !isNaN(parseFloat(contractModal.amount)) && (
              <View style={cBidStyles.totalBox}>
                <Text style={cBidStyles.totalLabel}>{t('providerFeed.contractTotalExpected')}</Text>
                <Text style={cBidStyles.totalValue}>
                  {calcContractTotal(parseFloat(contractModal.amount), contractModal.target.frequency, contractModal.target.duration_months).toFixed(0)} د.أ
                </Text>
              </View>
            )}
            <Text style={[styles.modalLabel, { textAlign: ta }]}>{t('providerFeed.bidNote')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t('providerFeed.contractNotePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={contractModal.note}
              onChangeText={text => setContractModal(prev => ({ ...prev, note: text }))}
              textAlign={ta}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setContractModal(prev => ({ ...prev, target: null, amount: '', note: '' }))}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cBidStyles.submitBtn, (!contractModal.amount || contractModal.loading) && styles.btnDisabled]}
                onPress={submitContractBid}
                disabled={!contractModal.amount || contractModal.loading}
              >
                {contractModal.loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={cBidStyles.submitBtnText}>{t('providerFeed.contractSendBid')}</Text>
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
            <Text style={[urgentStyles.acceptTitle, { textAlign: ta }]}>{t('providerFeed.urgentAcceptTitle')}</Text>
            <Text style={[urgentStyles.acceptSubtitle, { textAlign: ta }]}>{urgentModal.target?.title}</Text>

            <View style={[urgentStyles.acceptRow, { flexDirection: flexRow(isRTL) }]}>
              <Text style={urgentStyles.acceptLabel}>{t('providerFeed.urgentServiceLabel')}</Text>
              <Text style={urgentStyles.acceptValue}>
                {urgentModal.target?.category?.name_ar ?? urgentModal.target?.category_slug}
              </Text>
            </View>
            <View style={[urgentStyles.acceptRow, { flexDirection: flexRow(isRTL) }]}>
              <Text style={urgentStyles.acceptLabel}>{t('providerFeed.urgentCityLabel')}</Text>
              <Text style={urgentStyles.acceptValue}>{urgentModal.target?.city}</Text>
            </View>
            <View style={[urgentStyles.acceptRow, { flexDirection: flexRow(isRTL) }]}>
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
                  <Text style={[urgentStyles.acceptPriceTipText, { textAlign: ta }]}>
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
              <Text style={[urgentStyles.acceptCommitText, { textAlign: ta }]}>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: contentPad }]}>
            {/* Header */}
            <View style={demoBidStyles.header}>
              <View style={demoBidStyles.badge}>
                <Text style={demoBidStyles.badgeText}>🎯 {t('providerFeed.demoBidSheetTitle')}</Text>
              </View>
            </View>
            <Text style={[styles.modalSubtitle, { textAlign: ta }]}>
              {demoStatus?.request?.title}
            </Text>

            {/* Free note */}
            <View style={demoBidStyles.freeBox}>
              <Text style={[demoBidStyles.freeText, { textAlign: ta }]}>
                💡 {t('providerFeed.demoBidSheetInfo')}
              </Text>
            </View>

            {/* Credits safe */}
            {provider?.is_subscribed && (
              <View style={styles.creditCostHint}>
                <Text style={styles.creditCostHintText}>
                  {t('providerFeed.demoCreditsSafe', { count: provider.bid_credits ?? 0 })}
                </Text>
              </View>
            )}

            <Text style={[styles.modalLabel, { textAlign: ta }]}>{t('providerFeed.bidAmountLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={demoModal.amount}
              onChangeText={text => setDemoModal(prev => ({ ...prev, amount: sanitizeAmount(text) }))}
              textAlign={ta}
            />

            <Text style={[styles.modalLabel, { textAlign: ta }]}>{t('providerFeed.bidNote')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder={t('providerFeed.bidWhyPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={demoModal.note}
              onChangeText={text => setDemoModal(prev => ({ ...prev, note: text }))}
              textAlign={ta}
              multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDemoModal(prev => ({ ...prev, open: false, amount: '', note: '' }))}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[demoBidStyles.submitBtn, (!demoModal.amount || demoModal.loading) && styles.btnDisabled]}
                onPress={submitDemoBid}
                disabled={!demoModal.amount || demoModal.loading}
              >
                {demoModal.loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={demoBidStyles.submitBtnText}>{t('providerFeed.demoSubmitBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Demo Success Modal ────────────────────────────────── */}
      <DemoSuccessModal
        visible={demoSuccess}
        credits={provider?.bid_credits ?? 0}
        onClose={() => setDemoSuccess(false)}
      />

    </View>
  );
}

function createDemoBidStyles(_colors: AppColors) {
  return StyleSheet.create({
  header:     { marginBottom: 4 },
  badge:      { backgroundColor: DEMO_COLOR, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  badgeText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  freeBox:    { backgroundColor: DEMO_SOFT, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: DEMO_BORDER },
  freeText:   { fontSize: 12, color: DEMO_TEXT, lineHeight: 18 },
  submitBtn:  { flex: 2, backgroundColor: DEMO_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  // ── Pending commit banner
  commitBanner:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C4A6E', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(56,189,248,0.25)', gap: 10 },
  commitBannerUrgent:     { backgroundColor: '#450A0A', borderBottomColor: 'rgba(239,68,68,0.3)' },
  commitBannerTitle:      { fontSize: 13, fontWeight: '800', color: '#7DD3FC', textAlign: 'auto' },
  commitBannerTitleUrgent:{ color: '#FCA5A5' },
  commitBannerSub:        { fontSize: 11, color: '#475569', textAlign: 'auto', marginTop: 2 },
  commitBannerArrow:      { fontSize: 18, color: '#38BDF8', fontWeight: '700' },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: HEADER_PAD,
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
  card:       { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardLocked: { opacity: 0.82 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCat:    { fontSize: 12, color: colors.textMuted },
  cardTime:   { fontSize: 12, color: colors.textMuted },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 8 },
  cardDesc:   { fontSize: 13, color: colors.textSecondary, textAlign: 'auto', lineHeight: 20, marginBottom: 12 },

  blurContainer: { marginBottom: 12, position: 'relative' },
  blurText:      { fontSize: 13, color: colors.textSecondary, textAlign: 'auto', lineHeight: 20 },
  blurOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, opacity: 0.88, borderRadius: 6 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardCity:   { fontSize: 12, color: colors.textMuted },
  bidsCount:  { fontSize: 12, color: colors.textSecondary },
  aiPrice:    { fontSize: 13, color: colors.accent, fontWeight: '600' },

  bidBtn:           { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  bidBtnLocked:     { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bidBtnText:       { fontSize: 13, fontWeight: '700', color: colors.bg },
  bidBtnTextLocked: { color: colors.textMuted },

  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted },

  // ── Modals
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 4 },
  modalSubtitle:{ fontSize: 14, color: colors.textMuted, textAlign: 'auto', marginBottom: 16 },
  modalAiHint:  { fontSize: 13, color: colors.accent, textAlign: 'auto', marginBottom: 16, fontWeight: '600' },
  modalLabel:   { fontSize: 13, color: colors.textSecondary, textAlign: 'auto', marginBottom: 8, marginTop: 12 },
  modalInput:   { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border },
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
  });
}
// ── Contract bid modal styles
function createCBidStyles(colors: AppColors) {
  return StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  badge:      { backgroundColor: CONTRACT_DIM, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: CONTRACT_COLOR },
  summary:    { backgroundColor: CONTRACT_DIM, borderRadius: 10, padding: 10, marginBottom: 4, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  summaryText:{ fontSize: 13, color: CONTRACT_COLOR, fontWeight: '600', textAlign: 'auto' },
  totalBox:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CONTRACT_DIM, borderRadius: 10, padding: 12, marginVertical: 8, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 18, fontWeight: '800', color: CONTRACT_COLOR },
  submitBtn:  { flex: 2, backgroundColor: CONTRACT_COLOR, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  });
}
