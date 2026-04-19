// ============================================================
// WASEET — Provider Confirm Screen
// Provider confirms they will show up within the deadline.
// Opened via push notification deep link (screen: provider_confirm).
// Also reachable from provider jobs/feed when a commit is pending.
// ============================================================

import { useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import type { Job } from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

type JobWithMeta = Job & {
  request?: { title: string; city: string; category_slug: string; is_urgent?: boolean };
  client?:  { full_name: string };
  bid?:     { amount: number; currency: string };
};

export default function ProviderConfirmScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { job_id } = useLocalSearchParams<{ job_id: string }>();
  const { t } = useLanguage();

  const [job, setJob]           = useState<JobWithMeta | null>(null);
  const [loading, setLoading]   = useState(true);
  const [secondsLeft, setSecs]  = useState(0);
  const [expired, setExpired]   = useState(false);
  const [acting, setActing]     = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringPulse   = useRef(new Animated.Value(1)).current;

  const isUrgent = !!(job?.request as any)?.is_urgent;
  const totalSecs = isUrgent ? 300 : 900;

  useEffect(() => {
    if (!job_id) return;

    supabase
      .from('jobs')
      .select(`
        *,
        request:requests ( title, city, category_slug, is_urgent ),
        client:users!jobs_client_id_fkey ( full_name ),
        bid:bids ( amount, currency )
      `)
      .eq('id', job_id)
      .single()
      .then(({ data }) => {
        if (!data) { setLoading(false); return; }
        setJob(data as JobWithMeta);
        setLoading(false);

        if (data.provider_committed_at) {
          router.replace({ pathname: '/chat', params: { job_id } });
          return;
        }
        if (data.provider_declined || data.status === 'cancelled') {
          router.replace('/(provider)');
          return;
        }

        const deadline = data.provider_commit_deadline
          ? new Date(data.provider_commit_deadline).getTime()
          : Date.now() + totalSecs * 1000;

        const tick = () => {
          const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
          setSecs(remaining);
          if (remaining <= 0) {
            clearInterval(intervalRef.current!);
            setExpired(true);
          }
        };
        tick();
        intervalRef.current = setInterval(tick, 1000);
      });

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [job_id]);

  useEffect(() => {
    if (!isUrgent) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.06, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(ringPulse, { toValue: 1,    duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, [isUrgent]);

  const fmtMSS = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleConfirm = useCallback(async () => {
    setActing(true);
    const { data, error } = await supabase.rpc('provider_commit_job', { p_job_id: job_id });
    setActing(false);

    if (error || data?.error) {
      const msg = data?.error === 'deadline_expired'
        ? t('providerConfirm.errDeadlineExpired')
        : t('providerConfirm.errConfirmFailed');
      Alert.alert(t('providerConfirm.errTitle'), msg);
      if (data?.error === 'deadline_expired') {
        router.replace('/(provider)');
      }
      return;
    }

    clearInterval(intervalRef.current!);
    Alert.alert(
      t('providerConfirm.successTitle'),
      t('providerConfirm.successMsg'),
      [{ text: t('providerConfirm.openChat'), onPress: () => router.replace({ pathname: '/chat', params: { job_id } }) }],
    );
  }, [job_id, t]);

  const handleDecline = useCallback(() => {
    Alert.alert(
      t('providerConfirm.declineConfirmTitle'),
      t('providerConfirm.declineConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('providerConfirm.declineYes'),
          style: 'destructive',
          onPress: async () => {
            setActing(true);
            await supabase.rpc('provider_decline_job', { p_job_id: job_id });
            setActing(false);
            clearInterval(intervalRef.current!);
            router.replace('/(provider)');
          },
        },
      ],
    );
  }, [job_id, t]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('providerConfirm.notFound')}</Text>
        <TouchableOpacity onPress={() => router.replace('/(provider)')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (expired) {
    return (
      <View style={[styles.container, isUrgent && styles.containerUrgent]}>
        <Text style={styles.expiredIcon}>⌛</Text>
        <Text style={[styles.expiredTitle, isUrgent && { color: '#F87171' }]}>
          {t('providerConfirm.expiredTitle')}
        </Text>
        <Text style={styles.expiredSub}>
          {isUrgent
            ? t('providerConfirm.expiredUrgentSub')
            : t('providerConfirm.expiredNormalSub')
          }
        </Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(provider)')}>
          <Text style={styles.homeBtnText}>{t('providerConfirm.backToRequests')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ringColor = isUrgent
    ? '#EF4444'
    : secondsLeft <= 60 ? '#F59E0B' : '#38BDF8';
  const ringSize  = 200;
  const pct = secondsLeft / totalSecs;

  return (
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>

      {/* Header */}
      <View style={styles.header}>
        {isUrgent && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>{t('providerConfirm.urgentBadge')}</Text>
          </View>
        )}
        <Text style={styles.headerTitle}>
          {isUrgent ? t('providerConfirm.headerUrgent') : t('providerConfirm.headerNormal')}
        </Text>
        <Text style={styles.headerSub}>
          {isUrgent ? t('providerConfirm.subUrgent') : t('providerConfirm.subNormal')}
        </Text>
      </View>

      {/* Job chip */}
      <View style={[styles.jobChip, isUrgent && styles.jobChipUrgent]}>
        <View style={styles.jobChipContent}>
          <Text style={[styles.jobTitle, isUrgent && { color: '#FCA5A5' }]}>
            {job.request?.title ?? t('providerConfirm.requestFallback')}
          </Text>
          <Text style={styles.jobCity}>📍 {job.request?.city}</Text>
          <Text style={styles.jobClient}>
            {t('providerConfirm.client')}: {job.client?.full_name}
          </Text>
        </View>
        <View style={styles.jobAmount}>
          <Text style={styles.jobAmountVal}>
            {(job as any).bid?.amount ?? '—'}
          </Text>
          <Text style={styles.jobAmountCur}>
            {t('common.jod')}
          </Text>
          {isUrgent && (
            <Text style={styles.jobUrgentPremium}>
              {t('providerFeed.urgentPremium', { pct: 20 })}
            </Text>
          )}
        </View>
      </View>

      {/* Ring */}
      <Animated.View style={[
        styles.ringWrap,
        isUrgent && { transform: [{ scale: ringPulse }] },
      ]}>
        <View style={[styles.ringTrack, {
          width: ringSize, height: ringSize, borderRadius: ringSize / 2,
          borderColor: isUrgent ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.12)',
        }]} />
        <View style={[styles.ringFill, {
          width: ringSize, height: ringSize, borderRadius: ringSize / 2,
          borderColor: ringColor,
          opacity: 0.7 + pct * 0.3,
        }]} />
        <View style={styles.ringCenter}>
          <Text style={[styles.ringTime, { color: ringColor }]}>
            {fmtMSS(secondsLeft)}
          </Text>
          <Text style={styles.ringTimeSub}>
            {isUrgent ? t('providerConfirm.ringSubUrgent') : t('providerConfirm.ringSubNormal')}
          </Text>
        </View>
      </Animated.View>

      {/* Action buttons */}
      <TouchableOpacity
        style={[
          styles.confirmBtn,
          isUrgent && styles.confirmBtnUrgent,
          acting && styles.btnDisabled,
        ]}
        onPress={handleConfirm}
        disabled={acting}
        activeOpacity={0.85}
      >
        {acting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.confirmBtnText}>
              {isUrgent ? t('providerConfirm.confirmUrgentBtn') : t('providerConfirm.confirm')}
            </Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.declineBtn, acting && styles.btnDisabled]}
        onPress={handleDecline}
        disabled={acting}
      >
        <Text style={styles.declineBtnText}>{t('providerConfirm.declineBtnText')}</Text>
      </TouchableOpacity>

    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  containerUrgent:  { backgroundColor: '#0D0303' },
  center:           { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText:        { fontSize: 16, color: colors.textMuted, marginBottom: 16 },
  backBtn:          { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  backBtnText:      { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },

  header:           { alignItems: 'center', marginBottom: 20 },
  urgentBadge:      { backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  urgentBadgeText:  { fontSize: 13, fontWeight: '800', color: '#fff' },
  headerTitle:      { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 6 },
  headerSub:        { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  jobChip:          { backgroundColor: colors.surface, borderRadius: 16, padding: 16, width: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 24, gap: 12 },
  jobChipUrgent:    { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: '#1A0A0A' },
  jobChipContent:   { flex: 1 },
  jobTitle:         { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 4 },
  jobCity:          { fontSize: 12, color: colors.textMuted, textAlign: 'auto', marginBottom: 2 },
  jobClient:        { fontSize: 12, color: colors.textMuted, textAlign: 'auto' },
  jobAmount:        { alignItems: 'center' },
  jobAmountVal:     { fontSize: 24, fontWeight: '900', color: colors.accent },
  jobAmountCur:     { fontSize: 12, color: colors.textMuted },
  jobUrgentPremium: { fontSize: 10, color: '#F59E0B', fontWeight: '700', marginTop: 2 },

  ringWrap:         { alignItems: 'center', justifyContent: 'center', marginBottom: 28, width: 200, height: 200 },
  ringTrack:        { position: 'absolute', borderWidth: 10 },
  ringFill:         { position: 'absolute', borderWidth: 10 },
  ringCenter:       { alignItems: 'center' },
  ringTime:         { fontSize: 44, fontWeight: '900' },
  ringTimeSub:      { fontSize: 13, color: colors.textMuted, marginTop: 4 },

  confirmBtn:       { backgroundColor: '#0EA5E9', borderRadius: 16, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 10, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  confirmBtnUrgent: { backgroundColor: '#DC2626', shadowColor: '#DC2626' },
  confirmBtnText:   { fontSize: 17, fontWeight: '800', color: '#fff' },

  declineBtn:       { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  declineBtnText:   { fontSize: 14, color: colors.textMuted, fontWeight: '600' },

  btnDisabled:      { opacity: 0.4 },

  expiredIcon:      { fontSize: 56, marginBottom: 16 },
  expiredTitle:     { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  expiredSub:       { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  homeBtn:          { backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: colors.border, width: '100%', alignItems: 'center' },
  homeBtnText:      { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  });
}
