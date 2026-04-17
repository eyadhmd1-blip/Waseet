// ============================================================
// WASEET — Grace Period Screen
// 60-second client countdown after accepting a bid.
// Client can undo during this window. After expiry: locked.
// Realtime: auto-advances when provider commits.
// ============================================================

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Animated, Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { COLORS } from '../src/constants/theme';
import { useLanguage } from '../src/hooks/useLanguage';

const GRACE_SECONDS = 60;

export default function GracePeriodScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    job_id:        string;
    provider_name: string;
    provider_amt:  string;
    currency:      string;
    is_urgent:     string;
  }>();

  const {
    job_id,
    provider_name,
    provider_amt,
    currency = 'JOD',
    is_urgent,
  } = params;

  const isUrgent = is_urgent === '1';

  const [secondsLeft, setSecondsLeft] = useState(GRACE_SECONDS);
  const [locked, setLocked]           = useState(false);
  const [confirmed, setConfirmed]     = useState(false);
  const [undoing, setUndoing]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress  = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isUrgent) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.05, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(ringPulse, { toValue: 1,    duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, [isUrgent]);

  useEffect(() => {
    supabase
      .from('jobs')
      .select('client_grace_expires_at, provider_committed_at')
      .eq('id', job_id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.provider_committed_at) { setConfirmed(true); return; }

        const expiresAt = data.client_grace_expires_at
          ? new Date(data.client_grace_expires_at).getTime()
          : Date.now() + GRACE_SECONDS * 1000;

        const tick = () => {
          const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
          setSecondsLeft(remaining);
          const pct = 1 - remaining / GRACE_SECONDS;
          progress.setValue(pct);
          if (remaining <= 0) {
            clearInterval(intervalRef.current!);
            setLocked(true);
          }
        };

        tick();
        intervalRef.current = setInterval(tick, 1000);
      });

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [job_id]);

  useEffect(() => {
    const channel = supabase
      .channel(`grace:${job_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${job_id}`,
      }, (payload) => {
        if (payload.new?.provider_committed_at) {
          clearInterval(intervalRef.current!);
          setConfirmed(true);
        }
        if (payload.new?.provider_declined || payload.new?.status === 'cancelled') {
          clearInterval(intervalRef.current!);
          Alert.alert(
            t('gracePeriod.providerDeclinedTitle'),
            t('gracePeriod.providerDeclinedMsg'),
            [{ text: t('common.confirm'), onPress: () => router.replace('/(client)/requests') }],
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [job_id]);

  const handleUndo = useCallback(async () => {
    if (locked) {
      Alert.alert(t('gracePeriod.cantUndoTitle'), t('gracePeriod.cantUndoMsg'));
      return;
    }
    Alert.alert(
      t('gracePeriod.undoConfirmTitle'),
      t('gracePeriod.undoConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('gracePeriod.undoYes'),
          style: 'destructive',
          onPress: async () => {
            setUndoing(true);
            const { data, error } = await supabase.rpc('undo_accept_bid', { p_job_id: job_id });
            setUndoing(false);

            if (error || data?.error) {
              const msg = data?.error === 'grace_period_expired'
                ? t('gracePeriod.lockedTitle')
                : data?.error === 'provider_already_committed'
                ? t('gracePeriod.undoErrCommitted')
                : t('common.error');
              Alert.alert(t('gracePeriod.undoErrTitle'), msg);
              return;
            }

            clearInterval(intervalRef.current!);
            router.replace('/(client)/requests');
          },
        },
      ],
    );
  }, [locked, job_id, t]);

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return m > 0 ? `${m}:${sec}` : `${s}`;
  };

  const ringColor = isUrgent ? '#EF4444' : secondsLeft <= 10 ? '#EF4444' : COLORS.accent;
  const ringSize  = 180;
  const strokeW   = 10;

  if (confirmed) {
    return (
      <View style={styles.container}>
        <View style={styles.confirmedBox}>
          <Text style={styles.confirmedIcon}>✅</Text>
          <Text style={styles.confirmedTitle}>{t('gracePeriod.confirmedProviderTitle')}</Text>
          <Text style={styles.confirmedSub}>
            {t('gracePeriod.confirmedProviderMsg', { name: provider_name })}
          </Text>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.replace({ pathname: '/chat', params: { job_id } })}
          >
            <Text style={styles.chatBtnText}>💬 {t('gracePeriod.openChat')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(client)/requests')}
          >
            <Text style={styles.homeBtnText}>{t('gracePeriod.myRequests')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (locked) {
    return (
      <View style={styles.container}>
        <View style={styles.lockedBox}>
          <Text style={styles.lockedIcon}>🔒</Text>
          <Text style={styles.lockedTitle}>{t('gracePeriod.lockedBound')}</Text>
          <Text style={styles.lockedSub}>
            {isUrgent
              ? t('gracePeriod.lockedWaitingUrgent', { name: provider_name })
              : t('gracePeriod.lockedWaitingNormal', { name: provider_name })
            }
          </Text>
          <View style={styles.waitingIndicator}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={styles.waitingText}>{t('gracePeriod.waitingProvider')}</Text>
          </View>
          <Text style={styles.lockedNote}>{t('gracePeriod.lockedNote')}</Text>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/(client)/requests')}
          >
            <Text style={styles.homeBtnText}>{t('gracePeriod.goToRequests')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isUrgent ? t('gracePeriod.headerUrgent') : t('gracePeriod.headerNormal')}
        </Text>
        <Text style={styles.headerSub}>
          {isUrgent ? t('gracePeriod.subUrgent') : t('gracePeriod.subNormal')}
        </Text>
      </View>

      {/* Provider chip */}
      <View style={styles.providerChip}>
        <View style={styles.providerAvatar}>
          <Text style={styles.providerAvatarText}>
            {provider_name?.charAt(0) ?? '?'}
          </Text>
        </View>
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{provider_name}</Text>
          <Text style={styles.providerAmt}>
            {provider_amt} {t('common.jod')}
          </Text>
        </View>
        <Text style={styles.providerStatus}>{t('gracePeriod.providerStatus')}</Text>
      </View>

      {/* Ring countdown */}
      <Animated.View style={[styles.ringWrap, isUrgent && { transform: [{ scale: ringPulse }] }]}>
        <View style={[styles.ringOuter, {
          width: ringSize, height: ringSize, borderRadius: ringSize / 2,
          borderWidth: strokeW,
          borderColor: isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
        }]} />
        <View style={[styles.ringProgress, {
          width: ringSize, height: ringSize, borderRadius: ringSize / 2,
          borderWidth: strokeW,
          borderColor: ringColor,
          opacity: 1 - (secondsLeft / GRACE_SECONDS) * 0.3 + 0.7,
        }]} />
        <View style={styles.ringCenter}>
          <Text style={[styles.ringTime, { color: ringColor }]}>
            {fmtSec(secondsLeft)}
          </Text>
          <Text style={styles.ringLabel}>{t('gracePeriod.ringLabel')}</Text>
        </View>
      </Animated.View>

      {/* Actions */}
      {isUrgent ? (
        <View style={styles.urgentNote}>
          <Text style={styles.urgentNoteText}>{t('gracePeriod.urgentNote')}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.undoBtn, undoing && styles.btnDisabled]}
          onPress={handleUndo}
          disabled={undoing}
        >
          {undoing
            ? <ActivityIndicator color={COLORS.textPrimary} size="small" />
            : <Text style={styles.undoBtnText}>{t('gracePeriod.undo')}</Text>
          }
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.homeBtn}
        onPress={() => router.replace('/(client)/requests')}
      >
        <Text style={styles.homeBtnText}>{t('gracePeriod.goToRequests')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  containerUrgent:  { backgroundColor: '#0D0303' },

  header:     { alignItems: 'center', marginBottom: 28 },
  headerTitle:{ fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  headerSub:  { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  providerChip:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 28, width: '100%', borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  providerAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  providerAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.bg },
  providerInfo:       { flex: 1 },
  providerName:       { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  providerAmt:        { fontSize: 18, fontWeight: '700', color: COLORS.accent, textAlign: 'right', marginTop: 2 },
  providerStatus:     { fontSize: 11, color: COLORS.textMuted, textAlign: 'right' },

  ringWrap:     { alignItems: 'center', justifyContent: 'center', marginBottom: 32, width: 180, height: 180 },
  ringOuter:    { position: 'absolute' },
  ringProgress: { position: 'absolute' },
  ringCenter:   { alignItems: 'center' },
  ringTime:     { fontSize: 48, fontWeight: '900' },
  ringLabel:    { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },

  undoBtn:       { backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', marginBottom: 12, width: '100%', alignItems: 'center' },
  undoBtnText:   { fontSize: 16, fontWeight: '700', color: '#F87171' },
  btnDisabled:   { opacity: 0.4 },

  urgentNote:     { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 14, marginBottom: 12, width: '100%', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  urgentNoteText: { fontSize: 13, color: '#FCA5A5', textAlign: 'center' },

  homeBtn:       { backgroundColor: COLORS.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: COLORS.border, width: '100%', alignItems: 'center' },
  homeBtnText:   { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

  lockedBox:      { alignItems: 'center', width: '100%' },
  lockedIcon:     { fontSize: 56, marginBottom: 16 },
  lockedTitle:    { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10, textAlign: 'center' },
  lockedSub:      { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  waitingIndicator:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  waitingText:    { fontSize: 14, color: COLORS.textSecondary },
  lockedNote:     { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 18 },

  confirmedBox:   { alignItems: 'center', width: '100%' },
  confirmedIcon:  { fontSize: 56, marginBottom: 16 },
  confirmedTitle: { fontSize: 24, fontWeight: '800', color: '#4ADE80', marginBottom: 10, textAlign: 'center' },
  confirmedSub:   { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  chatBtn:        { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12, width: '100%', alignItems: 'center' },
  chatBtnText:    { fontSize: 16, fontWeight: '700', color: COLORS.bg },
});
