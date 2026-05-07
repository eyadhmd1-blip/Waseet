import { useState, useRef, useMemo } from 'react';
import { SuccessModal } from '../src/components/SuccessModal';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, Animated, Dimensions,
  KeyboardAvoidingView, Platform, Image, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker    from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem      from 'expo-file-system';
import { supabase }         from '../src/lib/supabase';
import { CATEGORY_GROUPS }  from '../src/constants/categories';
import type { PortfolioItemType } from '../src/types';
import { useLanguage }      from '../src/hooks/useLanguage';
import { useTheme }         from '../src/context/ThemeContext';
import { AppHeader }        from '../src/components/AppHeader';
import type { AppColors }   from '../src/constants/colors';

const { width: W } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────

const GROUP_COLORS: Record<string, string> = {
  maintenance:  '#3B82F6',
  cleaning:     '#10B981',
  education:    '#8B5CF6',
  freelance:    '#F59E0B',
  car_services: '#EF4444',
};

const TYPE_KEYS: Array<{ type: PortfolioItemType; emoji: string }> = [
  { type: 'single',       emoji: '📷' },
  { type: 'before_after', emoji: '🔄' },
  { type: 'video',        emoji: '🎥' },
];

// ─── Upload helper ────────────────────────────────────────────

async function uploadToStorage(
  uri: string,
  userId: string,
  suffix: string,
  isVideo: boolean,
): Promise<string> {
  const ext  = uri.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
  const mime = isVideo
    ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4')
    : (ext === 'png' ? 'image/png' : 'image/jpeg');

  const fileName  = `${userId}/${Date.now()}_${suffix}.${ext}`;
  const base64    = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const { error } = await supabase.storage
    .from('portfolio-media')
    .upload(fileName, byteArray, { contentType: mime });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('portfolio-media')
    .getPublicUrl(fileName);

  return publicUrl;
}

// ─── Image Preview Modal ──────────────────────────────────────
// Replaces the system cropper entirely. Shows a full-screen
// preview with clear Confirm / Re-pick controls in app colors.

interface PreviewState {
  uri:       string;
  asset:     ImagePicker.ImagePickerAsset;
  onConfirm: (uri: string) => void;
}

function ImagePreviewModal({
  preview, onConfirm, onRepick,
}: {
  preview:   PreviewState;
  onConfirm: () => Promise<void>;
  onRepick:  () => void;
}) {
  const { colors }        = useTheme();
  const { isRTL }         = useLanguage();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={pm.root}>

        {/* ── Header ── */}
        <View style={pm.header}>
          <TouchableOpacity
            style={pm.repickBtn}
            onPress={onRepick}
            disabled={loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={pm.repickText}>
              {isRTL ? '↩  إعادة الاختيار' : '↩  Re-pick'}
            </Text>
          </TouchableOpacity>

          <Text style={pm.headerTitle}>
            {isRTL ? 'معاينة الصورة' : 'Preview'}
          </Text>

          {/* Spacer to balance header */}
          <View style={{ width: 120 }} />
        </View>

        {/* ── Image preview ── */}
        <View style={pm.imageWrap}>
          <Image
            source={{ uri: preview.uri }}
            style={pm.image}
            resizeMode="contain"
          />
          {/* 4:3 frame indicator */}
          <View style={pm.frameOverlay} pointerEvents="none">
            <View style={pm.frameCornerTL} />
            <View style={pm.frameCornerTR} />
            <View style={pm.frameCornerBL} />
            <View style={pm.frameCornerBR} />
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={[pm.footer, { backgroundColor: '#111' }]}>
          <Text style={pm.cropHint}>
            {isRTL
              ? '✂️ سيتم اقتصاص الصورة تلقائياً بنسبة 4:3'
              : '✂️ Image will be auto-cropped to 4:3'}
          </Text>

          <TouchableOpacity
            style={[pm.confirmBtn, { backgroundColor: '#22C55E' }, loading && pm.confirmBtnLoading]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={pm.confirmInner}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={pm.confirmText}>
                  {isRTL ? 'جارٍ المعالجة...' : 'Processing...'}
                </Text>
              </View>
            ) : (
              <Text style={pm.confirmText}>
                {isRTL ? '✓  تأكيد واستخدام الصورة' : '✓  Confirm & Use Photo'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#000' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.85)' },
  headerTitle:       { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center', flex: 1 },
  repickBtn:         { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, minWidth: 120 },
  repickText:        { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  imageWrap:         { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  image:             { width: W, height: W * (3 / 4) },
  // Corner frame markers
  frameOverlay:      { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  frameCornerTL:     { position: 'absolute', top: '12.5%', left: '0%', width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#22C55E', borderTopLeftRadius: 4 },
  frameCornerTR:     { position: 'absolute', top: '12.5%', right: '0%', width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#22C55E', borderTopRightRadius: 4 },
  frameCornerBL:     { position: 'absolute', bottom: '12.5%', left: '0%', width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#22C55E', borderBottomLeftRadius: 4 },
  frameCornerBR:     { position: 'absolute', bottom: '12.5%', right: '0%', width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#22C55E', borderBottomRightRadius: 4 },
  footer:            { paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28, gap: 14 },
  cropHint:          { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },
  confirmBtn:        { borderRadius: 18, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  confirmBtnLoading: { opacity: 0.7 },
  confirmInner:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confirmText:       { color: '#fff', fontSize: 17, fontWeight: '800' },
});

// ─── Step Dots ────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
      {[1, 2, 3].map(n => (
        <View
          key={n}
          style={{
            width:  n === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: n === current ? colors.accent : (n < current ? colors.accent + '55' : colors.border),
          }}
        />
      ))}
    </View>
  );
}

// ─── Upload Box ───────────────────────────────────────────────

function UploadBox({
  label, uri, onPress, icon, changeLabel, style,
}: { label: string; uri: string | null; onPress: () => void; icon: string; changeLabel: string; style?: object }) {
  const { colors } = useTheme();
  const ubSt = useMemo(() => createUbSt(colors), [colors]);
  return (
    <TouchableOpacity style={[ubSt.box, style]} onPress={onPress} activeOpacity={0.8}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <>
          <Text style={ubSt.icon}>{icon}</Text>
          <Text style={ubSt.label}>{label}</Text>
        </>
      )}
      {uri && (
        <View style={ubSt.changeOverlay}>
          <Text style={ubSt.changeText}>{changeLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function createUbSt(colors: AppColors) {
  return StyleSheet.create({
  box:           { borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, overflow: 'hidden', minHeight: 160 },
  icon:          { fontSize: 44, marginBottom: 10 },
  label:         { fontSize: 14, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  changeOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 8, alignItems: 'center' },
  changeText:    { color: '#fff', fontSize: 12, fontWeight: '700' },
  });
}

// ─── Main Screen ──────────────────────────────────────────────

export default function PortfolioAddScreen() {
  const { colors } = useTheme();
  const { t, lang, isRTL } = useLanguage();
  const ta = isRTL ? 'right' : 'left' as const;
  const st = useMemo(() => createSt(colors, isRTL), [colors, isRTL]);
  const router = useRouter();

  const [step,        setStep]        = useState<1 | 2 | 3>(1);
  const [itemType,    setItemType]    = useState<PortfolioItemType | null>(null);
  const [singleUri,   setSingleUri]   = useState<string | null>(null);
  const [beforeUri,   setBeforeUri]   = useState<string | null>(null);
  const [afterUri,    setAfterUri]    = useState<string | null>(null);
  const [videoUri,    setVideoUri]    = useState<string | null>(null);
  const [catSlug,     setCatSlug]     = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [preview,     setPreview]     = useState<PreviewState | null>(null);

  const typeAnims = useRef(TYPE_KEYS.map(() => new Animated.Value(1))).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  const goToStep = (next: 1 | 2 | 3) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const selectType = (type: PortfolioItemType, idx: number) => {
    setItemType(type);
    Animated.sequence([
      Animated.spring(typeAnims[idx], { toValue: 0.93, useNativeDriver: true, tension: 200, friction: 5 }),
      Animated.spring(typeAnims[idx], { toValue: 1,    useNativeDriver: true, tension: 200, friction: 5 }),
    ]).start();
  };

  // ── Image picker — two-step: source sheet → preview modal ──

  const launchPicker = async (
    source: 'camera' | 'gallery',
    onPick: (uri: string) => void,
  ) => {
    let result: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('portfolioAdd.permissionTitle'), t('portfolioAdd.permissionPhoto'));
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.92,
        allowsEditing: false,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('portfolioAdd.permissionTitle'), t('portfolioAdd.permissionPhoto'));
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.92,
        allowsEditing: false,
      });
    }

    if (!result.canceled && result.assets[0]) {
      setPreview({ uri: result.assets[0].uri, asset: result.assets[0], onConfirm: onPick });
    }
  };

  const pickImage = (onPick: (uri: string) => void) => {
    Alert.alert(
      isRTL ? 'اختر مصدر الصورة' : 'Choose Image Source',
      '',
      [
        {
          text: isRTL ? '📷  الكاميرا' : '📷  Camera',
          onPress: () => launchPicker('camera', onPick),
        },
        {
          text: isRTL ? '🖼️  معرض الصور' : '🖼️  Photo Library',
          onPress: () => launchPicker('gallery', onPick),
        },
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ],
    );
  };

  // Auto center-crop to 4:3, applied on confirm in preview modal
  const confirmPreview = async () => {
    if (!preview) return;
    const { asset, onConfirm } = preview;

    const targetRatio = 4 / 3;
    const imgRatio    = asset.width / asset.height;
    let cropX: number, cropY: number, cropW: number, cropH: number;

    if (imgRatio > targetRatio) {
      cropH = asset.height;
      cropW = Math.floor(asset.height * targetRatio);
      cropX = Math.floor((asset.width - cropW) / 2);
      cropY = 0;
    } else {
      cropW = asset.width;
      cropH = Math.floor(asset.width / targetRatio);
      cropX = 0;
      cropY = Math.floor((asset.height - cropH) / 2);
    }

    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } }],
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
    );

    setPreview(null);
    onConfirm(manipulated.uri);
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('portfolioAdd.permissionTitle'), t('portfolioAdd.permissionVideo'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  // ── Validation ────────────────────────────────────────────

  const canAdvanceStep1 = !!itemType;

  const canAdvanceStep2 = (() => {
    if (!itemType) return false;
    if (itemType === 'single')       return !!singleUri;
    if (itemType === 'before_after') return !!beforeUri && !!afterUri;
    if (itemType === 'video')        return !!videoUri;
    return false;
  })();

  // ── Submit ────────────────────────────────────────────────

  const submit = async () => {
    if (!itemType) return;
    setSubmitting(true);

    try {
      const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
      if (!user) throw new Error('not authenticated');

      let media_urls: string[] = [];
      let video_url: string | undefined;

      if (itemType === 'single' && singleUri) {
        media_urls = [await uploadToStorage(singleUri, user.id, 'main', false)];
      } else if (itemType === 'before_after' && beforeUri && afterUri) {
        media_urls = [
          await uploadToStorage(beforeUri, user.id, 'before', false),
          await uploadToStorage(afterUri,  user.id, 'after',  false),
        ];
      } else if (itemType === 'video' && videoUri) {
        video_url = await uploadToStorage(videoUri, user.id, 'video', true);
      }

      const { error } = await supabase
        .from('portfolio_items')
        .insert({
          provider_id:    user.id,
          item_type:      itemType,
          media_urls,
          video_url,
          category_slug:  catSlug ?? undefined,
          description_ar: description.trim() || undefined,
        });

      if (error) throw error;

      setShowSuccess(true);
    } catch (err) {
      console.error('[portfolio-add] submit error:', err);
      Alert.alert(t('common.error'), t('portfolioAdd.errSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render steps ─────────────────────────────────────────

  const renderStep1 = () => (
    <>
      <Text style={st.stepTitle}>{t('portfolioAdd.step1Title')}</Text>
      <Text style={st.stepSub}>{t('portfolioAdd.step1Sub')}</Text>
      <View style={st.typeGrid}>
        {TYPE_KEYS.map((opt, idx) => {
          const selected = itemType === opt.type;
          const titleKey = `portfolioAdd.type${opt.type.charAt(0).toUpperCase() + opt.type.replace('_', '').slice(1)}Title` as any;
          const descKey  = `portfolioAdd.type${opt.type.charAt(0).toUpperCase() + opt.type.replace('_', '').slice(1)}Desc` as any;
          return (
            <Animated.View
              key={opt.type}
              style={{ transform: [{ scale: typeAnims[idx] }] }}
            >
              <TouchableOpacity
                style={[st.typeCard, selected && st.typeCardSelected]}
                onPress={() => selectType(opt.type, idx)}
                activeOpacity={0.85}
              >
                <Text style={st.typeEmoji}>{opt.emoji}</Text>
                <Text style={[st.typeTitle, selected && st.typeTitleSelected]}>{t(titleKey)}</Text>
                <Text style={st.typeDesc}>{t(descKey)}</Text>
                {selected && <View style={st.typeCheckmark}><Text style={{ fontSize: 14, color: colors.bg }}>✓</Text></View>}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </>
  );

  const renderStep2 = () => {
    const step2Title =
      itemType === 'single'       ? t('portfolioAdd.step2SingleTitle') :
      itemType === 'before_after' ? t('portfolioAdd.step2BeforeAfterTitle') :
                                    t('portfolioAdd.step2VideoTitle');
    const step2Sub =
      itemType === 'before_after' ? t('portfolioAdd.step2BeforeAfterSub') :
      itemType === 'video'        ? t('portfolioAdd.step2VideoSub') :
                                    t('portfolioAdd.step2SingleSub');
    const changeLabel = t('portfolioAdd.uploadChangeBtn');

    return (
      <>
        <Text style={st.stepTitle}>{step2Title}</Text>
        <Text style={st.stepSub}>{step2Sub}</Text>

        {itemType === 'single' && (
          <UploadBox
            label={t('portfolioAdd.uploadPickPhoto')}
            icon="📷"
            uri={singleUri}
            onPress={() => pickImage(setSingleUri)}
            changeLabel={changeLabel}
            style={st.singleBox}
          />
        )}

        {itemType === 'before_after' && (
          <View style={st.baRow}>
            <View style={st.baColumn}>
              <Text style={st.baLabel}>{t('portfolioAdd.uploadBeforeLabel')}</Text>
              <UploadBox
                label={t('portfolioAdd.uploadBeforePickLabel')}
                icon="📷"
                uri={beforeUri}
                onPress={() => pickImage(setBeforeUri)}
                changeLabel={changeLabel}
                style={st.baBox}
              />
            </View>
            <View style={st.baArrow}><Text style={st.baArrowText}>⟶</Text></View>
            <View style={st.baColumn}>
              <Text style={st.baLabel}>{t('portfolioAdd.uploadAfterLabel')}</Text>
              <UploadBox
                label={t('portfolioAdd.uploadAfterPickLabel')}
                icon="✨"
                uri={afterUri}
                onPress={() => pickImage(setAfterUri)}
                changeLabel={changeLabel}
                style={st.baBox}
              />
            </View>
          </View>
        )}

        {itemType === 'video' && (
          <>
            <UploadBox
              label={t('portfolioAdd.uploadPickVideo')}
              icon="🎥"
              uri={videoUri}
              onPress={pickVideo}
              changeLabel={changeLabel}
              style={st.singleBox}
            />
            {videoUri && (
              <View style={st.videoBadge}>
                <Text style={st.videoBadgeText}>{t('portfolioAdd.videoSelected')}</Text>
              </View>
            )}
          </>
        )}
      </>
    );
  };

  const renderStep3 = () => (
    <>
      <Text style={st.stepTitle}>{t('portfolioAdd.step3Title')}</Text>
      <Text style={st.stepSub}>{t('portfolioAdd.step3Sub')}</Text>

      <Text style={st.fieldLabel}>{t('portfolioAdd.fieldCategory')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.catScroll}>
        {CATEGORY_GROUPS.map(group =>
          group.categories.map(cat => {
            const color    = GROUP_COLORS[cat.group_slug] ?? colors.accent;
            const selected = catSlug === cat.slug;
            const name     = lang === 'ar' ? cat.name_ar : (cat.name_en ?? cat.name_ar);
            return (
              <TouchableOpacity
                key={cat.slug}
                style={[st.catChip, { borderColor: color + (selected ? 'ff' : '44'), backgroundColor: selected ? color + '22' : colors.surface }]}
                onPress={() => setCatSlug(selected ? null : cat.slug)}
              >
                <Text style={[st.catChipText, { color: selected ? color : colors.textSecondary }]}>{name}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Text style={[st.fieldLabel, { marginTop: 20 }]}>{t('portfolioAdd.fieldDesc')}</Text>
      <TextInput
        style={st.descInput}
        placeholder={t('portfolioAdd.descPlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={v => setDescription(v.slice(0, 200))}
        textAlign={ta}
        multiline
        numberOfLines={4}
      />
      <Text style={st.charCount}>{description.length}/200</Text>
    </>
  );

  // ── Main render ──────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppHeader
        variant="modal"
        title={t('portfolioAdd.headerTitle')}
        onClose={() => step === 1 ? router.back() : goToStep((step - 1) as 1 | 2 | 3)}
        step={step}
        totalSteps={3}
      />

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepDots current={step} />

        <Animated.View style={{ opacity: fadeAnim }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </Animated.View>
      </ScrollView>

      <View style={st.footer}>
        {step < 3 ? (
          <TouchableOpacity
            style={[st.nextBtn, !(step === 1 ? canAdvanceStep1 : canAdvanceStep2) && st.nextBtnDisabled]}
            onPress={() => goToStep((step + 1) as 2 | 3)}
            disabled={!(step === 1 ? canAdvanceStep1 : canAdvanceStep2)}
          >
            <Text style={st.nextBtnText}>{t('portfolioAdd.nextBtn')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[st.nextBtn, submitting && st.nextBtnDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={colors.bg} size="small" />
                <Text style={st.nextBtnText}>{t('portfolioAdd.uploadingBtn')}</Text>
              </View>
            ) : (
              <Text style={st.nextBtnText}>{t('portfolioAdd.submitBtn')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Image preview modal (replaces system cropper) ── */}
      {preview && (
        <ImagePreviewModal
          preview={preview}
          onConfirm={confirmPreview}
          onRepick={() => setPreview(null)}
        />
      )}

      <SuccessModal
        visible={showSuccess}
        title={t('portfolioAdd.successTitle')}
        subtitle={t('portfolioAdd.successMsg')}
        primaryLabel={t('portfolioAdd.successOk')}
        onPrimary={() => { setShowSuccess(false); router.back(); }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

function createSt(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({

  scroll:  { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  footer:  { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },

  stepTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 6, textAlign: ta },
  stepSub:   { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 28, textAlign: ta },

  typeGrid:          { gap: 12 },
  typeCard:          { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 2, borderColor: colors.border },
  typeCardSelected:  { borderColor: colors.accent, backgroundColor: colors.accentDim },
  typeEmoji:         { fontSize: 32, marginBottom: 10, textAlign: ta },
  typeTitle:         { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4, textAlign: ta },
  typeTitleSelected: { color: colors.accent },
  typeDesc:          { fontSize: 13, color: colors.textMuted, lineHeight: 20, textAlign: ta },
  typeCheckmark:     { position: 'absolute', top: 16, left: 16, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  singleBox:      { height: 220 },
  baRow:          { flexDirection: 'row', alignItems: 'center', gap: 0 },
  baColumn:       { flex: 1 },
  baBox:          { height: 180 },
  baLabel:        { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  baArrow:        { paddingHorizontal: 6, paddingTop: 28 },
  baArrowText:    { fontSize: 20, color: colors.accent },
  videoBadge:     { marginTop: 12, backgroundColor: colors.successBg, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.success },
  videoBadgeText: { color: colors.successSoft, fontWeight: '700', fontSize: 13 },

  fieldLabel:  { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 12, textAlign: ta },
  catScroll:   { gap: 8, paddingVertical: 4 },
  catChip:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  catChipText: { fontSize: 13, fontWeight: '600' },
  descInput:   { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14, color: colors.textPrimary, fontSize: 14, lineHeight: 22, minHeight: 120, textAlignVertical: 'top' },
  charCount:   { fontSize: 11, color: colors.textMuted, textAlign: 'auto', marginTop: 6 },

  nextBtn:         { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: colors.border },
  nextBtnText:     { fontSize: 16, fontWeight: '800', color: colors.bg },
  });
}
