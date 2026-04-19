import { useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Alert, Animated, Dimensions, PanResponder,
  Modal, RefreshControl, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { supabase }          from '../src/lib/supabase';
import { ALL_CATEGORIES }    from '../src/constants/categories';
import type { PortfolioItem } from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

const { width: W, height: H } = Dimensions.get('window');
const COLS   = 2;
const GAP    = 10;
const PAD    = 16;
const CARD_W = (W - PAD * 2 - GAP) / COLS;
const CARD_H = CARD_W * 1.28;

// ─── Helpers ──────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  maintenance:  '#3B82F6',
  cleaning:     '#10B981',
  education:    '#8B5CF6',
  freelance:    '#F59E0B',
  car_services: '#EF4444',
};

const getCatColor = (slug?: string, fallback = '#94A3B8') => {
  if (!slug) return fallback;
  const cat = ALL_CATEGORIES.find(c => c.slug === slug);
  return GROUP_COLORS[cat?.group_slug ?? ''] ?? fallback;
};

const getCatName = (slug?: string, lang?: string) => {
  const cat = ALL_CATEGORIES.find(c => c.slug === slug);
  if (!cat) return '';
  return lang === 'ar' ? cat.name_ar : (cat.name_en ?? cat.name_ar);
};

// ─── Before/After Drag Viewer ─────────────────────────────────

function BeforeAfterViewer({
  before, after, onClose,
}: { before: string; after: string; onClose: () => void }) {
  const { colors } = useTheme();
  const baStyles = useMemo(() => createBaStyles(colors), [colors]);
  const { t } = useLanguage();
  const divX = useRef(new Animated.Value(W / 2)).current;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, { moveX }) => {
        divX.setValue(Math.max(32, Math.min(W - 32, moveX)));
      },
    })
  ).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar hidden />

      <Image source={{ uri: after }} style={StyleSheet.absoluteFill} resizeMode="contain" />

      <Animated.View
        style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: divX, overflow: 'hidden' }}
      >
        <Image source={{ uri: before }} style={{ width: W, height: H }} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute', top: 0, bottom: 0, width: 2,
          backgroundColor: 'rgba(255,255,255,0.9)',
          left: Animated.subtract(divX, 1) as any,
        }}
      />

      <Animated.View
        {...pan.panHandlers}
        style={{
          position: 'absolute', top: '50%', marginTop: -30,
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: '#fff',
          shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, elevation: 12,
          alignItems: 'center', justifyContent: 'center',
          left: Animated.subtract(divX, 30) as any,
        }}
      >
        <Text style={{ fontSize: 20, color: '#111' }}>⟺</Text>
      </Animated.View>

      <View style={baStyles.labelLeft}>
        <Text style={baStyles.labelText}>{t('portfolio.beforeLabel')}</Text>
      </View>
      <View style={baStyles.labelRight}>
        <Text style={baStyles.labelText}>{t('portfolio.afterLabel')}</Text>
      </View>

      <View style={baStyles.hint}>
        <Text style={baStyles.hintText}>{t('portfolio.dragHint')}</Text>
      </View>

      <TouchableOpacity style={baStyles.closeBtn} onPress={onClose}>
        <Text style={baStyles.closeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function createBaStyles(colors: AppColors) {
  return StyleSheet.create({
  labelLeft:    { position: 'absolute', top: 60, left: 16, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  labelRight:   { position: 'absolute', top: 60, right: 16, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  labelText:    { color: '#fff', fontWeight: '800', fontSize: 13 },
  hint:         { position: 'absolute', bottom: 72, left: 0, right: 0, alignItems: 'center' },
  hintText:     { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  closeBtn:     { position: 'absolute', top: 54, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  });
}

// ─── Portfolio Card ───────────────────────────────────────────

function PortfolioCard({
  item, index, onPress, onLongPress,
}: {
  item: PortfolioItem;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const cardSt = useMemo(() => createCardSt(colors), [colors]);
  const { t, lang } = useLanguage();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay: Math.min(index * 55, 400),
      tension: 70, friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  const thumb    = item.media_urls[0];
  const catColor = getCatColor(item.category_slug, colors.textMuted);
  const catName  = getCatName(item.category_slug, lang);

  const typeIcon: Record<string, string> = {
    single: '🖼', before_after: '🔄', video: '🎥',
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
        ],
      }}
    >
      <TouchableOpacity
        style={[cardSt.card, { width: CARD_W, height: CARD_H }]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.92}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, cardSt.videoPlaceholder]}>
            <Text style={{ fontSize: 44 }}>🎥</Text>
          </View>
        )}

        <View style={cardSt.gradBot} />

        <View style={cardSt.topRow}>
          <View style={cardSt.typeBadge}>
            <Text style={{ fontSize: 11 }}>{typeIcon[item.item_type]}</Text>
          </View>
          {item.is_verified_job && (
            <View style={cardSt.verifiedBadge}>
              <Text style={cardSt.verifiedText}>{t('portfolio.verified')}</Text>
            </View>
          )}
        </View>

        <View style={cardSt.bottomRow}>
          {catName ? (
            <View style={[cardSt.catChip, { borderColor: catColor + '80' }]}>
              <Text style={[cardSt.catText, { color: catColor }]} numberOfLines={1}>{catName}</Text>
            </View>
          ) : <View />}
          <View style={cardSt.viewsRow}>
            <Text style={cardSt.viewsNum}>{item.views_count}</Text>
            <Text style={{ fontSize: 11 }}>👁</Text>
          </View>
        </View>

        {item.item_type === 'before_after' && (
          <View style={cardSt.baHint}>
            <Text style={cardSt.baHintText}>{t('portfolio.compareHint')}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function createCardSt(colors: AppColors) {
  return StyleSheet.create({
  card:            { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface },
  videoPlaceholder:{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  gradBot:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.65)' },
  topRow:          { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge:       { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  verifiedBadge:   { backgroundColor: 'rgba(59,130,246,0.9)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  verifiedText:    { fontSize: 10, color: '#fff', fontWeight: '700' },
  bottomRow:       { position: 'absolute', bottom: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catChip:         { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, maxWidth: CARD_W * 0.65 },
  catText:         { fontSize: 10, fontWeight: '700' },
  viewsRow:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewsNum:        { fontSize: 11, color: '#fff', fontWeight: '600' },
  baHint:          { position: 'absolute', top: '48%', left: 0, right: 0, alignItems: 'center' },
  baHintText:      { fontSize: 11, color: 'rgba(255,255,255,0.7)', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  });
}

// ─── Lightbox ─────────────────────────────────────────────────

type LightboxState =
  | { type: 'single';       url: string }
  | { type: 'before_after'; before: string; after: string }
  | { type: 'video';        url: string }
  | null;

// ─── Main Screen ──────────────────────────────────────────────

export default function PortfolioScreen() {
  const { colors } = useTheme();
  const st = useMemo(() => createSt(colors), [colors]);
  const baStyles = useMemo(() => createBaStyles(colors), [colors]);
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();

  const [items,      setItems]      = useState<PortfolioItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lightbox,   setLightbox]   = useState<LightboxState>(null);

  const fabAnim  = useRef(new Animated.Value(0)).current;
  const fabPulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
      const user = _ses?.user;
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setItems(data as PortfolioItem[]);
  
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    Animated.spring(fabAnim, { toValue: 1, tension: 60, friction: 7, delay: 400, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(fabPulse, { toValue: 1.00, duration: 900, useNativeDriver: true }),
      ])
    );
    const timer = setTimeout(() => loop.start(), 1500);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('id', id);
    if (error) {
      Alert.alert(t('common.error'), t('portfolio.errDelete'));
      return;
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const openLightbox = (item: PortfolioItem) => {
    supabase.rpc('increment_portfolio_view', { item_id: item.id }).then(() => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, views_count: i.views_count + 1 } : i));
    });

    if (item.item_type === 'before_after' && item.media_urls.length >= 2) {
      setLightbox({ type: 'before_after', before: item.media_urls[0], after: item.media_urls[1] });
    } else if (item.item_type === 'video' && item.video_url) {
      setLightbox({ type: 'video', url: item.video_url });
    } else if (item.media_urls[0]) {
      setLightbox({ type: 'single', url: item.media_urls[0] });
    }
  };

  const totalViews    = items.reduce((s, i) => s + i.views_count, 0);
  const verifiedCount = items.filter(i => i.is_verified_job).length;

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={st.container}>
      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Text style={st.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>{t('portfolio.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        numColumns={COLS}
        columnWrapperStyle={st.row}
        contentContainerStyle={st.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <>
            <View style={st.statsRow}>
              <StatCard label={t('portfolio.statItems')}   value={String(items.length)}   icon="🖼" />
              <StatCard label={t('portfolio.statViews')}   value={String(totalViews)}      icon="👁" />
              <StatCard label={t('portfolio.statVerified')} value={String(verifiedCount)}  icon="✓" accent />
            </View>
            {items.length > 0 && (
              <Text style={[st.gridLabel, { textAlign: ta }]}>
                {t('portfolio.gridLabel', { count: items.length })}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={st.empty}>
            <Text style={st.emptyIcon}>🖼</Text>
            <Text style={[st.emptyTitle, { textAlign: ta }]}>{t('portfolio.emptyTitle')}</Text>
            <Text style={[st.emptySub, { textAlign: ta }]}>{t('portfolio.emptySub')}</Text>
            <TouchableOpacity
              style={st.emptyBtn}
              onPress={() => router.push('/portfolio-add')}
            >
              <Text style={st.emptyBtnText}>{t('portfolio.emptyBtn')}</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item, index }) => (
          <PortfolioCard
            item={item}
            index={index}
            onPress={() => openLightbox(item)}
            onLongPress={() =>
              Alert.alert(
                t('portfolio.optionsTitle'),
                item.title_ar || getCatName(item.category_slug, lang) || t('portfolio.defaultWorkTitle'),
                [
                  { text: t('portfolio.deleteBtn'), style: 'destructive', onPress: () => deleteItem(item.id) },
                  { text: t('common.cancel'), style: 'cancel' },
                ]
              )
            }
          />
        )}
      />

      {/* ── FAB ── */}
      {items.length > 0 && (
        <Animated.View
          style={[
            st.fab,
            {
              opacity:   fabAnim,
              transform: [
                { scale: Animated.multiply(fabAnim, fabPulse) },
                { translateY: fabAnim.interpolate({ inputRange: [0,1], outputRange: [40, 0] }) },
              ],
            },
          ]}
        >
          <TouchableOpacity style={st.fabInner} onPress={() => router.push('/portfolio-add')} activeOpacity={0.85}>
            <Text style={st.fabText}>{t('portfolio.fabAdd')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Lightbox Modal ── */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
          {lightbox?.type === 'before_after' ? (
            <BeforeAfterViewer
              before={lightbox.before}
              after={lightbox.after}
              onClose={() => setLightbox(null)}
            />
          ) : lightbox?.type === 'video' ? (
            <>
              <Video
                source={{ uri: lightbox.url }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                useNativeControls
              />
              <TouchableOpacity style={baStyles.closeBtn} onPress={() => setLightbox(null)}>
                <Text style={baStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </>
          ) : lightbox?.type === 'single' ? (
            <>
              <Image source={{ uri: lightbox.url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              <TouchableOpacity style={baStyles.closeBtn} onPress={() => setLightbox(null)}>
                <Text style={baStyles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent?: boolean }) {
  const { colors } = useTheme();
  const stCard = useMemo(() => createStCard(colors), [colors]);
  return (
    <View style={[stCard.box, accent && stCard.accentBox]}>
      <Text style={stCard.icon}>{icon}</Text>
      <Text style={[stCard.value, accent && stCard.accentValue]}>{value}</Text>
      <Text style={stCard.label}>{label}</Text>
    </View>
  );
}

function createStCard(colors: AppColors) {
  return StyleSheet.create({
  box:         { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  accentBox:   { borderColor: colors.accent + '44', backgroundColor: colors.accentDim },
  icon:        { fontSize: 20, marginBottom: 6 },
  value:       { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  accentValue: { color: colors.accent },
  label:       { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  });
}

// ─── Styles ───────────────────────────────────────────────────

function createSt(colors: AppColors) {
  return StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:    { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },

  listContent: { padding: PAD, paddingBottom: 120 },
  row:         { gap: GAP, marginBottom: GAP },

  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 24 },
  gridLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 12, fontWeight: '600' },

  empty:        { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyIcon:    { fontSize: 72, marginBottom: 20 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 10 },
  emptySub:     { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 28 },
  emptyBtn:     { backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 },
  emptyBtnText: { fontSize: 15, fontWeight: '800', color: colors.bg },

  fab:      { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 24, right: 20, left: 20 },
  fabInner: { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 16, alignItems: 'center', shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 },
  fabText:  { fontSize: 16, fontWeight: '800', color: colors.bg },
  });
}
