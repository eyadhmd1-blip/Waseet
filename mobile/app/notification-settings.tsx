import { useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import { AppHeader } from '../src/components/AppHeader';
import type { AppColors } from '../src/constants/colors';

// ─── Types ────────────────────────────────────────────────────

interface Prefs {
  enabled:          boolean;
  seasonal:         boolean;
  lifecycle:        boolean;
  behavioral:       boolean;
  quiet_hour_start: number;
  quiet_hour_end:   number;
  max_per_week:     number;
}

const DEFAULTS: Prefs = {
  enabled:          true,
  seasonal:         true,
  lifecycle:        true,
  behavioral:       true,
  quiet_hour_start: 22,
  quiet_hour_end:   8,
  max_per_week:     2,
};

// ─── Notification Log Row (for in-app center) ─────────────────

interface NotifLogRow {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  sent_at: string;
  opened_at: string | null;
  converted_at: string | null;
}

const TYPE_EMOJI: Record<string, string> = {
  seasonal:  '📅',
  lifecycle: '🔄',
  behavioral:'🧠',
  ai:        '✨',
};

const QUIET_START_OPTIONS = [20, 21, 22, 23];
const QUIET_END_OPTIONS   = [6, 7, 8, 9];

// ─── Main Screen ──────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const st = useMemo(() => createSt(colors), [colors]);
  const router = useRouter();
  const { t, ta, lang } = useLanguage();

  const [prefs,       setPrefs]       = useState<Prefs>(DEFAULTS);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [tab,         setTab]         = useState<'settings' | 'history'>('settings');
  const [history,     setHistory]     = useState<NotifLogRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const formatHour = (h: number) => {
    const isPM = h >= 12;
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const suffix = isPM ? t('notifSettings.pmSuffix') : t('notifSettings.amSuffix');
    return `${h12}:00 ${suffix}`;
  };

  const frequencyOptions = [
    { label: t('notifSettings.freq1'), value: 1 },
    { label: t('notifSettings.freq2'), value: 2 },
    { label: t('notifSettings.freq3'), value: 3 },
  ];

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setPrefs({
          enabled:          data.enabled          ?? DEFAULTS.enabled,
          seasonal:         data.seasonal         ?? DEFAULTS.seasonal,
          lifecycle:        data.lifecycle        ?? DEFAULTS.lifecycle,
          behavioral:       data.behavioral       ?? DEFAULTS.behavioral,
          quiet_hour_start: data.quiet_hour_start ?? DEFAULTS.quiet_hour_start,
          quiet_hour_end:   data.quiet_hour_end   ?? DEFAULTS.quiet_hour_end,
          max_per_week:     data.max_per_week     ?? DEFAULTS.max_per_week,
        });
      }
  
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setHistLoading(false); return; }

    const { data } = await supabase
      .from('notification_log')
      .select('id, title, body, notification_type, sent_at, opened_at, converted_at')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(30);

    if (data) setHistory(data as NotifLogRow[]);
    setHistLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === 'history' && history.length === 0) loadHistory();
  }, [tab]);

  const save = async () => {
    setSaving(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setSaving(false); return; }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() });

    setSaving(false);
    if (error) {
      Alert.alert(t('common.error'), t('notifSettings.saveErr'));
    } else {
      Alert.alert(t('notifSettings.saveSuccess'), t('notifSettings.saveSuccessMsg'));
    }
  };

  const patch = (key: keyof Prefs, value: boolean | number) =>
    setPrefs(p => ({ ...p, [key]: value }));

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <AppHeader variant="stack" title={t('notifSettings.headerTitle')} onBack={() => router.back()} />

      {/* ── Tabs ── */}
      <View style={st.tabs}>
        <TouchableOpacity
          style={[st.tab, tab === 'settings' && st.tabActive]}
          onPress={() => setTab('settings')}
        >
          <Text style={[st.tabText, tab === 'settings' && st.tabTextActive]}>
            {t('notifSettings.tabSettings')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.tab, tab === 'history' && st.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[st.tabText, tab === 'history' && st.tabTextActive]}>
            {t('notifSettings.tabHistory')}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'settings' ? (
        <Animated.ScrollView
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Master toggle ── */}
          <View style={st.masterCard}>
            <View style={[st.masterLeft, {}]}>
              <Text style={st.masterIcon}>🔔</Text>
              <View>
                <Text style={[st.masterTitle, { textAlign: ta }]}>{t('notifSettings.masterTitle')}</Text>
                <Text style={[st.masterSub, { textAlign: ta }]}>
                  {prefs.enabled ? t('notifSettings.masterEnabled') : t('notifSettings.masterDisabled')}
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={v => patch('enabled', v)}
              trackColor={{ false: colors.border, true: colors.accent + '88' }}
              thumbColor={prefs.enabled ? colors.accent : colors.textMuted}
            />
          </View>

          {/* ── Categories ── */}
          <Text style={[st.sectionTitle, { textAlign: ta }]}>{t('notifSettings.sectionCategories')}</Text>

          <View style={[st.card, !prefs.enabled && st.cardDisabled]}>
            <NotifToggle
              icon="📅"
              title={t('notifSettings.seasonalTitle')}
              sub={t('notifSettings.seasonalSub')}
              value={prefs.seasonal}
              onChange={v => patch('seasonal', v)}
              disabled={!prefs.enabled}
              ta={ta}
            />
            <Divider />
            <NotifToggle
              icon="🔄"
              title={t('notifSettings.lifecycleTitle')}
              sub={t('notifSettings.lifecycleSub')}
              value={prefs.lifecycle}
              onChange={v => patch('lifecycle', v)}
              disabled={!prefs.enabled}
              ta={ta}
            />
            <Divider />
            <NotifToggle
              icon="🧠"
              title={t('notifSettings.behavioralTitle')}
              sub={t('notifSettings.behavioralSub')}
              value={prefs.behavioral}
              onChange={v => patch('behavioral', v)}
              disabled={!prefs.enabled}
              ta={ta}
            />
          </View>

          {/* ── Frequency ── */}
          <Text style={[st.sectionTitle, { textAlign: ta }]}>{t('notifSettings.sectionFrequency')}</Text>
          <View style={[st.card, !prefs.enabled && st.cardDisabled]}>
            {frequencyOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[st.radioRow, {}]}
                onPress={() => !prefs.enabled || patch('max_per_week', opt.value)}
                activeOpacity={0.7}
              >
                <View style={[
                  st.radioCircle,
                  prefs.max_per_week === opt.value && st.radioCircleActive,
                ]}>
                  {prefs.max_per_week === opt.value && <View style={st.radioDot} />}
                </View>
                <Text style={[st.radioLabel, !prefs.enabled && { color: colors.textMuted }, { textAlign: ta }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Quiet Hours ── */}
          <Text style={[st.sectionTitle, { textAlign: ta }]}>{t('notifSettings.sectionQuietHours')}</Text>
          <View style={[st.card, !prefs.enabled && st.cardDisabled]}>
            <Text style={[st.quietDesc, { textAlign: ta }]}>{t('notifSettings.quietDesc')}</Text>
            <View style={[st.quietRow, {}]}>
              <View style={st.quietCol}>
                <Text style={st.quietLabel}>{t('notifSettings.quietStart')}</Text>
                <View style={st.quietChips}>
                  {QUIET_START_OPTIONS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[st.quietChip, prefs.quiet_hour_start === h && st.quietChipActive]}
                      onPress={() => !prefs.enabled || patch('quiet_hour_start', h)}
                    >
                      <Text style={[
                        st.quietChipText,
                        prefs.quiet_hour_start === h && st.quietChipTextActive,
                      ]}>
                        {formatHour(h)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={st.quietArrow}>←</Text>
              <View style={st.quietCol}>
                <Text style={st.quietLabel}>{t('notifSettings.quietEnd')}</Text>
                <View style={st.quietChips}>
                  {QUIET_END_OPTIONS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[st.quietChip, prefs.quiet_hour_end === h && st.quietChipActive]}
                      onPress={() => !prefs.enabled || patch('quiet_hour_end', h)}
                    >
                      <Text style={[
                        st.quietChipText,
                        prefs.quiet_hour_end === h && st.quietChipTextActive,
                      ]}>
                        {formatHour(h)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={st.quietSummary}>
              <Text style={st.quietSummaryText}>
                {t('notifSettings.quietSummary', {
                  start: formatHour(prefs.quiet_hour_start),
                  end:   formatHour(prefs.quiet_hour_end),
                })}
              </Text>
            </View>
          </View>

          {/* ── AI Badge ── */}
          <View style={[st.aiBadge, {}]}>
            <Text style={st.aiIcon}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={[st.aiTitle, { textAlign: ta }]}>{t('notifSettings.aiTitle')}</Text>
              <Text style={[st.aiSub, { textAlign: ta }]}>{t('notifSettings.aiSub')}</Text>
            </View>
          </View>

          {/* ── Save ── */}
          <TouchableOpacity
            style={[st.saveBtn, saving && { opacity: 0.7 }]}
            onPress={save}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={st.saveBtnText}>{t('notifSettings.saveBtn')}</Text>
            }
          </TouchableOpacity>
        </Animated.ScrollView>
      ) : (
        /* ── History tab ── */
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
        >
          {histLoading ? (
            <View style={st.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : history.length === 0 ? (
            <View style={st.emptyHistory}>
              <Text style={st.emptyHistoryIcon}>🔔</Text>
              <Text style={st.emptyHistoryText}>{t('notifSettings.historyEmpty')}</Text>
              <Text style={st.emptyHistorySub}>{t('notifSettings.historyEmptySub')}</Text>
            </View>
          ) : (
            history.map(n => (
              <View key={n.id} style={[st.histCard, !n.opened_at && st.histCardUnread]}>
                <View style={[st.histTop, {}]}>
                  <Text style={st.histTime}>
                    {new Date(n.sent_at).toLocaleDateString(locale, {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <View style={st.histBadges}>
                    <View style={st.histTypeBadge}>
                      <Text style={st.histTypeText}>
                        {TYPE_EMOJI[n.notification_type] ?? '🔔'} {n.notification_type}
                      </Text>
                    </View>
                    {n.converted_at && (
                      <View style={st.histConvertBadge}>
                        <Text style={st.histConvertText}>{t('notifSettings.historyConverted')}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[st.histTitle, { textAlign: ta }]}>{n.title}</Text>
                <Text style={[st.histBody, { textAlign: ta }]} numberOfLines={2}>{n.body}</Text>
                {!n.opened_at && <View style={[st.unreadDot, { [ta === 'right' ? 'left' : 'right']: 16 }]} />}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function NotifToggle({
  icon, title, sub, value, onChange, disabled, ta,
}: {
  icon: string; title: string; sub: string;
  value: boolean; onChange: (v: boolean) => void; disabled: boolean;
  ta: 'left' | 'right';
}) {
  const { colors } = useTheme();
  const toggleSt = useMemo(() => createToggleSt(colors), [colors]);
  return (
    <View style={[toggleSt.row, {}]}>
      <Text style={toggleSt.icon}>{icon}</Text>
      <View style={toggleSt.info}>
        <Text style={[toggleSt.title, disabled && { color: colors.textMuted }, { textAlign: ta }]}>{title}</Text>
        <Text style={[toggleSt.sub, { textAlign: ta }]}>{sub}</Text>
      </View>
      <Switch
        value={value && !disabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent + '88' }}
        thumbColor={value && !disabled ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

function createToggleSt(colors: AppColors) {
  return StyleSheet.create({
  row:   { alignItems: 'center', paddingVertical: 12, gap: 12 },
  icon:  { fontSize: 22, width: 32, textAlign: 'center' },
  info:  { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  sub:   { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  });
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: -16 }} />;
}

// ─── Styles ───────────────────────────────────────────────────

function createSt(colors: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:    { padding: 16, paddingBottom: 48 },


  tabs:          { flexDirection: 'row', margin: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border },
  tab:           { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabActive:     { backgroundColor: colors.bg },
  tabText:       { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.textPrimary },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 16 },

  card:         { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardDisabled: { opacity: 0.5 },

  masterCard:  { backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  masterLeft:  { alignItems: 'center', gap: 14 },
  masterIcon:  { fontSize: 28 },
  masterTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  masterSub:   { fontSize: 12, color: colors.textMuted },

  radioRow:          { alignItems: 'center', gap: 12, paddingVertical: 12 },
  radioCircle:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: colors.accent },
  radioDot:          { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  radioLabel:        { flex: 1, fontSize: 14, color: colors.textPrimary },

  quietDesc:           { fontSize: 12, color: colors.textMuted, marginBottom: 14 },
  quietRow:            { alignItems: 'flex-start', gap: 8 },
  quietCol:            { flex: 1 },
  quietLabel:          { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  quietChips:          { gap: 6 },
  quietChip:           { backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  quietChipActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  quietChipText:       { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  quietChipTextActive: { color: colors.accent },
  quietArrow:          { paddingTop: 36, fontSize: 18, color: colors.textMuted },
  quietSummary:        { marginTop: 14, backgroundColor: colors.bg, borderRadius: 10, padding: 10, alignItems: 'center' },
  quietSummaryText:    { fontSize: 12, color: colors.textMuted },

  aiBadge: { alignItems: 'center', gap: 12, backgroundColor: colors.accentDim, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)', marginTop: 20, marginBottom: 8 },
  aiIcon:  { fontSize: 28 },
  aiTitle: { fontSize: 14, fontWeight: '700', color: colors.accent, marginBottom: 3 },
  aiSub:   { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  saveBtn:     { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: colors.bg },

  // ── History ──
  emptyHistory:     { alignItems: 'center', paddingVertical: 60 },
  emptyHistoryIcon: { fontSize: 60, marginBottom: 16 },
  emptyHistoryText: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptyHistorySub:  { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  histCard:         { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, position: 'relative' },
  histCardUnread:   { borderColor: colors.accent + '44' },
  histTop:          { justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  histTime:         { fontSize: 11, color: colors.textMuted },
  histBadges:       { flexDirection: 'row', gap: 6 },
  histTypeBadge:    { backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  histTypeText:     { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  histConvertBadge: { backgroundColor: '#064E3B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  histConvertText:  { fontSize: 10, color: '#10B981', fontWeight: '700' },
  histTitle:        { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  histBody:         { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  unreadDot:        { position: 'absolute', top: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  });
}
