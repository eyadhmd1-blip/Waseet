// ============================================================
// WASEET — Urgent Request Screen (root-level, no tab bar)
// 2-step fast flow: Category → Details + submit
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SuccessModal } from '../src/components/SuccessModal';
import { SuggestServiceModal } from '../src/components/SuggestServiceModal';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Easing, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { CATEGORY_GROUPS, CATEGORY_PLACEHOLDERS, ICON_MAP } from '../src/constants/categories';
import { useCategories } from '../src/hooks/useCategories';
import type { ServiceCategory } from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { AppHeader } from '../src/components/AppHeader';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

const URGENT_PREMIUM_PCT = 25;
const URGENT_MINUTES     = 60;


// ─── Pulsing siren ───────────────────────────────────────────

function SirenIcon() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 400, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.delay(800),
      ])
    ).start();
  }, []);
  return <Animated.Text style={[styles.sirenEmoji, { transform: [{ scale }] }]}>🚨</Animated.Text>;
}

// ─── Guarantee badge ─────────────────────────────────────────

function GuaranteeBadge() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useLanguage();
  return (
    <View style={styles.guaranteeBadge}>
      <Text style={styles.guaranteeIcon}>⏱️</Text>
      <View>
        <Text style={styles.guaranteeTitle}>{t('urgentRequest.guaranteeTitle', { mins: URGENT_MINUTES })}</Text>
        <Text style={styles.guaranteeSub}>{t('urgentRequest.guaranteeSub')}</Text>
      </View>
    </View>
  );
}

// ─── Confirm modal ───────────────────────────────────────────

function ConfirmModal({
  visible,
  category,
  city,
  description,
  aiMin,
  aiMax,
  onConfirm,
  onCancel,
  loading,
}: {
  visible: boolean;
  category: ServiceCategory | null;
  city: string;
  description: string;
  aiMin?: number;
  aiMax?: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { colors } = useTheme();
  const { t, ta, lang, isRTL } = useLanguage();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const slideY  = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideY.setValue(400);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideY,  { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const premiumMin = aiMin ? Math.round(aiMin * (1 + URGENT_PREMIUM_PCT / 100)) : null;
  const premiumMax = aiMax ? Math.round(aiMax * (1 + URGENT_PREMIUM_PCT / 100)) : null;
  const catName    = category ? (lang === 'ar' ? category.name_ar : category.name_en) : '';

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.modalBackdrop, { opacity }]}>
        <Animated.View style={[styles.confirmSheet, { transform: [{ translateY: slideY }] }]}>
          <Text style={styles.confirmTitle}>{t('urgentRequest.confirmTitle')}</Text>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('urgentRequest.confirmService')}</Text>
            <Text style={styles.confirmValue}>{ICON_MAP[category?.icon ?? ''] ?? '🔧'} {catName}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('urgentRequest.confirmCity')}</Text>
            <Text style={styles.confirmValue}>{city}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('urgentRequest.confirmDesc')}</Text>
            <Text style={[styles.confirmValue, { flex: 0.65 }]} numberOfLines={2}>{description}</Text>
          </View>

          <View style={styles.priceSummary}>
            <Text style={styles.priceSummaryTitle}>{t('urgentRequest.confirmCostTitle')}</Text>
            {premiumMin && premiumMax ? (
              <>
                <View style={styles.priceRow}>
                  <Text style={styles.priceBase}>{t('urgentRequest.confirmBasePrice')}</Text>
                  <Text style={styles.priceBaseVal}>{aiMin}–{aiMax} {t('common.jod')}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.pricePremium}>{t('urgentRequest.confirmPremiumFee', { pct: URGENT_PREMIUM_PCT })}</Text>
                  <Text style={styles.pricePremiumVal}>
                    +{Math.round((aiMin ?? 0) * URGENT_PREMIUM_PCT / 100)}–
                    {Math.round((aiMax ?? 0) * URGENT_PREMIUM_PCT / 100)} {t('common.jod')}
                  </Text>
                </View>
                <View style={[styles.priceRow, styles.priceTotalRow]}>
                  <Text style={styles.priceTotalLabel}>{t('urgentRequest.confirmTotal')}</Text>
                  <Text style={styles.priceTotalVal}>{premiumMin}–{premiumMax} {t('common.jod')}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.priceNA}>
                {t('urgentRequest.confirmNAPrice', { pct: URGENT_PREMIUM_PCT })}
              </Text>
            )}
          </View>

          <GuaranteeBadge />

          <View style={styles.confirmBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.urgentSubmitBtn, loading && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.urgentSubmitBtnText}>{t('urgentRequest.confirmSubmitBtn')}</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function UrgentRequestScreen() {
  const { colors } = useTheme();
  const { t, lang, isRTL } = useLanguage();
  const ta = isRTL ? 'right' : 'left' as const;
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const router = useRouter();

  const { groups } = useCategories();

  const [step, setStep]               = useState<1 | 2>(1);
  const [selectedCat, setSelectedCat] = useState<ServiceCategory | null>(null);
  const [activeGroup, setActiveGroup] = useState('maintenance');
  const [showSuggest, setShowSuggest] = useState(false);
  const [description, setDescription] = useState('');
  const [city, setCity]               = useState('');
  const [aiMin, setAiMin]             = useState<number | undefined>();
  const [aiMax, setAiMax]             = useState<number | undefined>();
  const [aiLoading, setAiLoading]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('users').select('city').eq('id', user.id).single()
        .then(({ data }) => { if (data?.city) setCity(data.city); });
    });
  }, []);

  const goToStep = useCallback((target: 1 | 2) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setStep(target);
      slideAnim.setValue(target === 2 ? 20 : -20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const handleSelectCat = (cat: ServiceCategory) => {
    setSelectedCat(cat);
    goToStep(2);
  };

  const fetchAiPrice = useCallback(async (cat: ServiceCategory, desc: string) => {
    if (!desc.trim() || desc.length < 10) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-price-suggest', {
        body: { category: cat.slug, description: desc.trim() },
      });
      if (!error && data?.min && data?.max) { setAiMin(data.min); setAiMax(data.max); }
    } catch { /* non-blocking */ }
    finally { setAiLoading(false); }
  }, []);

  const handleReview = () => {
    if (description.trim().length < 10) {
      Alert.alert(t('common.attention'), t('urgentRequest.descTooShort'));
      return;
    }
    fetchAiPrice(selectedCat!, description);
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
      if (!user) return;

      // Check request limits before submission
      const { data: limitResult } = await supabase.rpc('check_request_limits', {
        p_client_id:     user.id,
        p_category_slug: selectedCat!.slug,
      });
      if (limitResult === 'TOTAL_LIMIT' || limitResult === 'CATEGORY_LIMIT') {
        Alert.alert(
          t('common.attention'),
          limitResult === 'TOTAL_LIMIT'
            ? t('requests.errTotalLimit')
            : t('requests.errCategoryLimit')
        );
        return;
      }

      const expiresAt = new Date(Date.now() + URGENT_MINUTES * 60 * 1000).toISOString();

      const { data: req, error } = await supabase.from('requests').insert({
        client_id:              user.id,
        category_slug:          selectedCat!.slug,
        title:                  `طارئ: ${selectedCat!.name_ar}`,
        description:            description.trim(),
        city,
        image_urls:             [],
        ai_suggested_price_min: aiMin ?? null,
        ai_suggested_price_max: aiMax ?? null,
        ai_suggested_currency:  'JOD',
        status:                 'open',
        is_urgent:              true,
        urgent_premium_pct:     URGENT_PREMIUM_PCT,
        urgent_expires_at:      expiresAt,
      }).select('id').single();

      if (error) throw error;

      supabase.functions.invoke('notify-urgent', {
        body: { request_id: req!.id, city, category_slug: selectedCat!.slug },
      }).catch(() => {});

      setShowConfirm(false);
      setShowSuccess(true);
    } catch {
      Alert.alert(t('common.error'), t('urgentRequest.errSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppHeader
        variant="modal"
        title={t('urgentRequest.title')}
        onClose={() => step === 1 ? router.back() : goToStep(1)}
        step={step}
        totalSteps={2}
      />

      {/* ── Step content ── */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* Step 1: Category */}
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.stepHint}>{t('urgentRequest.step1Hint')}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
              {groups.map(g => (
                <TouchableOpacity
                  key={g.slug}
                  style={[styles.groupChip, activeGroup === g.slug && styles.groupChipActive]}
                  onPress={() => setActiveGroup(g.slug)}
                >
                  <Text style={[styles.groupChipText, activeGroup === g.slug && styles.groupChipTextActive]}>
                    {lang === 'ar' ? g.name_ar : g.name_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.catGrid}>
              {groups.find(g => g.slug === activeGroup)?.categories.map(cat => (
                <TouchableOpacity
                  key={cat.slug}
                  style={[styles.catCard, selectedCat?.slug === cat.slug && styles.catCardActive]}
                  onPress={() => handleSelectCat(cat)}
                  activeOpacity={0.72}
                >
                  <Text style={styles.catIcon}>{ICON_MAP[cat.icon] ?? '🔧'}</Text>
                  <Text style={styles.catName}>{lang === 'ar' ? cat.name_ar : cat.name_en}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.suggestBtn} onPress={() => setShowSuggest(true)}>
              <Text style={styles.suggestBtnText}>{t('suggestions.notFound')}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Step 2: Describe */}
        {step === 2 && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity style={styles.catBadge} onPress={() => goToStep(1)}>
              <Text style={styles.catBadgeText}>
                {ICON_MAP[selectedCat?.icon ?? ''] ?? '🔧'}  {lang === 'ar' ? selectedCat?.name_ar : selectedCat?.name_en}
              </Text>
              <Text style={styles.catBadgeChange}>{t('newRequest.changeCategory')}</Text>
            </TouchableOpacity>

            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>
                {city || t('urgentRequest.detectingLocation')}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>{t('urgentRequest.fieldDescLabel')}</Text>
            <TextInput
              style={styles.descInput}
              placeholder={
                (lang === 'ar'
                  ? CATEGORY_PLACEHOLDERS[selectedCat?.slug ?? '']?.desc_ar
                  : CATEGORY_PLACEHOLDERS[selectedCat?.slug ?? '']?.desc_en)
                ?? t('urgentRequest.descPlaceholder')
              }
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              textAlign={ta}
              multiline
              numberOfLines={4}
              maxLength={200}
              autoFocus
            />
            <Text style={styles.charCount}>{description.length}/200</Text>

            {(aiMin || aiLoading) && (
              <View style={styles.aiPreview}>
                {aiLoading
                  ? <ActivityIndicator color={colors.accent} size="small" />
                  : <Text style={styles.aiPreviewText}>
                      {t('urgentRequest.aiPricePreview', { min: aiMin, max: aiMax })}
                      {'  '}
                      <Text style={styles.aiPremiumText}>
                        {t('urgentRequest.aiPremiumHint', {
                          pct: URGENT_PREMIUM_PCT,
                          min: Math.round((aiMin ?? 0) * 1.25),
                          max: Math.round((aiMax ?? 0) * 1.25),
                        })}
                      </Text>
                    </Text>
                }
              </View>
            )}

            <GuaranteeBadge />

            <TouchableOpacity
              style={[styles.urgentBtn, description.trim().length < 10 && styles.btnDisabled]}
              onPress={handleReview}
              disabled={description.trim().length < 10}
              activeOpacity={0.85}
            >
              <Text style={styles.urgentBtnText}>{t('urgentRequest.reviewBtn')}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>

      <ConfirmModal
        visible={showConfirm}
        category={selectedCat}
        city={city}
        description={description}
        aiMin={aiMin}
        aiMax={aiMax}
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
        loading={submitting}
      />
      <SuggestServiceModal visible={showSuggest} onClose={() => setShowSuggest(false)} />
      <SuccessModal
        visible={showSuccess}
        title={t('urgentRequest.successTitle')}
        subtitle={t('urgentRequest.successMsg', { mins: URGENT_MINUTES })}
        hint="سنقوم بإشعارك عند وصول أي عرض"
        primaryLabel="عرض طلباتي"
        secondaryLabel="حسناً"
        onPrimary={() => { setShowSuccess(false); router.replace('/(client)/requests'); }}
        onSecondary={() => { setShowSuccess(false); router.replace('/(client)'); }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

function createStyles(colors: AppColors, isRTL: boolean = false) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  sirenEmoji:{ fontSize: 22 },
  stepDots:  { flexDirection: 'row', gap: 6 },
  stepDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  stepDotActive: { backgroundColor: '#EF4444' },

  scrollContent: { padding: 20, paddingBottom: 48 },
  stepHint:      { fontSize: 15, fontWeight: '600', color: colors.textSecondary, marginBottom: 16, alignSelf: 'stretch', textAlign: ta },

  groupScroll:         { marginBottom: 16 },
  groupChip:           { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
  groupChipActive:     { borderColor: '#EF4444', backgroundColor: '#450A0A' },
  groupChipText:       { color: colors.textSecondary, fontSize: 13 },
  groupChipTextActive: { color: '#EF4444', fontWeight: '600' },

  catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard:       { width: '30%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  catCardActive: { borderColor: '#EF4444', backgroundColor: '#450A0A' },
  catIcon:       { fontSize: 28, marginBottom: 6 },
  catName:       { fontSize: 11, color: colors.textSecondary, textAlign: 'center', fontWeight: '500' },

  catBadge:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#450A0A', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#7F1D1D', marginBottom: 14 },
  catBadgeText:   { fontSize: 15, color: '#FCA5A5', fontWeight: '600' },
  catBadgeChange: { fontSize: 13, color: colors.textMuted },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  locationIcon:{ fontSize: 16 },
  locationText:{ fontSize: 14, color: colors.textSecondary, flex: 1, alignSelf: 'stretch', textAlign: ta },

  fieldLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, alignSelf: 'stretch', textAlign: ta },
  descInput:  { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: '#7F1D1D', textAlignVertical: 'top', height: 120, textAlign: ta },
  charCount:  { fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 16, alignSelf: 'stretch', textAlign: ta },

  aiPreview:     { backgroundColor: colors.infoBg, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.info },
  aiPreviewText: { fontSize: 13, color: colors.infoSoft, alignSelf: 'stretch', textAlign: ta },
  aiPremiumText: { color: colors.errorSoft, fontWeight: '700' },

  guaranteeBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.successBg, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.success },
  guaranteeIcon:  { fontSize: 22 },
  guaranteeTitle: { fontSize: 13, fontWeight: '700', color: colors.successSoft, textAlign: 'auto' },
  guaranteeSub:   { fontSize: 11, color: colors.success, textAlign: 'auto', marginTop: 2 },

  urgentBtn:     { backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 17, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  urgentBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  btnDisabled:   { backgroundColor: colors.border, shadowOpacity: 0 },

  modalBackdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  confirmSheet:  { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  confirmTitle:  { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 20, alignSelf: 'stretch', textAlign: ta },

  confirmRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  confirmLabel: { fontSize: 13, color: colors.textMuted, flex: 0.35 },
  confirmValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', flex: 0.65, textAlign: 'auto' },

  priceSummary:      { backgroundColor: colors.accentDim, borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)' },
  priceSummaryTitle: { fontSize: 12, color: colors.textMuted, marginBottom: 10, alignSelf: 'stretch', textAlign: ta },
  priceRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  priceBase:         { fontSize: 13, color: colors.textSecondary },
  priceBaseVal:      { fontSize: 13, color: colors.textSecondary },
  pricePremium:      { fontSize: 13, color: '#FCA5A5' },
  pricePremiumVal:   { fontSize: 13, color: '#FCA5A5' },
  priceTotalRow:     { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 },
  priceTotalLabel:   { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  priceTotalVal:     { fontSize: 14, fontWeight: '700', color: colors.accent },
  priceNA:           { fontSize: 13, color: colors.textMuted, alignSelf: 'stretch', textAlign: ta },

  confirmBtns:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:           { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelBtnText:       { fontSize: 15, color: colors.textSecondary },
  urgentSubmitBtn:     { flex: 2, backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  urgentSubmitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  suggestBtn:     { marginTop: 20, paddingVertical: 14, alignItems: 'center' as const, borderTopWidth: 1, borderTopColor: colors.border },
  suggestBtnText: { fontSize: 13, color: colors.textMuted },
  });
}
