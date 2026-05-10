import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { JORDAN_CITIES } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

type Role = 'client' | 'provider';

const ACCENT  = '#C9A84C';
const BLUE    = '#3B82F6';

export default function RegisterScreen() {
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { colors, isDark } = useTheme();

  const [role, setRole]         = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [city, setCity]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [nameError, setNameError] = useState(false);
  const [cityError, setCityError] = useState(false);

  const styles = useMemo(
    () => createStyles(colors, isRTL, isDark),
    [colors, isRTL, isDark],
  );

  const handleRegister = async () => {
    const n1 = !fullName.trim();
    const c1 = !city;
    setNameError(n1);
    setCityError(c1);
    if (n1 || c1) return;

    setLoading(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setLoading(false); return; }

    const { error } = await supabase.from('users').insert({
      id: user.id,
      role,
      full_name: fullName.trim(),
      phone: user.phone,
      phone_verified: true,
      city,
    });

    if (error) {
      setLoading(false);
      if ((error as any).code === '23505') {
        Alert.alert(
          t('auth.phoneAlreadyRegistered'),
          t('auth.phoneAlreadyRegisteredMsg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.goToLogin'), onPress: () => router.replace('/(auth)/login' as any) },
          ]
        );
      } else {
        Alert.alert(t('common.error'), error.message);
      }
      return;
    }

    if (role === 'provider') {
      await supabase.from('providers').insert({
        id: user.id,
        is_subscribed:        true,
        subscription_tier:    'trial',
        subscription_credits: 10,
        trial_used:           true,
        subscription_ends:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    setLoading(false);
    router.replace(role === 'provider' ? '/(provider)' : '/(client)');
  };

  const gradColors: [string, string] = isDark
    ? [colors.bg, '#1A1407']
    : ['#FDF6E3', '#FFFBF8'];

  return (
    <LinearGradient colors={gradColors} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[styles.back, { paddingTop: headerPad }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <View style={styles.backBtn}>
            <Text style={styles.backArrow}>{isRTL ? '→' : '←'}</Text>
          </View>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
            />
          </View>

          {/* Title + subtitle */}
          <Text style={styles.title}>✨ {t('auth.completeRegister')}</Text>
          <Text style={styles.subtitle}>خطوة أخيرة لبدء التجربة</Text>

          {/* ── Role selector ─────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t('auth.iAm')}</Text>
          <View style={styles.roleRow}>
            {/* Client card */}
            <RoleCard
              isActive={role === 'client'}
              onPress={() => setRole('client')}
              accent={ACCENT}
              iconBg={isDark ? 'rgba(201,168,76,0.18)' : 'rgba(201,168,76,0.12)'}
              icon="🔍"
              label={t('auth.lookingForService')}
              sub={t('auth.clientRole')}
              isDark={isDark}
              colors={colors}
              styles={styles}
            />

            {/* Provider card */}
            <RoleCard
              isActive={role === 'provider'}
              onPress={() => setRole('provider')}
              accent={BLUE}
              iconBg={isDark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.10)'}
              icon="🛠️"
              label={t('auth.offeringService')}
              sub={t('auth.providerRole')}
              isDark={isDark}
              colors={colors}
              styles={styles}
            />
          </View>

          {/* Provider trial badge */}
          {role === 'provider' && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>🎁 تجربة مجانية 30 يوم + 10 رصيد ترحيبي</Text>
            </View>
          )}

          {/* ── Full name ──────────────────────────────────────────── */}
          <View style={[styles.inputCard, nameError && styles.inputCardError]}>
            <Text style={styles.inputLabel}>{t('auth.fullName')}</Text>
            <TextInput
              style={styles.nameInput}
              placeholder={t('auth.fullNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={v => { setFullName(v); if (nameError) setNameError(false); }}
              textAlign={isRTL ? 'right' : 'left'}
            />
          </View>
          {nameError && (
            <Text style={styles.errorHint}>⚠️ يرجى إدخال اسمك الكامل</Text>
          )}

          {/* ── City picker ────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t('auth.city')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cityScroll}
            contentContainerStyle={styles.cityScrollContent}
          >
            {JORDAN_CITIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.cityChip, city === c && styles.cityChipActive]}
                onPress={() => { setCity(c); if (cityError) setCityError(false); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.cityText, city === c && styles.cityTextActive]}>
                  {t(`cities.${c}`, c)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {cityError && (
            <Text style={styles.errorHint}>⚠️ يرجى اختيار مدينتك</Text>
          )}

          {/* ── CTA ───────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? t('auth.registering') : `🚀 ${t('auth.createAccount')}`}
            </Text>
          </TouchableOpacity>

          {/* Trust badge */}
          <View style={styles.trustBadge}>
            <Text style={styles.trustText}>🔒 بياناتك محفوظة ولن تُشارَك مع أي طرف ثالث</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// ── Role card component ────────────────────────────────────────────────────
function RoleCard({
  isActive, onPress, accent, iconBg, icon, label, sub, isDark, colors, styles,
}: {
  isActive: boolean; onPress: () => void; accent: string; iconBg: string;
  icon: string; label: string; sub: string; isDark: boolean;
  colors: AppColors; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, isActive && { borderColor: accent }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Selection banner */}
      <View style={[
        styles.roleBanner,
        { backgroundColor: isActive ? accent : (isDark ? 'rgba(255,255,255,0.06)' : '#F0F0F0') },
      ]}>
        <Text style={[styles.roleBannerText, { color: isActive ? '#fff' : colors.textMuted }]}>
          {isActive ? '✓  تم الاختيار' : '○  اضغط للاختيار'}
        </Text>
      </View>

      {/* Icon area */}
      <View style={[styles.roleIconWrap, { backgroundColor: iconBg }]}>
        <Text style={styles.roleIconEmoji}>{icon}</Text>
      </View>

      {/* Text */}
      <Text style={[styles.roleLabel, isActive && { color: accent }]}>{label}</Text>
      <Text style={styles.roleSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;

  return StyleSheet.create({
    // Back button
    back: {
      paddingHorizontal: 20,
      paddingBottom:     4,
      alignItems:        isRTL ? 'flex-end' : 'flex-start',
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.75)',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    backArrow: { fontSize: 20, color: colors.textSecondary },

    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 12,
    },

    // Logo
    logoWrap: { alignItems: 'center', marginBottom: 16 },
    logo:     { width: 64, height: 64, borderRadius: 16 },

    // Title
    title: {
      fontSize:     rs(26, 22, 30),
      fontWeight:   '800',
      color:        colors.textPrimary,
      textAlign:    'center',
      marginBottom: 4,
    },
    subtitle: {
      fontSize:     rs(13, 12, 15),
      color:        colors.textMuted,
      textAlign:    'center',
      marginBottom: 24,
    },

    // Section labels
    sectionLabel: {
      fontSize:     12,
      fontWeight:   '700',
      color:        ACCENT,
      marginBottom: 10,
      textAlign:    ta,
    },

    // Role cards
    roleRow: {
      flexDirection: 'row',
      gap:           12,
      marginBottom:  8,
    },
    roleCard: {
      flex:            1,
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)',
      borderRadius:    16,
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.30)',
      overflow:        'hidden',
      shadowColor:     '#000',
      shadowOffset:    { width: 0, height: 3 },
      shadowOpacity:   0.07,
      shadowRadius:    8,
      elevation:       2,
    },
    roleBanner: {
      paddingVertical: 9,
      alignItems:      'center',
      justifyContent:  'center',
    },
    roleBannerText: {
      fontSize:   12,
      fontWeight: '700',
    },
    roleIconWrap: {
      alignSelf:    'center',
      width:        56,
      height:       56,
      borderRadius: 28,
      alignItems:   'center',
      justifyContent: 'center',
      marginTop:    14,
      marginBottom: 10,
    },
    roleIconEmoji: { fontSize: 26 },
    roleLabel: {
      fontSize:     13,
      fontWeight:   '700',
      color:        colors.textPrimary,
      textAlign:    'center',
      paddingHorizontal: 6,
    },
    roleSub: {
      fontSize:     11,
      color:        colors.textMuted,
      textAlign:    'center',
      marginTop:    4,
      marginBottom: 14,
      paddingHorizontal: 6,
    },

    // Trial badge
    trialBadge: {
      backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
      borderRadius:    10,
      paddingVertical:   10,
      paddingHorizontal: 14,
      marginBottom:    16,
      alignItems:      'center',
    },
    trialText: {
      fontSize:   12,
      color:      BLUE,
      fontWeight: '700',
      textAlign:  'center',
    },

    // Name input card
    inputCard: {
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)',
      borderRadius:    16,
      padding:         16,
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.35)',
      marginBottom:    8,
      marginTop:       20,
      shadowColor:     ACCENT,
      shadowOffset:    { width: 0, height: 4 },
      shadowOpacity:   0.10,
      shadowRadius:    12,
      elevation:       3,
    },
    inputCardError: { borderColor: '#EF4444' },
    inputLabel: {
      fontSize:     12,
      fontWeight:   '700',
      color:        ACCENT,
      marginBottom: 10,
      textAlign:    ta,
    },
    nameInput: {
      color:         colors.textPrimary,
      fontSize:      16,
      fontWeight:    '500',
      paddingVertical: 4,
    },

    errorHint: {
      fontSize:     13,
      color:        '#EF4444',
      marginBottom: 4,
      textAlign:    ta,
    },

    // City chips
    cityScroll:        { marginBottom: 4 },
    cityScrollContent: { paddingVertical: 4, gap: 8 },
    cityChip: {
      backgroundColor:   isDark ? colors.surface : 'rgba(255,255,255,0.85)',
      borderRadius:      20,
      paddingHorizontal: 16,
      paddingVertical:   9,
      borderWidth:       1.5,
      borderColor:       isDark ? colors.border : 'rgba(201,168,76,0.25)',
    },
    cityChipActive: {
      backgroundColor: isDark ? 'rgba(201,168,76,0.18)' : 'rgba(201,168,76,0.12)',
      borderColor:     ACCENT,
    },
    cityText:       { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    cityTextActive: { color: ACCENT, fontWeight: '700' },

    // CTA
    btn: {
      backgroundColor: ACCENT,
      borderRadius:    16,
      paddingVertical: 17,
      alignItems:      'center',
      marginTop:       24,
      marginBottom:    16,
      shadowColor:     ACCENT,
      shadowOffset:    { width: 0, height: 6 },
      shadowOpacity:   0.35,
      shadowRadius:    12,
      elevation:       6,
    },
    btnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
    btnText: {
      fontSize:   rs(17, 15, 19),
      fontWeight: '800',
      color:      '#fff',
    },

    // Trust badge
    trustBadge: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
      borderRadius:    10,
      paddingVertical:   10,
      paddingHorizontal: 14,
      alignItems:      'center',
    },
    trustText: {
      fontSize:   12,
      color:      '#10B981',
      fontWeight: '600',
      textAlign:  'center',
    },
  });
}
