import { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { TIER_META } from '../src/constants/categories';
import { useLanguage } from '../src/hooks/useLanguage';
import type { ServiceRequest, Bid, RequestStatus } from '../src/types';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

// ─── Types ────────────────────────────────────────────────────

type BidWithProvider = Bid & {
  provider: {
    id: string;
    score: number;
    reputation_tier: string;
    badge_verified: boolean;
    lifetime_jobs: number;
    is_available: boolean;
    user: { full_name: string; city: string };
  };
};

type RequestWithMeta = ServiceRequest & {
  category?: { name_ar: string; name_en?: string; icon: string };
};

// ─── Constants ────────────────────────────────────────────────

const STATUS_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  open:        { bg: '#0C4A6E', text: '#7DD3FC' },
  in_progress: { bg: '#78350F', text: '#FCD34D' },
  completed:   { bg: '#14532D', text: '#86EFAC' },
  cancelled:   { bg: '#3B0764', text: '#C4B5FD' },
};

const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚', moon: '🌙', 'pen-tool': '✏️',
};

// ─── Component ────────────────────────────────────────────────

export default function RequestDetail() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { headerPad } = useInsets();
  const router  = useRouter();
  const { t, ta, lang } = useLanguage();
  const locale  = lang === 'ar' ? 'ar-JO' : 'en-GB';
  const { id }  = useLocalSearchParams<{ id: string }>();

  const [myId, setMyId]             = useState<string | null>(null);
  const [request, setRequest]       = useState<RequestWithMeta | null>(null);
  const [bids, setBids]             = useState<BidWithProvider[]>([]);
  const [loading, setLoading]       = useState(true);
  const [accepting, setAccepting]   = useState<string | null>(null);
  const [confirmBid, setConfirmBid] = useState<BidWithProvider | null>(null);
  const [reportTarget, setReportTarget] = useState<BidWithProvider | null>(null);
  const [reportType, setReportType] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (user) setMyId(user.id);

    const [{ data: reqData }, { data: bidsData }] = await Promise.all([
      supabase
        .from('requests')
        .select('*, category:service_categories(name_ar, name_en, icon)')
        .eq('id', id)
        .single(),
      supabase
        .from('bids')
        .select(`
          *,
          provider:providers(
            id, score, reputation_tier, badge_verified, lifetime_jobs, is_available,
            user:users(full_name, city)
          )
        `)
        .eq('request_id', id)
        .order('amount', { ascending: true })
        .limit(20),
    ]);

    if (reqData)  setRequest(reqData);
    if (bidsData) setBids((bidsData as BidWithProvider[]).filter(b => b.provider?.is_available !== false));
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Accept bid ──────────────────────────────────────────────

  const handleAccept = async (bid: BidWithProvider) => {
    setAccepting(bid.id);
    setConfirmBid(null);

    const { data, error } = await supabase.rpc('accept_bid', { p_bid_id: bid.id });

    if (error || data?.error) {
      setAccepting(null);
      const msg = data?.error ?? error?.message ?? t('requests.errGeneric');
      const readable =
        msg === 'bid_not_found_or_not_pending'       ? t('requests.errBidNotFound') :
        msg === 'not_authorized_or_request_closed'   ? t('requests.errRequestClosed') :
        msg;
      Alert.alert(t('common.error'), readable);
      return;
    }

    const jobId: string = data.job_id;
    const isUrgent: boolean = !!(request as any)?.is_urgent;

    await supabase.rpc('set_job_deadlines', {
      p_job_id: jobId,
      p_is_urgent: isUrgent,
    });

    supabase.functions.invoke('notify-provider-bid-accepted', {
      body: { job_id: jobId, is_urgent: isUrgent },
    }).catch(() => {});

    setAccepting(null);

    router.push({
      pathname: '/grace-period',
      params: {
        job_id:        jobId,
        provider_name: bid.provider.user.full_name,
        provider_amt:  String(bid.amount),
        currency:      bid.currency,
        is_urgent:     isUrgent ? '1' : '0',
      },
    });
  };

  // ── Submit report ────────────────────────────────────────────

  const submitReport = async () => {
    if (!reportType || !reportTarget) return;
    setSubmittingReport(true);
    const { data, error } = await supabase.rpc('submit_report', {
      p_reported_user_id: reportTarget.provider.id,
      p_report_type:      reportType,
      p_request_id:       id,
    });
    setSubmittingReport(false);

    if (error || data?.error) {
      Alert.alert(t('common.error'), data?.error === 'ALREADY_REPORTED'
        ? t('report.alreadyReported')
        : t('report.submitFailed'));
      return;
    }
    setReportTarget(null);
    setReportType('');
    Alert.alert(t('report.successTitle'), t('report.successMsg'));
  };

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('requests.notFound')}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor  = STATUS_COLORS[request.status];
  const visibleBids  = bids.filter(b => b.status === 'pending' || b.status === 'accepted');
  const catName      = lang === 'ar'
    ? (request.category?.name_ar ?? request.category_slug)
    : (request.category?.name_en ?? request.category?.name_ar ?? request.category_slug);

  return (
    <View style={styles.container}>
      {/* ── Report modal ── */}
      <Modal
        visible={!!reportTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setReportTarget(null)}
      >
        <View style={styles.reportOverlay}>
          <View style={styles.reportSheet}>
            <Text style={styles.reportTitle}>{t('report.title')}</Text>
            <Text style={styles.reportSubtitle}>
              {reportTarget?.provider.user.full_name ?? ''}
            </Text>
            {(['no_show', 'fake_bid', 'abusive', 'spam', 'other'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.reportOption, reportType === type && styles.reportOptionSelected]}
                onPress={() => setReportType(type)}
              >
                <View style={[styles.reportRadio, reportType === type && styles.reportRadioSelected]} />
                <Text style={[styles.reportOptionText, reportType === type && styles.reportOptionTextSelected]}>
                  {t(`report.type_${type}`)}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.reportBtns}>
              <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setReportTarget(null)}>
                <Text style={styles.reportCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSubmitBtn, (!reportType || submittingReport) && styles.reportSubmitDisabled]}
                onPress={submitReport}
                disabled={!reportType || submittingReport}
              >
                <Text style={styles.reportSubmitText}>
                  {submittingReport ? t('common.loading') : t('report.submit')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBackBtn} onPress={() => router.back()}>
          <Text style={styles.topBackText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('requests.detailTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Request card ── */}
        <View style={styles.requestCard}>
          <View style={styles.cardTopRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {t(`requests.status${request.status.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` as any)}
              </Text>
            </View>
            <Text style={styles.categoryText}>
              {ICON_MAP[request.category?.icon ?? ''] ?? '🔧'} {catName}
            </Text>
          </View>

          <Text style={[styles.requestTitle, { textAlign: ta }]}>{request.title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>📍 {request.city}</Text>
            <Text style={styles.metaText}>
              {new Date(request.created_at).toLocaleDateString(locale, {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={[styles.descLabel, { textAlign: ta }]}>{t('requests.descLabel')}</Text>
          <Text style={[styles.descText, { textAlign: ta }]}>{request.description}</Text>

          {request.ai_suggested_price_min && request.ai_suggested_price_max && (
            <View style={styles.aiPriceBox}>
              <Text style={styles.aiPriceLabel}>{t('requests.aiPriceLabel')}</Text>
              <Text style={styles.aiPriceValue}>
                {t('requests.aiPriceValue', { min: request.ai_suggested_price_min, max: request.ai_suggested_price_max })}
              </Text>
            </View>
          )}
        </View>

        {/* ── Bids section ── */}
        {request.status === 'open' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>
              {t('requests.bidsSection', { count: visibleBids.length })}
            </Text>

            {visibleBids.length === 0 ? (
              <View style={styles.noBids}>
                <Text style={styles.noBidsIcon}>⏳</Text>
                <Text style={styles.noBidsText}>{t('requests.noBids')}</Text>
                <Text style={styles.noBidsSub}>{t('requests.noBidsSub')}</Text>
              </View>
            ) : (
              visibleBids.map(bid => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  onAccept={() => setConfirmBid(bid)}
                  onReport={() => { setReportTarget(bid); setReportType(''); }}
                />
              ))
            )}
          </View>
        )}

        {/* ── In-progress state ── */}
        {request.status === 'in_progress' && (() => {
          const acceptedBid = bids.find(b => b.status === 'accepted');
          if (!acceptedBid) return null;
          const tier = TIER_META[acceptedBid.provider.reputation_tier as keyof typeof TIER_META];
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('requests.chosenProvider')}</Text>
              <View style={styles.acceptedCard}>
                <View style={styles.providerAvatarLg}>
                  <Text style={styles.providerAvatarTextLg}>
                    {acceptedBid.provider.user.full_name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.acceptedInfo}>
                  <Text style={[styles.acceptedName, { textAlign: ta }]}>{acceptedBid.provider.user.full_name}</Text>
                  <View style={[styles.tierPill, { backgroundColor: tier.color + '22' }]}>
                    <Text style={[styles.tierPillText, { color: tier.color }]}>
                      {t(`dashboard.tier${acceptedBid.provider.reputation_tier.charAt(0).toUpperCase() + acceptedBid.provider.reputation_tier.slice(1)}` as any)}
                    </Text>
                  </View>
                  {acceptedBid.provider.badge_verified && (
                    <Text style={styles.verifiedText}>{t('providerProfile.verified')}</Text>
                  )}
                </View>
                <View style={styles.acceptedAmount}>
                  <Text style={styles.acceptedAmountValue}>{acceptedBid.amount}</Text>
                  <Text style={styles.acceptedAmountCur}>{t('requests.jod')}</Text>
                </View>
              </View>

              <View style={styles.shareProviderRow}>
                <TouchableOpacity
                  style={styles.shareProviderBtn}
                  onPress={() => router.push({
                    pathname: '/provider-profile',
                    params: { provider_id: acceptedBid.provider.id },
                  })}
                >
                  <Text style={styles.shareProviderBtnText}>{t('requests.viewProfile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareProviderBtn, styles.shareProviderBtnAccent]}
                  onPress={async () => {
                    const { data: prov } = await supabase
                      .from('providers')
                      .select('username')
                      .eq('id', acceptedBid.provider.id)
                      .single();
                    const name = acceptedBid.provider.user.full_name;
                    const link = `https://waseet.app/p/${prov?.username ?? acceptedBid.provider.id}`;
                    Share.share({ message: t('chat.recommendMsg', { name, link }), url: link });
                  }}
                >
                  <Text style={styles.shareProviderBtnTextAccent}>{t('requests.shareProvider')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inProgressNote}>
                <Text style={[styles.inProgressNoteText, { textAlign: ta }]}>
                  {t('requests.inProgressNote')}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* ── Completed / Cancelled ── */}
        {(request.status === 'completed' || request.status === 'cancelled') && (
          <View style={styles.closedBox}>
            <Text style={styles.closedIcon}>
              {request.status === 'completed' ? '✅' : '❌'}
            </Text>
            <Text style={styles.closedText}>
              {request.status === 'completed' ? t('requests.completedMsg') : t('requests.cancelledMsg')}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* ── Confirm Accept Modal ── */}
      <Modal visible={!!confirmBid} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { textAlign: ta }]}>{t('requests.confirmTitle')}</Text>

            {confirmBid && (
              <>
                <Text style={[styles.modalProvider, { textAlign: ta }]}>
                  {t('requests.confirmProvider', { name: confirmBid.provider.user.full_name })}
                </Text>
                <View style={styles.modalAmountRow}>
                  <Text style={styles.modalAmountLabel}>{t('requests.confirmedAmount')}</Text>
                  <Text style={styles.modalAmountValue}>
                    {confirmBid.amount} {confirmBid.currency === 'JOD' ? t('requests.jod') : confirmBid.currency}
                  </Text>
                </View>
                {confirmBid.note ? (
                  <View style={styles.modalNoteBox}>
                    <Text style={[styles.modalNoteLabel, { textAlign: ta }]}>{t('requests.providerNote')}</Text>
                    <Text style={[styles.modalNoteText, { textAlign: ta }]}>{confirmBid.note}</Text>
                  </View>
                ) : null}
                <Text style={[styles.modalWarning, { textAlign: ta }]}>
                  {(request as any)?.is_urgent ? t('requests.urgentWarning') : t('requests.normalWarning')}
                </Text>
              </>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirmBid(null)}
                disabled={!!accepting}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !!accepting && styles.btnDisabled]}
                onPress={() => confirmBid && handleAccept(confirmBid)}
                disabled={!!accepting}
              >
                {accepting
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.modalConfirmText}>{t('requests.confirmAccept')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Bid Card ─────────────────────────────────────────────────

function BidCard({
  bid,
  onAccept,
  onReport,
}: {
  bid: BidWithProvider;
  onAccept: () => void;
  onReport: () => void;
}) {
  const { colors } = useTheme();
  const bidStyles = useMemo(() => createBidStyles(colors), [colors]);
  const { t, ta } = useLanguage();
  const tier = TIER_META[bid.provider.reputation_tier as keyof typeof TIER_META];

  return (
    <View style={bidStyles.card}>
      <View style={bidStyles.providerRow}>
        <View style={bidStyles.avatar}>
          <Text style={bidStyles.avatarText}>
            {bid.provider.user.full_name.charAt(0)}
          </Text>
        </View>
        <View style={bidStyles.providerInfo}>
          <View style={bidStyles.nameRow}>
            <Text style={bidStyles.providerName}>{bid.provider.user.full_name}</Text>
            {bid.provider.badge_verified && (
              <Text style={bidStyles.verified}>✓</Text>
            )}
          </View>
          <View style={bidStyles.metaRow}>
            <View style={[bidStyles.tierBadge, { backgroundColor: tier.color + '22' }]}>
              <Text style={[bidStyles.tierText, { color: tier.color }]}>
                {t(`dashboard.tier${bid.provider.reputation_tier.charAt(0).toUpperCase() + bid.provider.reputation_tier.slice(1)}` as any)}
              </Text>
            </View>
            {bid.provider.score > 0 && (
              <Text style={bidStyles.score}>⭐ {bid.provider.score.toFixed(1)}</Text>
            )}
            <Text style={bidStyles.jobs}>{t('chat.jobsCount', { count: bid.provider.lifetime_jobs })}</Text>
          </View>
        </View>
        <View style={bidStyles.amountBox}>
          <Text style={bidStyles.amountValue}>{bid.amount}</Text>
          <Text style={bidStyles.amountCur}>{t('requests.jod')}</Text>
        </View>
      </View>

      {bid.note ? (
        <Text style={[bidStyles.note, { textAlign: ta }]} numberOfLines={3}>{bid.note}</Text>
      ) : null}

      <View style={bidStyles.actionRow}>
        <TouchableOpacity style={bidStyles.reportBtn} onPress={onReport}>
          <Text style={bidStyles.reportBtnText}>🚩 {t('report.reportBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={bidStyles.acceptBtn} onPress={onAccept} activeOpacity={0.8}>
          <Text style={bidStyles.acceptBtnText}>{t('requests.bidAccept')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: colors.textMuted, marginBottom: 20 },
  backBtn:   { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  backBtnText:{ fontSize: 15, fontWeight: '700', color: colors.bg },

  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  topBackBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBackText: { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
  topTitle:    { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  content: { padding: 16, paddingBottom: 48 },

  requestCard:  { backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  cardTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge:  { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:   { fontSize: 12, fontWeight: '700' },
  categoryText: { fontSize: 13, color: colors.textMuted },

  requestTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, lineHeight: 28 },

  metaRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  metaText:  { fontSize: 12, color: colors.textMuted },

  divider:   { height: 1, backgroundColor: colors.border, marginBottom: 14 },

  descLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  descText:  { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  aiPriceBox:   { marginTop: 16, backgroundColor: colors.accentDim, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)', alignItems: 'center' },
  aiPriceLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  aiPriceValue: { fontSize: 22, fontWeight: '700', color: colors.accent },

  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },

  noBids:     { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  noBidsIcon: { fontSize: 40, marginBottom: 10 },
  noBidsText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  noBidsSub:  { fontSize: 13, color: colors.textMuted },

  acceptedCard:      { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#15803D', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  providerAvatarLg:  { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  providerAvatarTextLg: { fontSize: 22, fontWeight: '700', color: colors.bg },
  acceptedInfo:      { flex: 1, gap: 4 },
  acceptedName:      { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  tierPill:          { alignSelf: 'flex-end', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tierPillText:      { fontSize: 11, fontWeight: '700' },
  verifiedText:      { fontSize: 12, color: '#7DD3FC' },
  acceptedAmount:    { alignItems: 'center' },
  acceptedAmountValue:{ fontSize: 22, fontWeight: '700', color: colors.accent },
  acceptedAmountCur: { fontSize: 12, color: colors.textMuted },

  shareProviderRow:        { flexDirection: 'row', gap: 8, marginBottom: 10 },
  shareProviderBtn:        { flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  shareProviderBtnAccent:  { backgroundColor: colors.accentDim, borderColor: 'rgba(201,168,76,0.30)' },
  shareProviderBtnText:    { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  shareProviderBtnTextAccent: { fontSize: 12, color: colors.accent, fontWeight: '700' },

  inProgressNote:     { backgroundColor: '#1C1A0E', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)' },
  inProgressNoteText: { fontSize: 13, color: '#FCD34D', lineHeight: 20 },

  closedBox:  { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  closedIcon: { fontSize: 40, marginBottom: 10 },
  closedText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#0E1E4A', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: 'rgba(201,168,76,0.25)', padding: 24, paddingBottom: 48 },
  modalTitle:   { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 20 },
  modalProvider:{ fontSize: 15, color: colors.textSecondary, marginBottom: 16 },
  modalAmountRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, padding: 16, marginBottom: 12 },
  modalAmountLabel:{ fontSize: 13, color: colors.textMuted },
  modalAmountValue:{ fontSize: 20, fontWeight: '700', color: colors.accent },
  modalNoteBox: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  modalNoteLabel:{ fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  modalNoteText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  modalWarning: { fontSize: 12, color: '#F87171', lineHeight: 18, marginBottom: 20 },
  modalBtns:    { flexDirection: 'row', gap: 12 },
  modalCancel:  { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText:{ fontSize: 15, color: colors.textSecondary },
  modalConfirm: { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalConfirmText:{ fontSize: 15, fontWeight: '700', color: colors.bg },
  btnDisabled:  { backgroundColor: colors.border },

  // ── Report modal ──
  reportOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  reportSheet:         { backgroundColor: '#0E1E4A', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: 'rgba(201,168,76,0.25)', padding: 24, paddingBottom: 40 },
  reportTitle:         { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'auto', marginBottom: 4 },
  reportSubtitle:      { fontSize: 13, color: colors.textMuted, textAlign: 'auto', marginBottom: 16 },
  reportOption:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  reportOptionSelected:{ backgroundColor: 'rgba(201,168,76,0.05)', borderRadius: 8 },
  reportRadio:         { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  reportRadioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  reportOptionText:    { flex: 1, fontSize: 14, color: colors.textSecondary, textAlign: 'auto' },
  reportOptionTextSelected: { color: colors.textPrimary, fontWeight: '600' },
  reportBtns:          { flexDirection: 'row', gap: 12, marginTop: 24 },
  reportCancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  reportCancelText:    { fontSize: 14, color: colors.textMuted },
  reportSubmitBtn:     { flex: 1, backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  reportSubmitDisabled:{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  reportSubmitText:    { fontSize: 14, fontWeight: '700', color: '#FFF' },
  });
}

function createBidStyles(colors: AppColors) {
  return StyleSheet.create({
  card:        { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 18, fontWeight: '700', color: colors.bg },
  providerInfo:{ flex: 1 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 },
  providerName:{ fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  verified:    { fontSize: 12, color: '#7DD3FC', fontWeight: '700' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  tierBadge:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  tierText:    { fontSize: 10, fontWeight: '700' },
  score:       { fontSize: 12, color: colors.textSecondary },
  jobs:        { fontSize: 12, color: colors.textMuted },
  amountBox:   { alignItems: 'center', minWidth: 60 },
  amountValue: { fontSize: 20, fontWeight: '700', color: colors.accent },
  amountCur:   { fontSize: 11, color: colors.textMuted },
  note:        { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 12, paddingHorizontal: 4 },
  actionRow:    { flexDirection: 'row', gap: 8 },
  reportBtn:    { flex: 0, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#7F1D1D', alignItems: 'center', justifyContent: 'center' },
  reportBtnText:{ fontSize: 12, color: '#FCA5A5' },
  acceptBtn:    { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  acceptBtnText:{ fontSize: 14, fontWeight: '700', color: colors.bg },
  });
}
