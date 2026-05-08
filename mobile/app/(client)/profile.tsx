import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
  KeyboardAvoidingView, Platform, Animated,
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

type Stats = {
  total:       number;
  open:        number;
  in_progress: number;
  completed:   number;
};

// ─── Quick action item ────────────────────────────────────────

function QuickAction({
  icon, label, onPress,
}: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[qa.cell, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={qa.icon}>{icon}</Text>
      <Text style={[qa.label, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const qa = StyleSheet.create({
  cell:  { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 18, alignItems: 'center', gap: 8 },
  icon:  { fontSize: 26 },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});

// ─── Primary stat card (large) ────────────────────────────────

function BigStat({ value, label, icon, accentColor }: {
  value: number; label: string; icon: string; accentColor: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[bs.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={bs.icon}>{icon}</Text>
      <Text style={[bs.value, { color: accentColor }]}>{value}</Text>
      <Text style={[bs.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const bs = StyleSheet.create({
  card:  { flex: 1, borderRadius: 20, borderWidth: 1, paddingVertical: 20, alignItems: 'center', gap: 4 },
  icon:  { fontSize: 24, marginBottom: 4 },
  value: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

// ─── Small stat pill (secondary) ─────────────────────────────

function SmallStat({ value, label, icon, color }: {
  value: number; label: string; icon: string; color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[ss.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={ss.icon}>{icon}</Text>
      <Text style={[ss.value, { color }]}>{value}</Text>
      <Text style={[ss.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  pill:  { flex: 1, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  icon:  { fontSize: 14 },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600' },
});

// ─── Main Component ───────────────────────────────────────────

export default function ClientProfile() {
  const { colors, theme, setTheme } = useTheme();
  const { t, lang, toggleLanguage, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const { contentPad } = useInsets();
  const router = useRouter();

  const [user,       setUser]       = useState<User | null>(null);
  const [stats,      setStats]      = useState<Stats>({ total: 0, open: 0, in_progress: 0, completed: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit mode
  const [editing,   setEditing]   = useState(false);
  const [editName,  setEditName]  = useState('');
  const [editCity,  setEditCity]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const saveBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(saveBarAnim, { toValue: editing ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [editing]);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser) { setLoading(false); return; }

      const [{ data: profile }, { data: reqData }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('requests').select('status').eq('client_id', authUser.id),
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
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSave = async () => {
    const name = editName.trim();
    if (!name)     { Alert.alert(t('common.attention'), t('auth.fullName') + ' ' + t('common.required')); return; }
    if (!editCity) { Alert.alert(t('common.attention'), t('auth.city')     + ' ' + t('common.required')); return; }

    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: name, city: editCity, updated_at: new Date().toISOString() })
      .eq('id', user!.id);
    setSaving(false);

    if (error) { Alert.alert(t('common.error'), error.message); return; }

    setUser(prev => prev ? { ...prev, full_name: name, city: editCity } : prev);
    setEditing(false);
  };

  const handleCancelEdit = () => { setEditName(user?.full_name ?? ''); setEditCity(user?.city ?? ''); setEditing(false); };

  const handleSignOut = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('profile.logoutCancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleToggleLang = () => {
    Alert.alert(t('profile.langChangeTitle'), t('profile.langChangeMsg'), [
      { text: t('profile.logoutCancel'), style: 'cancel' },
      { text: t('profile.langRestart'), onPress: toggleLanguage },
    ]);
  };

  // ── Loading / error ──────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!user) return (
    <View style={styles.center}>
      <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 15 }}>{t('common.error')}</Text>
      <TouchableOpacity onPress={load} style={{ backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.retry') ?? 'إعادة المحاولة'}</Text>
      </TouchableOpacity>
    </View>
  );

  const memberSince = new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    month: 'long', year: 'numeric',
  });

  const maskedPhone = '‪' + user.phone.replace(/(\+\d{3})(\d+)(\d{3})/, (_, a, b, c) =>
    `${a}${'*'.repeat(b.length)}${c}`
  ) + '‬';

  // ── Render ───────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Sticky save bar ── */}
      <Animated.View
        pointerEvents={editing ? 'auto' : 'none'}
        style={[styles.saveBar, {
          opacity: saveBarAnim,
          transform: [{ translateY: saveBarAnim.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) }],
        }]}
      >
        <TouchableOpacity style={styles.saveBarCancel} onPress={handleCancelEdit} disabled={saving}>
          <Text style={styles.saveBarCancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveBarSave, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Text style={styles.saveBarSaveText}>{t('profile.saveChanges')}</Text>
          }
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: contentPad + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >

        {/* ══ HERO HEADER ══════════════════════════════════════ */}
        <View style={styles.hero}>
          {/* subtle accent glow layer */}
          <View style={[StyleSheet.absoluteFillObject, styles.heroGlow]} pointerEvents="none" />

          {/* avatar with accent ring */}
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.full_name.charAt(0)}</Text>
            </View>
          </View>

          <Text style={styles.heroName}>{user.full_name}</Text>

          {/* city + verified pill row */}
          <View style={styles.heroPills}>
            <View style={[styles.pill, { backgroundColor: colors.accent + '22' }]}>
              <Text style={[styles.pillText, { color: colors.accent }]}>
                📍 {t(`cities.${user.city}`, user.city)}
              </Text>
            </View>
            {user.phone_verified && (
              <View style={[styles.pill, { backgroundColor: colors.success + '22' }]}>
                <Text style={[styles.pillText, { color: colors.successSoft }]}>✓ موثّق</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroSince}>
            {t('providerProfile.memberSince')} {memberSince}
          </Text>

          {!editing && (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)} activeOpacity={0.8}>
              <Text style={styles.editBtnText}>{t('profile.editProfile')} ✎</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ══ STATS ════════════════════════════════════════════ */}
        <View style={styles.section}>
          {/* Primary row */}
          <View style={styles.statsRowBig}>
            <BigStat value={stats.total}     label={t('profile.totalRequests')} icon="📋" accentColor={colors.accent} />
            <BigStat value={stats.completed} label={t('profile.completed')}     icon="✅" accentColor={colors.success} />
          </View>
          {/* Secondary row */}
          <View style={styles.statsRowSmall}>
            <SmallStat value={stats.in_progress} label={t('profile.inProgress')} icon="⚙️" color={colors.info} />
            <SmallStat value={stats.open}         label={t('profile.openRequests')} icon="🕐" color={colors.accent} />
          </View>
        </View>

        {/* ══ EDIT FORM (conditional) ═══════════════════════════ */}
        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('common.edit')} {t('profile.title')}</Text>
            <View style={[styles.card, { gap: 0 }]}>
              <Text style={styles.fieldLabel}>{t('auth.fullName')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('auth.fullNamePlaceholder')}
                placeholderTextColor={colors.textMuted}
                maxLength={60}
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>{t('auth.city')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 0 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
                  {JORDAN_CITIES.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.cityChip, editCity === c && { borderColor: colors.accent, backgroundColor: colors.accentDim }]}
                      onPress={() => setEditCity(c)}
                    >
                      <Text style={[styles.cityChipText, editCity === c && { color: colors.accent }]}>
                        {t(`cities.${c}`, c)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* ══ QUICK ACTIONS GRID ═══════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خدماتي</Text>
          <View style={styles.qaGrid}>
            <View style={styles.qaRow}>
              <QuickAction icon="🔖" label={t('saved.title')}             onPress={() => router.push('/(client)/saved-providers')} />
              <QuickAction icon="🔔" label={t('profile.notifications')}   onPress={() => router.push('/notification-settings')} />
            </View>
            <View style={styles.qaRow}>
              <QuickAction icon="🎧" label={t('profile.support')}         onPress={() => router.push('/support')} />
              <QuickAction icon="❓" label={t('helpCenter.title')}        onPress={() => router.push('/help-center?role=client' as any)} />
            </View>
          </View>
        </View>

        {/* ══ SETTINGS CARD ════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.theme')} والتفضيلات</Text>
          <View style={styles.card}>

            {/* Language row */}
            <TouchableOpacity style={styles.settingRow} onPress={handleToggleLang} activeOpacity={0.7}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: colors.infoBg }]}>
                  <Text style={{ fontSize: 16 }}>🌐</Text>
                </View>
                <Text style={styles.settingLabel}>{t('profile.language')}</Text>
              </View>
              <View style={[styles.settingBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}>
                <Text style={[styles.settingBadgeText, { color: colors.accent }]}>
                  {lang === 'ar' ? t('profile.arabic') : t('profile.english')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Theme row */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: colors.accentDim }]}>
                  <Text style={{ fontSize: 16 }}>🎨</Text>
                </View>
                <Text style={styles.settingLabel}>{t('profile.theme')}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['dark', 'light', 'system'] as const).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setTheme(opt)}
                    style={[
                      styles.themeBtn,
                      theme === opt && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme === opt ? colors.bg : colors.textSecondary }}>
                      {opt === 'dark' ? '🌙' : opt === 'light' ? '☀️' : '⚙️'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>
        </View>

        {/* ══ ACCOUNT INFO CARD ════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.title')}</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: colors.surface }]}>
                  <Text style={{ fontSize: 16 }}>📱</Text>
                </View>
                <Text style={styles.settingLabel}>{t('profile.phone')}</Text>
              </View>
              <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>{maskedPhone}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: user.phone_verified ? colors.successBg : colors.surface }]}>
                  <Text style={{ fontSize: 16 }}>{user.phone_verified ? '✅' : '⚪'}</Text>
                </View>
                <Text style={styles.settingLabel}>{t('common.verified')}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: user.phone_verified ? colors.successSoft : colors.textMuted }}>
                {user.phone_verified ? '✓ ' + t('common.verified') : '✗ ' + t('common.unknown')}
              </Text>
            </View>
          </View>
        </View>

        {/* ══ SIGN OUT ══════════════════════════════════════════ */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Text style={styles.signOutIcon}>🚪</Text>
            <Text style={styles.signOutText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

    // ── Save bar ──
    saveBar: {
      flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border,
      elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 6,
    },
    saveBarCancel:     { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    saveBarCancelText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
    saveBarSave:       { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    saveBarSaveText:   { fontSize: 14, fontWeight: '700', color: colors.bg },
    btnDisabled:       { backgroundColor: colors.border },

    // ── Hero ──
    hero: {
      paddingTop: HEADER_PAD,
      paddingBottom: 36,
      paddingHorizontal: 24,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 36,
      borderBottomRightRadius: 36,
      overflow: 'hidden',
      // subtle shadow to separate hero from content
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
    heroGlow: {
      backgroundColor: colors.accent,
      opacity: 0.05,
      borderBottomLeftRadius: 36,
      borderBottomRightRadius: 36,
    },

    avatarRing: {
      width: 100, height: 100, borderRadius: 50,
      borderWidth: 3, borderColor: colors.accent,
      padding: 4,
      marginBottom: 16,
      alignItems: 'center', justifyContent: 'center',
      // gold glow ring
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 8,
    },
    avatar: {
      width: 84, height: 84, borderRadius: 42,
      backgroundColor: colors.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontSize: 36, fontWeight: '800', color: colors.bg },

    heroName:  { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 12, textAlign: 'center' },

    heroPills: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    pill:      { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
    pillText:  { fontSize: 12, fontWeight: '700' },

    heroSince: { fontSize: 11, color: colors.textMuted, marginBottom: 20 },

    editBtn:     { backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9, borderWidth: 1.5, borderColor: colors.border },
    editBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },

    // ── Section wrapper ──
    section:      { paddingHorizontal: 16, marginTop: 24 },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textMuted, marginBottom: 10, textAlign: ta, letterSpacing: 0.5, textTransform: 'uppercase' },

    // ── Stats ──
    statsRowBig:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
    statsRowSmall: { flexDirection: 'row', gap: 10 },

    // ── Generic card ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 6,
      gap: 0,
    },

    // ── Edit form ──
    fieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 8, marginTop: 16, textAlign: ta, fontWeight: '600' },
    fieldInput: {
      backgroundColor: colors.bg, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 13,
      color: colors.textPrimary, fontSize: 15,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: 4,
    },
    cityChip:     { backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
    cityChipText: { color: colors.textSecondary, fontSize: 13 },

    // ── Quick actions ──
    qaGrid: { gap: 10 },
    qaRow:  { flexDirection: 'row', gap: 10 },

    // ── Settings rows ──
    settingRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14,
    },
    settingLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    settingIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    settingLabel:    { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
    settingBadge:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
    settingBadgeText:{ fontSize: 12, fontWeight: '700' },

    themeBtn: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    },

    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: -16 },

    // ── Info rows ──
    infoRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
    infoValue:{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

    // ── Sign out ──
    signOutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      paddingVertical: 16, borderRadius: 18,
      borderWidth: 1, borderColor: colors.errorBg,
      backgroundColor: colors.errorDeepBg,
    },
    signOutIcon: { fontSize: 18 },
    signOutText: { fontSize: 15, color: colors.errorSoft, fontWeight: '700' },
  });
}
