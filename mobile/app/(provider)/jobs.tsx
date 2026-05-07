import { useEffect, useState, useCallback, useRef, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { Job } from '../../src/types';
import { useTheme } from '../../src/context/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import { useUnreadNotifCount } from '../../src/hooks/useUnreadNotifCount';
import type { AppColors } from '../../src/constants/colors';

type JobTab = 'active' | 'completed';

type JobWithMeta = Job & {
  request?: { title: string; category_slug: string; city: string };
  client?:  { full_name: string; phone: string };
};

export default function ProviderJobs() {
  const { colors } = useTheme();
  const { t, lang, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const router = useRouter();
  const { count: notifCount } = useUnreadNotifCount();
  const [tab, setTab]             = useState<JobTab>('active');
  const [jobs, setJobs]           = useState<JobWithMeta[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName]   = useState('');
  const [providerInfo, setProviderInfo] = useState<{
    subscription_credits: number; bonus_credits: number;
    subscription_tier?: string; reputation_tier?: string;
    score?: number; lifetime_jobs?: number; is_available?: boolean;
  } | null>(null);

  const [confirmJob, setConfirmJob]       = useState<JobWithMeta | null>(null);
  const [codeInput, setCodeInput]         = useState(['', '', '', '', '', '']);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [codeSent, setCodeSent]           = useState(false);
  const [sendingCode, setSendingCode]     = useState(false);
  const inputRefs = useRef<TextInput[]>([]);

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('jobs')
        .select('*, request:requests(title, category_slug, city), client:users!jobs_client_id_fkey(full_name, phone)')
        .eq('provider_id', user.id)
        .eq('status', tab === 'active' ? 'active' : 'completed')
        .order('created_at', { ascending: false });

      if (data) setJobs(data);
  
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user.id;
      if (!uid) return;
      supabase.from('users').select('full_name').eq('id', uid).single()
        .then(({ data }) => { if (data?.full_name) setUserName(data.full_name); });
      supabase
        .from('providers')
        .select('subscription_credits, bonus_credits, subscription_tier, reputation_tier, score, lifetime_jobs, is_available')
        .eq('id', uid)
        .single()
        .then(({ data }) => { if (data) setProviderInfo(data); });
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleTaskDone = async (job: JobWithMeta) => {
    setSendingCode(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const exp  = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('jobs')
      .update({ confirm_code: code, confirm_code_exp: exp })
      .eq('id', job.id);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      setSendingCode(false);
      return;
    }

    const { data: notifResult } = await supabase.functions.invoke('send-confirm-notification', {
      body: { job_id: job.id, client_id: job.client_id, code },
    });

    setSendingCode(false);
    setCodeSent(true);
    setConfirmJob(job);

    // If push notification failed but inbox delivery succeeded — inform provider
    if (notifResult && !notifResult.sent && notifResult.inbox) {
      Alert.alert(
        '📬 ' + t('profile.confirmModal.inboxOnlyTitle'),
        t('profile.confirmModal.inboxOnlySub'),
      );
    }
    // If both failed — show warning
    if (notifResult && !notifResult.sent && !notifResult.inbox) {
      Alert.alert(
        t('common.error'),
        t('profile.confirmModal.sendFailedMsg'),
      );
    }
  };

  const handleCodeChange = (value: string, index: number) => {
    const next = [...codeInput];
    next[index] = value.replace(/\D/g, '');
    setCodeInput(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (!value && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleConfirmSubmit = async () => {
    const enteredCode = codeInput.join('');
    if (enteredCode.length < 6 || !confirmJob) return;

    setConfirmLoading(true);

    const { data, error } = await supabase.functions.invoke('confirm-job', {
      body: { job_id: confirmJob.id, code: enteredCode },
    });

    setConfirmLoading(false);

    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? t('common.unknown');
      Alert.alert(t('common.error'), msg);
      return;
    }

    setConfirmJob(null);
    setCodeSent(false);
    setCodeInput(['', '', '', '', '', '']);
    Alert.alert(
      t('profile.confirmModal.successTitle'),
      t('profile.confirmModal.successMsg')
    );
    load();
  };

  const renderActiveJob = ({ item }: { item: JobWithMeta }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.request?.title}</Text>
      <Text style={styles.cardMeta}>
        {t(`cities.${item.request?.city}`, item.request?.city ?? '')} · {new Date(item.created_at).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short' })}
      </Text>
      <Text style={styles.clientName}>{t('profile.clientLabel')}: {item.client?.full_name}</Text>

      {item.confirm_code ? (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>{t('profile.waitingCode')}</Text>
          <TouchableOpacity
            style={styles.enterCodeBtn}
            onPress={() => { setConfirmJob(item); setCodeSent(true); }}
          >
            <Text style={styles.enterCodeBtnText}>{t('profile.enterCode')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.doneBtn, sendingCode && styles.btnDisabled]}
          onPress={() => handleTaskDone(item)}
          disabled={sendingCode}
        >
          {sendingCode
            ? <ActivityIndicator color={colors.bg} size="small" />
            : <Text style={styles.doneBtnText}>{t('profile.jobsDoneConfirm')}</Text>
          }
        </TouchableOpacity>
      )}
    </View>
  );

  const renderCompletedJob = ({ item }: { item: JobWithMeta }) => (
    <View style={styles.card}>
      <View style={styles.completedBadge}>
        <Text style={styles.completedBadgeText}>{t('providerJobs.statusCompleted')}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.request?.title}</Text>
      <Text style={styles.cardMeta}>{t(`cities.${item.request?.city}`, item.request?.city ?? '')}</Text>
      {item.client_rating && (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map(s => (
            <Text key={s} style={{ fontSize: 18 }}>
              {s <= item.client_rating! ? '⭐' : '☆'}
            </Text>
          ))}
          {item.client_review && (
            <Text style={styles.reviewText}>{item.client_review}</Text>
          )}
        </View>
      )}
      <Text style={styles.confirmedAt}>
        {t('profile.completedOn', {
          date: new Date(item.confirmed_at!).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'long' })
        })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        variant="root"
        userName={userName}
        userRole="provider"
        providerScore={providerInfo?.score}
        providerRepTier={providerInfo?.reputation_tier}
        providerLifetimeJobs={providerInfo?.lifetime_jobs}
        providerBidCredits={(providerInfo?.subscription_credits ?? 0) + (providerInfo?.bonus_credits ?? 0)}
        providerSubscriptionTier={providerInfo?.subscription_tier}
        providerIsAvailable={providerInfo?.is_available}
        notifCount={notifCount}
        onNotifPress={() => router.push('/notification-inbox' as any)}
        onAvatarPress={() => router.push('/(provider)/profile' as any)}
      />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => { setTab('active'); setLoading(true); }}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>{t('profile.tabActive')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'completed' && styles.tabBtnActive]}
          onPress={() => { setTab('completed'); setLoading(true); }}
        >
          <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>{t('profile.tabCompleted')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id}
          renderItem={tab === 'active' ? renderActiveJob : renderCompletedJob}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>
                {tab === 'active' ? '🛠️' : '🏆'}
              </Text>
              <Text style={styles.emptyText}>
                {tab === 'active' ? t('profile.noActiveJobs') : t('profile.noCompletedJobs')}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Confirm Code Modal ── */}
      <Modal visible={!!confirmJob && codeSent} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('profile.confirmModal.title')}</Text>
            <Text style={styles.modalSub}>{t('profile.confirmModal.subtitle')}</Text>

            <View style={styles.codeRow}>
              {codeInput.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={ref => { if (ref) inputRefs.current[i] = ref; }}
                  style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
                  value={digit}
                  onChangeText={v => handleCodeChange(v, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                  editable={!confirmLoading}
                />
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setConfirmJob(null); setCodeSent(false); setCodeInput(['', '', '', '', '', '']); }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (codeInput.join('').length < 6 || confirmLoading) && styles.btnDisabled]}
                onPress={handleConfirmSubmit}
                disabled={codeInput.join('').length < 6 || confirmLoading}
              >
                {confirmLoading
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.modalConfirmText}>{t('profile.confirmModal.confirm')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },

  tabRow:        { flexDirection: 'row', marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive:  { backgroundColor: colors.bg },
  tabText:       { fontSize: 14, color: colors.textSecondary },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  card:       { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4, textAlign: ta },
  cardMeta:   { fontSize: 12, color: colors.textMuted, marginBottom: 4, textAlign: ta },
  clientName: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, textAlign: ta },

  doneBtn:      { backgroundColor: colors.successBg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.success },
  doneBtnText:  { fontSize: 15, fontWeight: '700', color: colors.successSoft },
  btnDisabled:  { backgroundColor: colors.border },

  waitingBox:      { backgroundColor: colors.accentDim, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', alignItems: 'center', gap: 10 },
  waitingText:     { fontSize: 13, color: colors.accent, textAlign: 'center' },
  enterCodeBtn:    { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  enterCodeBtnText:{ fontSize: 13, fontWeight: '700', color: colors.bg },

  completedBadge:     { alignSelf: 'flex-end', backgroundColor: colors.successBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  completedBadgeText: { fontSize: 11, color: colors.successSoft, fontWeight: '600' },
  ratingRow:          { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, marginBottom: 4 },
  reviewText:         { fontSize: 12, color: colors.textSecondary, marginStart: 8, flex: 1, textAlign: ta },
  confirmedAt:        { fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: ta },

  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  modalTitle:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: ta },
  modalSub:     { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 28, textAlign: ta },
  codeRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  codeBox:      { width: 48, height: 60, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  codeBoxFilled:{ borderColor: colors.accent },
  modalBtns:       { flexDirection: 'row', gap: 12 },
  modalCancel:     { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText: { fontSize: 15, color: colors.textSecondary },
  modalConfirm:    { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText:{ fontSize: 15, fontWeight: '700', color: colors.bg },
  });
}
