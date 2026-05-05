import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

export default function LoginScreen() {
  useInsets();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { colors } = useTheme();
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);

  // Rebuild styles whenever colors OR text direction changes
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const handleSendOtp = async () => {
    const raw = phone.trim().replace(/\s+/g, '');
    if (!raw) return;

    const formatted = raw.startsWith('+')
      ? raw
      : `+962${raw.replace(/^0+/, '')}`;

    // Client-side validation — instant feedback, no network call needed
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

      // supabase.functions.invoke puts non-2xx responses in `error` (FunctionsHttpError),
      // not in `data` — so we parse the response body from the error context first.
      let errCode: string | undefined;
      if (error) {
        try {
          const body = await (error as any).context?.json?.();
          errCode = body?.error;
        } catch { /* non-JSON or no context, leave undefined */ }
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Back arrow — positioned to correct edge for RTL/LTR */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>{isRTL ? '→' : '←'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.enterPhone')}</Text>
        <Text style={styles.subtitle}>{t('auth.phoneSubtitle')}</Text>

        {/* Phone input — direction: ltr keeps +962 on left regardless of I18nManager */}
        <View style={styles.inputRow}>
          <Text style={styles.countryCode}>+962</Text>
          <TextInput
            style={styles.input}
            placeholder="7X XXX XXXX"
            placeholderTextColor="#475569"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
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

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    // Back arrow anchored to the correct edge
    back: {
      paddingHorizontal: 24,
      paddingTop:        HEADER_PAD,
      paddingBottom:     8,
      alignItems:        isRTL ? 'flex-end' : 'flex-start',
    },
    backText: { fontSize: 24, color: colors.textSecondary },

    content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },

    // Full-width + explicit alignment so textAlign is never ambiguous
    title: {
      fontSize:    28,
      fontWeight:  '700',
      color:       colors.textPrimary,
      marginBottom: 8,
      textAlign:   ta,
      alignSelf:   'stretch',
    },
    subtitle: {
      fontSize:    15,
      color:       colors.textMuted,
      marginBottom: 40,
      textAlign:   ta,
      alignSelf:   'stretch',
    },

    // direction: 'ltr' prevents I18nManager RTL from reversing +962 / input order
    inputRow: {
      direction:         'ltr',
      flexDirection:     'row',
      alignItems:        'center',
      backgroundColor:   colors.surface,
      borderRadius:      12,
      paddingHorizontal: 16,
      marginBottom:      24,
      borderWidth:       1,
      borderColor:       colors.border,
    },
    countryCode: {
      color:       colors.textMuted,
      fontSize:    16,
      paddingRight: 12,
    },
    input: {
      flex:          1,
      color:         colors.textPrimary,
      fontSize:      18,
      paddingVertical: 16,
      letterSpacing: 2,
      textAlign:     'left',
    },

    btn:        { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    btnDisabled:{ backgroundColor: colors.border },
    btnText:    { fontSize: 17, fontWeight: '700', color: colors.bg },
  });
}
