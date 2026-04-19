import { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { TIER_META } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { Provider, User } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

// ─── Types ────────────────────────────────────────────────────

type AnalyticsRow = {
  date:          string;
  views:         number;
  bids_placed:   number;
  bids_won:      number;
  jobs_done:     number;
  earnings_est:  number;
};

type RecentJob = {
  id:             string;
  confirmed_at:   string;
  client_rating:  number | null;
  client_review:  string | null;
  request:        { title: string };
};

type Period = '7' | '30';

// ─── Helpers ──────────────────────────────────────────────────

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function sum(rows: AnalyticsRow[], key: keyof AnalyticsRow): number {
  return rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Component ────────────────────────────────────────────────

export default function ProviderDashboard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
    const { headerPad } = useInsets();
  const { t, ta, lang } = useLanguage();
  const [provider, setProvider]   = useState<(Provider & { user: User }) | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
  const [weekRows, setWeekRows]   = useState<AnalyticsRow[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [period, setPeriod]       = useState<Period>('30');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const cutoff7  = daysAgoISO(7);
    const cutoff30 = daysAgoISO(30);

    const [
      { data: providerData },
      { data: analytics30 },
      { data: analytics7 },
      { data: jobs },
    ] = await Promise.all([
      supabase
        .from('providers')
        .select('*, user:users(*)')
        .eq('id', authUser.id)
        .single(),
      supabase
        .from('provider_analytics')
        .select('date, views, bids_placed, bids_won, jobs_done, earnings_est')
        .eq('provider_id', authUser.id)
        .gte('date', cutoff30)
        .order('date', { ascending: true }),
      supabase
        .from('provider_analytics')
        .select('date, views, bids_placed, bids_won, jobs_done, earnings_est')
        .eq('provider_id', authUser.id)
        .gte('date', cutoff7)
        .order('date', { ascending: true }),
      supabase
        .from('jobs')
        .select('id, confirmed_at, client_rating, client_review, request:requests(title)')
        .eq('provider_id', authUser.id)
        .eq('status', 'completed')
        .order('confirmed_at', { ascending: false })
        .limit(5),
    ]);

    if (providerData) setProvider(providerData as Provider & { user: User });
    if (analytics30)  setAnalytics(analytics30 as AnalyticsRow[]);
    if (analytics7)   setWeekRows(analytics7   as AnalyticsRow[]);
    if (jobs)         setRecentJobs(jobs        as unknown as RecentJob[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Derived stats ────────────────────────────────────────────

  const periodRows = period === '7' ? weekRows : analytics;

  const totalJobs      = sum(periodRows, 'jobs_done');
  const totalEarnings  = sum(periodRows, 'earnings_est');
  const totalBids      = sum(periodRows, 'bids_placed');
  const totalWon       = sum(periodRows, 'bids_won');
  const winRate        = totalBids > 0 ? Math.round((totalWon / totalBids) * 100) : 0;
  const totalViews     = sum(periodRows, 'views');

  // ── Bar chart data (last 7 days, always) ────────────────────

  const chartData = buildChartDays(weekRows, lang);
  const chartMax  = Math.max(...chartData.map(d => d.jobs), 1);

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!provider) return null;

  const tier = TIER_META[provider.reputation_tier];
  const locale = lang === 'ar' ? 'ar-JO' : 'en-GB';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { textAlign: ta }]}>{t('dashboard.myStats')}</Text>
        {/* Period toggle */}
        <View style={styles.periodToggle}>
          {(['7', '30'] as Period[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                {p === '7' ? t('dashboard.period7') : t('dashboard.period30')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Identity strip ── */}
      <View style={styles.identityStrip}>
        <View style={[styles.tierPill, { backgroundColor: tier.color + '22' }]}>
          <Text style={[styles.tierPillText, { color: tier.color }]}>
            {t(`dashboard.tier${capitalize(provider.reputation_tier)}`)}
          </Text>
        </View>
        {provider.score > 0 && (
          <Text style={styles.score}>⭐ {provider.score.toFixed(1)}</Text>
        )}
        <Text style={styles.lifetimeJobs}>
          {t('dashboard.lifetimeJobs', { count: provider.lifetime_jobs })}
        </Text>
        {provider.badge_verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>{t('providerProfile.verified')}</Text>
          </View>
        )}
      </View>

      {/* ── KPI cards ── */}
      <View style={styles.kpiGrid}>
        <KpiCard
          icon="💰"
          label={t('dashboard.earnings')}
          value={`${totalEarnings.toFixed(0)} د.أ`}
          sub={period === '7' ? t('dashboard.kpiSub7') : t('dashboard.kpiSub30')}
          accent
        />
        <KpiCard
          icon="🏆"
          label={t('dashboard.jobsCompleted')}
          value={String(totalJobs)}
          sub={t('dashboard.fromBids', { count: totalBids })}
        />
        <KpiCard
          icon="🎯"
          label={t('dashboard.winRate')}
          value={`${winRate}%`}
          sub={t('dashboard.wonFromBids', { won: totalWon, total: totalBids })}
        />
        <KpiCard
          icon="👁️"
          label={t('dashboard.profileViews')}
          value={String(totalViews)}
          sub={t('dashboard.duringPeriod')}
        />
      </View>

      {/* ── Weekly chart ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('dashboard.chartTitle')}</Text>
        <View style={styles.chartCard}>
          {chartData.every(d => d.jobs === 0) ? (
            <View style={styles.chartEmpty}>
              <Text style={styles.chartEmptyText}>{t('dashboard.chartEmpty')}</Text>
            </View>
          ) : (
            <View style={styles.chartBars}>
              {chartData.map((day, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{day.jobs > 0 ? day.jobs : ''}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${(day.jobs / chartMax) * 100}%` as any },
                        day.jobs === 0 && styles.barFillEmpty,
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{day.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── Recent completed jobs ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { textAlign: ta }]}>{t('dashboard.recentJobsTitle')}</Text>

        {recentJobs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🏅</Text>
            <Text style={styles.emptyText}>{t('dashboard.noRecentJobs')}</Text>
          </View>
        ) : (
          recentJobs.map(job => (
            <View key={job.id} style={styles.jobRow}>
              <View style={styles.jobLeft}>
                <Text style={[styles.jobTitle, { textAlign: ta }]} numberOfLines={1}>{job.request?.title}</Text>
                {job.confirmed_at && (
                  <Text style={[styles.jobDate, { textAlign: ta }]}>
                    {new Date(job.confirmed_at).toLocaleDateString(locale, {
                      day: 'numeric', month: 'short',
                    })}
                  </Text>
                )}
              </View>
              <View style={styles.jobRight}>
                {job.client_rating ? (
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Text key={s} style={styles.ratingStar}>
                        {s <= job.client_rating! ? '⭐' : '☆'}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noRating}>{t('dashboard.noRating')}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Subscription reminder ── */}
      {!provider.is_subscribed && (
        <View style={styles.subBanner}>
          <Text style={[styles.subBannerTitle, { textAlign: ta }]}>🚀 {t('dashboard.subBannerTitle')}</Text>
          <Text style={[styles.subBannerSub, { textAlign: ta }]}>{t('dashboard.subBannerSub')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Chart helpers ────────────────────────────────────────────

type ChartDay = { label: string; jobs: number };

const AR_DAY_ABBR = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const EN_DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function buildChartDays(rows: AnalyticsRow[], lang: string): ChartDay[] {
  const dayNames = lang === 'ar' ? AR_DAY_ABBR : EN_DAY_ABBR;
  const days: ChartDay[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const row = rows.find(r => r.date === iso);
    days.push({ label: dayNames[d.getDay()], jobs: row?.jobs_done ?? 0 });
  }
  return days;
}

// ─── KpiCard ──────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  const { colors } = useTheme();
  const kpiStyles = useMemo(() => createKpiStyles(colors), [colors]);
  const { ta } = useLanguage();
  return (
    <View style={[kpiStyles.card, accent && kpiStyles.cardAccent, { alignItems: ta === 'right' ? 'flex-end' : 'flex-start' }]}>
      <Text style={kpiStyles.icon}>{icon}</Text>
      <Text style={[kpiStyles.value, accent && kpiStyles.valueAccent]}>{value}</Text>
      <Text style={[kpiStyles.label, { textAlign: ta }]}>{label}</Text>
      <Text style={[kpiStyles.sub, { textAlign: ta }]}>{sub}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { paddingBottom: 48 },
  center:    { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: HEADER_PAD, paddingBottom: 16 },
  headerTitle:  { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  periodToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border },
  periodBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  periodBtnActive:   { backgroundColor: colors.accent },
  periodBtnText:     { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  periodBtnTextActive:{ color: colors.bg },

  identityStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 20, flexWrap: 'wrap' },
  tierPill:      { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  tierPillText:  { fontSize: 12, fontWeight: '700' },
  score:         { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  lifetimeJobs:  { fontSize: 13, color: colors.textMuted },
  verifiedBadge: { backgroundColor: '#0C4A6E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  verifiedText:  { fontSize: 11, color: '#7DD3FC', fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 24 },

  section:      { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },

  chartCard:  { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  chartEmpty: { alignItems: 'center', paddingVertical: 28 },
  chartEmptyText: { fontSize: 14, color: colors.textMuted },
  chartBars:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, paddingTop: 20 },
  barCol:     { flex: 1, alignItems: 'center', gap: 6 },
  barValue:   { fontSize: 10, color: colors.accent, fontWeight: '700', height: 14 },
  barTrack:   { width: 24, height: 72, backgroundColor: colors.bg, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill:    { width: '100%', backgroundColor: colors.accent, borderRadius: 6, minHeight: 4 },
  barFillEmpty:{ backgroundColor: colors.border },
  barLabel:   { fontSize: 10, color: colors.textMuted },

  jobRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  jobLeft:   { flex: 1, marginEnd: 12 },
  jobTitle:  { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  jobDate:   { fontSize: 11, color: colors.textMuted },
  jobRight:  { alignItems: 'flex-end' },
  ratingRow: { flexDirection: 'row', gap: 1 },
  ratingStar:{ fontSize: 13 },
  noRating:  { fontSize: 11, color: colors.textMuted },

  emptyBox:  { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted },

  subBanner:      { marginHorizontal: 16, backgroundColor: colors.accentDim, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)' },
  subBannerTitle: { fontSize: 16, fontWeight: '700', color: colors.accent, marginBottom: 6 },
  subBannerSub:   { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  });
}

function createKpiStyles(colors: AppColors) {
  return StyleSheet.create({
  card:       { width: '47%', backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardAccent: { borderColor: 'rgba(201,168,76,0.30)', backgroundColor: colors.accentDim },
  icon:       { fontSize: 24, marginBottom: 8 },
  value:      { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  valueAccent:{ color: colors.accent },
  label:      { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  sub:        { fontSize: 10, color: colors.textMuted },
  });
}
