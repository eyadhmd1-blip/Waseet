// ============================================================
// WASEET — ProviderSubHeader
// Sticky status bar rendered BELOW the AppHeader on provider
// tab screens. Shows bid credit status with color coding:
//
//   Credits = 0        → red   (cannot bid)
//   Credits 1–3        → amber (low warning)
//   Credits 4+         → subtle surface (normal)
//   tier = 'premium'   → hidden (unlimited)
//   !isSubscribed      → red   (must subscribe)
//
// Tapping always navigates to subscribe screen via onUpgrade.
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../hooks/useLanguage';
import type { AppColors } from '../constants/colors';

interface Props {
  bidCredits:       number;
  subscriptionTier: string;
  isSubscribed:     boolean;
  onUpgrade:        () => void;
}

export function ProviderSubHeader({
  bidCredits, subscriptionTier, isSubscribed, onUpgrade,
}: Props) {
  const { colors } = useTheme();
  const { lang }   = useLanguage();
  const isRTL      = lang === 'ar';

  // Premium = unlimited → bar is irrelevant, hide it
  if (subscriptionTier === 'premium') return null;

  // Not subscribed at all
  if (!isSubscribed) {
    return (
      <Bar
        bg={colors.errorBg}
        border="rgba(239,68,68,0.3)"
        text={isRTL ? '⚠️ غير مشترك — اشترك للبدء في تقديم العروض' : '⚠️ Not subscribed — subscribe to start bidding'}
        cta={isRTL ? 'اشترك ›' : 'Subscribe ›'}
        ctaColor={colors.errorSoft}
        textColor={colors.errorSoft}
        onPress={onUpgrade}
      />
    );
  }

  // Zero credits
  if (bidCredits === 0) {
    return (
      <Bar
        bg={colors.errorBg}
        border="rgba(239,68,68,0.3)"
        text={isRTL ? '🔴 نفد رصيدك — لا يمكنك تقديم عروض الآن' : '🔴 No credits left — renew to continue bidding'}
        cta={isRTL ? 'جدّد الآن ›' : 'Renew ›'}
        ctaColor={colors.errorSoft}
        textColor={colors.errorSoft}
        onPress={onUpgrade}
      />
    );
  }

  // Low credits (1–3)
  if (bidCredits <= 3) {
    return (
      <Bar
        bg="#78350F"
        border="rgba(245,158,11,0.3)"
        text={isRTL ? `⚠️ تبقّى ${bidCredits} رصيد فقط` : `⚠️ Only ${bidCredits} credits left`}
        cta={isRTL ? 'جدّد ›' : 'Renew ›'}
        ctaColor="#FCD34D"
        textColor="#FCD34D"
        onPress={onUpgrade}
      />
    );
  }

  // Normal state (4+ credits) — informational only, no CTA
  return (
    <View style={[s.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Text style={[s.text, { color: colors.textMuted }]}>
        {isRTL ? `💳 ${bidCredits} رصيد متبقٍ` : `💳 ${bidCredits} credits remaining`}
      </Text>
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
  cta: {
    fontSize:    13,
    fontWeight:  '700',
    marginStart: 10,
  },
});
