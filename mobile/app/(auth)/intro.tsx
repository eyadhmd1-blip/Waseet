import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const { width } = Dimensions.get('window');

const SLIDES = [
  { key: '1', icon: '📋', titleKey: 'intro.slide1Title', descKey: 'intro.slide1Desc' },
  { key: '2', icon: '⚖️', titleKey: 'intro.slide2Title', descKey: 'intro.slide2Desc' },
  { key: '3', icon: '🛡️', titleKey: 'intro.slide3Title', descKey: 'intro.slide3Desc' },
];

export const INTRO_SEEN_KEY = '@waseet/intro_seen';

export default function IntroScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();

  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  async function finish() {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
    router.replace('/(auth)');
  }

  function goNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  }

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingBottom: contentPad }]}>
      <StatusBar style="light" />

      <TouchableOpacity
        style={[styles.skip, { top: headerPad + 8 }]}
        onPress={finish}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>{t('intro.skip')}</Text>
      </TouchableOpacity>

      <Animated.FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{t(item.titleKey as any)}</Text>
            <Text style={styles.desc}>{t(item.descKey as any)}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 22, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity }]}
              />
            );
          })}
        </View>

        <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.82}>
          <Text style={styles.btnText}>
            {isLast ? t('intro.start') : t('intro.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    skip: {
      position: 'absolute',
      right: 20,
      zIndex: 10,
    },
    skipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    slide: {
      width,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    icon: {
      fontSize: 80,
      marginBottom: 36,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 16,
    },
    desc: {
      fontSize: 16,
      lineHeight: 26,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: 8,
      gap: 20,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    btn: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    btnText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.bg,
      letterSpacing: 0.5,
    },
  });
}
