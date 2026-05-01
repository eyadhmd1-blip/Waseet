import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyPhoneScreen() {
  const router   = useRouter();
  const { t, isRTL } = useLanguage();
  const ta = isRTL ? 'right' : 'left' as const;
  const { colors } = useTheme();

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [step, setStep]         = useState<'enter_phone' | 'enter_code'>('enter_phone');
  const [loading, setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputs = useRef<TextInput[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load current user's phone on mount
  useEffect(() => {
    (async () => {
      const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
      if (!user?.phone) return;
      // Strip +962 prefix for display
      const display = user.phone.replace(/^\+962/, '0');
      setPhone(display);
    })();
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: phone.trim() },
      });

      if (error) {
        Alert.alert(t('common.error'), t('verifyPhone.sendFailed'));
        return;
      }

      // DEV MODE: if Unifonic is not configured, the edge function returns the
      // code directly in dev_code so the flow works without a real SMS provider.
      if (data?.dev_code) {
        const devCode = String(data.dev_code);
        setOtp(devCode.split(''));
        // Focus last input so the verify button becomes active immediately
        setTimeout(() => inputs.current[5]?.focus(), 100);
      }

      setStep('enter_code');
      startCountdown();
    } catch {
      Alert.alert(t('common.error'), t('verifyPhone.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    await handleSendOtp();
  };

  const handleChange = (value: string, index: number) => {
    const next = [...otp];
    next[index] = value.replace(/\D/g, '');
    setOtp(next);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (!value && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: phone.trim(), code },
      });

      if (error) {
        Alert.alert(t('verifyPhone.wrongCode'), t('verifyPhone.wrongCodeMsg'));
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
        return;
      }

      // Success: navigate to appropriate home screen
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .single();

      if (userData?.role === 'provider') {
        router.replace('/(provider)');
      } else {
        router.replace('/(client)');
      }
    } catch {
      Alert.alert(t('common.error'), t('verifyPhone.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📱</Text>
        </View>

        <Text style={styles.title}>
          {t('verifyPhone.title')}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'enter_phone'
            ? t('verifyPhone.subtitlePhone')
            : `${t('verifyPhone.subtitleCode')} ${phone}`}
        </Text>

        {step === 'enter_phone' ? (
          <>
            <View style={styles.inputRow}>
              <Text style={styles.countryCode}>+962</Text>
              <TextInput
                style={styles.input}
                placeholder="7X XXX XXXX"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                textAlign={ta}
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={!phone.trim() || loading}
            >
              <Text style={styles.btnText}>
                {loading ? t('verifyPhone.sending') : t('verifyPhone.sendCode')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={ref => { if (ref) inputs.current[i] = ref; }}
                  style={[styles.otpInput, digit ? styles.otpFilled : null]}
                  value={digit}
                  onChangeText={v => handleChange(v, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, (otp.join('').length < 6 || loading) && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={otp.join('').length < 6 || loading}
            >
              <Text style={styles.btnText}>
                {loading ? t('verifyPhone.verifying') : t('verifyPhone.verify')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendBtn}
              onPress={handleResend}
              disabled={countdown > 0}
            >
              <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                {countdown > 0
                  ? `${t('verifyPhone.resendIn')} ${countdown}${t('verifyPhone.seconds')}`
                  : t('verifyPhone.resend')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.changeBtn} onPress={() => setStep('enter_phone')}>
              <Text style={styles.changeText}>{t('verifyPhone.changePhone')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: colors.bg },
    content:      { flex: 1, paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' },
    iconWrap:     { marginBottom: 24 },
    icon:         { fontSize: 56 },
    title:        { fontSize: 26, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, width: '100%', alignSelf: 'stretch', textAlign: ta },
    subtitle:     { fontSize: 15, color: colors.textMuted, marginBottom: 36, width: '100%', alignSelf: 'stretch', textAlign: ta },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
    },
    countryCode:  { color: colors.textMuted, fontSize: 16, paddingRight: 12 },
    input:        { flex: 1, color: colors.textPrimary, fontSize: 18, paddingVertical: 16, letterSpacing: 2 },
    btn:          { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%' },
    btnDisabled:  { backgroundColor: colors.border },
    btnText:      { fontSize: 17, fontWeight: '700', color: colors.bg },
    otpRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, width: '100%' },
    otpInput: {
      width: 48, height: 56, borderRadius: 12,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      fontSize: 24, fontWeight: '700', color: colors.textPrimary,
    },
    otpFilled:    { borderColor: colors.accent },
    resendBtn:    { marginTop: 20, paddingVertical: 10 },
    resendText:   { color: colors.accent, fontSize: 15, fontWeight: '600' },
    resendDisabled: { color: colors.textMuted },
    changeBtn:    { marginTop: 12, paddingVertical: 10 },
    changeText:   { color: colors.textMuted, fontSize: 14 },
  });
}
