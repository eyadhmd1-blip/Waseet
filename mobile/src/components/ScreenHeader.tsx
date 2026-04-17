// ============================================================
// ScreenHeader — Reusable header respecting safe area + RTL
//
// Usage (tab screens with greeting):
//   <ScreenHeader greeting="أهلاً، أحمد 👋" sub="عمان 📍" right={<NotifBtn />} />
//
// Usage (back-button screens):
//   <ScreenHeader title="تفاصيل الطلب" onBack={() => router.back()} right={<ShareBtn />} />
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useInsets } from '../hooks/useInsets';
import { useLanguage } from '../hooks/useLanguage';
import { COLORS } from '../constants/theme';

interface ScreenHeaderProps {
  // Tab-style: show greeting + subtitle on start side, action on end side
  greeting?: string;
  sub?: string;
  // Stack-style: title centred or start-aligned, back button on start side
  title?: string;
  onBack?: () => void;
  // Optional action element on the far end (notification bell, share, etc.)
  right?: React.ReactNode;
  // Optional override for backgroundColor
  bg?: string;
  borderBottom?: boolean;
}

export function ScreenHeader({
  greeting,
  sub,
  title,
  onBack,
  right,
  bg = COLORS.bg,
  borderBottom = false,
}: ScreenHeaderProps) {
  const { headerPad } = useInsets();
  const { isRTL }     = useLanguage();

  const containerStyle = [
    styles.container,
    { paddingTop: headerPad, backgroundColor: bg },
    borderBottom && styles.border,
  ];

  // ── Tab greeting layout ───────────────────────────────────
  if (greeting !== undefined) {
    return (
      <View style={containerStyle}>
        {/* In RTL: greeting on right (start), action on left (end) */}
        {isRTL ? (
          <>
            <View style={styles.greetingWrap}>
              <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
              {sub ? <Text style={styles.sub}>{sub}</Text> : null}
            </View>
            {right ? <View style={styles.actionWrap}>{right}</View> : null}
          </>
        ) : (
          <>
            {right ? <View style={styles.actionWrap}>{right}</View> : null}
            <View style={styles.greetingWrap}>
              <Text style={[styles.greeting, styles.ltrGreeting]} numberOfLines={1}>{greeting}</Text>
              {sub ? <Text style={[styles.sub, styles.ltrSub]}>{sub}</Text> : null}
            </View>
          </>
        )}
      </View>
    );
  }

  // ── Stack back-button layout ──────────────────────────────
  return (
    <View style={containerStyle}>
      {/* Back button on leading side */}
      {onBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backIcon}>{isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>
      ) : <View style={styles.backBtn} />}

      {title ? (
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      ) : null}

      {right ? <View style={styles.actionWrap}>{right}</View> : <View style={styles.backBtn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom:  14,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greetingWrap: { flex: 1 },
  greeting: {
    fontSize:   21,
    fontWeight: '700',
    color:      COLORS.textPrimary,
    textAlign:  'right',
  },
  ltrGreeting: { textAlign: 'left' },
  sub: {
    fontSize:  12,
    color:     COLORS.textMuted,
    marginTop: 3,
    textAlign: 'right',
  },
  ltrSub: { textAlign: 'left' },
  actionWrap: { flexShrink: 0 },
  // Stack header
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: COLORS.textSecondary },
  title: {
    flex:       1,
    fontSize:   17,
    fontWeight: '600',
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },
});
