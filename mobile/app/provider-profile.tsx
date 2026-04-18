// ============================================================
// WASEET — Public Provider Profile Screen (root-level)
// Opened from: chat profile_card tap, share link deep-link
// Shows full public info + portfolio + share/save CTAs
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Alert, Animated, Easing,
  Dimensions, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { COLORS } from '../src/constants/theme';
import { TIER_META, CATEGORY_GROUPS } from '../src/constants/categories';
import type { Provider, User, PortfolioItem, ShareChannel } from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';

const { width: W } = Dimensions.get('window');
const THUMB_SIZE   = (W - 40 - 8) / 3;

const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚', moon: '🌙', 'pen-tool': '✏️',
  car: '🚗', battery: '🔋', gauge: '⛽', snowflake: '🧊', shield: '🛡️', droplet: '💧',
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Stat pill ───────────────────────────────────────────────

function StatPill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Portfolio thumbnail ──────────────────────────────────────

function PortfolioThumb({ item }: { item: PortfolioItem }) {
  const thumb = item.item_type === 'video' ? null : item.media_urls[0];
  return (
    <View style={[styles.portfolioThumb, { width: THUMB_SIZE, height: THUMB_SIZE }]}>
      {thumb
        ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, styles.videoThumbBg]}>
            <Text style={{ fontSize: 24 }}>🎥</Text>
          </View>
      }
      {item.item_type === 'before_after' && (
        <View style={styles.thumbBadge}><Text style={styles.thumbBadgeText}>🔄</Text></View>
      )}
      {item.views_count > 0 && (
        <View style={styles.thumbViews}>
          <Text style={styles.thumbViewsText}>👁 {item.views_count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Share bottom sheet ───────────────────────────────────────

function ShareSheet({
  visible,
  providerName,
  username,
  providerId,
  myId,
  onClose,
}: {
  visible: boolean;
  providerName: string;
  username?: string;
  providerId: string;
  myId: string | null;
  onClose: () => void;
}) {
  const { t, ta } = useLanguage();
  const slideY  = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,  { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const deepLink = `https://waseet.app/p/${username ?? providerId}`;

  const doShare = async (channel: ShareChannel) => {
    try {
      if (myId) {
        supabase.rpc('record_profile_share', {
          p_provider_id: providerId,
          p_shared_by:   myId,
          p_channel:     channel,
        }).catch(() => {});
      }

      const msg = t('chat.recommendMsg', { name: providerName, link: deepLink });
      await Share.share({ message: msg, url: deepLink });
      onClose();
    } catch { /* user dismissed */ }
  };

  if (!visible) return null;

  const channels: { key: ShareChannel; icon: string; label: string }[] = [
    { key: 'whatsapp',  icon: '💬', label: t('providerProfile.shareWhatsapp') },
    { key: 'instagram', icon: '📸', label: t('providerProfile.shareInstagram') },
    { key: 'twitter',   icon: '🐦', label: t('providerProfile.shareTwitter') },
    { key: 'link',      icon: '🔗', label: t('providerProfile.shareCopy') },
    { key: 'other',     icon: '⬆️', label: t('providerProfile.shareOther') },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.sheetBackdrop, { opacity }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[styles.shareSheet, { transform: [{ translateY: slideY }] }]}>
        <View style={styles.sheetHandle} />
        <Text style={[styles.sheetTitle, { textAlign: ta }]}>
          {t('providerProfile.shareSheetTitle', { name: providerName })}
        </Text>
        <Text style={[styles.sheetLink, { textAlign: ta }]}>{deepLink}</Text>

        <View style={styles.channelRow}>
          {channels.map(ch => (
            <TouchableOpacity
              key={ch.key}
              style={styles.channelBtn}
              onPress={() => doShare(ch.key)}
              activeOpacity={0.75}
            >
              <View style={styles.channelIcon}>
                <Text style={{ fontSize: 24 }}>{ch.icon}</Text>
              </View>
              <Text style={styles.channelLabel}>{ch.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function ProviderPublicProfile() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { provider_id } = useLocalSearchParams<{ provider_id: string }>();
  const { t, ta, lang } = useLanguage();

  const [provider, setProvider]   = useState<(Provider & { user: User }) | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [myId, setMyId]           = useState<string | null>(null);
  const [myRole, setMyRole]       = useState<string | null>(null);
  const [isSaved, setIsSaved]     = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY  = useRef(new Animated.Value(20)).current;
  const bodyOp   = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!provider_id) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setMyId(authUser.id);
      const { data: u } = await supabase.from('users').select('role').eq('id', authUser.id).single();
      setMyRole(u?.role ?? null);
    }

    const [{ data: prov }, { data: port }, { data: saved }] = await Promise.all([
      supabase
        .from('providers')
        .select('*, user:users(*)')
        .eq('id', provider_id)
        .single(),
      supabase
        .from('portfolio_items')
        .select('*')
        .eq('provider_id', provider_id)
        .order('created_at', { ascending: false })
        .limit(12),
      authUser
        ? supabase
            .from('saved_providers')
            .select('id')
            .eq('client_id', authUser.id)
            .eq('provider_id', provider_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (prov) setProvider(prov as Provider & { user: User });
    if (port) setPortfolio(port as PortfolioItem[]);
    setIsSaved(!!saved);
    setLoading(false);

    supabase.rpc('increment_profile_view', { p_provider_id: provider_id }).catch(() => {});

    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 500, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(bodyOp,   { toValue: 1, duration: 500, delay: 280, useNativeDriver: true }),
    ]).start();
  }, [provider_id]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = async () => {
    if (!myId || !provider_id || savingToggle) return;
    setSavingToggle(true);
    if (isSaved) {
      await supabase.from('saved_providers').delete()
        .eq('client_id', myId).eq('provider_id', provider_id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_providers').insert({ client_id: myId, provider_id });
      setIsSaved(true);
    }
    setSavingToggle(false);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  }
  if (!provider) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('providerProfile.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backPill}>
          <Text style={styles.backPillText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tier    = TIER_META[provider.reputation_tier];
  const allCats = CATEGORY_GROUPS.flatMap(g => g.categories);
  const myCats  = allCats.filter(c => provider.categories?.includes(c.slug));
  const tierLabel = t(`dashboard.tier${capitalize(provider.reputation_tier)}` as any);

  return (
    <View style={styles.container}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBackBtn} onPress={() => router.back()}>
          <Text style={styles.topBackText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('providerProfile.topTitle')}</Text>
        <TouchableOpacity style={styles.shareIconBtn} onPress={() => setShowShare(true)}>
          <Text style={{ fontSize: 20 }}>⬆️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Hero card ── */}
        <Animated.View style={[styles.heroCard, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
          <View style={styles.heroTop}>
            <View style={[styles.avatar, { backgroundColor: tier.color + '33' }]}>
              <Text style={[styles.avatarText, { color: tier.color }]}>
                {provider.user?.full_name?.charAt(0) ?? '?'}
              </Text>
            </View>

            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { textAlign: ta }]}>{provider.user?.full_name}</Text>
              <Text style={[styles.heroCity, { textAlign: ta }]}>📍 {provider.user?.city}</Text>
              <View style={[styles.badgeRow, { justifyContent: ta === 'right' ? 'flex-end' : 'flex-start' }]}>
                <View style={[styles.tierPill, { backgroundColor: tier.color + '22' }]}>
                  <Text style={[styles.tierPillText, { color: tier.color }]}>{tierLabel}</Text>
                </View>
                {provider.badge_verified && (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedPillText}>✓ {t('providerProfile.verified')}</Text>
                  </View>
                )}
                {(provider.share_count ?? 0) >= 5 && (
                  <View style={styles.recommendedPill}>
                    <Text style={styles.recommendedPillText}>{t('providerProfile.recommended')}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatPill icon="⭐" value={provider.score > 0 ? provider.score.toFixed(1) : '—'} label={t('providerProfile.statRating')} />
            <StatPill icon="🔨" value={String(provider.lifetime_jobs)} label={t('providerProfile.statJobsDone')} />
            <StatPill icon="⬆️" value={String(provider.share_count ?? 0)} label={t('providerProfile.statShares')} />
            <StatPill icon="👁" value={String(provider.profile_views ?? 0)} label={t('providerProfile.statViews')} />
          </View>

          {provider.bio && (
            <Text style={[styles.bio, { textAlign: ta }]}>{provider.bio}</Text>
          )}

          {myCats.length > 0 && (
            <View style={[styles.catsRow, { justifyContent: ta === 'right' ? 'flex-end' : 'flex-start' }]}>
              {myCats.slice(0, 5).map(c => (
                <View key={c.slug} style={styles.catChip}>
                  <Text style={styles.catChipText}>
                    {ICON_MAP[c.icon] ?? '🔧'} {lang === 'ar' ? c.name_ar : c.name_en}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        {/* ── Action buttons (client only) ── */}
        <Animated.View style={[styles.actionRow, { opacity: bodyOp }]}>
          {myRole === 'client' && (
            <TouchableOpacity
              style={[styles.saveBtn, isSaved && styles.saveBtnActive]}
              onPress={toggleSave}
              disabled={savingToggle}
            >
              {savingToggle
                ? <ActivityIndicator color={isSaved ? COLORS.bg : COLORS.accent} size="small" />
                : <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextActive]}>
                    {isSaved ? t('providerProfile.saved') : t('providerProfile.saveProvider')}
                  </Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShare(true)}>
            <Text style={styles.shareBtnText}>{t('providerProfile.share')}</Text>
          </TouchableOpacity>

          {myRole === 'client' && provider_id && (
            <TouchableOpacity
              style={styles.requestBtn}
              onPress={() => router.push({
                pathname: '/(client)/new-request',
                params: { provider_hint: provider_id },
              })}
            >
              <Text style={styles.requestBtnText}>{t('providerProfile.directRequest')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── Portfolio gallery ── */}
        <Animated.View style={{ opacity: bodyOp }}>
          {portfolio.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { textAlign: ta }]}>
                {t('providerProfile.portfolioSection', { count: portfolio.length })}
              </Text>
              <View style={styles.portfolioGrid}>
                {portfolio.map(item => (
                  <PortfolioThumb key={item.id} item={item} />
                ))}
              </View>
            </View>
          )}

          {myId === provider_id && (
            <View style={styles.referralCard}>
              <Text style={styles.referralTitle}>{t('providerProfile.referralTitle')}</Text>
              <Text style={styles.referralSub}>{t('providerProfile.referralSub')}</Text>
              <TouchableOpacity style={styles.referralBtn} onPress={() => setShowShare(true)}>
                <Text style={styles.referralBtnText}>{t('providerProfile.referralBtn')}</Text>
              </TouchableOpacity>
              <View style={styles.referralProgress}>
                <Text style={styles.referralProgressText}>
                  {t('providerProfile.referralProgress', { count: provider.referral_clients ?? 0 })}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

      </ScrollView>

      {/* ── Share sheet ── */}
      <ShareSheet
        visible={showShare}
        providerName={provider.user?.full_name ?? ''}
        username={provider.username}
        providerId={provider_id!}
        myId={myId}
        onClose={() => setShowShare(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center:    { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: COLORS.textMuted, marginBottom: 16 },
  backPill:  { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  backPillText: { fontSize: 14, fontWeight: '700', color: COLORS.bg },

  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBackBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topBackText:  { fontSize: 22, color: COLORS.textSecondary, transform: [{ scaleX: -1 }] },
  topTitle:     { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  shareIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  content: { padding: 16, paddingBottom: 60 },

  heroCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  heroTop:  { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 16 },
  avatar:   { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '800' },
  heroInfo: { flex: 1, gap: 4 },
  heroName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  heroCity: { fontSize: 13, color: COLORS.textMuted },

  badgeRow:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  tierPill:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tierPillText:    { fontSize: 11, fontWeight: '700' },
  verifiedPill:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#0C4A6E' },
  verifiedPillText:{ fontSize: 11, fontWeight: '700', color: '#7DD3FC' },
  recommendedPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)' },
  recommendedPillText: { fontSize: 11, fontWeight: '700', color: '#FCD34D' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: COLORS.border },
  statIcon: { fontSize: 16 },
  statValue:{ fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statLabel:{ fontSize: 9, color: COLORS.textMuted, textAlign: 'center' },

  bio: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 12 },

  catsRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  catChip:     { backgroundColor: COLORS.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  catChipText: { fontSize: 11, color: COLORS.textSecondary },

  actionRow:       { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  saveBtn:         { flex: 1, minWidth: 100, backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  saveBtnActive:   { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  saveBtnText:     { fontSize: 13, fontWeight: '700', color: COLORS.accent },
  saveBtnTextActive:{ color: COLORS.bg },
  shareBtn:        { flex: 1, minWidth: 80, backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  shareBtnText:    { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  requestBtn:      { flex: 1, minWidth: 100, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  requestBtnText:  { fontSize: 13, fontWeight: '700', color: COLORS.bg },

  section:       { marginBottom: 20 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  portfolioThumb:{ borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.surface },
  videoThumbBg:  { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  thumbBadge:    { position: 'absolute', top: 4, right: 4, backgroundColor: '#00000088', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  thumbBadgeText:{ fontSize: 9 },
  thumbViews:    { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#00000088', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  thumbViewsText:{ fontSize: 9, color: '#fff' },

  referralCard:    { backgroundColor: COLORS.accentDim, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)', alignItems: 'center', gap: 8 },
  referralTitle:   { fontSize: 17, fontWeight: '800', color: COLORS.accent, textAlign: 'center' },
  referralSub:     { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  referralBtn:     { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  referralBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.bg },
  referralProgress:{ backgroundColor: COLORS.bg, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  referralProgressText: { fontSize: 12, color: COLORS.textMuted },

  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  shareSheet:    { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 48, paddingTop: 12 },
  sheetHandle:   { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:    { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  sheetLink:     { fontSize: 12, color: COLORS.textMuted, marginBottom: 20, fontFamily: 'monospace' },

  channelRow:   { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 },
  channelBtn:   { alignItems: 'center', gap: 6, minWidth: 56 },
  channelIcon:  { width: 52, height: 52, backgroundColor: COLORS.bg, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  channelLabel: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
});
