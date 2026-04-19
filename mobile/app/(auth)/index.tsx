// ============================================================
// WASEET — Landing Screen
// Animated: orbiting service icons, connection pulse, particles
// ============================================================

import { useEffect, useRef, useMemo} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Easing, StyleSheet as RN,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const { width, height } = Dimensions.get('window');

// Orbit scales with screen width — smaller on iPhone SE, larger on tablets
const ORBIT_RADIUS  = Math.min(width * 0.33, 140);
const GLOW_SIZE     = Math.min(170, width * 0.43);

const ORBIT_ICONS = ['⚡', '🔧', '🚗', '🎨', '🚿', '🚚', '✨', '📚', '🔋', '🏠'];

// ─── Floating Particle ───────────────────────────────────────

function Particle({ startDelay, xPos, size }: { startDelay: number; xPos: number; size: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      translateY.setValue(height * 0.65);
      opacity.setValue(0);
      Animated.sequence([
        Animated.delay(startDelay + Math.random() * 1200),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.75, duration: 900, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: height * 0.05, duration: 5500 + Math.random() * 3000, easing: Easing.linear, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.delay(500 + Math.random() * 1500),
      ]).start(run);
    };
    run();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: xPos, top: 0,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#F59E0B', transform: [{ translateY }], opacity,
      }}
    />
  );
}

// ─── Connection Animation ─────────────────────────────────────

function ConnectionAnimation() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  const clientX     = useRef(new Animated.Value(-80)).current;
  const providerX   = useRef(new Animated.Value(80)).current;
  const lineScaleL  = useRef(new Animated.Value(0)).current;
  const lineScaleR  = useRef(new Animated.Value(0)).current;
  const centerScale = useRef(new Animated.Value(0.3)).current;
  const centerGlow  = useRef(new Animated.Value(0)).current;
  const rowOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const runLoop = () => {
      clientX.setValue(-80); providerX.setValue(80);
      lineScaleL.setValue(0); lineScaleR.setValue(0);
      centerScale.setValue(0.3); centerGlow.setValue(0);
      Animated.sequence([
        Animated.timing(rowOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(clientX, { toValue: 0, tension: 85, friction: 12, useNativeDriver: true }),
          Animated.spring(providerX, { toValue: 0, tension: 85, friction: 12, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(lineScaleL, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(lineScaleR, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(centerScale, { toValue: 1, tension: 140, friction: 7, useNativeDriver: true }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(centerGlow, { toValue: 1, duration: 380, useNativeDriver: true }),
            Animated.timing(centerGlow, { toValue: 0, duration: 380, useNativeDriver: true }),
          ]),
          { iterations: 4 }
        ),
        Animated.timing(rowOpacity, { toValue: 0, duration: 800, delay: 500, useNativeDriver: true }),
        Animated.delay(1500),
      ]).start(runLoop);
    };
    const timer = setTimeout(runLoop, 2800);
    return () => clearTimeout(timer);
  }, []);

  const centerBg = centerGlow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(24,18,10,1)', 'rgba(201,168,76,0.9)'] });

  return (
    <Animated.View style={[styles.connRow, { opacity: rowOpacity }]}>
      <Animated.View style={[styles.connNode, { transform: [{ translateX: clientX }] }]}>
        <View style={[styles.connNodeDot, { borderColor: '#38BDF8' }]}>
          <Text style={styles.connEmoji}>👤</Text>
        </View>
        <Text style={styles.connLabel}>{t('welcome.client')}</Text>
      </Animated.View>
      <Animated.View style={[styles.connLine, { transform: [{ scaleX: lineScaleL }] }]} />
      <Animated.View style={[styles.connCenter, { transform: [{ scale: centerScale }] }]}>
        <Animated.View style={[styles.connCenterBg, { backgroundColor: centerBg }]}>
          <Text style={styles.connCenterText}>و</Text>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.connLine, { transform: [{ scaleX: lineScaleR }] }]} />
      <Animated.View style={[styles.connNode, { transform: [{ translateX: providerX }] }]}>
        <View style={[styles.connNodeDot, { borderColor: '#F59E0B' }]}>
          <Text style={styles.connEmoji}>🔧</Text>
        </View>
        <Text style={styles.connLabel}>{t('welcome.provider')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Welcome Screen ──────────────────────────────────────────

const PARTICLES = Array.from({ length: 9 }, (_, i) => ({
  xPos: (width / 9) * i + Math.random() * (width / 9),
  size: Math.random() * 3.5 + 1.5,
  delay: i * 550,
}));

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { t, lang, changeLanguage } = useLanguage();
  const { headerPad, contentPad } = useInsets();

  const logoScale  = useRef(new Animated.Value(0)).current;
  const logoOp     = useRef(new Animated.Value(0)).current;
  const taglineOp  = useRef(new Animated.Value(0)).current;
  const taglineY   = useRef(new Animated.Value(22)).current;
  const btnsOp     = useRef(new Animated.Value(0)).current;
  const btnsY      = useRef(new Animated.Value(55)).current;
  const orbitRot   = useRef(new Animated.Value(0)).current;
  const glowOp     = useRef(new Animated.Value(0.15)).current;
  const ringOp     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(orbitRot, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.55, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.12, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.timing(ringOp, { toValue: 0.25, duration: 1200, delay: 600, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, delay: 350, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOp, { toValue: 1, duration: 600, delay: 350, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(taglineOp, { toValue: 1, duration: 700, delay: 950, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(taglineY, { toValue: 0, duration: 700, delay: 950, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(btnsOp, { toValue: 1, duration: 600, delay: 1500, useNativeDriver: true }),
      Animated.spring(btnsY, { toValue: 0, delay: 1500, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const orbitSpin   = orbitRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterSpin = orbitRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <View style={[styles.container, { paddingBottom: contentPad }]}>
      <StatusBar style="light" />
      {PARTICLES.map((p, i) => <Particle key={i} startDelay={p.delay} xPos={p.xPos} size={p.size} />)}

      <TouchableOpacity
        style={[styles.langToggle, { top: headerPad }]}
        onPress={() => changeLanguage(lang === 'ar' ? 'en' : 'ar')}
        activeOpacity={0.75}
      >
        <Text style={styles.langToggleText}>{lang === 'ar' ? 'EN' : 'ع'}</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <View style={styles.orbitFrame}>
          <Animated.View style={[styles.orbitRing, { opacity: ringOp }]} />
          <Animated.View style={[styles.orbitWheel, { transform: [{ rotate: orbitSpin }] }]}>
            {ORBIT_ICONS.map((icon, i) => {
              const angle = (i / ORBIT_ICONS.length) * 2 * Math.PI - Math.PI / 2;
              const left  = ORBIT_RADIUS + Math.cos(angle) * ORBIT_RADIUS - 15;
              const top   = ORBIT_RADIUS + Math.sin(angle) * ORBIT_RADIUS - 15;
              return <Animated.Text key={i} style={[styles.orbitIcon, { left, top, transform: [{ rotate: counterSpin }] }]}>{icon}</Animated.Text>;
            })}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glowOp }]} />
          <View style={[RN.absoluteFill, styles.center]} pointerEvents="none">
            <Animated.View style={{ alignItems: 'center', transform: [{ scale: logoScale }], opacity: logoOp }}>
              <Text style={styles.logoAr}>وسيط</Text>
              <Text style={styles.logoEn}>WASEET</Text>
            </Animated.View>
          </View>
        </View>

        <Animated.Text style={[styles.tagline, { opacity: taglineOp, transform: [{ translateY: taglineY }] }]}>
          {t('welcome.tagline')}
        </Animated.Text>

        <ConnectionAnimation />
      </View>

      <Animated.View style={[styles.actions, { opacity: btnsOp, transform: [{ translateY: btnsY }] }]}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(auth)/login')} activeOpacity={0.82}>
          <Text style={styles.btnPrimaryText}>{t('welcome.getStarted')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(auth)/login')} activeOpacity={0.82}>
          <Text style={styles.btnSecondaryText}>{t('welcome.login')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  // paddingBottom applied dynamically via contentPad inset
  container:    { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },
  hero:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: height * 0.04 },
  center:       { alignItems: 'center', justifyContent: 'center' },
  orbitFrame:   { width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2, marginBottom: 20 },
  orbitRing:    { position: 'absolute', top: 0, left: 0, width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2, borderRadius: ORBIT_RADIUS, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed' },
  orbitWheel:   { position: 'absolute', top: 0, left: 0, width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2 },
  orbitIcon:    { position: 'absolute', fontSize: rs(22, 16, 26) },
  glow:         { position: 'absolute', top: ORBIT_RADIUS - GLOW_SIZE / 2, left: ORBIT_RADIUS - GLOW_SIZE / 2, width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2, backgroundColor: colors.accent },
  // Logo font scales with screen width — min 44 on SE, max 72 on tablets
  logoAr:       { fontSize: rs(62, 44, 72), fontWeight: '800', color: colors.accent, letterSpacing: 2, textShadowColor: 'rgba(201,168,76,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  logoEn:       { fontSize: rs(18, 14, 22), fontWeight: '300', color: colors.textSecondary, letterSpacing: 9, marginTop: 2 },
  tagline:      { fontSize: rs(14, 12, 16), color: colors.textMuted, marginTop: 4, textAlign: 'center', letterSpacing: 0.5, paddingHorizontal: width * 0.08 },
  connRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 36, paddingHorizontal: 12 },
  // connNode width flexes with content — removed fixed width
  connNode:     { alignItems: 'center', minWidth: 48 },
  connNodeDot:  { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  connEmoji:    { fontSize: 20 },
  connLabel:    { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  connLine:     { flex: 1, height: 1.5, backgroundColor: colors.accent, marginHorizontal: 2 },
  connCenter:   { marginHorizontal: 6 },
  connCenterBg: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  connCenterText:{ fontSize: 17, fontWeight: '800', color: colors.accent },
  actions:      { paddingHorizontal: 24, gap: 12 },
  btnPrimary:   { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  btnPrimaryText:{ fontSize: 17, fontWeight: '700', color: colors.bg, letterSpacing: 0.5 },
  btnSecondary: { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  btnSecondaryText:{ fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  // top applied dynamically via headerPad inset
  langToggle:   { position: 'absolute', right: 20, zIndex: 10, backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  langToggleText:{ fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 },
  });
}
