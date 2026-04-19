// ============================================================
// WASEET — New Support Ticket Screen
// Category → Priority → Subject + Description → Submit
// ============================================================

import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useLanguage } from '../src/hooks/useLanguage';
import { useInsets } from '../src/hooks/useInsets';
import { HEADER_PAD } from '../src/utils/layout';
import { useTheme } from '../src/context/ThemeContext';
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
    const { headerPad } = useInsets();
  const router = useRouter();
  const { t, ta } = useLanguage();
  const { colors } = useTheme();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const [category,   setCategory] = useState<CategoryKey | null>(null);
  const [priority,   setPriority] = useState<Priority>('normal');
  const [subject,    setSubject]  = useState('');
  const [desc,       setDesc]     = useState('');
  const [submitting, setSubmit]   = useState(false);

  const canSubmit = !!category && subject.trim().length >= 5 && desc.trim().length >= 10;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmit(true);

    const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('supportNew.headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Category */}
        <Text style={[styles.label, { textAlign: ta }]}>{t('supportNew.categoryLabel')}</Text>
        <View style={styles.catGrid}>
          {CATEGORY_KEYS.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catCard, category === c.key && styles.catCardActive]}
              onPress={() => setCategory(c.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, category === c.key && styles.catLabelActive]}>
                {t(`supportNew.cat${c.key.charAt(0).toUpperCase() + c.key.slice(1)}` as any)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Priority */}
        <Text style={[styles.label, { textAlign: ta }]}>{t('supportNew.priorityLabel')}</Text>
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
        <Text style={[styles.label, { textAlign: ta }]}>{t('supportNew.subjectLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('supportNew.subjectPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={subject}
          onChangeText={setSubject}
          textAlign={ta}
          maxLength={120}
        />
        <Text style={[styles.charCount, { textAlign: ta }]}>{subject.length}/120</Text>

        {/* Description */}
        <Text style={[styles.label, { textAlign: ta }]}>{t('supportNew.descLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder={t('supportNew.descPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={desc}
          onChangeText={setDesc}
          textAlign={ta}
          multiline
          numberOfLines={5}
          maxLength={1000}
        />
        <Text style={[styles.charCount, { textAlign: ta }]}>{desc.length}/1000</Text>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.submitBtnText}>{t('supportNew.submitBtn')}</Text>
          }
        </TouchableOpacity>

        <Text style={[styles.footNote, { textAlign: ta }]}>
          {t('supportNew.footNote')}
        </Text>

      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },

    topBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: HEADER_PAD, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 22, color: colors.textSecondary, transform: [{ scaleX: -1 }] },
    topTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

    content: { padding: 16, paddingBottom: 48 },

    label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 20, marginBottom: 10 },

    catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    catCard:       { width: '30%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 6 },
    catCardActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
    catIcon:       { fontSize: 24 },
    catLabel:      { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
    catLabelActive:{ color: colors.accent },

    priorityRow:       { flexDirection: 'row', gap: 12 },
    priorityBtn:       { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    priorityBtnActive: { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.08)' },
    priorityBtnUrgent: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' },
    priorityBtnText:   { fontSize: 14, fontWeight: '700', color: colors.textMuted },

    input:     { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.border },
    textarea:  { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
    charCount: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

    submitBtn:         { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    submitBtnDisabled: { backgroundColor: colors.border },
    submitBtnText:     { fontSize: 16, fontWeight: '700', color: colors.bg },

    footNote: { fontSize: 12, color: colors.textMuted, marginTop: 14, lineHeight: 18 },
  });
}
