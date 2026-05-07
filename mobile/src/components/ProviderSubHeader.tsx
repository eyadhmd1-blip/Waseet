// ============================================================
// WASEET — ProviderSubHeader
// Two-wallet credit display + active-bids indicator.
//
// Layout per state:
//   Not subscribed    → red bar, subscribe CTA
//   Subscription exp  → red bar, bonus credits shown frozen 🔒
//   Zero sub credits  → red bar + bonus credits hint
//   Low sub (1-3)     → amber bar + bonus credits hint
//   Normal            → surface bar: 📦 sub | 🏆 bonus | 🎯 X/Y
//   Premium           → surface bar: ♾️ unlimited | 🏆 bonus → +N slots | 🎯 X/Y
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../hooks/useLanguage';
import { CONCURRENT_BID_CAP } from '../constants/categories';
import type { AppColors } from '../constants/colors';

const PREMIUM_BASE_SLOTS   = 8;
const BONUS_CREDITS_PER_SLOT = 5;
const PREMIUM_MAX_SLOTS    = 12;

interface Props {
  subscriptionCredits:  number;
  bonusCredits:         number;
  subscriptionTier:     string;
  isSubscribed:         boolean;
  subscriptionEnds?:    string;
  activeBidCount?:      number;   // current pending bids
  onUpgrade:            () => void;
}

export function ProviderSubHeader({
  subscriptionCredits, bonusCredits, subscriptionTier,
  isSubscribed, subscriptionEnds, activeBidCount = 0, onUpgrade,
}: Props) {
  const { colors } = useTheme();
  const { lang }   = useLanguage();
  const isRTL      = lang === 'ar';

  const isExpired = isSubscribed && subscriptionEnds
    ? new Date(subscriptionEnds) < new Date()
    : false;

  // Compute max concurrent bids for this tier
  const maxBids = subscriptionTier === 'premium'
    ? Math.min(PREMIUM_BASE_SLOTS + Math.floor(bonusCredits / BONUS_CREDITS_PER_SLOT), PREMIUM_MAX_SLOTS)
    : (CONCURRENT_BID_CAP[subscriptionTier] ?? 2);

  // Indicator colour: green ok, amber 1-away, red at-cap
  const atCap      = activeBidCount >= maxBids;
  const nearCap    = !atCap && activeBidCount >= maxBids - 1;
  const indicatorColor = atCap ? '#EF4444' : nearCap ? '#F59E0B' : '#22C55E';

  const bidIndicator = isSubscribed && !isExpired
    ? (isRTL
        ? `🎯 ${activeBidCount}/${maxBids} عروض`
        : `🎯 ${activeBidCount}/${maxBids} bids`)
    : null;

  // ── Premium ─────────────────────────────────────────────────
  if (subscriptionTier === 'premium' && isSubscribed && !isExpired) {
    const extraSlots = Math.floor(bonusCredits / BONUS_CREDITS_PER_SLOT);
    const totalSlots = Math.min(PREMIUM_BASE_SLOTS + extraSlots, PREMIUM_MAX_SLOTS);
    return (
      <View style={[s.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[s.text, { color: colors.textMuted }]}>
          {isRTL ? '♾️ غير محدود' : '♾️ Unlimited'}
        </Text>
        {bonusCredits > 0 && (
          <Text style={[s.mid, { color: colors.textMuted }]}>
            {isRTL
              ? `🏆 ${bonusCredits} → ${totalSlots} خانات`
              : `🏆 ${bonusCredits} → ${totalSlots} slots`}
          </Text>
        )}
        {bidIndicator && (
          <Text style={[s.right, { color: indicatorColor }]}>{bidIndicator}</Text>
        )}
      </View>
    );
  }

  // ── Not subscribed ───────────────────────────────────────────
  if (!isSubscribed) {
    return (
      <Bar
        bg={colors.errorBg}
        border="rgba(239,68,68,0.3)"
        text={isRTL ? '⚠️ غير مشترك — اشترك للبدء' : '⚠️ Not subscribed — subscribe to start'}
        cta={isRTL ? 'اشترك ›' : 'Subscribe ›'}
        ctaColor={colors.errorSoft}
        textColor={colors.errorSoft}
        onPress={onUpgrade}
      />
    );
  }

  // ── Subscription expired (bonus frozen) ─────────────────────
  if (isExpired) {
    return (
      <Bar
        bg={colors.errorBg}
        border="rgba(239,68,68,0.3)"
        text={
          isRTL
            ? bonusCredits > 0
              ? `🔒 ${bonusCredits} رصيد مكافأة مجمَّد — جدّد للاستخدام`
              : '⚠️ انتهى اشتراكك — جدّد الآن'
            : bonusCredits > 0
              ? `🔒 ${bonusCredits} bonus credits frozen — renew to unlock`
              : '⚠️ Subscription expired — renew now'
        }
        cta={isRTL ? 'جدّد ›' : 'Renew ›'}
        ctaColor={colors.errorSoft}
        textColor={colors.errorSoft}
        onPress={onUpgrade}
      />
    );
  }

  // ── Zero subscription credits ────────────────────────────────
  if (subscriptionCredits === 0 && bonusCredits === 0) {
    return (
      <Bar
        bg={colors.errorBg}
        border="rgba(239,68,68,0.3)"
        text={isRTL ? '🔴 نفد الرصيد — جدّد الآن' : '🔴 No credits left — renew now'}
        cta={isRTL ? 'جدّد ›' : 'Renew ›'}
        ctaColor={colors.errorSoft}
        textColor={colors.errorSoft}
        onPress={onUpgrade}
      />
    );
  }

  if (subscriptionCredits === 0 && bonusCredits > 0) {
    return (
      <Bar
        bg={colors.errorBg}
        border="rgba(239,68,68,0.3)"
        text={
          isRTL
            ? `🔴 نفد رصيد الاشتراك  •  🏆 ${bonusCredits} مكافأة متبقية`
            : `🔴 No subscription credits  •  🏆 ${bonusCredits} bonus left`
        }
        cta={isRTL ? 'جدّد ›' : 'Renew ›'}
        ctaColor={colors.errorSoft}
        textColor={colors.errorSoft}
        onPress={onUpgrade}
      />
    );
  }

  // ── Low subscription credits (1–3) ──────────────────────────
  if (subscriptionCredits <= 3) {
    return (
      <Bar
        bg="#78350F"
        border="rgba(245,158,11,0.3)"
        text={
          isRTL
            ? `⚠️ ${subscriptionCredits} رصيد اشتراك  •  🏆 ${bonusCredits} مكافأة`
            : `⚠️ ${subscriptionCredits} sub credits  •  🏆 ${bonusCredits} bonus`
        }
        cta={isRTL ? 'جدّد ›' : 'Renew ›'}
        ctaColor="#FCD34D"
        textColor="#FCD34D"
        onPress={onUpgrade}
      />
    );
  }

  // ── Normal state ─────────────────────────────────────────────
  return (
    <View style={[s.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Text style={[s.text, { color: colors.textMuted }]}>
        {isRTL ? `📦 ${subscriptionCredits} اشتراك` : `📦 ${subscriptionCredits} sub`}
      </Text>
      <Text style={[s.mid, { color: colors.textMuted }]}>
        {isRTL ? `🏆 ${bonusCredits} مكافأة` : `🏆 ${bonusCredits} bonus`}
      </Text>
      {bidIndicator && (
        <Text style={[s.right, { color: indicatorColor }]}>{bidIndicator}</Text>
      )}
    </View>
  );
}

// ─── Internal Bar helper ──────────────────────────────────────

interface BarProps {
  bg:        string;
  border:    string;
  text:      string;
  cta?:      string;
  ctaColor?: string;
  textColor: string;
  onPress:   () => void;
}

function Bar({ bg, border, text, cta, ctaColor, textColor, onPress }: BarProps) {
  return (
    <TouchableOpacity
      style={[s.bar, { backgroundColor: bg, borderBottomColor: border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[s.text, { color: textColor }]} numberOfLines={1}>{text}</Text>
      {cta ? (
        <Text style={[s.cta, { color: ctaColor ?? textColor }]}>{cta}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  bar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderBottomWidth: 1,
  },
  text: {
    fontSize:   13,
    fontWeight: '500',
    flex:       1,
  },
  mid: {
    fontSize:    13,
    fontWeight:  '500',
    marginStart: 8,
  },
  right: {
    fontSize:    13,
    fontWeight:  '700',
    marginStart: 8,
  },
  cta: {
    fontSize:    13,
    fontWeight:  '700',
    marginStart: 10,
  },
});
