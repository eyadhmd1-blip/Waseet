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
import { COLORS } from '../constants/theme';
import { flexRow, textStart } from '../utils/rtl';

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
  bg = COLORS.bg,
  borderBottom = true,
}: ScreenHeaderProps) {
  const { headerPad } = useInsets();
  const { isRTL }     = useLanguage();

  const ta = textStart(isRTL);

  const containerStyle = [
    styles.container,
    { paddingTop: headerPad, backgroundColor: bg },
    borderBottom && styles.border,
  ];

  // ── Tab greeting variant ──────────────────────────────────
  if (greeting !== undefined) {
    return (
      <View style={containerStyle}>
        <View style={[styles.row, { flexDirection: flexRow(isRTL) }]}>
          {/* Greeting block — always on the start (leading) edge */}
          <View style={styles.greetingBlock}>
            <Text style={[styles.greeting, { textAlign: ta }]} numberOfLines={1}>
              {greeting}
            </Text>
            {sub ? (
              <Text style={[styles.sub, { textAlign: ta }]} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>

          {/* Action element — always on the end (trailing) edge */}
          {right ? <View style={styles.actionSlot}>{right}</View> : null}
        </View>

        {/* Gold accent divider */}
        <View style={styles.accentLine} />
      </View>
    );
  }

  // ── Stack back-button variant ─────────────────────────────
  return (
    <View style={containerStyle}>
      <View style={[styles.row, { flexDirection: flexRow(isRTL) }]}>
        {/* Back button — leading edge */}
        {onBack ? (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backIcon}>{isRTL ? '→' : '←'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.navBtn} />
        )}

        {/* Title — centred */}
        {title ? (
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* Right action — trailing edge */}
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
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },

  row: {
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingBottom:  14,
  },

  border: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  // ── Greeting variant
  greetingBlock: {
    flex: 1,
  },
  greeting: {
    fontSize:   22,
    fontWeight: '800',
    color:      COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize:  13,
    color:     COLORS.textMuted,
    marginTop: 3,
    fontWeight: '500',
  },
  accentLine: {
    height:          2,
    width:           40,
    backgroundColor: COLORS.accent,
    borderRadius:    2,
    marginBottom:    10,
    // stays on start edge; marginStart isn't reliable without I18nManager,
    // so we use alignSelf and let the parent column handle direction
    alignSelf:       'flex-start',
  },

  // ── Stack variant
  navBtn: {
    width:           44,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
  },
  backIcon: {
    fontSize: 22,
    color:    COLORS.accent,
    fontWeight: '600',
  },
  title: {
    flex:       1,
    fontSize:   17,
    fontWeight: '700',
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },

  // ── Shared
  actionSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
