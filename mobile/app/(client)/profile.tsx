import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { JORDAN_CITIES } from '../../src/constants/categories';
import { calcStatusCounts } from '../../src/utils/pricing';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { User } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

// ─── Types ────────────────────────────────────────────────────

type Stats = {
  total:      number;
  open:       number;
  in_progress:number;
  completed:  number;
};

// ─── Component ────────────────────────────────────────────────

export default function ClientProfile() {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contentPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang, toggleLanguage } = useLanguage();
  const [user, setUser]           = useState<User | null>(null);
  const [stats, setStats]         = useState<Stats>({ total: 0, open: 0, in_progress: 0, completed: 0 });
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit mode
  const [editing, setEditing]     = useState(false);
  const [editName, setEditName]   = useState('');
  const [editCity, setEditCity]   = useState('');
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser) { setLoading(false); return; }

      const [{ data: profile }, { data: reqData }] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single(),
        supabase
          .from('requests')
          .select('status')
          .eq('client_id', authUser.id),
      ]);

      if (profile) {
        setUser(profile);
        setEditName(profile.full_name);
        setEditCity(profile.city);
      }

      if (reqData) {
        const { total, open, in_progress, completed } = calcStatusCounts(reqData);
        setStats({ total, open, in_progress, completed });
      }

  
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Save profile edits ───────────────────────────────────────

  const handleSave = async () => {
    const name = editName.trim();
    if (!name) { Alert.alert(t('common.attention'), t('auth.fullName') + ' ' + t('common.required')); return; }
    if (!editCity) { Alert.alert(t('common.attention'), t('auth.city') + ' ' + t('common.required')); return; }

    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: name, city: editCity, updated_at: new Date().toISOString() })
      .eq('id', user!.id);
    setSaving(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }

    setUser(prev => prev ? { ...prev, full_name: name, city: editCity } : prev);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(user?.full_name ?? '');
    setEditCity(user?.city ?? '');
    setEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('profile.logoutCancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: () => supabase.auth.signOut() },
      ]
    );
  };

  const handleToggleLang = () => {
    Alert.alert(
      t('profile.langChangeTitle'),
      t('profile.langChangeMsg'),
      [
        { text: t('profile.logoutCancel'), style: 'cancel' },
        { text: t('profile.langRestart'), onPress: toggleLanguage },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!user) return (
    <View style={styles.center}>
      <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 15 }}>
        {t('common.error')}
      </Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.retry') ?? 'إعادة المحاولة'}</Text>
      </TouchableOpacity>
    </View>
  );

  const memberSince = new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    month: 'long', year: 'numeric',
  });

  // Mask middle digits; use LTR mark (\u202A…\u202C) so + stays left of digits in RTL
  const maskedPhone = '\u202A' + user.phone.replace(/(\+\d{3})(\d+)(\d{3})/, (_, a, b, c) =>
    `${a}${'*'.repeat(b.length)}${c}`
  ) + '\u202C';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: contentPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* ── Hero ── */}
      <View style={styles.heroCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.full_name.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{user.full_name}</Text>
        <Text style={styles.city}>📍 {t(`cities.${user.city}`, user.city)}</Text>
        <Text style={styles.since}>{t('providerProfile.memberSince')} {memberSince}</Text>

        {!editing && (
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <StatBox label={t('profile.totalRequests')} value={String(stats.total)}       />
        <StatBox label={t('profile.openRequests')}  value={String(stats.open)}        />
        <StatBox label={t('profile.inProgress')}    value={String(stats.in_progress)} />
        <StatBox label={t('profile.completed')}     value={String(stats.completed)}   />
      </View>

      {/* ── Edit form ── */}
      {editing && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('common.edit')} {t('profile.title')}</Text>
          <View style={styles.editCard}>
            <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('auth.fullName')}</Text>
            <TextInput
              style={[styles.fieldInput, { textAlign: ta }]}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('auth.fullNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={60}
            />

            <Text style={[styles.fieldLabel, { textAlign: ta, marginTop: 16 }]}>{t('auth.city')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.cityScroll}
            >
              {JORDAN_CITIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.cityChip, editCity === c && styles.cityChipActive]}
                  onPress={() => setEditCity(c)}
                >
                  <Text style={[styles.cityChipText, editCity === c && styles.cityChipTextActive]}>
                    {t(`cities.${c}`, c)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} disabled={saving}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.saveBtnText}>{t('profile.saveChanges')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Account info ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('profile.title')}</Text>
        <View style={styles.infoCard}>
          <InfoRow label={t('profile.phone')} value={maskedPhone} />
          <InfoRow
            label={t('common.verified')}
            value={user.phone_verified ? '✓ ' + t('common.verified') : '✗ ' + t('common.unknown')}
            valueColor={user.phone_verified ? '#86EFAC' : '#FCA5A5'}
          />
        </View>
      </View>

      {/* ── Language switcher ── */}
      <TouchableOpacity style={styles.notifBtn} onPress={handleToggleLang}>
        <Text style={styles.notifBtnIcon}>🌐</Text>
        <Text style={[styles.notifBtnText, { textAlign: ta }]}>{t('profile.language')}</Text>
        <Text style={styles.notifBtnBadge}>{lang === 'ar' ? t('profile.arabic') : t('profile.english')}</Text>
      </TouchableOpacity>

      {/* ── Theme picker ── */}
      <View style={styles.notifBtn}>
        <Text style={styles.notifBtnIcon}>🎨</Text>
        <Text style={[styles.notifBtnText, { textAlign: ta }]}>{t('profile.theme')}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['dark', 'light', 'system'] as const).map(opt => (
            <TouchableOpacity
              key={opt}
              onPress={() => setTheme(opt)}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                backgroundColor: theme === opt ? colors.accent : colors.surface,
                borderWidth: 1, borderColor: theme === opt ? colors.accent : colors.border,
              }}
            >
              <Text style={{ fontSize: 12, color: theme === opt ? colors.bg : colors.textSecondary, fontWeight: '600' }}>
                {opt === 'dark' ? 'داكن' : opt === 'light' ? 'فاتح' : 'تلقائي'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Recurring contracts ── */}
      <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/recurring-request')}>
        <Text style={styles.notifBtnIcon}>🔄</Text>
        <Text style={[styles.notifBtnText, { textAlign: ta }]}>{t('recurringRequest.title')}</Text>
        <Text style={styles.notifBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Saved providers ── */}
      <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(client)/saved-providers')}>
        <Text style={styles.notifBtnIcon}>🔖</Text>
        <Text style={[styles.notifBtnText, { textAlign: ta }]}>{t('saved.title')}</Text>
        <Text style={styles.notifBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Notification settings ── */}
      <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notification-settings')}>
        <Text style={styles.notifBtnIcon}>🔔</Text>
        <Text style={[styles.notifBtnText, { textAlign: ta }]}>{t('profile.notifications')}</Text>
        <Text style={styles.notifBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Support ── */}
      <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/support')}>
        <Text style={styles.notifBtnIcon}>🎧</Text>
        <Text style={[styles.notifBtnText, { textAlign: ta }]}>{t('profile.support')}</Text>
        <Text style={styles.notifBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Sign out ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const statStyles = useMemo(() => createStatStyles(colors), [colors]);
  return (
    <View style={statStyles.box}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function InfoRow({
  label, value, valueColor,
}: {
  label: string; value: string; valueColor?: string;
}) {
  const { colors } = useTheme();
  const infoStyles = useMemo(() => createInfoStyles(colors), [colors]);
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 24 },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  heroCard:   { alignItems: 'center', paddingTop: HEADER_PAD, paddingBottom: 24, paddingHorizontal: 20 },
  avatar:     { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText: { fontSize: 36, fontWeight: '700', color: colors.bg },
  name:       { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  city:       { fontSize: 14, color: colors.textMuted, marginBottom: 4 },
  since:      { fontSize: 12, color: colors.textMuted, marginBottom: 16 },
  editBtn:    { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  editBtnText:{ fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 24 },

  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },

  editCard:    { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  fieldLabel:  { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  fieldInput:  { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border },

  cityScroll:        { marginBottom: 4 },
  cityChip:          { backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  cityChipActive:    { borderColor: colors.accent, backgroundColor: colors.accentDim },
  cityChipText:      { color: colors.textSecondary, fontSize: 13 },
  cityChipTextActive:{ color: colors.accent },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:   { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnText:{ fontSize: 14, color: colors.textSecondary },
  saveBtn:     { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.bg },
  btnDisabled: { backgroundColor: colors.border },

  infoCard:   { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },

  notifBtn:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  notifBtnIcon:  { fontSize: 18, marginRight: 10 },
  notifBtnText:  { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  notifBtnArrow: { fontSize: 16, color: colors.textMuted, marginLeft: 8 },
  notifBtnBadge: { fontSize: 13, color: colors.accent, fontWeight: '600' },

  signOutBtn:  { marginHorizontal: 16, marginTop: 8, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#7F1D1D' },
  signOutText: { fontSize: 15, color: '#FCA5A5', fontWeight: '600' },
  });
}

function createStatStyles(colors: AppColors) {
  return StyleSheet.create({
  box:   { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  value: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  label: { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  });
}

function createInfoStyles(colors: AppColors) {
  return StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  });
}
