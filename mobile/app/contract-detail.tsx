// ============================================================
// WASEET — Contract Detail Screen
// Root-level screen (no tab bar)
// Shows contract info, bids (for client), visit log, actions
// ============================================================

import { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import {
  RecurringContract, ContractBid, ContractVisit,
  FREQ_VISITS_PER_MONTH,
} from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

const CONTRACT_COLOR = '#10B981';
const CONTRACT_DIM   = '#10B98122';

const VISIT_STATUS_COLOR: Record<string, string> = {
  scheduled: '#60A5FA',
  completed: CONTRACT_COLOR,
  postponed: '#FBBF24',
  missed:    '#EF4444',
};

export default function ContractDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
    const { headerPad } = useInsets();
  const router = useRouter();
  const { contract_id } = useLocalSearchParams<{ contract_id: string }>();
  const { t, ta, lang } = useLanguage();

  const [contract,   setContract]   = useState<RecurringContract | null>(null);
  const [bids,       setBids]       = useState<ContractBid[]>([]);
  const [visits,     setVisits]     = useState<ContractVisit[]>([]);
  const [myRole,     setMyRole]     = useState<'client' | 'provider' | null>(null);
  const [myId,       setMyId]       = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting,  setAccepting]  = useState<string | null>(null);

  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';

  const freqLabel = (f: string) => {
    if (f === 'weekly')   return t('recurringRequest.weekly');
    if (f === 'biweekly') return t('recurringRequest.biweekly');
    return t('recurringRequest.monthly');
  };

  const timeLabel = (key: string) => {
    if (key === 'morning')   return t('recurringRequest.morningWithTime');
    if (key === 'afternoon') return t('recurringRequest.afternoonWithTime');
    if (key === 'evening')   return t('recurringRequest.eveningWithTime');
    return t('recurringRequest.flexible');
  };

  const dayLabel = (day: number) =>
    t(`recurringRequest.day${day}` as any);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      bidding:   `🔄 ${t('contractDetail.statusBidding')}`,
      active:    `✅ ${t('contractDetail.statusActive')}`,
      paused:    `⏸️ ${t('contractDetail.statusPaused')}`,
      completed: `🏁 ${t('contractDetail.statusCompleted')}`,
      cancelled: `❌ ${t('contractDetail.statusCancelled')}`,
    };
    return map[status] ?? status;
  };

  const visitStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      scheduled: `📅 ${t('contractDetail.visitScheduled')}`,
      completed: `✅ ${t('contractDetail.visitCompleted')}`,
      postponed: `⏭️ ${t('contractDetail.visitPostponed')}`,
      missed:    `❌ ${t('contractDetail.visitMissed')}`,
    };
    return map[status] ?? status;
  };

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const authUser = _ses?.user;
      if (!authUser || !contract_id) return;
      setMyId(authUser.id);

      const [
        { data: contractData },
        { data: bidsData },
        { data: visitsData },
        { data: roleData },
      ] = await Promise.all([
        supabase
          .from('recurring_contracts')
          .select('*, client:client_id(full_name, city)')
          .eq('id', contract_id)
          .single(),
        supabase
          .from('contract_bids')
          .select('*, provider:provider_id(score, reputation_tier, badge_verified, user:users(full_name, city))')
          .eq('contract_id', contract_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contract_visits')
          .select('*')
          .eq('contract_id', contract_id)
          .order('scheduled_at', { ascending: true }),
        supabase.from('users').select('role').eq('id', authUser.id).single(),
      ]);

      if (contractData) setContract(contractData as RecurringContract);
      if (bidsData)     setBids(bidsData as ContractBid[]);
      if (visitsData)   setVisits(visitsData as ContractVisit[]);
      if (roleData)     setMyRole(roleData.role as 'client' | 'provider');

  
    } finally {
      setLoading(false);
    }
  }, [contract_id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Accept bid (client) ──────────────────────────────────────

  const handleAcceptBid = (bid: ContractBid) => {
    const provName = (bid.provider?.user as any)?.full_name ?? t('contractDetail.defaultProviderName');
    Alert.alert(
      t('contractDetail.acceptBidTitle'),
      t('contractDetail.acceptBidMsg', { name: provName, price: bid.price_per_visit, currency: bid.currency }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('contractDetail.acceptBidBtn'),
          style: 'default',
          onPress: async () => {
            setAccepting(bid.id);
            try {
              const { error } = await supabase.rpc('accept_contract_bid', {
                p_bid_id:    bid.id,
                p_client_id: myId,
              });
              if (error) throw error;
              await load();
              Alert.alert(t('contractDetail.acceptBidSuccess'), t('contractDetail.acceptBidSuccessMsg'));
            } catch {
              Alert.alert(t('common.error'), t('contractDetail.acceptBidErr'));
            } finally {
              setAccepting(null);
            }
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={CONTRACT_COLOR} size="large" />
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>{t('contractDetail.notFound')}</Text>
      </View>
    );
  }

  const totalVisits = FREQ_VISITS_PER_MONTH[contract.frequency] * contract.duration_months;
  const progressPct = totalVisits > 0 ? (contract.completed_visits / totalVisits) * 100 : 0;
  const pendingBids = bids.filter(b => b.status === 'pending');
  const acceptedBid = bids.find(b => b.status === 'accepted');

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('contractDetail.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CONTRACT_COLOR} />}
      >
        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Text style={styles.heroIcon}>🔄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { textAlign: ta }]}>{contract.title}</Text>
              <Text style={[styles.heroCity, { textAlign: ta }]}>📍 {contract.city}</Text>
            </View>
            <View style={[styles.statusBadge, contract.status === 'active' && styles.statusBadgeActive]}>
              <Text style={styles.statusText}>{statusLabel(contract.status)}</Text>
            </View>
          </View>

          {/* Info chips */}
          <View style={[styles.chipRow, { justifyContent: ta === 'right' ? 'flex-end' : 'flex-start' }]}>
            <InfoChip label={freqLabel(contract.frequency)} icon="🔄" />
            <InfoChip label={t('contractDetail.chipMonths', { count: contract.duration_months })} icon="📅" />
            <InfoChip label={t('contractDetail.chipVisits', { count: totalVisits })} icon="📋" />
          </View>

          {/* Progress bar (if active) */}
          {contract.status === 'active' && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
              <Text style={[styles.progressText, { textAlign: ta }]}>
                {t('contractDetail.progressText', { completed: contract.completed_visits, total: totalVisits })}
              </Text>
            </View>
          )}

          {/* Price (if active) */}
          {contract.price_per_visit && (
            <View style={styles.priceBox}>
              <Text style={styles.priceValue}>{contract.price_per_visit} {contract.currency}</Text>
              <Text style={styles.priceLabel}>{t('contractDetail.pricePerVisit')}</Text>
              <Text style={styles.priceSep}>·</Text>
              <Text style={styles.priceValue}>{(contract.price_per_visit * totalVisits).toFixed(0)} {contract.currency}</Text>
              <Text style={styles.priceLabel}>{t('contractDetail.totalContract')}</Text>
            </View>
          )}
        </View>

        {/* ── Details ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('contractDetail.sectionDetails')}</Text>
          <View style={styles.detailCard}>
            {contract.description && (
              <View style={styles.descBlock}>
                <Text style={[styles.descText, { textAlign: ta }]}>{contract.description}</Text>
              </View>
            )}
            <DetailRow
              label={t('contractDetail.visitTime')}
              value={contract.preferred_time_window ? timeLabel(contract.preferred_time_window) : t('recurringRequest.flexible')}
              ta={ta}
            />
            {contract.preferred_day != null && (
              <DetailRow label={t('contractDetail.preferredDay')} value={dayLabel(contract.preferred_day)} ta={ta} />
            )}
            {contract.notes && (
              <DetailRow label={t('contractDetail.notes')} value={contract.notes} ta={ta} />
            )}
            <DetailRow
              label={t('contractDetail.createdAt')}
              value={new Date(contract.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              ta={ta}
            />
            {contract.starts_at && (
              <DetailRow
                label={t('contractDetail.startsAt')}
                value={new Date(contract.starts_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                ta={ta}
              />
            )}
            {contract.ends_at && (
              <DetailRow
                label={t('contractDetail.endsAt')}
                value={new Date(contract.ends_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                ta={ta}
              />
            )}
          </View>
        </View>

        {/* ── Bids (client sees, if bidding status) ── */}
        {myRole === 'client' && contract.status === 'bidding' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>
              {t('contractDetail.sectionBids')}
              {pendingBids.length > 0 && (
                <Text style={styles.bidCount}> ({pendingBids.length})</Text>
              )}
            </Text>
            {pendingBids.length === 0 ? (
              <View style={styles.emptyBids}>
                <Text style={styles.emptyBidsText}>{t('contractDetail.noBids')}</Text>
                <Text style={styles.emptyBidsSub}>{t('contractDetail.noBidsSub')}</Text>
              </View>
            ) : (
              pendingBids.map(bid => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  totalVisits={totalVisits}
                  onAccept={() => handleAcceptBid(bid)}
                  accepting={accepting === bid.id}
                />
              ))
            )}
          </View>
        )}

        {/* ── Accepted bid summary ── */}
        {acceptedBid && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('contractDetail.sectionProvider')}</Text>
            <View style={styles.acceptedCard}>
              <View style={styles.acceptedAvatar}>
                <Text style={styles.acceptedAvatarText}>
                  {(acceptedBid.provider?.user as any)?.full_name?.charAt(0) ?? '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.acceptedName, { textAlign: ta }]}>
                  {(acceptedBid.provider?.user as any)?.full_name ?? t('contractDetail.defaultProviderName')}
                </Text>
                <Text style={[styles.acceptedPrice, { textAlign: ta }]}>
                  {acceptedBid.price_per_visit} {acceptedBid.currency} / {t('contractDetail.pricePerVisit')}
                </Text>
              </View>
              {acceptedBid.provider?.badge_verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>{t('providerProfile.verified')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Visit timeline ── */}
        {visits.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('contractDetail.sectionVisits')}</Text>
            <View style={styles.timeline}>
              {visits.map((visit, idx) => (
                <VisitRow
                  key={visit.id}
                  visit={visit}
                  isLast={idx === visits.length - 1}
                  statusLabel={visitStatusLabel(visit.status)}
                  locale={locale}
                  ta={ta}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function InfoChip({ label, icon }: { label: string; icon: string }) {
  const { colors } = useTheme();
  const chip = useMemo(() => createChip(colors), [colors]);
  return (
    <View style={chip.wrap}>
      <Text style={chip.icon}>{icon}</Text>
      <Text style={chip.text}>{label}</Text>
    </View>
  );
}
function createChip(colors: AppColors) {
  return StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border, gap: 4 },
  icon: { fontSize: 12 },
  text: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  });
}

function DetailRow({ label, value, ta }: { label: string; value: string; ta: 'left' | 'right' }) {
  const { colors } = useTheme();
  const dr = useMemo(() => createDr(colors), [colors]);
  return (
    <View style={[dr.row, {}]}>
      <Text style={[dr.label, { textAlign: ta }]}>{label}</Text>
      <Text style={[dr.value, { textAlign: ta }]}>{value}</Text>
    </View>
  );
}
function createDr(colors: AppColors) {
  return StyleSheet.create({
  row:   { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 1, marginHorizontal: 8 },
  });
}

function BidCard({
  bid, totalVisits, onAccept, accepting,
}: {
  bid: ContractBid;
  totalVisits: number;
  onAccept: () => void;
  accepting: boolean;
}) {
  const { colors } = useTheme();
  const bc = useMemo(() => createBc(colors), [colors]);
  const { t, ta } = useLanguage();
  const provName = (bid.provider?.user as any)?.full_name ?? t('contractDetail.defaultProviderName');
  const total    = (bid.price_per_visit * totalVisits).toFixed(0);
  const score    = bid.provider?.score ?? 0;
  const verified = bid.provider?.badge_verified ?? false;

  return (
    <View style={bc.card}>
      <View style={bc.top}>
        <View style={bc.avatar}>
          <Text style={bc.avatarText}>{provName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[bc.nameRow, {}]}>
            <Text style={bc.name}>{provName}</Text>
            {verified && <Text style={bc.verified}>✓</Text>}
          </View>
          {score > 0 && <Text style={[bc.score, { textAlign: ta }]}>⭐ {score.toFixed(1)}</Text>}
        </View>
        <View style={bc.priceWrap}>
          <Text style={bc.price}>{bid.price_per_visit}</Text>
          <Text style={bc.priceSub}>{bid.currency}/{t('contractDetail.pricePerVisit')}</Text>
        </View>
      </View>
      {bid.note && <Text style={[bc.note, { textAlign: ta }]}>{bid.note}</Text>}
      <View style={[bc.bottom, {}]}>
        <Text style={bc.total}>{t('contractDetail.bidTotal', { total, currency: bid.currency })}</Text>
        <TouchableOpacity style={bc.acceptBtn} onPress={onAccept} disabled={accepting}>
          {accepting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={bc.acceptBtnText}>{t('contractDetail.bidAcceptBtn')}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}
function createBc(colors: AppColors) {
  return StyleSheet.create({
  card:          { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  top:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: CONTRACT_DIM, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontSize: 18, fontWeight: '700', color: CONTRACT_COLOR },
  nameRow:       { alignItems: 'center', gap: 6, marginBottom: 2 },
  name:          { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  verified:      { fontSize: 12, color: '#7DD3FC', backgroundColor: '#0C4A6E', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  score:         { fontSize: 12, color: colors.textMuted },
  priceWrap:     { alignItems: 'flex-end' },
  price:         { fontSize: 20, fontWeight: '800', color: CONTRACT_COLOR },
  priceSub:      { fontSize: 10, color: colors.textMuted },
  note:          { fontSize: 13, color: colors.textSecondary, marginBottom: 10, lineHeight: 20 },
  bottom:        { alignItems: 'center', justifyContent: 'space-between' },
  total:         { fontSize: 12, color: colors.textMuted },
  acceptBtn:     { backgroundColor: CONTRACT_COLOR, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });
}

function VisitRow({
  visit, isLast, statusLabel, locale, ta,
}: {
  visit: ContractVisit;
  isLast: boolean;
  statusLabel: string;
  locale: string;
  ta: 'left' | 'right';
}) {
  const { colors } = useTheme();
  const vr = useMemo(() => createVr(colors), [colors]);
  const { t } = useLanguage();
  const color = VISIT_STATUS_COLOR[visit.status];
  const date  = new Date(visit.scheduled_at).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  return (
    <View style={vr.row}>
      <View style={vr.timelineLeft}>
        <View style={[vr.dot, { backgroundColor: color }]} />
        {!isLast && <View style={vr.line} />}
      </View>
      <View style={vr.content}>
        <View style={[vr.top, {}]}>
          <Text style={[vr.status, { color }]}>{statusLabel}</Text>
          <Text style={vr.date}>{date}</Text>
        </View>
        {visit.client_rating && (
          <Text style={[vr.rating, { textAlign: ta }]}>{'⭐'.repeat(visit.client_rating)} {visit.client_note ?? ''}</Text>
        )}
        {visit.postponed_to && (
          <Text style={[vr.postponed, { textAlign: ta }]}>
            {t('contractDetail.postponedTo', { date: new Date(visit.postponed_to).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}
          </Text>
        )}
      </View>
    </View>
  );
}
function createVr(colors: AppColors) {
  return StyleSheet.create({
  row:          { flexDirection: 'row', gap: 12, marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 20 },
  dot:          { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  line:         { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
  content:      { flex: 1, paddingBottom: 16 },
  top:          { justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  status:       { fontSize: 13, fontWeight: '600' },
  date:         { fontSize: 12, color: colors.textMuted },
  rating:       { fontSize: 13, color: colors.textMuted },
  postponed:    { fontSize: 12, color: '#FBBF24', marginTop: 2 },
  });
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: HEADER_PAD, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  backIcon:    { fontSize: 18, color: colors.textSecondary },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  heroCard:     { marginHorizontal: 16, marginBottom: 16, backgroundColor: CONTRACT_DIM, borderRadius: 20, padding: 16, borderWidth: 2, borderColor: CONTRACT_COLOR },
  heroTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  heroIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: CONTRACT_COLOR, alignItems: 'center', justifyContent: 'center' },
  heroIcon:     { fontSize: 22 },
  heroTitle:    { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  heroCity:     { fontSize: 13, color: colors.textMuted },

  statusBadge:       { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  statusBadgeActive: { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM },
  statusText:        { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  chipRow:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },

  progressWrap: { marginTop: 4, marginBottom: 4 },
  progressBg:   { height: 6, backgroundColor: colors.bg, borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: CONTRACT_COLOR, borderRadius: 3 },
  progressText: { fontSize: 12, color: colors.textMuted },

  priceBox:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
  priceValue: { fontSize: 18, fontWeight: '800', color: CONTRACT_COLOR },
  priceLabel: { fontSize: 11, color: colors.textMuted },
  priceSep:   { fontSize: 18, color: colors.border },

  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  bidCount:     { color: CONTRACT_COLOR },

  detailCard:  { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  descBlock:   { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  descText:    { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },

  emptyBids:     { backgroundColor: colors.surface, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyBidsText: { fontSize: 16, color: colors.textMuted, marginBottom: 6 },
  emptyBidsSub:  { fontSize: 13, color: colors.textMuted },

  acceptedCard:        { backgroundColor: colors.surface, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: CONTRACT_COLOR },
  acceptedAvatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: CONTRACT_DIM, alignItems: 'center', justifyContent: 'center' },
  acceptedAvatarText:  { fontSize: 20, fontWeight: '700', color: CONTRACT_COLOR },
  acceptedName:        { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  acceptedPrice:       { fontSize: 13, color: CONTRACT_COLOR, fontWeight: '600' },
  verifiedBadge:       { backgroundColor: '#0C4A6E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedBadgeText:   { fontSize: 12, color: '#7DD3FC', fontWeight: '600' },

  timeline: { paddingLeft: 4 },
  });
}
