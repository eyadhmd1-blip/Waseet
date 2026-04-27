import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Alert, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD, rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');
const OTP_BOX_SIZE = Math.max(38, Math.floor((SCREEN_W - 48) / 6) - 6);

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyScreen() {
  useInsets();
  const router = useRouter();
  const { phone, dev_code } = useLocalSearchParams<{ phone: string; dev_code?: string }>();
  const { t, isRTL } = useLanguage();
  const { colors } = useTheme();

  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

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
    if (!dev_code) return;
    const digits = String(dev_code).padStart(6, '0').split('').slice(0, 6);
    setOtp(digits);
    setTimeout(() => inputs.current[5]?.focus(), 150);
  }, [dev_code]);

  const handleChange = (value: string, index: number) => {
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (!value && index > 0) inputs.current[index - 1]?.focus();
  };

  // ── Verify OTP ────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    setLoading(true);
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
          Alert.alert(t('common.error'), 'انتهت صلاحية الرمز. اضغط "إعادة الإرسال" للحصول على رمز جديد.');
        } else if (errCode === 'MAX_ATTEMPTS') {
          Alert.alert(t('common.error'), 'تجاوزت الحد الأقصى من المحاولات. أرسل رمزاً جديداً.');
        } else {
          Alert.alert(t('auth.wrongCode'), t('auth.wrongCodeMsg'));
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
        Alert.alert(t('common.error'), 'فشل إنشاء الجلسة. أعد المحاولة.');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role, is_suspended')
        .eq('id', sessionData.user.id)
        .single();

      if (userData?.is_suspended) {
        await supabase.auth.signOut();
        Alert.alert(
          t('common.error'),
          'تم إيقاف حسابك مؤقتاً. للاستفسار تواصل مع فريق الدعم.',
        );
        return;
      }

      if (!userData) {
        router.replace('/(auth)/onboarding' as any);
      } else if (userData.role === 'provider') {
        router.replace('/(provider)');
      } else {
        router.replace('/(client)');
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), t('auth.wrongCodeMsg'));
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending || !phone) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });

      if (error || !data?.success) {
        const errCode: string | undefined = data?.error;
        if (errCode === 'RATE_LIMITED' || errCode === 'TOO_MANY_REQUESTS') {
          Alert.alert(t('common.error'), 'انتظر قليلاً قبل إعادة الإرسال.');
        } else {
          Alert.alert(t('common.error'), 'فشل إعادة الإرسال. تحقق من اتصالك.');
        }
        return;
      }

      // Reset OTP inputs and restart countdown
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      startCountdown();
    } catch {
      Alert.alert(t('common.error'), 'فشل إعادة الإرسال. تحقق من اتصالك.');
    } finally {
      setResending(false);
    }
  };

  const canResend = countdown === 0 && !resending;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>{isRTL ? '→' : '←'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.enterOtp')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.otpSentTo')} {phone}
        </Text>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { if (ref) inputs.current[i] = ref; }}
              style={[styles.otpInput, digit ? styles.otpFilled : null]}
              value={digit}
              onChangeText={v => handleChange(v.replace(/\D/g, ''), i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.btn, (otp.join('').length < 6 || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={otp.join('').length < 6 || loading}
        >
          <Text style={styles.btnText}>
            {loading ? t('auth.verifying') : t('auth.verify')}
          </Text>
        </TouchableOpacity>

        {/* Resend row */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            // Countdown active
            <Text style={styles.resendHint}>
              {t('auth.resendIn')}{' '}
              <Text style={styles.resendCountdown}>
                0:{String(countdown).padStart(2, '0')}
              </Text>
            </Text>
          ) : (
            // Countdown done — show resend button
            <TouchableOpacity onPress={handleResend} disabled={!canResend}>
              <Text style={[styles.resendBtn, !canResend && styles.resendBtnDisabled]}>
                {resending ? t('auth.resending') : t('auth.resend')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left';
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: colors.bg },
    back: {
      paddingHorizontal: 24,
      paddingTop:        HEADER_PAD,
      paddingBottom:     8,
      alignItems:        isRTL ? 'flex-end' : 'flex-start',
    },
    backText:   { fontSize: 24, color: colors.textSecondary },
    content:    { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    title:      { fontSize: rs(28, 22, 32), fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: ta, alignSelf: 'stretch' },
    subtitle:   { fontSize: rs(15, 13, 17), color: colors.textMuted, marginBottom: 40, textAlign: ta, alignSelf: 'stretch' },

    otpRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
    otpInput: {
      width: OTP_BOX_SIZE, height: OTP_BOX_SIZE + 8, borderRadius: 12,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      fontSize: rs(24, 18, 28), fontWeight: '700', color: colors.textPrimary,
    },
    otpFilled:  { borderColor: colors.accent },

    btn:        { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    btnDisabled:{ backgroundColor: colors.border },
    btnText:    { fontSize: rs(17, 15, 19), fontWeight: '700', color: colors.bg },

    resendRow:       { marginTop: 24, alignItems: 'center' },
    resendHint:        { fontSize: 13, color: colors.textMuted, textAlign: ta, alignSelf: 'stretch' },
    resendCountdown:   { fontSize: 13, fontWeight: '700', color: colors.accent },
    resendBtn:         { fontSize: 14, color: colors.accent, fontWeight: '600', paddingVertical: 4, textAlign: ta },
    resendBtnDisabled: { color: colors.textMuted },
  });
}
