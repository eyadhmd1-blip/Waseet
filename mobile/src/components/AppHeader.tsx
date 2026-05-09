// ============================================================
// WASEET — AppHeader  (redesigned — rich root variant)
//
// Variants:
//   'root'  → Rich 2-row header for tab home screens
//   'stack' → Back + title + optional action
//   'modal' → Close + title + optional step counter
// ============================================================

import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, I18nManager,
  Animated, Easing,
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
  providerRepTier?:          string;
  providerLifetimeJobs?:     number;
  providerBidCredits?:       number;
  providerBonusCredits?:     number;
  providerSubscriptionTier?: string;
  providerIsAvailable?:      boolean;

  // ── stack ──────────────────────────────────────────────────
  title?:       string;
  onBack?:      () => void;
  actionIcon?:  React.ComponentProps<typeof Ionicons>['name'];
  onAction?:    () => void;
  actionIcon2?: React.ComponentProps<typeof Ionicons>['name'];
  onAction2?:   () => void;

  // ── modal ──────────────────────────────────────────────────
  onClose?:    () => void;
  step?:       number;
  totalSteps?: number;
}

// ─── rowDir helper ────────────────────────────────────────────

function rowDir(wantRTL: boolean): 'row' | 'row-reverse' {
  if (!wantRTL) return 'row';
  return I18nManager.isRTL ? 'row' : 'row-reverse';
}

// ═══════════════════════════════════════════════════════════════
// RootHeader — extracted to isolate hooks from stack/modal paths
// ═══════════════════════════════════════════════════════════════

function RootHeader({
  props, colors, isDark, lang, headerPad, isRTL,
}: {
  props: AppHeaderProps;
  colors: AppColors;
  isDark: boolean;
  lang: string;
  headerPad: number;
  isRTL: boolean;
}) {
  const s = makeStyles(colors, headerPad, isDark);

  const isProvider = props.userRole === 'provider';
  const firstName  = props.userName?.trim().split(' ')[0] ?? '';
  const initial    = firstName.charAt(0).toUpperCase() || '?';
  const greeting   = timeGreeting(lang);
  const count      = props.notifCount ?? 0;

  // Provider stats
  const tier         = props.providerRepTier ?? 'new';
  const tierLabel    = REP_LABEL[tier] ?? tier;
  const tierColor    = REP_COLOR[tier] ?? '#9CA3AF';
  const score        = props.providerScore ?? 0;
  const jobs         = props.providerLifetimeJobs ?? 0;
  const credits      = props.providerBidCredits ?? 0;
  const bonusCredits = props.providerBonusCredits ?? 0;
  const isPremium    = props.providerSubscriptionTier === 'premium';
  const isOnline     = props.providerIsAvailable !== false;

  // ── Animation values ────────────────────────────────────────
  // Row 1 — spring entrance
  const avatarScale = useRef(new Animated.Value(0.3)).current;
  const avatarOp    = useRef(new Animated.Value(0)).current;
  const greetOp     = useRef(new Animated.Value(0)).current;
  const greetY      = useRef(new Animated.Value(10)).current;
  const bellOp      = useRef(new Animated.Value(0)).current;
  const bellY       = useRef(new Animated.Value(10)).current;
  // Row 2 — chip cascade (4 groups)
  const chipAnims   = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;
  // Name glint (JS driver — uses skewX which native driver doesn't support)
  const glintX      = useRef(new Animated.Value(-80)).current;
  // Persistent effects
  const waveAnim    = useRef(new Animated.Value(0)).current;
  const pulseScale  = useRef(new Animated.Value(1)).current;
  const pulseOp     = useRef(new Animated.Value(0)).current;
  const bellBounce  = useRef(new Animated.Value(0)).current;

  // ── Entrance animation — fires once on mount ─────────────────
  useEffect(() => {
    // 1. Avatar — spring scale pop + fade in
    Animated.spring(avatarScale, { toValue: 1, tension: 200, friction: 7, useNativeDriver: true }).start();
    Animated.timing(avatarOp, { toValue: 1, duration: 180, useNativeDriver: true }).start();

    // 2. Greeting — spring slide-up + fade (80ms after avatar)
    setTimeout(() => {
      Animated.spring(greetY, { toValue: 0, tension: 180, friction: 9, useNativeDriver: true }).start();
      Animated.timing(greetOp, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 80);

    // 3. Bell — spring slide-up + fade (160ms after avatar)
    setTimeout(() => {
      Animated.spring(bellY, { toValue: 0, tension: 180, friction: 9, useNativeDriver: true }).start();
      Animated.timing(bellOp, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 160);

    // 4. Row 2 chip cascade — each group springs in 60ms apart
    setTimeout(() => {
      Animated.stagger(60, chipAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 220, friction: 8, useNativeDriver: true })
      )).start();
    }, 240);

    // 5. Name glint — diagonal bar sweeps across once (JS driver: uses skewX)
    setTimeout(() => {
      Animated.timing(glintX, {
        toValue: 240, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start();
    }, 450);

    // 6. 👋 wave sequence
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: -1,   duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue:  1,   duration: 110, easing: Easing.linear,            useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: -0.6, duration: 100, easing: Easing.linear,            useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue:  0.5, duration: 100, easing: Easing.linear,            useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue:  0,   duration: 130, easing: Easing.in(Easing.quad),   useNativeDriver: true }),
      ]).start();
    }, 280);

    // 7. Avatar ripple — expands and fades
    pulseOp.setValue(0.45);
    pulseScale.setValue(1);
    Animated.parallel([
      Animated.timing(pulseScale, { toValue: 2.6, duration: 800, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(pulseOp,    { toValue: 0,   duration: 800, delay: 100, useNativeDriver: true }),
    ]).start();

    // 8. Bell shake if notifications exist on mount
    if (count > 0) {
      setTimeout(() => {
        Animated.timing(bellBounce, { toValue: 1, duration: 540, useNativeDriver: true }).start();
      }, 480);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Bell shake when count goes 0 → positive ──────────────────
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > 0 && prevCount.current === 0) {
      bellBounce.setValue(0);
      Animated.timing(bellBounce, { toValue: 1, duration: 540, useNativeDriver: true }).start();
    }
    prevCount.current = count;
  }, [count]);

  // ── Derived animation styles ─────────────────────────────────

  const avatarStyle = {
    opacity:   avatarOp,
    transform: [{ scale: avatarScale }],
  };

  const greetStyle = {
    opacity:   greetOp,
    transform: [{ translateY: greetY }],
  };

  const bellStyle = {
    opacity:   bellOp,
    transform: [
      { translateY: bellY },
      { rotate: bellBounce.interpolate({
          inputRange:  [0,      0.15,     0.35,    0.55,     0.70,   0.85,    1],
          outputRange: ['0deg', '-18deg', '16deg', '-10deg', '8deg', '-4deg', '0deg'],
        }),
      },
    ],
  };

  // Per-chip style (cascade in row 2)
  const chipStyle = (i: number) => {
    const a = chipAnims[Math.min(i, chipAnims.length - 1)];
    return {
      opacity:   a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
    };
  };

  // 👋 wave rotation
  const waveRotate = waveAnim.interpolate({
    inputRange:  [-1,       0,      1],
    outputRange: ['-28deg', '0deg', '28deg'],
  });

  // Avatar ripple color
  const rippleColor = isProvider ? colors.accent : '#2563EB';

  // ── Render ───────────────────────────────────────────────────

  return (
    <View style={s.rootWrap}>

      {/* ── Row 1: Avatar | Greeting + Name | Bell ──────────── */}
      <View style={[s.row1, { flexDirection: rowDir(isRTL) }]}>

        {/* Avatar with ripple ring */}
        <Animated.View style={[s.avatarBtn, avatarStyle]}>
          {/* Ripple pulse ring — emits outward once on mount */}
          <Animated.View
            pointerEvents="none"
            style={[
              s.ripple,
              { transform: [{ scale: pulseScale }], opacity: pulseOp, backgroundColor: rippleColor },
            ]}
          />
          <TouchableOpacity onPress={props.onAvatarPress} activeOpacity={0.75}>
            <View style={[s.avatar, isProvider ? s.avatarPro : s.avatarCli]}>
              <Text style={s.avatarLetter}>{initial}</Text>
            </View>
            {/* Online dot for provider */}
            {isProvider && (
              <View style={[s.onlineDot, { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Greeting + Name */}
        <Animated.View style={[s.greetBlock, greetStyle]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={s.greetSmall} numberOfLines={1}>{greeting}</Text>
            {/* Animated.View wrapping Text — rotate on View is reliable on Android */}
            <Animated.View style={{ transform: [{ rotate: waveRotate }] }}>
              <Text style={s.waveEmoji}>👋</Text>
            </Animated.View>
          </View>
          <View style={{ overflow: 'hidden' }}>
            <Text style={s.greetName} numberOfLines={1}>
              {firstName || 'وسيط'}
            </Text>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: -4, bottom: -4, width: 22,
                backgroundColor: 'rgba(255,255,255,0.28)',
                transform: [{ skewX: '-20deg' }, { translateX: glintX }],
              }}
            />
          </View>
        </Animated.View>

        {/* Bell */}
        <Animated.View style={bellStyle}>
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
        </Animated.View>

      </View>

      {/* ── Row 2: chip cascade — each group has its own spring ── */}
      <View style={[s.row2, { flexDirection: rowDir(isRTL) }]}>

        {/* Group 0: Role pill */}
        <Animated.View style={chipStyle(0)}>
          <View style={[s.rolePill, isProvider ? s.rolePillPro : s.rolePillCli]}>
            <Text style={[s.roleText, isProvider ? s.roleTextPro : s.roleTextCli]}>
              {isProvider
                ? (isRTL ? 'مزود الخدمة' : 'Service Provider')
                : (isRTL ? 'طالب الخدمة' : 'Client')}
            </Text>
          </View>
        </Animated.View>

        {/* Group 1: Separator */}
        <Animated.View style={chipStyle(1)}>
          <View style={s.sep} />
        </Animated.View>

        {isProvider ? (
          <>
            {/* Group 2: Online status */}
            <Animated.View style={chipStyle(2)}>
              <View style={[s.chip, { backgroundColor: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)', borderColor: isOnline ? 'rgba(34,197,94,0.30)' : 'rgba(156,163,175,0.25)' }]}>
                <Text style={[s.chipText, { color: isOnline ? '#22C55E' : '#9CA3AF' }]}>
                  {isOnline ? '● ' : '⬤ '}{isRTL ? (isOnline ? 'مباشر' : 'غير متاح') : (isOnline ? 'Online' : 'Away')}
                </Text>
              </View>
            </Animated.View>
            {/* Group 3: Tier + score + jobs + credits (all together) */}
            <Animated.View style={[chipStyle(3), { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
              <View style={[s.chip, { backgroundColor: tierColor + '20' }]}>
                <Text style={[s.chipText, { color: tierColor }]}>{tierLabel}</Text>
              </View>
              <View style={s.chip}>
                <Text style={s.chipText}>⭐ {score.toFixed(1)}</Text>
              </View>
              <View style={s.chip}>
                <Text style={s.chipText}>{isRTL ? `${jobs} عمل` : `${jobs} jobs`}</Text>
              </View>
              {isPremium ? (
                <View style={[s.chip, s.chipGold]}>
                  <Text style={[s.chipText, s.chipGoldText]}>{isRTL ? '∞ غير محدود' : '∞ Unlimited'}</Text>
                </View>
              ) : (
                <View style={[s.chip, credits === 0 ? s.chipRed : credits <= 3 ? s.chipAmber : s.chipGold]}>
                  <Text style={[s.chipText, credits === 0 ? s.chipRedText : credits <= 3 ? s.chipAmberText : s.chipGoldText]}>
                    {isRTL ? `${credits} رصيد` : `${credits} cr`}
                  </Text>
                </View>
              )}
              {!isPremium && bonusCredits > 0 && (
                <View style={[s.chip, s.chipGold]}>
                  <Text style={[s.chipText, s.chipGoldText]}>🏆 {bonusCredits}</Text>
                </View>
              )}
            </Animated.View>
          </>
        ) : (
          <>
            {/* Group 2: City chip */}
            {props.userCity ? (
              <Animated.View style={chipStyle(2)}>
                <View style={s.chip}>
                  <Text style={s.chipText}>📍 {props.userCity}</Text>
                </View>
              </Animated.View>
            ) : null}
          </>
        )}

      </View>

      {/* Bottom border */}
      <View style={s.border} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// AppHeader — public component
// ═══════════════════════════════════════════════════════════════

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
    return (
      <RootHeader
        props={props}
        colors={colors}
        isDark={isDark}
        lang={lang}
        headerPad={headerPad}
        isRTL={isRTL}
      />
    );
  }

  // ── Stack ──────────────────────────────────────────────────
  if (props.variant === 'stack') {
    return (
      <View style={[s.base, s.stackBase]}>
        {props.onBack ? (
          <TouchableOpacity
            style={s.iconBtn}
            onPress={props.onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={backIcon} size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={s.iconBtn} pointerEvents="none" />
        )}

        <Text style={s.stackTitle} numberOfLines={1}>{props.title ?? ''}</Text>

        <View style={s.rightActions}>
          {props.actionIcon2 && props.onAction2 && (
            <TouchableOpacity style={s.iconBtn} onPress={props.onAction2} activeOpacity={0.7}>
              <Ionicons name={props.actionIcon2} size={21} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {props.actionIcon && props.onAction ? (
            <TouchableOpacity style={s.iconBtn} onPress={props.onAction} activeOpacity={0.7}>
              <Ionicons name={props.actionIcon} size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : !props.actionIcon2 ? (
            <View style={s.iconBtn} pointerEvents="none" />
          ) : null}
        </View>
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
    rightActions: {
      flexDirection: 'row',
      alignItems:    'center',
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
    stepChip: {},
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

    // Avatar + ripple
    avatarBtn: {
      position: 'relative',
      width: 44,
      height: 44,
    },
    ripple: {
      position:     'absolute',
      width:        44,
      height:       44,
      borderRadius: 22,
      // scale expands from center; opacity fades out
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
    waveEmoji: {
      fontSize:      12,
      // origin point for rotation is center; small offset compensates
      includeFontPadding: false,
    },
    greetName: {
      fontSize:   19,
      fontWeight: '700',
      color:      colors.textPrimary,
    },

    // Bell
    bellBtn: {
      width:           40,
      height:          40,
      alignItems:      'center',
      justifyContent:  'center',
      borderRadius:    20,
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
