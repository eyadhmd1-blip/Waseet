// ============================================================
// WASEET — AppHeader  (redesigned — rich root variant)
//
// Variants:
//   'root'  → Rich 2-row header for tab home screens
//   'stack' → Back + title + optional action
//   'modal' → Close + title + optional step counter
// ============================================================

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme }    from '../context/ThemeContext';
import { useLanguage } from '../hooks/useLanguage';
import { useInsets }   from '../hooks/useInsets';
import type { AppColors } from '../constants/colors';

// ─── Reputation tier labels ────────────────────────────────
const REP_LABEL: Record<string, string> = {
  new:     'جديد',
  rising:  'صاعد',
  trusted: 'موثَّق',
  expert:  'خبير',
  elite:   'نخبة',
};
const REP_COLOR: Record<string, string> = {
  new:     '#9CA3AF',
  rising:  '#F59E0B',
  trusted: '#3B82F6',
  expert:  '#8B5CF6',
  elite:   '#10B981',
};

function timeGreeting(lang: string): string {
  const h = new Date().getHours();
  if (lang === 'ar') {
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مساء الخير';
    return 'مساء النور';
  }
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Types ────────────────────────────────────────────────────

export type AppHeaderVariant = 'root' | 'stack' | 'modal';

export interface AppHeaderProps {
  variant: AppHeaderVariant;

  // ── root ───────────────────────────────────────────────────
  userName?:      string;
  userRole?:      'provider' | 'client';
  notifCount?:    number;
  onNotifPress?:  () => void;
  onAvatarPress?: () => void;

  // root — client extras
  userCity?: string;

  // root — provider extras
  providerScore?:            number;
  providerRepTier?:          string;   // 'new' | 'rising' | 'trusted' | 'expert' | 'elite'
  providerLifetimeJobs?:     number;
  providerBidCredits?:       number;
  providerSubscriptionTier?: string;   // 'trial' | 'basic' | 'pro' | 'premium'
  providerIsAvailable?:      boolean;

  // ── stack ──────────────────────────────────────────────────
  title?:      string;
  onBack?:     () => void;
  actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onAction?:   () => void;

  // ── modal ──────────────────────────────────────────────────
  onClose?:    () => void;
  step?:       number;
  totalSteps?: number;
}

// ─── Component ────────────────────────────────────────────────

// Safe row direction: works whether I18nManager.forceRTL has taken
// effect (production / Android) or not (Expo Go on iOS first load).
function rowDir(wantRTL: boolean): 'row' | 'row-reverse' {
  if (!wantRTL) return 'row';
  return I18nManager.isRTL ? 'row' : 'row-reverse';
}

export function AppHeader(props: AppHeaderProps) {
  const { colors, isDark } = useTheme();
  const { lang }           = useLanguage();
  const { headerPad }      = useInsets();
  const isRTL              = lang === 'ar';
  const s                  = makeStyles(colors, headerPad, isDark);

  const backIcon: React.ComponentProps<typeof Ionicons>['name'] =
    isRTL ? 'chevron-forward' : 'chevron-back';

  // ── Root ───────────────────────────────────────────────────
  if (props.variant === 'root') {
    const isProvider = props.userRole === 'provider';
    const firstName  = props.userName?.trim().split(' ')[0] ?? '';
    const initial    = firstName.charAt(0).toUpperCase() || '?';
    const greeting   = timeGreeting(lang);
    const count      = props.notifCount ?? 0;

    // Provider stats
    const tier      = props.providerRepTier ?? 'new';
    const tierLabel = REP_LABEL[tier] ?? tier;
    const tierColor = REP_COLOR[tier] ?? '#9CA3AF';
    const score     = props.providerScore ?? 0;
    const jobs      = props.providerLifetimeJobs ?? 0;
    const credits   = props.providerBidCredits ?? 0;
    const isPremium = props.providerSubscriptionTier === 'premium';
    const isOnline  = props.providerIsAvailable !== false; // default true

    return (
      <View style={s.rootWrap}>
        {/* ── Row 1: Avatar | Greeting + Name | Bell ─────────── */}
        <View style={[s.row1, { flexDirection: rowDir(isRTL) }]}>

          {/* Avatar */}
          <TouchableOpacity
            onPress={props.onAvatarPress}
            activeOpacity={0.75}
            style={s.avatarBtn}
          >
            <View style={[s.avatar, isProvider ? s.avatarPro : s.avatarCli]}>
              <Text style={s.avatarLetter}>{initial}</Text>
            </View>
            {/* Online dot for provider */}
            {isProvider && (
              <View style={[s.onlineDot, { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
            )}
          </TouchableOpacity>

          {/* Greeting + Name */}
          <View style={s.greetBlock}>
            <Text style={s.greetSmall} numberOfLines={1}>
              {greeting} 👋
            </Text>
            <Text style={s.greetName} numberOfLines={1}>
              {firstName || 'وسيط'}
            </Text>
          </View>

          {/* Bell */}
          <TouchableOpacity
            style={s.bellBtn}
            onPress={props.onNotifPress}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={count > 0 ? 'notifications' : 'notifications-outline'}
              size={22}
              color={count > 0 ? colors.accent : colors.textSecondary}
            />
            {count > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Row 2: Role pill + contextual info chips ────────── */}
        <View style={[s.row2, { flexDirection: rowDir(isRTL) }]}>

          {/* Role pill */}
          <View style={[s.rolePill, isProvider ? s.rolePillPro : s.rolePillCli]}>
            <Text style={[s.roleText, isProvider ? s.roleTextPro : s.roleTextCli]}>
              {isProvider
                ? (isRTL ? 'مزود الخدمة' : 'Service Provider')
                : (isRTL ? 'طالب الخدمة' : 'Client')}
            </Text>
          </View>

          {/* Separator */}
          <View style={s.sep} />

          {isProvider ? (
            /* ── Provider chips ── */
            <>
              {/* Online status */}
              <View style={[s.chip, { backgroundColor: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)', borderColor: isOnline ? 'rgba(34,197,94,0.30)' : 'rgba(156,163,175,0.25)' }]}>
                <Text style={[s.chipText, { color: isOnline ? '#22C55E' : '#9CA3AF' }]}>
                  {isOnline ? '● ' : '⬤ '}{isRTL ? (isOnline ? 'مباشر' : 'غير متاح') : (isOnline ? 'Online' : 'Away')}
                </Text>
              </View>

              {/* Reputation tier */}
              <View style={[s.chip, { backgroundColor: tierColor + '20' }]}>
                <Text style={[s.chipText, { color: tierColor }]}>
                  {tierLabel}
                </Text>
              </View>

              {/* Score */}
              <View style={s.chip}>
                <Text style={s.chipText}>⭐ {score.toFixed(1)}</Text>
              </View>

              {/* Jobs count */}
              <View style={s.chip}>
                <Text style={s.chipText}>
                  {isRTL ? `${jobs} عمل` : `${jobs} jobs`}
                </Text>
              </View>

              {/* Bid credits */}
              {isPremium ? (
                <View style={[s.chip, s.chipGold]}>
                  <Text style={[s.chipText, s.chipGoldText]}>
                    {isRTL ? '∞ غير محدود' : '∞ Unlimited'}
                  </Text>
                </View>
              ) : (
                <View style={[s.chip, credits === 0 ? s.chipRed : credits <= 3 ? s.chipAmber : s.chipGold]}>
                  <Text style={[s.chipText, credits === 0 ? s.chipRedText : credits <= 3 ? s.chipAmberText : s.chipGoldText]}>
                    💳 {isRTL ? `${credits} رصيد` : `${credits} cr`}
                  </Text>
                </View>
              )}
            </>
          ) : (
            /* ── Client chips ── */
            <>
              {props.userCity ? (
                <View style={s.chip}>
                  <Text style={s.chipText}>📍 {props.userCity}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Bottom border */}
        <View style={s.border} />
      </View>
    );
  }

  // ── Stack ──────────────────────────────────────────────────
  if (props.variant === 'stack') {
    return (
      <View style={[s.base, s.stackBase]}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={props.onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={backIcon} size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={s.stackTitle} numberOfLines={1}>{props.title ?? ''}</Text>

        {props.actionIcon && props.onAction ? (
          <TouchableOpacity style={s.iconBtn} onPress={props.onAction} activeOpacity={0.7}>
            <Ionicons name={props.actionIcon} size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={s.iconBtn} pointerEvents="none" />
        )}
      </View>
    );
  }

  // ── Modal ──────────────────────────────────────────────────
  const hasStep = props.step !== undefined && props.totalSteps !== undefined;

  return (
    <View style={[s.base, s.modalBase]}>
      <TouchableOpacity
        style={s.iconBtn}
        onPress={props.onClose}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      <Text style={s.modalTitle} numberOfLines={1}>{props.title ?? ''}</Text>

      {hasStep ? (
        <View style={[s.iconBtn, s.stepChip]}>
          <Text style={s.stepText}>{props.step} / {props.totalSteps}</Text>
        </View>
      ) : (
        <View style={s.iconBtn} pointerEvents="none" />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const ICON_BTN = 44;

function makeStyles(colors: AppColors, headerPad: number, isDark: boolean) {
  const surfaceTint = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  return StyleSheet.create({

    // ── Shared base (stack / modal) ─────────────────────────
    base: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingTop:        headerPad,
      paddingBottom:     8,
      paddingHorizontal: 8,
      backgroundColor:   colors.bg,
      minHeight:         headerPad + 52,
    },
    stackBase: {
      justifyContent:    'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalBase: {
      justifyContent: 'space-between',
    },
    iconBtn: {
      width:          ICON_BTN,
      height:         ICON_BTN,
      alignItems:     'center',
      justifyContent: 'center',
    },
    stackTitle: {
      flex:       1,
      fontSize:   17,
      fontWeight: '600',
      color:      colors.textPrimary,
      textAlign:  'center',
    },
    modalTitle: {
      flex:       1,
      fontSize:   16,
      fontWeight: '500',
      color:      colors.textSecondary,
      textAlign:  'center',
    },
    stepChip:  {},
    stepText: {
      fontSize:   13,
      fontWeight: '600',
      color:      colors.textMuted,
    },

    // ── Root wrapper ────────────────────────────────────────
    rootWrap: {
      backgroundColor:   colors.bg,
      paddingTop:        headerPad,
      paddingHorizontal: 16,
      paddingBottom:     10,
    },
    border: {
      height:          1,
      backgroundColor: colors.border,
      marginTop:       10,
    },

    // Row 1
    row1: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            10,
      marginBottom:   6,
    },

    // Avatar
    avatarBtn: {
      position: 'relative',
    },
    avatar: {
      width:          44,
      height:         44,
      borderRadius:   22,
      alignItems:     'center',
      justifyContent: 'center',
    },
    avatarPro: {
      backgroundColor: colors.accent,
    },
    avatarCli: {
      backgroundColor: '#2563EB',
    },
    avatarLetter: {
      fontSize:   18,
      fontWeight: '700',
      color:      '#fff',
    },
    onlineDot: {
      position:     'absolute',
      bottom:       1,
      right:        1,
      width:        11,
      height:       11,
      borderRadius: 6,
      borderWidth:  2,
      borderColor:  colors.bg,
    },

    // Greeting
    greetBlock: {
      flex: 1,
    },
    greetSmall: {
      fontSize:   12,
      color:      colors.textMuted,
      marginBottom: 1,
    },
    greetName: {
      fontSize:   19,
      fontWeight: '700',
      color:      colors.textPrimary,
    },

    // Bell
    bellBtn: {
      width:          40,
      height:         40,
      alignItems:     'center',
      justifyContent: 'center',
      borderRadius:   20,
      backgroundColor: surfaceTint,
    },
    badge: {
      position:          'absolute',
      top:               4,
      right:             4,
      minWidth:          16,
      height:            16,
      borderRadius:      8,
      backgroundColor:   '#EF4444',
      alignItems:        'center',
      justifyContent:    'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      fontSize:   9,
      fontWeight: '700',
      color:      '#FFF',
    },

    // Row 2
    row2: {
      flexDirection: 'row',
      alignItems:    'center',
      flexWrap:      'wrap',
      gap:           6,
    },

    // Role pill
    rolePill: {
      borderRadius:      20,
      paddingHorizontal: 10,
      paddingVertical:   4,
    },
    rolePillPro: { backgroundColor: 'rgba(201,168,76,0.15)' },
    rolePillCli: { backgroundColor: 'rgba(59,130,246,0.12)' },
    roleText:    { fontSize: 12, fontWeight: '700' },
    roleTextPro: { color: colors.accent },
    roleTextCli: { color: '#3B82F6' },

    // Separator dot
    sep: {
      width:           4,
      height:          4,
      borderRadius:    2,
      backgroundColor: colors.border,
    },

    // Info chips
    chip: {
      borderRadius:      16,
      paddingHorizontal: 8,
      paddingVertical:   3,
      backgroundColor:   colors.surface,
      borderWidth:       1,
      borderColor:       colors.border,
    },
    chipText: {
      fontSize:   11,
      fontWeight: '600',
      color:      colors.textSecondary,
    },

    // Colored credit chip variants
    chipGold:      { backgroundColor: 'rgba(201,168,76,0.12)', borderColor: 'rgba(201,168,76,0.30)' },
    chipGoldText:  { color: colors.accent },
    chipAmber:     { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.30)' },
    chipAmberText: { color: '#F59E0B' },
    chipRed:       { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.25)' },
    chipRedText:   { color: '#EF4444' },
  });
}
