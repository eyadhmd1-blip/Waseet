/**
 * Help Center — Tier 3 tutorial layer.
 * Accessible from both client and provider profiles via:
 *   router.push('/help-center?role=client')
 *   router.push('/help-center?role=provider')
 *
 * Features: search + accordion FAQ sections + replay carousel + contact support.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme }    from '../src/context/ThemeContext';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets }   from '../src/hooks/useInsets';
import { useTutorial } from '../src/hooks/useTutorial';
import type { AppColors } from '../src/constants/colors';
import { OnboardingCarousel } from './tutorial/carousel';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── FAQ data ─────────────────────────────────────────────────

interface FaqItem { qKey: string; aKey: string }
interface Section { titleKey: string; emoji: string; items: FaqItem[]; roles: ('client' | 'provider')[] }

const SECTIONS: Section[] = [
  {
    titleKey: 'helpCenter.secRequests',
    emoji: '📋',
    roles: ['client', 'provider'],
    items: [
      { qKey: 'helpCenter.q_postRequest',    aKey: 'helpCenter.a_postRequest' },
      { qKey: 'helpCenter.q_chooseBid',      aKey: 'helpCenter.a_chooseBid' },
      { qKey: 'helpCenter.q_noProviders',    aKey: 'helpCenter.a_noProviders' },
      { qKey: 'helpCenter.q_cancelRequest',  aKey: 'helpCenter.a_cancelRequest' },
    ],
  },
  {
    titleKey: 'helpCenter.secCredits',
    emoji: '💳',
    roles: ['provider'],
    items: [
      { qKey: 'helpCenter.q_whatCredits',    aKey: 'helpCenter.a_whatCredits' },
      { qKey: 'helpCenter.q_creditCost',     aKey: 'helpCenter.a_creditCost' },
      { qKey: 'helpCenter.q_renewCredits',   aKey: 'helpCenter.a_renewCredits' },
      { qKey: 'helpCenter.q_planDiff',       aKey: 'helpCenter.a_planDiff' },
    ],
  },
  {
    titleKey: 'helpCenter.secBoost',
    emoji: '⚡',
    roles: ['provider'],
    items: [
      { qKey: 'helpCenter.q_boostHow',       aKey: 'helpCenter.a_boostHow' },
      { qKey: 'helpCenter.q_boostGuarantee', aKey: 'helpCenter.a_boostGuarantee' },
      { qKey: 'helpCenter.q_boostFree',      aKey: 'helpCenter.a_boostFree' },
    ],
  },
  {
    titleKey: 'helpCenter.secReputation',
    emoji: '⭐',
    roles: ['client', 'provider'],
    items: [
      { qKey: 'helpCenter.q_repCalc',        aKey: 'helpCenter.a_repCalc' },
      { qKey: 'helpCenter.q_repDispute',     aKey: 'helpCenter.a_repDispute' },
    ],
  },
  {
    titleKey: 'helpCenter.secContracts',
    emoji: '📅',
    roles: ['client', 'provider'],
    items: [
      { qKey: 'helpCenter.q_contractWhat',   aKey: 'helpCenter.a_contractWhat' },
      { qKey: 'helpCenter.q_contractCancel', aKey: 'helpCenter.a_contractCancel' },
    ],
  },
  {
    titleKey: 'helpCenter.secAccount',
    emoji: '👤',
    roles: ['client', 'provider'],
    items: [
      { qKey: 'helpCenter.q_changePhone',    aKey: 'helpCenter.a_changePhone' },
      { qKey: 'helpCenter.q_deleteAccount',  aKey: 'helpCenter.a_deleteAccount' },
    ],
  },
];

// ─── Accordion item ───────────────────────────────────────────

function AccordionItem({
  qKey, aKey, colors, t, isLast,
}: FaqItem & { colors: AppColors; t: (k: string) => string; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const st = accStyles(colors);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <View style={[st.item, isLast && st.itemLast]}>
      <TouchableOpacity style={st.qRow} onPress={toggle} activeOpacity={0.75}>
        <Text style={st.qText}>{t(qKey)}</Text>
        <Text style={st.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <Text style={st.aText}>{t(aKey)}</Text>}
    </View>
  );
}

function accStyles(colors: AppColors) {
  return StyleSheet.create({
    item: {
      borderBottomWidth: 1, borderBottomColor: colors.border,
      paddingVertical: 14,
    },
    itemLast: { borderBottomWidth: 0 },
    qRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    qText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20, textAlign: 'right' },
    arrow: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
    aText: { fontSize: 13, color: colors.textSecondary, lineHeight: 21, marginTop: 10, textAlign: 'right' },
  });
}

// ─── Main screen ──────────────────────────────────────────────

export default function HelpCenterScreen() {
  const { colors }        = useTheme();
  const { t }             = useLanguage();
  const { headerPad, contentPad } = useInsets();
  const router            = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const role = (roleParam === 'provider' ? 'provider' : 'client') as 'client' | 'provider';

  const { resetTutorial, showCarousel, dismissCarousel } = useTutorial(role);

  const [query,         setQuery]         = useState('');
  const [replayVisible, setReplayVisible] = useState(false);

  const handleReplay = useCallback(async () => {
    await resetTutorial();
    setReplayVisible(true);
  }, [resetTutorial]);

  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECTIONS
      .filter(s => s.roles.includes(role))
      .map(s => ({
        ...s,
        items: q
          ? s.items.filter(
              item => t(item.qKey).toLowerCase().includes(q) || t(item.aKey).toLowerCase().includes(q),
            )
          : s.items,
      }))
      .filter(s => s.items.length > 0);
  }, [query, role, t]);

  const st = styles(colors);

  return (
    <View style={st.root}>

      {/* Header */}
      <View style={[st.header, { paddingTop: headerPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Text style={st.backText}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>{t('helpCenter.title')}</Text>
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <Text style={st.searchIcon}>🔍</Text>
        <TextInput
          style={st.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('helpCenter.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={st.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[st.content, { paddingBottom: contentPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* No results */}
        {visibleSections.length === 0 && (
          <View style={st.emptyWrap}>
            <Text style={st.emptyIcon}>🤷</Text>
            <Text style={st.emptyTitle}>{t('helpCenter.noResults')}</Text>
            <Text style={st.emptySub}>{t('helpCenter.noResultsSub')}</Text>
          </View>
        )}

        {/* FAQ sections */}
        {visibleSections.map(section => (
          <View key={section.titleKey} style={st.section}>
            <View style={st.sectionHeader}>
              <Text style={st.sectionEmoji}>{section.emoji}</Text>
              <Text style={st.sectionTitle}>{t(section.titleKey)}</Text>
            </View>
            <View style={st.sectionCard}>
              {section.items.map((item, idx) => (
                <AccordionItem
                  key={item.qKey}
                  qKey={item.qKey}
                  aKey={item.aKey}
                  colors={colors}
                  t={t}
                  isLast={idx === section.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Action buttons */}
        <View style={st.actionsWrap}>
          {/* Replay tutorial */}
          <TouchableOpacity style={st.actionBtn} onPress={handleReplay} activeOpacity={0.85}>
            <Text style={st.actionIcon}>🎬</Text>
            <View style={st.actionTextWrap}>
              <Text style={st.actionTitle}>{t('helpCenter.replayTitle')}</Text>
              <Text style={st.actionSub}>{t('helpCenter.replaySub')}</Text>
            </View>
            <Text style={st.actionArrow}>›</Text>
          </TouchableOpacity>

          {/* Contact support */}
          <TouchableOpacity
            style={[st.actionBtn, st.supportBtn]}
            onPress={() => router.push('/support' as any)}
            activeOpacity={0.85}
          >
            <Text style={st.actionIcon}>💬</Text>
            <View style={st.actionTextWrap}>
              <Text style={st.actionTitle}>{t('helpCenter.contactTitle')}</Text>
              <Text style={st.actionSub}>{t('helpCenter.contactSub')}</Text>
            </View>
            <Text style={st.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Replay carousel */}
      <OnboardingCarousel
        role={role}
        visible={replayVisible || showCarousel}
        onDone={() => { setReplayVisible(false); dismissCarousel(); }}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function styles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },

    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn:     {},
    backText:    { fontSize: 16, color: colors.accent, fontWeight: '600' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'right' },

    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginVertical: 12,
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    searchIcon:  { fontSize: 16 },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, textAlign: 'right' },
    clearBtn:    { fontSize: 14, color: colors.textMuted, fontWeight: '700' },

    content: { paddingHorizontal: 16, paddingTop: 12 },

    emptyWrap:  { alignItems: 'center', paddingVertical: 60 },
    emptyIcon:  { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
    emptySub:   { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

    section:       { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, justifyContent: 'flex-end' },
    sectionEmoji:  { fontSize: 18 },
    sectionTitle:  { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    sectionCard: {
      backgroundColor: colors.surface, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 16, paddingBottom: 4,
    },

    actionsWrap: { gap: 10, marginTop: 8, marginBottom: 20 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      padding: 16,
    },
    supportBtn: { borderColor: colors.accent + '40' },
    actionIcon:     { fontSize: 24 },
    actionTextWrap: { flex: 1, alignItems: 'flex-end' },
    actionTitle:    { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    actionSub:      { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    actionArrow:    { fontSize: 20, color: colors.textMuted },
  });
}
