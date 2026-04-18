import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { JORDAN_CITIES } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { COLORS } from '../../src/constants/theme';

type Role = 'client' | 'provider';

export default function RegisterScreen() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, isRTL } = useLanguage();
  const [role, setRole]         = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [city, setCity]         = useState('');
  const [loading, setLoading]   = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !city) {
      Alert.alert(t('common.attention'), t('auth.fillAllFields'));
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
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
      Alert.alert(t('common.error'), error.message);
      setLoading(false);
      return;
    }

    if (role === 'provider') {
      await supabase.from('providers').insert({ id: user.id });
    }

    setLoading(false);
    router.replace(role === 'provider' ? '/(provider)' : '/(client)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { textAlign: ta }]}>{t('auth.completeRegister')}</Text>

      {/* Role selector */}
      <Text style={[styles.label, { textAlign: ta }]}>{t('auth.iAm')}</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'client' && styles.roleBtnActive]}
          onPress={() => setRole('client')}
        >
          <Text style={styles.roleIcon}>🙋</Text>
          <Text style={[styles.roleText, role === 'client' && styles.roleTextActive]}>
            {t('auth.lookingForService')}
          </Text>
          <Text style={styles.roleSubText}>{t('auth.clientRole')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleBtn, role === 'provider' && styles.roleBtnActive]}
          onPress={() => setRole('provider')}
        >
          <Text style={styles.roleIcon}>🔧</Text>
          <Text style={[styles.roleText, role === 'provider' && styles.roleTextActive]}>
            {t('auth.offeringService')}
          </Text>
          <Text style={styles.roleSubText}>{t('auth.providerRole')}</Text>
        </TouchableOpacity>
      </View>

      {/* Full name */}
      <Text style={[styles.label, { textAlign: ta }]}>{t('auth.fullName')}</Text>
      <TextInput
        style={[styles.input, { textAlign: ta }]}
        placeholder={t('auth.fullNamePlaceholder')}
        placeholderTextColor="#475569"
        value={fullName}
        onChangeText={setFullName}
      />

      {/* City */}
      <Text style={[styles.label, { textAlign: ta }]}>{t('auth.city')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll}>
        {JORDAN_CITIES.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.cityChip, city === c && styles.cityChipActive]}
            onPress={() => setCity(c)}
          >
            <Text style={[styles.cityText, city === c && styles.cityTextActive]}>
              {t(`cities.${c}`, c)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.btn, (!fullName || !city || loading) && styles.btnDisabled]}
        onPress={handleRegister}
        disabled={!fullName || !city || loading}
      >
        <Text style={styles.btnText}>
          {loading ? t('auth.registering') : t('auth.createAccount')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },
  content:       { padding: 24, paddingTop: HEADER_PAD },
  title:         { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 32 },
  label:         { fontSize: 14, color: COLORS.textSecondary, marginBottom: 10, marginTop: 20 },
  roleRow:       { flexDirection: 'row', gap: 12 },
  roleBtn:       { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  roleBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  roleIcon:      { fontSize: 28, marginBottom: 8 },
  roleText:      { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  roleTextActive:{ color: COLORS.accent },
  roleSubText:   { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, color: COLORS.textPrimary, fontSize: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cityScroll:    { marginBottom: 8 },
  cityChip:      { backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: COLORS.border },
  cityChipActive:{ borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  cityText:      { color: COLORS.textSecondary, fontSize: 14 },
  cityTextActive:{ color: COLORS.accent },
  btn:           { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 32 },
  btnDisabled:   { backgroundColor: COLORS.border },
  btnText:       { fontSize: 17, fontWeight: '700', color: COLORS.bg },
});
