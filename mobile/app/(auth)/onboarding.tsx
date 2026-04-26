// ============================================================
// WASEET — Onboarding Screen (multi-step)
// Steps: 1-Role → 2-Info → [3-Services (provider)] → [4-Plan (provider)] → 5-Done
// ============================================================

import { useState, useRef, useEffect, useMemo} from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { notifyRoleUpdate } from '../../src/lib/authEvents';
import { JORDAN_CITIES, SUBSCRIPTION_PLANS } from '../../src/constants/categories';
import { useCategories } from '../../src/hooks/useCategories';
import { SuggestServiceModal } from '../../src/components/SuggestServiceModal';
import { useLanguage } from '../../src/hooks/useLanguage';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD, rs } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

const { width } = Dimensions.get('window');

// Icon map matching provider profile
const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚', moon: '🌙',
  'pen-tool': '✏️', car: '🚗', battery: '🔋', gauge: '⚙️', snowflake: '❄️',
  shield: '🛡️', droplet: '💧',
};

type Role = 'client' | 'provider';
type PlanChoice = 'trial' | 'basic' | 'pro' | 'premium' | null;

// ── Progress Bar ─────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pct = (current / total) * 100;
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

function Step1Role({
  role, onSelect,
}: { role: Role; onSelect: (r: Role) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, ta } = useLanguage();
  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('onboarding.step1Title')}</Text>
      <Text style={[styles.stepSub, { textAlign: ta }]}>{t('onboarding.step1Sub')}</Text>

      <View style={styles.roleCards}>
        <TouchableOpacity
          style={[styles.roleCard, role === 'client' && styles.roleCardActive]}
          onPress={() => onSelect('client')}
          activeOpacity={0.8}
        >
          <Text style={styles.roleEmoji}>👤</Text>
          <Text style={[styles.roleCardTitle, role === 'client' && styles.roleCardTitleActive]}>
            {t('onboarding.clientCardTitle')}
          </Text>
          <Text style={styles.roleCardSub}>{t('onboarding.clientCardSub')}</Text>
          <View style={[styles.roleCheck, role === 'client' && styles.roleCheckActive]}>
            {role === 'client' && <Text style={styles.roleCheckMark}>✓</Text>}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, role === 'provider' && styles.roleCardActive]}
          onPress={() => onSelect('provider')}
          activeOpacity={0.8}
        >
          <Text style={styles.roleEmoji}>🔧</Text>
          <Text style={[styles.roleCardTitle, role === 'provider' && styles.roleCardTitleActive]}>
            {t('onboarding.providerCardTitle')}
          </Text>
          <Text style={styles.roleCardSub}>{t('onboarding.providerCardSub')}</Text>
          <View style={[styles.roleCheck, role === 'provider' && styles.roleCheckActive]}>
            {role === 'provider' && <Text style={styles.roleCheckMark}>✓</Text>}
          </View>
        </TouchableOpacity>
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, ta } = useLanguage();

  return (
    <ScrollView style={styles.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('onboarding.step2Title')}</Text>
        <Text style={[styles.stepSub, { textAlign: ta }]}>{t('onboarding.step2Sub')}</Text>

        {/* Full name */}
        <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('auth.fullName')} *</Text>
        <TextInput
          style={[styles.input, { textAlign: ta }]}
          placeholder={t('auth.fullNamePlaceholder')}
          placeholderTextColor="#475569"
          value={fullName}
          onChangeText={setFullName}
        />

        {/* City */}
        <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('auth.city')} *</Text>
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
              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('onboarding.bioLabel')}</Text>
            </View>
            <TextInput
              style={[styles.inputMulti, { textAlign: ta }]}
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, ta } = useLanguage();
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
        <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('onboarding.step3Title')}</Text>
        <Text style={[styles.stepSub, { textAlign: ta }]}>{t('onboarding.step3Sub')}</Text>

        {/* Search */}
        <TextInput
          style={[styles.searchInput, { textAlign: ta }]}
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
              <Text style={[styles.groupLabel, { textAlign: ta }]}>
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, ta } = useLanguage();

  const creditsDesc: Record<string, string> = {
    basic:   t('onboarding.creditsDesc_basic'),
    pro:     t('onboarding.creditsDesc_pro'),
    premium: t('onboarding.creditsDesc_premium'),
  };

  return (
    <ScrollView style={styles.stepScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('onboarding.step4Title')}</Text>
        <Text style={[styles.stepSub, { textAlign: ta }]}>{t('onboarding.step4Sub')}</Text>

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
                      : t('subscribe.creditsLabel', { count: plan.bid_credits })}
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, ta, isRTL } = useLanguage();

  const subText = role === 'client'
    ? t('onboarding.doneSubClient')
    : planChoice === 'trial'
      ? t('onboarding.doneSubProvider', { count: 10 })
      : t('onboarding.doneSubProviderPaid');

  return (
    <ScrollView contentContainerStyle={[styles.stepContent, styles.doneContent]} showsVerticalScrollIndicator={false}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={[styles.doneTitle, { textAlign: ta }]}>{t('onboarding.doneTitle')}</Text>
      <Text style={[styles.doneSub, { textAlign: ta }]}>{subText}</Text>
      <TouchableOpacity style={styles.doneBtn} onPress={onExplore} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>{t('onboarding.exploreCTA')} {isRTL ? '←' : '→'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Main Onboarding Screen ────────────────────────────────────

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { t, ta, isRTL } = useLanguage();
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
    const finalPlan = planOverride !== undefined ? planOverride : planChoice;
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

        if (finalPlan === 'trial') {
          providerPayload.is_subscribed     = true;
          providerPayload.subscription_tier = 'trial';
          providerPayload.bid_credits       = 10;
          providerPayload.trial_used        = true;
          providerPayload.subscription_ends = new Date(
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

      // Directly signal _layout.tsx with the real role so the route guard
      // resolves instantly without waiting for onAuthStateChange / refreshSession.
      notifyRoleUpdate(role);

      // Also refresh session in the background so onAuthStateChange eventually
      // catches up (push token registration, etc.).
      supabase.auth.refreshSession().catch(() => {});

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

function createStyles(colors: AppColors) {
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
  stepTitle:   { fontSize: rs(26, 20, 30), fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  stepSub:     { fontSize: rs(14, 12, 16), color: colors.textMuted, marginBottom: 28 },

  // Role cards
  roleCards:       { gap: 14 },
  roleCard:        { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: colors.border },
  roleCardActive:  { borderColor: colors.accent, backgroundColor: colors.accentDim },
  roleEmoji:       { fontSize: rs(32, 26, 38), marginBottom: 10 },
  roleCardTitle:   { fontSize: rs(18, 15, 20), fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  roleCardTitleActive: { color: colors.accent },
  roleCardSub:     { fontSize: rs(13, 11, 15), color: colors.textMuted },
  roleCheck:       { position: 'absolute', top: 16, left: 16, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  roleCheckActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  roleCheckMark:   { fontSize: 12, color: colors.bg, fontWeight: '700' },

  // Fields
  fieldLabel:      { fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
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
  groupLabel:  { fontSize: 13, color: colors.textMuted, marginBottom: 10, marginTop: 4 },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  catCard: {
    width: Math.max(80, Math.floor((width - 48 - 10) / 3)),
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
  doneTitle:   { fontSize: rs(26, 20, 30), fontWeight: '700', color: colors.textPrimary, marginBottom: 14, textAlign: 'center' },
  doneSub:     { fontSize: rs(15, 13, 17), color: colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  doneBtn:     { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  doneBtnText: { fontSize: rs(17, 15, 19), fontWeight: '700', color: colors.bg },

  // Footer CTA — paddingBottom applied dynamically via contentPad
  footer:      { padding: 24, paddingTop: 12, paddingBottom: 24 },
  nextBtn:     { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: colors.border },
  nextBtnText: { fontSize: rs(17, 15, 19), fontWeight: '700', color: colors.bg },
  });
}
