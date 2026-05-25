import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, useWindowDimensions,
  ScrollView, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';
import { useAppAlert } from '../../src/components/AppAlert';

const RESEND_COOLDOWN = 60;

const normalizeDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));

export default function VerifyScreen() {
  const { headerPad, contentPad } = useInsets();
  const router = useRouter();
  const { phone, dev_code } = useLocalSearchParams<{ phone: string; dev_code?: string }>();
  const { t, isRTL } = useLanguage();
  const { colors, isDark } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const otpBoxSize = Math.min(56, Math.max(40, Math.floor((screenW - 72) / 6) - 4));

  const [otp, setOtp]               = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [resending, setResending]   = useState(false);
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = useMemo(
    () => createStyles(colors, isRTL, isDark, otpBoxSize),
    [colors, isRTL, isDark, otpBoxSize],
  );
  const { showAlert, AlertComponent } = useAppAlert();

  // ── Countdown timer ───────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startCountdown]);

  // ── DEV MODE: auto-fill OTP ───────────────────────────────────
  useEffect(() => {
    if (!dev_code || !__DEV__) return;
    const digits = String(dev_code).padStart(6, '0').split('').slice(0, 6);
    setOtp(digits);
    setTimeout(() => inputs.current[5]?.focus(), 150);
  }, [dev_code]);

  const handleChange = (value: string, index: number) => {
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (otpError) setOtpError(false);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (!value && index > 0) inputs.current[index - 1]?.focus();
  };

  // ── Verify OTP ────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) { setOtpError(true); return; }
    setOtpError(false);

    setLoading(true);
    const slowTimer = setTimeout(() => setSlowNetwork(true), 8000);
    try {
      const { data: verifyData, error: fnError } = await supabase.functions.invoke('verify-otp', {
        body: { phone: phone!, code, create_session: true },
      });

      if (fnError || !verifyData?.success) {
        let errCode: string | undefined = verifyData?.error;
        if (!errCode && fnError) {
          try {
            const body = await (fnError as any).context?.json?.();
            errCode = body?.error;
          } catch { /* ignore */ }
        }

        if (errCode === 'OTP_EXPIRED') {
          showAlert(t('common.error'), t('auth.otpExpired'));
        } else if (errCode === 'MAX_ATTEMPTS') {
          showAlert(t('common.error'), t('auth.maxAttempts'));
        } else {
          showAlert(t('auth.wrongCode'), t('auth.wrongCodeMsg'));
        }
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.token_hash,
        type: 'magiclink',
      });

      if (sessionError || !sessionData?.user) {
        showAlert(t('common.error'), t('auth.sessionFailed'));
        return;
      }

      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('role, is_suspended')
        .eq('id', sessionData.user.id)
        .maybeSingle();

      if (userFetchError) {
        await supabase.auth.signOut();
        showAlert(t('common.error'), t('auth.sessionFailed'));
        return;
      }

      if (userData?.is_suspended) {
        await supabase.auth.signOut();
        showAlert(t('common.error'), t('auth.accountSuspended'));
        return;
      }

      if (!userData) {
        router.replace('/(auth)/onboarding' as any);
      } else if (userData.role === 'provider') {
        router.replace('/(provider)');
      } else {
        router.replace('/(client)');
      }
    } catch {
      showAlert(t('common.error'), t('auth.wrongCodeMsg'));
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      clearTimeout(slowTimer);
      setSlowNetwork(false);
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending || !phone) return;
    setResending(true);
    const resendSlowTimer = setTimeout(() => setSlowNetwork(true), 8000);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });

      if (error || !data?.success) {
        const errCode: string | undefined = data?.error;
        if (errCode === 'RATE_LIMITED' || errCode === 'TOO_MANY_REQUESTS') {
          showAlert(t('common.error'), t('auth.resendWait'));
        } else {
          showAlert(t('common.error'), t('auth.resendFailed'));
        }
        return;
      }

      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      startCountdown();
    } catch {
      showAlert(t('common.error'), t('auth.resendFailed'));
    } finally {
      clearTimeout(resendSlowTimer);
      setSlowNetwork(false);
      setResending(false);
    }
  };

  const canResend = countdown === 0 && !resending;

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
          onPress={() => router.replace({ pathname: '/(auth)/login' as any, params: { phone: phone ?? '' } })}
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
          <Text style={styles.title}>🔐 {t('auth.enterOtp')}</Text>
          <Text style={styles.subtitle}>{t('auth.otpSentTo')}</Text>

          {/* Phone display badge */}
          <View style={styles.phoneBadge}>
            <Text style={styles.phoneBadgeText}>{phone}</Text>
          </View>

          {/* OTP card */}
          <View style={[styles.otpCard, otpError && styles.otpCardError]}>
            <Text style={styles.otpLabel}>{t('auth.otpLabel')}</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={ref => { if (ref) inputs.current[i] = ref; }}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    otpError ? styles.otpBoxError : null,
                  ]}
                  value={digit}
                  onChangeText={v => handleChange(normalizeDigits(v).replace(/\D/g, ''), i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                />
              ))}
            </View>
          </View>

          {/* Inline error */}
          {otpError && otp.join('').length < 6 && (
            <Text style={styles.errorHint}>{t('auth.codeRequired')}</Text>
          )}

          {/* Countdown / resend */}
          <View style={styles.resendWrap}>
            {countdown > 0 ? (
              <View style={styles.countdownBadge}>
                <Text style={styles.countdownText}>
                  {t('auth.resendAfter')}{' '}
                  <Text style={styles.countdownNum}>0:{String(countdown).padStart(2, '0')}</Text>
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.resendBtn, !canResend && styles.resendBtnDisabled]}
                onPress={handleResend}
                disabled={!canResend}
                activeOpacity={0.75}
              >
                <Text style={[styles.resendBtnText, !canResend && styles.resendBtnTextDisabled]}>
                  {resending ? t('auth.resending') : `📨 ${t('auth.resend')}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Verify button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {loading ? t('auth.verifying') : `✅ ${t('auth.verify')}`}
            </Text>
          </TouchableOpacity>

          {slowNetwork && (loading || resending) && (
            <Text style={{ fontSize: 12, color: '#F59E0B', textAlign: 'center', marginBottom: 8 }}>
              {t('auth.slowNetworkVerify')}
            </Text>
          )}

          {/* Security badge */}
          <View style={styles.securityBadge}>
            <Text style={styles.securityText}>{t('auth.otpSecurity')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {AlertComponent}
    </LinearGradient>
  );
}

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean, otpBoxSize: number) {
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
      marginBottom: 12,
    },

    // Phone badge
    phoneBadge: {
      alignSelf:         'center',
      backgroundColor:   isDark ? colors.surface : 'rgba(201,168,76,0.10)',
      borderRadius:      24,
      paddingVertical:   8,
      paddingHorizontal: 20,
      marginBottom:      28,
      borderWidth:       1,
      borderColor:       isDark ? colors.border : 'rgba(201,168,76,0.35)',
    },
    phoneBadgeText: {
      fontSize:      16,
      fontWeight:    '700',
      color:         ACCENT,
      letterSpacing: 1.5,
      direction:     'ltr',
    } as any,

    // OTP card
    otpCard: {
      backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)',
      borderRadius:    16,
      padding:         20,
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.35)',
      marginBottom:    8,
      shadowColor:     ACCENT,
      shadowOffset:    { width: 0, height: 4 },
      shadowOpacity:   0.10,
      shadowRadius:    12,
      elevation:       3,
    },
    otpCardError: { borderColor: '#EF4444' },
    otpLabel: {
      fontSize:     12,
      fontWeight:   '700',
      color:        ACCENT,
      marginBottom: 16,
      textAlign:    ta,
    },
    otpRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      direction:      'ltr',
    },
    otpBox: {
      width:           otpBoxSize,
      height:          otpBoxSize + 8,
      borderRadius:    12,
      backgroundColor: isDark ? colors.bg : 'rgba(201,168,76,0.06)',
      borderWidth:     1.5,
      borderColor:     isDark ? colors.border : 'rgba(201,168,76,0.25)',
      fontSize:        rs(22, 18, 26),
      fontWeight:      '800',
      color:           colors.textPrimary,
    },
    otpBoxFilled: {
      borderColor:     ACCENT,
      backgroundColor: isDark ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.10)',
    },
    otpBoxError: { borderColor: '#EF4444' },

    // Error hint
    errorHint: {
      fontSize:     13,
      color:        '#EF4444',
      marginBottom: 8,
      textAlign:    'center',
    },

    // Countdown / resend
    resendWrap: {
      alignItems:   'center',
      marginTop:    4,
      marginBottom: 20,
    },
    countdownBadge: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderRadius:    24,
      paddingVertical:   8,
      paddingHorizontal: 16,
    },
    countdownText: {
      fontSize:  13,
      color:     colors.textMuted,
      textAlign: 'center',
    },
    countdownNum: {
      fontWeight: '700',
      color:      ACCENT,
    },
    resendBtn: {
      backgroundColor: isDark ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.10)',
      borderRadius:    24,
      borderWidth:     1,
      borderColor:     ACCENT,
      paddingVertical:   10,
      paddingHorizontal: 24,
    },
    resendBtnDisabled: {
      borderColor:     colors.border,
      backgroundColor: 'transparent',
    },
    resendBtnText: {
      fontSize:   14,
      fontWeight: '700',
      color:      ACCENT,
    },
    resendBtnTextDisabled: { color: colors.textMuted },

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

    // Security badge
    securityBadge: {
      backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
      borderRadius:    10,
      paddingVertical:   10,
      paddingHorizontal: 14,
      alignItems:      'center',
    },
    securityText: {
      fontSize:   12,
      color:      '#10B981',
      fontWeight: '600',
      textAlign:  'center',
    },
  });
}
