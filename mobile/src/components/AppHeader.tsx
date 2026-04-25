// ============================================================
// WASEET — AppHeader
// Unified fixed header component — 3 variants:
//   'root'  → Tab root screens (avatar + logo + bell)
//   'stack' → Stack screens    (back  + title + action?)
//   'modal' → Creation flows   (close + title + step?)
//
// RTL-aware: back/close slot flips automatically via React Native
// RTL layout. Ionicons chevron direction is manually corrected.
// Theme-aware: uses colors from ThemeContext.
// ============================================================

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../hooks/useLanguage';
import { useInsets } from '../hooks/useInsets';
import type { AppColors } from '../constants/colors';

// ─── Types ────────────────────────────────────────────────────

export type AppHeaderVariant = 'root' | 'stack' | 'modal';

export interface AppHeaderProps {
  variant: AppHeaderVariant;

  // ── root only ──────────────────────────────────────────────
  userName?:      string;
  userRole?:      'provider' | 'client';
  notifCount?:    number;
  onNotifPress?:  () => void;
  onAvatarPress?: () => void;

  // ── stack only ─────────────────────────────────────────────
  title?:      string;
  onBack?:     () => void;
  actionIcon?: React.ComponentProps<typeof Ionicons>['name'];
  onAction?:   () => void;

  // ── modal only ─────────────────────────────────────────────
  onClose?:    () => void;
  step?:       number;
  totalSteps?: number;
}

// ─── Component ────────────────────────────────────────────────

export function AppHeader(props: AppHeaderProps) {
  const { colors }    = useTheme();
  const { lang }      = useLanguage();
  const { headerPad } = useInsets();
  const isRTL         = lang === 'ar';
  const s             = makeStyles(colors, headerPad);

  // In RTL layout, React Native flips row direction automatically.
  // chevron-back points left (correct for LTR), chevron-forward
  // points right (correct for RTL — "back" goes rightward).
  const backIcon: React.ComponentProps<typeof Ionicons>['name'] =
    isRTL ? 'chevron-forward' : 'chevron-back';

  // ── Root ───────────────────────────────────────────────────
  if (props.variant === 'root') {
    const initial    = props.userName?.trim().charAt(0).toUpperCase() ?? '?';
    const isProvider = props.userRole === 'provider';
    const count      = props.notifCount ?? 0;

    return (
      <View style={[s.base, s.rootBase]}>
        {/* Avatar + Role pill — taps to profile */}
        <TouchableOpacity
          style={s.avatarGroup}
          onPress={props.onAvatarPress}
          activeOpacity={0.7}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>{initial}</Text>
          </View>
          <View style={[s.rolePill, isProvider ? s.rolePillPro : s.rolePillCli]}>
            <Text style={[s.roleText, isProvider ? s.roleTextPro : s.roleTextCli]}>
              {isProvider
                ? (isRTL ? 'مزود' : 'Provider')
                : (isRTL ? 'عميل' : 'Client')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Wordmark — always centered */}
        <Text style={s.wordmark}>وسيط</Text>

        {/* Notification bell */}
        <TouchableOpacity
          style={s.iconBtn}
          onPress={props.onNotifPress}
          activeOpacity={0.7}
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

const CONTENT_H = 52;
const ICON_BTN  = 44;

function makeStyles(colors: AppColors, headerPad: number) {
  return StyleSheet.create({
    // Shared base
    base: {
      flexDirection:    'row',
      alignItems:       'center',
      paddingTop:       headerPad,
      paddingBottom:    8,
      paddingHorizontal: 8,
      backgroundColor:  colors.bg,
      minHeight:        headerPad + CONTENT_H,
    },
    // Root additions
    rootBase: {
      justifyContent:   'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // Stack additions
    stackBase: {
      justifyContent:   'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // Modal additions
    modalBase: {
      justifyContent: 'space-between',
      // No border — modal flows feel lighter without divider
    },

    // ── Root elements ───────────────────────────────────────
    avatarGroup: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           7,
    },
    avatarCircle: {
      width:           36,
      height:          36,
      borderRadius:    18,
      backgroundColor: colors.accent,
      alignItems:      'center',
      justifyContent:  'center',
    },
    avatarLetter: {
      fontSize:   15,
      fontWeight: '700',
      color:      '#000',
    },
    rolePill: {
      borderRadius:      20,
      paddingHorizontal: 8,
      paddingVertical:   3,
    },
    rolePillPro: { backgroundColor: 'rgba(201,168,76,0.15)' },
    rolePillCli: { backgroundColor: colors.infoBg },
    roleText:    { fontSize: 11, fontWeight: '600' },
    roleTextPro: { color: colors.accent },
    roleTextCli: { color: colors.infoSoft },

    wordmark: {
      fontSize:      20,
      fontWeight:    '800',
      color:         colors.textPrimary,
      letterSpacing: 0.3,
    },

    // Notification bell
    iconBtn: {
      width:          ICON_BTN,
      height:         ICON_BTN,
      alignItems:     'center',
      justifyContent: 'center',
    },
    badge: {
      position:          'absolute',
      top:               6,
      right:             6,
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

    // ── Stack elements ──────────────────────────────────────
    stackTitle: {
      flex:       1,
      fontSize:   17,
      fontWeight: '600',
      color:      colors.textPrimary,
      textAlign:  'center',
    },

    // ── Modal elements ──────────────────────────────────────
    modalTitle: {
      flex:       1,
      fontSize:   16,
      fontWeight: '500',
      color:      colors.textSecondary,
      textAlign:  'center',
    },
    stepChip: {
      // overrides iconBtn size to same dimensions
    },
    stepText: {
      fontSize:   13,
      fontWeight: '600',
      color:      colors.textMuted,
    },
  });
}
