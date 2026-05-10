import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
  ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
}

export default function LoginScreen() {
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { colors, isDark } = useTheme();
  const [phone, setPhone]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);

  // ── Send OTP ─────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const raw = normalizeDigits(phone).trim().replace(/\s+/g, '');
    if (!raw) { setPhoneError(true); return; }

    const formatted = raw.startsWith('+')
      ? raw
      : `+962${raw.replace(/^0+/, '')}`;

    const jordanPattern = /^(\+962|00962|0)?7[789]\d{7}$/;
    if (!jordanPattern.test(formatted)) {
      Alert.alert(t('common.error'), 'رقم الهاتف غير صالح.\nأدخل رقماً أردنياً صحيحاً\nمثال: 0791234567');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: formatted },
      });

      let errCode: string | undefined;
      if (error) {
        try {
          const body = await (error as any).context?.json?.();
          errCode = body?.error;
        } catch { /* ignore */ }
      } else if (!data?.success) {
        errCode = data?.error;
      }

      if (error || !data?.success) {
        if (errCode === 'INVALID_JORDAN_PHONE' || errCode === 'INVALID_PHONE') {
          Alert.alert(t('common.error'), 'رقم الهاتف غير صالح.\nأدخل رقماً أردنياً صحيحاً\nمثال: 0791234567');
        } else if (errCode === 'RATE_LIMITED' || errCode === 'TOO_MANY_REQUESTS') {
          Alert.alert(t('common.error'), 'تجاوزت الحد المسموح.\nانتظر قليلاً وأعد المحاولة.');
        } else if (errCode === 'DAILY_LIMIT_EXCEEDED') {
          Alert.alert(t('common.error'), 'تجاوزت الحد اليومي لإرسال الرموز.\nحاول مجدداً غداً.');
        } else if (errCode === 'SMS_SEND_FAILED') {
          Alert.alert(t('common.error'), 'تعذّر إرسال الرسالة النصية.\nحاول مرة أخرى.');
        } else {
          Alert.alert(t('common.error'), 'تعذّر الاتصال.\nتحقق من اتصالك بالإنترنت وأعد المحاولة.');
        }
        return;
      }

      const params: Record<string, string> = { phone: formatted };
      if (data.dev_code) params.dev_code = String(data.dev_code);
      router.push({ pathname: '/(auth)/verify', params });
    } catch {
      Alert.alert(t('common.error'), 'تعذّر الاتصال.\nتحقق من اتصالك بالإنترنت وأعد المحاولة.');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>📱 {t('auth.enterPhone')}</Text>
          <Text style={styles.subtitle}>{t('auth.phoneSubtitle')}</Text>

          {/* Phone input card */}
          <View style={[styles.inputCard, phoneError && styles.inputCardError]}>
            <Text style={styles.inputLabel}>رقم الهاتف</Text>
            <View style={styles.inputRow}>
              <View style={styles.codeBox}>
                <Text style={styles.countryCode}>🇯🇴 +962</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="7X XXX XXXX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={v => { setPhone(v); if (phoneError) setPhoneError(false); }}
                maxLength={10}
              />
            </View>
          </View>

          {/* Inline error */}
          {phoneError && (
            <Text style={styles.errorHint}>⚠️ يرجى إدخال رقم هاتفك</Text>
          )}

          {/* Security badge */}
          <View style={styles.securityBadge}>
            <Text style={styles.securityText}>🔒 رقمك محفوظ لدينا بأمان تام</Text>
          </View>

          {/* CTA button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSendOtp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? t('auth.sending') : `📨 ${t('auth.sendCode')}`}
            </Text>
          </TouchableOpacity>

          {/* Legal text */}
          <Text style={styles.legal}>
            🔒 بالمتابعة، أنت توافق على الشروط والأحكام وسياسة الخصوصية
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta     = isRTL ? 'right' : 'left';
  const ACCENT = '#C9A84C';

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
    logoWrap: { alignItems: 'center', marginBottom: 20 },
    logo:     { width: 64, height: 64, borderRadius: 16 },

    // Title + subtitle
    title: {
      fontSize:     rs(26, 22, 30),
      fontWeight:   '800',
      color:        colors.textPrimary,
      textAlign:    'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize:     rs(14, 12, 16),
      color:        colors.textMuted,
      textAlign:    'center',
      marginBottom: 28,
      lineHeight:   22,
    },

    // Phone input card
    inputCard: {
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)',
      borderRadius:    16,
      padding:         16,
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.35)',
      marginBottom:    8,
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
    inputRow: {
      direction:   'ltr',
      flexDirection: 'row',
      alignItems:  'center',
      gap:         12,
    },
    codeBox: {
      backgroundColor: isDark ? colors.bg : 'rgba(201,168,76,0.12)',
      borderRadius:    10,
      paddingHorizontal: 10,
      paddingVertical:   8,
    },
    countryCode: {
      fontSize:   15,
      fontWeight: '700',
      color:      ACCENT,
    },
    input: {
      flex:          1,
      color:         colors.textPrimary,
      fontSize:      20,
      fontWeight:    '600',
      letterSpacing: 2,
      textAlign:     'left',
      paddingVertical: 4,
    },

    errorHint: {
      fontSize:     13,
      color:        '#EF4444',
      marginBottom: 8,
      textAlign:    ta,
    },

    // Security badge
    securityBadge: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
      borderRadius:    10,
      paddingVertical:   10,
      paddingHorizontal: 14,
      marginBottom:    24,
      alignItems:      'center',
    },
    securityText: {
      fontSize:   12,
      color:      '#10B981',
      fontWeight: '600',
      textAlign:  'center',
    },

    // CTA button
    btn: {
      backgroundColor: ACCENT,
      borderRadius:    16,
      paddingVertical: 17,
      alignItems:      'center',
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

    // Legal text
    legal: {
      fontSize:   11,
      color:      colors.textMuted,
      textAlign:  'center',
      lineHeight: 16,
    },
  });
}
