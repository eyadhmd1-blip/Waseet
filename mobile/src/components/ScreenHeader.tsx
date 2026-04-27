// ============================================================
// ScreenHeader — Fixed, RTL-aware header for all screens
//
// Two variants:
//
//   Tab (greeting) — home/feed screens
//     <ScreenHeader greeting="أهلاً، أحمد" sub="📍 عمان" right={<NotifBtn />} />
//
//   Stack (back-button) — detail/modal screens
//     <ScreenHeader title="تفاصيل الطلب" onBack={() => router.back()} right={<ShareBtn />} />
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useInsets } from '../hooks/useInsets';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../context/ThemeContext';
import { textStart } from '../utils/rtl';

interface ScreenHeaderProps {
  greeting?: string;
  sub?: string;
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  bg?: string;
  borderBottom?: boolean;
}

export function ScreenHeader({
  greeting,
  sub,
  title,
  onBack,
  right,
  bg,
  borderBottom = true,
}: ScreenHeaderProps) {
  const { headerPad } = useInsets();
  const { isRTL }     = useLanguage();
  const { colors }    = useTheme();

  const resolvedBg = bg ?? colors.bg;
  const ta = textStart(isRTL);

  const containerStyle = [
    styles.container,
    { paddingTop: headerPad, backgroundColor: resolvedBg },
    borderBottom && { borderBottomWidth: 1, borderBottomColor: colors.border },
  ];

  // ── Tab greeting variant ──────────────────────────────────
  if (greeting !== undefined) {
    return (
      <View style={containerStyle}>
        <View style={[styles.row, { flexDirection: 'row' }]}>
          <View style={styles.greetingBlock}>
            <Text style={[styles.greeting, { textAlign: ta, color: colors.textPrimary }]} numberOfLines={1}>
              {greeting}
            </Text>
            {sub ? (
              <Text style={[styles.sub, { textAlign: ta, color: colors.textMuted }]} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>
          {right ? <View style={styles.actionSlot}>{right}</View> : null}
        </View>
        <View style={[styles.accentLine, { backgroundColor: colors.accent }]} />
      </View>
    );
  }

  // ── Stack back-button variant ─────────────────────────────
  return (
    <View style={containerStyle}>
      <View style={[styles.row, { flexDirection: 'row' }]}>
        {onBack ? (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.backIcon, { color: colors.accent }]}>{isRTL ? '→' : '←'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navBtn} />
        )}
        {title ? (
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {right ? (
          <View style={styles.actionSlot}>{right}</View>
        ) : (
          <View style={styles.navBtn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  row: {
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingBottom:  14,
  },
  greetingBlock: {
    flex: 1,
  },
  greeting: {
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize:   13,
    marginTop:  3,
    fontWeight: '500',
  },
  accentLine: {
    height:        2,
    width:         40,
    borderRadius:  2,
    marginBottom:  10,
    alignSelf:     'flex-start',
  },
  navBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize:   22,
    fontWeight: '600',
  },
  title: {
    flex:       1,
    fontSize:   17,
    fontWeight: '700',
    textAlign:  'center',
  },
  actionSlot: {
    flexShrink:     0,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
