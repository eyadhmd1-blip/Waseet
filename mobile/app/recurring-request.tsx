// ============================================================
// WASEET — Recurring Request Wizard (4 steps)
// Root-level screen so no tab bar shows.
// Color identity: Teal #10B981
// ============================================================

import { useState, useRef, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { CATEGORY_GROUPS, JORDAN_CITIES } from '../src/constants/categories';
import {
  RecurrenceFrequency, FREQ_VISITS_PER_MONTH,
} from '../src/types';
import type { ServiceCategory } from '../src/types';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
import type { AppColors } from '../src/constants/colors';

const CONTRACT_COLOR = '#10B981';
const CONTRACT_DIM   = '#10B98122';

type Step = 1 | 2 | 3 | 4;

const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚',
  moon: '🌙', 'pen-tool': '✏️', car: '🚗', shield: '🛡️', droplet: '💧',
};

// Duration option months — labels built with t() in component
const DURATION_MONTHS: (3 | 6 | 12)[] = [3, 6, 12];

// ─── Progress Bar ─────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const { colors } = useTheme();
  const prog = useMemo(() => createProg(colors), [colors]);
  const { t } = useLanguage();
  const STEP_LABELS: Record<Step, string> = {
    1: t('recurringRequest.stepLabel1'),
    2: t('recurringRequest.stepLabel2'),
    3: t('recurringRequest.stepLabel3'),
    4: t('recurringRequest.stepLabel4'),
  };
  return (
    <View style={prog.wrap}>
      {([1,2,3,4] as Step[]).map(s => (
        <View key={s} style={prog.item}>
          <View style={[prog.dot, step >= s && prog.dotActive, step === s && prog.dotCurrent]}>
            {step > s
              ? <Text style={prog.check}>✓</Text>
              : <Text style={[prog.num, step === s && prog.numActive]}>{s}</Text>
            }
          </View>
          <Text style={[prog.label, step >= s && prog.labelActive]}>{STEP_LABELS[s]}</Text>
          {s < 4 && <View style={[prog.line, step > s && prog.lineActive]} />}
        </View>
      ))}
    </View>
  );
}

function createProg(colors: AppColors) {
  return StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16 },
  item:        { flex: 1, alignItems: 'center', position: 'relative' },
  dot:         { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dotActive:   { borderColor: CONTRACT_COLOR },
  dotCurrent:  { backgroundColor: CONTRACT_COLOR },
  num:         { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  numActive:   { color: '#fff' },
  check:       { fontSize: 12, color: CONTRACT_COLOR, fontWeight: '700' },
  label:       { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  labelActive: { color: CONTRACT_COLOR, fontWeight: '600' },
  line:        { position: 'absolute', top: 14, right: -'50%' as any, width: '100%', height: 2, backgroundColor: colors.border, zIndex: -1 },
  lineActive:  { backgroundColor: CONTRACT_COLOR },
  });
}

// ─── Main component ───────────────────────────────────────────

export default function RecurringRequestScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep]           = useState<Step>(1);
  const [activeGroup, setActiveGroup] = useState('maintenance');

  const [selectedCat, setSelectedCat] = useState<ServiceCategory | null>(null);
  const [frequency, setFrequency]     = useState<RecurrenceFrequency>('monthly');
  const [preferredDay, setPreferredDay] = useState<number | null>(null);
  const [timeWindow, setTimeWindow]   = useState<string>('flexible');
  const [city, setCity]               = useState('');
  const [durationMonths, setDurationMonths] = useState<3 | 6 | 12>(3);
  const [notes, setNotes]             = useState('');
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const slideIn = () => {
    slideAnim.setValue(30);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 8 }).start();
  };

  const goNext = (n: Step) => { setStep(n); slideIn(); };
  const goBack = () => { if (step > 1) { setStep((step - 1) as Step); slideIn(); } else router.back(); };

  const handleSelectCat = (cat: ServiceCategory) => {
    setSelectedCat(cat);
    goNext(2);
  };

  const handleStep2Continue = () => {
    if (!city) { Alert.alert(t('common.attention'), t('recurringRequest.errCityRequired')); return; }
    goNext(3);
  };

  const handleStep3Continue = () => {
    if (!title.trim()) { Alert.alert(t('common.attention'), t('recurringRequest.errTitleRequired')); return; }
    if (!description.trim() || description.length < 20) {
      Alert.alert(t('common.attention'), t('recurringRequest.errDescRequired'));
      return;
    }
    goNext(4);
  };

  const handleSubmit = async () => {
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const authUser = _ses?.user;
    if (!authUser || !selectedCat) return;

    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from('recurring_contracts')
        .insert({
          client_id:             authUser.id,
          category_slug:         selectedCat.slug,
          title:                 title.trim(),
          description:           description.trim(),
          city,
          frequency,
          preferred_day:         preferredDay,
          preferred_time_window: timeWindow,
          duration_months:       durationMonths,
          notes:                 notes.trim() || null,
          status:                'bidding',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Fire-and-forget: notify matching providers
      if (inserted?.id) {
        supabase.functions.invoke('notify-contract', {
          body: { contract_id: inserted.id, city, category_slug: selectedCat.slug },
        }).catch(() => {});
      }

      Alert.alert(
        t('recurringRequest.successTitle'),
        t('recurringRequest.successMsg'),
        [{ text: t('common.confirm'), onPress: () => router.replace('/(client)') }]
      );
    } catch {
      Alert.alert(t('common.error'), t('recurringRequest.errSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const totalVisits = FREQ_VISITS_PER_MONTH[frequency] * durationMonths;
  const catIcon     = selectedCat ? (ICON_MAP[selectedCat.icon] ?? '🔧') : '🔧';
  const catName     = selectedCat ? (lang === 'ar' ? selectedCat.name_ar : selectedCat.name_en) : '';

  // Translated freq label
  const freqLabel = (f: RecurrenceFrequency) => {
    if (f === 'weekly')   return t('recurringRequest.weekly');
    if (f === 'biweekly') return t('recurringRequest.biweekly');
    return t('recurringRequest.monthly');
  };

  // Translated time window label
  const timeLabel = (key: string) => {
    const map: Record<string, string> = {
      morning:   t('recurringRequest.morningWithTime'),
      afternoon: t('recurringRequest.afternoonWithTime'),
      evening:   t('recurringRequest.eveningWithTime'),
      flexible:  t('recurringRequest.flexible'),
    };
    return map[key] ?? key;
  };

  // Day labels
  const dayLabels = [
    t('recurringRequest.day0'), t('recurringRequest.day1'), t('recurringRequest.day2'),
    t('recurringRequest.day3'), t('recurringRequest.day4'), t('recurringRequest.day5'),
    t('recurringRequest.day6'),
  ];

  // Duration options
  const durationOptions: { months: 3 | 6 | 12; label: string; sub: string; discount: string }[] = [
    { months: 3,  label: t('recurringRequest.dur3Label'),  sub: t('recurringRequest.dur3Sub'),  discount: '' },
    { months: 6,  label: t('recurringRequest.dur6Label'),  sub: t('recurringRequest.dur6Sub'),  discount: t('recurringRequest.dur5pct') },
    { months: 12, label: t('recurringRequest.dur12Label'), sub: t('recurringRequest.dur12Sub'), discount: t('recurringRequest.dur10pct') },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t('recurringRequest.headerBadge')}</Text>
          </View>
          <Text style={styles.headerTitle}>{t('recurringRequest.headerTitle')}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ProgressBar step={step} />

      <Animated.View style={[styles.content, { transform: [{ translateY: slideAnim }] }]}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ═══════════════ STEP 1: Category ═══════════════ */}
          {step === 1 && (
            <View>
              <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('recurringRequest.step1Title')}</Text>
              <Text style={[styles.stepSub, { textAlign: ta }]}>{t('recurringRequest.step1Sub')}</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
                {CATEGORY_GROUPS.map(g => (
                  <TouchableOpacity
                    key={g.slug}
                    style={[styles.groupTab, activeGroup === g.slug && styles.groupTabActive]}
                    onPress={() => setActiveGroup(g.slug)}
                  >
                    <Text style={[styles.groupTabText, activeGroup === g.slug && styles.groupTabTextActive]}>
                      {lang === 'ar' ? g.name_ar : g.name_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.catGrid}>
                {(CATEGORY_GROUPS.find(g => g.slug === activeGroup)?.categories ?? []).map(cat => (
                  <TouchableOpacity
                    key={cat.slug}
                    style={[styles.catCard, selectedCat?.slug === cat.slug && styles.catCardActive]}
                    onPress={() => handleSelectCat(cat)}
                  >
                    <Text style={styles.catIcon}>{ICON_MAP[cat.icon] ?? '🔧'}</Text>
                    <Text style={[styles.catName, selectedCat?.slug === cat.slug && styles.catNameActive]} numberOfLines={2}>
                      {lang === 'ar' ? cat.name_ar : cat.name_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ═══════════════ STEP 2: Schedule ═══════════════ */}
          {step === 2 && (
            <View>
              <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('recurringRequest.step2Title')}</Text>
              <Text style={[styles.stepSub, { textAlign: ta }]}>{t('recurringRequest.step2Sub')}</Text>

              <View style={styles.catSummary}>
                <Text style={styles.catSummaryIcon}>{catIcon}</Text>
                <Text style={styles.catSummaryName}>{catName}</Text>
              </View>

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('recurringRequest.freqLabel')}</Text>
              <View style={styles.freqRow}>
                {(['weekly','biweekly','monthly'] as RecurrenceFrequency[]).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                    onPress={() => setFrequency(f)}
                  >
                    <Text style={[styles.freqChipText, frequency === f && styles.freqChipTextActive]}>
                      {freqLabel(f)}
                    </Text>
                    <Text style={[styles.freqChipSub, frequency === f && styles.freqChipSubActive]}>
                      {t('recurringRequest.freqVisits', { count: FREQ_VISITS_PER_MONTH[f] })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>
                {t('recurringRequest.dayLabel')}{' '}
                <Text style={styles.optionalTag}>({t('common.optional')})</Text>
              </Text>
              <View style={styles.dayRow}>
                {dayLabels.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayBtn, preferredDay === i && styles.dayBtnActive]}
                    onPress={() => setPreferredDay(preferredDay === i ? null : i)}
                  >
                    <Text style={[styles.dayBtnText, preferredDay === i && styles.dayBtnTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('recurringRequest.timeLabel')}</Text>
              <View style={styles.timeRow}>
                {['morning','afternoon','evening','flexible'].map(key => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.timeChip, timeWindow === key && styles.timeChipActive]}
                    onPress={() => setTimeWindow(key)}
                  >
                    <Text style={[styles.timeChipText, timeWindow === key && styles.timeChipTextActive]}>
                      {timeLabel(key)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('recurringRequest.cityLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll}>
                {JORDAN_CITIES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.cityChip, city === c && styles.cityChipActive]}
                    onPress={() => setCity(c)}
                  >
                    <Text style={[styles.cityChipText, city === c && styles.cityChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.nextBtn} onPress={handleStep2Continue}>
                <Text style={styles.nextBtnText}>{t('recurringRequest.nextBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════════════ STEP 3: Duration & Details ═══════════════ */}
          {step === 3 && (
            <View>
              <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('recurringRequest.step3Title')}</Text>
              <Text style={[styles.stepSub, { textAlign: ta }]}>{t('recurringRequest.step3Sub')}</Text>

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('recurringRequest.durationLabel')}</Text>
              <View style={styles.durationRow}>
                {durationOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.months}
                    style={[styles.durationCard, durationMonths === opt.months && styles.durationCardActive]}
                    onPress={() => setDurationMonths(opt.months)}
                  >
                    <Text style={[styles.durationMonths, durationMonths === opt.months && styles.durationTextActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.durationSub, durationMonths === opt.months && styles.durationSubActive]}>
                      {opt.sub}
                    </Text>
                    {opt.discount ? (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{opt.discount}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.visitSummaryCard}>
                <Text style={[styles.visitSummaryTitle, { textAlign: ta }]}>{t('recurringRequest.visitSummaryTitle')}</Text>
                <View style={styles.visitSummaryRow}>
                  <Text style={styles.visitSummaryValue}>{totalVisits}</Text>
                  <Text style={styles.visitSummaryLabel}>{t('recurringRequest.visitSummaryTotal')}</Text>
                </View>
                <View style={styles.visitSummaryRow}>
                  <Text style={styles.visitSummaryValue}>{freqLabel(frequency)}</Text>
                  <Text style={styles.visitSummaryLabel}>{t('recurringRequest.visitSummaryFreq')}</Text>
                </View>
                <View style={styles.visitSummaryRow}>
                  <Text style={styles.visitSummaryValue}>{t('recurringRequest.durationMonths', { count: durationMonths })}</Text>
                  <Text style={styles.visitSummaryLabel}>{t('recurringRequest.visitSummaryDuration')}</Text>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('recurringRequest.titleLabel')}</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('recurringRequest.titlePlaceholder', { service: catName, freq: freqLabel(frequency) })}
                placeholderTextColor={colors.textMuted}
                textAlign={ta}
                maxLength={80}
              />

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>{t('recurringRequest.descLabel')}</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('recurringRequest.descPlaceholder')}
                placeholderTextColor={colors.textMuted}
                textAlign={ta}
                multiline
                numberOfLines={4}
                maxLength={600}
              />

              <Text style={[styles.fieldLabel, { textAlign: ta }]}>
                {t('recurringRequest.notesLabel')}{' '}
                <Text style={styles.optionalTag}>({t('common.optional')})</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('recurringRequest.notesPlaceholder')}
                placeholderTextColor={colors.textMuted}
                textAlign={ta}
                multiline
                numberOfLines={2}
                maxLength={300}
              />

              <TouchableOpacity style={styles.nextBtn} onPress={handleStep3Continue}>
                <Text style={styles.nextBtnText}>{t('recurringRequest.reviewContractBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══════════════ STEP 4: Review & Submit ═══════════════ */}
          {step === 4 && (
            <View>
              <Text style={[styles.stepTitle, { textAlign: ta }]}>{t('recurringRequest.step4Title')}</Text>
              <Text style={[styles.stepSub, { textAlign: ta }]}>{t('recurringRequest.step4Sub')}</Text>

              <View style={styles.heroCard}>
                <Text style={styles.heroIcon}>{catIcon}</Text>
                <Text style={styles.heroTitle}>{title}</Text>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>🔄 {freqLabel(frequency)}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>📅 {t('recurringRequest.durationMonths', { count: durationMonths })}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>🏙️ {city}</Text>
                  </View>
                </View>
                <View style={styles.heroVisits}>
                  <Text style={styles.heroVisitsNum}>{totalVisits}</Text>
                  <Text style={styles.heroVisitsLabel}>{t('recurringRequest.totalVisitsLabel')}</Text>
                </View>
              </View>

              <View style={styles.reviewCard}>
                <ReviewRow label={t('recurringRequest.reviewService')} value={catName} />
                <ReviewRow label={t('recurringRequest.reviewCity')} value={city} />
                <ReviewRow label={t('recurringRequest.reviewFreq')} value={freqLabel(frequency)} />
                {preferredDay !== null && (
                  <ReviewRow label={t('recurringRequest.reviewDay')} value={dayLabels[preferredDay]} />
                )}
                <ReviewRow label={t('recurringRequest.reviewTime')} value={timeLabel(timeWindow)} />
                <ReviewRow
                  label={t('recurringRequest.reviewDuration')}
                  value={t('recurringRequest.reviewDurationValue', { count: durationMonths, visits: totalVisits })}
                />
                {notes.trim() && (
                  <ReviewRow label={t('recurringRequest.reviewNotes')} value={notes.trim()} />
                )}
              </View>

              <View style={styles.descCard}>
                <Text style={[styles.descLabel, { textAlign: ta }]}>{t('recurringRequest.descLabel')}</Text>
                <Text style={[styles.descText, { textAlign: ta }]}>{description}</Text>
              </View>

              <View style={styles.trustRow}>
                <View style={styles.trustBadge}>
                  <Text style={styles.trustIcon}>🤝</Text>
                  <Text style={styles.trustText}>{t('recurringRequest.trustText1')}</Text>
                </View>
                <View style={styles.trustBadge}>
                  <Text style={styles.trustIcon}>🛡️</Text>
                  <Text style={styles.trustText}>{t('recurringRequest.trustText2')}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>{t('recurringRequest.submitBtn')}</Text>
                }
              </TouchableOpacity>

              <Text style={styles.submitHint}>{t('recurringRequest.submitHint')}</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Review Row sub-component ─────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const rrStyles = useMemo(() => createRrStyles(colors), [colors]);
  const { ta } = useLanguage();
  return (
    <View style={rrStyles.row}>
      <Text style={[rrStyles.value, { textAlign: ta }]}>{value}</Text>
      <Text style={rrStyles.label}>{label}</Text>
    </View>
  );
}

function createRrStyles(colors: AppColors) {
  return StyleSheet.create({
    row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    label: { fontSize: 13, color: colors.textMuted },
    value: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 1, marginEnd: 8 },
  });
}

// ─── Styles ───────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: HEADER_PAD, paddingHorizontal: 16, paddingBottom: 8 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  backIcon:     { fontSize: 18, color: colors.textSecondary },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerBadge:  { backgroundColor: CONTRACT_DIM, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  headerBadgeText: { fontSize: 11, color: CONTRACT_COLOR, fontWeight: '700' },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginHorizontal: 16, marginBottom: 6, marginTop: 8 },
  stepSub:   { fontSize: 13, color: colors.textMuted, marginHorizontal: 16, marginBottom: 20 },

  groupScroll:      { paddingHorizontal: 16, marginBottom: 16 },
  groupTab:         { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
  groupTabActive:   { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM },
  groupTabText:     { fontSize: 13, color: colors.textSecondary },
  groupTabTextActive: { color: CONTRACT_COLOR, fontWeight: '700' },

  catGrid:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  catCard:       { width: '30%', backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  catCardActive: { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM },
  catIcon:       { fontSize: 26, marginBottom: 6 },
  catName:       { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 15 },
  catNameActive: { color: CONTRACT_COLOR, fontWeight: '700' },

  catSummary:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: CONTRACT_COLOR + '44', gap: 10 },
  catSummaryIcon: { fontSize: 24 },
  catSummaryName: { fontSize: 16, fontWeight: '700', color: CONTRACT_COLOR },

  fieldLabel:   { fontSize: 13, color: colors.textMuted, marginHorizontal: 16, marginBottom: 10, marginTop: 4 },
  optionalTag:  { fontSize: 11, color: colors.textMuted, fontWeight: '400' },

  freqRow:         { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  freqChip:        { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  freqChipActive:  { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM },
  freqChipText:    { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  freqChipTextActive: { color: CONTRACT_COLOR },
  freqChipSub:     { fontSize: 10, color: colors.textMuted },
  freqChipSubActive: { color: CONTRACT_COLOR + 'AA' },

  dayRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 16, marginBottom: 20 },
  dayBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  dayBtnActive: { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_COLOR },
  dayBtnText:   { fontSize: 11, color: colors.textSecondary },
  dayBtnTextActive: { color: '#fff', fontWeight: '700' },

  timeRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  timeChip:         { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  timeChipActive:   { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM },
  timeChipText:     { fontSize: 13, color: colors.textSecondary },
  timeChipTextActive: { color: CONTRACT_COLOR, fontWeight: '600' },

  cityScroll:       { marginHorizontal: 16, marginBottom: 24 },
  cityChip:         { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
  cityChipActive:   { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM },
  cityChipText:     { color: colors.textSecondary, fontSize: 13 },
  cityChipTextActive: { color: CONTRACT_COLOR },

  nextBtn:      { marginHorizontal: 16, marginTop: 8, backgroundColor: CONTRACT_COLOR, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  nextBtnText:  { fontSize: 16, fontWeight: '700', color: '#fff' },

  durationRow:      { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  durationCard:     { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  durationCardActive: { borderColor: CONTRACT_COLOR, backgroundColor: CONTRACT_DIM, borderWidth: 2 },
  durationMonths:   { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  durationSub:      { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginBottom: 6 },
  durationTextActive: { color: CONTRACT_COLOR },
  durationSubActive:  { color: CONTRACT_COLOR + 'AA' },
  discountBadge:    { backgroundColor: colors.accentDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)' },
  discountText:     { fontSize: 9, color: '#FCD34D', fontWeight: '700' },

  visitSummaryCard:  { marginHorizontal: 16, marginBottom: 20, backgroundColor: CONTRACT_DIM, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  visitSummaryTitle: { fontSize: 13, fontWeight: '700', color: CONTRACT_COLOR, marginBottom: 10 },
  visitSummaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: CONTRACT_COLOR + '22' },
  visitSummaryValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  visitSummaryLabel: { fontSize: 13, color: colors.textMuted },

  input:          { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginBottom: 16 },
  inputMulti:     { height: 100, textAlignVertical: 'top', paddingTop: 12 },

  heroCard:       { marginHorizontal: 16, marginBottom: 16, backgroundColor: CONTRACT_DIM, borderRadius: 20, padding: 20, borderWidth: 2, borderColor: CONTRACT_COLOR, alignItems: 'center' },
  heroIcon:       { fontSize: 40, marginBottom: 8 },
  heroTitle:      { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  heroBadgeRow:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 },
  heroBadge:      { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: CONTRACT_COLOR + '44' },
  heroBadgeText:  { fontSize: 12, color: CONTRACT_COLOR, fontWeight: '600' },
  heroVisits:     { alignItems: 'center', backgroundColor: CONTRACT_COLOR, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 10 },
  heroVisitsNum:  { fontSize: 28, fontWeight: '800', color: '#fff' },
  heroVisitsLabel:{ fontSize: 12, color: '#fff', opacity: 0.85 },

  reviewCard:   { marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },

  descCard:   { marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  descLabel:  { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  descText:   { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },

  trustRow:   { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  trustBadge: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 4 },
  trustIcon:  { fontSize: 20 },
  trustText:  { fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  submitBtn:         { marginHorizontal: 16, backgroundColor: CONTRACT_COLOR, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  submitBtnDisabled: { backgroundColor: colors.border },
  submitBtnText:     { fontSize: 17, fontWeight: '800', color: '#fff' },
  submitHint:        { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  });
}