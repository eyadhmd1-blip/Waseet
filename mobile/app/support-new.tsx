// ============================================================
// WASEET — New Support Ticket Screen
// Category → Priority → Subject + Description → Submit
// ============================================================

import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useTheme } from '../src/context/ThemeContext';
import { AppHeader } from '../src/components/AppHeader';
import type { AppColors } from '../src/constants/colors';

const CATEGORY_KEYS = [
  { key: 'payment',  icon: '💳' },
  { key: 'order',    icon: '📋' },
  { key: 'provider', icon: '🔧' },
  { key: 'account',  icon: '👤' },
  { key: 'contract', icon: '📄' },
  { key: 'other',    icon: '💬' },
] as const;

type CategoryKey = typeof CATEGORY_KEYS[number]['key'];
type Priority = 'normal' | 'urgent';

export default function SupportNewScreen() {
  const router = useRouter();
  const { t, ta, isRTL } = useLanguage();
  const { colors, isDark } = useTheme();

  const styles = useMemo(() => createStyles(colors, isRTL, isDark), [colors, isRTL, isDark]);

  const [category,   setCategory] = useState<CategoryKey | null>(null);
  const [priority,   setPriority] = useState<Priority>('normal');
  const [subject,    setSubject]  = useState('');
  const [desc,       setDesc]     = useState('');
  const [submitting, setSubmit]   = useState(false);

  const [catError,     setCatError]     = useState(false);
  const [subjectError, setSubjectError] = useState(false);
  const [descError,    setDescError]    = useState(false);

  const handleSubmit = async () => {
    const c1 = !category;
    const s1 = subject.trim().length < 5;
    const d1 = desc.trim().length < 10;
    setCatError(c1);
    setSubjectError(s1);
    setDescError(d1);
    if (c1 || s1 || d1) return;
    setSubmit(true);

    const { data: { session: _ses } } = await supabase.auth.getSession();
    const user = _ses?.user;
    if (!user) { setSubmit(false); return; }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id:   user.id,
        category,
        priority,
        subject:   subject.trim(),
        status:    'open',
        opened_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      setSubmit(false);
      Alert.alert(t('common.error'), t('supportNew.errSubmit'));
      return;
    }

    // Add the initial description as first message
    await supabase.from('support_messages').insert({
      ticket_id: data.id,
      sender_id: user.id,
      is_admin:  false,
      body:      desc.trim(),
    });

    setSubmit(false);
    Alert.alert(
      t('supportNew.successTitle'),
      t('supportNew.successMsg'),
      [{
        text: t('supportNew.viewTicket'),
        onPress: () => router.replace({ pathname: '/support-thread', params: { id: data.id } } as any),
      }],
    );
  };

  const gradColors: [string, string] = isDark ? [colors.bg, '#1A1407'] : ['#FDF6E3', '#FFFBF8'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AppHeader variant="stack" title={t('supportNew.headerTitle')} onBack={() => router.back()} />
      <LinearGradient colors={gradColors} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Category */}
        <Text style={styles.label}>{t('supportNew.categoryLabel')}</Text>
        <View style={styles.catGrid}>
          {CATEGORY_KEYS.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catCard, category === c.key && styles.catCardActive]}
              onPress={() => { setCategory(c.key); if (catError) setCatError(false); }}
              activeOpacity={0.8}
            >
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, category === c.key && styles.catLabelActive]}>
                {t(`supportNew.cat${c.key.charAt(0).toUpperCase() + c.key.slice(1)}` as any)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {catError && (
          <Text style={styles.errorHint}>⚠️ يرجى اختيار نوع المشكلة</Text>
        )}

        {/* Priority */}
        <Text style={styles.label}>{t('supportNew.priorityLabel')}</Text>
        <View style={styles.priorityRow}>
          <TouchableOpacity
            style={[styles.priorityBtn, priority === 'normal' && styles.priorityBtnActive]}
            onPress={() => setPriority('normal')}
          >
            <Text style={[styles.priorityBtnText, priority === 'normal' && { color: '#38BDF8' }]}>
              {t('supportNew.priorityNormal')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.priorityBtn, priority === 'urgent' && styles.priorityBtnUrgent]}
            onPress={() => setPriority('urgent')}
          >
            <Text style={[styles.priorityBtnText, priority === 'urgent' && { color: '#F87171' }]}>
              {t('supportNew.priorityUrgent')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subject */}
        <Text style={styles.label}>{t('supportNew.subjectLabel')}</Text>
        <TextInput
          style={[styles.input, subjectError && styles.inputError]}
          placeholder={t('supportNew.subjectPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={subject}
          onChangeText={v => { setSubject(v); if (subjectError) setSubjectError(false); }}
          textAlign={ta}
          maxLength={120}
        />
        <Text style={styles.charCount}>
          {subject.length < 5
            ? `${subject.length} / 5 أحرف كحد أدنى`
            : t('supportNew.charCount', { count: subject.length, max: 120 })}
        </Text>
        {subjectError && (
          <Text style={styles.errorHint}>⚠️ يرجى كتابة موضوع المشكلة بـ 5 أحرف على الأقل</Text>
        )}

        {/* Description */}
        <Text style={styles.label}>{t('supportNew.descLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textarea, descError && styles.inputError]}
          placeholder={t('supportNew.descPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={desc}
          onChangeText={v => { setDesc(v); if (descError) setDescError(false); }}
          textAlign={ta}
          multiline
          numberOfLines={5}
          maxLength={1000}
        />
        <Text style={styles.charCount}>
          {desc.length < 10
            ? `${desc.length} / 10 أحرف كحد أدنى`
            : t('supportNew.charCount', { count: desc.length, max: 1000 })}
        </Text>
        {descError && (
          <Text style={styles.errorHint}>⚠️ يرجى شرح مشكلتك بـ 10 أحرف على الأقل لنتمكن من مساعدتك</Text>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.submitBtnText}>{t('supportNew.submitBtn')}</Text>
          }
        </TouchableOpacity>

        <Text style={styles.footNote}>
          {t('supportNew.footNote')}
        </Text>

      </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors, isRTL: boolean, isDark: boolean) {
  const ta = isRTL ? 'right' : 'left' as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },


    content: { padding: 16, paddingBottom: 48 },

    label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 20, marginBottom: 10, alignSelf: 'stretch', textAlign: ta },

    catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catCard:       { width: '30%', backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.92)', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: isDark ? colors.border : 'rgba(201,168,76,0.20)', gap: 6 },
    catCardActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
    catIcon:       { fontSize: 24 },
    catLabel:      { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
    catLabelActive:{ color: colors.accent },

    priorityRow:       { flexDirection: 'row', gap: 12 },
    priorityBtn:       { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    priorityBtnActive: { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.08)' },
    priorityBtnUrgent: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' },
    priorityBtnText:   { fontSize: 14, fontWeight: '700', color: colors.textMuted },

    input:     { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.border, writingDirection: isRTL ? 'rtl' : 'ltr' },
    inputError: { borderColor: '#EF4444' },
    textarea:  { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
    charCount: { fontSize: 11, color: colors.textMuted, marginTop: 4, alignSelf: 'stretch', textAlign: ta },
    errorHint: { fontSize: 13, color: '#EF4444', marginTop: 4, marginBottom: 4, alignSelf: 'stretch', textAlign: ta },

    submitBtn:         { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    submitBtnDisabled: { backgroundColor: colors.border },
    submitBtnText:     { fontSize: 16, fontWeight: '700', color: colors.bg },

    footNote: { fontSize: 12, color: colors.textMuted, marginTop: 14, lineHeight: 18, alignSelf: 'stretch', textAlign: ta },
  });
}
