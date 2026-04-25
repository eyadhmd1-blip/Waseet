import { useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  Animated, StyleSheet, Easing,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────

export interface SuccessModalProps {
  visible:        boolean;
  title:          string;
  subtitle?:      string;
  hint?:          string;          // e.g. notification hint shown in a box
  primaryLabel:   string;
  secondaryLabel?: string;
  onPrimary:      () => void;
  onSecondary?:   () => void;
}

// ─── Sparkle dot positions (static, relative to checkmark center) ──

const SPARKLES = [
  { top: -38, left:  12, size: 7,  color: '#10B981', delay: 0   },
  { top: -28, left: -28, size: 5,  color: '#60A5FA', delay: 80  },
  { top:  10, left: -44, size: 6,  color: '#F59E0B', delay: 160 },
  { top:  38, left:  -8, size: 5,  color: '#10B981', delay: 240 },
  { top:  28, left:  36, size: 7,  color: '#60A5FA', delay: 120 },
  { top: -10, left:  44, size: 5,  color: '#F59E0B', delay: 300 },
];

// ─── Sparkle ──────────────────────────────────────────────────

function Sparkle({ top, left, size, color, delay, trigger }: typeof SPARKLES[0] & { trigger: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trigger) {
      anim.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 350, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();
    }
  }, [trigger]);

  return (
    <Animated.View
      style={{
        position: 'absolute', top, left,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        opacity: anim,
        transform: [{ scale: anim }],
      }}
    />
  );
}

// ─── Main Component ────────────────────────────────────────────

export function SuccessModal({
  visible, title, subtitle, hint,
  primaryLabel, secondaryLabel,
  onPrimary, onSecondary,
}: SuccessModalProps) {
  const { colors } = useTheme();

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale       = useRef(new Animated.Value(0.82)).current;
  const cardOpacity     = useRef(new Animated.Value(0)).current;
  const checkScale      = useRef(new Animated.Value(0)).current;
  const glowOpacity     = useRef(new Animated.Value(0.25)).current;
  const glowLoopRef     = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      cardScale.setValue(0.82);
      cardOpacity.setValue(0);
      checkScale.setValue(0);
      glowOpacity.setValue(0.25);

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(cardOpacity,     { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(cardScale,       { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(checkScale, { toValue: 1, tension: 90, friction: 7, useNativeDriver: true }).start();

        glowLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.65, duration: 1400, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.25, duration: 1400, useNativeDriver: true }),
          ]),
        );
        glowLoopRef.current.start();
      });
    } else {
      glowLoopRef.current?.stop();
    }

    return () => { glowLoopRef.current?.stop(); };
  }, [visible]);

  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Animated.View
          style={[
            styles.card,
            { opacity: cardOpacity, transform: [{ scale: cardScale }] },
          ]}
        >
          {/* ── Animated checkmark ── */}
          <View style={styles.iconWrap}>
            <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
            <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
              <Text style={styles.checkMark}>✓</Text>
            </Animated.View>
            {SPARKLES.map((s, i) => (
              <Sparkle key={i} {...s} trigger={visible} />
            ))}
          </View>

          {/* ── Text ── */}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {/* ── Optional hint box ── */}
          {hint ? (
            <View style={styles.hintBox}>
              <Text style={styles.hintIcon}>🔔</Text>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          ) : null}

          {/* ── Buttons ── */}
          <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          </TouchableOpacity>

          {secondaryLabel && onSecondary ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSecondary} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof import('../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 28,
      paddingTop: 44,
      paddingBottom: 28,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 16,
    },

    // ── Checkmark ──────────────────────────────────────────────
    iconWrap: {
      width: 88, height: 88,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 24,
    },
    glowRing: {
      position: 'absolute',
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: '#10B981',
      transform: [{ scale: 1.35 }],
    },
    checkCircle: {
      width: 76, height: 76, borderRadius: 38,
      backgroundColor: colors.successBg,
      borderWidth: 3,
      borderColor: '#10B981',
      alignItems: 'center', justifyContent: 'center',
    },
    checkMark: {
      fontSize: 36, fontWeight: '800',
      color: colors.successSoft,
      lineHeight: 44,
    },

    // ── Text ───────────────────────────────────────────────────
    title: {
      fontSize: 22, fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
      lineHeight: 30,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 16,
    },

    // ── Hint ───────────────────────────────────────────────────
    hintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 24,
      width: '100%',
    },
    hintIcon: { fontSize: 18 },
    hintText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'right',
      lineHeight: 20,
    },

    // ── Buttons ────────────────────────────────────────────────
    primaryBtn: {
      width: '100%',
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 10,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
    primaryBtnText: {
      fontSize: 16, fontWeight: '700',
      color: colors.bg,
    },
    secondaryBtn: {
      width: '100%',
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
  });
}
