import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';

export default function LoginScreen() {
    useInsets();
  const router = useRouter();
  const { t, ta } = useLanguage();
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const raw = phone.trim().replace(/\s+/g, '');
    if (!raw) return;

    // Normalise to E.164 (+962XXXXXXXX)
    const formatted = raw.startsWith('+')
      ? raw
      : `+962${raw.replace(/^0+/, '')}`;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone: formatted },
      });

      if (error || !data?.success) {
        const errCode: string | undefined = data?.error;
        if (errCode === 'INVALID_JORDAN_PHONE' || errCode === 'INVALID_PHONE') {
          Alert.alert(t('common.error'), 'رقم الهاتف غير صالح. أدخل رقماً أردنياً صحيحاً.');
        } else if (errCode === 'RATE_LIMITED' || errCode === 'TOO_MANY_REQUESTS') {
          Alert.alert(t('common.error'), 'تجاوزت الحد المسموح. انتظر قليلاً وأعد المحاولة.');
        } else {
          Alert.alert(t('common.error'), 'فشل إرسال رمز التحقق. تحقق من اتصالك بالإنترنت.');
        }
        return;
      }

      // DEV MODE: send-otp returns dev_code when Unifonic is not configured
      const params: Record<string, string> = { phone: formatted };
      if (data.dev_code) params.dev_code = String(data.dev_code);

      router.push({ pathname: '/(auth)/verify', params });
    } catch {
      Alert.alert(t('common.error'), 'فشل إرسال رمز التحقق. تحقق من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>→</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, { textAlign: ta }]}>{t('auth.enterPhone')}</Text>
        <Text style={[styles.subtitle, { textAlign: ta }]}>{t('auth.phoneSubtitle')}</Text>

        {/* Phone input */}
        <View style={styles.inputRow}>
          <Text style={styles.countryCode}>+962</Text>
          <TextInput
            style={styles.input}
            placeholder="7X XXX XXXX"
            placeholderTextColor="#475569"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            textAlign="left"
            maxLength={10}
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, (!phone || loading) && styles.btnDisabled]}
          onPress={handleSendOtp}
          disabled={!phone || loading}
        >
          <Text style={styles.btnText}>
            {loading ? t('auth.sending') : t('auth.sendCode')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0F172A' },
  back:        { padding: 24, paddingTop: HEADER_PAD },
  backText:    { fontSize: 24, color: '#94A3B8', transform: [{ scaleX: -1 }] },
  content:     { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  title:       { fontSize: 28, fontWeight: '700', color: '#F1F5F9', marginBottom: 8 },
  subtitle:    { fontSize: 15, color: '#64748B', marginBottom: 40 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  countryCode: { color: '#64748B', fontSize: 16, paddingRight: 12 },
  input:       { flex: 1, color: '#F1F5F9', fontSize: 18, paddingVertical: 16, letterSpacing: 2 },
  btn:         { backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#334155' },
  btnText:     { fontSize: 17, fontWeight: '700', color: '#0F172A' },
});
