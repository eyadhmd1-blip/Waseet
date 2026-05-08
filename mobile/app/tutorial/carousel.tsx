/**
 * OnboardingCarousel — shown once per role immediately after first login.
 * Rendered as a Modal inside the role sub-layout (never touches _layout.tsx).
 */
import { useCallback, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { useTheme }    from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { AppColors } from '../../src/constants/colors';

const { width: W } = Dimensions.get('window');

// ─── Slide data ───────────────────────────────────────────────

interface Slide { icon: string; titleKey: string; subKey: string }

const CLIENT_SLIDES: Slide[] = [
  { icon: '⚡', titleKey: 'tutorial.c1title', subKey: 'tutorial.c1sub' },
  { icon: '🎯', titleKey: 'tutorial.c2title', subKey: 'tutorial.c2sub' },
  { icon: '💬', titleKey: 'tutorial.c3title', subKey: 'tutorial.c3sub' },
  { icon: '⭐', titleKey: 'tutorial.c4title', subKey: 'tutorial.c4sub' },
];

const PROVIDER_SLIDES: Slide[] = [
  { icon: '📲', titleKey: 'tutorial.p1title', subKey: 'tutorial.p1sub' },
  { icon: '💳', titleKey: 'tutorial.p2title', subKey: 'tutorial.p2sub' },
  { icon: '⚡', titleKey: 'tutorial.p3title', subKey: 'tutorial.p3sub' },
  { icon: '🏆', titleKey: 'tutorial.p4title', subKey: 'tutorial.p4sub' },
  { icon: '📅', titleKey: 'tutorial.p5title', subKey: 'tutorial.p5sub' },
];

// ─── Props ────────────────────────────────────────────────────

interface Props {
  role:    'client' | 'provider';
  visible: boolean;
  onDone:  () => void;
}

// ─── Component ───────────────────────────────────────────────

export function OnboardingCarousel({ role, visible, onDone }: Props) {
  const { colors } = useTheme();
  const { t }      = useLanguage();
  const slides     = role === 'client' ? CLIENT_SLIDES : PROVIDER_SLIDES;

  const [index, setIndex] = useState(0);
  const fadeAnim          = useRef(new Animated.Value(1)).current;

  const goTo = useCallback((next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    // Delay state update until fade-out completes
    setTimeout(() => setIndex(next), 150);
  }, [fadeAnim]);

  const handleNext = useCallback(() => {
    if (index < slides.length - 1) {
      goTo(index + 1);
    } else {
      onDone();
    }
  }, [index, slides.length, goTo, onDone]);

  const st = styles(colors);
  const slide = slides[index];
  const isLast = index === slides.length - 1;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDone}
    >
      <StatusBar backgroundColor={colors.bg} barStyle="light-content" />
      <View style={st.root}>

        {/* Skip */}
        <TouchableOpacity style={st.skipBtn} onPress={onDone} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Text style={st.skipText}>{t('tutorial.skip')}</Text>
        </TouchableOpacity>

        {/* Slide */}
        <Animated.View style={[st.slideWrap, { opacity: fadeAnim }]}>
          <View style={st.iconCircle}>
            <Text style={st.icon}>{slide.icon}</Text>
          </View>
          <Text style={st.title}>{t(slide.titleKey)}</Text>
          <Text style={st.sub}>{t(slide.subKey)}</Text>
        </Animated.View>

        {/* Dots */}
        <View style={st.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[st.dot, i === index && st.dotActive]}
            />
          ))}
        </View>

        {/* Next / Done button */}
        <TouchableOpacity style={st.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={st.nextText}>
            {isLast ? t('tutorial.done') : t('tutorial.next')}
          </Text>
        </TouchableOpacity>

        {/* Step counter */}
        <Text style={st.counter}>{index + 1} / {slides.length}</Text>

      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function styles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingBottom: 60,
    },
    skipBtn: {
      position: 'absolute', top: 56, right: 24,
    },
    skipText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },

    slideWrap: { alignItems: 'center', width: '100%' },
    iconCircle: {
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 36,
    },
    icon:  { fontSize: 52 },
    title: {
      fontSize: 24, fontWeight: '800', color: colors.textPrimary,
      textAlign: 'center', marginBottom: 14, lineHeight: 32,
    },
    sub: {
      fontSize: 15, color: colors.textSecondary, textAlign: 'center',
      lineHeight: 24, maxWidth: W - 64,
    },

    dots: { flexDirection: 'row', gap: 8, marginTop: 40, marginBottom: 32 },
    dot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 24, backgroundColor: colors.accent,
    },

    nextBtn: {
      width: W - 64, backgroundColor: colors.accent,
      borderRadius: 16, paddingVertical: 16,
      alignItems: 'center',
    },
    nextText: { fontSize: 16, fontWeight: '700', color: colors.bg },

    counter: { marginTop: 16, fontSize: 12, color: colors.textMuted },
  });
}
