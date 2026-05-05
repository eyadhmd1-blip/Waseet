import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SuccessModal } from '../../src/components/SuccessModal';
import { SuggestServiceModal } from '../../src/components/SuggestServiceModal';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../src/lib/supabase';
import { CATEGORY_GROUPS, JORDAN_CITIES, CATEGORY_PLACEHOLDERS, ICON_MAP } from '../../src/constants/categories';
import { useCategories } from '../../src/hooks/useCategories';
import { useLanguage } from '../../src/hooks/useLanguage';
import type { ServiceCategory } from '../../src/types';
import { useTheme } from '../../src/context/ThemeContext';
import { AppHeader } from '../../src/components/AppHeader';
import type { AppColors } from '../../src/constants/colors';

type Step = 1 | 2 | 3;


export default function NewRequestScreen() {
  const router = useRouter();
  const { t, ta, lang, isRTL } = useLanguage();
  const { colors } = useTheme();
  const {
    category: preselectedCategory,
    notif_id: notifId,
    repost_from: repostFromId,
  } = useLocalSearchParams<{ category?: string; notif_id?: string; repost_from?: string }>();

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const { groups } = useCategories();

  const [step, setStep]               = useState<Step>(preselectedCategory ? 2 : 1);
  const [showSuggest, setShowSuggest] = useState(false);
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [repostBanner, setRepostBanner] = useState(false);

  // Courier-specific fields
  const [pickupAddress,  setPickupAddress]  = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [packageSize,    setPackageSize]    = useState<'small' | 'medium' | 'large' | ''>('');

  const isCourier = selectedCat?.slug === 'courier';

  // Pre-fill fields when reposting from an expired request
  useEffect(() => {
    if (!repostFromId) return;
    supabase
      .from('requests')
      .select('category_slug, title, description, city, ai_suggested_price_min, ai_suggested_price_max')
      .eq('id', repostFromId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const cat = CATEGORY_GROUPS.flatMap(g => g.categories).find(c => c.slug === data.category_slug) ?? null;
        setSelectedCat(cat);
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setCity(data.city ?? '');
        if (data.ai_suggested_price_min && data.ai_suggested_price_max) {
          setAiPrice({ min: data.ai_suggested_price_min, max: data.ai_suggested_price_max });
        }
        setStep(2);
        setRepostBanner(true);
      });
  }, [repostFromId]);

  useFocusEffect(
    useCallback(() => {
      if (repostFromId) return; // skip reset when reposting
      setStep(preselectedCategory ? 2 : 1);
      setSelectedCat(
        preselectedCategory
          ? CATEGORY_GROUPS.flatMap(g => g.categories).find(c => c.slug === preselectedCategory) ?? null
          : null
      );
      setActiveGroup('maintenance');
      setTitle('');
      setDescription('');
      setCity('');
      setImages([]);
      setAiPrice(null);
      setAiLoading(false);
      setSubmitting(false);
      setRepostBanner(false);
      setPickupAddress('');
      setDropoffAddress('');
      setPackageSize('');
    }, [preselectedCategory, repostFromId])
  );

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
    if (isCourier) {
      if (!pickupAddress.trim())  { Alert.alert(t('common.attention'), t('newRequest.pickupRequired'));  return; }
      if (!dropoffAddress.trim()) { Alert.alert(t('common.attention'), t('newRequest.dropoffRequired')); return; }
      if (!packageSize)           { Alert.alert(t('common.attention'), t('newRequest.sizeRequired'));    return; }
    }
    fetchAiPrice();
    setStep(3);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setSubmitting(false); return; }

    // Check request limits before submission
    const { data: limitResult } = await supabase.rpc('check_request_limits', {
      p_client_id:     user.id,
      p_category_slug: selectedCat!.slug,
    });
    if (limitResult === 'TOTAL_LIMIT' || limitResult === 'CATEGORY_LIMIT') {
      setSubmitting(false);
      Alert.alert(
        t('common.attention'),
        limitResult === 'TOTAL_LIMIT'
          ? t('requests.errTotalLimit')
          : t('requests.errCategoryLimit')
      );
      return;
    }

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
      ...(isCourier && {
        pickup_address:  pickupAddress.trim(),
        dropoff_address: dropoffAddress.trim(),
        package_size:    packageSize,
      }),
    });

    setSubmitting(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
      return;
    }

    if (notifId) {
      supabase.rpc('mark_notification_converted', { notif_id: notifId }).then(() => {});
    }

    setShowSuccess(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppHeader
        variant="modal"
        title={STEP_TITLES[step]}
        onClose={() => step === 1 ? router.back() : setStep((step - 1) as Step)}
        step={step}
        totalSteps={3}
      />

      {/* ── Step 1: Category ── */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
            {groups.map(g => (
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
            {groups.find(g => g.slug === activeGroup)?.categories.map(cat => (
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

          <TouchableOpacity style={styles.suggestCard} onPress={() => setShowSuggest(true)} activeOpacity={0.8}>
            <View style={styles.suggestIconWrap}>
              <Text style={styles.suggestIconEmoji}>💡</Text>
            </View>
            <View style={styles.suggestCardBody}>
              <Text style={styles.suggestCardTitle}>{t('suggestions.notFound')}</Text>
              <Text style={styles.suggestCardSub}>{t('suggestions.notFoundSub')}</Text>
            </View>
            <Text style={styles.suggestCardArrow}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Repost banner ── */}
      {repostBanner && (
        <View style={styles.repostBanner}>
          <Text style={styles.repostBannerText}>{t('requests.repostPrefilled')}</Text>
        </View>
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

          <Text style={styles.label}>{t('newRequest.requestTitle')}</Text>
          <TextInput
            style={styles.input}
            placeholder={
              (lang === 'ar'
                ? CATEGORY_PLACEHOLDERS[selectedCat?.slug ?? '']?.title_ar
                : CATEGORY_PLACEHOLDERS[selectedCat?.slug ?? '']?.title_en)
              ?? t('newRequest.titlePlaceholder')
            }
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <Text style={styles.label}>{t('newRequest.description')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={
              (lang === 'ar'
                ? CATEGORY_PLACEHOLDERS[selectedCat?.slug ?? '']?.desc_ar
                : CATEGORY_PLACEHOLDERS[selectedCat?.slug ?? '']?.desc_en)
              ?? t('newRequest.descPlaceholder')
            }
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>

          <Text style={styles.label}>{t('newRequest.city')}</Text>
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

          {/* ── Courier fields ── */}
          {isCourier && (
            <>
              <Text style={styles.label}>{t('newRequest.pickupAddress')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('newRequest.pickupPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                maxLength={200}
                textAlign={ta}
              />

              <Text style={styles.label}>{t('newRequest.dropoffAddress')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('newRequest.dropoffPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                maxLength={200}
                textAlign={ta}
              />

              <Text style={styles.label}>{t('newRequest.packageSize')}</Text>
              <View style={styles.sizeRow}>
                {(['small', 'medium', 'large'] as const).map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeChip, packageSize === size && styles.sizeChipActive]}
                    onPress={() => setPackageSize(size)}
                  >
                    <Text style={styles.sizeIcon}>
                      {size === 'small' ? '📬' : size === 'medium' ? '📦' : '🗳️'}
                    </Text>
                    <Text style={[styles.sizeText, packageSize === size && styles.sizeTextActive]}>
                      {t(`newRequest.size_${size}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>{t('newRequest.photosOptional')}</Text>
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
            {isCourier && pickupAddress  && <Row label={t('newRequest.pickupAddress')}  value={pickupAddress}  isRTL={ta === 'right'} />}
            {isCourier && dropoffAddress && <Row label={t('newRequest.dropoffAddress')} value={dropoffAddress} isRTL={ta === 'right'} />}
            {isCourier && packageSize    && <Row label={t('newRequest.packageSize')}    value={t(`newRequest.size_${packageSize}`)} isRTL={ta === 'right'} />}
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
      <SuggestServiceModal visible={showSuggest} onClose={() => setShowSuggest(false)} />
      <SuccessModal
        visible={showSuccess}
        title={t('newRequest.successTitle')}
        subtitle="سيبدأ مقدمو الخدمة بإرسال عروضهم قريباً"
        hint="سنقوم بإشعارك عند وصول أي عرض"
        primaryLabel="عرض طلباتي"
        secondaryLabel="حسناً"
        onPrimary={() => { setShowSuccess(false); router.replace('/(client)/requests'); }}
        onSecondary={() => { setShowSuccess(false); router.replace('/(client)'); }}
      />
    </KeyboardAvoidingView>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean; isRTL?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 0.4 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 0.6 }} numberOfLines={multiline ? 3 : 1}>{value}</Text>
    </View>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

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

    label:     { fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 16, alignSelf: 'stretch', textAlign: ta },
    input:     { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: colors.border, textAlign: ta },
    inputMultiline: { height: 120, textAlignVertical: 'top', paddingTop: 14 },
    charCount: { fontSize: 11, color: colors.textMuted, marginTop: 4, alignSelf: 'stretch', textAlign: ta },

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

    sizeRow:         { flexDirection: 'row', gap: 10, marginBottom: 4 },
    sizeChip:        { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 4 },
    sizeChipActive:  { borderColor: colors.accent, backgroundColor: colors.accentDim },
    sizeIcon:        { fontSize: 22 },
    sizeText:        { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
    sizeTextActive:  { color: colors.accent, fontWeight: '700' },

    suggestCard:      { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginHorizontal: 2, marginBottom: 8, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent + '88', backgroundColor: colors.accentDim, gap: 12 },
    suggestIconWrap:  { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center' },
    suggestIconEmoji: { fontSize: 22 },
    suggestCardBody:  { flex: 1, gap: 2 },
    suggestCardTitle: { fontSize: 14, fontWeight: '700', color: colors.accent },
    suggestCardSub:   { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    suggestCardArrow: { fontSize: 22, color: colors.accent, fontWeight: '700' },

    repostBanner: {
      marginHorizontal: 20,
      marginBottom:     12,
      backgroundColor:  'rgba(59,130,246,0.10)',
      borderRadius:     10,
      paddingVertical:  10,
      paddingHorizontal: 14,
      borderWidth:      1,
      borderColor:      'rgba(59,130,246,0.25)',
    },
    repostBannerText: { fontSize: 13, color: colors.accent, fontWeight: '600', textAlign: 'center' },
  });
}
