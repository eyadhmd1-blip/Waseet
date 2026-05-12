// ============================================================
// WASEET — Onboarding Screen (multi-step)
// Steps: 1-Role → 2-Info → [3-Services (provider)] → [4-Plan (provider)] → 5-Done
// ============================================================

import { useState, useRef, useEffect, useMemo} from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Animated, Dimensions, KeyboardAvoidingView, Platform,
  Image, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { notifyRoleUpdate } from '../../src/lib/authEvents';
import { JORDAN_CITIES, SUBSCRIPTION_PLANS, ICON_MAP } from '../../src/constants/categories';
import { useCategories } from '../../src/hooks/useCategories';
import { SuggestServiceModal } from '../../src/components/SuggestServiceModal';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD, rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const { width } = Dimensions.get('window');


type Role = 'client' | 'provider';
type PlanChoice = 'trial' | 'basic' | 'pro' | 'premium' | null;

// ── Progress Bar ─────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  return (
    <View style={styles.progressWrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i < current ? styles.progressSegmentActive : styles.progressSegmentInactive,
          ]}
        />
      ))}
    </View>
  );
}

// ── Step 1: Role Selection ────────────────────────────────────

const CLIENT_COLOR   = '#3B82F6';

function Step1Role({
  role, onSelect,
}: { role: Role; onSelect: (r: Role) => void }) {
  const { colors, isDark } = useTheme();
  const { t, isRTL, lang } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const clientScaleAnim   = useRef(new Animated.Value(role === 'client'   ? 1.03 : 1)).current;
  const providerScaleAnim = useRef(new Animated.Value(role === 'provider' ? 1.03 : 1)).current;

  const handleSelect = (r: Role) => {
    const hit   = r === 'client' ? clientScaleAnim : providerScaleAnim;
    const other = r === 'client' ? providerScaleAnim : clientScaleAnim;
    Animated.sequence([
      Animated.spring(hit,   { toValue: 0.92, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.spring(hit,   { toValue: 1.03, useNativeDriver: true, tension: 180, friction: 6 }),
    ]).start();
    Animated.spring(other, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();
    onSelect(r);
  };

  const CLIENT_CHIPS   = lang === 'ar'
    ? ['🔍 ابحث', '💬 قارن', '✅ وظّف']
    : ['🔍 Search', '💬 Compare', '✅ Hire'];
  const PROVIDER_CHIPS = lang === 'ar'
    ? ['💰 اكسب', '📊 تتبع', '⭐ سمعة']
    : ['💰 Earn', '📊 Track', '⭐ Grow'];

  const renderCard = (r: Role) => {
    const isActive  = role === r;
    const scaleAnim = r === 'client' ? clientScaleAnim : providerScaleAnim;
    const accent    = r === 'client' ? CLIENT_COLOR : colors.accent;
    const emoji     = r === 'client' ? '👤' : '🔧';
    const title     = t(r === 'client' ? 'onboarding.clientCardTitle' : 'onboarding.providerCardTitle');
    const sub       = t(r === 'client' ? 'onboarding.clientCardSub'   : 'onboarding.providerCardSub');
    const chips     = r === 'client' ? CLIENT_CHIPS : PROVIDER_CHIPS;

    return (
      <Animated.View
        key={r}
        style={[
          styles.roleCard,
          isActive && { borderColor: accent, borderWidth: 2, backgroundColor: isDark ? accent + '18' : accent + '0D' },
          { transform: [{ scale: scaleAnim }] },
          isActive && {
            shadowColor:   accent,
            shadowOffset:  { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.45 : 0.22,
            shadowRadius:  14,
            elevation:     10,
          },
        ]}
      >
        <TouchableOpacity onPress={() => handleSelect(r)} activeOpacity={1} style={styles.roleCardInner}>

          {/* Checkmark */}
          <View style={[styles.roleCheck, isActive && { backgroundColor: accent, borderColor: accent }]}>
            {isActive && <Text style={styles.roleCheckMark}>✓</Text>}
          </View>

          {/* Emoji circle */}
          <View style={[
            styles.roleEmojiWrap,
            { backgroundColor: isActive ? accent + '22' : colors.bg },
          ]}>
            <Text style={styles.roleEmoji}>{emoji}</Text>
          </View>

          {/* Title + sub */}
          <Text style={[styles.roleCardTitle, isActive && { color: accent }]}>{title}</Text>
          <Text style={styles.roleCardSub}>{sub}</Text>

          {/* Benefit chips */}
          <View style={styles.roleChipRow}>
            {chips.map(chip => (
              <View
                key={chip}
                style={[
                  styles.roleChip,
                  isActive
                    ? { backgroundColor: accent + '1A', borderColor: accent + '55' }
                    : { backgroundColor: colors.bg, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.roleChipText, isActive && { color: accent }]}>{chip}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('onboarding.step1Title')}</Text>
      <Text style={styles.stepSub}>{t('onboarding.step1Sub')}</Text>
      <View style={[styles.roleCards, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {renderCard('client')}
        {renderCard('provider')}
      </View>
    </View>
  );
}

// ── Step 2: Personal Info ─────────────────────────────────────

function Step2Info({
  role, fullName, setFullName, city, setCity, bio, setBio,
}: {
  role: Role;
  fullName: string; setFullName: (v: string) => void;
  city: string; setCity: (v: string) => void;
  bio: string; setBio: (v: string) => void;
}) {
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  return (
    <ScrollView style={styles.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('onboarding.step2Title')}</Text>
        <Text style={styles.stepSub}>{t('onboarding.step2Sub')}</Text>

        {/* Full name */}
        <Text style={styles.fieldLabel}>{t('auth.fullName')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('auth.fullNamePlaceholder')}
          placeholderTextColor="#475569"
          value={fullName}
          onChangeText={setFullName}
        />

        {/* City */}
        <Text style={styles.fieldLabel}>{t('auth.city')} *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {JORDAN_CITIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, city === c && styles.chipActive]}
              onPress={() => setCity(c)}
            >
              <Text style={[styles.chipText, city === c && styles.chipTextActive]}>
                {t(`cities.${c}`, c)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bio — providers only */}
        {role === 'provider' && (
          <>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabelOptional]}>{t('onboarding.bioOptional')}</Text>
              <Text style={styles.fieldLabel}>{t('onboarding.bioLabel')}</Text>
            </View>
            <TextInput
              style={styles.inputMulti}
              placeholder={t('onboarding.bioPlaceholder')}
              placeholderTextColor="#475569"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ── Step 3: Service Selection (provider only) ─────────────────

function Step3Services({
  selectedCats, setSelectedCats, groups, onSuggest,
}: {
  selectedCats: string[];
  setSelectedCats: (v: string[]) => void;
  groups: ReturnType<typeof useCategories>['groups'];
  onSuggest: () => void;
}) {
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const [search, setSearch] = useState('');

  const allCats = groups.flatMap(g => g.categories);
  const filtered = search.trim()
    ? allCats.filter(c =>
        c.name_ar.includes(search) || c.name_en.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const toggle = (slug: string) => {
    if (!selectedCats.includes(slug) && selectedCats.length >= 3) {
      Alert.alert(t('profile.maxSpecialties'), t('profile.maxSpecialtiesMsg'));
      return;
    }
    setSelectedCats(
      selectedCats.includes(slug)
        ? selectedCats.filter(s => s !== slug)
        : [...selectedCats, slug]
    );
  };

  const renderCat = (cat: typeof allCats[0]) => {
    const active = selectedCats.includes(cat.slug);
    return (
      <TouchableOpacity
        key={cat.slug}
        style={[styles.catCard, active && styles.catCardActive]}
        onPress={() => toggle(cat.slug)}
        activeOpacity={0.8}
      >
        <Text style={styles.catEmoji}>{ICON_MAP[cat.icon] ?? '🔧'}</Text>
        <Text style={[styles.catName, active && styles.catNameActive]} numberOfLines={2}>
          {t(`categories.${cat.slug}`, cat.name_ar)}
        </Text>
        {active && <View style={styles.catCheck}><Text style={styles.catCheckMark}>✓</Text></View>}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('onboarding.step3Title')}</Text>
        <Text style={styles.stepSub}>{t('onboarding.step3Sub')}</Text>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder={t('onboarding.searchServices')}
          placeholderTextColor="#475569"
          value={search}
          onChangeText={setSearch}
        />

        {filtered ? (
          <View style={styles.catGrid}>
            {filtered.map(renderCat)}
          </View>
        ) : (
          groups.map(group => (
            <View key={group.slug}>
              <Text style={styles.groupLabel}>
                {t(`categories.${group.slug}`, group.name_ar)}
              </Text>
              <View style={styles.catGrid}>
                {group.categories.map(renderCat)}
              </View>
            </View>
          ))
        )}

        {/* Selected summary */}
        <View style={styles.selectedBar}>
          <Text style={styles.selectedBarText}>
            {t('profile.selectedCount', { count: selectedCats.length, max: 3 })}
          </Text>
        </View>

        <TouchableOpacity
          style={{ paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}
          onPress={onSuggest}
        >
          <Text style={{ fontSize: 13, color: colors.textMuted }}>
            {t('suggestions.notFound')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Step 4: Plan Selection (provider only) ────────────────────

function Step4Plan({
  planChoice, setPlanChoice, trialUsed, onStartFree, saving,
}: {
  planChoice: PlanChoice;
  setPlanChoice: (p: PlanChoice) => void;
  trialUsed: boolean;
  onStartFree: () => void;
  saving: boolean;
}) {
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const creditsDesc: Record<string, string> = {
    basic:   t('onboarding.creditsDesc_basic'),
    pro:     t('onboarding.creditsDesc_pro'),
    premium: t('onboarding.creditsDesc_premium'),
  };

  return (
    <ScrollView style={styles.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{t('onboarding.step4Title')}</Text>
        <Text style={styles.stepSub}>{t('onboarding.step4Sub')}</Text>

        {/* Trial Card */}
        {!trialUsed && (
          <TouchableOpacity
            style={[styles.trialCard, planChoice === 'trial' && styles.trialCardActive]}
            onPress={() => setPlanChoice('trial')}
            activeOpacity={0.85}
          >
            <View style={styles.trialTop}>
              <Text style={styles.trialBadge}>✨ {t('subscribe.trialBadge')}</Text>
              <Text style={styles.trialTitle}>{t('onboarding.trialCardTitle')}</Text>
            </View>
            <Text style={styles.trialCredits}>{t('onboarding.trialCardCredits')}</Text>
            <Text style={styles.trialNote}>• {t('onboarding.trialCardNote1')}</Text>
            <Text style={styles.trialNote}>• {t('onboarding.trialCardNote2')}</Text>
            <TouchableOpacity
              style={[styles.trialBtn, planChoice === 'trial' && styles.trialBtnActive, saving && styles.trialBtnDisabled]}
              onPress={onStartFree}
              disabled={saving}
            >
              <Text style={styles.trialBtnText}>{t('onboarding.trialBtn')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Paid Plans */}
        {SUBSCRIPTION_PLANS.filter(p => !p.is_trial).map(plan => {
          const active = planChoice === plan.tier;
          const isPopular = plan.tier === 'pro';
          return (
            <TouchableOpacity
              key={plan.tier}
              style={[styles.planCard, active && styles.planCardActive]}
              onPress={() => setPlanChoice(plan.tier as PlanChoice)}
              activeOpacity={0.85}
            >
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>{t('onboarding.popularBadge')}</Text>
                </View>
              )}
              <View style={styles.planRow}>
                <View style={styles.planLeft}>
                  <Text style={styles.planName}>{plan.name_ar}</Text>
                  <Text style={styles.planDesc}>{creditsDesc[plan.tier] ?? ''}</Text>
                  <Text style={styles.planCredits}>
                    {plan.is_unlimited
                      ? t('subscribe.unlimitedCredits')
                      : t('subscribe.creditsLabel', { count: plan.subscription_credits })}
                  </Text>
                </View>
                <View style={styles.planRight}>
                  <Text style={styles.planPrice}>{plan.price_jod}</Text>
                  <Text style={styles.planCurrency}>د.أ{t('subscribe.perMonth')}</Text>
                  <View style={[styles.planRadio, active && styles.planRadioActive]}>
                    {active && <View style={styles.planRadioDot} />}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Step 5: Done ──────────────────────────────────────────────

function StepDone({
  role, planChoice, onExplore,
}: { role: Role; planChoice: PlanChoice; onExplore: () => void }) {
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const subText = role === 'client'
    ? t('onboarding.doneSubClient')
    : planChoice === 'trial'
      ? t('onboarding.doneSubProvider', { count: 10 })
      : t('onboarding.doneSubProviderPaid');

  return (
    <ScrollView contentContainerStyle={[styles.stepContent, styles.doneContent]} showsVerticalScrollIndicator={false}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={styles.doneTitle}>{t('onboarding.doneTitle')}</Text>
      <Text style={styles.doneSub}>{subText}</Text>
      <TouchableOpacity style={styles.doneBtn} onPress={onExplore} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>{t('onboarding.exploreCTA')} {isRTL ? '←' : '→'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Step 1: Role Selection — Redesigned ──────────────────────

const GOLD_COLOR = '#C9A84C';
const BLUE_COLOR = '#3B82F6';


function Step1RoleNew({
  role, onSelect, onNext,
}: { role: Role; onSelect: (r: Role) => void; onNext: () => void }) {
  const { colors, isDark } = useTheme();
  const { isRTL }          = useLanguage();
  const { headerPad, contentPad } = useInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const isSmall  = screenH < 700;
  const H_PAD    = 16;
  const CARD_GAP = 10;
  const cardW    = (screenW - H_PAD * 2 - CARD_GAP) / 2;

  // Illustration area height: proportional to card width, capped for small screens
  const charH = Math.min(cardW * 1.05, screenH * (isSmall ? 0.21 : 0.27));

  const gradColors: [string, string] = isDark
    ? [colors.bg, '#1A1407']
    : ['#FDF6E3', '#FFFBF8'];

  const CLIENT_CHIPS   = [
    { icon: '🏷️', label: 'قارن الأسعار واختار الأفضل' },
    { icon: '⚡',  label: 'طلب سريع في ثوانٍ' },
    { icon: '🛡️', label: 'موثوق ومضمون' },
  ];
  const PROVIDER_CHIPS = [
    { icon: '💰', label: 'دخل أعلى ونمو مستمر' },
    { icon: '⭐', label: 'بني سمعتك وتقييمك' },
    { icon: '👥', label: 'اعملاء أكثر فرص أكبر' },
  ];

  const renderCard = (isClient: boolean) => {
    const isActive  = isClient ? role === 'client' : role === 'provider';
    const accent    = isClient ? GOLD_COLOR : BLUE_COLOR;
    const bgActive  = isClient
      ? (isDark ? GOLD_COLOR + '22' : '#FFFBEF')
      : (isDark ? BLUE_COLOR + '22' : '#EFF6FF');
    const chips     = isClient ? CLIENT_CHIPS : PROVIDER_CHIPS;
    const title     = isClient ? 'أنا طالب خدمة' : 'أنا مقدم خدمة';
    const subtitle  = isClient ? 'ابحث عن أفضل مقدم\nضمن دقايق' : 'أبدأ باستقبال الطلبات\nوزيد دخلك';
    return (
      <TouchableOpacity
        style={[{
          flex: 1, borderRadius: 20, overflow: 'hidden',
          borderWidth: 2,
          borderColor: isActive ? accent : colors.border,
          backgroundColor: isActive ? bgActive : colors.surface,
        }, isActive && {
          shadowColor: accent,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 8,
        }]}
        onPress={() => onSelect(isClient ? 'client' : 'provider')}
        activeOpacity={0.9}
      >
        {/* Selection banner */}
        <View style={{
          backgroundColor: isActive ? accent : (isDark ? colors.surface : '#F0F0F0'),
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: isActive ? '#fff' : (isDark ? colors.textMuted : '#9CA3AF') }}>
            {isActive ? '✓' : '○'}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#fff' : (isDark ? colors.textMuted : '#9CA3AF') }}>
            {isActive ? 'تم الاختيار' : 'اضغط للاختيار'}
          </Text>
        </View>

        {/* Gender-neutral abstract illustration */}
        <View style={{
          width: cardW, height: charH,
          backgroundColor: isDark
            ? (isActive ? accent + '18' : colors.bg)
            : (isClient ? '#FFF9EC' : '#EEF4FF'),
          alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Glow circle */}
          <View style={{
            width: charH * 0.65, height: charH * 0.65, borderRadius: charH * 0.325,
            backgroundColor: isActive ? accent + '22' : (isDark ? colors.surface : accent + '12'),
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: charH * 0.28 }}>{isClient ? '🔍' : '🛠️'}</Text>
          </View>
          {/* Floating decorative icons */}
          <Text style={{ position: 'absolute', top: charH * 0.10, right: cardW * 0.12, fontSize: charH * 0.13, opacity: 0.85 }}>⭐</Text>
          <Text style={{ position: 'absolute', top: charH * 0.13, left: cardW * 0.10, fontSize: charH * 0.10, opacity: 0.75 }}>{isClient ? '💬' : '📊'}</Text>
          <Text style={{ position: 'absolute', bottom: charH * 0.12, right: cardW * 0.10, fontSize: charH * 0.10, opacity: 0.75 }}>{isClient ? '✅' : '💰'}</Text>
          <Text style={{ position: 'absolute', bottom: charH * 0.16, left: cardW * 0.13, fontSize: charH * 0.09, opacity: 0.65 }}>{isClient ? '✨' : '⭐'}</Text>
        </View>

        {/* Card text content */}
        <View style={{ padding: 12, paddingTop: 10 }}>
          <Text style={{
            fontSize: rs(14, 12, 16), fontWeight: '800',
            color: isActive ? accent : colors.textPrimary,
            textAlign: 'center', marginBottom: 4,
          }}>{title}</Text>

          <Text style={{
            fontSize: rs(10, 9, 12), color: colors.textMuted,
            textAlign: 'center', marginBottom: 8, lineHeight: 15,
          }}>{subtitle}</Text>

          {chips.map(chip => (
            <View key={chip.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: isActive ? accent + '22' : (isDark ? colors.bg : '#F3F4F6'),
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 11 }}>{chip.icon}</Text>
              </View>
              <Text style={{
                fontSize: rs(10, 9, 11), flex: 1,
                color: isActive ? accent : colors.textSecondary,
              }} numberOfLines={1}>{chip.label}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradColors} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: headerPad, paddingBottom: contentPad, paddingHorizontal: H_PAD }}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={{ width: 52, height: 52, borderRadius: 14 }}
            />
          </View>

          {/* Title + subtitle */}
          <Text style={{ fontSize: rs(24, 20, 28), fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 }}>
            👋 أهلاً بك في وسيط
          </Text>
          <Text style={{ fontSize: rs(13, 12, 15), color: colors.textMuted, textAlign: 'center', marginBottom: isSmall ? 10 : 14 }}>
            اختر كيف تريد استخدام التطبيق
          </Text>

          {/* Social proof row */}
          <View style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: isSmall ? 10 : 14,
          }}>
            {/* Overlapping avatar circles */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {(['#F59E0B', '#3B82F6', '#10B981'] as const).map((bg, i) => (
                <View key={i} style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: bg,
                  borderWidth: 2, borderColor: isDark ? colors.bg : '#FDF6E3',
                  marginLeft: i > 0 ? -9 : 0,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 13 }}>👤</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: '#F59E0B', fontSize: 13, letterSpacing: 1 }}>★★★★★</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              <Text style={{ color: GOLD_COLOR, fontWeight: '700' }}>+12,000</Text>
              {' مستخدم يثقون بنا'}
            </Text>
          </View>

          {/* Role cards */}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: CARD_GAP, marginBottom: isSmall ? 10 : 14 }}>
            {renderCard(true)}
            {renderCard(false)}
          </View>

          {/* Trust badges — hidden on small screens */}
          {!isSmall && (
            <View style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-around',
              backgroundColor: isDark ? colors.surface + 'AA' : 'rgba(255,255,255,0.75)',
              borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8,
              marginBottom: 14, borderWidth: 1,
              borderColor: isDark ? colors.border : 'rgba(201,168,76,0.18)',
            }}>
              {[
                { icon: '🔒', title: 'آمن وموثوق',  sub: 'بياناتك في أمان' },
                { icon: '⚡', title: 'بدون تعقيد', sub: 'تجربة سهلة وسريعة' },
                { icon: '🎧', title: 'دعم 24/7',   sub: 'نحن هنا لمساعدتك' },
              ].map((badge, i, arr) => (
                <View key={badge.title} style={{
                  alignItems: 'center', flex: 1,
                  borderRightWidth: !isRTL && i < arr.length - 1 ? 1 : 0,
                  borderLeftWidth:   isRTL && i < arr.length - 1 ? 1 : 0,
                  borderColor: isDark ? colors.border : 'rgba(201,168,76,0.20)',
                }}>
                  <Text style={{ fontSize: 20, marginBottom: 2 }}>{badge.icon}</Text>
                  <Text style={{ fontSize: rs(10, 9, 11), fontWeight: '700', color: colors.textSecondary, textAlign: 'center' }}>{badge.title}</Text>
                  <Text style={{ fontSize: rs(9, 8, 10), color: colors.textMuted, textAlign: 'center' }}>{badge.sub}</Text>
                </View>
              ))}
            </View>
          )}

          {/* CTA button */}
          <TouchableOpacity
            style={{
              backgroundColor: GOLD_COLOR, borderRadius: 16, paddingVertical: 17,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
            onPress={onNext}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: rs(17, 15, 19), fontWeight: '800', color: '#fff' }}>🚀 ابدأ الآن</Text>
            <Text style={{ fontSize: 20, color: '#fff' }}>{isRTL ? '←' : '→'}</Text>
          </TouchableOpacity>

          {/* Legal text */}
          <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 16 }}>
            🔒 باستخدامك للتطبيق، فأنت توافق على الشروط والأحكام وسياسة الخصوصية
          </Text>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

// ── Main Onboarding Screen ────────────────────────────────────

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const { contentPad } = useInsets();

  // Form state
  const { groups } = useCategories();

  const [role, setRole]               = useState<Role>('client');
  const [fullName, setFullName]       = useState('');
  const [city, setCity]               = useState('');
  const [bio, setBio]                 = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [planChoice, setPlanChoice]   = useState<PlanChoice>('trial');
  const [trialUsed, setTrialUsed]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('providers').select('trial_used').eq('id', user.id).single()
        .then(({ data }) => { if (data?.trial_used) setTrialUsed(true); });
    });
  }, []);
  const [done, setDone]               = useState(false);

  // Steps: client = [1,2,5]  provider = [1,2,3,4,5]
  const steps = role === 'provider' ? [1, 2, 3, 4] : [1, 2];
  const [stepIndex, setStepIndex]     = useState(0);
  const currentStep = steps[stepIndex];
  const totalVisual = role === 'provider' ? 4 : 2;

  // Slide animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateNext = (dir: 1 | -1, cb: () => void) => {
    Animated.timing(slideAnim, {
      toValue: -dir * width,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      cb();
      slideAnim.setValue(dir * width);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    // Validate current step
    if (currentStep === 2 && (!fullName.trim() || !city)) {
      Alert.alert(t('common.attention'), t('auth.fillAllFields'));
      return;
    }
    if (currentStep === 3 && selectedCats.length === 0) {
      Alert.alert(t('common.attention'), t('onboarding.selectAtLeastOne'));
      return;
    }

    if (stepIndex < steps.length - 1) {
      animateNext(1, () => setStepIndex(i => i + 1));
    } else {
      handleSubmit();
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      animateNext(-1, () => setStepIndex(i => i - 1));
    }
  };

  // planOverride lets the trial button bypass stale planChoice state
  const handleSubmit = async (planOverride?: PlanChoice) => {
    setSaving(true);
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
      if (!user) { Alert.alert(t('common.error'), t('common.error')); return; }

      // 1. Insert user row
      const { error: userErr } = await supabase.from('users').insert({
        id: user.id,
        role,
        full_name: fullName.trim(),
        phone: user.phone,
        phone_verified: true,
        city,
      });

      if (userErr) {
        if ((userErr as any).code === '23505') {
          Alert.alert(
            t('auth.phoneAlreadyRegistered'),
            t('auth.phoneAlreadyRegisteredMsg'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('auth.goToLogin'), onPress: () => router.replace('/(auth)/login' as any) },
            ]
          );
        } else {
          Alert.alert(t('common.error'), userErr.message);
        }
        return;
      }

      // 2. Insert provider row + activate trial if chosen
      if (role === 'provider') {
        const providerPayload: Record<string, any> = {
          id: user.id,
          categories: selectedCats,
          bio: bio.trim() || null,
        };

        // Only activate trial when provider explicitly chose the trial plan (BUG-014).
        // Providers who select a paid plan go through the payment flow separately.
        const effectivePlanForInsert = planOverride !== undefined ? planOverride : planChoice;
        if (effectivePlanForInsert === 'trial' && !trialUsed) {
          providerPayload.is_subscribed        = true;
          providerPayload.subscription_tier    = 'trial';
          providerPayload.subscription_credits = 10;
          providerPayload.trial_used           = true;
          providerPayload.subscription_ends    = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString();
        }

        const { error: provErr } = await supabase.from('providers').insert(providerPayload);
        if (provErr) {
          Alert.alert(t('common.error'), provErr.message);
          return;
        }

        // Schedule demo request (arrives ~1 hour after registration)
        await supabase.rpc('init_provider_demo', { p_provider_id: user.id });
      }

      // Sync planChoice state so handleExplore routes correctly
      if (planOverride !== undefined) setPlanChoice(planOverride);

      const effectivePlan = planOverride !== undefined ? planOverride : planChoice;
      const isPaid = role === 'provider' && effectivePlan !== 'trial' && effectivePlan !== null;

      // Directly signal _layout.tsx with the real role so the route guard
      // resolves instantly without waiting for onAuthStateChange.
      // For paid plans, pass a redirect target so the guard sends the provider
      // to the subscribe screen instead of the default /(provider) home.
      notifyRoleUpdate(role, isPaid ? `/subscribe?tier=${effectivePlan}` : undefined);

      setDone(true);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleExplore = () => {
    if (role === 'provider' && planChoice !== 'trial' && planChoice !== null) {
      router.replace(`/subscribe?tier=${planChoice}` as any);
    } else {
      router.replace(role === 'provider' ? '/(provider)' : '/(client)');
    }
  };

  // Step 1 — new full-screen design (no header/progress bar)
  if (currentStep === 1) {
    return (
      <Step1RoleNew
        role={role}
        onSelect={r => {
          setRole(r);
          setPlanChoice(r === 'client' ? null : 'trial');
        }}
        onNext={goNext}
      />
    );
  }

  // Done screen
  if (done) {
    return (
      <View style={styles.container}>
        <StepDone role={role} planChoice={planChoice} onExplore={handleExplore} />
      </View>
    );
  }

  const isLastStep = stepIndex === steps.length - 1;
  const canGoBack  = stepIndex > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backBtnText}>{isRTL ? '→' : '←'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <ProgressBar current={stepIndex + 1} total={totalVisual} />
        <View style={{ width: 48 }} />
      </View>

      {/* Step content */}
      <Animated.View style={[styles.animWrap, { transform: [{ translateX: slideAnim }] }]}>
        {currentStep === 1 && (
          <Step1Role role={role} onSelect={r => {
            setRole(r);
            if (r === 'client') setPlanChoice(null);
            else setPlanChoice('trial');
          }} />
        )}
        {currentStep === 2 && (
          <Step2Info
            role={role}
            fullName={fullName} setFullName={setFullName}
            city={city} setCity={setCity}
            bio={bio} setBio={setBio}
          />
        )}
        {currentStep === 3 && (
          <Step3Services
            selectedCats={selectedCats}
            setSelectedCats={setSelectedCats}
            groups={groups}
            onSuggest={() => setShowSuggest(true)}
          />
        )}
        {currentStep === 4 && (
          <Step4Plan
            planChoice={planChoice}
            setPlanChoice={setPlanChoice}
            trialUsed={trialUsed}
            saving={saving}
            onStartFree={() => {
              setPlanChoice('trial');
              handleSubmit('trial');
            }}
          />
        )}
      </Animated.View>

      {/* CTA Button */}
      <View style={[styles.footer, { paddingBottom: contentPad }]}>
        <TouchableOpacity
          style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
          onPress={goNext}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {saving
              ? t('auth.registering')
              : isLastStep
                ? t('auth.createAccount')
                : t('onboarding.nextBtn')}
          </Text>
        </TouchableOpacity>
      </View>

      <SuggestServiceModal visible={showSuggest} onClose={() => setShowSuggest(false)} />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 12 },
  backBtn:     { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 22, color: colors.textSecondary },

  // Progress
  progressWrap:            { flex: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  progressSegment:         { flex: 1, height: 4, borderRadius: 2 },
  progressSegmentActive:   { backgroundColor: colors.accent },
  progressSegmentInactive: { backgroundColor: colors.border },

  // Animated wrapper
  animWrap:  { flex: 1 },

  // Step common
  stepScroll:  { flex: 1 },
  stepContent: { padding: 24, paddingTop: 12 },
  stepTitle:   { fontSize: rs(26, 20, 30), fontWeight: '700', color: colors.textPrimary, marginBottom: 6, alignSelf: 'stretch', textAlign: ta },
  stepSub:     { fontSize: rs(14, 12, 16), color: colors.textMuted, marginBottom: 28, alignSelf: 'stretch', textAlign: ta },

  // Role cards
  roleCards:     { flexDirection: 'row', gap: 12 },
  roleCard:      { flex: 1, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  roleCardInner: { padding: 16, alignItems: 'center' },
  roleEmojiWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12, marginTop: 8 },
  roleEmoji:     { fontSize: 36 },
  roleCardTitle: { fontSize: rs(15, 13, 17), fontWeight: '700', color: colors.textSecondary, marginBottom: 4, textAlign: 'center' },
  roleCardSub:   { fontSize: rs(11, 10, 13), color: colors.textMuted, textAlign: 'center', marginBottom: 12, lineHeight: 16 },
  roleChipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
  roleChip:      { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  roleChipText:  { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  roleCheck:     { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  roleCheckMark: { fontSize: 11, color: '#fff', fontWeight: '800' },

  // Fields
  fieldLabel:      { fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 16, alignSelf: 'stretch' },
  fieldLabelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  fieldLabelOptional: { fontSize: 11, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, color: colors.textPrimary, fontSize: rs(16, 14, 18),
    borderWidth: 1, borderColor: colors.border,
  },
  inputMulti: {
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, color: colors.textPrimary, fontSize: rs(15, 13, 17),
    borderWidth: 1, borderColor: colors.border, minHeight: 100, textAlignVertical: 'top',
  },
  charCount:   { fontSize: 11, color: colors.textMuted, textAlign: 'auto', marginTop: 4 },

  // City chips
  chipsScroll: { marginBottom: 4 },
  chip:        { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
  chipActive:  { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText:    { color: colors.textSecondary, fontSize: 14 },
  chipTextActive: { color: colors.accent },

  // Category grid
  searchInput: {
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, color: colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  groupLabel:  { fontSize: 13, color: colors.textMuted, marginBottom: 10, marginTop: 4, alignSelf: 'stretch' },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  catCard: {
    width: Math.max(80, Math.floor((width - 48 - 20) / 3)),
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  catCardActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  catEmoji:    { fontSize: 22, marginBottom: 6 },
  catName:     { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  catNameActive: { color: colors.accent },
  catCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  catCheckMark: { fontSize: 9, color: colors.bg, fontWeight: '700' },
  selectedBar: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginTop: 4, borderWidth: 1, borderColor: colors.accent },
  selectedBarText: { color: colors.accent, fontSize: 13, textAlign: 'center' },

  // Trial card
  trialCard: {
    backgroundColor: colors.accentDim, borderRadius: 16, padding: 20,
    borderWidth: 2, borderColor: 'rgba(201,168,76,0.30)', marginBottom: 14,
  },
  trialCardActive: { borderColor: colors.accent },
  trialTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  trialBadge:  { fontSize: 12, color: colors.accent, fontWeight: '700' },
  trialTitle:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  trialCredits: { fontSize: 15, color: colors.gold2, marginBottom: 6, fontWeight: '600' },
  trialNote:   { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  trialBtn:         { backgroundColor: 'rgba(201,168,76,0.20)', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  trialBtnActive:   { backgroundColor: colors.accent },
  trialBtnDisabled: { backgroundColor: colors.border },
  trialBtnText:     { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  // Paid plan cards
  planCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 12,
  },
  planCardActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  popularBadge: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-end', marginBottom: 8 },
  popularBadgeText: { fontSize: 11, fontWeight: '700', color: colors.bg },
  planRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLeft:    { flex: 1 },
  planRight:   { alignItems: 'flex-end', gap: 4 },
  planName:    { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  planDesc:    { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  planCredits: { fontSize: 12, color: colors.accent },
  planPrice:   { fontSize: rs(22, 18, 26), fontWeight: '800', color: colors.textPrimary },
  planCurrency:{ fontSize: 12, color: colors.textMuted },
  planRadio:   { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  planRadioActive: { borderColor: colors.accent },
  planRadioDot:{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },

  // Done
  doneContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneEmoji:   { fontSize: rs(64, 48, 80), marginBottom: 24 },
  doneTitle:   { fontSize: rs(26, 20, 30), fontWeight: '700', color: colors.textPrimary, marginBottom: 14, textAlign: 'center', alignSelf: 'stretch' },
  doneSub:     { fontSize: rs(15, 13, 17), color: colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 40, alignSelf: 'stretch' },
  doneBtn:     { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  doneBtnText: { fontSize: rs(17, 15, 19), fontWeight: '700', color: colors.bg },

  // Footer CTA — paddingBottom applied dynamically via contentPad
  footer:      { padding: 24, paddingTop: 12, paddingBottom: 24 },
  nextBtn:     { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: colors.border },
  nextBtnText: { fontSize: rs(17, 15, 19), fontWeight: '700', color: colors.bg },
  });
}
