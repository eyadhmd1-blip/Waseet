import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../src/lib/supabase';
import { CATEGORY_GROUPS, JORDAN_CITIES } from '../../src/constants/categories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { ServiceCategory } from '../../src/types';
import { useInsets } from '../../src/hooks/useInsets';
import { HEADER_PAD } from '../../src/utils/layout';
import { useTheme } from '../../src/context/ThemeContext';
import type { AppColors } from '../../src/constants/colors';

type Step = 1 | 2 | 3;

const ICON_MAP: Record<string, string> = {
  zap: '⚡', droplets: '🚿', wind: '❄️', hammer: '🔨', paintbrush: '🎨',
  wrench: '🔧', sparkles: '✨', truck: '🚚', 'book-open': '📚', moon: '🌙', 'pen-tool': '✏️',
  car: '🚗', battery: '🔋', gauge: '⛽', snowflake: '🧊', shield: '🛡️', droplet: '💧',
};

export default function NewRequestScreen() {
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta, lang } = useLanguage();
  const { colors } = useTheme();
  const { category: preselectedCategory, notif_id: notifId } = useLocalSearchParams<{ category?: string; notif_id?: string }>();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep]               = useState<Step>(preselectedCategory ? 2 : 1);
  const [selectedCat, setSelectedCat] = useState<ServiceCategory | null>(
    preselectedCategory
      ? CATEGORY_GROUPS.flatMap(g => g.categories).find(c => c.slug === preselectedCategory) ?? null
      : null
  );
  const [activeGroup, setActiveGroup] = useState('maintenance');
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity]               = useState('');
  const [images, setImages]           = useState<string[]>([]);
  const [aiPrice, setAiPrice]         = useState<{ min: number; max: number } | null>(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);

  const STEP_TITLES: Record<Step, string> = {
    1: t('newRequest.step1'),
    2: t('newRequest.step2'),
    3: t('newRequest.step3'),
  };

  const getCatName = (cat: ServiceCategory) =>
    lang === 'ar' ? cat.name_ar : (cat.name_en ?? cat.name_ar);

  const getGroupName = (slug: string) =>
    t(`categories.${slug}`, CATEGORY_GROUPS.find(g => g.slug === slug)?.name_ar ?? slug);

  const handleSelectCategory = (cat: ServiceCategory) => {
    setSelectedCat(cat);
    setStep(2);
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 4));
    }
  };

  const fetchAiPrice = useCallback(async () => {
    if (!selectedCat || !description.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-price-suggest', {
        body: { category: selectedCat.slug, description: description.trim() },
      });
      if (!error && data?.min && data?.max) {
        setAiPrice({ min: data.min, max: data.max });
      }
    } catch {
      // AI price is non-blocking
    } finally {
      setAiLoading(false);
    }
  }, [selectedCat, description]);

  const handleStep2Continue = () => {
    if (!title.trim()) { Alert.alert(t('common.attention'), t('newRequest.titleRequired')); return; }
    if (!description.trim() || description.length < 20) { Alert.alert(t('common.attention'), t('newRequest.descRequired')); return; }
    if (!city) { Alert.alert(t('common.attention'), t('newRequest.cityRequired')); return; }
    fetchAiPrice();
    setStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setSubmitting(false); return; }

    const uploadedUrls: string[] = [];
    for (const uri of images) {
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { data: uploadData } = await supabase.storage
        .from('request-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('request-images').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }
    }

    const { error } = await supabase.from('requests').insert({
      client_id:               user.id,
      category_slug:           selectedCat!.slug,
      title:                   title.trim(),
      description:             description.trim(),
      city,
      image_urls:              uploadedUrls,
      ai_suggested_price_min:  aiPrice?.min ?? null,
      ai_suggested_price_max:  aiPrice?.max ?? null,
      ai_suggested_currency:   'JOD',
      status:                  'open',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }

    if (notifId) {
      supabase.rpc('mark_notification_converted', { notif_id: notifId }).catch(() => {});
    }

    Alert.alert(t('newRequest.successDone'), t('newRequest.successTitle'), [
      { text: t('common.confirm'), onPress: () => router.replace('/(client)') },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => step === 1 ? router.back() : setStep((step - 1) as Step)}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{STEP_TITLES[step]}</Text>
        <View style={styles.stepIndicator}>
          {([1, 2, 3] as Step[]).map(s => (
            <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive]} />
          ))}
        </View>
      </View>

      {/* ── Step 1: Category ── */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {CATEGORY_GROUPS.map(g => (
              <TouchableOpacity
                key={g.slug}
                style={[styles.groupChip, activeGroup === g.slug && styles.groupChipActive]}
                onPress={() => setActiveGroup(g.slug)}
              >
                <Text style={[styles.groupChipText, activeGroup === g.slug && styles.groupChipTextActive]}>
                  {getGroupName(g.slug)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.catGrid}>
            {CATEGORY_GROUPS.find(g => g.slug === activeGroup)?.categories.map(cat => (
              <TouchableOpacity
                key={cat.slug}
                style={[styles.catCard, selectedCat?.slug === cat.slug && styles.catCardActive]}
                onPress={() => handleSelectCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={styles.catIcon}>{ICON_MAP[cat.icon] ?? '🔧'}</Text>
                <Text style={styles.catName}>{getCatName(cat)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Step 2: Details ── */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.selectedCatBadge} onPress={() => setStep(1)}>
            <Text style={styles.selectedCatText}>
              {ICON_MAP[selectedCat?.icon ?? ''] ?? '🔧'}  {selectedCat ? getCatName(selectedCat) : ''}
            </Text>
            <Text style={styles.changeCat}>{t('newRequest.changeCategory')}</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { textAlign: ta }]}>{t('newRequest.requestTitle')}</Text>
          <TextInput
            style={[styles.input, { textAlign: ta }]}
            placeholder={t('newRequest.titlePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <Text style={[styles.label, { textAlign: ta }]}>{t('newRequest.description')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { textAlign: ta }]}
            placeholder={t('newRequest.descPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={[styles.charCount, { textAlign: ta }]}>{description.length}/500</Text>

          <Text style={[styles.label, { textAlign: ta }]}>{t('newRequest.city')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityScroll}>
            {JORDAN_CITIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.cityChip, city === c && styles.cityChipActive]}
                onPress={() => setCity(c)}
              >
                <Text style={[styles.cityText, city === c && styles.cityTextActive]}>
                  {t(`cities.${c}`, c)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { textAlign: ta }]}>{t('newRequest.photosOptional')}</Text>
          <View style={styles.imageRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.imagePlaceholder}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{i + 1}</Text>
                <TouchableOpacity onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}>
                  <Text style={{ color: '#EF4444', fontSize: 18, marginTop: 4 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 4 && (
              <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                <Text style={{ fontSize: 28, color: colors.textMuted }}>+</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, (!title || !description || !city) && styles.btnDisabled]}
            onPress={handleStep2Continue}
            disabled={!title || !description || !city}
          >
            <Text style={styles.btnText}>{t('newRequest.next')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>{t('newRequest.aiPrice')}</Text>
            {aiLoading ? (
              <View style={styles.priceLoading}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.priceLoadingText}>{t('newRequest.aiAnalyzing')}</Text>
              </View>
            ) : aiPrice ? (
              <Text style={styles.priceValue}>
                {aiPrice.min} – {aiPrice.max} {t('common.jod')}
              </Text>
            ) : (
              <Text style={styles.priceNA}>{t('newRequest.priceTBD')}</Text>
            )}
          </View>

          <View style={styles.summaryCard}>
            <Row label={t('newRequest.summaryService')} value={selectedCat ? getCatName(selectedCat) : ''} isRTL={ta === 'right'} />
            <Row label={t('newRequest.summaryTitle')}   value={title}        isRTL={ta === 'right'} />
            <Row label={t('newRequest.summaryCity')}    value={t(`cities.${city}`, city)} isRTL={ta === 'right'} />
            <Row label={t('newRequest.summaryDesc')}    value={description}  isRTL={ta === 'right'} multiline />
            {images.length > 0 && (
              <Row label={t('newRequest.photos')} value={t('newRequest.summaryPhotos', { count: images.length })} isRTL={ta === 'right'} />
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.btnText}>{t('newRequest.submit')}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, multiline, colors: _colors }: { label: string; value: string; multiline?: boolean; isRTL?: boolean; colors?: AppColors }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value} numberOfLines={multiline ? 3 : 1}>{value}</Text>
    </View>
  );
}

// Row uses static styles since it doesn't have access to theme context here
// and colors don't change for border/text values in this sub-component
const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1B3568' },
  label: { fontSize: 13, color: '#3A5C80', flex: 0.4 },
  value: { fontSize: 13, color: '#EEF4FF', flex: 0.6 },
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    topBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText:      { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
    topTitle:      { flex: 1, fontSize: 17, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    stepIndicator: { flexDirection: 'row', gap: 6 },
    stepDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.accent },

    scrollContent: { padding: 20, paddingBottom: 40 },

    groupScroll:         { marginBottom: 20 },
    groupChip:           { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
    groupChipActive:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
    groupChipText:       { color: colors.textSecondary, fontSize: 13 },
    groupChipTextActive: { color: colors.accent },

    catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    catCard:       { width: '30%', backgroundColor: colors.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    catCardActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
    catIcon:       { fontSize: 30, marginBottom: 8 },
    catName:       { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

    selectedCatBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.accentDim, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)', marginBottom: 20 },
    selectedCatText:  { fontSize: 15, color: colors.accent, fontWeight: '600' },
    changeCat:        { fontSize: 13, color: colors.textMuted },

    label:     { fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
    input:     { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border },
    inputMultiline: { height: 120, textAlignVertical: 'top', paddingTop: 14 },
    charCount: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

    cityScroll:    { marginBottom: 8 },
    cityChip:      { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginEnd: 8, borderWidth: 1, borderColor: colors.border },
    cityChipActive:{ borderColor: colors.accent, backgroundColor: colors.accentDim },
    cityText:      { color: colors.textSecondary, fontSize: 13 },
    cityTextActive:{ color: colors.accent },

    imageRow:    { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
    imagePlaceholder: { width: 80, height: 80, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    addImageBtn: { width: 80, height: 80, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

    priceCard:       { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    priceLabel:      { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
    priceValue:      { fontSize: 28, fontWeight: '700', color: colors.accent },
    priceNA:         { fontSize: 15, color: colors.textSecondary },
    priceLoading:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    priceLoadingText:{ fontSize: 14, color: colors.textMuted },

    summaryCard: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1, borderColor: colors.border },

    btn:        { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    btnDisabled:{ backgroundColor: colors.border },
    btnText:    { fontSize: 17, fontWeight: '700', color: colors.bg },
  });
}
