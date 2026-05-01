// ============================================================
// WASEET — Rate Job Screen
// Shown to client after job completion (confirmed_by_client=true)
// Params: job_id, provider_name
// ============================================================

import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import { AppHeader } from '../src/components/AppHeader';
import type { AppColors } from '../src/constants/colors';

const TAG_KEYS = ['fast', 'excellent', 'affordable', 'professional', 'recommended', 'communication'] as const;
type TagKey = typeof TAG_KEYS[number];

export default function RateJobScreen() {
  const router = useRouter();
  const { t, ta, isRTL } = useLanguage();
  const { colors } = useTheme();
  const { job_id, provider_name } = useLocalSearchParams<{
    job_id: string;
    provider_name: string;
  }>();

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const [rating, setRating]       = useState(0);
  const [hovered, setHovered]     = useState(0);
  const [review, setReview]       = useState('');
  const [tags, setTags]           = useState<TagKey[]>([]);
  const [submitting, setSubmit]   = useState(false);

  const toggleTag = (tag: TagKey) => {
    setTags(prev =>
      prev.includes(tag) ? prev.filter(k => k !== tag) : [...prev, tag]
    );
  };

  const displayRating = hovered || rating;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t('common.attention'), t('rateJob.selectStar'));
      return;
    }

    setSubmit(true);

    const tagStr = tags.length > 0
      ? `\n\n✓ ${tags.map(k => t(`rateJob.tags.${k}` as any)).join(' · ')}`
      : '';
    const fullReview = (review.trim() + tagStr).trim();

    const { error } = await supabase
      .from('jobs')
      .update({
        client_rating: rating,
        client_review: fullReview || null,
      })
      .eq('id', job_id);

    setSubmit(false);

    if (error) {
      Alert.alert(t('common.error'), t('rateJob.errSubmit'));
      return;
    }

    Alert.alert(
      t('rateJob.successTitle'),
      t('rateJob.successMsg', { name: provider_name }),
      [{ text: t('common.confirm'), onPress: () => router.replace('/(client)/requests') }],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppHeader variant="stack" title={t('rateJob.title')} onBack={() => router.replace('/(client)/requests' as any)} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Provider chip */}
        <View style={styles.provChip}>
          <View style={styles.provAvatar}>
            <Text style={styles.provAvatarText}>{provider_name?.charAt(0) ?? '?'}</Text>
          </View>
          <View>
            <Text style={styles.provName}>{provider_name}</Text>
            <Text style={styles.provSub}>{t('rateJob.providerSub')}</Text>
          </View>
        </View>

        {/* Star rating */}
        <Text style={styles.rateLabel}>{t('rateJob.rateLabel')}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity
              key={n}
              onPress={() => { setRating(n); setHovered(0); }}
              onPressIn={() => setHovered(n)}
              onPressOut={() => setHovered(0)}
              activeOpacity={0.7}
            >
              <Text style={[styles.star, n <= displayRating && styles.starActive]}>
                ⭐
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {displayRating > 0 && (
          <Text style={styles.starLabel}>
            {t(`rateJob.stars.${displayRating}` as any)}
          </Text>
        )}

        {/* Quick tags */}
        {rating >= 4 && (
          <>
            <Text style={styles.tagsLabel}>{t('rateJob.tagsLabel')}</Text>
            <View style={styles.tagsWrap}>
              {TAG_KEYS.map(key => (
                <TouchableOpacity
                  key={key}
                  style={[styles.tag, tags.includes(key) && styles.tagActive]}
                  onPress={() => toggleTag(key)}
                >
                  <Text style={[styles.tagText, tags.includes(key) && styles.tagTextActive]}>
                    {t(`rateJob.tags.${key}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Text review */}
        <TextInput
          style={styles.reviewInput}
          placeholder={t('rateJob.reviewPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={review}
          onChangeText={setReview}
          textAlign={ta}
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (rating === 0 || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.submitBtnText}>{t('rateJob.submit')} ✓</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors, isRTL: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },


    content: { flexGrow: 1, padding: 24 },

    provChip:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 28, gap: 12, borderWidth: 1, borderColor: colors.border },
    provAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    provAvatarText: { fontSize: 20, fontWeight: '700', color: colors.bg },
    provName:       { fontSize: 16, fontWeight: '700', color: colors.textPrimary, alignSelf: 'stretch', textAlign: ta },
    provSub:        { fontSize: 12, color: colors.textMuted, marginTop: 2, alignSelf: 'stretch', textAlign: ta },

    rateLabel:  { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 20 },
    starsRow:   { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
    star:       { fontSize: 40, opacity: 0.25 },
    starActive: { opacity: 1 },
    starLabel:  { fontSize: 16, fontWeight: '700', color: colors.accent, textAlign: 'center', marginBottom: 20 },

    tagsLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 10, alignSelf: 'stretch', textAlign: ta },
    tagsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    tag:       { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
    tagActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
    tagText:   { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    tagTextActive: { color: colors.accent },

    reviewInput:    { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.border, minHeight: 90, textAlignVertical: 'top', marginBottom: 24 },

    submitBtn:         { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    submitBtnDisabled: { backgroundColor: colors.border },
    submitBtnText:     { fontSize: 16, fontWeight: '700', color: colors.bg },
  });
}
