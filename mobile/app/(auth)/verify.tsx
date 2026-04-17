import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Alert, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD, rs } from '../../src/utils/layout';

const { width: SCREEN_W } = Dimensions.get('window');
// 6 boxes, 48px total horizontal padding, small natural gaps
const OTP_BOX_SIZE = Math.max(38, Math.floor((SCREEN_W - 48) / 6) - 6);

export default function VerifyScreen() {
  useInsets();
  const router = useRouter();
  const { phone, dev_code } = useLocalSearchParams<{ phone: string; dev_code?: string }>();
  const { t, ta } = useLanguage();
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  // DEV MODE: auto-fill OTP when dev_code is provided by the login screen
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

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    setLoading(true);
    try {
      // ── Step 1: verify OTP via Edge Function ─────────────────────────────
      // Pass create_session=true so the function also creates/resolves the
      // Supabase auth user and returns a token_hash we can exchange for a
      // real session.
      const { data: verifyData, error: fnError } = await supabase.functions.invoke('verify-otp', {
        body: { phone: phone!, code, create_session: true },
      });

      if (fnError || !verifyData?.success) {
        // Attempt to extract the specific error code for better UX
        let errCode: string | undefined = verifyData?.error;
        if (!errCode && fnError) {
          try {
            const body = await (fnError as any).context?.json?.();
            errCode = body?.error;
          } catch { /* ignore */ }
        }

        if (errCode === 'OTP_EXPIRED') {
          Alert.alert(t('common.error'), 'انتهت صلاحية الرمز. ارجع وأرسل رمزاً جديداً.');
        } else if (errCode === 'MAX_ATTEMPTS') {
          Alert.alert(t('common.error'), 'تجاوزت الحد الأقصى من المحاولات. أرسل رمزاً جديداً.');
        } else {
          Alert.alert(t('auth.wrongCode'), t('auth.wrongCodeMsg'));
        }
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
        return;
      }

      // ── Step 2: exchange token_hash for a real Supabase auth session ──────
      const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.token_hash,
        type: 'magiclink',
      });

      if (sessionError || !sessionData?.user) {
        console.error('Session creation failed:', sessionError?.message);
        Alert.alert(t('common.error'), 'فشل إنشاء الجلسة. أعد المحاولة.');
        return;
      }

      // ── Step 3: route based on user profile ───────────────────────────────
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', sessionData.user.id)
        .single();

      if (!userData) {
        // No profile row yet — new user goes to onboarding
        router.replace('/(auth)/onboarding' as any);
      } else if (userData.role === 'provider') {
        router.replace('/(provider)');
      } else {
        router.replace('/(client)');
      }
    } catch (err: any) {
      console.error('handleVerify error:', err?.message);
      Alert.alert(t('common.error'), t('auth.wrongCodeMsg'));
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>→</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, { textAlign: ta }]}>{t('auth.enterOtp')}</Text>
        <Text style={[styles.subtitle, { textAlign: ta }]}>
          {t('auth.otpSentTo')} {phone}
        </Text>

        {/* OTP boxes — native RTL engine handles direction, no manual row-reverse needed */}
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

        <TouchableOpacity
          style={[styles.btn, (otp.join('').length < 6 || loading) && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={otp.join('').length < 6 || loading}
        >
          <Text style={styles.btnText}>
            {loading ? t('auth.verifying') : t('auth.verify')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0F172A' },
  back:       { padding: 24, paddingTop: HEADER_PAD },
  backText:   { fontSize: 24, color: '#94A3B8', transform: [{ scaleX: -1 }] },
  content:    { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title:      { fontSize: rs(28, 22, 32), fontWeight: '700', color: '#F1F5F9', marginBottom: 8 },
  subtitle:   { fontSize: rs(15, 13, 17), color: '#64748B', marginBottom: 40 },
  otpRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  otpInput: {
    width: OTP_BOX_SIZE, height: OTP_BOX_SIZE + 8, borderRadius: 12,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
    fontSize: rs(24, 18, 28), fontWeight: '700', color: '#F1F5F9',
  },
  otpFilled:  { borderColor: '#F59E0B' },
  btn:        { backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled:{ backgroundColor: '#334155' },
  btnText:    { fontSize: rs(17, 15, 19), fontWeight: '700', color: '#0F172A' },
});
